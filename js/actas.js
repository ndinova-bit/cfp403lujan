/* ==========================================================================
   MÓDULO DE FICHAS DE CURSO / ACTAS DE EXAMEN (PASO 4 INTEGRADO)
   Archivo: js/actas.js
   ========================================================================== */

const ActasModulo = {
  trayectoSeleccionado: null,

  /**
   * Conversión automática de notas numéricas a letras (Reemplaza función VBA/Excel)
   * @param {string|number} nota 
   * @returns {string} Nota expresada en palabras
   */
  numeroATexto(nota) {
    if (nota === null || nota === undefined || nota === '' || nota === '-') return '-';
    
    // Normalizar texto o número
    const num = parseInt(String(nota).trim(), 10);
    
    const equivalencias = {
      1: 'UNO',
      2: 'DOS',
      3: 'TRES',
      4: 'CUATRO',
      5: 'CINCO',
      6: 'SEIS',
      7: 'SIETE',
      8: 'OCHO',
      9: 'NUEVE',
      10: 'DIEZ'
    };

    return equivalencias[num] || String(nota).toUpperCase();
  },

  /**
   * Inicialización del módulo al seleccionar la pestaña
   */
  async inicializar() {
    this.poblarCiclos();
    await this.cargarTrayectosActas();
  },

  /**
   * Carga el selector de ciclos lectivos
   */
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

  /**
   * Carga la lista de trayectos pertenecientes al ciclo lectivo seleccionado
   */
  async cargarTrayectosActas() {
    const contenedor = document.getElementById('contenedor-modulo-actas');
    const selectCiclo = document.getElementById('filtro-ciclo-actas');
    const ciclo = selectCiclo ? selectCiclo.value : new Date().getFullYear();

    if (!contenedor) return;

    contenedor.innerHTML = '<p style="color: #94a3b8; font-size: 0.9rem;">Cargando trayectos y actas...</p>';

    try {
      const { data: trayectos, error } = await supabase
        .from('trayectos')
        .select('*, modulos(*)')
        .eq('ciclo_lectivo', Number(ciclo))
        .order('nombre', { ascending: true });

      if (error) throw error;

      if (!trayectos || trayectos.length === 0) {
        contenedor.innerHTML = `
          <div style="text-align: center; padding: 2.5rem; background: rgba(15,23,42,0.4); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <p style="color: #94a3b8; margin: 0; font-size: 0.95rem;">No hay trayectos ni actas registradas para el Ciclo Lectivo ${ciclo}.</p>
          </div>
        `;
        return;
      }

      // Renderizar solapas horizontales de trayectos
      let html = `
        <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 1.25rem;">
      `;

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
        await this.renderizarActa(this.trayectoSeleccionado);
      }

    } catch (err) {
      console.error('Error al cargar actas:', err);
      contenedor.innerHTML = '<p style="color: #f87171; font-size: 0.9rem;">Error al cargar las fichas de curso.</p>';
    }
  },

  /**
   * Cambia la solapa activa del trayecto
   */
  async seleccionarTrayecto(trayectoId, elementoBoton) {
    if (elementoBoton) {
      document.querySelectorAll('.btn-tab-trayecto').forEach(btn => {
        btn.classList.remove('btn-gold');
        btn.classList.add('btn-outline');
      });
      elementoBoton.classList.remove('btn-outline');
      elementoBoton.classList.add('btn-gold');
    }

    try {
      const { data: trayecto, error } = await supabase
        .from('trayectos')
        .select('*, modulos(*)')
        .eq('id', trayectoId)
        .single();

      if (error) throw error;

      if (trayecto) {
        this.trayectoSeleccionado = trayecto;
        await this.renderizarActa(trayecto);
      }
    } catch (err) {
      console.error('Error al seleccionar trayecto:', err);
    }
  },

  /**
   * Renderiza la planilla del acta oficial con hasta 10 módulos
   */
  async renderizarActa(trayecto) {
    const vistaDetalle = document.getElementById('vista-acta-detalle');
    if (!vistaDetalle) return;

    vistaDetalle.innerHTML = '<p style="color: #94a3b8; font-size: 0.9rem;">Cargando nómina y calificaciones por módulo...</p>';

    try {
      // Cargar inscriptos en este trayecto
      const { data: inscripciones, error } = await supabase
        .from('inscripciones')
        .select('*')
        .eq('trayecto_id', trayecto.id);

      if (error) throw error;

      const alumnos = inscripciones || [];
      const modulos = trayecto.modulos || [];
      const cantModulos = Math.min(modulos.length || 1, 10); // Límite máximo de 10 módulos

      let html = `
        <div style="background: rgba(15, 23, 42, 0.6); padding: 1.25rem; border-radius: 8px; margin-bottom: 1.25rem; border: 1px solid rgba(255,255,255,0.08);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h4 style="margin: 0 0 0.25rem 0; color: #38bdf8; font-size: 1.05rem;">CFP N° 403 "OSCAR SMITH" - Luján (Lavalle 740)</h4>
              <p style="margin: 0; font-size: 0.85rem; color: #cbd5e1;">
                <strong>Curso / Trayecto:</strong> ${trayecto.nombre} | <strong>Resolución:</strong> ${trayecto.resolucion || 'S/D'}
              </p>
            </div>
            <span style="font-size: 0.8rem; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 0.35rem 0.75rem; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: 600;">
              Módulos Activos: ${cantModulos} / 10
            </span>
          </div>
        </div>

        <div style="overflow-x: auto; background: #0f172a; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
          <table id="tabla-acta-oficial" style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
            <thead>
              <tr style="background: #1e293b; color: #94a3b8; border-bottom: 2px solid rgba(255,255,255,0.1);">
                <th style="padding: 0.75rem; text-align: center; border-right: 1px solid rgba(255,255,255,0.05);">N° Eg.</th>
                <th style="padding: 0.75rem; text-align: center; border-right: 1px solid rgba(255,255,255,0.05);">Orden</th>
                <th style="padding: 0.75rem; border-right: 1px solid rgba(255,255,255,0.05);">Apellido y Nombres</th>
      `;

      // Columnas dobles de Módulos (Nota y Texto)
      for (let i = 1; i <= cantModulos; i++) {
        const nombreMod = modulos[i - 1] ? (modulos[i - 1].nombre || `MÓDULO ${i}`) : `MÓDULO ${i}`;
        html += `<th style="padding: 0.75rem; text-align: center; border-right: 1px solid rgba(255,255,255,0.05);" colspan="2" title="${nombreMod}">ACTA ${i}</th>`;
      }

      html += `
              </tr>
              <tr style="background: #0f172a; color: #64748b; font-size: 0.72rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <th style="border-right: 1px solid rgba(255,255,255,0.05);"></th>
                <th style="border-right: 1px solid rgba(255,255,255,0.05);"></th>
                <th style="border-right: 1px solid rgba(255,255,255,0.05);"></th>
      `;

      for (let i = 1; i <= cantModulos; i++) {
        html += `
          <th style="text-align: center; padding: 0.3rem;">Num</th>
          <th style="text-align: center; padding: 0.3rem; border-right: 1px solid rgba(255,255,255,0.05);">Letras</th>
        `;
      }

      html += `</tr></thead><tbody>`;

      if (alumnos.length === 0) {
        html += `
          <tr>
            <td colspan="${3 + (cantModulos * 2)}" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
              No hay estudiantes inscriptos en este trayecto.
            </td>
          </tr>
        `;
      } else {
        alumnos.forEach((al, idx) => {
          const numEg = al.num_egresado || al.numero_egresado || '-';
          const nombreAlumno = al.estudiante_nombre || al.estudiante_user || `Estudiante #${idx + 1}`;
          
          // Nota registrada o valor por defecto
          const notaDefecto = al.nota || '8';

          html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 0.6rem; text-align: center; font-weight: 700; color: #fde047; border-right: 1px solid rgba(255,255,255,0.05);">${numEg}</td>
              <td style="padding: 0.6rem; text-align: center; color: #94a3b8; border-right: 1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
              <td style="padding: 0.6rem; color: #f8fafc; font-weight: 600; border-right: 1px solid rgba(255,255,255,0.05);">${nombreAlumno}</td>
          `;

          // Generación de columnas de notas numéricas y convertidas a texto
          for (let m = 1; m <= cantModulos; m++) {
            const notaTexto = ActasModulo.numeroATexto(notaDefecto);
            html += `
              <td style="padding: 0.6rem; text-align: center; color: #4ade80; font-weight: 700;">${notaDefecto}</td>
              <td style="padding: 0.6rem; text-align: center; color: #cbd5e1; font-size: 0.75rem; border-right: 1px solid rgba(255,255,255,0.05);">${notaTexto}</td>
            `;
          }

          html += `</tr>`;
        });
      }

      html += `</tbody></table></div>`;

      // Botón de Exportación a Excel/CSV usando ReportesModulo
      html += `
        <div style="margin-top: 1.25rem; display: flex; justify-content: flex-end;">
          <button type="button" class="btn btn-gold" style="padding: 0.6rem 1.2rem; font-weight: 600;" onclick="ReportesModulo.exportarExcelTabla('tabla-acta-oficial', 'Acta_Examen_${trayecto.nombre.replaceAll(' ', '_')}.csv')">
            📥 Exportar Acta Oficial a Excel / CSV
          </button>
        </div>
      `;

      vistaDetalle.innerHTML = html;

    } catch (err) {
      console.error('Error al renderizar la planilla del acta:', err);
      vistaDetalle.innerHTML = '<p style="color: #f87171; font-size: 0.9rem;">Error al cargar los datos del acta.</p>';
    }
  }
};

// Exportación global
window.ActasModulo = ActasModulo;
