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

    const res = await ProgresoModulo.cargarPara(key, document.getElementById('ficha-progreso'), { boton: false });
    this.dibujarEntregas(res);
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
