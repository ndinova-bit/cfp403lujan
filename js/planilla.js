/* ==========================================================================
   PLANILLA DE INFORMACIÓN BÁSICA — MATRÍCULA MENSUAL (POF / POFA)
   Se arma sola con los datos de los trayectos del ciclo lectivo elegido
   (fechas, horarios, horas, docente, matrícula de cada mes y aprobados) y se
   descarga en Excel con el mismo formato de la planilla oficial.
   Solo para descargar: no se edita en la plataforma.
   Archivo: js/planilla.js
   ========================================================================== */

const PlanillaMatricula = {
  SEDE_DIRECCION: 'LAVALLE 740',          // lugar que figura para los trayectos dictados en la sede
  DIAS: ['L', 'M', 'X', 'J', 'V', 'S'],   // lunes a sábado
  MESES: [[3, 31], [4, 30], [5, 31], [6, 30], [7, 31], [8, 31], [9, 30], [10, 31], [11, 30], [12, 31]],

  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  /* ---------- Ventana para elegir el ciclo ---------- */
  async abrir() {
    if (typeof Swal === 'undefined') { this.descargar(new Date().getFullYear()); return; }
    const anio = new Date().getFullYear();
    const r = await Swal.fire({
      title: 'Planilla de matrícula (POF / POFA)',
      html: `<p style="margin:0 0 .8rem;font-size:.9rem">Se completa sola con los trayectos, fechas, horarios y matrícula del ciclo que elijas.</p>
        <label for="plm-ciclo" style="display:block;font-weight:700;font-size:.8rem;margin-bottom:.25rem">Ciclo lectivo</label>
        <select id="plm-ciclo" class="swal2-select" style="width:100%;margin:0">
          ${[anio + 1, anio, anio - 1, anio - 2].map(c => `<option value="${c}" ${c === anio ? 'selected' : ''}>${c}</option>`).join('')}
        </select>`,
      showCancelButton: true, confirmButtonText: 'Descargar Excel', cancelButtonText: 'Cancelar', focusConfirm: false,
      preConfirm: () => Number(document.getElementById('plm-ciclo').value)
    });
    if (r.isConfirmed) this.descargar(r.value);
  },

  /* ---------- Datos ---------- */
  async cargarDatos(ciclo) {
    const { data, error } = await supabase.rpc('planilla_matricula', { p_ciclo: Number(ciclo) });
    if (error) throw error;
    const filas = Array.isArray(data) ? data : [];
    const num = f => { const n = parseInt(String(f.nro || '').replace(/\D/g, ''), 10); return isNaN(n) ? Infinity : n; };
    filas.sort((a, b) => (num(a) - num(b)) || String(a.inicio || '9').localeCompare(String(b.inicio || '9')) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
    return filas;
  },

  fechaExcel(s) {
    if (!s) return null;
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return y ? new Date(Date.UTC(y, m - 1, d)) : null;
  },

  // Horas cátedra por semana: se calculan con los horarios de cada día (módulos de 40 minutos)
  horasSemanales(dias) {
    if (!dias) return null;
    let min = 0;
    this.DIAS.forEach(k => {
      const m = String(dias[k] || '').match(/(\d{1,2}):(\d{2})\s*A\s*(\d{1,2}):(\d{2})/i);
      if (m) min += (Number(m[3]) * 60 + Number(m[4])) - (Number(m[1]) * 60 + Number(m[2]));
    });
    return min > 0 ? Math.round(min / 40) : null;
  },

  // Estudiantes sin género cargado (no se pueden ubicar en V / M / +)
  sinGenero(filas) {
    let n = 0, trayectos = 0;
    filas.forEach(f => {
      const s = Math.max((f.inscriptos && f.inscriptos.s) || 0, (f.mat_inicio && f.mat_inicio.s) || 0, ...((f.meses || []).map(m => (m && m.s) || 0)));
      if (s) { n += s; trayectos++; }
    });
    return { n, trayectos };
  },

  /* ---------- Descarga ---------- */
  async descargar(ciclo) {
    if (typeof ExcelJS === 'undefined') { alert('No se pudo cargar el generador de Excel. Recargá la página.'); return; }
    try {
      if (typeof Swal !== 'undefined') Swal.fire({ title: 'Armando la planilla…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const filas = await this.cargarDatos(ciclo);
      if (typeof Swal !== 'undefined') Swal.close();
      if (!filas.length) { alert(`No hay trayectos cargados en el ciclo ${ciclo}.`); return; }

      const sg = this.sinGenero(filas);
      if (sg.n && typeof Swal !== 'undefined') {
        const r = await Swal.fire({
          icon: 'warning', title: 'Faltan datos de género',
          html: `<p style="font-size:.9rem">Hay <b>${sg.n}</b> estudiante(s) en ${sg.trayectos} trayecto(s) sin el género cargado. En la planilla no figuran en V / M / +.</p>
                 <p style="font-size:.85rem;color:#555">Se completa en la ficha del estudiante o con la columna <i>género</i> del CSV.</p>`,
          showCancelButton: true, confirmButtonText: 'Descargar igual', cancelButtonText: 'Cancelar'
        });
        if (!r.isConfirmed) return;
      }

      const buf = await this.armarExcel(ciclo, filas);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = `${ciclo}_POF_POFA_MATRICULA.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) {
      if (typeof Swal !== 'undefined') Swal.close();
      console.error('Planilla de matrícula:', err);
      const falta = /planilla_matricula|function|column/i.test(err.message || '');
      alert('No se pudo armar la planilla.' + (falta ? '\n\nFalta ejecutar sql/15_planilla_matricula.sql en Supabase.' : '\n\n' + (err.message || '')));
    }
  },

  /* ---------- Excel con el formato de la planilla oficial ---------- */
  async armarExcel(ciclo, filas) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Matr. Mensual', {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 2, showGridLines: false }],
      pageSetup: { paperSize: 5, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    const AZUL = 'FF92CDDC', ROJO = 'FF953734', NARANJA = 'FFE36C09', TEAL = 'FF205867', VERDE = 'FFC2D69B', AMARILLO = 'FFFFFF00';
    const NEGRO = 'FF000000', BLANCO = 'FFFFFFFF';
    const lado = { style: 'thin', color: { argb: NEGRO } };
    const caja = { top: lado, left: lado, bottom: lado, right: lado };
    const relleno = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
    const colorTexto = c => ([ROJO, NARANJA, TEAL].includes(c) ? BLANCO : NEGRO);

    // Anchos (columnas del formato oficial)
    const anchos = { 1: 8, 2: 32.9, 3: 24.1, 4: 24.9, 5: 4.9, 6: 4.9, 7: 4.9, 8: 5, 9: 5, 10: 4.9, 11: 6.4, 12: 6.4, 13: 4.9, 14: 9.1, 15: 9.3, 61: 5.6, 64: 4.1, 65: 4, 66: 4.6, 67: 6.6, 68: 16.1 };
    for (let c = 1; c <= 68; c++) ws.getColumn(c).width = anchos[c] || 4.3;

    const celda = (r, c, valor, o = {}) => {
      const x = ws.getCell(r, c);
      if (valor !== undefined && valor !== null) x.value = valor;
      const fondo = o.fondo || null;
      x.font = { name: 'Arial', size: o.size || 9, bold: !!o.bold, color: { argb: o.color || (fondo ? colorTexto(fondo) : NEGRO) } };
      if (fondo) x.fill = relleno(fondo);
      x.alignment = { horizontal: o.h || 'center', vertical: 'middle', wrapText: o.wrap !== false, textRotation: o.rot || 0 };
      x.border = caja;
      if (o.fmt) x.numFmt = o.fmt;
      return x;
    };
    const unir = (r1, c1, r2, c2) => { ws.mergeCells(r1, c1, r2, c2); };

    /* ----- Encabezado (filas 1 y 2) ----- */
    ws.getRow(1).height = 30.75; ws.getRow(2).height = 20.25;
    const cab = [[1, 'N° Curso'], [2, 'ESPECIALIDAD'], [3, 'LUGAR (Entidad y dirección)'], [4, 'Instructor/a (Solo seleccionar)']];
    cab.forEach(([c, t]) => { celda(1, c, t, { fondo: AZUL, bold: true }); celda(2, c, null, { fondo: AZUL }); unir(1, c, 2, c); });
    for (let c = 5; c <= 10; c++) celda(1, c, c === 5 ? 'HORARIO DEL TRAYECTO FORMATIVO' : null, { fondo: AZUL, bold: true });
    unir(1, 5, 1, 10);
    ['L', 'M', 'M', 'J', 'V', 'S'].forEach((d, i) => celda(2, 5 + i, d, { fondo: AZUL, bold: true }));
    [[11, 'Dur. Hs cátedra', AZUL], [12, 'Dur. Hs reloj', AZUL], [13, 'hs. Sem.', TEAL]].forEach(([c, t, f]) => {
      celda(1, c, t, { fondo: f, bold: true, rot: 90 }); celda(2, c, null, { fondo: f, rot: 90 }); unir(1, c, 2, c);
    });
    [[14, 'F. Inicio'], [15, 'F. Final']].forEach(([c, t]) => { celda(1, c, t, { fondo: AZUL, bold: true }); celda(2, c, null, { fondo: AZUL }); unir(1, c, 2, c); });

    const grupo = (c0, titulo, fondo, simbolos = ['V', 'M', '+', 'Tot.']) => {
      for (let i = 0; i < 4; i++) { celda(1, c0 + i, i === 0 ? titulo : null, { fondo, bold: true }); celda(2, c0 + i, simbolos[i], { fondo, bold: true }); }
      unir(1, c0, 1, c0 + 3);
    };
    grupo(16, 'Cant. Inscriptos', ROJO);
    grupo(20, 'Matricula al 1° día de clases', NARANJA);
    this.MESES.forEach(([m, d], i) => grupo(24 + i * 4, `Matricula al ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`, VERDE));
    grupo(64, 'Cant. Alumnos/as aprobados/as', AMARILLO);
    celda(1, 68, 'Observaciones', { fondo: AZUL, bold: true }); celda(2, 68, null, { fondo: AZUL }); unir(1, 68, 2, 68);
    ws.getCell(1, 24).note = 'Si el curso finalizó debe consignarse "0".';

    /* ----- Un curso por fila ----- */
    const sumas = {};            // columna -> total
    const columnaLetra = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    const ponerGrupo = (r, c0, datos, fondo) => {
      // datos: {v,m,x} | {z:true} | null
      for (let i = 0; i < 4; i++) celda(r, c0 + i, null, { fondo });
      if (!datos) return;
      const v = datos.z ? 0 : Number(datos.v || 0), m = datos.z ? 0 : Number(datos.m || 0), x = datos.z ? 0 : Number(datos.x || 0);
      [v, m, x].forEach((n, i) => { ws.getCell(r, c0 + i).value = n; sumas[c0 + i] = (sumas[c0 + i] || 0) + n; });
      const tot = v + m + x;
      ws.getCell(r, c0 + 3).value = { formula: `SUM(${columnaLetra(c0)}${r}:${columnaLetra(c0 + 2)}${r})`, result: tot };
      sumas[c0 + 3] = (sumas[c0 + 3] || 0) + tot;
    };

    filas.forEach((f, idx) => {
      const r = 3 + idx;
      ws.getRow(r).height = 27;
      const nro = parseInt(String(f.nro || '').replace(/\D/g, ''), 10);
      celda(r, 1, isNaN(nro) ? (f.nro || null) : nro, { fondo: BLANCO });
      celda(r, 2, f.nombre || '', { fondo: BLANCO, h: 'left' });
      celda(r, 3, f.sede === 'fuera' ? (f.lugar || '') : this.SEDE_DIRECCION, { fondo: BLANCO, h: 'left' });
      celda(r, 4, f.docente || '', { fondo: BLANCO, h: 'left' });
      this.DIAS.forEach((d, i) => celda(r, 5 + i, (f.horario_dias && f.horario_dias[d]) || null, { fondo: BLANCO, h: 'left', size: 7 }));
      const reloj = f.horas || null;
      const catedra = f.horas_catedra || (reloj ? Math.round(reloj * 1.5) : null);
      celda(r, 11, catedra, { fondo: BLANCO });
      celda(r, 12, reloj, { fondo: BLANCO });
      celda(r, 13, this.horasSemanales(f.horario_dias), { fondo: TEAL, color: BLANCO });
      celda(r, 14, this.fechaExcel(f.inicio), { fondo: BLANCO, fmt: 'dd/mm/yyyy' });
      celda(r, 15, this.fechaExcel(f.cierre), { fondo: BLANCO, fmt: 'dd/mm/yyyy' });
      ponerGrupo(r, 16, f.inscriptos, ROJO);
      ponerGrupo(r, 20, f.mat_inicio, NARANJA);
      (f.meses || []).forEach((m, i) => ponerGrupo(r, 24 + i * 4, m, VERDE));
      ponerGrupo(r, 64, f.aprobados, AMARILLO);
      celda(r, 68, f.obs || null, { fondo: BLANCO, size: 8 });
    });

    /* ----- Totales ----- */
    const rt = 3 + filas.length;
    ws.getRow(rt).height = 20;
    for (let c = 1; c <= 68; c++) celda(rt, c, null, { bold: true });
    celda(rt, 2, 'TOTALES', { bold: true, h: 'left' });
    for (let c = 16; c <= 67; c++) {
      if (sumas[c] === undefined) continue;
      ws.getCell(rt, c).value = { formula: `SUM(${columnaLetra(c)}3:${columnaLetra(c)}${rt - 1})`, result: sumas[c] };
    }
    ws.getCell(rt + 2, 2).value = `Ciclo lectivo ${ciclo} · CFP N.º 403 «Oscar Smith» · generada desde la plataforma el ${new Date().toLocaleDateString('es-AR')}`;
    ws.getCell(rt + 2, 2).font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF555555' } };

    return await wb.xlsx.writeBuffer();
  }
};

window.PlanillaMatricula = PlanillaMatricula;
