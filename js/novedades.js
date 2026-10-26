/* Novedades y calendario
   - Web pública: reemplaza las tarjetas fijas de "Noticias y Novedades" por las publicadas.
   - Plataforma: muestra los avisos vigentes (generales y de sus trayectos) arriba de
     "Mis trayectos" y "Mi progreso".
   - Administración: sección "Novedades" para publicar, ocultar, editar y borrar. */
const NovedadesModulo = {
  TIPOS: {
    aviso:       { txt: 'Aviso',            ico: '📢' },
    inscripcion: { txt: 'Inscripciones',    ico: '📝' },
    inicio:      { txt: 'Inicio de cursada', ico: '🚀' },
    feriado:     { txt: 'Feriado / sin clases', ico: '📅' },
    examen:      { txt: 'Mesa de examen',   ico: '🧾' },
    acto:        { txt: 'Acto / entrega de certificados', ico: '🎓' }
  },
  MESES: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  lista: [],
  trayectos: [],

  esc(t) {
    return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  // '2026-11-12' → { d: '12', m: 'nov', largo: '12 nov 2026' } sin corrimientos de zona horaria
  fecha(f) {
    if (!f) return null;
    const [y, m, d] = String(f).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return { d: String(d), m: this.MESES[m - 1], largo: `${d} ${this.MESES[m - 1]} ${y}` };
  },
  hoyISO() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  // Orden: primero los eventos próximos (por fecha), después los avisos sin fecha (más nuevos primero)
  ordenar(arr) {
    const hoy = this.hoyISO();
    return [...arr].sort((a, b) => {
      const fa = a.fecha_evento && a.fecha_evento >= hoy ? a.fecha_evento : null;
      const fb = b.fecha_evento && b.fecha_evento >= hoy ? b.fecha_evento : null;
      if (fa && fb) return fa.localeCompare(fb);
      if (fa) return -1;
      if (fb) return 1;
      return String(b.created_at).localeCompare(String(a.created_at));
    });
  },

  tarjeta(n, compacta = false) {
    const t = this.TIPOS[n.tipo] || this.TIPOS.aviso;
    const f = this.fecha(n.fecha_evento);
    const tray = n.trayecto_id ? (this.trayectos.find(x => Number(x.id) === Number(n.trayecto_id)) || {}).nombre : null;
    return `
      <article class="nov-card ${compacta ? 'compacta' : ''} tipo-${this.esc(n.tipo)}">
        ${f ? `<div class="nov-fecha"><strong>${f.d}</strong><span>${f.m}</span></div>` : `<div class="nov-fecha sin"><span aria-hidden="true">${t.ico}</span></div>`}
        <div class="nov-info">
          <span class="nov-tipo">${this.esc(t.txt)}${tray ? ' · ' + this.esc(tray) : ''}</span>
          <h3>${this.esc(n.titulo)}</h3>
          ${n.cuerpo ? `<p>${this.esc(n.cuerpo).replace(/\n/g, '<br>')}</p>` : ''}
        </div>
      </article>`;
  },

  /* ---------- Web pública ---------- */
  async cargarPublicas() {
    const grid = document.querySelector('#noticias .news-grid');
    if (!grid || typeof supabase === 'undefined') return;
    try {
      const { data, error } = await supabase.from('novedades').select('*').limit(30);
      const hoy = this.hoyISO();
      // Con sesión de admin la base devuelve también borradores e internos: en la web se filtran
      const publicas = (data || []).filter(n => n.publicado && n.publica && !n.trayecto_id && (!n.vence || n.vence >= hoy));
      if (error || !publicas.length) return; // si no hay novedades quedan las tarjetas de siempre
      grid.classList.add('nov-grid');
      grid.innerHTML = this.ordenar(publicas).slice(0, 6).map(n => this.tarjeta(n)).join('');
    } catch (e) { /* la web sigue funcionando con las tarjetas fijas */ }
  },

  /* ---------- Plataforma (estudiantes y docentes) ---------- */
  async mostrarEnPlataforma() {
    const zonas = document.querySelectorAll('[data-novedades-usuario]');
    if (!zonas.length) return;
    try {
      const { data } = await supabase.from('novedades').select('*').eq('publicado', true).limit(30);
      const hoy = this.hoyISO();
      const vigentes = this.ordenar((data || []).filter(n => !n.vence || n.vence >= hoy)).slice(0, 4);
      if (vigentes.length && !this.trayectos.length) {
        const ids = [...new Set(vigentes.map(n => n.trayecto_id).filter(Boolean))];
        if (ids.length) {
          const { data: tr } = await supabase.from('trayectos').select('id, nombre').in('id', ids);
          this.trayectos = tr || [];
        }
      }
      const html = vigentes.length
        ? `<div class="nov-usuario"><h3>Novedades</h3><div class="nov-usuario-grid">${vigentes.map(n => this.tarjeta(n, true)).join('')}</div></div>`
        : '';
      zonas.forEach(z => { z.innerHTML = html; });
    } catch (e) { zonas.forEach(z => { z.innerHTML = ''; }); }
  },

  /* ---------- Administración ---------- */
  async cargarAdmin() {
    const cont = document.getElementById('novedades-admin');
    if (!cont) return;
    if (!cont.dataset.listo) {
      cont.innerHTML = this.formularioHTML();
      cont.dataset.listo = '1';
    }
    const perfil = await Auth.obtenerPerfilSesion();
    // Avisos generales/institucionales: Director y Regente (Art. 37.49-50: comunica
    // novedades y suscribe con el Director las comunicaciones). Docentes y preceptores
    // siguen limitados a avisos internos (no públicos) de sus propios trayectos.
    this.soloDirector = Auth.esDireccion(perfil.rol);
    this.miId = perfil.id;
    const { data: tr } = await supabase.from('trayectos').select('id, nombre, ciclo_lectivo').order('nombre');
    this.trayectos = tr || [];
    const sel = document.getElementById('nov-trayecto');
    const actual = sel.value;
    // Avisos generales y web pública: solo el Director. Docentes y preceptores: avisos de un trayecto
    const chk = document.getElementById('nov-publica');
    if (chk && chk.closest('label')) chk.closest('label').style.display = this.soloDirector ? '' : 'none';
    if (chk && !this.soloDirector) chk.checked = false;
    sel.innerHTML = (this.soloDirector ? '<option value="">Todos (aviso general)</option>' : '<option value="">Elegí el trayecto…</option>') +
      this.trayectos.map(t => `<option value="${Number(t.id)}">${this.esc(t.nombre)}${t.ciclo_lectivo ? ' (' + this.esc(t.ciclo_lectivo) + ')' : ''}</option>`).join('');
    sel.value = actual;
    await this.listarAdmin();
  },

  formularioHTML() {
    const opts = Object.entries(this.TIPOS).map(([k, v]) => `<option value="${k}">${v.ico} ${v.txt}</option>`).join('');
    return `
      <div class="card-panel nov-form-panel">
        <div class="card-panel-header"><h3 style="margin:0" id="nov-form-titulo">Publicar una novedad</h3></div>
        <form id="nov-form" onsubmit="event.preventDefault(); NovedadesModulo.guardar();">
          <input type="hidden" id="nov-id">
          <div class="nov-form-grid">
            <div class="form-group nov-col-2"><label for="nov-titulo">Título</label>
              <input id="nov-titulo" class="form-control" maxlength="120" required placeholder="Ej: Inicio de cursada de Electricista"></div>
            <div class="form-group"><label for="nov-tipo">Tipo</label><select id="nov-tipo" class="form-control">${opts}</select></div>
            <div class="form-group"><label for="nov-fecha">Fecha del evento <small>(opcional)</small></label><input id="nov-fecha" type="date" class="form-control"></div>
            <div class="form-group nov-col-2"><label for="nov-cuerpo">Texto <small>(opcional)</small></label>
              <textarea id="nov-cuerpo" class="form-control" rows="3" maxlength="1500" placeholder="Horario, lugar, qué traer…"></textarea></div>
            <div class="form-group"><label for="nov-trayecto">¿Para quién?</label><select id="nov-trayecto" class="form-control"></select></div>
            <div class="form-group"><label for="nov-vence">Ocultar después del <small>(opcional)</small></label><input id="nov-vence" type="date" class="form-control"></div>
          </div>
          <label class="nov-check"><input type="checkbox" id="nov-publica" checked> Mostrar también en la web pública (solo avisos generales)</label>
          <div class="nov-botones">
            <button type="submit" class="btn btn-gold" id="nov-btn-guardar">Publicar</button>
            <button type="button" class="btn btn-outline" onclick="NovedadesModulo.limpiar()">Limpiar</button>
          </div>
        </form>
      </div>
      <div class="card-panel">
        <div class="card-panel-header"><h3 style="margin:0">Publicadas</h3></div>
        <div id="nov-lista"></div>
      </div>`;
  },

  async listarAdmin() {
    const cont = document.getElementById('nov-lista');
    if (!cont) return;
    const { data, error } = await supabase.from('novedades').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) {
      cont.innerHTML = `<div class="prog-vacio">No se pudo leer la tabla de novedades. ¿Ya ejecutaste el archivo <strong>sql/06_novedades.sql</strong> en Supabase?</div>`;
      return;
    }
    this.lista = (data || []).filter(n => this.soloDirector || n.creado_por === this.miId);
    if (!this.lista.length) { cont.innerHTML = '<div class="prog-vacio">Todavía no hay novedades publicadas.</div>'; return; }
    const hoy = this.hoyISO();
    cont.innerHTML = this.lista.map(n => {
      const vencida = n.vence && n.vence < hoy;
      const estado = !n.publicado ? '<span class="nov-estado oculta">Oculta</span>'
        : vencida ? '<span class="nov-estado oculta">Vencida</span>'
        : (n.publica && !n.trayecto_id ? '<span class="nov-estado web">En la web</span>' : '<span class="nov-estado interna">Solo plataforma</span>');
      return `<div class="nov-admin-item">
        ${this.tarjeta(n, true)}
        <div class="nov-admin-acciones">${estado}
          <button type="button" class="btn btn-secondary" onclick="NovedadesModulo.editar(${Number(n.id)})">Editar</button>
          <button type="button" class="btn btn-outline" onclick="NovedadesModulo.alternar(${Number(n.id)})">${n.publicado ? 'Ocultar' : 'Mostrar'}</button>
          <button type="button" class="btn btn-danger" onclick="NovedadesModulo.borrar(${Number(n.id)})">Borrar</button>
        </div>
      </div>`;
    }).join('');
  },

  limpiar() {
    document.getElementById('nov-form').reset();
    document.getElementById('nov-id').value = '';
    document.getElementById('nov-publica').checked = true;
    document.getElementById('nov-form-titulo').textContent = 'Publicar una novedad';
    document.getElementById('nov-btn-guardar').textContent = 'Publicar';
  },

  editar(id) {
    const n = this.lista.find(x => Number(x.id) === Number(id));
    if (!n) return;
    document.getElementById('nov-id').value = n.id;
    document.getElementById('nov-titulo').value = n.titulo || '';
    document.getElementById('nov-tipo').value = n.tipo || 'aviso';
    document.getElementById('nov-fecha').value = n.fecha_evento || '';
    document.getElementById('nov-cuerpo').value = n.cuerpo || '';
    document.getElementById('nov-trayecto').value = n.trayecto_id || '';
    document.getElementById('nov-vence').value = n.vence || '';
    document.getElementById('nov-publica').checked = !!n.publica;
    document.getElementById('nov-form-titulo').textContent = 'Editar novedad';
    document.getElementById('nov-btn-guardar').textContent = 'Guardar cambios';
    document.getElementById('nov-titulo').focus();
    document.getElementById('nov-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  async guardar() {
    const id = document.getElementById('nov-id').value;
    const titulo = document.getElementById('nov-titulo').value.trim();
    if (titulo.length < 3) { alert('⚠️ El título es obligatorio (mínimo 3 letras).'); return; }
    const trayecto = document.getElementById('nov-trayecto').value;
    if (!this.soloDirector && !trayecto) { alert('⚠️ Elegí el trayecto al que va el aviso. Los avisos generales los publica el Director.'); return; }
    const registro = {
      titulo,
      tipo: document.getElementById('nov-tipo').value,
      fecha_evento: document.getElementById('nov-fecha').value || null,
      cuerpo: document.getElementById('nov-cuerpo').value.trim() || null,
      trayecto_id: trayecto ? Number(trayecto) : null,
      vence: document.getElementById('nov-vence').value || null,
      publica: this.soloDirector && document.getElementById('nov-publica').checked && !trayecto
    };
    const btn = document.getElementById('nov-btn-guardar');
    btn.disabled = true;
    try {
      const { error } = id
        ? await supabase.from('novedades').update(registro).eq('id', Number(id))
        : await supabase.from('novedades').insert([{ ...registro, publicado: true }]);
      if (error) throw error;
      if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: id ? 'Novedad actualizada' : 'Novedad publicada', showConfirmButton: false, timer: 2200 });
      this.limpiar();
      await this.listarAdmin();
    } catch (e) {
      alert('No se pudo guardar la novedad: ' + (e.message || 'error de conexión'));
    } finally { btn.disabled = false; }
  },

  async alternar(id) {
    const n = this.lista.find(x => Number(x.id) === Number(id));
    if (!n) return;
    const { error } = await supabase.from('novedades').update({ publicado: !n.publicado }).eq('id', Number(id));
    if (error) { alert('No se pudo cambiar: ' + error.message); return; }
    await this.listarAdmin();
  },

  async borrar(id) {
    const n = this.lista.find(x => Number(x.id) === Number(id));
    if (!n) return;
    let ok = true;
    if (typeof Swal !== 'undefined') {
      const r = await Swal.fire({ icon: 'warning', title: '¿Borrar esta novedad?', text: n.titulo, showCancelButton: true, confirmButtonText: 'Sí, borrar', cancelButtonText: 'Cancelar' });
      ok = r.isConfirmed;
    } else ok = confirm('¿Borrar "' + n.titulo + '"?');
    if (!ok) return;
    const { error } = await supabase.from('novedades').delete().eq('id', Number(id));
    if (error) { alert('No se pudo borrar: ' + error.message); return; }
    await this.listarAdmin();
  }
};
window.NovedadesModulo = NovedadesModulo;

// Web pública: cargar novedades al abrir la página
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => NovedadesModulo.cargarPublicas(), 300);
});
