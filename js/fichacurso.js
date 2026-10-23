/* ==========================================================================
   FICHA DE CURSO (Excel) · formato de la planilla del CFP
   Encabezado: Provincia / DGCyE / DFP, logos (CFP 403 y DGCyE), instructor,
   especialidad, acto administrativo, hoja X de Y, localidad, sede, fechas de
   inicio y cierre, horario, tipo, duración, año, código y N.º de curso.
   Nómina: 30 estudiantes por hoja con apellidos, nombres, documento, fecha y
   lugar de nacimiento, domicilio, localidad, código postal, teléfono y estudios.
   Los datos del curso salen de Cargar Trayecto; los del alumno, de su ficha
   (Datos personales) o del CSV de importación.
   ========================================================================== */
const FichaCurso = {
  POR_HOJA: 30,

  async imagenBase64(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const buf = await r.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    } catch (e) { return null; }
  },

  fechaAR(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''; },

  async cargar(tid) {
    const id = Number(tid);
    const [rT, rI, rM] = await Promise.all([
      supabase.from('trayectos').select('*').eq('id', id).single(),
      supabase.from('inscripciones').select('*').eq('trayecto_id', id),
      supabase.from('modulos').select('fecha_inicio, fecha_fin').eq('trayecto_id', id)
    ]);
    if (rT.error || !rT.data) throw new Error('No se encontró el trayecto');
    const t = rT.data;
    const dnis = (rI.data || []).map(i => String(i.estudiante_user));
    let usuarios = [], datos = [], docente = null;
    if (dnis.length) {
      const [rU, rD] = await Promise.all([
        supabase.from('usuarios').select('usuario, dni, nombre, apellido').in('usuario', dnis),
        supabase.from('datos_estudiante').select('*').in('dni', dnis)
      ]);
      usuarios = rU.data || [];
      datos = (!rD.error && rD.data) || [];
    }
    if (t.docente_user) {
      const { data } = await supabase.from('usuarios').select('nombre, apellido').eq('usuario', String(t.docente_user)).maybeSingle();
      docente = data;
    }
    // Fechas del curso: las del trayecto o, si faltan, la primera y última de sus módulos
    const mods = rM.data || [];
    const ini = t.fecha_inicio || mods.map(m => m.fecha_inicio).filter(Boolean).sort()[0] || '';
    const fin = t.fecha_cierre || mods.map(m => m.fecha_fin).filter(Boolean).sort().slice(-1)[0] || '';
    const alumnos = (rI.data || []).map(ins => {
      const k = String(ins.estudiante_user);
      const u = usuarios.find(x => String(x.usuario || x.dni) === k) || {};
      const d = datos.find(x => String(x.dni) === k) || {};
      return { dni: k, apellido: String(u.apellido || '').toUpperCase(), nombre: String(u.nombre || '').toUpperCase(), d, baja: String(ins.estado || '').toUpperCase() === 'BAJA' };
    }).sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'));
    return { t, alumnos, docente, ini, fin };
  },

  async descargar(tid) {
    if (typeof ExcelJS === 'undefined') { alert('No se pudo cargar el generador de Excel. Recargá la página.'); return; }
    try {
      const { t, alumnos, docente, ini, fin } = await this.cargar(tid);
      const [logoCfp, logoDgcye] = await Promise.all([this.imagenBase64('img/logo-cfp-ficha.png'), this.imagenBase64('img/logo-dgcye.png')]);

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Ficha de curso', {
        pageSetup: { paperSize: 5, orientation: 'landscape', fitToPage: false, horizontalCentered: true,
          margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 } }
      });
      // Mismos anchos que la planilla del CFP (columnas A a M)
      [1.3, 4.4, 18.6, 23, 6.1, 12.6, 11.4, 20.7, 28.6, 15.9, 6.7, 12.7, 16].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
      const idCfp = logoCfp ? wb.addImage({ base64: logoCfp, extension: 'png' }) : null;
      const idDg = logoDgcye ? wb.addImage({ base64: logoDgcye, extension: 'png' }) : null;

      const fino = { style: 'thin', color: { argb: 'FF000000' } };
      const caja = { top: fino, left: fino, bottom: fino, right: fino };
      const bordeRango = (r1, c1, r2, c2) => { for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) ws.getCell(r, c).border = caja; };
      const celda = (r, c, valor, estilo = {}) => {
        const x = ws.getCell(r, c);
        x.value = valor;
        x.font = { name: 'Arial', size: estilo.size || 10, bold: !!estilo.bold };
        x.alignment = { vertical: 'middle', horizontal: estilo.h || 'left', wrapText: !!estilo.wrap, shrinkToFit: !!estilo.shrink };
        return x;
      };
      const combinar = (r1, c1, r2, c2) => { if (r2 > r1 || c2 > c1) ws.mergeCells(r1, c1, r2, c2); };

      const docenteTxt = docente ? `${String(docente.apellido || '').toUpperCase()}, ${docente.nombre || ''}`.replace(/^, /, '') : '';
      const sedeTxt = t.sede === 'fuera' ? `Fuera de sede: ${t.lugar_dictado || ''}` : 'Sede: CFP N.º 403';
      const fechasTxt = `Fecha de inicio - Fecha de cierre: ${this.fechaAR(ini) || '……'} - ${this.fechaAR(fin) || '……'}`;
      const paginas = Math.max(1, Math.ceil(alumnos.length / this.POR_HOJA));

      let r0 = 1;
      for (let p = 0; p < paginas; p++) {
        const r = r0 + 1;   // fila 2 de la planilla
        // Columna B-D: Provincia / DGCyE / DFP
        combinar(r, 2, r, 4); celda(r, 2, 'PROVINCIA DE BUENOS AIRES', { h: 'center', size: 9 });
        combinar(r + 1, 2, r + 1, 4); celda(r + 1, 2, 'DIRECCIÓN GENERAL DE CULTURA Y EDUCACIÓN', { h: 'center', size: 9 });
        combinar(r + 2, 2, r + 2, 4); celda(r + 2, 2, 'DIRECCIÓN DE FORMACIÓN PROFESIONAL', { h: 'center', size: 9 });
        // E-G: logos
        combinar(r, 5, r + 2, 7);
        if (idCfp !== null) ws.addImage(idCfp, { tl: { col: 4.15, row: r - 1 + 0.08 }, ext: { width: 46, height: 46 } });
        if (idDg !== null) ws.addImage(idDg, { tl: { col: 5.25, row: r - 1 + 0.35 }, ext: { width: 120, height: 39 } });
        // H: Instructor
        celda(r, 8, 'Instructor:', { h: 'center', size: 10 });
        combinar(r + 1, 8, r + 2, 8); celda(r + 1, 8, docenteTxt, { h: 'center', wrap: true, bold: true, size: 9 });
        // I-J: Especialidad
        combinar(r, 9, r, 10); celda(r, 9, 'Especialidad:', { h: 'center', size: 10 });
        combinar(r + 1, 9, r + 2, 10); celda(r + 1, 9, t.nombre || '', { h: 'center', wrap: true, bold: true, size: 10 });
        // K-M: FICHA DE CURSO / Acto administrativo / Hoja
        combinar(r, 11, r + 1, 13); celda(r, 11, 'FICHA DE CURSO', { h: 'center', bold: true, size: 12 });
        combinar(r + 2, 11, r + 2, 12); celda(r + 2, 11, `Acto administrativo: ${t.acto_administrativo || ''}`, { h: 'center', size: 8, shrink: true });
        celda(r + 2, 13, `Hoja ${p + 1} de ${paginas}`, { h: 'center', size: 8 });
        bordeRango(r, 2, r + 2, 13);

        // Filas 5-6: datos del curso
        const f5 = r + 3, f6 = r + 4;
        combinar(f5, 2, f5, 4); celda(f5, 2, `  Localidad: ${t.localidad || 'Luján'}`);
        combinar(f6, 2, f6, 4); celda(f6, 2, `  ${sedeTxt}`, { shrink: true });
        combinar(f5, 5, f5, 8); celda(f5, 5, fechasTxt, { shrink: true });
        combinar(f6, 5, f6, 8); celda(f6, 5, `Horario: ${t.horario || ''}`, { shrink: true });
        celda(f5, 9, `Tipo: ${t.tipo_certificacion || ''}`, { shrink: true });
        celda(f6, 9, `Duración: ${t.horas || '……'} hs. reloj`);
        celda(f5, 10, 'Año', { h: 'center', bold: true });
        celda(f6, 10, Number(t.ciclo_lectivo) || '', { h: 'center', bold: true });
        celda(f5, 11, 'Código', { h: 'center', size: 8 });
        celda(f6, 11, t.codigo_catalogo || '', { h: 'center', bold: true, size: 9 });
        combinar(f5, 12, f6, 12); celda(f5, 12, 'CURSO N.º', { h: 'center', bold: true });
        combinar(f5, 13, f6, 13); celda(f5, 13, t.certificacion_oficial || t.certificacion || '', { h: 'center', bold: true, size: 12 });
        bordeRango(f5, 2, f6, 13);

        // Filas 7-8: encabezado de la nómina
        const h1 = r + 5, h2 = r + 6;
        const cab = [[2, 'Nº'], [3, 'Apellidos'], [4, 'Nombres'], [7, 'Fecha de nacimiento'], [8, 'Lugar de nacimiento'], [9, 'Domicilio'], [10, 'Localidad'], [11, 'Código Postal'], [12, 'Teléfono'], [13, 'Estudios']];
        cab.forEach(([c, txt]) => { combinar(h1, c, h2, c); celda(h1, c, txt, { h: 'center', wrap: true, size: 9 }); });
        combinar(h1, 5, h1, 6); celda(h1, 5, 'Documento', { h: 'center', size: 9 });
        celda(h2, 5, 'Tipo', { h: 'center', size: 9 });
        celda(h2, 6, 'Número', { h: 'center', size: 9 });
        bordeRango(h1, 2, h2, 13);
        ws.getRow(h1).height = 14; ws.getRow(h2).height = 14;

        // Filas de alumnos (siempre 30 por hoja, como la planilla)
        for (let k = 0; k < this.POR_HOJA; k++) {
          const fr = h2 + 1 + k;
          const a = alumnos[p * this.POR_HOJA + k];
          celda(fr, 2, p * this.POR_HOJA + k + 1, { h: 'left', size: 10 });
          if (a) {
            const d = a.d || {};
            celda(fr, 3, a.apellido, { shrink: true, size: 9 });
            celda(fr, 4, a.nombre + (a.baja ? ' (BAJA)' : ''), { shrink: true, size: 9 });
            celda(fr, 5, d.tipo_documento || 'DNI', { h: 'center', size: 9 });
            celda(fr, 6, /^\d+$/.test(a.dni) ? Number(a.dni) : a.dni, { h: 'center', size: 9 });
            celda(fr, 7, this.fechaAR(d.fecha_nacimiento), { h: 'center', size: 9 });
            celda(fr, 8, d.lugar_nacimiento || '', { shrink: true, size: 9 });
            celda(fr, 9, d.domicilio || '', { shrink: true, size: 9 });
            celda(fr, 10, d.localidad || '', { shrink: true, size: 9 });
            celda(fr, 11, d.codigo_postal || '', { h: 'center', size: 9 });
            celda(fr, 12, d.telefono || '', { shrink: true, size: 9 });
            celda(fr, 13, d.estudios || '', { shrink: true, size: 9 });
            ws.getCell(fr, 6).numFmt = '0';
          }
          ws.getRow(fr).height = 13.5;
        }
        bordeRango(h2 + 1, 2, h2 + this.POR_HOJA, 13);
        ws.getRow(r).height = 16; ws.getRow(r + 1).height = 16; ws.getRow(r + 2).height = 16;
        ws.getRow(f5).height = 16; ws.getRow(f6).height = 16;

        r0 = h2 + this.POR_HOJA + 1;
        if (p < paginas - 1) ws.getRow(r0).addPageBreak();
        r0 += 1;
      }
      ws.pageSetup.printArea = `A1:M${r0}`;
      // Escala para que cada hoja entre en una carilla oficio apaisada
      let anchoPt = 0;
      for (let c = 1; c <= 13; c++) anchoPt += ((ws.getColumn(c).width || 9) * 7 + 5) * 0.75;
      let altoPt = 0;
      for (let k = 1; k < r0; k++) altoPt += (ws.getRow(k).height || 15);
      ws.pageSetup.scale = Math.max(40, Math.min(100, Math.floor(Math.min(965 / anchoPt, 555 / (altoPt / paginas + 8)) * 92)));

      const buf = await wb.xlsx.writeBuffer();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      link.download = `CFP_403_-_${String(t.nombre || 'Trayecto').replace(/[^\wÁÉÍÓÚÑáéíóúñ]+/g, '_')}_-_Ficha_de_Curso.xlsx`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => link.remove(), 3000);
      const sinDatos = alumnos.filter(a => !a.d || !a.d.fecha_nacimiento).length;
      if (sinDatos && typeof Swal !== 'undefined') {
        Swal.fire({ icon: 'info', title: 'Ficha de Curso descargada', html: `${sinDatos} estudiante(s) no tienen cargados sus datos personales.<br>Se completan desde la <b>ficha del alumno</b> (Datos personales) o importando un CSV con esas columnas.` });
      }
    } catch (err) {
      console.error('Ficha de curso:', err);
      alert('No se pudo generar la Ficha de Curso: ' + (err.message || ''));
    }
  }
};
window.FichaCurso = FichaCurso;
