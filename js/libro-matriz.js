/* ==========================================================================
   LIBRO MATRIZ — N.º de curso, N.º de egresado y trayectos realizados
   Registro de solo lectura que se arma con lo que ya se carga en la plataforma:
   · N.º de curso → campo «N° de Curso Oficial» de cada trayecto.
   · N.º de egresado → el que se asigna en Fichas, Actas y Certificados.
   No guarda datos propios: cuando se modifica un número en su lugar de carga,
   el libro lo refleja la próxima vez que se abre o se toca «Actualizar».
   Lo ven Director, Regente, Secretaría y Preceptoría. Se descarga en Excel.
   Datos: función SQL libro_matriz() (sql/62_libro_matriz.sql).
   Archivo: js/libro-matriz.js
   ========================================================================== */

const LibroMatrizModulo = {
  modo: 'cursos',        // 'cursos' | 'egresados'
  ciclo: '',             // '' = todos los ciclos
  filtro: '',
  datos: { cursos: [], egresados: [] },
  cargando: false,

  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  norm(v) {
    return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  },
  fecha(v) {
    const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  },
  nombreCompleto(e) {
    const ap = String(e.apellido || '').trim(), no = String(e.nombre || '').trim();
    return ap && no ? `${ap}, ${no}` : (ap || no || `DNI ${e.dni}`);
  },

  async cargar() {
    const raiz = document.getElementById('libro-matriz-root');
    if (!raiz || this.cargando) return;
    this.cargando = true;
    raiz.innerHTML = '<p class="asis-cargando">Armando el libro matriz…</p>';
    try {
      const { data, error } = await supabase.rpc('libro_matriz', { p_ciclo: this.ciclo ? Number(this.ciclo) : null });
      if (error) throw error;
      this.datos = { cursos: (data && data.cursos) || [], egresados: (data && data.egresados) || [] };
      this.render();
    } catch (err) {
      const falta = /libro_matriz/i.test(err.message || '');
      raiz.innerHTML = `<div class="asis-aviso">No se pudo cargar el libro matriz: ${this.esc(falta ? 'falta ejecutar sql/62 en Supabase.' : (err.message || 'error desconocido'))}</div>`;
    } finally {
      this.cargando = false;
    }
  },

  cambiarModo(m) { this.modo = m; this.render(); },
  cambiarCiclo(v) { this.ciclo = v; this.cargar(); },
  buscar(v) {
    this.filtro = v;
    this.render();
    const inp = document.getElementById('lm-buscar');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  },

  filtrados() {
    const q = this.norm(this.filtro);
    const lista = this.datos[this.modo] || [];
    if (!q) return lista;
    return lista.filter(f => this.norm(Object.values(f).join(' ') + ' ' + (this.modo === 'egresados' ? this.nombreCompleto(f) : '')).includes(q));
  },

  render() {
    const raiz = document.getElementById('libro-matriz-root');
    if (!raiz) return;
    const anio = new Date().getFullYear();
    const ciclos = [anio + 1, anio, anio - 1, anio - 2];
    const cursos = this.datos.cursos, egresados = this.datos.egresados;
    const sinNro = cursos.filter(c => !c.nro_curso).length;
    const filas = this.filtrados();

    raiz.innerHTML = `
      <div style="display:flex;gap:.75rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:1rem">
        <div>
          <label for="lm-ciclo" style="display:block;font-size:.8rem;font-weight:700;margin-bottom:.25rem">Ciclo lectivo</label>
          <select id="lm-ciclo" class="form-control custom-select" style="width:auto" onchange="LibroMatrizModulo.cambiarCiclo(this.value)">
            <option value="">Todos</option>
            ${ciclos.map(c => `<option value="${c}" ${String(c) === String(this.ciclo) ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;min-width:200px">
          <label for="lm-buscar" style="display:block;font-size:.8rem;font-weight:700;margin-bottom:.25rem">Buscar</label>
          <input id="lm-buscar" type="search" class="form-control" placeholder="${this.modo === 'cursos' ? 'N.º de curso, trayecto, resolución…' : 'N.º de egresado, apellido, DNI, trayecto…'}" value="${this.esc(this.filtro)}" oninput="LibroMatrizModulo.buscar(this.value)">
        </div>
        <button type="button" class="btn" onclick="LibroMatrizModulo.cargar()">↻ Actualizar</button>
        <button type="button" class="btn btn-primary" onclick="LibroMatrizModulo.descargar()">⬇ Descargar Excel</button>
      </div>

      <div class="acta-modos" role="tablist" aria-label="Qué registro ver">
        <button type="button" role="tab" class="acta-modo ${this.modo === 'cursos' ? 'activo' : ''}" onclick="LibroMatrizModulo.cambiarModo('cursos')">Cursos (${cursos.length})</button>
        <button type="button" role="tab" class="acta-modo ${this.modo === 'egresados' ? 'activo' : ''}" onclick="LibroMatrizModulo.cambiarModo('egresados')">Egresados (${egresados.length})</button>
      </div>

      ${this.modo === 'cursos' && sinNro ? `<div class="asis-aviso"><strong>${sinNro}</strong> curso(s) todavía no tienen N.º de curso oficial. Se carga en el formulario del trayecto.</div>` : ''}

      <div class="sec-tabla-wrap">
        ${this.modo === 'cursos' ? this.tablaCursos(filas) : this.tablaEgresados(filas)}
      </div>`;
  },

  tablaCursos(filas) {
    return `<table class="sec-tabla">
      <thead><tr><th>N.º de curso</th><th>Trayecto</th><th>Sector</th><th>Ciclo</th><th>Resolución / acto adm.</th><th>Horas</th><th>Inicio</th><th>Cierre</th><th>Inscriptos</th><th>Egresados</th></tr></thead>
      <tbody>
        ${filas.length ? filas.map(c => `<tr>
          <td class="${c.nro_curso ? '' : 'sec-aviso'}"><b>${this.esc(c.nro_curso || '—')}</b></td>
          <td class="sec-nombre">${this.esc(c.nombre)}</td>
          <td>${this.esc(c.sector || '')}</td>
          <td>${this.esc(c.ciclo || '')}</td>
          <td>${this.esc([c.resolucion, c.acto_administrativo].filter(Boolean).join(' · '))}</td>
          <td>${this.esc(c.horas ?? '')}</td>
          <td>${this.esc(this.fecha(c.fecha_inicio))}</td>
          <td>${this.esc(this.fecha(c.fecha_cierre))}</td>
          <td>${c.inscriptos}</td><td><b>${c.egresados}</b></td>
        </tr>`).join('') : '<tr><td colspan="10">No hay cursos para mostrar.</td></tr>'}
      </tbody></table>`;
  },

  tablaEgresados(filas) {
    // Un N.º de egresado repetido se marca: normalmente es un error de carga.
    const veces = {};
    this.datos.egresados.forEach(e => { veces[e.num_egresado] = (veces[e.num_egresado] || 0) + 1; });
    return `<table class="sec-tabla">
      <thead><tr><th>N.º de egresado</th><th>Apellido y nombre</th><th>DNI</th><th>Trayecto realizado</th><th>N.º de curso</th><th>Ciclo</th><th>Egreso</th><th>Entrega</th></tr></thead>
      <tbody>
        ${filas.length ? filas.map(e => `<tr>
          <td class="${veces[e.num_egresado] > 1 ? 'sec-aviso' : ''}" title="${veces[e.num_egresado] > 1 ? 'Número repetido' : ''}"><b>${this.esc(e.num_egresado)}</b></td>
          <td class="sec-nombre">${this.esc(this.nombreCompleto(e))}</td>
          <td>${this.esc(e.dni)}</td>
          <td>${this.esc(e.trayecto)}</td>
          <td>${this.esc(e.nro_curso || '—')}</td>
          <td>${this.esc(e.ciclo || '')}</td>
          <td>${this.esc(this.fecha(e.fecha_egreso))}</td>
          <td>${this.esc(this.fecha(e.fecha_entrega))}</td>
        </tr>`).join('') : '<tr><td colspan="8">Todavía no hay egresados con N.º cargado.</td></tr>'}
      </tbody></table>`;
  },

  /* ---------- Excel: las dos hojas completas del ciclo elegido ---------- */
  async descargar() {
    if (typeof ExcelJS === 'undefined') { alert('No se cargó el generador de Excel. Revisá la conexión y probá de nuevo.'); return; }
    const wb = new ExcelJS.Workbook();
    const estilo = (ws, anchos) => {
      ws.columns.forEach((c, i) => { c.width = anchos[i]; });
      const cab = ws.getRow(1);
      cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cab.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cab.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } }; });
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: anchos.length } };
    };

    const wc = wb.addWorksheet('Cursos');
    wc.addRow(['N.º de curso', 'Trayecto', 'Sector', 'Ciclo', 'Resolución', 'Acto administrativo', 'Código', 'Horas', 'Inicio', 'Cierre', 'Sede', 'Inscriptos', 'Egresados']);
    this.datos.cursos.forEach(c => wc.addRow([c.nro_curso || '', c.nombre, c.sector || '', c.ciclo || '', c.resolucion || '', c.acto_administrativo || '', c.codigo_catalogo || '', c.horas ?? '', this.fecha(c.fecha_inicio), this.fecha(c.fecha_cierre), c.sede || '', c.inscriptos, c.egresados]));
    estilo(wc, [14, 42, 22, 8, 18, 22, 10, 8, 12, 12, 18, 11, 11]);

    const we = wb.addWorksheet('Egresados');
    we.addRow(['N.º de egresado', 'Apellido y nombre', 'DNI', 'Trayecto realizado', 'N.º de curso', 'Ciclo', 'Fecha de egreso', 'Fecha de entrega']);
    this.datos.egresados.forEach(e => we.addRow([e.num_egresado, this.nombreCompleto(e), e.dni, e.trayecto, e.nro_curso || '', e.ciclo || '', this.fecha(e.fecha_egreso), this.fecha(e.fecha_entrega)]));
    estilo(we, [16, 34, 14, 42, 14, 8, 15, 15]);

    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `Libro-matriz-CFP403${this.ciclo ? '-' + this.ciclo : ''}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
};

window.LibroMatrizModulo = LibroMatrizModulo;
