/* ==========================================================================
   MÓDULO DE FICHAS DE CURSO / ACTA DE EXAMEN (CON PLANTILLA EXCEL EXPORTABLE)
   Archivo: js/actas.js
   ========================================================================== */

const ActasModulo = {
  trayectoSeleccionado: null,

  async inicializar() {
    this.poblarCiclos();
    await this.cargarTrayectosActas();
  },

  poblarCiclos() {
    const select = document.getElementById('filtro-ciclo-actas');
    if (!select) return;

    const anioActual = new Date().getFullYear();
    let html = '';
    for (let anio = anioActual + 1; anio >= 2024; anio--) {
      html += `<option value="${anio}" ${anio === anioActual ? 'selected' : ''}>Ciclo Lectivo ${anio}</option>`;
    }
    select.innerHTML = html;
  },

  async cargarTrayectosActas() {
    const contenedor = document.getElementById('contenedor-modulo-actas');
    const selectCiclo = document.getElementById('filtro-ciclo-actas');
    const ciclo = selectCiclo ? selectCiclo.value : new Date().getFullYear();

    if (!contenedor) return;

    contenedor.innerHTML = '<p style="color: #94a3b8;">Cargando trayectos...</p>';

    try {
      const { data: trayectos, error } = await supabase
        .from('trayectos')
        .select('*, modulos(*)')
        .eq('ciclo_lectivo', Number(ciclo))
        .order('nombre', { ascending: true });

      if (error) throw error;

      if (!trayectos || trayectos.length === 0) {
        contenedor.innerHTML = `<div style="padding: 2rem; text-align: center; color: #94a3b8;">No hay trayectos para el ciclo ${ciclo}.</div>`;
        return;
      }

      let html = `<div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 1.25rem;">`;

      trayectos.forEach((t, idx) => {
        const esActivo = idx === 0;
        if (esActivo) this.trayectoSeleccionado = t;

        html += `
          <button type="button" class="btn btn-tab-trayecto ${esActivo ? 'btn-gold' : 'btn-outline'}" 
                  style="white-space: nowrap; font-size: 0.85rem; padding: 0.5rem 1rem;" 
                  onclick="ActasModulo.seleccionarTrayecto('${t.id}', this)">
            ${t.nombre}
          </button>
        `;
      });

      html += `</div><div id="vista-acta-detalle"></div>`;
      contenedor.innerHTML = html;

      if (this.trayectoSeleccionado) {
        await this.renderizarVistaPrevia(this.trayectoSeleccionado);
      }

    } catch (err) {
      console.error('Error al cargar actas:', err);
    }
  },

  async seleccionarTrayecto(trayectoId, elementoBoton) {
    if (elementoBoton) {
      document.querySelectorAll('.btn-tab-trayecto').forEach(btn => {
        btn.classList.remove('btn-gold');
        btn.classList.add('btn-outline');
      });
      elementoBoton.classList.remove('btn-outline');
      elementoBoton.classList.add('btn-gold');
    }

    const { data: trayecto } = await supabase
      .from('trayectos')
      .select('*, modulos(*)')
      .eq('id', trayectoId)
      .single();

    if (trayecto) {
      this.trayectoSeleccionado = trayecto;
      await this.renderizarVistaPrevia(trayecto);
    }
  },

  /**
   * Vista resumen rápida dentro del sistema
   */
  async renderizarVistaPrevia(trayecto) {
    const vista = document.getElementById('vista-acta-detalle');
    if (!vista) return;

    const { data: inscripciones } = await supabase
      .from('inscripciones')
      .select('*')
      .eq('trayecto_id', trayecto.id);

    const alumnos = inscripciones || [];

    vista.innerHTML = `
      <div style="background: rgba(15,23,42,0.6); padding: 1.5rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 1.5rem;">
        <h3 style="margin: 0 0 0.5rem 0; color: #38bdf8;">${trayecto.nombre}</h3>
        <p style="margin: 0; color: #cbd5e1; font-size: 0.9rem;">Total de estudiantes inscriptos: <strong>${alumnos.length}</strong></p>
        
        <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
          <button type="button" class="btn btn-gold" style="padding: 0.75rem 1.5rem; font-weight: bold;" onclick="ActasModulo.generarExcelOficialDesdePlantilla()">
            📑 Descargar Acta Oficial Rellenada (.XLSX)
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Carga la plantilla original en segundo plano, la rellena y la descarga intacta
   */
  async generarExcelOficialDesdePlantilla() {
    if (!this.trayectoSeleccionado) return;

    try {
      const trayecto = this.trayectoSeleccionado;

      // 1. Obtener inscripciones reales de Supabase
      const { data: inscripciones } = await supabase
        .from('inscripciones')
        .select('*')
        .eq('trayecto_id', trayecto.id);

      const alumnos = inscripciones || [];

      // 2. Cargar el archivo de plantilla original directamente desde el servidor web
      // Asegúrate de que el archivo 'MODELO ASISTENCIA  + NOTAS MODULOS.xlsx' esté en la misma carpeta o subcarpeta
      const response = await fetch('MODELO ASISTENCIA  + NOTAS MODULOS.xlsx');
      const arrayBuffer = await response.arrayBuffer();

      // 3. Abrir la plantilla con ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      // 4. Seleccionar la hoja oficial
      const worksheet = workbook.getWorksheet('ACTA EXAMEN');

      if (!worksheet) {
        alert("No se encontró la hoja 'ACTA EXAMEN' en la plantilla.");
        return;
      }

      // 5. Rellenar Encabezados (Fila 3)
      // Columna O (15): Especialidad | Columna X (24): Curso N°
      worksheet.getCell('O3').value = String(trayecto.nombre || '').toUpperCase();
      worksheet.getCell('X3').value = `CURSO Nº: ${trayecto.id || ''}`;

      // 6. Rellenar la lista de Estudiantes (A partir de la Fila 8)
      const filaInicial = 8;
      
      // Columnas correspondientes a las notas de cada módulo (ACTA I a ACTA IX)
      const columnasNotas = ['F', 'H', 'J', 'L', 'N', 'P', 'R', 'T', 'V'];

      alumnos.forEach((al, idx) => {
        const fila = filaInicial + idx;

        // N° Egresado (Columna A)
        worksheet.getCell(`A${fila}`).value = al.num_egresado || al.numero_egresado || '';

        // N° de Orden (Columna C)
        worksheet.getCell(`C${fila}`).value = idx + 1;

        // Apellido y Nombre (Columna D)
        const nombreCompleto = al.estudiante_nombre || al.estudiante_user || '';
        worksheet.getCell(`D${fila}`).value = String(nombreCompleto).toUpperCase();

        // Cargar Nota (Columna F / Módulo 1)
        const notaVal = al.nota ? parseInt(al.nota, 10) : 8;
        worksheet.getCell('F' + fila).value = notaVal;

        // Documento DNI (Columna X)
        worksheet.getCell(`X${fila}`).value = al.estudiante_dni || '';
      });

      // 7. Descargar el archivo Excel listo con el nombre del trayecto
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Acta_Examen_${trayecto.nombre.replaceAll(' ', '_')}.xlsx`;
      link.click();

    } catch (err) {
      console.error('Error al rellenar la plantilla Excel:', err);
      alert('Asegurate de haber colocado el archivo "MODELO ASISTENCIA  + NOTAS MODULOS.xlsx" en la carpeta raíz del proyecto.');
    }
  }
};

window.ActasModulo = ActasModulo;
