/* Ficha de cursada de un estudiante (consulta, solo lectura).
   Junta en una ventana: datos personales, progreso por trayecto (módulos, promedio, asistencia)
   y el detalle de todas sus entregas. La abren el admin (Usuarios y Roles) y el docente (Seguimiento).
   Lo que cada uno puede ver lo sigue controlando la base de datos (RLS). */
const FichaAlumno = {
  esc(t) {
    return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  urlSegura(u) {
    try { const x = new URL(String(u || '').trim()); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : '#'; }
    catch { return '#'; }
  },

  modal() {
    let m = document.getElementById('modal-ficha-alumno');
    if (!m) {
      m = document.createElement('div');
      m.id = 'modal-ficha-alumno';
      m.className = 'ficha-overlay';
      m.setAttribute('role', 'dialog');
      m.setAttribute('aria-modal', 'true');
      m.innerHTML = `
        <div class="ficha-caja">
          <div class="ficha-cabecera">
            <div id="ficha-titulo"></div>
            <div class="ficha-acciones">
              <button type="button" class="btn btn-secondary" onclick="window.print()">Imprimir</button>
              <button type="button" class="ficha-cerrar" aria-label="Cerrar" onclick="FichaAlumno.cerrar()">✕</button>
            </div>
          </div>
          <div class="ficha-cuerpo">
            <section class="ficha-entregas ficha-datos" id="ficha-datos"></section>
            <section class="ficha-entregas" id="ficha-observaciones"></section>
            <div id="ficha-progreso"></div>
            <section class="ficha-entregas">
              <h3>Entregas de actividades</h3>
              <div id="ficha-entregas"></div>
            </section>
          </div>
        </div>`;
      m.addEventListener('click', e => { if (e.target === m) this.cerrar(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.classList.contains('abierta')) this.cerrar(); });
      document.body.appendChild(m);
    }
    return m;
  },

  cerrar() {
    const m = document.getElementById('modal-ficha-alumno');
    if (m) m.classList.remove('abierta');
    document.body.classList.remove('ficha-imprimiendo');
  },

  async abrir(dni) {
    const key = String(dni || '').trim();
    if (!key) return;
    const m = this.modal();
    m.classList.add('abierta');
    document.body.classList.add('ficha-imprimiendo');
    document.getElementById('ficha-titulo').innerHTML = '<h2>Cargando ficha…</h2>';
    document.getElementById('ficha-entregas').innerHTML = '';

    const { data: p } = await supabase.from('usuarios').select('usuario, dni, nombre, apellido, email, estado').eq('usuario', key).maybeSingle();
    const nombre = p ? `${(p.apellido || '').toUpperCase()}, ${p.nombre || ''}` : `DNI ${key}`;
    const hoy = new Date().toLocaleDateString('es-AR');
    document.getElementById('ficha-titulo').innerHTML = `
      <span class="ficha-etiqueta">Ficha de cursada · CFP N.º 403</span>
      <h2>${this.esc(nombre)}</h2>
      <p>DNI ${this.esc(key)}${p && p.email ? ' · ' + this.esc(p.email) : ''}${p && p.estado ? ' · ' + this.esc(p.estado) : ''} · Consultado el ${hoy}</p>`;

    this.dniActual = key;
    const perfilYo = (window.Auth && Auth.usuarioActual) || {};
    this.esPersonal = !!(window.Auth && Auth.esPersonal && Auth.esPersonal(perfilYo.rol));
    this.cargarDatosPersonales(key);
    this.cargarObservaciones(key);
    const res = await ProgresoModulo.cargarPara(key, document.getElementById('ficha-progreso'), { boton: false });
    this.dibujarEntregas(res);
  },

  /* ---------- Datos personales (los de la Ficha de Curso) ---------- */
  CAMPOS: [
    ['tipo_documento', 'Tipo de documento', 'text', 10],
    ['fecha_nacimiento', 'Fecha de nacimiento', 'date'],
    ['lugar_nacimiento', 'Lugar de nacimiento', 'text', 120],
    ['domicilio', 'Domicilio', 'text', 160],
    ['localidad', 'Localidad', 'text', 80],
    ['codigo_postal', 'Código postal', 'text', 12],
    ['telefono', 'Teléfono', 'tel', 40],
    ['estudios', 'Estudios alcanzados', 'text', 120]
  ],

  async cargarDatosPersonales(dni) {
    const cont = document.getElementById('ficha-datos');
    if (!cont) return;
    const { data, error } = await supabase.from('datos_estudiante').select('*').eq('dni', dni).maybeSingle();
    if (error) { cont.innerHTML = '<h3>Datos personales</h3><p class="ficha-vacio">Disponible cuando se ejecute sql/09 en Supabase.</p>'; return; }
    const d = data || { tipo_documento: 'DNI' };
    const editable = this.esPersonal;
    cont.innerHTML = `
      <h3>Datos personales</h3>
      <form class="ficha-form" onsubmit="event.preventDefault(); FichaAlumno.guardarDatosPersonales();">
        ${this.CAMPOS.map(([k, l, t, max]) => `
          <div class="form-group"><label for="fd-${k}">${l}</label>
            <input id="fd-${k}" type="${t}" class="form-control" ${max ? `maxlength="${max}"` : ''} value="${this.esc(t === 'date' ? String(d[k] || '').slice(0, 10) : (d[k] || ''))}" ${editable ? '' : 'readonly'}></div>`).join('')}
        ${editable ? '<div class="ficha-form-acciones"><button type="submit" class="btn btn-primary">Guardar datos</button></div>' : ''}
      </form>`;
  },

  async guardarDatosPersonales() {
    const reg = { dni: this.dniActual, actualizado: new Date().toISOString() };
    this.CAMPOS.forEach(([k]) => { const v = (document.getElementById('fd-' + k)?.value || '').trim(); reg[k] = v || null; });
    const { error } = await supabase.from('datos_estudiante').upsert(reg, { onConflict: 'dni' });
    if (error) { alert('No se pudieron guardar los datos: ' + error.message); return; }
    if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Datos guardados', showConfirmButton: false, timer: 1800 });
  },

  /* ---------- Observaciones ---------- */
  TIPOS_OBS: { general: 'General', salud: 'Salud', modulos_previos: 'Módulos aprobados en otros trayectos', documentacion: 'Documentación', asistencia: 'Asistencia', convivencia: 'Convivencia' },

  async cargarObservaciones(dni) {
    const cont = document.getElementById('ficha-observaciones');
    if (!cont) return;
    const { data, error } = await supabase.from('observaciones_estudiante').select('*').eq('estudiante_user', dni).order('created_at', { ascending: false });
    if (error) { cont.innerHTML = '<h3>Observaciones</h3><p class="ficha-vacio">Disponible cuando se ejecute sql/09 en Supabase.</p>'; return; }
    const lista = data || [];
    const yo = (window.Auth && Auth.usuarioActual) || {};
    const esAdmin = window.Auth && Auth.esAdmin(yo.rol);
    cont.innerHTML = `
      <h3>Observaciones</h3>
      ${lista.length ? `<ul class="obs-lista">${lista.map(o => `
        <li class="obs-item tipo-${this.esc(o.tipo)}">
          <div class="obs-cab"><span class="obs-tipo">${this.esc(this.TIPOS_OBS[o.tipo] || o.tipo)}</span>
            <span class="obs-meta">${this.esc(new Date(o.created_at).toLocaleDateString('es-AR'))}${o.creado_por_nombre ? ' · ' + this.esc(o.creado_por_nombre) : ''}${o.visible_docente ? ' · visible para el docente' : ''}</span>
            ${(esAdmin || o.creado_por === yo.id) && this.esPersonal ? `<button type="button" class="obs-borrar" onclick="FichaAlumno.borrarObservacion(${Number(o.id)})">Borrar</button>` : ''}</div>
          <p>${this.esc(o.texto).replace(/\n/g, '<br>')}</p>
        </li>`).join('')}</ul>` : '<p class="ficha-vacio">Sin observaciones.</p>'}
      ${this.esPersonal ? `
        <form class="obs-form" onsubmit="event.preventDefault(); FichaAlumno.agregarObservacion();">
          <div class="obs-form-fila">
            <select id="obs-tipo" class="form-control">${Object.entries(this.TIPOS_OBS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
            <label class="obs-check"><input type="checkbox" id="obs-visible"> Visible para el docente</label>
          </div>
          <textarea id="obs-texto" class="form-control" rows="2" maxlength="2000" placeholder="Ej.: Aprobó Circuitos Eléctricos y Mediciones en Electricista Domiciliario 2025 (N.º egresado 1480)."></textarea>
          <div class="ficha-form-acciones"><button type="submit" class="btn btn-primary">Agregar observación</button></div>
          <p class="obs-ayuda">Las de salud nunca las ve el docente. Las demás, solo si marcás "Visible para el docente".</p>
        </form>` : ''}`;
  },

  async agregarObservacion() {
    const texto = (document.getElementById('obs-texto')?.value || '').trim();
    if (texto.length < 2) { alert('⚠️ Escribí la observación.'); return; }
    const tipo = document.getElementById('obs-tipo').value;
    const yo = (window.Auth && Auth.usuarioActual) || {};
    const reg = {
      estudiante_user: this.dniActual, tipo, texto,
      visible_docente: tipo !== 'salud' && !!document.getElementById('obs-visible')?.checked,
      creado_por_nombre: [yo.nombre, yo.apellido].filter(Boolean).join(' ') || null
    };
    const { error } = await supabase.from('observaciones_estudiante').insert([reg]);
    if (error) { alert('No se pudo guardar la observación: ' + error.message); return; }
    await this.cargarObservaciones(this.dniActual);
  },

  async borrarObservacion(id) {
    if (!confirm('¿Borrar esta observación?')) return;
    const { error } = await supabase.from('observaciones_estudiante').delete().eq('id', id);
    if (error) { alert('No se pudo borrar: ' + error.message); return; }
    await this.cargarObservaciones(this.dniActual);
  },

  dibujarEntregas(res) {
    const cont = document.getElementById('ficha-entregas');
    const entregas = (res && res.entregas) || [];
    const clases = (res && res.clases) || [];
    const trayectos = (res && res.trayectos) || [];
    if (!entregas.length) {
      cont.innerHTML = '<p class="ficha-vacio">No registra entregas.</p>';
      return;
    }
    const filas = entregas
      .map(e => {
        const c = clases.find(x => Number(x.id) === Number(e.clase_id));
        const t = c ? trayectos.find(x => Number(x.id) === Number(c.trayecto_id)) : null;
        return { e, c, t };
      })
      .sort((a, b) => String(a.t?.nombre || '').localeCompare(String(b.t?.nombre || '')) || Number(a.e.clase_id) - Number(b.e.clase_id));

    cont.innerHTML = `
      <div class="ficha-tabla-wrap"><table class="ficha-tabla">
        <thead><tr><th>Trayecto</th><th>Actividad</th><th>Nota</th><th>Devolución</th><th>Trabajo</th></tr></thead>
        <tbody>${filas.map(({ e, c, t }) => {
          const n = parseFloat(e.nota);
          const nota = isNaN(n) ? '<span class="ficha-pend">Sin corregir</span>'
            : `<strong class="${n >= 70 ? 'ficha-ok' : 'ficha-bad'}">${n}</strong>`;
          const url = this.urlSegura(e.url_entrega);
          return `<tr>
            <td>${this.esc(t ? t.nombre : '—')}</td>
            <td>${this.esc(c ? c.titulo : 'Actividad')}</td>
            <td>${nota}</td>
            <td>${this.esc(e.comentario_docente || '—')}</td>
            <td>${url !== '#' ? `<a href="${this.esc(url)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
  }
};
window.FichaAlumno = FichaAlumno;
