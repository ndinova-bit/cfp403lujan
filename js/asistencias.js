/* ==========================================================================
   ASISTENCIA · toma, corrección, historial y planilla mensual
   - Cada fecha + módulo se guarda por separado (no pisa otros módulos).
   - Al elegir una fecha ya cargada se muestra lo registrado para corregirlo.
   - Estados: P presente · T tarde (cuenta como presente) · A ausente · J justificado (cuenta como ausente).
   ========================================================================== */
const AsistenciasModulo = {
  trayectoActualId: null,
  contenedorId: null,
  trayecto: null,
  alumnos: [],
  modulos: [],
  historial: [],
  estados: {},          // dni -> estado de la fecha/módulo en pantalla
  cargadoPrevio: false,

  ESTADOS: [
    { k: 'presente',    l: 'P', t: 'Presente' },
    { k: 'tarde',       l: 'T', t: 'Tarde (cuenta como presente)' },
    { k: 'ausente',     l: 'A', t: 'Ausente' },
    { k: 'justificado', l: 'J', t: 'Ausente justificado (cuenta como ausente)' }
  ],

  esc(t) { return (window.escHtml ? window.escHtml(t) : String(t ?? '')); },
  hoy() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  fechaAR(f) { return String(f || '').slice(0, 10).split('-').reverse().join('/'); },
  nombreModulo(id) {
    if (id === null || id === undefined || id === '') return 'General (todos los módulos)';
    const m = this.modulos.find(x => Number(x.id) === Number(id));
    return m ? m.nombre : 'Módulo';
  },
  mismoModulo(a, b) {
    const na = (a === null || a === undefined || a === '') ? null : Number(a);
    const nb = (b === null || b === undefined || b === '') ? null : Number(b);
    return na === nb;
  },

  async renderizarVista(trayectoId, contenedorId) {
    this.trayectoActualId = Number(trayectoId);
    this.contenedorId = contenedorId;
    const cont = document.getElementById(contenedorId);
    if (!cont) return;
    cont.innerHTML = '<p class="asis-cargando">Cargando asistencia…</p>';

    try {
      const [rT, rI, rM, rH] = await Promise.all([
        supabase.from('trayectos').select('*').eq('id', this.trayectoActualId).maybeSingle(),
        supabase.from('inscripciones').select('estudiante_user').eq('trayecto_id', this.trayectoActualId),
        supabase.from('modulos').select('id, nombre').eq('trayecto_id', this.trayectoActualId).order('id', { ascending: true }),
        supabase.from('asistencias').select('*').eq('trayecto_id', this.trayectoActualId).order('fecha', { ascending: false })
      ]);
      this.trayecto = rT.data || {};
      this.modulos = rM.data || [];
      this.historial = rH.data || [];

      const dnis = (rI.data || []).map(i => String(i.estudiante_user));
      if (!dnis.length) {
        cont.innerHTML = '<div class="prog-vacio">No hay estudiantes inscriptos en este trayecto.</div>';
        return;
      }
      const { data: alumnos } = await supabase.from('usuarios').select('usuario, dni, nombre, apellido').in('usuario', dnis);
      const porDni = {};
      (alumnos || []).forEach(a => { porDni[String(a.usuario || a.dni)] = a; });
      this.alumnos = dnis.map(d => {
        const a = porDni[d] || {};
        const ap = (a.apellido || '').toUpperCase().trim();
        const no = (a.nombre || '').trim();
        return { dni: d, nombre: ap && no ? `${ap}, ${no}` : (ap || no || `DNI ${d}`) };
      }).sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));

      this.dibujar();
      this.cargarFecha();
    } catch (err) {
      console.error('Asistencia:', err);
      cont.innerHTML = '<div class="prog-vacio">No se pudo cargar la asistencia. Probá recargar la página.</div>';
    }
  },

  dibujar() {
    const cont = document.getElementById(this.contenedorId);
    const computa = window.ReglasFP ? ReglasFP.computaAsistencia(this.trayecto) : true;
    const mesActual = this.hoy().slice(0, 7);

    cont.innerHTML = `
      ${computa ? '' : `<div class="asis-aviso">Este trayecto <strong>no computa asistencia</strong> (por ejemplo, virtual): podés registrarla, pero no se promedia en las notas.</div>`}
      <div class="asis-panel">
        <div class="asis-controles">
          <div class="form-group"><label for="asistencia-fecha">Fecha de la clase</label>
            <input type="date" id="asistencia-fecha" class="form-control" value="${this.hoy()}" onchange="AsistenciasModulo.cargarFecha()"></div>
          <div class="form-group"><label for="asistencia-modulo-id">Módulo</label>
            <select id="asistencia-modulo-id" class="form-control" onchange="AsistenciasModulo.cargarFecha()">
              <option value="">General (todos los módulos)</option>
              ${this.modulos.map(m => `<option value="${Number(m.id)}">${this.esc(m.nombre)}</option>`).join('')}
            </select></div>
        </div>
        <div id="asis-estado-dia" class="asis-estado-dia"></div>
        <div class="asis-lote">
          <button type="button" class="btn btn-secondary" onclick="AsistenciasModulo.marcarTodos('presente')">Todos presentes</button>
          <button type="button" class="btn btn-outline" onclick="AsistenciasModulo.marcarTodos('ausente')">Todos ausentes</button>
          <span class="asis-leyenda"><b>P</b> presente · <b>T</b> tarde (cuenta como presente) · <b>A</b> ausente · <b>J</b> justificado (cuenta como ausente)</span>
        </div>
        <div id="asis-lista" class="asis-lista" role="list"></div>
        <div class="asis-guardar">
          <span id="asis-resumen" class="asis-resumen"></span>
          <button type="button" id="asis-btn-guardar" class="btn btn-gold" onclick="AsistenciasModulo.guardarAsistenciaLote()">Guardar asistencia</button>
        </div>
      </div>

      <div class="asis-panel">
        <div class="asis-hist-cab">
          <h4>Días cargados</h4>
          <div class="asis-planilla">
            <label for="asis-mes" class="sr-only">Mes</label>
            <input type="month" id="asis-mes" class="form-control" value="${mesActual}">
            <button type="button" class="btn btn-primary" onclick="AsistenciasModulo.descargarPlanilla()">Planilla del mes (Excel)</button>
          </div>
        </div>
        <div id="asis-historial"></div>
      </div>`;
    this.dibujarHistorial();
  },

  // % de asistencia acumulado de cada alumno (todas las fechas y módulos)
  porcentajes() {
    const out = {};
    this.alumnos.forEach(a => {
      const r = this.historial.filter(h => String(h.estudiante_user) === a.dni);
      out[a.dni] = r.length ? Math.round(r.filter(h => ReglasFP.esPresente(h.estado)).length / r.length * 100) : null;
    });
    return out;
  },

  cargarFecha() {
    const fecha = document.getElementById('asistencia-fecha')?.value;
    const mod = document.getElementById('asistencia-modulo-id')?.value;
    const regs = this.historial.filter(h => String(h.fecha).slice(0, 10) === fecha && this.mismoModulo(h.modulo_id, mod));
    this.cargadoPrevio = regs.length > 0;
    this.estados = {};
    this.alumnos.forEach(a => {
      const r = regs.find(h => String(h.estudiante_user) === a.dni);
      this.estados[a.dni] = r ? String(r.estado).toLowerCase() : 'presente';
    });
    const info = document.getElementById('asis-estado-dia');
    if (info) {
      info.className = 'asis-estado-dia ' + (this.cargadoPrevio ? 'editando' : 'nuevo');
      info.innerHTML = this.cargadoPrevio
        ? `Este día ya está cargado (${this.fechaAR(fecha)} · ${this.esc(this.nombreModulo(mod))}). Estás <strong>corrigiendo</strong> lo registrado.`
        : `Día nuevo: ${this.fechaAR(fecha)} · ${this.esc(this.nombreModulo(mod))}. Todos empiezan como presentes.`;
    }
    this.dibujarLista();
  },

  dibujarLista() {
    const lista = document.getElementById('asis-lista');
    if (!lista) return;
    const pcts = this.porcentajes();
    lista.innerHTML = this.alumnos.map((a, i) => {
      const est = this.estados[a.dni] || 'presente';
      const p = pcts[a.dni];
      const cls = p === null ? '' : (p < 70 ? 'bajo' : 'ok');
      return `
        <div class="asis-fila" role="listitem">
          <span class="asis-num">${i + 1}</span>
          <div class="asis-alumno"><strong>${this.esc(a.nombre)}</strong><span>DNI ${this.esc(a.dni)}${p !== null ? ` · <em class="asis-pct ${cls}">${p}% asistencia</em>` : ''}</span></div>
          <div class="asis-botones" role="radiogroup" aria-label="Asistencia de ${this.esc(a.nombre)}">
            ${this.ESTADOS.map(s => `<button type="button" role="radio" aria-checked="${est === s.k}" title="${s.t}" class="asis-b asis-${s.k} ${est === s.k ? 'activo' : ''}" onclick="AsistenciasModulo.marcar('${this.esc(a.dni)}','${s.k}')">${s.l}</button>`).join('')}
          </div>
        </div>`;
    }).join('');
    this.actualizarResumen();
  },

  marcar(dni, estado) {
    this.estados[String(dni)] = estado;
    this.dibujarLista();
  },

  marcarTodos(estado) {
    this.alumnos.forEach(a => { this.estados[a.dni] = estado; });
    this.dibujarLista();
  },

  actualizarResumen() {
    const vals = Object.values(this.estados);
    const c = k => vals.filter(v => v === k).length;
    const el = document.getElementById('asis-resumen');
    if (el) el.textContent = `${c('presente')} presentes · ${c('tarde')} tarde · ${c('ausente')} ausentes · ${c('justificado')} justificados`;
  },

  async guardarAsistenciaLote() {
    const fecha = document.getElementById('asistencia-fecha')?.value;
    const modVal = document.getElementById('asistencia-modulo-id')?.value;
    const modulo = modVal ? Number(modVal) : null;
    if (!fecha) { alert('⚠️ Por favor elegí la fecha de la clase.'); return; }
    if (fecha > this.hoy()) {
      if (!confirm('La fecha elegida es posterior a hoy. ¿Guardar igual?')) return;
    }
    const registros = this.alumnos.map(a => ({ estudiante_user: a.dni, estado: this.estados[a.dni] || 'presente' }));
    const btn = document.getElementById('asis-btn-guardar');
    if (btn) btn.disabled = true;

    try {
      const { error } = await supabase.rpc('guardar_asistencia', {
        p_trayecto: this.trayectoActualId, p_modulo: modulo, p_fecha: fecha, p_registros: registros
      });
      if (error) {
        // Si todavía no se ejecutó el SQL 07, se guarda igual pero solo para esta fecha + módulo
        const faltaFuncion = /guardar_asistencia|function|PGRST202|42883/i.test(error.message || '') || error.code === 'PGRST202';
        if (!faltaFuncion) throw error;
        let q = supabase.from('asistencias').delete().eq('trayecto_id', this.trayectoActualId).eq('fecha', fecha);
        q = modulo === null ? q.is('modulo_id', null) : q.eq('modulo_id', modulo);
        const { error: e1 } = await q;
        if (e1) throw e1;
        const filas = registros.map(r => ({ trayecto_id: this.trayectoActualId, modulo_id: modulo, fecha, estudiante_user: r.estudiante_user, estado: r.estado === 'tarde' ? 'presente' : r.estado }));
        const { error: e2 } = await supabase.from('asistencias').insert(filas);
        if (e2) throw e2;
        console.warn('Falta ejecutar sql/07_asistencia_y_equivalencias.sql (se guardó "tarde" como presente).');
      }
      if (typeof Swal !== 'undefined') {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Asistencia guardada (${this.fechaAR(fecha)})`, showConfirmButton: false, timer: 2200 });
      }
      const { data } = await supabase.from('asistencias').select('*').eq('trayecto_id', this.trayectoActualId).order('fecha', { ascending: false });
      this.historial = data || [];
      this.dibujarHistorial();
      this.cargarFecha();
    } catch (err) {
      console.error('Guardar asistencia:', err);
      alert('Error al guardar la asistencia: ' + (err.message || 'error de conexión'));
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  // Agrupa por fecha + módulo
  dias() {
    const mapa = {};
    this.historial.forEach(h => {
      const mod = (h.modulo_id === null || h.modulo_id === undefined) ? '' : String(h.modulo_id);
      const k = String(h.fecha).slice(0, 10) + '|' + mod;
      if (!mapa[k]) mapa[k] = { fecha: String(h.fecha).slice(0, 10), modulo: mod, p: 0, t: 0, a: 0, j: 0, total: 0 };
      const e = String(h.estado).toLowerCase();
      mapa[k].total++;
      if (e === 'presente') mapa[k].p++;
      else if (e === 'tarde') mapa[k].t++;
      else if (e === 'justificado') mapa[k].j++;
      else mapa[k].a++;
    });
    return Object.values(mapa).sort((x, y) => y.fecha.localeCompare(x.fecha));
  },

  dibujarHistorial() {
    const el = document.getElementById('asis-historial');
    if (!el) return;
    const dias = this.dias();
    if (!dias.length) { el.innerHTML = '<p class="asis-vacio">Todavía no se cargó asistencia en este trayecto.</p>'; return; }
    el.innerHTML = `<div class="asis-hist">${dias.map(d => {
      const pct = Math.round((d.p + d.t) / d.total * 100);
      return `<button type="button" class="asis-dia" onclick="AsistenciasModulo.abrirDia('${d.fecha}','${d.modulo}')" title="Abrir para corregir">
        <strong>${this.fechaAR(d.fecha)}</strong>
        <span class="asis-dia-mod">${this.esc(this.nombreModulo(d.modulo))}</span>
        <span class="asis-dia-cnt">${d.p + d.t}/${d.total} presentes · ${pct}%</span>
      </button>`;
    }).join('')}</div>`;
  },

  abrirDia(fecha, modulo) {
    const f = document.getElementById('asistencia-fecha');
    const m = document.getElementById('asistencia-modulo-id');
    if (f) f.value = fecha;
    if (m) m.value = modulo || '';
    this.cargarFecha();
    document.getElementById('asis-lista')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  async descargarPlanilla() {
    if (typeof ExcelJS === 'undefined') { alert('No se pudo cargar el generador de Excel. Recargá la página.'); return; }
    const mes = document.getElementById('asis-mes')?.value || this.hoy().slice(0, 7);
    const dias = this.dias().filter(d => d.fecha.startsWith(mes)).sort((x, y) => x.fecha.localeCompare(y.fecha) || x.modulo.localeCompare(y.modulo));
    if (!dias.length) { alert('⚠️ No hay asistencia cargada en ese mes.'); return; }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Asistencia', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    const [anio, m] = mes.split('-');
    const nombreMes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][Number(m) - 1];
    const variosModulos = new Set(dias.map(d => d.modulo)).size > 1;
    const ultima = 3 + dias.length + 2;

    ws.mergeCells(1, 1, 1, ultima);
    ws.getCell(1, 1).value = `CFP N.º 403 "Oscar Smith" · Registro de asistencia · ${nombreMes} ${anio}`;
    ws.getCell(1, 1).font = { bold: true, size: 13 };
    ws.mergeCells(2, 1, 2, ultima);
    ws.getCell(2, 1).value = `Trayecto: ${this.trayecto.nombre || ''}${this.trayecto.certificacion_oficial ? ' · Curso N.º ' + this.trayecto.certificacion_oficial : ''}   ·   P presente · T tarde · A ausente · J justificado`;
    ws.getCell(2, 1).font = { size: 10 };

    const cab = ['N.º', 'Apellido y nombre', 'DNI', ...dias.map(d => {
      const dd = d.fecha.slice(8, 10) + '/' + d.fecha.slice(5, 7);
      if (!variosModulos) return dd;
      const mod = this.modulos.find(x => String(x.id) === d.modulo);
      return dd + '\n' + (mod ? mod.nombre.slice(0, 14) : 'Gral.');
    }), 'Asistió', '%'];
    const filaCab = ws.addRow([]);
    ws.addRow(cab);
    const hr = ws.getRow(4);
    hr.font = { bold: true, size: 9 };
    hr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    hr.height = variosModulos ? 30 : 18;
    filaCab.height = 4;

    const L = { presente: 'P', tarde: 'T', ausente: 'A', justificado: 'J' };
    this.alumnos.forEach((a, i) => {
      const celdas = dias.map(d => {
        const r = this.historial.find(h => String(h.estudiante_user) === a.dni && String(h.fecha).slice(0, 10) === d.fecha && this.mismoModulo(h.modulo_id, d.modulo));
        return r ? (L[String(r.estado).toLowerCase()] || '') : '';
      });
      const tomadas = celdas.filter(c => c).length;
      const asistio = celdas.filter(c => c === 'P' || c === 'T').length;
      const row = ws.addRow([i + 1, a.nombre, a.dni, ...celdas, asistio, tomadas ? Math.round(asistio / tomadas * 100) / 100 : '']);
      row.getCell(cab.length).numFmt = '0%';
      row.alignment = { vertical: 'middle' };
      for (let c = 4; c <= cab.length; c++) row.getCell(c).alignment = { horizontal: 'center' };
      celdas.forEach((v, k) => {
        if (v === 'A' || v === 'J') row.getCell(4 + k).font = { color: { argb: 'FFB42318' }, bold: true };
      });
    });

    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 34;
    ws.getColumn(3).width = 12;
    for (let c = 4; c < 4 + dias.length; c++) ws.getColumn(c).width = variosModulos ? 9 : 6;
    ws.getColumn(cab.length - 1).width = 8;
    ws.getColumn(cab.length).width = 7;
    const borde = { style: 'thin', color: { argb: 'FFBFC8D6' } };
    for (let r = 4; r <= ws.rowCount; r++) {
      for (let c = 1; c <= cab.length; c++) ws.getCell(r, c).border = { top: borde, left: borde, bottom: borde, right: borde };
    }
    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];

    const buf = await wb.xlsx.writeBuffer();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    link.download = `Asistencia_${String(this.trayecto.nombre || 'trayecto').replace(/[^\wÁÉÍÓÚÑáéíóúñ]+/g, '_')}_${mes}.xlsx`;
    link.click();
  }
};

window.AsistenciasModulo = AsistenciasModulo;
