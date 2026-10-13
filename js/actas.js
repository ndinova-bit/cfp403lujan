/* ==========================================================================
   MÓDULO DE FICHAS DE CURSO / ACTA DE EXAMEN OFICIAL (CFP N° 403)
   Archivo: js/actas.js
   ========================================================================== */

const ActasModulo = {
  trayectoSeleccionado: null,

  /**
   * Conversión de nota numérica a texto en mayúsculas (Función númeroatexto del Excel)
   */
  numeroATexto(nota) {
    if (nota === null || nota === undefined || nota === '' || nota === '-') return '';
    const num = parseInt(String(nota).trim(), 10);
    const equivalencias = {
      1: 'UNO', 2: 'DOS', 3: 'TRES', 4: 'CUATRO', 5: 'CINCO',
      6: 'SEIS', 7: 'SIETE', 8: 'OCHO', 9: 'NUEVE', 10: 'DIEZ'
    };
    return equivalencias[num] || String(nota).toUpperCase();
  },

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

    contenedor.innerHTML = '<p style="color: #94a3b8; font-size: 0.9rem;">Cargando trayectos...</p>';

    try {
      const { data: trayectos, error } = await supabase
        .from('trayectos')
        .select('*, modulos(*)')
        .eq('ciclo_lectivo', Number(ciclo))
        .order('nombre', { ascending: true });

      if (error) throw error;

      if (!trayectos || trayectos.length === 0) {
        contenedor.innerHTML = `
          <div style="text-align: center; padding: 2.5rem; background: rgba(15,23,42,0.4); border-radius: 8px;">
            <p style="color: #94a3b8; margin: 0;">No hay trayectos ni actas para el Ciclo Lectivo ${ciclo}.</p>
          </div>
        `;
        return;
      }

      // Solapas de Trayectos
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
        await this.renderizarActaOficial(this.trayectoSeleccionado);
      }

    } catch (err) {
      console.error('Error al cargar actas:', err);
      contenedor.innerHTML = '<p style="color: #f87171;">Error al cargar las actas.</p>';
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
      await this.renderizarActaOficial(trayecto);
    }
  },

  /**
   * Renderizado réplica de la planilla oficial "ACTA EXAMEN" (hasta 10 Módulos)
   */
  async renderizarActaOficial(trayecto) {
    const vistaDetalle = document.getElementById('vista-acta-detalle');
    if (!vistaDetalle) return;

    vistaDetalle.innerHTML = '<p style="color: #94a3b8;">Generando Planilla de Acta Oficial...</p>';

    try {
      const { data: inscripciones } = await supabase
        .from('inscripciones')
        .select('*')
        .eq('trayecto_id', trayecto.id);

      const alumnos = inscripciones || [];
      const modulos = trayecto.modulos || [];
      
      // AJUSTE: Permite hasta 10 Módulos (ACTA I a ACTA X)
      const cantModulos = Math.min(Math.max(modulos.length, 1), 10);

      const alumnosPorPagina = 30;
      const totalPaginas = Math.max(Math.ceil(alumnos.length / alumnosPorPagina), 1);

      let htmlContenido = `
        <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <span style="color: #cbd5e1; font-size: 0.9rem;">Impresión oficial con formato institucional de 30 estudiantes por hoja.</span>
          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-gold" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
            <button type="button" class="btn btn-secondary" onclick="ReportesModulo.exportarExcelTabla('tabla-acta-oficial-1', 'Acta_Examen_${trayecto.nombre.replaceAll(' ', '_')}.csv')">📥 Exportar CSV</button>
          </div>
        </div>
      `;

      // Renderizar páginas de 30 estudiantes
      for (let pag = 0; pag < totalPaginas; pag++) {
        const alumnosPagina = alumnos.slice(pag * alumnosPorPagina, (pag + 1) * alumnosPorPagina);
        const hoy = new Date();

        htmlContenido += `
          <!-- CONTENEDOR DE HOJA OFICIAL (Fondo blanco, formato impreso) -->
          <div class="hoja-acta-oficial" style="background: #ffffff; color: #000000; padding: 20px; border-radius: 4px; font-family: 'Inter', Arial, sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.3); margin-bottom: 2rem; border: 1px solid #ccc; overflow-x: auto;">
            
            <!-- ENCABEZADO SUPERIOR DGCyE -->
            <div style="text-align: center; font-size: 11px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 10px;">
              Dirección General de Cultura y Educación - Dirección de Formación Profesional
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: #000;">CFP N° 403 "OSCAR SMITH"</h3>
              <h2 style="margin: 0; font-size: 16px; font-weight: bold; text-decoration: underline; color: #000;">ACTA DE EXAMEN</h2>
            </div>

            <!-- TEXTO FORMAL DEL ACTA -->
            <div style="font-size: 11px; line-height: 1.4; margin-bottom: 12px; text-align: justify;">
              En dependencias del Centro de Formación Profesional N° 403 de la localidad de Luján domicilio en <strong>Lavalle 740</strong>, 
              a los <u>&nbsp; ${hoy.getDate()} &nbsp;</u> días del mes de <u>&nbsp; ${hoy.toLocaleString('es-AR', { month: 'long' })} &nbsp;</u> del año <u>&nbsp; ${hoy.getFullYear()} &nbsp;</u> 
              se reúne la Comisión Examinadora, con el objetivo de llevar a cabo la evaluación final a los alumnos del curso cuya Especialidad y N° están detallados en la presente, llegando al resultado que se consigna a continuación:
              <br><br>
              <strong>ESPECIALIDAD:</strong> <u>&nbsp; ${trayecto.nombre.toUpperCase()} &nbsp;</u> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
              <strong>CURSO Nº:</strong> <u>&nbsp; ${trayecto.id} &nbsp;</u>
            </div>

            <!-- TABLA PRINCIPAL DE NOTAS -->
            <table id="tabla-acta-oficial-${pag+1}" style="width: 100%; border-collapse: collapse; font-size: 9.5px; color: #000; border: 1px solid #000;">
              <thead>
                <tr style="background: #f0f0f0; text-align: center; font-weight: bold;">
                  <td rowspan="2" style="border: 1px solid #000; width: 55px; padding: 3px;">N°<br>Egresado</td>
                  <td rowspan="2" style="border: 1px solid #000; width: 22px; padding: 3px;">N°</td>
                  <td rowspan="2" style="border: 1px solid #000; text-align: left; padding: 3px; min-width: 150px;">APELLIDO Y NOMBRES</td>
        `;

        for (let m = 1; m <= cantModulos; m++) {
          htmlContenido += `<td colspan="2" style="border: 1px solid #000; padding: 2px;">ACTA ${this.romano(m)}</td>`;
        }

        htmlContenido += `
                  <td rowspan="2" style="border: 1px solid #000; width: 70px; padding: 3px;">DOCUMENTO<br>DNI N°</td>
                </tr>
                <tr style="background: #fcfcfc; text-align: center; font-size: 8.5px; font-weight: bold;">
        `;

        for (let m = 1; m <= cantModulos; m++) {
          htmlContenido += `<td style="border: 1px solid #000; width: 22px;">N°</td><td style="border: 1px solid #000; width: 50px;">NUMERO</td>`;
        }

        htmlContenido += `</tr></thead><tbody>`;

        // Llenar filas (30 por hoja)
        let aprobadosContador = 0;
        let desaprobadosContador = 0;
        let ausentesContador = 0;

        for (let i = 0; i < 30; i++) {
          const alumno = alumnosPagina[i];
          const numOrden = (pag * alumnosPorPagina) + (i + 1);

          if (alumno) {
            const numEg = alumno.num_egresado || alumno.numero_egresado || '';
            const nombreCompleto = (alumno.estudiante_nombre || alumno.estudiante_user || '').toUpperCase();
            const dniVal = alumno.estudiante_dni || alumno.estudiante_user || '';
            const notaVal = alumno.nota || '8';
            const notaTexto = this.numeroATexto(notaVal);

            if (parseInt(notaVal, 10) >= 7) aprobadosContador++;
            else if (notaVal === '-') ausentesContador++;
            else desaprobadosContador++;

            htmlContenido += `
              <tr style="height: 18px; text-align: center;">
                <td style="border: 1px solid #000; font-weight: bold;">${numEg}</td>
                <td style="border: 1px solid #000;">${numOrden}</td>
                <td style="border: 1px solid #000; text-align: left; padding-left: 4px; font-weight: 500;">${nombreCompleto}</td>
            `;

            for (let m = 1; m <= cantModulos; m++) {
              htmlContenido += `
                <td style="border: 1px solid #000; font-weight: bold;">${notaVal}</td>
                <td style="border: 1px solid #000; font-size: 8px;">${notaTexto}</td>
              `;
            }

            htmlContenido += `<td style="border: 1px solid #000;">${dniVal}</td></tr>`;

          } else {
            // Filas vacías para completar los 30 renglones oficiales de la hoja
            htmlContenido += `
              <tr style="height: 18px;">
                <td style="border: 1px solid #000;"></td>
                <td style="border: 1px solid #000; text-align: center; color: #888;">${numOrden}</td>
                <td style="border: 1px solid #000;"></td>
            `;
            for (let m = 1; m <= cantModulos; m++) {
              htmlContenido += `<td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>`;
            }
            htmlContenido += `<td style="border: 1px solid #000;"></td></tr>`;
          }
        }

        htmlContenido += `</tbody></table>`;

        // PIE DE HOJA (Cuadro de Resumen Estadístico y Bloque de Firmas)
        htmlContenido += `
          <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9.5px;">
            <div>
              <p style="margin: 0; font-size: 8.5px; font-style: italic;">* Se considerará aprobado con un mínimo de 70 puntos.</p>
              <br>
              <!-- BLOQUE DE FIRMAS -->
              <div style="display: flex; gap: 30px; margin-top: 20px; text-align: center;">
                <div>______________________<br><strong>Vocal 1</strong></div>
                <div>______________________<br><strong>Presidente</strong></div>
                <div>______________________<br><strong>Director</strong></div>
                <div>______________________<br><strong>Inspector</strong></div>
              </div>
            </div>

            <!-- CUADRO ESTADÍSTICO DE RESULTADOS -->
            <table style="border-collapse: collapse; font-size: 9px; border: 1px solid #000; width: 135px; text-align: left;">
              <tr><td style="border: 1px solid #000; padding: 2px 4px;">Inscriptos:</td><td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; text-align: right;">${alumnosPagina.length}</td></tr>
              <tr><td style="border: 1px solid #000; padding: 2px 4px;">Examinados:</td><td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; text-align: right;">${alumnosPagina.length - ausentesContador}</td></tr>
              <tr><td style="border: 1px solid #000; padding: 2px 4px;">Ausentes:</td><td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; text-align: right;">${ausentesContador}</td></tr>
              <tr><td style="border: 1px solid #000; padding: 2px 4px;">Desaprobados:</td><td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; text-align: right;">${desaprobadosContador}</td></tr>
              <tr style="background: #f0f0f0;"><td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">APROBADOS:</td><td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; text-align: right;">${aprobadosContador}</td></tr>
            </table>
          </div>

          </div> <!-- FIN HOJA OFICIAL -->
        `;
      }

      vistaDetalle.innerHTML = htmlContenido;

    } catch (err) {
      console.error('Error al renderizar el acta oficial:', err);
      vistaDetalle.innerHTML = '<p style="color: #f87171;">Error al generar el acta oficial.</p>';
    }
  },

  romano(n) {
    const map = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return map[n - 1] || String(n);
  }
};

window.ActasModulo = ActasModulo;
