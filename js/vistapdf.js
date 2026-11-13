/* ==========================================================================
   VISTA PDF · ver en pantalla las planillas que se bajan en Excel
   --------------------------------------------------------------------------
   Toma el libro de Excel (ExcelJS) que ya arma cada módulo y lo dibuja como
   PDF respetando anchos, combinaciones, colores, bordes, tipografía, tamaño de
   papel, orientación, saltos de página, logos y filas de encabezado repetidas.
   Se muestra en una ventana con tres botones:
     · Descargar PDF   · Descargar Excel (solo si hay que modificarla)  · Cerrar
   Así no se baja ningún archivo de más. No se guarda nada en el servidor.
   Usa pdf-lib (ya cargado en index.html) y ExcelJS.
   ========================================================================== */
const VistaPDF = {
  // Tamaños de papel de Excel (paperSize) en puntos, en vertical
  PAPEL: { 1: [612, 792], 5: [612, 1008], 8: [841.89, 1190.55], 9: [595.28, 841.89], 11: [419.53, 595.28] },
  _urls: [],

  /* ---------- Utilidades ---------- */
  _colLetraANum(l) { let n = 0; String(l).toUpperCase().split('').forEach(ch => { n = n * 26 + ch.charCodeAt(0) - 64; }); return n; },
  _ref(s) { const m = String(s).replace(/\$/g, '').match(/^([A-Za-z]+)(\d+)$/); return m ? { c: this._colLetraANum(m[1]), r: Number(m[2]) } : null; },
  _rango(s) {
    const p = String(s || '').split(':'); const a = this._ref(p[0]); const b = this._ref(p[1] || p[0]);
    return a && b ? { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) } : null;
  },
  _rgb(PDFLib, argb, defecto) {
    const m = argb && String(argb).match(/^([0-9a-f]{2})?([0-9a-f]{6})$/i);
    if (!m) return defecto || null;
    const h = m[2];
    return PDFLib.rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
  },
  _b64ABytes(b64) {
    const limpio = String(b64).replace(/^data:[^;]+;base64,/, '');
    const bin = atob(limpio); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  },

  // Texto visible de una celda (aplica formatos simples de número y fecha)
  _texto(cell) {
    let v = cell.value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && !(v instanceof Date)) {
      if (Array.isArray(v.richText)) v = v.richText.map(t => t.text).join('');
      else if ('result' in v) v = v.result;
      else if ('text' in v) v = v.text;
      else if ('error' in v) v = v.error;
      else v = '';
      if (v === null || v === undefined) return '';
      if (typeof v === 'object' && !(v instanceof Date)) return '';
    }
    const fmt = String(cell.numFmt || '');
    if (v instanceof Date) {
      const d = String(v.getUTCDate()).padStart(2, '0'), m = String(v.getUTCMonth() + 1).padStart(2, '0');
      return `${d}/${m}/${v.getUTCFullYear()}`;
    }
    if (typeof v === 'number') {
      if (fmt.includes('%')) { const dec = (fmt.split('.')[1] || '').replace(/[^0]/g, '').length; return (v * 100).toFixed(dec).replace('.', ',') + '%'; }
      if (/^[#,]*0(\.0+)?$/.test(fmt) && fmt.includes('.')) return v.toFixed(fmt.split('.')[1].length).replace('.', ',');
      if (/^0+$/.test(fmt)) return String(Math.round(v));
      return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000).replace('.', ',');
    }
    if (typeof v === 'boolean') return v ? 'VERDADERO' : 'FALSO';
    return String(v);
  },

  /* ---------- Armado del PDF ---------- */
  async armar(wb) {
    const PDFLib = window.PDFLib;
    if (!PDFLib) throw new Error('No se cargó el generador de PDF');
    const pdf = await PDFLib.PDFDocument.create();
    const fN = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    const fB = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const fI = await pdf.embedFont(PDFLib.StandardFonts.HelveticaOblique);
    const fBI = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBoldOblique);
    const cacheOk = new Map();
    const limpiar = (txt, f) => String(txt).replace(/[→✓✔•]/g, m => (m === '•' ? '-' : m === '→' ? '->' : 'v')).split('').map(ch => {
      if (ch === '\n') return ch;
      const k = ch;
      if (cacheOk.has(k)) return cacheOk.get(k) ? ch : '?';
      let ok = true; try { f.widthOfTextAtSize(ch, 1); } catch (e) { ok = false; }
      cacheOk.set(k, ok); return ok ? ch : '?';
    }).join('');

    const K = { PDFLib, fN, fB, fI, fBI, limpiar, imagenes: {}, _pend: [] };
    for (const ws of wb.worksheets) this._hoja(pdf, wb, ws, K);
    await Promise.all(K._pend);
    if (!pdf.getPageCount()) pdf.addPage();
    return await pdf.save();
  },

  _hoja(pdf, wb, ws, K) {
    const { PDFLib, limpiar } = K;
    const ps = ws.pageSetup || {};
    const horizontal = ps.orientation === 'landscape';
    let [PW, PH] = this.PAPEL[ps.paperSize] || this.PAPEL[9];
    if (horizontal) [PW, PH] = [PH, PW];
    const mg = ps.margins || {};
    const M = { l: (mg.left ?? 0.4) * 72, r: (mg.right ?? 0.4) * 72, t: (mg.top ?? 0.45) * 72, b: (mg.bottom ?? 0.45) * 72 };
    const dispW = PW - M.l - M.r, dispH = PH - M.t - M.b;

    // Zona a imprimir
    let r1 = 1, c1 = 1, r2 = ws.rowCount || 1, c2 = ws.columnCount || 1;
    const area = ps.printArea ? this._rango(String(ps.printArea).split(',')[0]) : null;
    if (area) ({ r1, c1, r2, c2 } = area);
    if (r2 < r1 || c2 < c1) return;

    // Anchos de columna (puntos) y alturas de fila
    const colW = {};
    const anchoDef = (ws.properties && ws.properties.defaultColWidth) || 8.43;
    for (let c = c1; c <= c2; c++) {
      const col = ws.getColumn(c);
      colW[c] = col.hidden ? 0 : ((col.width || anchoDef) * 7 + 5) * 0.75;
    }
    let anchoTotal = 0; for (let c = c1; c <= c2; c++) anchoTotal += colW[c];
    if (!anchoTotal) return;

    // Combinaciones
    const mast = {}, cubierta = new Set();
    ((ws.model && ws.model.merges) || []).forEach(m => {
      const g = this._rango(m); if (!g) return;
      mast[g.r1 + ',' + g.c1] = g;
      for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) if (r !== g.r1 || c !== g.c1) cubierta.add(r + ',' + c);
    });
    const anchoRect = (ra, ca, rb, cb) => { let w = 0; for (let c = ca; c <= cb; c++) w += (colW[c] || 0); return w; };

    // Escala: entra siempre a lo ancho de la hoja; respeta la escala pedida si es menor
    let esc = Math.min(1, dispW / anchoTotal);
    if (!ps.fitToPage && ps.scale && ps.scale < 100) esc = Math.min(esc, ps.scale / 100);

    // Alturas de fila (puntos, sin escalar). Si no tienen altura fija, se ajusta al texto envuelto.
    const alto = {};
    const defRow = (ws.properties && ws.properties.defaultRowHeight) || 15;
    const fuente = (cell) => {
      const f = cell.font || {};
      return { b: !!f.bold, i: !!f.italic, size: f.size || 11, color: this._rgb(PDFLib, f.color && f.color.argb, PDFLib.rgb(0, 0, 0)) };
    };
    const elegirFuente = (fo) => (fo.b && fo.i ? K.fBI : fo.b ? K.fB : fo.i ? K.fI : K.fN);
    const envolver = (txt, font, size, ancho) => {
      const salida = [];
      String(txt).split('\n').forEach(par => {
        const palabras = par.split(' '); let linea = '';
        palabras.forEach(p => {
          const prueba = linea ? linea + ' ' + p : p;
          if (font.widthOfTextAtSize(prueba, size) <= ancho || !linea) {
            if (font.widthOfTextAtSize(prueba, size) > ancho && !linea) {
              // palabra más ancha que la celda: se corta por letras
              let tramo = '';
              prueba.split('').forEach(ch => { if (font.widthOfTextAtSize(tramo + ch, size) > ancho && tramo) { salida.push(tramo); tramo = ch; } else tramo += ch; });
              linea = tramo;
            } else linea = prueba;
          } else { salida.push(linea); linea = p; }
        });
        salida.push(linea);
      });
      return salida;
    };

    for (let r = r1; r <= r2; r++) {
      const row = ws.getRow(r);
      if (row.hidden) { alto[r] = 0; continue; }
      if (row.height) { alto[r] = row.height; continue; }
      let h = defRow;
      for (let c = c1; c <= c2; c++) {
        if (cubierta.has(r + ',' + c)) continue;
        const cell = row.getCell(c);
        const al = cell.alignment || {};
        if (!al.wrapText) continue;
        const txt = limpiar(this._texto(cell), K.fN); if (!txt) continue;
        const fo = fuente(cell); const font = elegirFuente(fo);
        const g = mast[r + ',' + c]; const w = (g ? anchoRect(g.r1, g.c1, g.r2, g.c2) : colW[c]) - 4;
        if (g && g.r2 > g.r1) continue;
        const lineas = envolver(limpiar(txt, font), font, fo.size, Math.max(w, 6)).length;
        h = Math.max(h, lineas * fo.size * 1.22 + 4);
      }
      alto[r] = h;
    }

    // Bloques de páginas: saltos manuales o por altura
    const saltos = new Set(((ws.rowBreaks || ws.model && ws.model.rowBreaks) || []).map(b => b.id));
    const titulo = (ws.views && ws.views[0] && ws.views[0].state === 'frozen' && ws.views[0].ySplit) ? Math.min(ws.views[0].ySplit, 6) : 0;
    const filasTitulo = titulo && (r1 + titulo - 1) < r2 ? Array.from({ length: titulo }, (_, i) => r1 + i) : [];

    // Si hay saltos manuales, cada bloque debe entrar en una página: se achica la escala si hace falta
    if (saltos.size) {
      let maxBloque = 0, acum = 0;
      for (let r = r1; r <= r2; r++) { acum += alto[r]; if (saltos.has(r) || r === r2) { maxBloque = Math.max(maxBloque, acum); acum = 0; } }
      if (maxBloque * esc > dispH) esc = dispH / maxBloque;
    }

    const paginas = []; let actual = { desde: r1, filas: [], h: 0 };
    const ultTitulo = filasTitulo.length ? filasTitulo[filasTitulo.length - 1] : 0;
    const nuevaPagina = (desdeFila) => {
      paginas.push(actual);
      actual = { desde: desdeFila, filas: [], h: 0 };
      if (filasTitulo.length && desdeFila > ultTitulo) filasTitulo.forEach(t => { actual.filas.push(t); actual.h += alto[t] * esc; });
    };
    for (let r = r1; r <= r2; r++) {
      const hh = (alto[r] || 0) * esc;
      if (actual.filas.length && actual.h + hh > dispH + 0.5) nuevaPagina(r);
      actual.filas.push(r); actual.h += hh;
      if (saltos.has(r) && r < r2) nuevaPagina(r + 1);
    }
    if (actual.filas.length) paginas.push(actual);

    const anchoPag = anchoTotal * esc;
    const x0 = ps.horizontalCentered ? M.l + Math.max(0, (dispW - anchoPag) / 2) : M.l;
    const colX = {}; { let x = 0; for (let c = c1; c <= c2; c++) { colX[c] = x; x += colW[c] * esc; } colX[c2 + 1] = x; }

    // Imágenes (logos) de la hoja
    let imgs = [];
    try { imgs = (ws.getImages ? ws.getImages() : []).map(im => ({ id: im.imageId, rg: im.range })); } catch (e) { imgs = []; }

    paginas.forEach(pag => {
      const page = pdf.addPage([PW, PH]);
      const yTop = {}; let y = 0;
      pag.filas.forEach(r => { yTop[r] = y; y += (alto[r] || 0) * esc; });
      const Y = (v) => PH - M.t - v;

      // Pasada 1: rellenos
      pag.filas.forEach(r => {
        if (!alto[r]) return;
        const row = ws.getRow(r);
        for (let c = c1; c <= c2; c++) {
          if (!colW[c] || cubierta.has(r + ',' + c)) continue;
          const cell = row.getCell(c);
          const fl = cell.fill;
          if (!fl || fl.type !== 'pattern' || fl.pattern !== 'solid') continue;
          const col = this._rgb(PDFLib, fl.fgColor && fl.fgColor.argb); if (!col) continue;
          const g = mast[r + ',' + c];
          const w = g ? colX[g.c2 + 1] - colX[g.c1] : colW[c] * esc;
          let h = alto[r] * esc; if (g) { h = 0; for (let k = g.r1; k <= g.r2; k++) h += (alto[k] || 0) * esc; }
          page.drawRectangle({ x: x0 + colX[c], y: Y(yTop[r]) - h, width: w, height: h, color: col });
        }
      });

      // Pasada 2: bordes (por cada celda, incluidas las combinadas)
      const trazo = (b, x1, y1, x2, y2) => {
        if (!b || !b.style) return;
        const gr = { hair: 0.25, thin: 0.5, dotted: 0.5, dashed: 0.5, medium: 1.1, mediumDashed: 1.1, double: 1, thick: 1.6 }[b.style] || 0.5;
        page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: gr * Math.max(esc, 0.7), color: this._rgb(PDFLib, b.color && b.color.argb, PDFLib.rgb(0, 0, 0)) });
      };
      pag.filas.forEach(r => {
        if (!alto[r]) return;
        const row = ws.getRow(r);
        for (let c = c1; c <= c2; c++) {
          if (!colW[c]) continue;
          const bd = row.getCell(c).border; if (!bd) continue;
          const xa = x0 + colX[c], xb = x0 + colX[c + 1], ya = Y(yTop[r]), yb = ya - alto[r] * esc;
          trazo(bd.top, xa, ya, xb, ya); trazo(bd.bottom, xa, yb, xb, yb);
          trazo(bd.left, xa, ya, xa, yb); trazo(bd.right, xb, ya, xb, yb);
        }
      });

      // Pasada 3: textos
      pag.filas.forEach(r => {
        if (!alto[r]) return;
        const row = ws.getRow(r);
        for (let c = c1; c <= c2; c++) {
          if (!colW[c] || cubierta.has(r + ',' + c)) continue;
          const cell = row.getCell(c);
          let txt = this._texto(cell); if (txt === '') continue;
          const fo = fuente(cell); const font = elegirFuente(fo);
          txt = limpiar(txt, font);
          const al = cell.alignment || {};
          const g = mast[r + ',' + c];
          const cx = x0 + colX[c];
          const cw = g ? colX[g.c2 + 1] - colX[g.c1] : colW[c] * esc;
          let ch = alto[r] * esc; if (g) { ch = 0; for (let k = g.r1; k <= g.r2; k++) ch += (alto[k] || 0) * esc; }
          const cy = Y(yTop[r]);
          let size = fo.size * esc;
          const pad = 2 * esc;
          const rot = al.textRotation;
          const esNum = typeof (cell.value && cell.value.result !== undefined ? cell.value.result : cell.value) === 'number';
          let h = al.horizontal || (esNum ? 'right' : 'left');
          if (h === 'general' || h === 'centerContinuous' || h === 'fill' || h === 'distributed') h = esNum ? 'right' : (h === 'centerContinuous' ? 'center' : 'left');

          // Texto girado 90°
          if (rot === 90 || rot === 180 || rot === 'vertical') {
            const sube = rot === 90;
            const lineas = txt.split('\n');
            const largo = Math.max(...lineas.map(l => font.widthOfTextAtSize(l, size)));
            if (largo > ch - 2 * pad) size = Math.max(3, size * (ch - 2 * pad) / largo);
            const nLin = lineas.length; const hLinea = size * 1.15;
            lineas.forEach((l, i) => {
              const wl = font.widthOfTextAtSize(l, size);
              const cxl = cx + cw / 2 + (nLin * hLinea) / 2 - hLinea * (i + 0.8);
              const cyl = sube ? cy - ch / 2 - wl / 2 : cy - ch / 2 + wl / 2;
              page.drawText(l, { x: sube ? cxl : cxl + hLinea * 0.6, y: cyl, size, font, color: fo.color, rotate: PDFLib.degrees(sube ? 90 : -90) });
            });
            continue;
          }

          const aw = cw - 2 * pad;
          if (al.shrinkToFit) {
            const wMax = Math.max(...txt.split('\n').map(l => font.widthOfTextAtSize(l, size)));
            if (wMax > aw) size = Math.max(3, size * aw / wMax);
          }
          let lineas = al.wrapText ? envolver(txt, font, size, Math.max(aw, 4)) : txt.split('\n').slice(0, 1);
          const hLinea = size * 1.18;
          const bloque = lineas.length * hLinea;
          let ty;
          const v = al.vertical || 'bottom';
          if (v === 'top') ty = cy - pad;
          else if (v === 'middle' || v === 'center') ty = cy - (ch - bloque) / 2;
          else ty = cy - ch + bloque + pad * 0.6;
          lineas.forEach((l, i) => {
            if (!l) return;
            const wl = font.widthOfTextAtSize(l, size);
            let tx;
            if (h === 'center') tx = cx + (cw - wl) / 2;
            else if (h === 'right') tx = cx + cw - pad - wl;
            else tx = cx + pad;
            // Lo que no entra y no se envuelve se corta con el borde de la celda (como en Excel)
            let out = l;
            if (!al.wrapText && wl > aw + 0.5 && h === 'left') {
              while (out.length > 1 && font.widthOfTextAtSize(out, size) > aw) out = out.slice(0, -1);
            }
            page.drawText(out, { x: tx, y: ty - hLinea * (i + 0.82), size, font, color: fo.color });
          });
        }
      });

      // Imágenes que caen en esta página
      imgs.forEach(im => {
        try {
          const tl = im.rg && im.rg.tl; if (!tl) return;
          const fila = Math.floor(Number(tl.row !== undefined ? tl.row : tl.nativeRow)) + 1;
          if (!pag.filas.includes(fila)) return;
          const med = wb.getImage(im.id); if (!med) return;
          const bytes = med.buffer ? new Uint8Array(med.buffer) : this._b64ABytes(med.base64);
          const key = im.id;
          const pr = K.imagenes[key] || (K.imagenes[key] = (String(med.extension).toLowerCase() === 'png' ? pdf.embedPng(bytes) : pdf.embedJpg(bytes)));
          const colF = Number(tl.col !== undefined ? tl.col : tl.nativeCol) + 1;
          const cI = Math.floor(colF), fr = colF - cI;
          const colBase = colX[cI] !== undefined ? colX[cI] + (colW[cI] || 0) * esc * fr : 0;
          const rowF = Number(tl.row !== undefined ? tl.row : tl.nativeRow) + 1;
          const rI = Math.floor(rowF), fy = rowF - rI;
          const yy = (yTop[rI] || 0) + (alto[rI] || 0) * esc * fy;
          const w = (im.rg.ext ? im.rg.ext.width : 40) * 0.75 * esc, hh = (im.rg.ext ? im.rg.ext.height : 40) * 0.75 * esc;
          K._pend.push(Promise.resolve(pr).then(emb => page.drawImage(emb, { x: x0 + colBase, y: Y(yy) - hh, width: w, height: hh })));
        } catch (e) { /* un logo que falla no debe frenar el PDF */ }
      });
    });
  },

  /* ---------- Ventana de vista previa ---------- */
  _cerrar() {
    const m = document.getElementById('vistapdf-modal'); if (m) m.remove();
    this._urls.forEach(u => URL.revokeObjectURL(u)); this._urls = [];
    document.body.style.overflow = this._overflow || '';
  },

  _bajar(blob, nombre) {
    const a = document.createElement('a');
    const u = URL.createObjectURL(blob); a.href = u; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  },

  /**
   * Muestra el libro como PDF. Opciones:
   *   archivo      nombre del Excel (ej. 'Acta.xlsx'); el PDF usa el mismo nombre con .pdf
   *   titulo       texto de la barra superior
   *   alDescargar  función que se llama cuando la persona baja el PDF o el Excel
   */
  async mostrar(wb, { archivo = 'planilla.xlsx', titulo = 'Vista previa', alDescargar } = {}) {
    const nombrePdf = archivo.replace(/\.xlsx$/i, '') + '.pdf';
    const bajarExcel = async () => {
      const buf = await wb.xlsx.writeBuffer();
      this._bajar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), archivo);
      if (alDescargar) alDescargar('excel');
    };
    let bytes;
    try {
      if (typeof Swal !== 'undefined') Swal.fire({ title: 'Preparando la vista…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      bytes = await this.armar(wb);
    } catch (e) {
      console.error('Vista PDF:', e);
      if (typeof Swal !== 'undefined') Swal.close();
      if (confirm('No se pudo armar la vista en PDF. ¿Descargar el Excel directamente?')) await bajarExcel();
      return;
    }
    if (typeof Swal !== 'undefined') Swal.close();

    this._cerrar();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob); this._urls.push(url);
    const tactil = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (window.matchMedia && window.matchMedia('(pointer:coarse)').matches && window.innerWidth < 900);
    const eh = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const btn = 'border:0;border-radius:8px;padding:.55rem .9rem;font-weight:700;font-size:.85rem;cursor:pointer;';
    const m = document.createElement('div');
    m.id = 'vistapdf-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(7,27,56,.78);display:flex;flex-direction:column;';
    m.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;padding:.6rem .8rem;background:#071b38;color:#fff;">
        <div style="flex:1 1 200px;font-weight:700;font-size:.95rem;">${eh(titulo)}</div>
        <button type="button" id="vpdf-pdf" style="${btn}background:#f2b705;color:#071b38;">⬇ Descargar PDF</button>
        <button type="button" id="vpdf-xls" style="${btn}background:#fff;color:#071b38;" title="Solo si necesitás modificar la planilla">📊 Descargar Excel</button>
        <button type="button" id="vpdf-cerrar" style="${btn}background:#b42318;color:#fff;">Cerrar</button>
      </div>
      <div style="flex:1;min-height:0;background:#e6e9ef;display:flex;align-items:center;justify-content:center;">
        ${tactil
          ? `<div style="text-align:center;padding:1.5rem;max-width:380px;color:#071b38;">
               <p style="font-size:.95rem;margin:0 0 1rem;">La vista previa en el celular se abre en una pestaña aparte.</p>
               <button type="button" id="vpdf-abrir" style="${btn}background:#071b38;color:#fff;font-size:1rem;padding:.8rem 1.2rem;">👁 Ver el PDF</button>
               <p style="font-size:.78rem;margin:1rem 0 0;color:#555;">Si necesitás modificarla, usá «Descargar Excel».</p>
             </div>`
          : `<iframe id="vpdf-frame" title="Vista previa PDF" src="${url}#toolbar=1&navpanes=0" style="border:0;width:100%;height:100%;background:#fff;"></iframe>`}
      </div>`;
    this._overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(m);
    m.querySelector('#vpdf-cerrar').onclick = () => this._cerrar();
    m.querySelector('#vpdf-pdf').onclick = () => { this._bajar(blob, nombrePdf); if (alDescargar) alDescargar('pdf'); };
    m.querySelector('#vpdf-xls').onclick = async (ev) => {
      const b = ev.currentTarget; b.disabled = true;
      try { await bajarExcel(); } catch (e) { alert('No se pudo armar el Excel: ' + (e.message || e)); }
      b.disabled = false;
    };
    const ab = m.querySelector('#vpdf-abrir'); if (ab) ab.onclick = () => window.open(url, '_blank');
    const alEsc = (e) => { if (e.key === 'Escape') { VistaPDF._cerrar(); document.removeEventListener('keydown', alEsc); } };
    document.addEventListener('keydown', alEsc);
  }
};

window.VistaPDF = VistaPDF;
