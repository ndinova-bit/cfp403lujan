/* ==========================================================================
   LICENCIAS DEL PERSONAL DOCENTE (administrativas, médicas y paros)
   Solo Director, Regente y Secretaría (la base de datos también lo exige).
   - Carga de licencias por período, feriados (nacionales, provinciales,
     municipales e institucionales) y fechas del ciclo lectivo.
   - Cálculo de días hábiles (lunes a viernes, sin feriados) de cualquier
     período y del ciclo lectivo; por docente: días trabajados, faltas totales
     y faltas discriminadas por tipo de licencia.
   Los días se cuentan por calendario (lunes a viernes). No se usa el horario
   semanal de cada docente.
   Archivo: js/licencias.js
   ========================================================================== */

const LicenciasModulo = {
  docentes: [],
  licencias: [],
  feriados: [],
  ciclo: null,            // { anio, inicio, fin } del año elegido, o null si no está cargado
  anio: new Date().getFullYear(),
  vista: 'resumen',       // 'resumen' | 'licencias' | 'feriados'
  filtro: { desde: '', hasta: '', dni: '' },
  filtroLista: '',

  TIPOS: { administrativa: 'Administrativa', medica: 'Médica', paro: 'Paro' },
  AMBITOS: { nacional: 'Nacional', provincial: 'Provincial', municipal: 'Municipal', institucional: 'Institucional / receso' },
  // Feriados nacionales de fecha fija (los trasladables y los puentes se cargan a mano)
  FIJOS: [['01-01', 'Año Nuevo'], ['03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia'], ['04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas'],
    ['05-01', 'Día del Trabajador'], ['05-25', 'Día de la Revolución de Mayo'], ['06-20', 'Paso a la Inmortalidad del Gral. Manuel Belgrano'],
    ['07-09', 'Día de la Independencia'], ['12-08', 'Inmaculada Concepción de María'], ['12-25', 'Navidad']],

  /* ---------- utilidades ---------- */
  esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  fmt(s) { return s ? String(s).slice(0, 10).split('-').reverse().join('/') : ''; },
  fecha(s) { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); },
  iso(d) { return d.toISOString().slice(0, 10); },
  hoyISO() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }); },
  nombreDocente(dni) {
    const d = this.docentes.find(x => x.dni === dni);
    return d ? `${d.apellido || ''}, ${d.nombre || ''}`.trim() : `DNI ${dni}`;
  },
  tabla(arr, clave) { const m = {}; (arr || []).forEach(x => { (m[x[clave]] = m[x[clave]] || []).push(x); }); return m; },

  /* Mapa fecha → feriados de ese día (solo los que caen en el rango pedido) */
  mapaFeriados() { return this.tabla(this.feriados, 'fecha'); },

  /* Días hábiles entre dos fechas (incluidas). Devuelve { total, dias:Set, feriadosEnHabiles:[{fecha,nombre,ambito}] } */
  calcular(desde, hasta, mapaFer) {
    const res = { total: 0, dias: new Set(), feriadosEnHabiles: [] };
    if (!desde || !hasta || desde > hasta) return res;
    const mf = mapaFer || this.mapaFeriados();
    for (let d = this.fecha(desde); d <= this.fecha(hasta); d = new Date(d.getTime() + 86400000)) {
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      const k = this.iso(d);
      if (mf[k]) { mf[k].forEach(f => res.feriadosEnHabiles.push(f)); continue; }
      res.total++; res.dias.add(k);
    }
    return res;
  },

  /* Resumen de un docente en un período: cada día hábil cuenta una sola vez aunque haya licencias superpuestas */
  resumenDocente(dni, desde, hasta, hab) {
    const r = { dni, habiles: hab.total, administrativa: 0, medica: 0, paro: 0, faltas: 0, trabajados: 0, detalle: [] };
    const contados = new Set();
    this.licencias.filter(l => l.docente_dni === dni).sort((a, b) => a.desde.localeCompare(b.desde)).forEach(l => {
      const d1 = l.desde < desde ? desde : l.desde, d2 = l.hasta > hasta ? hasta : l.hasta;
      if (d1 > d2) return;
      let n = 0;
      for (let d = this.fecha(d1); d <= this.fecha(d2); d = new Date(d.getTime() + 86400000)) {
        const k = this.iso(d);
        if (!hab.dias.has(k) || contados.has(k)) continue;
        contados.add(k); n++;
      }
      r[l.tipo] += n; r.faltas += n;
      r.detalle.push({ ...l, dias: n });
    });
    r.trabajados = r.habiles - r.faltas;
    return r;
  },

  /* ---------- carga de datos ---------- */
  async cargar() {
    const cont = document.getElementById('licencias-contenido');
    if (!cont) return;
    cont.innerHTML = '<p class="seg-cargando">Cargando licencias…</p>';
    try {
      const [d, l, f, c] = await Promise.all([
        supabase.rpc('docentes_para_licencias'),
        supabase.from('licencias').select('*').order('desde', { ascending: false }).order('id', { ascending: false }),
        supabase.from('feriados').select('*').order('fecha'),
        supabase.from('ciclo_lectivo_config').select('*').order('anio', { ascending: false })
      ]);
      const err = d.error || l.error || f.error || c.error;
      if (err) throw err;
      this.docentes = d.data || [];
      this.licencias = l.data || [];
      this.feriados = f.data || [];
      this.ciclos = c.data || [];
      this.ciclo = this.ciclos.find(x => Number(x.anio) === Number(this.anio)) || null;
      if (!this.filtro.desde) {
        this.filtro.desde = this.ciclo ? this.ciclo.inicio : `${this.anio}-03-01`;
        this.filtro.hasta = this.ciclo ? this.ciclo.fin : `${this.anio}-12-31`;
      }
      this.dibujar();
    } catch (e) {
      console.error('Licencias:', e);
      const falta = /licencias|feriados|ciclo_lectivo|docentes_para|relation|function/i.test(e.message || '');
      cont.innerHTML = `<div class="prog-vacio">No se pudo cargar el registro de licencias.${falta ? ' Falta ejecutar <strong>sql/56_licencias_docentes.sql</strong> en Supabase.' : ' Probá recargar la página.'}</div>`;
    }
  },

  cambiarVista(v) { this.vista = v; this.dibujar(); },

  cambiarAnio(a) {
    this.anio = Number(a) || new Date().getFullYear();
    this.ciclo = (this.ciclos || []).find(x => Number(x.anio) === this.anio) || null;
    this.filtro.desde = this.ciclo ? this.ciclo.inicio : `${this.anio}-03-01`;
    this.filtro.hasta = this.ciclo ? this.ciclo.fin : `${this.anio}-12-31`;
    this.dibujar();
  },

  /* ---------- pantalla ---------- */
  dibujar() {
    const cont = document.getElementById('licencias-contenido');
    if (!cont) return;
    const tabs = [['resumen', '📊 Resumen y cálculo'], ['licencias', '📝 Licencias cargadas'], ['feriados', '📅 Feriados y ciclo lectivo']];
    const anios = []; for (let a = new Date().getFullYear() + 1; a >= 2024; a--) anios.push(a);
    cont.innerHTML = `
      <div class="sec-cab">
        <div><h3>Licencias del personal docente</h3>
        <p class="acta-ayuda">Visible solo para Director, Regente y Secretaría. Los días hábiles son de lunes a viernes, sin feriados. En licencias médicas no anotes diagnósticos.</p></div>
        <label class="lic-anio">Ciclo lectivo <select onchange="LicenciasModulo.cambiarAnio(this.value)">${anios.map(a => `<option value="${a}"${a === this.anio ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
      </div>
      <div class="lic-tabs">${tabs.map(t => `<button type="button" class="btn ${this.vista === t[0] ? 'btn-gold' : 'btn-outline'}" onclick="LicenciasModulo.cambiarVista('${t[0]}')">${t[1]}</button>`).join('')}</div>
      <div id="lic-vista">${this.vista === 'resumen' ? this.htmlResumen() : this.vista === 'licencias' ? this.htmlLicencias() : this.htmlFeriados()}</div>`;
    if (this.vista === 'resumen') this.calcularResumen();
    if (this.vista === 'licencias') this.vistaPreviaDias();
  },

  opcionesDocentes(sel, conTodos) {
    return (conTodos ? `<option value="">Todos los docentes</option>` : `<option value="">Elegí un docente…</option>`) +
      this.docentes.map(d => `<option value="${this.esc(d.dni)}"${d.dni === sel ? ' selected' : ''}>${this.esc(d.apellido)}, ${this.esc(d.nombre)}</option>`).join('');
  },

  /* ---- RESUMEN ---- */
  htmlResumen() {
    const f = this.filtro;
    return `
      <div class="lic-form">
        <label>Desde <input type="date" id="lic-r-desde" value="${f.desde}" onchange="LicenciasModulo.calcularResumen()"></label>
        <label>Hasta <input type="date" id="lic-r-hasta" value="${f.hasta}" onchange="LicenciasModulo.calcularResumen()"></label>
        <label>Docente <select id="lic-r-dni" onchange="LicenciasModulo.calcularResumen()">${this.opcionesDocentes(f.dni, true)}</select></label>
        <button type="button" class="btn btn-outline" onclick="LicenciasModulo.todoElCiclo()">Todo el ciclo ${this.anio}</button>
      </div>
      <div id="lic-resultado"></div>`;
  },

  todoElCiclo() {
    if (!this.ciclo) { alert(`Primero cargá el inicio y el fin del ciclo ${this.anio} en «Feriados y ciclo lectivo».`); return; }
    document.getElementById('lic-r-desde').value = this.ciclo.inicio;
    document.getElementById('lic-r-hasta').value = this.ciclo.fin;
    this.calcularResumen();
  },

  calcularResumen() {
    const out = document.getElementById('lic-resultado');
    if (!out) return;
    const desde = document.getElementById('lic-r-desde').value, hasta = document.getElementById('lic-r-hasta').value;
    const dni = document.getElementById('lic-r-dni').value;
    this.filtro = { desde, hasta, dni };
    if (!desde || !hasta) { out.innerHTML = '<div class="prog-vacio">Elegí las fechas del período.</div>'; return; }
    if (desde > hasta) { out.innerHTML = '<div class="prog-vacio">La fecha «Desde» no puede ser posterior a «Hasta».</div>'; return; }
    const mf = this.mapaFeriados();
    const hab = this.calcular(desde, hasta, mf);
    const cic = this.ciclo ? this.calcular(this.ciclo.inicio, this.ciclo.fin, mf) : null;
    const lista = (dni ? this.docentes.filter(d => d.dni === dni) : this.docentes).map(d => this.resumenDocente(d.dni, desde, hasta, hab));
    // También los DNI con licencias que ya no figuran como docentes activos
    if (!dni) {
      const conocidos = new Set(this.docentes.map(d => d.dni));
      [...new Set(this.licencias.map(l => l.docente_dni))].filter(x => !conocidos.has(x)).forEach(x => lista.push(this.resumenDocente(x, desde, hasta, hab)));
    }
    this._ultimo = { desde, hasta, hab, lista };
    const fer = hab.feriadosEnHabiles;
    const nFer = new Set(fer.map(x => x.fecha)).size;   // un día con feriado nacional y provincial cuenta una vez
    out.innerHTML = `
      <div class="lic-cifras">
        <div class="stat-card"><div class="stat-info"><h4>Días hábiles del período</h4><p class="stat-value">${hab.total}</p><small>${this.fmt(desde)} al ${this.fmt(hasta)}</small></div></div>
        <div class="stat-card"><div class="stat-info"><h4>Feriados que cayeron en día hábil</h4><p class="stat-value">${nFer}</p></div></div>
        <div class="stat-card"><div class="stat-info"><h4>Días hábiles del ciclo ${this.anio}</h4><p class="stat-value">${cic ? cic.total : '–'}</p><small>${cic ? `${this.fmt(this.ciclo.inicio)} al ${this.fmt(this.ciclo.fin)}` : 'Falta cargar inicio y fin del ciclo'}</small></div></div>
      </div>
      ${fer.length ? `<details class="lic-det"><summary>Ver feriados descontados (${nFer} día${nFer === 1 ? '' : 's'})</summary><ul>${fer.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(x => `<li>${this.fmt(x.fecha)} · ${this.esc(x.nombre)} <em>(${this.AMBITOS[x.ambito] || x.ambito})</em></li>`).join('')}</ul></details>` : ''}
      <div class="lic-scroll"><table class="demo-tabla lic-tabla">
        <thead><tr><th>Docente</th><th>Días hábiles</th><th>Días trabajados</th><th>Faltas totales</th><th>Administrativas</th><th>Médicas</th><th>Paros</th><th>% asistencia</th></tr></thead>
        <tbody>${lista.length ? lista.map(r => `<tr>
          <td>${this.esc(this.nombreDocente(r.dni))}</td><td>${r.habiles}</td><td><b>${r.trabajados}</b></td><td><b>${r.faltas}</b></td>
          <td>${r.administrativa}</td><td>${r.medica}</td><td>${r.paro}</td>
          <td>${r.habiles ? (Math.round(1000 * r.trabajados / r.habiles) / 10).toString().replace('.', ',') + ' %' : '–'}</td></tr>`).join('') : '<tr><td colspan="8" class="demo-vacio">No hay docentes para mostrar.</td></tr>'}</tbody>
      </table></div>
      ${dni && lista[0] ? this.htmlDetalle(lista[0]) : ''}
      <div class="sec-acciones"><button type="button" class="btn btn-outline" onclick="LicenciasModulo.descargarCSV()">⬇️ Descargar planilla (CSV)</button></div>`;
  },

  htmlDetalle(r) {
    if (!r.detalle.length) return '<p class="acta-ayuda">Sin licencias en este período.</p>';
    return `<h4>Licencias del período</h4><ul class="lic-lista">${r.detalle.map(l => `<li><b>${this.TIPOS[l.tipo]}</b> · ${this.fmt(l.desde)} al ${this.fmt(l.hasta)} · ${l.dias} día${l.dias === 1 ? '' : 's'} hábil${l.dias === 1 ? '' : 'es'} en el período${l.articulo ? ' · ' + this.esc(l.articulo) : ''}${l.observaciones ? ' · ' + this.esc(l.observaciones) : ''}</li>`).join('')}</ul>`;
  },

  descargarCSV() {
    if (!this._ultimo) return;
    const { desde, hasta, lista } = this._ultimo;
    const filas = [['Docente', 'Desde', 'Hasta', 'Días hábiles', 'Días trabajados', 'Faltas totales', 'Administrativas', 'Médicas', 'Paros']]
      .concat(lista.map(r => [this.nombreDocente(r.dni), this.fmt(desde), this.fmt(hasta), r.habiles, r.trabajados, r.faltas, r.administrativa, r.medica, r.paro]));
    const csv = '﻿' + filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `licencias_${desde}_a_${hasta}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  },

  /* ---- LICENCIAS ---- */
  htmlLicencias() {
    const hoy = this.hoyISO();
    const lista = this.licencias.filter(l => !this.filtroLista || l.docente_dni === this.filtroLista);
    return `
      <form class="lic-form" onsubmit="LicenciasModulo.guardarLicencia(event)">
        <label>Docente <select id="lic-dni" required>${this.opcionesDocentes('', false)}</select></label>
        <label>Tipo <select id="lic-tipo" required><option value="administrativa">Administrativa</option><option value="medica">Médica</option><option value="paro">Paro</option></select></label>
        <label>Desde <input type="date" id="lic-desde" value="${hoy}" required onchange="LicenciasModulo.vistaPreviaDias()"></label>
        <label>Hasta <input type="date" id="lic-hasta" value="${hoy}" required onchange="LicenciasModulo.vistaPreviaDias()"></label>
        <label>Artículo / N.º de certificado <input type="text" id="lic-art" maxlength="80" placeholder="Opcional"></label>
        <label class="lic-ancho">Observaciones <input type="text" id="lic-obs" maxlength="300" placeholder="Opcional. No anotes diagnósticos."></label>
        <div class="lic-ancho"><span id="lic-previa" class="acta-ayuda"></span></div>
        <button type="submit" class="btn btn-gold">➕ Cargar licencia</button>
      </form>
      <div class="lic-form"><label>Ver licencias de <select onchange="LicenciasModulo.filtroLista=this.value;LicenciasModulo.dibujar()">${this.opcionesDocentes(this.filtroLista, true)}</select></label></div>
      <div class="lic-scroll"><table class="demo-tabla lic-tabla">
        <thead><tr><th>Docente</th><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Días hábiles</th><th>Detalle</th><th></th></tr></thead>
        <tbody>${lista.length ? lista.map(l => `<tr><td>${this.esc(this.nombreDocente(l.docente_dni))}</td><td>${this.TIPOS[l.tipo]}</td><td>${this.fmt(l.desde)}</td><td>${this.fmt(l.hasta)}</td>
          <td>${this.calcular(l.desde, l.hasta).total}</td><td>${this.esc([l.articulo, l.observaciones].filter(Boolean).join(' · '))}</td>
          <td><button type="button" class="btn btn-outline" onclick="LicenciasModulo.eliminarLicencia(${l.id})">🗑️</button></td></tr>`).join('') : '<tr><td colspan="7" class="demo-vacio">Todavía no hay licencias cargadas.</td></tr>'}</tbody>
      </table></div>`;
  },

  vistaPreviaDias() {
    const p = document.getElementById('lic-previa');
    if (!p) return;
    const d = document.getElementById('lic-desde').value, h = document.getElementById('lic-hasta').value;
    if (!d || !h) { p.textContent = ''; return; }
    if (d > h) { p.textContent = '⚠️ «Desde» no puede ser posterior a «Hasta».'; return; }
    const r = this.calcular(d, h);
    const nFer = new Set(r.feriadosEnHabiles.map(x => x.fecha)).size;
    p.textContent = `Esta licencia suma ${r.total} día${r.total === 1 ? '' : 's'} hábil${r.total === 1 ? '' : 'es'}${nFer ? ` (se descontaron ${nFer} feriado${nFer === 1 ? '' : 's'})` : ''}.`;
  },

  async guardarLicencia(ev) {
    ev.preventDefault();
    const fila = {
      docente_dni: document.getElementById('lic-dni').value,
      tipo: document.getElementById('lic-tipo').value,
      desde: document.getElementById('lic-desde').value,
      hasta: document.getElementById('lic-hasta').value,
      articulo: document.getElementById('lic-art').value.trim() || null,
      observaciones: document.getElementById('lic-obs').value.trim() || null
    };
    if (!fila.docente_dni) { alert('Elegí el docente.'); return; }
    if (fila.desde > fila.hasta) { alert('«Desde» no puede ser posterior a «Hasta».'); return; }
    const solapa = this.licencias.find(l => l.docente_dni === fila.docente_dni && l.desde <= fila.hasta && l.hasta >= fila.desde);
    if (solapa && !confirm(`Este docente ya tiene una licencia ${this.TIPOS[solapa.tipo].toLowerCase()} del ${this.fmt(solapa.desde)} al ${this.fmt(solapa.hasta)} que se superpone. Los días repetidos se cuentan una sola vez. ¿Cargarla igual?`)) return;
    const { data, error } = await supabase.from('licencias').insert(fila).select().single();
    if (error) { console.error(error); alert('No se pudo guardar la licencia. ' + (error.message || '')); return; }
    this.licencias.unshift(data);
    this.dibujar();
  },

  async eliminarLicencia(id) {
    const l = this.licencias.find(x => x.id === id);
    if (!l || !confirm(`¿Eliminar la licencia ${this.TIPOS[l.tipo].toLowerCase()} de ${this.nombreDocente(l.docente_dni)} (${this.fmt(l.desde)} al ${this.fmt(l.hasta)})?`)) return;
    const { error } = await supabase.from('licencias').delete().eq('id', id);
    if (error) { alert('No se pudo eliminar. ' + (error.message || '')); return; }
    this.licencias = this.licencias.filter(x => x.id !== id);
    this.dibujar();
  },

  /* ---- FERIADOS Y CICLO ---- */
  htmlFeriados() {
    const delAnio = this.feriados.filter(f => String(f.fecha).slice(0, 4) === String(this.anio));
    const c = this.ciclo;
    return `
      <h4>Ciclo lectivo ${this.anio}</h4>
      <form class="lic-form" onsubmit="LicenciasModulo.guardarCiclo(event)">
        <label>Inicio <input type="date" id="cic-ini" value="${c ? c.inicio : ''}" required></label>
        <label>Fin <input type="date" id="cic-fin" value="${c ? c.fin : ''}" required></label>
        <button type="submit" class="btn btn-gold">💾 Guardar ciclo</button>
      </form>
      <h4>Feriados, asuetos y recesos</h4>
      <p class="acta-ayuda">Cargá acá los feriados nacionales, provinciales y municipales, y también el receso invernal u otros días sin actividad. Esos días no cuentan como hábiles.</p>
      <form class="lic-form" onsubmit="LicenciasModulo.guardarFeriado(event)">
        <label>Desde <input type="date" id="fer-fecha" required></label>
        <label>Hasta (si son varios días) <input type="date" id="fer-hasta"></label>
        <label>Ámbito <select id="fer-ambito">${Object.entries(this.AMBITOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label class="lic-ancho">Nombre <input type="text" id="fer-nombre" maxlength="120" required placeholder="Ej.: Receso invernal"></label>
        <button type="submit" class="btn btn-gold">➕ Agregar</button>
        <button type="button" class="btn btn-outline" onclick="LicenciasModulo.cargarFijos()">Cargar feriados nacionales de fecha fija de ${this.anio}</button>
      </form>
      <p class="acta-ayuda">El botón de arriba solo trae los de fecha fija. Los trasladables (Carnaval, Semana Santa, 17/8, 12/10, 20/11) y los fines de semana largos decretados se cargan a mano.</p>
      <div class="lic-scroll"><table class="demo-tabla lic-tabla">
        <thead><tr><th>Fecha</th><th>Nombre</th><th>Ámbito</th><th></th></tr></thead>
        <tbody>${delAnio.length ? delAnio.map(f => `<tr><td>${this.fmt(f.fecha)}</td><td>${this.esc(f.nombre)}</td><td>${this.AMBITOS[f.ambito] || f.ambito}</td>
          <td><button type="button" class="btn btn-outline" onclick="LicenciasModulo.eliminarFeriado(${f.id})">🗑️</button></td></tr>`).join('') : `<tr><td colspan="4" class="demo-vacio">No hay feriados cargados para ${this.anio}.</td></tr>`}</tbody>
      </table></div>`;
  },

  async guardarCiclo(ev) {
    ev.preventDefault();
    const inicio = document.getElementById('cic-ini').value, fin = document.getElementById('cic-fin').value;
    if (inicio > fin) { alert('El inicio no puede ser posterior al fin.'); return; }
    const { error } = await supabase.from('ciclo_lectivo_config').upsert({ anio: this.anio, inicio, fin, updated_at: new Date().toISOString() });
    if (error) { alert('No se pudo guardar el ciclo. ' + (error.message || '')); return; }
    this.ciclos = (this.ciclos || []).filter(x => Number(x.anio) !== this.anio).concat({ anio: this.anio, inicio, fin });
    this.ciclo = { anio: this.anio, inicio, fin };
    this.filtro.desde = inicio; this.filtro.hasta = fin;
    this.dibujar();
  },

  async insertarFeriados(filas) {
    // Un mismo día y ámbito no se repite: se omiten los que ya están cargados
    const nuevas = filas.filter(n => !this.feriados.some(f => f.fecha === n.fecha && f.ambito === n.ambito));
    if (!nuevas.length) return 0;
    const { data, error } = await supabase.from('feriados').insert(nuevas).select();
    if (error) throw error;
    this.feriados = this.feriados.concat(data || []).sort((a, b) => a.fecha.localeCompare(b.fecha));
    return nuevas.length;
  },

  async guardarFeriado(ev) {
    ev.preventDefault();
    const d = document.getElementById('fer-fecha').value, h = document.getElementById('fer-hasta').value || d;
    const nombre = document.getElementById('fer-nombre').value.trim(), ambito = document.getElementById('fer-ambito').value;
    if (h < d) { alert('«Hasta» no puede ser anterior a «Desde».'); return; }
    if (this.calcularRangoDias(d, h) > 60) { alert('El rango es demasiado largo (máximo 60 días seguidos).'); return; }
    const filas = [];
    for (let x = this.fecha(d); x <= this.fecha(h); x = new Date(x.getTime() + 86400000)) filas.push({ fecha: this.iso(x), nombre, ambito });
    try { await this.insertarFeriados(filas); this.dibujar(); }
    catch (e) { alert('No se pudo guardar. ' + (e.message || '')); }
  },

  calcularRangoDias(d, h) { return Math.round((this.fecha(h) - this.fecha(d)) / 86400000) + 1; },

  async cargarFijos() {
    const filas = this.FIJOS.map(([md, nombre]) => ({ fecha: `${this.anio}-${md}`, nombre, ambito: 'nacional' }));
    try {
      const n = await this.insertarFeriados(filas);
      this.dibujar();
      alert(n ? `Se cargaron ${n} feriados nacionales de fecha fija. Revisalos y sumá los trasladables.` : 'Esos feriados ya estaban cargados.');
    } catch (e) { alert('No se pudieron cargar. ' + (e.message || '')); }
  },

  async eliminarFeriado(id) {
    const f = this.feriados.find(x => x.id === id);
    if (!f || !confirm(`¿Eliminar «${f.nombre}» (${this.fmt(f.fecha)})?`)) return;
    const { error } = await supabase.from('feriados').delete().eq('id', id);
    if (error) { alert('No se pudo eliminar. ' + (error.message || '')); return; }
    this.feriados = this.feriados.filter(x => x.id !== id);
    this.dibujar();
  }
};

window.LicenciasModulo = LicenciasModulo;
