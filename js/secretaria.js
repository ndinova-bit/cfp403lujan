/* ==========================================================================
   PANEL DE CIFRAS (Secretaría, dirección, regencia y preceptoría)
   Solo números por trayecto: inscriptos, bajas, mujeres / varones / otros y
   porcentaje de asistencia. No muestra datos personales de nadie.
   Archivo: js/secretaria.js
   ========================================================================== */

const SecretariaModulo = {
  filas: [],
  ciclo: null,
  modo: 'activos',      // 'activos' (sin bajas) | 'todos' (todos los inscriptos)

  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  num(n) { return Number(n || 0); },
  pct(v) { return v === null || v === undefined ? '–' : String(v).replace('.', ',') + ' %'; },

  async cargar() {
    const cont = document.getElementById('secretaria-contenido');
    if (!cont) return;
    if (this.ciclo === null) this.ciclo = new Date().getFullYear();
    cont.innerHTML = '<p class="seg-cargando">Calculando cifras…</p>';
    try {
      const { data, error } = await supabase.rpc('panel_cifras', { p_ciclo: Number(this.ciclo) });
      if (error) throw error;
      this.filas = data || [];
      this.dibujar();
    } catch (err) {
      console.error('Panel de cifras:', err);
      const falta = /panel_cifras|function/i.test(err.message || '');
      cont.innerHTML = `<div class="prog-vacio">No se pudo armar el panel.${falta ? ' Falta ejecutar <strong>sql/14_regente_secretaria_alertas.sql</strong> en Supabase.' : ' Probá recargar la página.'}</div>`;
    }
  },

  valores(f) {
    const a = this.modo === 'activos';
    return {
      inscriptos: a ? this.num(f.activos) : this.num(f.inscriptos),
      bajas: this.num(f.bajas),
      mujeres: this.num(a ? f.act_mujeres : f.ins_mujeres),
      varones: this.num(a ? f.act_varones : f.ins_varones),
      otros: this.num(a ? f.act_otros : f.ins_otros),
      sinDato: this.num(a ? f.act_sin_dato : f.ins_sin_dato)
    };
  },

  totales() {
    const t = { trayectos: this.filas.length, inscriptos: 0, bajas: 0, mujeres: 0, varones: 0, otros: 0, sinDato: 0, regs: 0, pres: 0 };
    this.filas.forEach(f => {
      const v = this.valores(f);
      ['inscriptos', 'bajas', 'mujeres', 'varones', 'otros', 'sinDato'].forEach(k => { t[k] += v[k]; });
      t.regs += this.num(f.registros); t.pres += this.num(f.presentes);
    });
    t.pct = t.regs ? Math.round(1000 * t.pres / t.regs) / 10 : null;
    return t;
  },

  dibujar() {
    const cont = document.getElementById('secretaria-contenido');
    if (!cont) return;
    const anio = new Date().getFullYear();
    const ciclos = [anio + 1, anio, anio - 1, anio - 2];
    const t = this.totales();
    const tarjeta = (n, txt) => `<div class="sec-card"><strong>${n}</strong><span>${txt}</span></div>`;

    cont.innerHTML = `
      <div class="sec-barra">
        <label>Ciclo lectivo
          <select class="form-control" onchange="SecretariaModulo.cambiarCiclo(this.value)">
            ${ciclos.map(c => `<option value="${c}" ${Number(this.ciclo) === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select></label>
        <label>Contar
          <select class="form-control" onchange="SecretariaModulo.cambiarModo(this.value)">
            <option value="activos" ${this.modo === 'activos' ? 'selected' : ''}>Estudiantes activos (sin bajas)</option>
            <option value="todos" ${this.modo === 'todos' ? 'selected' : ''}>Todos los inscriptos (con bajas)</option>
          </select></label>
        <div class="sec-acciones">
          <button type="button" class="btn btn-outline" onclick="PlanillaMatricula.descargar(SecretariaModulo.ciclo)">📑 Planilla de matrícula (POF/POFA)</button>
          <button type="button" class="btn btn-outline" onclick="SecretariaModulo.copiar()">📋 Copiar tabla</button>
          <button type="button" class="btn btn-gold" onclick="SecretariaModulo.excel()" ${this.filas.length ? '' : 'disabled'}>📊 Descargar Excel</button>
        </div>
      </div>

      <div class="sec-cards">
        ${tarjeta(t.trayectos, 'trayectos')}
        ${tarjeta(t.inscriptos, this.modo === 'activos' ? 'estudiantes activos' : 'inscriptos')}
        ${tarjeta(t.mujeres, 'mujeres')}
        ${tarjeta(t.varones, 'varones')}
        ${tarjeta(t.otros, 'otros')}
        ${tarjeta(t.bajas, 'bajas')}
        ${tarjeta(this.pct(t.pct), 'asistencia general')}
      </div>
      ${t.sinDato ? `<div class="asis-aviso"><strong>${t.sinDato}</strong> estudiante(s) no tienen el género cargado: no entran en mujeres, varones ni otros. Se completa en la ficha del estudiante o con la columna <em>género</em> del CSV.</div>` : ''}

      <div class="sec-tabla-wrap">
        <table class="sec-tabla">
          <thead><tr>
            <th>Trayecto</th><th>Sede</th><th>${this.modo === 'activos' ? 'Activos' : 'Inscriptos'}</th>
            <th>Mujeres</th><th>Varones</th><th>Otros</th><th>Sin dato</th><th>Bajas</th><th>Clases</th><th>% asistencia</th>
          </tr></thead>
          <tbody>
            ${this.filas.length ? this.filas.map(f => { const v = this.valores(f); return `
              <tr>
                <td class="sec-nombre">${this.esc(f.trayecto)}</td>
                <td>${f.sede === 'fuera' ? 'Fuera de sede' : 'Sede'}</td>
                <td><b>${v.inscriptos}</b></td><td>${v.mujeres}</td><td>${v.varones}</td><td>${v.otros}</td>
                <td class="${v.sinDato ? 'sec-aviso' : ''}">${v.sinDato}</td><td>${v.bajas}</td>
                <td>${this.num(f.dias_clase)}</td><td><b>${this.pct(f.pct_asistencia)}</b></td>
              </tr>`; }).join('') : `<tr><td colspan="10">No hay trayectos en el ciclo ${this.esc(this.ciclo)}.</td></tr>`}
          </tbody>
          ${this.filas.length ? `<tfoot><tr><td>Total</td><td></td><td>${t.inscriptos}</td><td>${t.mujeres}</td><td>${t.varones}</td><td>${t.otros}</td><td>${t.sinDato}</td><td>${t.bajas}</td><td></td><td>${this.pct(t.pct)}</td></tr></tfoot>` : ''}
        </table>
      </div>
      <p class="acta-ayuda">El porcentaje de asistencia es el de presentes (incluye las llegadas tarde) sobre todos los registros de los estudiantes activos del trayecto. "Clases" son los días con asistencia cargada.</p>`;
  },

  cambiarCiclo(v) { this.ciclo = Number(v); this.cargar(); },
  cambiarModo(v) { this.modo = v === 'todos' ? 'todos' : 'activos'; this.dibujar(); },

  /* Matriz de la tabla (para copiar o armar el Excel) */
  matriz() {
    const t = this.totales();
    const cab = ['Trayecto', 'Sede', this.modo === 'activos' ? 'Activos' : 'Inscriptos', 'Mujeres', 'Varones', 'Otros', 'Sin dato', 'Bajas', 'Clases', '% asistencia'];
    const filas = this.filas.map(f => { const v = this.valores(f); return [f.trayecto, f.sede === 'fuera' ? 'Fuera de sede' : 'Sede', v.inscriptos, v.mujeres, v.varones, v.otros, v.sinDato, v.bajas, this.num(f.dias_clase), f.pct_asistencia === null ? '' : Number(f.pct_asistencia)]; });
    filas.push(['Total', '', t.inscriptos, t.mujeres, t.varones, t.otros, t.sinDato, t.bajas, '', t.pct === null ? '' : t.pct]);
    return { cab, filas };
  },

  async copiar() {
    const { cab, filas } = this.matriz();
    const texto = [cab, ...filas].map(r => r.map(c => String(c).replace(/[\t\n]/g, ' ').replace('.', ',')).join('\t')).join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Tabla copiada: pegala en tu planilla', showConfirmButton: false, timer: 2200 });
    } catch (e) {
      alert('No se pudo copiar. Usá "Descargar Excel".');
    }
  },

  async excel() {
    if (typeof ExcelJS === 'undefined') { alert('No se pudo cargar el generador de Excel. Recargá la página.'); return; }
    const { cab, filas } = this.matriz();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Cifras por trayecto');
    ws.addRow([`CFP N.º 403 «Oscar Smith» · Cifras por trayecto · Ciclo ${this.ciclo} · ${this.modo === 'activos' ? 'estudiantes activos' : 'todos los inscriptos'}`]);
    ws.mergeCells(1, 1, 1, cab.length);
    ws.getRow(1).font = { bold: true, size: 12 };
    ws.addRow([]);
    const h = ws.addRow(cab);
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF071B38' } }; });
    filas.forEach((f, i) => {
      const r = ws.addRow(f);
      if (i === filas.length - 1) r.font = { bold: true };
      r.getCell(10).numFmt = '0.0';
      for (let c = 3; c <= cab.length; c++) r.getCell(c).alignment = { horizontal: 'center' };
    });
    ws.getColumn(1).width = 56; ws.getColumn(2).width = 14;
    for (let c = 3; c <= cab.length; c++) ws.getColumn(c).width = 12;
    const borde = { style: 'thin', color: { argb: 'FFBFC8D6' } };
    for (let r = 3; r <= ws.rowCount; r++) for (let c = 1; c <= cab.length; c++) ws.getCell(r, c).border = { top: borde, left: borde, bottom: borde, right: borde };
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `Cifras_por_trayecto_${this.ciclo}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
};

window.SecretariaModulo = SecretariaModulo;
