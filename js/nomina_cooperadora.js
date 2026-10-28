/* ==========================================================================
   NÓMINA DE AUTORIDADES DE LA COMISIÓN DIRECTIVA (Cooperadora) — por ejercicio (01/05 al 30/04)
   No tiene carga propia: sale de la Comisión Directiva y Revisora de Cuentas del ejercicio
   (Cooperadora → Ejercicio / PIA → «Comisión»). La ven e imprimen (PDF) todos los usuarios;
   la modifican Director, Regente y Preceptores desde esa misma carga.
   ========================================================================== */
const NominaCoopModulo = {
  destinoId: 'coop-panel',
  ejercicios: [], ejercicio: null, filas: [], puedeEditar: false,
  LIBRES_MIN: 13,
  REV: { 'Titular Docente': 'Rev. de Cuentas Doc.', 'Titular': 'Rev. de Cuentas Tit.', 'Suplente': 'Rev. de Cuentas Sup.', 'Asesor/a': 'Asesor' },
  COLS: [['cargo', 'Cargo'], ['apellido_nombre', 'Apellido y nombre'], ['documento', 'Documento'],
         ['domicilio', 'Domicilio'], ['localidad', 'Localidad'], ['vencimiento', 'Vencimiento']],

  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  // Arma los renglones del formulario: cargos de la directiva (mín. 13) + 4 fijos (revisora y asesor)
  armarFilas(raw) {
    const dir = raw.filter(f => f.tipo === 'directiva').sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const libres = Math.max(this.LIBRES_MIN, dir.length);
    const res = [];
    for (let i = 0; i < libres; i++) res.push({ ...(dir[i] || {}) });
    Object.entries(this.REV).forEach(([orig, etiqueta]) => {
      const f = raw.find(r => r.tipo === 'revisora' && r.cargo === orig) || {};
      res.push({ ...f, cargo: etiqueta, vencimiento: f.vencimiento || '' });
    });
    return res;
  },

  async cargar(destinoId, ejercicioId) {
    if (destinoId) this.destinoId = destinoId;
    const cont = document.getElementById(this.destinoId);
    if (!cont) return;
    cont.innerHTML = '<p class="seg-cargando">Cargando nómina…</p>';
    try {
      const perfil = (window.Auth && Auth.usuarioActual) || await Auth.obtenerPerfilSesion();
      this.puedeEditar = Auth.esPersonal(String(perfil?.rol || '').toLowerCase().trim());
      const pedido = ejercicioId || (window.CooperadoraModulo && CooperadoraModulo.ejercicioActual) || null;
      const { data, error } = await supabase.rpc('nomina_cooperadora', { p_ejercicio: pedido });
      if (error) throw error;
      this.ejercicios = data.ejercicios || [];
      this.ejercicio = data.ejercicio || null;
      this.filas = this.ejercicio ? this.armarFilas(data.filas || []) : [];
      if (this.ejercicio && window.CooperadoraModulo) CooperadoraModulo.ejercicioActual = this.ejercicio.id;
      this.dibujar();
    } catch (err) {
      console.error('Nómina cooperadora:', err);
      cont.innerHTML = `<div class="card"><p>No se pudo cargar la nómina. ${/nomina_cooperadora/i.test(err.message || '') ? 'Falta ejecutar el paso 51 en Supabase.' : this.esc(err.message || '')}</p></div>`;
    }
  },

  periodo(e) { return e ? `${e.ciclo_desde}/${e.ciclo_hasta}` : ''; },

  dibujar() {
    const cont = document.getElementById(this.destinoId);
    if (!cont) return;
    const e = this.ejercicio;
    if (!e) {
      cont.innerHTML = `<div class="prog-vacio">Todavía no hay un ejercicio cargado. ${this.puedeEditar ? 'Creá el ejercicio en la pestaña «Ejercicio / PIA» y cargá su comisión: la nómina se arma sola.' : ''}</div>`;
      return;
    }
    const hayDatos = this.filas.some(f => f.apellido_nombre);
    const filas = this.filas.map((f, i) => `<tr>${this.COLS.map(([k]) =>
      `<td${k === 'cargo' && i >= this.filas.length - 4 ? ' style="font-weight:600;"' : ''}>${this.esc(f[k] || '')}</td>`).join('')}</tr>`).join('');
    cont.innerHTML = `
      <div class="card" style="padding:1rem;">
        <h3 style="margin:0 0 .3rem;">Nómina y firma de la actual Comisión Directiva</h3>
        <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin:.4rem 0 .8rem;">
          <select class="form-control" style="max-width:16rem;" onchange="NominaCoopModulo.cargar(null, Number(this.value))">
            ${this.ejercicios.map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>Ejercicio ${this.periodo(x)}</option>`).join('')}
          </select>
          <span class="seg-cargando" style="margin:0;">Del 01/05/${e.ciclo_desde} al 30/04/${e.ciclo_hasta}</span>
        </div>
        <p style="margin:0 0 .8rem;"><strong>Distrito:</strong> ${this.esc(e.distrito || '')} &nbsp; <strong>Escuela y N.º:</strong> ${this.esc(this.escuela(e))}</p>
        ${hayDatos ? '' : `<p class="seg-cargando">La comisión de este ejercicio todavía no está cargada.${this.puedeEditar ? ' Cargala con el botón «Cargar / editar comisión».' : ''}</p>`}
        <div class="sec-tabla-wrap"><table class="sec-tabla">
          <thead><tr>${this.COLS.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead>
          <tbody>${filas}</tbody>
        </table></div>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.9rem;">
          <button class="act-btn" onclick="NominaCoopModulo.descargarPDF()">🖨️ Descargar / imprimir PDF</button>
          ${this.puedeEditar && window.CooperadoraModulo ? `<button class="act-btn" onclick="NominaCoopModulo.editarComision()">✏️ Cargar / editar comisión</button>` : ''}
        </div>
      </div>`;
  },

  escuela(e) { return [e.escuela_nombre, e.escuela_nro ? 'N.º ' + e.escuela_nro : ''].filter(Boolean).join(' ') || ''; },

  async editarComision() {
    if (!this.puedeEditar || !this.ejercicio) return;
    CooperadoraModulo.ejercicioActual = this.ejercicio.id;
    await CooperadoraModulo.formComision(this.ejercicio.id);   // al guardar, la cooperadora recarga y vuelve a esta pestaña
  },

  /* ---------- PDF (réplica del formulario oficial, hoja apaisada) ---------- */
  limpio(t) { return String(t ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\r?\n/g, ' ').replace(/[^\x20-\x7E -ÿ]/g, '?'); },

  async imagen(doc, ruta) {
    try {
      const r = await fetch(ruta);
      if (!r.ok) return null;
      return await doc.embedPng(new Uint8Array(await r.arrayBuffer()));
    } catch (e) { return null; }
  },

  async generarPDF() {
    if (typeof PDFLib === 'undefined') throw new Error('No se pudo cargar el generador de PDF');
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    const fN = await doc.embedFont(StandardFonts.Helvetica), fB = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 1008, H = 612, M = 36, NEGRO = rgb(0.05, 0.07, 0.12), LINEA = rgb(0.2, 0.2, 0.25);
    const pag = doc.addPage([W, H]);
    const L = t => this.limpio(t);
    const [logoCfp, logoDg] = await Promise.all([this.imagen(doc, 'img/logo-cfp-ficha.png'), this.imagen(doc, 'img/logo-dgcye.png')]);
    if (logoDg) { const s = logoDg.scaleToFit(130, 46); pag.drawImage(logoDg, { x: W - M - s.width, y: H - M - s.height + 6, width: s.width, height: s.height }); }
    if (logoCfp) { const s = logoCfp.scaleToFit(46, 46); pag.drawImage(logoCfp, { x: W - M - 150 - s.width, y: H - M - s.height + 6, width: s.width, height: s.height }); }
    pag.drawText(L('NOMINA Y FIRMA DE LA ACTUAL COMISIÓN DIRECTIVA'), { x: M, y: H - M - 6, size: 13, font: fB, color: NEGRO });

    const e = this.ejercicio || {};
    const campo = (etq, valor, x, y, w) => {
      pag.drawText(L(etq), { x, y: y + 4, size: 9, font: fB, color: NEGRO });
      const xi = x + fB.widthOfTextAtSize(L(etq), 9) + 6;
      pag.drawText(L(valor || ''), { x: xi + 3, y: y + 3, size: 9.5, font: fN, color: NEGRO, maxWidth: w - (xi - x) - 6 });
      pag.drawLine({ start: { x: xi, y: y }, end: { x: x + w, y }, thickness: 0.6, color: LINEA });
    };
    campo('AÑO:', this.periodo(e), M + 60, H - M - 42, 130);
    campo('DISTRITO:', e.distrito, M + 215, H - M - 42, 250);
    campo('ESCUELA Y NRO:', this.escuela(e), M + 490, H - M - 42, W - 2 * M - 490);
    campo('ASOCIACIÓN COOPERADORA:', e.escuela_nombre ? 'Cooperadora ' + this.escuela(e) : '', M + 10, H - M - 66, W - 2 * M - 10);

    const anchos = [100, 200, 87, 160, 137, 90, 120];
    const total = anchos.reduce((a, b) => a + b, 0), esc = (W - 2 * M) / total;
    const cols = anchos.map(a => a * esc);
    const etq = ['CARGO', 'APELLIDO Y NOMBRE', 'DOCUMENTO', 'DOMICILIO', 'LOCALIDAD', 'VENCIMIENTO', 'FIRMA'];
    const top = H - M - 82, hCab = 20;
    const hFila = Math.min(21.5, (top - hCab - M) / this.filas.length);
    const celda = (x, y, w, h) => pag.drawRectangle({ x, y, width: w, height: h, borderColor: LINEA, borderWidth: 0.7 });
    let x = M;
    cols.forEach((w, i) => {
      celda(x, top - hCab, w, hCab);
      const t = L(etq[i]), tw = fB.widthOfTextAtSize(t, 8.5);
      pag.drawText(t, { x: x + (w - tw) / 2, y: top - hCab + 6, size: 8.5, font: fB, color: NEGRO });
      x += w;
    });
    const keys = ['cargo', 'apellido_nombre', 'documento', 'domicilio', 'localidad', 'vencimiento'];
    this.filas.forEach((f, r) => {
      const y = top - hCab - (r + 1) * hFila;
      x = M;
      cols.forEach((w, i) => {
        celda(x, y, w, hFila);
        if (i < 6) {
          let txt = L(f[keys[i]] || ''); let size = 8.5;
          const fijo = i === 0 && r >= this.filas.length - 4;
          const f_ = fijo ? fB : fN;
          while (size > 5.5 && f_.widthOfTextAtSize(txt, size) > w - 6) size -= 0.5;
          while (txt.length > 1 && f_.widthOfTextAtSize(txt, size) > w - 6) txt = txt.slice(0, -1);
          if (txt) pag.drawText(txt, { x: x + 3, y: y + hFila / 2 - 3, size, font: f_, color: NEGRO });
        }
        x += w;
      });
    });
    return await doc.save();
  },

  async descargarPDF() {
    try {
      const bytes = await this.generarPDF();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `Nomina_Comision_Directiva_${this.periodo(this.ejercicio).replace('/', '-')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      alert('No se pudo generar el PDF: ' + (err.message || ''));
    }
  }
};
window.NominaCoopModulo = NominaCoopModulo;
