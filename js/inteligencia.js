/* ==========================================================================
   INTELIGENCIA DE DATOS · Dashboard (administración y regencia)
   Cuatro vistas sobre los datos que ya tiene la plataforma:
     Resumen · Prioridades · Mapa de riesgo · Recorrido
   No crea tablas ni funciones nuevas en Supabase: lee las tablas de siempre y
   calcula en el navegador con las mismas reglas de js/reglas.js (ReglasFP):
     - Baja: ReglasFP.estadoCursada (manual, o automática al cierre de un módulo).
     - En riesgo: misma regla que Seguimiento (asistencia < 70 % con 3 o más
       registros, promedio de actividades < 70, o sin entregas en un trayecto
       con 2 o más actividades). Los dados de baja no cuentan como "en riesgo".
   Archivo: js/inteligencia.js · se carga desde DashboardAdmin.cargarEstadisticas()
   ========================================================================== */

const DashboardIntel = {
  MINIMO: 70,
  MESES: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  vista: 'resumen',
  ciclo: '2026',
  datos: null,
  token: 0,
  raizId: 'intel-root',    // dónde se dibuja (Dashboard: intel-root · Secretaría: intel-root-sec)
  soloLectura: false,      // true para Secretaría: se ve todo, sin botones que lleven a acciones

  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  pct(a, b) { return b > 0 ? Math.round(1000 * a / b) / 10 : null; },
  fmt(p) { return p === null || p === undefined ? '–' : String(p).replace('.', ',') + ' %'; },
  num(n) { return Number(n).toLocaleString('es-AR'); },
  plural(n, uno, varios) { return n === 1 ? uno : varios; },

  /* ---------- Carga ---------- */

  // Trae todas las filas de una tabla para una lista de ids, en lotes y con paginado
  // (Supabase corta en 1000 filas por consulta).
  async traer(tabla, columnas, campo, valores) {
    const out = [];
    for (let i = 0; i < valores.length; i += 100) {
      const lote = valores.slice(i, i + 100);
      for (let d = 0; ; d += 1000) {
        const { data, error } = await supabase.from(tabla).select(columnas).in(campo, lote)
          .order('id', { ascending: true }).range(d, d + 999);
        if (error) throw error;
        out.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
    }
    return out;
  },

  async cargar(ciclo, opciones) {
    this.raizId = (opciones && opciones.raiz) || 'intel-root';
    this.soloLectura = !!(opciones && opciones.soloLectura);
    const raiz = document.getElementById(this.raizId);
    if (!raiz) return;
    this.ciclo = String(ciclo || '2026');
    const mio = ++this.token;
    if (!this.datos) raiz.innerHTML = '<p class="intel-vacio">Calculando…</p>';
    try {
      const { data: tr, error: eT } = await supabase.from('trayectos').select('*');
      if (eT) throw eT;
      const trayectos = (tr || []).filter(t => this.ciclo === 'TODOS' || String(t.ciclo_lectivo || '2026') === this.ciclo);
      if (!trayectos.length) {
        if (mio !== this.token) return;
        this.datos = { vacio: true };
        this.dibujar();
        return;
      }
      const ids = trayectos.map(t => Number(t.id));
      const clases = [];
      for (let i = 0; i < ids.length; i += 100) {
        const lote = ids.slice(i, i + 100);
        const r = await ReglasFP.selectClases('id, titulo, trayecto_id, modulo_id', q => q.in('trayecto_id', lote));
        if (r.error) throw r.error;
        clases.push(...(r.data || []));
      }
      const [insc, asis, modulos, acreditados, excepciones] = await Promise.all([
        this.traer('inscripciones', '*', 'trayecto_id', ids),
        this.traer('asistencias', 'id, trayecto_id, modulo_id, estudiante_user, fecha, estado', 'trayecto_id', ids),
        this.traer('modulos', '*', 'trayecto_id', ids),
        this.traer('modulos_acreditados', '*', 'trayecto_id', ids).catch(() => []),
        this.traer('excepciones_estudiantes', 'id, trayecto_id, estudiante_user, habilitado', 'trayecto_id', ids).catch(() => [])
      ]);
      const entregas = clases.length
        ? await this.traer('entregas_actividades', 'id, clase_id, estudiante_user, nota', 'clase_id', clases.map(c => Number(c.id)))
        : [];
      if (mio !== this.token) return;     // llegó una carga más nueva (cambió el ciclo)
      this.datos = this.procesar({ trayectos, clases, insc, asis, modulos, acreditados, excepciones, entregas });
      this.dibujar();
    } catch (err) {
      console.error('Inteligencia de datos:', err);
      if (mio !== this.token) return;
      raiz.innerHTML = '<div class="intel-vacio">No se pudo armar la inteligencia de datos. Probá recargar la página.</div>';
    }
  },

  /* ---------- Cálculo ---------- */

  procesar(raw) {
    const { trayectos, clases, insc, asis, modulos, acreditados, excepciones, entregas } = raw;
    const grupo = (arr, clave) => { const m = new Map(); arr.forEach(x => { const k = clave(x); (m.get(k) || m.set(k, []).get(k)).push(x); }); return m; };
    const entPorAlumno = grupo(entregas, e => String(e.estudiante_user));
    const asisPorAlumno = grupo(asis, a => Number(a.trayecto_id) + '|' + String(a.estudiante_user));
    const excSet = new Set(excepciones.filter(x => x.habilitado).map(x => Number(x.trayecto_id) + '|' + String(x.estudiante_user)));
    const califIds = new Set(clases.filter(c => c.calificable !== false && c.tipo !== 'encuesta').map(c => Number(c.id)));

    const filas = [];                // una por inscripción
    const porTrayecto = [];
    let modEval = 0, modAprob = 0;
    const meses = new Map();         // 'YYYY-MM' -> { p, n }
    let asTot = 0, asPres = 0, maxMod = 0;

    trayectos.forEach(t => {
      const tid = Number(t.id);
      const modsT = modulos.filter(m => Number(m.trayecto_id) === tid).sort((a, b) => a.id - b.id);
      const clasesT = clases.filter(c => Number(c.trayecto_id) === tid);
      const idsC = new Set(clasesT.map(c => Number(c.id)));
      const acredT = acreditados.filter(a => Number(a.trayecto_id) === tid);
      const computa = ReglasFP.computaAsistencia(t);
      maxMod = Math.max(maxMod, modsT.length);

      const asisT = asis.filter(a => Number(a.trayecto_id) === tid);
      if (computa) {
        asisT.forEach(a => {
          const pres = ReglasFP.esPresente(a.estado) ? 1 : 0;
          asTot++; asPres += pres;
          const mk = String(a.fecha || '').slice(0, 7);
          if (/^\d{4}-\d{2}$/.test(mk)) { const m = meses.get(mk) || { p: 0, n: 0 }; m.p += pres; m.n++; meses.set(mk, m); }
        });
      }

      const fT = [];
      insc.filter(i => Number(i.trayecto_id) === tid).forEach(i => {
        const key = String(i.estudiante_user);
        const excepcion = excSet.has(tid + '|' + key);
        const entA = entPorAlumno.get(key) || [];
        const asA = asisPorAlumno.get(tid + '|' + key) || [];
        const ev = ReglasFP.evaluar({
          key, modulos: modsT, clases: clasesT, entregas: entA, asistencias: asA,
          acreditados: acredT, computaAsistencia: computa, excepcion
        });
        const c = ReglasFP.estadoCursada(ev, modsT, i, { excepcion });
        const f = {
          t, tid, key, tieneModulos: modsT.length > 0, nMods: modsT.length,
          baja: !!c.baja, bajaPendiente: !!c.baja && !c.guardada, bajaMod: null,
          riesgo: false, moduloActual: ev.modulos.findIndex(m => !m.aprobado),
          aprobo1: ev.modulos.some(m => m.aprobado),
          egresado: !!(i.num_egresado && String(i.num_egresado).trim() !== ''),
          pctAs: (computa && asA.length) ? Math.round(ReglasFP.porcentajeAsistencia(asA)) : null
        };
        if (c.baja) { const m = /Módulo (\d+)/.exec(c.motivo || ''); if (m) f.bajaMod = Number(m[1]); }
        ev.modulos.forEach(m => { if (!m.bloqueado && (m.nota !== null || m.equivalencia)) { modEval++; if (m.aprobado) modAprob++; } });

        if (!f.baja) {
          const ent = entA.filter(e => idsC.has(Number(e.clase_id)));
          const notas = ent.map(e => parseFloat(e.nota)).filter(v => !isNaN(v));
          const prom = notas.length ? Math.round(notas.reduce((x, y) => x + y, 0) / notas.length) : null;
          if (f.pctAs !== null && asA.length >= 3 && f.pctAs < this.MINIMO) f.riesgo = true;
          if (prom !== null && prom < this.MINIMO) f.riesgo = true;
          if (idsC.size >= 2 && ent.length === 0) f.riesgo = true;
        }
        fT.push(f); filas.push(f);
      });

      const asT = computa ? asisT : [];
      const pres = asT.filter(a => ReglasFP.esPresente(a.estado)).length;
      const bajas = fT.filter(f => f.baja).length;
      porTrayecto.push({
        t, inscriptos: fT.length, matricula: fT.length - bajas, bajas,
        riesgo: fT.filter(f => f.riesgo).length,
        egresados: fT.filter(f => f.egresado).length,
        asisRegistros: asT.length,
        asis: this.pct(pres, asT.length),
        computa, sinAsistencia: computa && fT.length > 0 && asisT.length === 0,
        desercion: this.pct(bajas, fT.length)
      });
    });

    const inscriptos = filas.length;
    const bajas = filas.filter(f => f.baja).length;
    const riesgo = filas.filter(f => f.riesgo).length;
    const bajasPendientes = filas.filter(f => f.bajaPendiente).length;
    const cursan = inscriptos - bajas;
    const sinCorregir = entregas.filter(e => (e.nota === null || e.nota === undefined || String(e.nota).trim() === '') && califIds.has(Number(e.clase_id))).length;

    const bajasPorModulo = {};
    filas.filter(f => f.baja).forEach(f => { const k = f.bajaMod || 'otra'; bajasPorModulo[k] = (bajasPorModulo[k] || 0) + 1; });

    // Mapa de riesgo: en riesgo por trayecto y por módulo en el que está cada estudiante
    const colsMod = Math.min(Math.max(maxMod, 1), 8);
    const hayTrayectoSinModulos = filas.some(f => !f.tieneModulos);
    const heat = porTrayecto.filter(p => p.matricula > 0).map(p => {
      const celdas = new Array(colsMod).fill(0);
      let sinMod = 0;
      filas.filter(f => f.tid === Number(p.t.id) && f.riesgo).forEach(f => {
        if (!f.tieneModulos) { sinMod++; return; }
        const idx = f.moduloActual === -1 ? f.nMods - 1 : f.moduloActual;
        celdas[Math.min(idx, colsMod - 1)]++;
      });
      return { t: p.t, celdas, sinMod, total: p.riesgo };
    }).sort((a, b) => b.total - a.total || String(a.t.nombre).localeCompare(String(b.t.nombre)));

    // Recorrido: de la inscripción al egreso
    const aprobaron = filas.filter(f => f.aprobo1).length;
    const prom = arr => arr.length ? Math.round(arr.reduce((x, y) => x + y, 0) / arr.length) : null;
    const asisBajas = prom(filas.filter(f => f.baja && f.pctAs !== null).map(f => f.pctAs));
    const asisCursan = prom(filas.filter(f => !f.baja && f.pctAs !== null).map(f => f.pctAs));

    const mesesOrd = [...meses.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ k, mes: this.MESES[Number(k.slice(5)) - 1], anio: k.slice(0, 4), pct: this.pct(v.p, v.n), n: v.n }));

    return {
      vacio: false, filas, porTrayecto,
      kpi: {
        inscriptos, cursan, bajas, riesgo, bajasPendientes, sinCorregir,
        asistencia: this.pct(asPres, asTot), asisRegistros: asTot,
        aprobModulos: this.pct(modAprob, modEval), modEval,
        desercion: this.pct(bajas, inscriptos)
      },
      meses: mesesOrd, bajasPorModulo, colsMod, hayTrayectoSinModulos, heat,
      embudo: { inscriptos, cursan, aprobaron, egresados: filas.filter(f => f.egresado).length, bajas, asisBajas, asisCursan }
    };
  },

  /* ---------- Vistas ---------- */

  ir(vista) { this.vista = vista; this.dibujar(); },

  dibujar() {
    const raiz = document.getElementById(this.raizId);
    if (!raiz) return;
    const d = this.datos;
    const tabs = [['resumen', 'Resumen'], ['prioridades', 'Prioridades'], ['mapa', 'Mapa de riesgo'], ['recorrido', 'Recorrido']];
    const cabecera = `
      <div class="intel-head">
        <div>
          <h3 id="intel-titulo">Inteligencia de datos</h3>
          <p>Qué está pasando en el CFP y a qué prestarle atención primero.</p>
        </div>
        <div class="intel-tabs" role="tablist" aria-label="Vistas de inteligencia de datos">
          ${tabs.map(([k, n]) => `<button type="button" role="tab" id="intel-tab-${k}" class="intel-tab${this.vista === k ? ' activa' : ''}" aria-selected="${this.vista === k}" aria-controls="intel-panel" onclick="DashboardIntel.ir('${k}')">${n}</button>`).join('')}
        </div>
      </div>`;
    let cuerpo;
    if (!d || d.vacio) cuerpo = '<div class="intel-vacio">Todavía no hay trayectos en este ciclo lectivo.</div>';
    else if (!d.kpi.inscriptos) cuerpo = '<div class="intel-vacio">Todavía no hay inscripciones en este ciclo lectivo.</div>';
    else cuerpo = ({ resumen: () => this.vistaResumen(d), prioridades: () => this.vistaPrioridades(d), mapa: () => this.vistaMapa(d), recorrido: () => this.vistaRecorrido(d) }[this.vista])();
    raiz.innerHTML = `<section class="intel" aria-labelledby="intel-titulo">${cabecera}<div id="intel-panel" role="tabpanel" aria-labelledby="intel-tab-${this.vista}">${cuerpo}</div></section>`;
  },

  /* A · Resumen: indicadores, lo que dicen los datos, asistencia por mes y trayectos */
  vistaResumen(d) {
    const k = d.kpi;
    const tarjeta = (rotulo, valor, nota, clase) => `<div class="intel-kpi"><span class="intel-kpi-r">${rotulo}</span><span class="intel-kpi-v">${valor}</span>${nota ? `<span class="intel-chip ${clase || 'info'}">${nota}</span>` : ''}</div>`;
    const kpis = `<div class="intel-kpis">
      ${tarjeta('Cursan hoy', this.num(k.cursan), `de ${this.num(k.inscriptos)} inscriptos`)}
      ${tarjeta('Asistencia', this.fmt(k.asistencia), k.asisRegistros ? `${this.num(k.asisRegistros)} registros` : 'Sin registros', k.asisRegistros ? 'info' : 'aviso')}
      ${tarjeta('Módulos aprobados', this.fmt(k.aprobModulos), k.modEval ? `de ${this.num(k.modEval)} evaluados` : 'Sin módulos evaluados', 'info')}
      ${tarjeta('Bajas', this.num(k.bajas), this.fmt(k.desercion) + ' de los inscriptos', k.bajas ? 'mal' : 'ok')}
      ${tarjeta('En riesgo', this.num(k.riesgo), k.riesgo ? 'Mirá Seguimiento' : 'Ninguno por ahora', k.riesgo ? 'aviso' : 'ok')}
    </div>`;

    return `${kpis}
      <div class="intel-dos">
        <div class="intel-caja intel-grande"><h4>Asistencia por mes</h4>${this.graficoMeses(d.meses)}</div>
        <div class="intel-caja intel-oscura"><h4>Lo que dicen los datos</h4>${this.hallazgos(d)}</div>
      </div>
      <div class="intel-caja"><h4>Trayectos, de mayor a menor deserción</h4>${this.tablaTrayectos(d)}</div>`;
  },

  hallazgos(d) {
    const k = d.kpi, out = [];
    const ir = (txt, tab) => this.soloLectura ? '' : `<button type="button" class="intel-link" onclick="UI.showTab('${tab}')">${txt}</button>`;
    const item = (tipo, etiqueta, titulo, sub, accion) => out.push(`<div class="intel-hallazgo"><span class="intel-chip ${tipo}">${etiqueta}</span><b>${titulo}</b><span>${sub}</span>${accion || ''}</div>`);

    const cand = d.porTrayecto.filter(p => p.inscriptos >= 5 && p.bajas > 0).sort((a, b) => b.desercion - a.desercion)[0];
    if (cand && k.desercion !== null && cand.bajas >= 2 && cand.desercion >= 1.5 * k.desercion) {
      item('aviso', 'Atención', `${this.esc(cand.t.nombre)} concentra ${cand.bajas} de las ${k.bajas} bajas.`,
        `Su deserción es del ${this.fmt(cand.desercion)}; en todo el CFP es del ${this.fmt(k.desercion)}.`);
    } else if (k.bajas > 0) {
      item('info', 'Bajas', `El ciclo lleva ${k.bajas} ${this.plural(k.bajas, 'baja', 'bajas')}.`, `Es el ${this.fmt(k.desercion)} de los inscriptos.`);
    } else {
      item('ok', 'Va bien', 'Todavía no hay bajas en este ciclo.', 'Ni manuales ni automáticas.');
    }
    if (k.riesgo > 0) item('aviso', 'Atención', `${k.riesgo} ${this.plural(k.riesgo, 'estudiante en riesgo', 'estudiantes en riesgo')}.`,
      'Asistencia menor a 70 %, promedio menor a 70 o sin entregas.', ir('Abrir Seguimiento', 'seguimiento'));
    if (k.bajasPendientes > 0) item('aviso', 'Para registrar', `${k.bajasPendientes} ${this.plural(k.bajasPendientes, 'baja automática sin registrar', 'bajas automáticas sin registrar')}.`,
      'La planilla de matrícula todavía las cuenta como matriculados.', ir('Registrar en Seguimiento', 'seguimiento'));
    const mejor = d.porTrayecto.filter(p => p.asisRegistros >= 10 && p.asis !== null).sort((a, b) => b.asis - a.asis)[0];
    if (mejor) item('ok', 'Va bien', `${this.esc(mejor.t.nombre)} tiene ${this.fmt(mejor.asis)} de asistencia.`, 'Es la más alta entre los trayectos con asistencia cargada.');
    return out.slice(0, 4).join('');
  },

  graficoMeses(meses) {
    const m = meses.filter(x => x.pct !== null);
    if (m.length < 2) return '<p class="intel-vacio">Cuando haya asistencia cargada en dos meses o más, vas a ver la evolución acá.</p>';
    const W = 640, H = 230, x0 = 44, x1 = 620, paso = (x1 - x0) / (m.length - 1);
    const y = v => 200 - v * 1.8;
    const pts = m.map((p, i) => `${Math.round(x0 + i * paso)},${Math.round(y(p.pct))}`).join(' ');
    const resumen = m.map(p => `${p.mes} ${this.fmt(p.pct)}`).join(', ');
    return `<svg class="intel-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Asistencia por mes: ${this.esc(resumen)}">
      ${[0, 25, 50, 75, 100].map(v => `<line class="intel-grid" x1="${x0}" x2="${x1 + 20}" y1="${y(v)}" y2="${y(v)}"/><text class="intel-eje" x="6" y="${y(v) + 4}">${v} %</text>`).join('')}
      <polyline class="intel-linea" points="${pts}"/>
      ${m.map((p, i) => `<circle class="intel-punto" cx="${Math.round(x0 + i * paso)}" cy="${Math.round(y(p.pct))}" r="4"/><text class="intel-eje" x="${Math.round(x0 + i * paso) - 10}" y="222">${p.mes}</text>`).join('')}
    </svg>`;
  },

  tablaTrayectos(d) {
    const g = d.kpi.desercion;
    const filas = d.porTrayecto.filter(p => p.inscriptos > 0)
      .sort((a, b) => (b.desercion ?? -1) - (a.desercion ?? -1) || b.inscriptos - a.inscriptos);
    if (!filas.length) return '<p class="intel-vacio">No hay inscriptos en los trayectos de este ciclo.</p>';
    const barra = v => v === null ? '<span class="intel-nd">Sin datos</span>' : `<span class="intel-barra"><span style="width:${Math.min(100, Math.round(v))}%"></span></span><b>${Math.round(v)} %</b>`;
    return `<div class="intel-scroll"><table class="intel-tabla">
      <thead><tr><th scope="col">Trayecto</th><th scope="col">Cursan</th><th scope="col">Asistencia</th><th scope="col">En riesgo</th><th scope="col">Deserción</th></tr></thead>
      <tbody>${filas.map(p => {
        const clase = (p.bajas >= 2 && g !== null && p.desercion > 1.5 * g) ? 'mal' : (g !== null && p.desercion > g ? 'aviso' : 'ok');
        return `<tr><th scope="row">${this.esc(p.t.nombre || 'Sin nombre')}</th><td>${this.num(p.matricula)} <small>de ${this.num(p.inscriptos)}</small></td>
          <td class="intel-celda-barra">${barra(p.asis)}</td><td>${p.riesgo}</td>
          <td><span class="intel-chip ${clase}">${this.fmt(p.desercion)}</span></td></tr>`;
      }).join('')}</tbody></table></div>`;
  },

  /* B · Prioridades: qué resolver primero y dónde se van los estudiantes */
  vistaPrioridades(d) {
    const k = d.kpi;
    const fila = (tipo, etiqueta, titulo, sub, boton, tab) => `<div class="intel-prio">
      <div><span class="intel-chip ${tipo}">${etiqueta}</span><b>${titulo}</b><span>${sub}</span></div>
      ${this.soloLectura ? '' : `<button type="button" class="btn ${tipo === 'aviso' ? 'btn-gold' : 'btn-secondary'}" onclick="UI.showTab('${tab}')">${boton}</button>`}</div>`;
    const items = [];
    if (k.bajasPendientes) items.push(fila('aviso', 'Urgente', `${k.bajasPendientes} ${this.plural(k.bajasPendientes, 'baja automática sin registrar', 'bajas automáticas sin registrar')}`, 'La planilla de matrícula todavía las cuenta como matriculados.', 'Abrir Seguimiento', 'seguimiento'));
    if (k.riesgo) items.push(fila('aviso', 'Urgente', `${k.riesgo} ${this.plural(k.riesgo, 'estudiante en riesgo', 'estudiantes en riesgo')} de baja`, 'Asistencia menor a 70 %, promedio menor a 70 o sin entregas.', 'Abrir Seguimiento', 'seguimiento'));
    if (k.sinCorregir) items.push(fila('info', 'Pendiente', `${k.sinCorregir} ${this.plural(k.sinCorregir, 'entrega sin corregir', 'entregas sin corregir')}`, 'Sin nota, las actividades no entran en el promedio del módulo.', 'Ver entregas', 'seguimiento'));
    const sinAs = d.porTrayecto.filter(p => p.sinAsistencia);
    if (sinAs.length) items.push(fila('info', 'Pendiente', `${sinAs.length} ${this.plural(sinAs.length, 'trayecto sin asistencia cargada', 'trayectos sin asistencia cargada')}`, sinAs.slice(0, 3).map(p => this.esc(p.t.nombre)).join(' · ') + (sinAs.length > 3 ? ' · …' : ''), 'Ver trayectos', 'trayectos'));
    const lista = items.length ? items.join('') : '<div class="intel-ok">No hay nada urgente en este momento.</div>';

    const bm = d.bajasPorModulo, claves = Object.keys(bm).sort((a, b) => (a === 'otra') - (b === 'otra') || Number(a) - Number(b));
    const max = Math.max(1, ...Object.values(bm));
    const donde = claves.length ? `<div class="intel-barras">${claves.map(c => `<div><span>${c === 'otra' ? 'Sin módulo' : 'Módulo ' + c}</span><span class="intel-barra grande${bm[c] === max ? ' pico' : ''}"><span style="width:${Math.round(100 * bm[c] / max)}%"></span></span><b>${bm[c]}</b></div>`).join('')}</div>
      <p class="intel-nota">${(() => { const top = claves.filter(c => c !== 'otra').sort((a, b) => bm[b] - bm[a])[0]; return top ? `El ${this.fmt(this.pct(bm[top], k.bajas))} de las bajas ocurre en el módulo ${top}.` : 'Las bajas no tienen un módulo asociado.'; })()}</p>`
      : '<p class="intel-vacio">Todavía no hay bajas para analizar.</p>';

    return `<div class="intel-dos">
      <div class="intel-caja intel-grande"><h4>Para resolver primero</h4>${lista}</div>
      <div class="intel-caja"><h4>Dónde se van los estudiantes</h4>${donde}</div></div>`;
  },

  /* C · Mapa de riesgo: estudiantes en riesgo por trayecto y módulo */
  vistaMapa(d) {
    if (!d.heat.length) return '<div class="intel-vacio">No hay trayectos con estudiantes cursando.</div>';
    const clase = n => n === 0 ? 'h0' : n <= 2 ? 'h1' : n <= 4 ? 'h2' : n <= 8 ? 'h3' : 'h4';
    const cols = Array.from({ length: d.colsMod }, (_, i) => i + 1);
    return `<div class="intel-caja"><h4>Estudiantes en riesgo por trayecto y módulo</h4>
      <p class="intel-nota">Cada celda cuenta estudiantes en riesgo que están cursando ese módulo (el primero que todavía no aprobaron). Mientras más oscura, más urgente.</p>
      <div class="intel-scroll"><table class="intel-heat">
        <thead><tr><th scope="col">Trayecto</th>${cols.map(c => `<th scope="col">M${c}</th>`).join('')}${d.hayTrayectoSinModulos ? '<th scope="col">Sin módulos</th>' : ''}<th scope="col">Total</th></tr></thead>
        <tbody>${d.heat.map(r => `<tr><th scope="row">${this.esc(r.t.nombre || 'Sin nombre')}</th>
          ${r.celdas.map((n, i) => `<td class="${clase(n)}" title="${this.esc(r.t.nombre)} · Módulo ${i + 1}: ${n}">${n}</td>`).join('')}
          ${d.hayTrayectoSinModulos ? `<td class="${clase(r.sinMod)}">${r.sinMod}</td>` : ''}<td class="intel-total">${r.total}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="intel-leyenda"><span>Estudiantes en riesgo:</span><i class="h0">0</i><i class="h1">1–2</i><i class="h2">3–4</i><i class="h3">5–8</i><i class="h4">9 o más</i></div></div>`;
  },

  /* E · Recorrido: de la inscripción al egreso */
  vistaRecorrido(d) {
    const e = d.embudo, max = Math.max(1, e.inscriptos);
    const etapa = (rot, n, clase) => `<div class="intel-etapa"><span class="intel-etapa-r">${rot}</span><span class="intel-barra grande ${clase}"><span style="width:${Math.max(2, Math.round(100 * n / max))}%"></span></span><b>${this.num(n)}</b></div>`;
    const fuga = (n, txt) => n > 0 ? `<div class="intel-fuga"><span class="intel-chip mal">−${this.num(n)}</span>${txt}</div>` : '';
    const comp = (e.asisBajas !== null && e.asisCursan !== null) ? `<div class="intel-caja"><h4>Cómo vienen de asistencia</h4>
        <div class="intel-barras">
          <div><span>Quienes se fueron</span><span class="intel-barra grande mal"><span style="width:${e.asisBajas}%"></span></span><b>${e.asisBajas} %</b></div>
          <div><span>Quienes siguen cursando</span><span class="intel-barra grande"><span style="width:${e.asisCursan}%"></span></span><b>${e.asisCursan} %</b></div>
        </div><p class="intel-nota">Promedio de asistencia por estudiante, sobre los que tienen asistencia cargada.</p></div>` : '';
    return `<div class="intel-dos">
      <div class="intel-caja intel-grande"><h4>Del ingreso al egreso</h4>
        ${etapa('Inscriptos', e.inscriptos, 'c1')}
        ${fuga(e.bajas, 'bajas durante el ciclo (manuales y automáticas)')}
        ${etapa('Siguen cursando', e.cursan, 'c2')}
        ${etapa('Aprobaron un módulo o más', e.aprobaron, 'c3')}
        ${etapa('Egresados', e.egresados, 'c4')}
        <p class="intel-nota">Egresado: estudiante con número de egresado cargado. Quienes todavía cursan no se cuentan como pérdida.</p>
      </div>${comp || '<div class="intel-caja"><h4>Cómo vienen de asistencia</h4><p class="intel-vacio">Falta asistencia cargada para comparar.</p></div>'}</div>`;
  }
};

window.DashboardIntel = DashboardIntel;
