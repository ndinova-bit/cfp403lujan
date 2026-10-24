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
    let fechaExamen = null, instancia = null, asignatura = null;
    if (tipo === 'examen') {
      // Módulos del trayecto (si se pueden leer) para sugerir la asignatura
      let mods = [];
      try { const r = await supabase.from('modulos').select('nombre').eq('trayecto_id', f.trayecto_id).order('id'); mods = (r.data || []).map(m => m.nombre); } catch (e) { /* opcional */ }
      const r = await Swal.fire({
        title: 'Datos del examen',
        html: `<div style="text-align:left;display:grid;gap:.5rem">
          <small>${this.esc(f.apellido)}, ${this.esc(f.nombre)} · ${this.esc(f.trayecto)}</small>
          <label>Fecha del examen<input id="ce-fecha" type="date" class="swal2-input" style="margin:.2rem 0 0;width:100%"></label>
          <label>Asignatura / módulo<input id="ce-asig" class="swal2-input" list="ce-mods" style="margin:.2rem 0 0;width:100%" placeholder="Opcional" maxlength="160"><datalist id="ce-mods">${mods.map(m => `<option value="${this.esc(m)}">`).join('')}</datalist></label></div>`,
        showCancelButton: true, confirmButtonText: 'Generar PDF', cancelButtonText: 'Volver',
        preConfirm: () => {
          const fe = document.getElementById('ce-fecha').value;
          if (!fe) { Swal.showValidationMessage('Elegí la fecha del examen'); return false; }
          return { fe, asig: document.getElementById('ce-asig').value.trim() };
        }
      });
      if (!r.isConfirmed) { this.abrir(); setTimeout(() => { const q = document.getElementById('cons-q'); if (q) { q.value = f.dni; this.buscar(); } }, 50); return; }
      fechaExamen = r.value.fe; asignatura = r.value.asig || null;
    }
    try {
      const bytes = await this.armarPDF(tipo, f, { fechaExamen, instancia, asignatura });
      const { error } = await supabase.rpc('registrar_constancia', { p_tipo: tipo, p_dni: f.dni, p_trayecto: f.trayecto_id, p_fecha: fechaExamen, p_instancia: instancia, p_asignatura: asignatura });
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

  CFG: {
    direccion: 'DIRECCIÓN PROVINCIAL DE ETP Y FP',
    nombre: 'CENTRO DE FORMACIÓN PROFESIONAL N.º 403',
    apodo: '«Oscar Smith»',
    domicilio: 'Lavalle 740 · Luján · Buenos Aires',
    contacto: 'Tel. 02323 - 438133  ·  WhatsApp 2323 643809',
    ciudad: 'Luján'
  },
  DIAS: [['L', 'Lunes'], ['M', 'Martes'], ['X', 'Miércoles'], ['J', 'Jueves'], ['V', 'Viernes'], ['S', 'Sábado']],

  async armarPDF(tipo, f, op = {}) {
    const doc = await PDFLib.PDFDocument.create();
    const pag = doc.addPage([595.28, 841.89]);               // A4
    const reg = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const neg = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const cur = await doc.embedFont(PDFLib.StandardFonts.HelveticaOblique);
    const rgb = PDFLib.rgb;
    const AZUL = rgb(7 / 255, 27 / 255, 56 / 255), ORO = rgb(0.96, 0.72, 0.10), GRIS = rgb(0.38, 0.42, 0.5), FONDO = rgb(0.95, 0.96, 0.98), NEGRO = rgb(0.1, 0.12, 0.16);
    const W = 595.28, M = 56, ANCHO = W - 2 * M;
    const txt = (t, x, y, size = 11, font = reg, color = NEGRO) => pag.drawText(t, { x, y, size, font, color });
    const cen = (t, y, size, font, color = NEGRO) => txt(t, (W - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color);
    const der = (t, y, size, font, color = NEGRO) => txt(t, W - M - font.widthOfTextAtSize(t, size), y, size, font, color);

    // Franja superior y pie
    pag.drawRectangle({ x: 0, y: 826, width: W, height: 16, color: AZUL });
    pag.drawRectangle({ x: 0, y: 822, width: W, height: 4, color: ORO });
    pag.drawRectangle({ x: 0, y: 0, width: W, height: 44, color: AZUL });
    pag.drawRectangle({ x: 0, y: 44, width: W, height: 3, color: ORO });
    cen(this.CFG.domicilio, 26, 9.5, reg, rgb(1, 1, 1));
    cen(this.CFG.contacto, 13, 9.5, reg, rgb(1, 1, 1));

    // Encabezado
    const [logoCfp, logoDg] = await Promise.all([this.imagen(doc, 'img/logo-cfp-ficha.png'), this.imagen(doc, 'img/logo-dgcye.png')]);
    if (logoCfp) { const d = logoCfp.scaleToFit(84, 84); pag.drawImage(logoCfp, { x: M, y: 730, width: d.width, height: d.height }); }
    txt(this.CFG.direccion, 156, 790, 8.5, neg, GRIS);
    txt(this.CFG.nombre, 156, 770, 14, neg, AZUL);
    txt(this.CFG.apodo, 156, 750, 14, neg, AZUL);
    if (logoDg) { const d = logoDg.scaleToFit(80, 40); pag.drawImage(logoDg, { x: W - M - d.width, y: 782, width: d.width, height: d.height }); }
    pag.drawLine({ start: { x: M, y: 718 }, end: { x: W - M, y: 718 }, thickness: 0.6, color: rgb(0.8, 0.83, 0.88) });

    // Título
    const titulo = tipo === 'regular' ? 'CONSTANCIA DE ALUMNO REGULAR' : 'CONSTANCIA DE ASISTENCIA A EXÁMENES';
    cen(titulo, 676, 17, neg, AZUL);
    pag.drawRectangle({ x: (W - 60) / 2, y: 664, width: 60, height: 3, color: ORO });
    der(`${this.CFG.ciudad}, ${this.fechaLarga(new Date())}`, 638, 10.5, cur, GRIS);

    // Cuerpo
    let y = 606;
    const parrafo = (t, size = 11.5) => { this.renglones(t, reg, size, ANCHO).forEach(l => { txt(l, M, y, size, reg); y -= 18; }); y -= 6; };
    parrafo(`Por la presente, el Centro de Formación Profesional N.º 403 «Oscar Smith» de ${this.CFG.ciudad} deja constancia de que:`);

    const nombre = `${f.apellido}, ${f.nombre}`.trim();
    const filas = [['Estudiante', nombre], ['D.N.I.', this.dniPuntos(f.dni)], ['Trayecto formativo', f.trayecto], ['Ciclo lectivo', String(f.ciclo || new Date().getFullYear())]];
    const altoCard = filas.length * 22 + 14;
    pag.drawRectangle({ x: M, y: y - altoCard + 8, width: ANCHO, height: altoCard, color: FONDO });
    pag.drawRectangle({ x: M, y: y - altoCard + 8, width: 4, height: altoCard, color: ORO });
    let yy = y - 14;
    filas.forEach(([k, v]) => {
      txt(k, M + 18, yy, 9.5, neg, GRIS);
      const lineas = this.renglones(String(v), neg, 11.5, ANCHO - 150);
      txt(lineas[0] || '', M + 140, yy, 11.5, neg, NEGRO);
      yy -= 22;
    });
    y = y - altoCard - 10;

    if (tipo === 'regular') {
      parrafo('es alumno/a regular de este establecimiento y cursa en los siguientes días y horarios:');
      const hd = f.horario_dias || {};
      const dias = this.DIAS.filter(([k]) => hd[k]);
      if (dias.length) {
        dias.forEach(([k, n]) => {
          txt(n, M + 18, y, 11, neg, AZUL);
          txt(String(hd[k]).toLowerCase().replace(' a ', ' a ') + ' hs', M + 110, y, 11, reg);
          y -= 17;
        });
        y -= 8;
      }
    } else {
      const asig = op.asignatura ? `, correspondiente a la asignatura «${op.asignatura}»` : '';
      parrafo(`asistió y rindió examen el día ${this.fechaDesdeISO(op.fechaExamen)}${asig}.`);
    }
    parrafo('A pedido del/de la interesado/a y para ser presentada ante quien corresponda, se extiende la presente constancia en la ciudad de ' + this.CFG.ciudad + ', Provincia de Buenos Aires.');

    // Sello y firmas
    const yf = 170;
    const firma = (cx, etiqueta, ancho = 150) => {
      pag.drawLine({ start: { x: cx - ancho / 2, y: yf }, end: { x: cx + ancho / 2, y: yf }, thickness: 0.7, color: NEGRO });
      txt(etiqueta, cx - reg.widthOfTextAtSize(etiqueta, 9) / 2, yf - 13, 9, reg, GRIS);
    };
    if (tipo === 'regular') {
      pag.drawRectangle({ x: M, y: yf - 6, width: 120, height: 78, borderColor: rgb(0.75, 0.78, 0.84), borderWidth: 0.8, borderDashArray: [3, 3] });
      txt('Sello del establecimiento', M + 10, yf - 22, 9, reg, GRIS);
      firma(W - M - 85, 'Firma y sello · Director/a o Secretario/a', 170);
    } else {
      firma(M + 70, 'Firma y aclaración del Profesor/a', 140);
      pag.drawRectangle({ x: W / 2 - 50, y: yf - 6, width: 100, height: 78, borderColor: rgb(0.75, 0.78, 0.84), borderWidth: 0.8, borderDashArray: [3, 3] });
      txt('Sello', W / 2 - reg.widthOfTextAtSize('Sello', 9) / 2, yf - 22, 9, reg, GRIS);
      firma(W - M - 70, 'Firma y sello · Director/a o Secretario/a', 140);
    }
    return await doc.save();
  }
};
window.ConstanciasModulo = ConstanciasModulo;
