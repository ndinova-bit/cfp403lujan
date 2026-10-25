/* Libro de temas del docente: fecha + tema + actividad por cada clase dictada.
   - Lo carga el docente del trayecto (o el administrador).
   - Al abrirlo, Director y Regente quedan "visados" automáticamente (sin botón): queda
     registrado que lo vieron, con fecha y nombre. Pueden dejar observaciones puntuales
     (sobre un tema) o generales (sobre el libro), que el docente ve pero no edita.
   - Tiene una versión imprimible (ventana aparte, con lo justo para imprimir). */
const LibroTemasModulo = {
  trayectoId: null,
  rol: '',
  nombreTrayecto: '',
  temas: [],
  visados: [],
  comentarios: [],

  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  hoyISO() { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); },
  fmt(f) { return f ? String(f).split('-').reverse().join('/') : ''; },

  async cargar(trayectoId, nombreTrayecto) {
    this.trayectoId = Number(trayectoId);
    this.nombreTrayecto = nombreTrayecto || this.nombreTrayecto || '';
    const cont = document.getElementById('contenedor-libro-temas');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#94a3b8; text-align:center;">Cargando libro de temas…</p>';

    const perfil = (window.Auth && Auth.usuarioActual) || {};
    this.rol = String(perfil.rol || '').toLowerCase().trim();
    this.esAdminTotal = Auth.esAdmin(this.rol);
    this.esRegente = this.rol === 'regente';
    this.puedeCargar = this.esAdminTotal || this.rol === 'docente';
    this.puedeVisar = this.esAdminTotal || this.esRegente;

    try {
      const [rTemas, rVis, rCom, rMod] = await Promise.all([
        supabase.from('libro_temas').select('*').eq('trayecto_id', this.trayectoId).order('fecha', { ascending: true }),
        supabase.from('libro_temas_visados').select('*').eq('trayecto_id', this.trayectoId).order('created_at', { ascending: false }).limit(12),
        supabase.from('libro_temas_comentarios').select('*').eq('trayecto_id', this.trayectoId).order('created_at', { ascending: true }),
        supabase.from('modulos').select('id, nombre').eq('trayecto_id', this.trayectoId).order('id')
      ]);
      if (rTemas.error) throw rTemas.error;
      this.temas = rTemas.data || [];
      this.visados = (!rVis.error && rVis.data) || [];
      this.comentarios = (!rCom.error && rCom.data) || [];
      this.modulos = (!rMod.error && rMod.data) || [];

      // El Director/la Regente quedan visados con solo abrir esta pantalla (una vez por día)
      if (this.puedeVisar) supabase.rpc('visar_libro_temas', { p_trayecto: this.trayectoId }).then(() => {});

      this.render();
    } catch (err) {
      cont.innerHTML = `<div class="prog-vacio">No se pudo cargar el libro de temas: ${this.esc(err.message || '')}${/libro_temas/.test(err.message || '') ? ' (falta ejecutar sql/32_libro_de_temas.sql en Supabase)' : ''}</div>`;
    }
  },

  comentariosDe(temaId) { return this.comentarios.filter(c => Number(c.tema_id) === Number(temaId)); },
  comentariosGenerales() { return this.comentarios.filter(c => c.tema_id === null); },

  render() {
    const cont = document.getElementById('contenedor-libro-temas');
    if (!cont) return;
    const ult3 = this.visados.slice(0, 3);
    const visadoHoy = this.visados.some(v => v.created_at && v.created_at.slice(0, 10) === this.hoyISO());
    const genComentarios = this.comentariosGenerales();

    cont.innerHTML = `
      <div class="lt-barra">
        <div class="lt-visado" title="${ult3.map(v => this.esc(v.visado_por_nombre) + ' · ' + this.fmt(v.created_at.slice(0, 10))).join(' | ') || 'Todavía sin visar'}">
          ${ult3.length ? `👁️ Visado por última vez: <b>${this.esc(ult3[0].visado_por_nombre)}</b> (${this.fmt(ult3[0].created_at.slice(0, 10))})${this.puedeVisar && visadoHoy ? ' · quedaste visado hoy' : ''}` : '👁️ Todavía sin visar por Dirección/Regencia'}
        </div>
        <div class="lt-acciones">
          <button type="button" class="btn btn-outline" style="padding:0.3rem 0.7rem; font-size:0.78rem;" onclick="LibroTemasModulo.verVisados()">Ver visados</button>
          <button type="button" class="btn btn-outline" style="padding:0.3rem 0.7rem; font-size:0.78rem;" onclick="LibroTemasModulo.imprimir()">🖨️ Imprimir</button>
          ${this.puedeVisar ? `<button type="button" class="btn btn-outline" style="padding:0.3rem 0.7rem; font-size:0.78rem;" onclick="LibroTemasModulo.comentarGeneral()">💬 Observación general${genComentarios.length ? ' (' + genComentarios.length + ')' : ''}</button>` : (genComentarios.length ? `<button type="button" class="btn btn-outline" style="padding:0.3rem 0.7rem; font-size:0.78rem;" onclick="LibroTemasModulo.verComentarios(null)">💬 Observaciones generales (${genComentarios.length})</button>` : '')}
        </div>
      </div>
      ${this.puedeCargar ? `
        <details id="lt-form-wrap" class="act-form-wrap" style="margin-top:0.6rem;">
          <summary>➕ Cargar clase dictada</summary>
          <form id="lt-form" onsubmit="LibroTemasModulo.guardar(event)" style="display:grid; gap:0.6rem; padding:0.8rem 0.2rem 0.2rem;">
            <input type="hidden" id="lt-id" value="">
            <div class="act-grid3">
              <label>Fecha *<input type="date" id="lt-fecha" class="act-in" required value="${this.hoyISO()}" max="${this.hoyISO()}"></label>
              ${this.modulos.length ? `<label>Módulo<select id="lt-modulo" class="act-in"><option value="">—</option>${this.modulos.map(m => `<option value="${Number(m.id)}">${this.esc(m.nombre)}</option>`).join('')}</select></label>` : '<div></div>'}
              <div></div>
            </div>
            <label>Tema dictado *<input type="text" id="lt-tema" class="act-in" maxlength="300" required placeholder="Ej.: Producción de tortas negras"></label>
            <label>Actividad realizada<textarea id="lt-actividad" class="act-in" rows="2" maxlength="2000" placeholder="Qué hicieron en la clase (opcional)"></textarea></label>
            <div class="act-form-pie">
              <button type="button" id="lt-btn-cancelar" class="act-btn-sec" style="display:none;" onclick="LibroTemasModulo.cancelarEdicion()">Cancelar edición</button>
              <button type="submit" class="act-btn">💾 Guardar</button>
            </div>
          </form>
        </details>` : ''}
      <div id="lt-lista" style="margin-top:0.8rem;"></div>
    `;
    this.renderLista();
  },

  renderLista() {
    const cont = document.getElementById('lt-lista');
    if (!cont) return;
    if (!this.temas.length) { cont.innerHTML = '<div class="prog-vacio">Todavía no hay clases cargadas.</div>'; return; }
    const porModulo = new Map(this.modulos.map(m => [Number(m.id), m.nombre]));
    cont.innerHTML = `<table class="lt-tabla"><thead><tr><th>Fecha</th>${this.modulos.length ? '<th>Módulo</th>' : ''}<th>Tema</th><th>Actividad</th><th></th></tr></thead><tbody>
      ${this.temas.map(t => {
        const coms = this.comentariosDe(t.id);
        return `<tr>
          <td data-label="Fecha">${this.fmt(t.fecha)}</td>
          ${this.modulos.length ? `<td data-label="Módulo">${this.esc(porModulo.get(Number(t.modulo_id)) || '—')}</td>` : ''}
          <td data-label="Tema">${this.esc(t.tema)}</td>
          <td data-label="Actividad">${this.esc(t.actividad || '—')}</td>
          <td class="lt-col-acciones">
            ${coms.length ? `<button type="button" class="lt-com-btn" title="Ver observaciones" onclick="LibroTemasModulo.verComentarios(${Number(t.id)})">💬 ${coms.length}</button>` : (this.puedeVisar ? `<button type="button" class="lt-com-btn lt-com-btn-vacio" title="Agregar observación" onclick="LibroTemasModulo.comentarTema(${Number(t.id)})">💬</button>` : '')}
            ${this.puedeCargar ? `<button type="button" class="lt-mini" title="Editar" onclick="LibroTemasModulo.editar(${Number(t.id)})">✏️</button>
            <button type="button" class="lt-mini" title="Borrar" onclick="LibroTemasModulo.borrar(${Number(t.id)})">🗑️</button>` : ''}
          </td>
        </tr>`;
      }).join('')}
    </tbody></table>`;
  },

  async guardar(e) {
    e.preventDefault();
    const id = document.getElementById('lt-id').value;
    const fecha = document.getElementById('lt-fecha').value;
    const tema = document.getElementById('lt-tema').value.trim();
    const actividad = document.getElementById('lt-actividad').value.trim();
    const modSel = document.getElementById('lt-modulo');
    if (!fecha || !tema) { alert('Completá la fecha y el tema.'); return; }
    const perfil = (window.Auth && Auth.usuarioActual) || {};
    const registro = {
      trayecto_id: this.trayectoId, fecha, tema, actividad: actividad || null,
      modulo_id: modSel && modSel.value ? Number(modSel.value) : null
    };
    try {
      let error;
      if (id) {
        registro.editado_at = new Date().toISOString();
        ({ error } = await supabase.from('libro_temas').update(registro).eq('id', Number(id)));
      } else {
        registro.creado_por_nombre = `${perfil.apellido || ''}, ${perfil.nombre || ''}`.trim();
        ({ error } = await supabase.from('libro_temas').insert([registro]));
      }
      if (error) throw error;
      if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: id ? 'Clase actualizada' : 'Clase cargada', showConfirmButton: false, timer: 1800 });
      this.cancelarEdicion();
      await this.cargar(this.trayectoId, this.nombreTrayecto);
    } catch (err) {
      alert('No se pudo guardar: ' + (err.message || ''));
    }
  },

  editar(id) {
    const t = this.temas.find(x => Number(x.id) === Number(id));
    if (!t) return;
    const wrap = document.getElementById('lt-form-wrap');
    if (wrap) wrap.open = true;
    document.getElementById('lt-id').value = t.id;
    document.getElementById('lt-fecha').value = t.fecha;
    document.getElementById('lt-tema').value = t.tema;
    document.getElementById('lt-actividad').value = t.actividad || '';
    const modSel = document.getElementById('lt-modulo');
    if (modSel) modSel.value = t.modulo_id || '';
    const btnCancel = document.getElementById('lt-btn-cancelar');
    if (btnCancel) btnCancel.style.display = 'inline-block';
    document.getElementById('lt-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  cancelarEdicion() {
    document.getElementById('lt-id').value = '';
    const form = document.getElementById('lt-form');
    if (form) form.reset();
    const fechaEl = document.getElementById('lt-fecha');
    if (fechaEl) fechaEl.value = this.hoyISO();
    const btnCancel = document.getElementById('lt-btn-cancelar');
    if (btnCancel) btnCancel.style.display = 'none';
  },

  async borrar(id) {
    if (!confirm('¿Borrar esta clase del libro de temas?')) return;
    const { error } = await supabase.from('libro_temas').delete().eq('id', Number(id));
    if (error) { alert('No se pudo borrar: ' + error.message); return; }
    await this.cargar(this.trayectoId, this.nombreTrayecto);
  },

  /* ---------- Visados ---------- */
  async verVisados() {
    if (typeof Swal === 'undefined') return;
    const html = this.visados.length
      ? `<div style="text-align:left; font-size:0.85rem;">${this.visados.map(v => `<p style="margin:0.3rem 0;">👁️ <b>${this.esc(v.visado_por_nombre)}</b> (${v.visado_por_rol === 'admin' ? 'Director' : 'Regente'}) · ${this.fmt(v.created_at.slice(0, 10))}</p>`).join('')}</div>`
      : '<p>Todavía nadie de Dirección o Regencia lo abrió.</p>';
    Swal.fire({ title: 'Visados del libro de temas', html, confirmButtonText: 'Cerrar' });
  },

  /* ---------- Comentarios (Director/Regente) ---------- */
  async comentarGeneral() { return this._comentar(null); },
  async comentarTema(temaId) { return this._comentar(temaId); },
  async _comentar(temaId) {
    if (typeof Swal === 'undefined') return;
    const r = await Swal.fire({
      title: temaId ? 'Observación sobre este tema' : 'Observación general del libro',
      input: 'textarea', inputPlaceholder: 'Escribí tu observación…', inputAttributes: { maxlength: 1500 },
      showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar',
      inputValidator: v => (!v || !v.trim()) ? 'Escribí algo.' : null
    });
    if (!r.isConfirmed) return;
    const perfil = (window.Auth && Auth.usuarioActual) || {};
    try {
      const { error } = await supabase.from('libro_temas_comentarios').insert([{
        trayecto_id: this.trayectoId, tema_id: temaId,
        autor_id: perfil.id, autor_nombre: `${perfil.apellido || ''}, ${perfil.nombre || ''}`.trim(), autor_rol: this.rol,
        texto: r.value.trim()
      }]);
      if (error) throw error;
      await this.cargar(this.trayectoId, this.nombreTrayecto);
    } catch (err) {
      alert('No se pudo guardar la observación: ' + (err.message || ''));
    }
  },

  async verComentarios(temaId) {
    if (typeof Swal === 'undefined') return;
    const lista = temaId === null ? this.comentariosGenerales() : this.comentariosDe(temaId);
    const html = `<div style="text-align:left; font-size:0.85rem;">${lista.map(c => `<div style="margin:0.5rem 0; padding:0.5rem; background:rgba(255,255,255,0.05); border-radius:6px;">
      <div style="font-size:0.75rem; color:#94a3b8;">${this.esc(c.autor_nombre)} (${c.autor_rol === 'admin' ? 'Director' : 'Regente'}) · ${this.fmt(c.created_at.slice(0, 10))}${this.puedeVisar && c.autor_id === ((window.Auth && Auth.usuarioActual) || {}).id ? ` <button type="button" class="lt-mini" onclick="LibroTemasModulo.borrarComentario(${Number(c.id)})">🗑️</button>` : ''}</div>
      <div>${this.esc(c.texto)}</div></div>`).join('')}</div>`;
    Swal.fire({
      title: temaId ? 'Observaciones sobre este tema' : 'Observaciones generales',
      html, confirmButtonText: 'Cerrar',
      footer: this.puedeVisar ? `<button type="button" class="btn btn-outline" onclick="Swal.close(); LibroTemasModulo._comentar(${temaId === null ? 'null' : temaId})">+ Agregar otra</button>` : ''
    });
  },

  async borrarComentario(id) {
    if (!confirm('¿Borrar esta observación?')) return;
    const { error } = await supabase.from('libro_temas_comentarios').delete().eq('id', Number(id));
    if (error) { alert('No se pudo borrar: ' + error.message); return; }
    Swal.close();
    await this.cargar(this.trayectoId, this.nombreTrayecto);
  },

  /* ---------- Imprimir ---------- */
  imprimir() {
    const porModulo = new Map(this.modulos.map(m => [Number(m.id), m.nombre]));
    const w = window.open('', '_blank');
    if (!w) { alert('El navegador bloqueó la ventana de impresión. Habilitá los pop-ups para este sitio.'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Libro de temas — ${this.esc(this.nombreTrayecto)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif; padding:24px; color:#111;}
        h1{font-size:18px; margin:0 0 4px;} h2{font-size:13px; font-weight:normal; color:#444; margin:0 0 16px;}
        table{width:100%; border-collapse:collapse; font-size:12px;} th,td{border:1px solid #999; padding:6px 8px; text-align:left; vertical-align:top;}
        th{background:#eee;} .vis{margin-top:18px; font-size:11px; color:#333;}
        @media print { @page { size: landscape; margin: 14mm; } }
      </style></head><body>
      <h1>Libro de temas</h1>
      <h2>${this.esc(this.nombreTrayecto)} — impreso el ${this.fmt(this.hoyISO())}</h2>
      <table><thead><tr><th>Fecha</th>${this.modulos.length ? '<th>Módulo</th>' : ''}<th>Tema</th><th>Actividad</th></tr></thead><tbody>
      ${this.temas.map(t => `<tr><td>${this.fmt(t.fecha)}</td>${this.modulos.length ? `<td>${this.esc(porModulo.get(Number(t.modulo_id)) || '—')}</td>` : ''}<td>${this.esc(t.tema)}</td><td>${this.esc(t.actividad || '')}</td></tr>`).join('')}
      </tbody></table>
      <div class="vis"><b>Visados de Dirección/Regencia:</b> ${this.visados.length ? this.visados.map(v => `${this.esc(v.visado_por_nombre)} (${this.fmt(v.created_at.slice(0, 10))})`).join(' · ') : 'sin registrar'}</div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }
};
window.LibroTemasModulo = LibroTemasModulo;
