/* ==========================================================================
   NÓMINA DE AUTORIDADES DE LA COMISIÓN DIRECTIVA (Cooperadora)
   Réplica del formulario oficial. La ven y la descargan (PDF) todos los usuarios;
   la cargan Director, Regente y Preceptores. Archivo: js/nomina_cooperadora.js
   ========================================================================== */
const NominaCoopModulo = {
  datos: { anio: '', distrito: '', escuela: '', asociacion: '' },
  filas: [],
  puedeEditar: false,
  editando: false,
  LIBRES: 13,
  FIJOS: ['Rev. de Cuentas Doc.', 'Rev. de Cuentas Tit.', 'Rev. de Cuentas Sup.', 'Asesor'],
  COLS: [['cargo', 'Cargo', 100], ['apellido_nombre', 'Apellido y nombre', 200], ['documento', 'Documento', 87],
         ['domicilio', 'Domicilio', 160], ['localidad', 'Localidad', 137], ['vencimiento', 'Vencimiento', 90]],

  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  filasCompletas(lista) {
    const base = (lista || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const res = [];
    for (let i = 0; i < this.LIBRES; i++) res.push({ ...(base[i] || {}) });
    this.FIJOS.forEach((cargo, j) => res.push({ ...(base[this.LIBRES + j] || {}), cargo }));
    return res;
  },

  destinoId: 'coop-panel',

  async cargar(destinoId) {
    if (destinoId) this.destinoId = destinoId;
    const cont = document.getElementById(this.destinoId);
    if (!cont) return;
    cont.innerHTML = '<p class="seg-cargando">Cargando nómina…</p>';
    try {
      const perfil = (window.Auth && Auth.usuarioActual) || await Auth.obtenerPerfilSesion();
      this.puedeEditar = Auth.esPersonal(String(perfil?.rol || '').toLowerCase().trim());
      const [rd, rf] = await Promise.all([
        supabase.from('cooperadora_nomina_datos').select('*').eq('id', 1).maybeSingle(),
        supabase.from('cooperadora_nomina').select('*').order('orden')
      ]);
      if (rd.error) throw rd.error;
      if (rf.error) throw rf.error;
      this.datos = rd.data || { anio: new Date().getFullYear(), distrito: '', escuela: '', asociacion: '' };
      this.filas = this.filasCompletas(rf.data);
      this.editando = false;
      this.dibujar();
    } catch (err) {
      console.error('Nómina cooperadora:', err);
      cont.innerHTML = `<div class="card"><p>No se pudo cargar la nómina. ${/cooperadora_nomina/i.test(err.message || '') ? 'Falta ejecutar el paso 51 en Supabase.' : this.esc(err.message || '')}</p></div>`;
    }
  },

  dibujar() {
    const cont = document.getElementById(this.destinoId);
    if (!cont) return;
    const d = this.datos, ed = this.editando;
    const inp = (id, v, ph = '', w = '') => `<input id="${id}" class="form-control" style="${w}" value="${this.esc(v)}" placeholder="${ph}">`;
    const cab = ed
      ? `<div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.8rem;">
           <label>Año ${inp('nc-anio', d.anio, '', 'width:6rem;')}</label>
           <label>Distrito ${inp('nc-distrito', d.distrito)}</label>
           <label>Escuela y N.º ${inp('nc-escuela', d.escuela, '', 'min-width:16rem;')}</label>
           <label style="flex:1 1 18rem;">Asociación Cooperadora ${inp('nc-asoc', d.asociacion, '', 'width:100%;')}</label>
         </div>`
      : `<p style="margin:0 0 .8rem;"><strong>Año:</strong> ${this.esc(d.anio || '')} &nbsp; <strong>Distrito:</strong> ${this.esc(d.distrito || '')} &nbsp; <strong>Escuela y N.º:</strong> ${this.esc(d.escuela || '')}<br><strong>Asociación Cooperadora:</strong> ${this.esc(d.asociacion || '—')}</p>`;
    const filas = this.filas.map((f, i) => `<tr>${this.COLS.map(([k]) => {
      const fijo = k === 'cargo' && i >= this.LIBRES;
      if (ed && !fijo) return `<td><input class="form-control nc-in" data-i="${i}" data-k="${k}" value="${this.esc(f[k])}" style="min-width:7rem;"></td>`;
      return `<td${fijo ? ' style="font-weight:600;"' : ''}>${this.esc(f[k] || '')}</td>`;
    }).join('')}</tr>`).join('');
    cont.innerHTML = `
      <div class="card" style="padding:1rem;">
        <h3 style="margin:0 0 .3rem;">Nómina y firma de la actual Comisión Directiva</h3>
        <p class="seg-cargando" style="margin:0 0 .8rem;">Asociación Cooperadora del CFP. Podés descargarla en PDF para imprimir y firmar.</p>
        ${cab}
        <div class="sec-tabla-wrap"><table class="sec-tabla">
          <thead><tr>${this.COLS.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead>
          <tbody>${filas}</tbody>
        </table></div>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.9rem;">
          <button class="act-btn" onclick="NominaCoopModulo.descargarPDF()">📄 Descargar PDF</button>
          ${this.puedeEditar && !ed ? '<button class="act-btn" onclick="NominaCoopModulo.editar()">✏️ Editar nómina</button>' : ''}
          ${ed ? '<button class="act-btn" onclick="NominaCoopModulo.guardar()">💾 Guardar</button><button class="act-btn" onclick="NominaCoopModulo.cargar()">Cancelar</button>' : ''}
        </div>
      </div>`;
  },

  editar() { if (!this.puedeEditar) return; this.editando = true; this.dibujar(); },

  leerFormulario() {
    this.datos = {
      anio: document.getElementById('nc-anio')?.value.trim() || '',
      distrito: document.getElementById('nc-distrito')?.value.trim() || '',
      escuela: document.getElementById('nc-escuela')?.value.trim() || '',
      asociacion: document.getElementById('nc-asoc')?.value.trim() || ''
    };
    document.querySelectorAll('#' + this.destinoId + ' .nc-in').forEach(el => {
      this.filas[Number(el.dataset.i)][el.dataset.k] = el.value.trim();
    });
  },

  async guardar() {
    if (!this.puedeEditar) return;
    this.leerFormulario();
    if (this.datos.anio && !/^\d{4}$/.test(this.datos.anio)) { alert('El año debe tener 4 números.'); return; }
    try {
      const { error } = await supabase.rpc('guardar_nomina_coop', { p_datos: this.datos, p_filas: this.filas });
      if (error) throw error;
      if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Nómina guardada', showConfirmButton: false, timer: 2000 });
      await this.cargar();
    } catch (err) {
      alert('No se pudo guardar: ' + (err.message || ''));
    }
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

    const d = this.datos;
    const campo = (etq, valor, x, y, w) => {
      pag.drawText(L(etq), { x, y: y + 4, size: 9, font: fB, color: NEGRO });
      const xi = x + fB.widthOfTextAtSize(L(etq), 9) + 6;
      pag.drawText(L(valor || ''), { x: xi + 3, y: y + 3, size: 9.5, font: fN, color: NEGRO, maxWidth: w - (xi - x) - 6 });
      pag.drawLine({ start: { x: xi, y: y }, end: { x: x + w, y }, thickness: 0.6, color: LINEA });
    };
    campo('AÑO:', String(d.anio || ''), M + 60, H - M - 42, 110);
    campo('DISTRITO:', d.distrito, M + 200, H - M - 42, 260);
    campo('ESCUELA Y NRO:', d.escuela, M + 490, H - M - 42, W - 2 * M - 490);
    campo('ASOCIACIÓN COOPERADORA:', d.asociacion, M + 10, H - M - 66, W - 2 * M - 10);

    const anchos = [100, 200, 87, 160, 137, 90, 120];
    const total = anchos.reduce((a, b) => a + b, 0), esc = (W - 2 * M) / total;
    const cols = anchos.map(a => a * esc);
    const etq = ['CARGO', 'APELLIDO Y NOMBRE', 'DOCUMENTO', 'DOMICILIO', 'LOCALIDAD', 'VENCIMIENTO', 'FIRMA'];
    const top = H - M - 82, hCab = 20, hFila = 21.5;
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
          const fijo = i === 0 && r >= this.LIBRES;
          const f_ = fijo ? fB : fN;
          while (size > 5.5 && f_.widthOfTextAtSize(txt, size) > w - 6) size -= 0.5;
          while (txt.length > 1 && f_.widthOfTextAtSize(txt, size) > w - 6) txt = txt.slice(0, -1);
          if (txt) pag.drawText(txt, { x: x + 3, y: y + 7, size, font: f_, color: NEGRO });
        }
        x += w;
      });
    });
    return await doc.save();
  },

  async descargarPDF() {
    try {
      if (this.editando) this.leerFormulario();
      const bytes = await this.generarPDF();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      a.download = 'Nomina_Comision_Directiva_Cooperadora.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (err) {
      alert('No se pudo generar el PDF: ' + (err.message || ''));
    }
  }
};
window.NominaCoopModulo = NominaCoopModulo;
