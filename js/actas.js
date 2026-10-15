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

      // 1. Obtener inscripciones reales del trayecto
      const { data: inscripciones, error: errInsc } = await supabase
        .from('inscripciones')
        .select('*')
        .eq('trayecto_id', trayecto.id);

      if (errInsc) throw errInsc;

      if (!inscripciones || inscripciones.length === 0) {
        alert("⚠️ No hay estudiantes inscriptos en este trayecto para generar el acta.");
        return;
      }

      // 2. Traer los datos personales completos (Nombre, Apellido, DNI) desde la tabla 'usuarios'
      const listaDNIs = inscripciones.map(i => String(i.estudiante_user));
      
      const { data: datosUsuarios } = await supabase
        .from('usuarios')
        .select('*')
        .in('usuario', listaDNIs);

      // Mapa rápido de consulta por DNI
      const mapaUsuarios = {};
      (datosUsuarios || []).forEach(u => {
        mapaUsuarios[String(u.usuario || u.dni || u.id)] = u;
      });

      // 3. Armar la lista combinada y ordenarla alfabéticamente por APELLIDO
      const listaEstudiantes = inscripciones.map(ins => {
        const key = String(ins.estudiante_user);
        const usr = mapaUsuarios[key] || {};
        
        const apStr = (usr.apellido || '').toUpperCase().trim();
        const nomStr = (usr.nombre || '').toUpperCase().trim();
        const nombreCompleto = apStr && nomStr ? `${apStr}, ${nomStr}` : (apStr || nomStr || `DNI: ${key}`);

        return {
          dni: key,
          nombreCompleto: nombreCompleto,
          numEgresado: ins.num_egresado || ins.numero_egresado || '',
          nota: ins.nota ? parseInt(ins.nota, 10) : 8
        };
      });

      listaEstudiantes.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

      // 4. Cargar el archivo de plantilla original directamente desde el servidor web
      const response = await fetch('MODELO ASISTENCIA  + NOTAS MODULOS.xlsx');
      const arrayBuffer = await response.arrayBuffer();

      // 5. Abrir la plantilla con ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      // 6. Seleccionar la hoja oficial
      const worksheet = workbook.getWorksheet('ACTA EXAMEN');

      if (!worksheet) {
        alert("No se encontró la hoja 'ACTA EXAMEN' en la plantilla.");
        return;
      }

      // 7. Rellenar Encabezados (Fila 3)
      worksheet.getCell('O3').value = String(trayecto.nombre || '').toUpperCase();
      worksheet.getCell('X3').value = `CURSO Nº: ${trayecto.id || ''}`;

      // 8. Rellenar la lista de Estudiantes (Fila 8 en adelante)
      const filaInicial = 8;

      listaEstudiantes.forEach((al, idx) => {
        const fila = filaInicial + idx;

        // N° Egresado (Columna A)
        worksheet.getCell(`A${fila}`).value = al.numEgresado;

        // N° de Orden (Columna C)
        worksheet.getCell(`C${fila}`).value = idx + 1;

        // Apellido y Nombre (Columna D)
        worksheet.getCell(`D${fila}`).value = al.nombreCompleto;

        // Cargar Nota (Columna F / Módulo 1)
        worksheet.getCell(`F${fila}`).value = al.nota;

        // Documento DNI (Columna X)
        worksheet.getCell(`X${fila}`).value = al.dni;
      });

      // 9. Descargar el archivo Excel listo con el nombre del trayecto
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Acta_Examen_${trayecto.nombre.replaceAll(' ', '_')}.xlsx`;
      link.click();

    } catch (err) {
      console.error('Error al rellenar la plantilla Excel:', err);
      alert('Ocurrió un error al procesar el acta. Verificá la consola.');
    }
  }

window.ActasModulo = ActasModulo;
