/* ==========================================================================
   MATRÍCULA ESCOLAR (cuadros 1.1, 1.2 y 1.3 del Relevamiento Anual)
   Se muestra dentro de "Cifras por trayecto": por cada trayecto del ciclo, total de
   alumnos, varones y alumnos por edad al 30 de junio, con los mismos tramos del
   formulario oficial (1.1); y, para quien tiene acceso, extranjeros por país/continente
   (1.2) y discapacidad (1.3). Se descarga en Excel con las columnas en el mismo orden.
   Solo números: no muestra datos personales de nadie.
   Archivo: js/matricula_escolar.js
   ========================================================================== */

const MatriculaEscolar = {
  abierta: false,
  datos: null,        // { ciclo, activos, filas } | null
  inclusion: null,    // totales de país de origen y discapacidad (Dirección y Preceptoría) | null
  error: null,

  PAISES_COL: ['Bolivia', 'Brasil', 'Chile', 'Colombia', 'Ecuador', 'Paraguay', 'Perú', 'Uruguay', 'Venezuela',
               'Otros países de América', 'Europa', 'Asia', 'África', 'Oceanía'],

  TRAMOS: ['Menos de 13', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24',
           '25 a 29', '30 a 34', '35 a 39', '40 a 44', '45 a 49', '50 a 54', '55 y más'],

  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  num(n) { return Number(n || 0); },

  // Duración en horas cátedra: la cargada o, si falta, horas reloj x 1,5 (igual que la planilla POF/POFA)
  horasCatedra(f) {
    if (f.horas_catedra) return Number(f.horas_catedra);
    return f.horas ? Math.round(Number(f.horas) * 1.5) : null;
  },

  async abrir() {
    this.abierta = true;
    await this.cargarDatos();
    SecretariaModulo.dibujar();
    document.getElementById('sec-matricula-escolar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  cerrar() {
    this.abierta = false;
    SecretariaModulo.dibujar();
  },

  async cargarDatos() {
    const ciclo = Number(SecretariaModulo.ciclo);
    const activos = SecretariaModulo.modo === 'activos';
    this.error = null;
    try {
      const { data, error } = await supabase.rpc('matricula_escolar', { p_ciclo: ciclo, p_solo_activos: activos });
      if (error) throw error;
      this.datos = { ciclo, activos, filas: Array.isArray(data) ? data : [] };
      // Cuadros 1.2 y 1.3: dato sensible, solo para Dirección y Preceptoría (si no hay acceso, no se muestran)
      this.inclusion = null;
      try {
        const r = await supabase.rpc('relevamiento_inclusion', { p_ciclo: ciclo, p_solo_activos: activos });
        if (!r.error && r.data) this.inclusion = r.data;
      } catch (e) { /* sin acceso o sin el SQL 41/42: se muestra solo el cuadro 1.1 */ }
    } catch (err) {
      console.error('Matrícula escolar:', err);
      this.datos = null;
      this.error = /matricula_escolar|function|PGRST202/i.test(err.message || '')
        ? 'Falta ejecutar <strong>sql/40_matricula_escolar.sql</strong> en Supabase.'
        : 'No se pudo armar el cuadro. Probá recargar la página.';
    }
  },

  totales(filas) {
    const t = { total: 0, varones: 0, sinEdad: 0, sinGenero: 0, edades: Array(20).fill(0) };
    filas.forEach(f => {
      t.total += this.num(f.total); t.varones += this.num(f.varones);
      t.sinEdad += this.num(f.sin_edad); t.sinGenero += this.num(f.sin_genero);
      (f.edades || []).forEach((n, i) => { t.edades[i] += this.num(n); });
    });
    return t;
  },

  /* Bloque que se inserta en el panel de Cifras por trayecto */
  html() {
    if (!this.abierta) return '';
    if (this.error) return `<section id="sec-matricula-escolar" class="demo-panel"><div class="prog-vacio">${this.error}</div></section>`;
    if (!this.datos) return '<section id="sec-matricula-escolar" class="demo-panel"><p class="seg-cargando">Calculando matrícula escolar…</p></section>';
    const { ciclo, activos, filas } = this.datos;
    const t = this.totales(filas);
    const avisos = [];
    if (t.sinEdad) avisos.push(`<strong>${t.sinEdad}</strong> estudiante(s) sin fecha de nacimiento: no figuran en ningún tramo de edad (sí en el total).`);
    if (t.sinGenero) avisos.push(`<strong>${t.sinGenero}</strong> estudiante(s) sin género cargado: no se cuentan como varones.`);
    return `<section id="sec-matricula-escolar" class="demo-panel">
      <div class="demo-cab">
        <div><h3>Matrícula escolar · Relevamiento Anual ${this.esc(ciclo)}</h3>
          <p class="acta-ayuda">Alumnos por certificado/constancia, por sexo y por edad en años cumplidos al 30 de junio de ${this.esc(ciclo)} · ${activos ? 'sin bajas' : 'con bajas'} · mismo orden de columnas que el cuadro 1.1 del formulario.</p></div>
        <div class="sec-acciones">
          <button type="button" class="btn btn-gold" onclick="MatriculaEscolar.excel()" ${filas.length ? '' : 'disabled'}>📊 Descargar Excel</button>
          <button type="button" class="btn btn-outline" onclick="MatriculaEscolar.cerrar()">Cerrar</button>
        </div>
      </div>
      ${avisos.map(a => `<div class="asis-aviso">${a}</div>`).join('')}
      <div class="sec-tabla-wrap">
        <table class="sec-tabla matesc-tabla">
          <thead><tr>
            <th>Certificado / Constancia</th><th>N.º sección</th><th>Horas cátedra</th><th>Localización</th>
            <th>Total</th><th>Varones</th>${this.TRAMOS.map(x => `<th>${x}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${filas.length ? filas.map(f => `<tr>
              <td class="sec-nombre">${this.esc([f.codigo, f.nombre].filter(Boolean).join(' '))}</td>
              <td>${this.esc(f.nro || '–')}</td><td>${this.horasCatedra(f) ?? '–'}</td>
              <td>${f.sede === 'fuera' ? 'Radial' : 'Sede'}</td>
              <td><b>${this.num(f.total)}</b></td><td>${this.num(f.varones)}</td>
              ${(f.edades || Array(20).fill(0)).map(n => `<td>${this.num(n) || '·'}</td>`).join('')}
            </tr>`).join('') : `<tr><td colspan="26">No hay trayectos en el ciclo ${this.esc(ciclo)}.</td></tr>`}
          </tbody>
          ${filas.length ? `<tfoot><tr><td>Total</td><td></td><td></td><td></td><td>${t.total}</td><td>${t.varones}</td>${t.edades.map(n => `<td>${n}</td>`).join('')}</tr></tfoot>` : ''}
        </table>
      </div>
      <p class="acta-ayuda">Diseño curricular aprobado, año/nivel, turno y modalidad de dictado no se guardan en la plataforma: se completan en el formulario.</p>
      ${this.htmlInclusion()}
    </section>`;
  },

  /* Cuadros 1.2 (extranjeros por país/continente) y 1.3 (discapacidad): solo totales */
  htmlInclusion() {
    const inc = this.inclusion;
    if (!inc) return '';
    const e = inc.extranjeros || {}, p = e.paises || {}, d = inc.discapacidad || {};
    const totExt = this.PAISES_COL.reduce((a, k) => a + this.num(p[k]), 0);
    const avisos = [];
    if (this.num(e.sin_dato)) avisos.push(`<strong>${this.num(e.sin_dato)}</strong> estudiante(s) sin país de origen cargado: se toman como <strong>argentinos (sin confirmar)</strong>, por eso no figuran en el cuadro 1.2. Conviene corroborarlo en la ficha de cada uno.`);
    const rev = Array.isArray(e.revisar_lista) ? e.revisar_lista : [];
    if (rev.length) {
      avisos.push(`<strong>${this.num(e.revisar)}</strong> estudiante(s) sin país cargado tienen un lugar de nacimiento que parece de otro país. No se cuentan como extranjeros hasta que lo confirmes en la ficha:
        <ul style="margin:.4rem 0 0 1.1rem">${rev.map(r => `<li><button type="button" class="seg-nombre" onclick="FichaAlumno.abrir('${String(r.dni).replace(/[^0-9A-Za-z_-]/g, '')}')">${this.esc(r.nombre)}</button> · nació en: ${this.esc(r.lugar)}</li>`).join('')}</ul>
        ${this.num(e.revisar) > rev.length ? `<small>Se muestran los primeros ${rev.length}.</small>` : ''}`);
    }
    if (this.num(d.sin_dato)) avisos.push(`<strong>${this.num(d.sin_dato)}</strong> estudiante(s) sin dato de discapacidad (se cargan en la ficha del estudiante).`);
    if (this.num(d.apoyo_sin_dato) || this.num(d.cud_sin_dato)) avisos.push('Hay estudiantes con discapacidad a los que les falta indicar el apoyo o el CUD: el total no coincide con la suma de las columnas.');
    return `<h4 style="margin:1.4rem 0 .4rem">1.2 · Alumnos extranjeros por país / continente de origen</h4>
      <div class="sec-tabla-wrap"><table class="sec-tabla matesc-tabla"><thead><tr>${this.PAISES_COL.map(k => `<th>${k}</th>`).join('')}<th>Total</th></tr></thead>
        <tbody><tr>${this.PAISES_COL.map(k => `<td>${this.num(p[k]) || '·'}</td>`).join('')}<td><b>${totExt}</b></td></tr></tbody></table></div>
      <h4 style="margin:1.4rem 0 .4rem">1.3 · Alumnos con algún tipo de discapacidad</h4>
      <div class="sec-tabla-wrap"><table class="sec-tabla matesc-tabla"><thead><tr>
        <th>Con apoyo docente (a)</th><th>Con apoyo no docente (c)</th><th>Sin apoyo a la inclusión (d)</th><th>Total</th><th>Con CUD (1)</th><th>Sin CUD (2)</th></tr></thead>
        <tbody><tr><td>${this.num(d.apoyo_docente)}</td><td>${this.num(d.apoyo_no_docente)}</td><td>${this.num(d.sin_apoyo)}</td><td><b>${this.num(d.total)}</b></td><td>${this.num(d.con_cud)}</td><td>${this.num(d.sin_cud)}</td></tr></tbody></table></div>
      ${avisos.map(a => `<div class="asis-aviso">${a}</div>`).join('')}
      <p class="acta-ayuda">Se cuentan personas (no inscripciones). Como el CFP es de gestión estatal, el apoyo docente va en la columna del sector estatal (a). Son solo totales: no se muestran nombres.</p>`;
  },

  async excel() {
    if (!this.datos || !this.datos.filas.length) return;
    if (typeof ExcelJS === 'undefined') { alert('No se pudo cargar el generador de Excel. Recargá la página.'); return; }
    const { ciclo, activos, filas } = this.datos;
    const t = this.totales(filas);
    const cab = ['Certificado/Constancia', 'N.º de sección', 'Duración (hs cátedra)', 'Requisitos', 'Tipo de localización', 'Total', 'Varones', ...this.TRAMOS];
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Matrícula 1.1', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.addRow([`CFP N.º 403 · Relevamiento Anual ${ciclo} · 1.1 Alumnos por certificado/constancia, sexo y edad (al 30/06/${ciclo}) · ${activos ? 'sin bajas' : 'con bajas'}`]);
    ws.mergeCells(1, 1, 1, cab.length);
    ws.getRow(1).font = { bold: true, size: 12 };
    ws.addRow([]);
    const h = ws.addRow(cab);
    h.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    h.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    h.height = 32;
    h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF071B38' } }; });
    filas.forEach(f => {
      ws.addRow([
        [f.codigo, f.nombre].filter(Boolean).join(' '), f.nro || '', this.horasCatedra(f) ?? '', f.requisitos || '',
        f.sede === 'fuera' ? '2 - Radiales o periféricos' : '1 - Sede', this.num(f.total), this.num(f.varones),
        ...(f.edades || Array(20).fill(0)).map(n => this.num(n))
      ]);
    });
    const r = ws.addRow(['Total', '', '', '', '', t.total, t.varones, ...t.edades]);
    r.font = { bold: true };
    ws.getColumn(1).width = 52; ws.getColumn(2).width = 12; ws.getColumn(3).width = 12; ws.getColumn(4).width = 22; ws.getColumn(5).width = 22;
    for (let c = 6; c <= cab.length; c++) ws.getColumn(c).width = 8;
    const borde = { style: 'thin', color: { argb: 'FFBFC8D6' } };
    for (let i = 3; i <= ws.rowCount; i++) for (let c = 1; c <= cab.length; c++) {
      const cel = ws.getCell(i, c);
      cel.border = { top: borde, left: borde, bottom: borde, right: borde };
      if (c >= 2 && i > 3) cel.alignment = { horizontal: 'center', vertical: 'middle' };
    }
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];
    if (this.inclusion) {
      const inc = this.inclusion, p = (inc.extranjeros || {}).paises || {}, d = inc.discapacidad || {};
      const w2 = wb.addWorksheet('1.2 y 1.3');
      w2.addRow([`CFP N.º 403 · Relevamiento Anual ${ciclo} · 1.2 Alumnos extranjeros por país/continente de origen`]).font = { bold: true, size: 12 };
      const h2 = w2.addRow([...this.PAISES_COL, 'Total']); h2.font = { bold: true };
      w2.addRow([...this.PAISES_COL.map(k => this.num(p[k])), this.PAISES_COL.reduce((a, k) => a + this.num(p[k]), 0)]);
      w2.addRow([]);
      w2.addRow([`1.3 Alumnos con algún tipo de discapacidad`]).font = { bold: true, size: 12 };
      const h3 = w2.addRow(['Con apoyo docente (a)', 'Con apoyo no docente (c)', 'Sin apoyo a la inclusión (d)', 'Total', 'Con CUD (1)', 'Sin CUD (2)']); h3.font = { bold: true };
      w2.addRow([this.num(d.apoyo_docente), this.num(d.apoyo_no_docente), this.num(d.sin_apoyo), this.num(d.total), this.num(d.con_cud), this.num(d.sin_cud)]);
      w2.columns.forEach(c => { c.width = 18; });
      [h2, h3].forEach(h => { h.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
    }
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `Matricula_escolar_${ciclo}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
};

window.MatriculaEscolar = MatriculaEscolar;
