/* ==========================================================================
   CONSTANCIAS (PDF): alumno regular y examen
   Las emiten administración, regencia, preceptoría y secretaría.
   Archivo: js/constancias.js
   ========================================================================== */
const ConstanciasModulo = {
  filas: [],
  MESES: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],

  esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  fechaLarga(d) { return `${d.getDate()} de ${this.MESES[d.getMonth()]} de ${d.getFullYear()}`; },
  fechaDesdeISO(iso) { const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number); return this.fechaLarga(new Date(a, m - 1, d)); },
  dniPuntos(d) { return String(d).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); },

  abrir() {
    Swal.fire({
      title: 'Constancias',
      width: 760,
      showConfirmButton: false,
      showCloseButton: true,
      html: `<div style="text-align:left">
        <div style="display:flex;gap:.5rem">
          <input id="cons-q" class="swal2-input" style="margin:0;flex:1" placeholder="DNI o apellido (mínimo 3 letras)" onkeydown="if(event.key==='Enter')ConstanciasModulo.buscar()">
          <button type="button" class="swal2-confirm swal2-styled" style="margin:0" onclick="ConstanciasModulo.buscar()">Buscar</button>
        </div>
        <div id="cons-res" style="margin-top:.8rem;max-height:340px;overflow:auto;font-size:.9rem"></div></div>`,
      didOpen: () => document.getElementById('cons-q')?.focus()
    });
  },

  async buscar() {
    const q = (document.getElementById('cons-q')?.value || '').trim();
    const cont = document.getElementById('cons-res');
    if (!cont) return;
    if (q.length < 3) { cont.innerHTML = '<p style="color:#94a3b8">Escribí al menos 3 caracteres.</p>'; return; }
    cont.innerHTML = '<p style="color:#94a3b8">Buscando…</p>';
    const { data, error } = await supabase.rpc('buscar_para_constancia', { p_texto: q });
    if (error) {
      cont.innerHTML = `<p style="color:#f87171">No se pudo buscar.${/function|buscar_para_constancia/i.test(error.message || '') ? ' Falta ejecutar <b>sql/18_constancias.sql</b> en Supabase.' : ''}</p>`;
      return;
    }
    this.filas = data || [];
    if (!this.filas.length) { cont.innerHTML = '<p style="color:#94a3b8">No se encontraron estudiantes inscriptos con ese dato.</p>'; return; }
    cont.innerHTML = `<table style="width:100%;border-collapse:collapse">${this.filas.map((f, i) => {
      const baja = f.estado === 'BAJA';
      return `<tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:.45rem"><b>${this.esc(f.apellido)}, ${this.esc(f.nombre)}</b><br><small>DNI ${this.esc(f.dni)} · ${this.esc(f.trayecto)} · ${this.esc(f.ciclo || '')}${baja ? ' · <span style="color:#dc2626">BAJA</span>' : ''}</small></td>
        <td style="padding:.45rem;white-space:nowrap;text-align:right">
          <button type="button" class="swal2-styled" style="margin:0 .2rem;padding:.35rem .6rem;font-size:.8rem" ${baja ? 'disabled title="Está dado de baja"' : ''} onclick="ConstanciasModulo.generar('regular', ${i})">Alumno regular</button>
          <button type="button" class="swal2-styled" style="margin:0;padding:.35rem .6rem;font-size:.8rem;background:#0284c7" onclick="ConstanciasModulo.generar('examen', ${i})">Examen</button>
        </td></tr>`;
    }).join('')}</table>`;
  },

  async generar(tipo, i) {
    const f = this.filas[i];
    if (!f) return;
    if (typeof PDFLib === 'undefined') { alert('No se pudo cargar el generador de PDF. Recargá la página.'); return; }
    let fechaExamen = null;
    if (tipo === 'examen') {
      const r = await Swal.fire({
        title: 'Fecha del examen', input: 'date', inputLabel: `${f.apellido}, ${f.nombre}`,
        showCancelButton: true, confirmButtonText: 'Generar PDF', cancelButtonText: 'Volver',
        inputValidator: v => (v ? null : 'Elegí la fecha del examen')
      });
      if (!r.isConfirmed) { this.abrir(); setTimeout(() => { const q = document.getElementById('cons-q'); if (q) { q.value = f.dni; this.buscar(); } }, 50); return; }
      fechaExamen = r.value;
    }
    try {
      const bytes = await this.armarPDF(tipo, f, fechaExamen);
      const { error } = await supabase.rpc('registrar_constancia', { p_tipo: tipo, p_dni: f.dni, p_trayecto: f.trayecto_id, p_fecha: fechaExamen });
      if (error) console.warn('No se pudo registrar la constancia:', error.message);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      a.download = `Constancia_${tipo === 'regular' ? 'alumno_regular' : 'examen'}_${f.dni}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) {
      console.error('Constancia:', err);
      alert('No se pudo generar la constancia: ' + (err.message || err));
    }
  },

  async imagen(doc, url) {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const b = await r.arrayBuffer();
      return url.endsWith('.png') ? await doc.embedPng(b) : await doc.embedJpg(b);
    } catch (e) { return null; }
  },

  renglones(texto, fuente, size, ancho) {
    const out = []; let linea = '';
    texto.split(/\s+/).forEach(p => {
      const prueba = linea ? linea + ' ' + p : p;
      if (fuente.widthOfTextAtSize(prueba, size) > ancho && linea) { out.push(linea); linea = p; } else linea = prueba;
    });
    if (linea) out.push(linea);
    return out;
  },

  async armarPDF(tipo, f, fechaExamen) {
    const doc = await PDFLib.PDFDocument.create();
    const pag = doc.addPage([595.28, 841.89]);               // A4
    const reg = await doc.embedFont(PDFLib.StandardFonts.TimesRoman);
    const neg = await doc.embedFont(PDFLib.StandardFonts.TimesRomanBold);
    const hel = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const negro = PDFLib.rgb(0, 0, 0);
    const W = 595.28, M = 70;

    // Membrete
    const [logoCfp, logoDg] = await Promise.all([this.imagen(doc, 'img/logo-cfp-ficha.png'), this.imagen(doc, 'img/logo-dgcye.png')]);
    if (logoCfp) { const d = logoCfp.scaleToFit(70, 70); pag.drawImage(logoCfp, { x: M, y: 740, width: d.width, height: d.height }); }
    if (logoDg) { const d = logoDg.scaleToFit(85, 50); pag.drawImage(logoDg, { x: W - M - d.width, y: 745, width: d.width, height: d.height }); }
    const centrado = (t, y, fuente, size) => pag.drawText(t, { x: (W - fuente.widthOfTextAtSize(t, size)) / 2, y, size, font: fuente, color: negro });
    centrado('Dirección General de Cultura y Educación', 775, hel, 10);
    centrado('Centro de Formación Profesional N.º 403 «Oscar Smith»', 760, neg, 11);
    centrado('Luján · Provincia de Buenos Aires', 746, hel, 10);
    pag.drawLine({ start: { x: M, y: 722 }, end: { x: W - M, y: 722 }, thickness: 0.8, color: negro });

    // Título
    const titulo = tipo === 'regular' ? 'CONSTANCIA DE ALUMNO REGULAR' : 'CONSTANCIA DE EXAMEN';
    centrado(titulo, 660, neg, 16);

    // Cuerpo
    const nombre = `${f.nombre} ${f.apellido}`.trim().toUpperCase();
    const dni = this.dniPuntos(f.dni);
    const res = f.resolucion ? ` (${f.resolucion})` : '';
    const cuerpo = tipo === 'regular'
      ? `Se deja constancia de que ${nombre}, D.N.I. N.º ${dni}, es alumno/a regular del trayecto formativo «${f.trayecto}»${res}, correspondiente al ciclo lectivo ${f.ciclo || new Date().getFullYear()}, que se dicta en este Centro de Formación Profesional.`
      : `Se deja constancia de que ${nombre}, D.N.I. N.º ${dni}, alumno/a del trayecto formativo «${f.trayecto}»${res}, ciclo lectivo ${f.ciclo || new Date().getFullYear()}, debe rendir examen en este Centro de Formación Profesional el día ${this.fechaDesdeISO(fechaExamen)}.`;
    const cierre = 'Se extiende la presente a pedido del/de la interesado/a, para ser presentada ante quien corresponda.';
    let y = 600;
    [cuerpo, cierre].forEach(p => {
      this.renglones(p, reg, 13, W - 2 * M).forEach(l => { pag.drawText(l, { x: M, y, size: 13, font: reg, color: negro }); y -= 22; });
      y -= 12;
    });

    // Fecha de emisión y firma
    const hoy = new Date();
    pag.drawText(`Luján, ${this.fechaLarga(hoy)}.`, { x: M, y: y - 10, size: 13, font: reg, color: negro });
    const yf = 250;
    pag.drawLine({ start: { x: W - M - 190, y: yf }, end: { x: W - M, y: yf }, thickness: 0.7, color: negro });
    const firma = 'Firma y sello';
    pag.drawText(firma, { x: W - M - 95 - reg.widthOfTextAtSize(firma, 11) / 2, y: yf - 14, size: 11, font: reg, color: negro });
    return await doc.save();
  }
};
window.ConstanciasModulo = ConstanciasModulo;
