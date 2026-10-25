/* ==========================================================================
   OBSERVACIONES INSTITUCIONALES (administrativas y pedagógicas)
   Director > Regente > Secretaría > Preceptores y docentes. Cada uno observa
   a quienes están por debajo; la persona observada la lee y deja constancia de
   la notificación oficial es el acta o el correo; la plataforma solo registra
   cuándo la abrió. Quien observó (o alguien de rango superior) puede agregar
   seguimientos. Las reglas las controla la base de datos.
   Archivo: js/observaciones.js
   ========================================================================== */

const ObservacionesModulo = {
  lista: [],
  nuevas: new Set(),
  vista: 'todas',        // 'recibidas' | 'realizadas' | 'todas'
  busqueda: '',
  miId: null,
  miRol: '',
  RANGO: { admin: 4, regente: 3, secretaria: 2, preceptor: 1, docente: 1 },
  ROLES: { admin: 'Director', regente: 'Regente', secretaria: 'Secretaría', preceptor: 'Preceptor', docente: 'Docente' },
  TIPOS: { pedagogica: 'Pedagógica', administrativa: 'Administrativa', otra: 'Otra' },

  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  rango(r) { return this.RANGO[String(r || '').toLowerCase()] || 0; },
  rol(r) { return this.ROLES[String(r || '').toLowerCase()] || r || ''; },
  fecha(s) { return s ? String(s).slice(0, 10).split('-').reverse().join('/') : ''; },
  fechaHora(s) { try { return new Date(s).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } },
  https(u) { return /^https:\/\//i.test(String(u || '')) ? String(u) : ''; },

  async identificar() {
    if (this.miId) return;
    const { data } = await supabase.auth.getUser();
    this.miId = data && data.user ? data.user.id : null;
    const p = (window.Auth && Auth.usuarioActual) || {};
    this.miRol = String(p.rol || '').toLowerCase().trim();
  },

  async cargar() {
    const cont = document.getElementById('observaciones-contenido');
    if (!cont) return;
    cont.innerHTML = '<p class="seg-cargando">Cargando observaciones…</p>';
    try {
      await this.identificar();
      const { data, error } = await supabase.from('observaciones_institucionales')
        .select('*, observaciones_seguimiento(*)')
        .order('fecha', { ascending: false }).order('id', { ascending: false });
      if (error) throw error;
      this.lista = data || [];
      const nuevas = this.lista.filter(o => o.destinatario_id === this.miId && !o.vista_at).map(o => o.id);
      this.nuevas = new Set(nuevas);
      this.dibujar();
      if (nuevas.length) {
        // Abrir la pestaña deja registrada la visualización (la notificación oficial es el acta o el correo)
        const r = await supabase.rpc('marcar_observaciones_vistas');
        if (!r.error) { const ahora = new Date().toISOString(); this.lista.forEach(o => { if (this.nuevas.has(o.id)) o.vista_at = ahora; }); }
      }
      this.contarPendientes();
    } catch (err) {
      console.error('Observaciones:', err);
      const falta = /observaciones_institucionales|relation|schema cache/i.test(err.message || '');
      cont.innerHTML = `<div class="prog-vacio">No se pudieron cargar las observaciones.${falta ? ' Falta ejecutar <strong>sql/27_observaciones_institucionales.sql</strong> en Supabase.' : ' Probá recargar la página.'}</div>`;
    }
  },

  /* Recibidas sin abrir: contador en el menú y campanita arriba a la derecha */
  async contarPendientes() {
    try {
      await this.identificar();
      const { count } = await supabase.from('observaciones_institucionales')
        .select('id', { count: 'exact', head: true })
        .eq('destinatario_id', this.miId).is('vista_at', null);
      const n = count || 0;
      const btn = document.getElementById('btn-observaciones');
      if (btn) {
        let b = btn.querySelector('.seg-badge');
        if (!n) { if (b) b.remove(); }
        else { if (!b) { b = document.createElement('span'); b.className = 'seg-badge'; btn.appendChild(b); } b.textContent = String(n); }
      }
      this.dibujarCampana(n);
    } catch (e) { /* sin el SQL o sin sesión: no se muestra el contador */ }
  },

  dibujarCampana(n) {
    if (this.miRol === 'estudiante' || !this.miRol) return;
    let c = document.getElementById('btn-notificaciones-campana');
    if (!c) {
      c = document.createElement('div');
      c.id = 'btn-notificaciones-campana';
      c.style.cssText = 'position:fixed; top:12px; right:20px; z-index:99999; cursor:pointer; font-size:1.3rem; background:#1e293b; padding:0.4rem 0.8rem; border-radius:20px; border:1px solid rgba(255,255,255,0.15); display:flex; align-items:center; gap:0.4rem; color:#fff; box-shadow:0 4px 10px rgba(0,0,0,0.3);';
      c.title = 'Observaciones';
      c.onclick = () => { if (window.UI) UI.showTab('observaciones'); };
      document.body.appendChild(c);
    }
    c.innerHTML = `🔔 ${n > 0 ? `<span style="background:#ef4444; color:#fff; font-size:0.75rem; font-weight:bold; padding:0.1rem 0.4rem; border-radius:10px;">${n}</span>` : ''}`;
  },

  puedeObservar() { return this.rango(this.miRol) >= 2; },
  puedeSeguir(o) {
    return o.autor_id === this.miId || (this.rango(this.miRol) >= 2 && this.rango(this.miRol) > this.rango(o.destinatario_rol));
  },

  filtradas() {
    const q = this.busqueda.trim().toLowerCase();
    return this.lista.filter(o => {
      if (this.vista === 'recibidas' && o.destinatario_id !== this.miId) return false;
      if (this.vista === 'realizadas' && o.autor_id !== this.miId) return false;
      return !q || `${o.titulo} ${o.autor_nombre} ${o.destinatario_nombre} ${o.texto}`.toLowerCase().includes(q);
    });
  },

  tarjeta(o) {
    const yoDest = o.destinatario_id === this.miId;
    const seg = (o.observaciones_seguimiento || []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const link = this.https(o.link_documento);
    const vista = !!o.vista_at;
    const nueva = yoDest && this.nuevas && this.nuevas.has(o.id);
    return `<article class="obs-card tipo-${this.esc(o.tipo)}">
      <header>
        <div class="act-chips"><span class="act-chip tipo">${this.esc(this.TIPOS[o.tipo] || o.tipo)}</span><span class="act-chip">📅 ${this.esc(this.fecha(o.fecha))}</span>
          ${nueva ? '<span class="act-chip mid">🆕 Nueva</span>' : ''}
          ${vista ? `<span class="act-chip ok" title="Registro de la plataforma; la notificación oficial es el acta o el correo">👁 Abierta por ${this.esc(o.destinatario_nombre)} el ${this.esc(this.fechaHora(o.vista_at))}</span>` : (yoDest ? '' : '<span class="act-chip mid">Todavía no la abrió</span>')}
          ${o.editada_at ? '<span class="act-chip">editada</span>' : ''}</div>
        <h3>${this.esc(o.titulo)}</h3>
        <p class="obs-quien"><b>${this.esc(o.autor_nombre)}</b> (${this.esc(this.rol(o.autor_rol))}) → <b>${this.esc(o.destinatario_nombre)}</b> (${this.esc(this.rol(o.destinatario_rol))})</p>
      </header>
      <p class="obs-texto">${this.esc(o.texto).replace(/\n/g, '<br>')}</p>
      ${link ? `<p><a class="act-btn-sec" href="${this.esc(link)}" target="_blank" rel="noopener noreferrer">📎 Ver acta o correo</a></p>` : ''}
      ${o.texto_documento ? `<details class="obs-doc"><summary>Texto del acta o correo</summary><div>${this.esc(o.texto_documento).replace(/\n/g, '<br>')}</div></details>` : ''}
      ${link || o.texto_documento ? '' : '<p class="obs-resp">Sin acta ni correo adjunto: la notificación oficial queda sin respaldo en la plataforma.</p>'}
      ${seg.length ? `<div class="obs-seg"><h4>Seguimiento</h4>${seg.map(s => `<div class="obs-seg-item"><small>${this.esc(this.fechaHora(s.created_at))} · <b>${this.esc(s.autor_nombre)}</b> (${this.esc(this.rol(s.autor_rol))})</small><p>${this.esc(s.texto).replace(/\n/g, '<br>')}</p>${this.https(s.link_documento) ? `<a href="${this.esc(s.link_documento)}" target="_blank" rel="noopener noreferrer">📎 Ver documento</a>` : ''}</div>`).join('')}</div>` : ''}
      <footer class="cuentas-acc">
        ${this.puedeSeguir(o) ? `<button type="button" class="btn btn-outline" onclick="ObservacionesModulo.seguimiento(${o.id})">➕ Agregar seguimiento</button>` : ''}
        ${o.autor_id === this.miId && !vista ? `<button type="button" class="btn btn-outline" onclick="ObservacionesModulo.formulario(${o.id})">✏️ Corregir</button>` : ''}
        ${this.miRol === 'admin' ? `<button type="button" class="btn btn-outline" onclick="ObservacionesModulo.eliminar(${o.id})">🗑️ Eliminar</button>` : ''}
      </footer>
    </article>`;
  },

  dibujar() {
    const cont = document.getElementById('observaciones-contenido');
    if (!cont) return;
    const v = this.filtradas();
    const ve = (this.miRol === 'admin' || this.miRol === 'regente');
    const tab = (k, t) => `<button type="button" class="${this.vista === k ? 'sel' : ''}" onclick="ObservacionesModulo.cambiarVista('${k}')">${t}</button>`;
    cont.innerHTML = `
      <div class="sec-barra">
        <div class="act-filtro">${tab('todas', ve ? 'Todas' : 'Todas las mías')}${tab('recibidas', 'Recibidas')}${this.puedeObservar() ? tab('realizadas', 'Realizadas') : ''}</div>
        <label>Buscar<input class="form-control" type="search" id="obs-buscar" autocomplete="off" value="${this.esc(this.busqueda)}" oninput="ObservacionesModulo.buscar(this.value)" placeholder="Persona o título"></label>
        <div class="sec-acciones">${this.puedeObservar() ? '<button type="button" class="btn btn-gold" onclick="ObservacionesModulo.formulario()">➕ Nueva observación</button>' : ''}</div>
      </div>
      <p class="acta-ayuda">${this.puedeObservar() ? 'Las observaciones que dejás las ve la persona observada, que no puede modificarlas. La notificación oficial sigue siendo el acta o el correo: adjuntalo acá; la plataforma solo registra cuándo la abrió. ' : 'Acá ves las observaciones que te hicieron; no se pueden modificar. '}${ve ? 'Como Director o Regente ves todas las observaciones de la institución.' : ''}</p>
      ${v.length ? v.map(o => this.tarjeta(o)).join('') : '<div class="prog-vacio">No hay observaciones para mostrar.</div>'}`;
  },

  cambiarVista(k) { this.vista = k; this.dibujar(); },
  buscar(t) { this.busqueda = t || ''; this.dibujar(); const i = document.getElementById('obs-buscar'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } },

  /* ---------- Nueva observación / corregir ---------- */
  async formulario(id) {
    const o = id ? this.lista.find(x => x.id === id) : null;
    let dest = [], trays = [];
    if (!o) {
      const r = await supabase.rpc('destinatarios_observacion');
      if (r.error) { Swal.fire({ icon: 'error', title: 'No se pudo abrir el formulario', text: r.error.message }); return; }
      dest = r.data || [];
      if (!dest.length) { Swal.fire({ icon: 'info', title: 'No hay personas para observar', text: 'No hay usuarios activos de rango inferior al tuyo.' }); return; }
    }
    const t = await supabase.from('trayectos').select('id, nombre, ciclo_lectivo').order('ciclo_lectivo', { ascending: false }).order('nombre');
    trays = t.data || [];
    const hoy = new Date().toISOString().slice(0, 10);
    const val = (k, d = '') => this.esc(o ? (o[k] ?? d) : d);
    const res = await Swal.fire({
      title: o ? 'Corregir observación' : 'Nueva observación',
      width: 640, showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', focusConfirm: false,
      html: `<div class="obs-form">
        ${o ? `<p><b>Para:</b> ${this.esc(o.destinatario_nombre)} (${this.esc(this.rol(o.destinatario_rol))})</p>` :
          `<label>Persona observada<select id="of-dest" class="swal2-select">${dest.map(d => `<option value="${this.esc(d.id)}">${this.esc(d.nombre)} · ${this.esc(this.rol(d.rol))}</option>`).join('')}</select></label>`}
        <label>Tipo<select id="of-tipo" class="swal2-select">${Object.entries(this.TIPOS).map(([k, n]) => `<option value="${k}" ${o && o.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Fecha de la reunión u observación<input id="of-fecha" type="date" class="swal2-input" value="${o ? this.esc(String(o.fecha).slice(0, 10)) : hoy}"></label>
        <label>Título<input id="of-titulo" class="swal2-input" maxlength="200" value="${val('titulo')}" placeholder="Ej.: Supervisión de funciones · octubre"></label>
        <label>Observación<textarea id="of-texto" class="swal2-textarea" maxlength="8000" placeholder="Qué se observó, acuerdos, qué se espera…">${val('texto')}</textarea></label>
        <label>Link al acta o correo (opcional, https://)<input id="of-link" class="swal2-input" value="${val('link_documento')}" placeholder="https://drive.google.com/…"></label>
        <label>Texto del acta o correo (opcional)<textarea id="of-doc" class="swal2-textarea" maxlength="20000" placeholder="Podés pegar acá el contenido">${val('texto_documento')}</textarea></label>
        <label>Trayecto (si es una observación de clase)<select id="of-tray" class="swal2-select"><option value="">—</option>${trays.map(x => `<option value="${x.id}" ${o && Number(o.trayecto_id) === Number(x.id) ? 'selected' : ''}>${this.esc(x.nombre)} (${this.esc(x.ciclo_lectivo)})</option>`).join('')}</select></label>
      </div>`,
      preConfirm: () => {
        const g = (i) => (document.getElementById(i)?.value || '').trim();
        if (!g('of-titulo') || !g('of-texto') || !g('of-fecha')) { Swal.showValidationMessage('Completá fecha, título y observación.'); return false; }
        if (g('of-link') && !/^https:\/\//i.test(g('of-link'))) { Swal.showValidationMessage('El link debe empezar con https://'); return false; }
        return { dest: g('of-dest'), tipo: g('of-tipo'), fecha: g('of-fecha'), titulo: g('of-titulo'), texto: g('of-texto'), link: g('of-link') || null, doc: g('of-doc') || null, tray: g('of-tray') ? Number(g('of-tray')) : null };
      }
    });
    if (!res.isConfirmed) return;
    const f = res.value;
    const { error } = o
      ? await supabase.rpc('editar_observacion', { p_id: o.id, p_tipo: f.tipo, p_fecha: f.fecha, p_titulo: f.titulo, p_texto: f.texto, p_link: f.link, p_texto_doc: f.doc, p_trayecto: f.tray })
      : await supabase.rpc('crear_observacion', { p_destinatario: f.dest, p_tipo: f.tipo, p_fecha: f.fecha, p_titulo: f.titulo, p_texto: f.texto, p_link: f.link, p_texto_doc: f.doc, p_trayecto: f.tray });
    if (error) { Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: error.message }); return; }
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: o ? 'Observación corregida' : 'Observación guardada', showConfirmButton: false, timer: 1800 });
    this.cargar();
  },

  async seguimiento(id) {
    const r = await Swal.fire({
      title: 'Agregar seguimiento', width: 560, focusConfirm: false, showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar',
      html: `<textarea id="os-texto" class="swal2-textarea" maxlength="4000" placeholder="Cómo siguió, qué se verificó, nuevos acuerdos…"></textarea>
             <input id="os-link" class="swal2-input" placeholder="Link a un documento (opcional, https://)">`,
      preConfirm: () => {
        const t = (document.getElementById('os-texto')?.value || '').trim();
        const l = (document.getElementById('os-link')?.value || '').trim();
        if (!t) { Swal.showValidationMessage('Escribí el seguimiento.'); return false; }
        if (l && !/^https:\/\//i.test(l)) { Swal.showValidationMessage('El link debe empezar con https://'); return false; }
        return { t, l: l || null };
      }
    });
    if (!r.isConfirmed) return;
    const { error } = await supabase.rpc('agregar_seguimiento_obs', { p_id: id, p_texto: r.value.t, p_link: r.value.l });
    if (error) { Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: error.message }); return; }
    this.cargar();
  },

  async eliminar(id) {
    const r = await Swal.fire({ title: 'Eliminar observación', text: 'Se borra con sus seguimientos. Queda el registro en la auditoría. ¿Seguro?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar' });
    if (!r.isConfirmed) return;
    const { error } = await supabase.rpc('eliminar_observacion', { p_id: id });
    if (error) { Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: error.message }); return; }
    this.cargar();
  }
};

window.ObservacionesModulo = ObservacionesModulo;
