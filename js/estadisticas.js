/* ==========================================================================
   ESTADÍSTICAS DE TRAYECTOS (administración y regencia)
   Certificados, bajas y estudiantes que cursan más de un trayecto, por
   especialidad (nombre del trayecto) o por sector. Para fundamentar cambios
   de planificación. Archivo: js/estadisticas.js
   ========================================================================== */

const EstadisticasModulo = {
  datos: null,
  agrupar: 'nombre',     // 'nombre' | 'sector'
  desde: null,
  hasta: null,
  orden: 'inscriptos',

  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  pct(a, b) { return b > 0 ? Math.round(1000 * a / b) / 10 : null; },
  fmt(p) { return p === null ? '–' : String(p).replace('.', ',') + ' %'; },

  async cargar() {
    const cont = document.getElementById('estadisticas-contenido');
    if (!cont) return;
    cont.innerHTML = '<p class="seg-cargando">Calculando estadísticas…</p>';
    try {
      const { data, error } = await supabase.rpc('estadisticas_trayectos', {
        p_desde: this.desde ? Number(this.desde) : null,
        p_hasta: this.hasta ? Number(this.hasta) : null
      });
      if (error) throw error;
      this.datos = data;
      this.dibujar();
    } catch (err) {
      console.error('Estadísticas:', err);
      const falta = /estadisticas_trayectos|function/i.test(err.message || '');
      cont.innerHTML = `<div class="prog-vacio">No se pudieron armar las estadísticas.${falta ? ' Falta ejecutar <strong>sql/26_estadisticas_historial.sql</strong> en Supabase.' : ' Probá recargar la página.'}</div>`;
    }
  },

  filas() {
    const d = this.datos || {};
    return (this.agrupar === 'sector' ? d.por_sector : d.por_nombre) || [];
  },

  /* Cada fila con sus porcentajes: egreso solo sobre trayectos ya finalizados */
  enriquecer(f) {
    return Object.assign({}, f, {
      pEgreso: this.pct(Number(f.egr_finalizados), Number(f.inscr_finalizados)),
      pBaja: this.pct(Number(f.bajas), Number(f.inscriptos))
    });
  },

  ranking(titulo, filas, clave, desc, nota) {
    const v = filas.filter(f => f[clave] !== null).sort((a, b) => desc ? b[clave] - a[clave] : a[clave] - b[clave]).slice(0, 3);
    return `<div class="est-rank"><h4>${titulo}</h4>${v.length ? `<ol>${v.map(f => `<li><span>${this.esc(f.k)}</span><b>${this.fmt(f[clave])}</b></li>`).join('')}</ol>` : `<p class="demo-vacio">${nota || 'Todavía no hay datos.'}</p>`}</div>`;
  },

  dibujar() {
    const cont = document.getElementById('estadisticas-contenido');
    if (!cont) return;
    const d = this.datos || {};
    const r = d.resumen || {};
    const ci = d.ciclos || {};
    const anios = [];
    for (let a = Number(ci.min || new Date().getFullYear()); a <= Number(ci.max || new Date().getFullYear()); a++) anios.push(a);
    const opt = (v) => `<option value="">Todos</option>${anios.map(a => `<option value="${a}" ${Number(v) === a ? 'selected' : ''}>${a}</option>`).join('')}`;

    const filas = this.filas().map(f => this.enriquecer(f));
    const clave = this.orden;
    const ord = filas.slice().sort((a, b) => (clave === 'k' ? String(a.k).localeCompare(String(b.k)) : (Number(b[clave] ?? -1) - Number(a[clave] ?? -1))));
    const tarjeta = (n, txt) => `<div class="sec-card"><strong>${n}</strong><span>${txt}</span></div>`;
    const th = (k, txt) => `<th><button type="button" class="est-ord ${this.orden === k ? 'sel' : ''}" onclick="EstadisticasModulo.ordenar('${k}')">${txt}</button></th>`;

    cont.innerHTML = `
      <div class="sec-barra">
        <label>Ciclos desde<select class="form-control" onchange="EstadisticasModulo.cambiarRango(this.value, null)">${opt(this.desde)}</select></label>
        <label>hasta<select class="form-control" onchange="EstadisticasModulo.cambiarRango(null, this.value)">${opt(this.hasta)}</select></label>
        <label>Agrupar por
          <select class="form-control" onchange="EstadisticasModulo.cambiarAgrupar(this.value)">
            <option value="nombre" ${this.agrupar === 'nombre' ? 'selected' : ''}>Especialidad (nombre del trayecto)</option>
            <option value="sector" ${this.agrupar === 'sector' ? 'selected' : ''}>Sector</option>
          </select></label>
      </div>

      <div class="sec-cards">
        ${tarjeta(r.trayectos || 0, 'trayectos dictados')}
        ${tarjeta(r.personas || 0, 'personas distintas')}
        ${tarjeta(r.inscripciones || 0, 'inscripciones')}
        ${tarjeta(r.egresados || 0, 'certificados (con N.º de egresado)')}
        ${tarjeta(r.bajas || 0, 'bajas')}
        ${tarjeta(this.fmt(this.pct(Number(r.bajas || 0), Number(r.inscripciones || 0))), 'deserción')}
        ${tarjeta(this.fmt(this.pct(Number(r.egr_finalizados || 0), Number(r.inscr_finalizados || 0))), 'egreso (trayectos finalizados)')}
      </div>

      <div class="est-ranks">
        ${this.ranking('Más certificados emitidos', filas.map(f => Object.assign({}, f, { v: f.pEgreso })), 'v', true, 'Se calcula cuando hay trayectos finalizados con N.º de egresado cargado.')}
        ${this.ranking('Menos certificados emitidos', filas.map(f => Object.assign({}, f, { v: f.pEgreso })), 'v', false, 'Se calcula cuando hay trayectos finalizados con N.º de egresado cargado.')}
        ${this.ranking('Mayor deserción', filas.map(f => Object.assign({}, f, { v: f.pBaja })), 'v', true)}
      </div>

      <div class="sec-tabla-wrap"><table class="sec-tabla">
        <thead><tr>${th('k', this.agrupar === 'sector' ? 'Sector' : 'Especialidad')}${th('ediciones', 'Ediciones')}${th('inscriptos', 'Inscriptos')}${th('egresados', 'Certificados')}${th('pEgreso', '% egreso')}${th('bajas', 'Bajas')}${th('pBaja', '% deserción')}</tr></thead>
        <tbody>${ord.length ? ord.map(f => `<tr>
          <td class="sec-nombre">${this.esc(f.k)}${this.agrupar === 'nombre' && f.sector && f.sector !== 'Sin sector' ? `<br><small>${this.esc(f.sector)}</small>` : ''}</td>
          <td>${f.ediciones}</td><td><b>${f.inscriptos}</b></td><td>${f.egresados}</td><td>${this.fmt(f.pEgreso)}</td><td>${f.bajas}</td><td><b>${this.fmt(f.pBaja)}</b></td></tr>`).join('') : '<tr><td colspan="7">No hay inscripciones en el rango elegido.</td></tr>'}</tbody>
      </table></div>
      <p class="acta-ayuda">«Certificados» son las inscripciones con N.º de egresado cargado. El % de egreso se calcula solo sobre trayectos ya finalizados (con fecha de cierre pasada); el % de deserción cuenta todas las bajas, manuales y automáticas, sobre todos los inscriptos. Con pocos casos los porcentajes engañan: mirá siempre la cantidad. ${this.agrupar === 'sector' && filas.length === 1 && filas[0].k === 'Sin sector' ? '<br><b>Ningún trayecto tiene el sector cargado:</b> completalo al editar cada trayecto para agrupar por sector.' : ''}</p>

      <section class="demo-panel">
        <div class="demo-cab"><div><h3>Estudiantes que cursan más de un trayecto</h3>
          <p class="acta-ayuda">${Number(d.multi_total || 0)} persona(s) en el rango elegido${Number(d.multi_total || 0) > (d.multi || []).length ? ` (se muestran ${(d.multi || []).length})` : ''}.</p></div></div>
        ${(d.multi || []).length ? `<div class="sec-tabla-wrap"><table class="sec-tabla"><tbody>
          ${d.multi.map(m => `<tr><td class="sec-nombre">${this.esc(m.nombre)}<br><small>DNI ${this.esc(m.dni)}</small></td><td><b>${m.n}</b> trayectos</td>
            <td>${(m.detalle || []).map(x => `${this.esc(x.trayecto)} <small>(${this.esc(x.ciclo)} · ${this.esc(x.estado)})</small>`).join('<br>')}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="prog-vacio">Todavía no hay estudiantes con más de un trayecto.</div>'}
      </section>`;
  },

  ordenar(k) { this.orden = k; this.dibujar(); },
  cambiarAgrupar(v) { this.agrupar = v === 'sector' ? 'sector' : 'nombre'; this.dibujar(); },
  cambiarRango(desde, hasta) {
    if (desde !== null) this.desde = desde || null;
    if (hasta !== null) this.hasta = hasta || null;
    this.cargar();
  }
};

window.EstadisticasModulo = EstadisticasModulo;
