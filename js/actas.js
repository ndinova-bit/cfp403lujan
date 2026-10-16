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

  async generarExcelOficialDesdePlantilla() {
    if (!this.trayectoSeleccionado) return;

    try {
      // 1. Consulta al trayecto en Supabase
      const { data: trayecto, error: errTray } = await supabase
        .from('trayectos')
        .select('*')
        .eq('id', this.trayectoSeleccionado.id)
        .single();

      if (errTray || !trayecto) throw errTray || new Error("No se pudo obtener el trayecto.");

      // 2. Obtener inscripciones
      const { data: inscripciones, error: errInsc } = await supabase
        .from('inscripciones')
        .select('*')
        .eq('trayecto_id', trayecto.id);

      if (errInsc) throw errInsc;

      if (!inscripciones || inscripciones.length === 0) {
        alert("⚠️ No hay estudiantes inscriptos en este trayecto para generar el acta.");
        return;
      }

      // 3. Cargar módulos del trayecto
      const { data: modulos } = await supabase
        .from('modulos')
        .select('id, nombre')
        .eq('trayecto_id', Number(trayecto.id))
        .order('id', { ascending: true });

      // 4. Cargar clases y entregas
      const { data: clases } = await supabase
        .from('clases')
        .select('id, modulo_id')
        .eq('trayecto_id', Number(trayecto.id));

      const idsClases = (clases || []).map(c => c.id);
      let entregas = [];
      if (idsClases.length > 0) {
        const { data: ent } = await supabase
          .from('entregas_actividades')
          .select('*')
          .in('clase_id', idsClases);
        entregas = ent || [];
      }

      // 5. Cargar asistencias
      const { data: asistencias } = await supabase
        .from('asistencias')
        .select('*')
        .eq('trayecto_id', Number(trayecto.id));

      // 6. Traer datos personales de usuarios
      const listaDNIs = inscripciones.map(i => String(i.estudiante_user));
      const { data: datosUsuarios } = await supabase
        .from('usuarios')
        .select('*')
        .in('usuario', listaDNIs);

      const mapaUsuarios = {};
      (datosUsuarios || []).forEach(u => {
        mapaUsuarios[String(u.usuario || u.dni || u.id)] = u;
      });

      // 7. Armar lista de estudiantes
      const listaEstudiantes = inscripciones.map(ins => {
        const userKey = String(ins.estudiante_user);
        const usr = mapaUsuarios[userKey] || {};
        
        const apStr = (usr.apellido || '').toUpperCase().trim();
        const nomStr = (usr.nombre || '').toUpperCase().trim();
        const nombreCompleto = apStr && nomStr ? `${apStr}, ${nomStr}` : (apStr || nomStr || `DNI: ${userKey}`);

        const notasModulos = [];

        (modulos || []).forEach(mod => {
          const clasesMod = (clases || []).filter(c => Number(c.modulo_id) === Number(mod.id)).map(c => c.id);
          const entregasAlumnoMod = entregas.filter(e => clasesMod.includes(Number(e.clase_id)) && String(e.estudiante_user) === userKey);

          let sumaAct = 0, cantAct = 0;
          entregasAlumnoMod.forEach(e => {
            const val = parseFloat(e.nota);
            if (!isNaN(val)) { sumaAct += val; cantAct++; }
          });
          const promAct = cantAct > 0 ? (sumaAct / cantAct) : null;

          const asisModUser = (asistencias || []).filter(a => (Number(a.modulo_id) === Number(mod.id) || a.modulo_id === null) && String(a.estudiante_user) === userKey);
          const totalClasesMod = asisModUser.length;
          const presentesMod = asisModUser.filter(a => a.estado === 'presente').length;
          const pctAsisMod = totalClasesMod > 0 ? ((presentesMod / totalClasesMod) * 100) : null;

          let notaFinalModulo = null;
          if (promAct !== null && pctAsisMod !== null) {
            notaFinalModulo = Math.round((promAct + pctAsisMod) / 2);
          } else if (promAct !== null) {
            notaFinalModulo = Math.round(promAct);
          } else if (pctAsisMod !== null) {
            notaFinalModulo = Math.round(pctAsisMod);
          }

          notasModulos.push(notaFinalModulo);
        });

        return {
          dni: userKey,
          nombreCompleto: nombreCompleto,
          numEgresado: ins.num_egresado || ins.numero_egresado || '',
          notasModulos: notasModulos
        };
      });

      listaEstudiantes.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

      // 8. Cargar plantilla Excel oficial
      const response = await fetch('MODELO ASISTENCIA  + NOTAS MODULOS.xlsx');
      const arrayBuffer = await response.arrayBuffer();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const sheet = workbook.worksheets[0];

      // Mapeo Módulos
      const colsCalificacion = ['F', 'H', 'J', 'L', 'N', 'P', 'R', 'T', 'V', 'X'];
      const colsNumero       = ['G', 'I', 'K', 'M', 'O', 'Q', 'S', 'U', 'W', 'Y'];

      const numCursoVal = String(
        trayecto.certificacion_oficial || 
        trayecto.certificacion || 
        trayecto.numero_curso || 
        ''
      ).trim();

      const nombreTrayectoVal = String(trayecto.nombre || '').toUpperCase().trim();

      // Configuración de las 3 páginas consecutivas
      const paginasConfig = [
        {
          celdaNombre: 'R3', celdaCurso: 'Z4', inicioFila: 8, limiteAlumnos: 30,
          resumen: { inscriptos: 'AA38', examinados: 'AA39', ausentes: 'AA40', desaprobados: 'AA41', aprobados: 'AA43' }
        },
        {
          celdaNombre: 'R49', celdaCurso: 'Z50', inicioFila: 54, limiteAlumnos: 30,
          resumen: { inscriptos: 'AA84', examinados: 'AA85', ausentes: 'AA86', desaprobados: 'AA87', aprobados: 'AA89' }
        },
        {
          celdaNombre: 'R96', celdaCurso: 'Z97', inicioFila: 101, limiteAlumnos: 30,
          resumen: { inscriptos: 'AA131', examinados: 'AA132', ausentes: 'AA133', desaprobados: 'AA134', aprobados: 'AA136' }
        }
      ];

      // 9. PROCESAR CADA PÁGINA SOLO SI CORRESPONDE A LA CANTIDAD DE ALUMNOS
      paginasConfig.forEach((pag, pIdx) => {
        const inicioSlice = pIdx * pag.limiteAlumnos;
        const estudiantesPagina = listaEstudiantes.slice(inicioSlice, inicioSlice + pag.limiteAlumnos);

        // Solo completamos la página si existen estudiantes correspondientes a esa sección
        if (estudiantesPagina.length > 0) {
          // Encabezados institucionales de la página
          sheet.getCell(pag.celdaNombre).value = nombreTrayectoVal;
          sheet.getCell(pag.celdaCurso).value = numCursoVal;

          // Rellenar la nómina de la página
          estudiantesPagina.forEach((al, idx) => {
            const fila = pag.inicioFila + idx;

            sheet.getCell(`A${fila}`).value = al.numEgresado;
            sheet.getCell(`C${fila}`).value = inicioSlice + idx + 1;
            sheet.getCell(`D${fila}`).value = al.nombreCompleto;
            sheet.getCell(`Z${fila}`).value = 'DNI';
            sheet.getCell(`AA${fila}`).value = al.dni;

            al.notasModulos.forEach((notaMod, mIdx) => {
              if (mIdx < colsCalificacion.length) {
                const colCal = colsCalificacion[mIdx];
                const colNum = colsNumero[mIdx];

                if (notaMod !== null && notaMod !== undefined) {
                  sheet.getCell(`${colCal}${fila}`).value = notaMod;
                  sheet.getCell(`${colNum}${fila}`).value = notaMod;
                } else {
                  sheet.getCell(`${colCal}${fila}`).value = '';
                  sheet.getCell(`${colNum}${fila}`).value = '';
                }
              }
            });
          });

          // Métricas contadas exclusivamente para ESTA página
          const inscriptosHoja = estudiantesPagina.length;
          const examinadosHoja = estudiantesPagina.filter(al => al.notasModulos.some(n => n !== null && n !== undefined)).length;
          const ausentesHoja = inscriptosHoja - examinadosHoja;

          let aprobadosHoja = 0;
          let desaprobadosHoja = 0;

          estudiantesPagina.forEach(al => {
            const notasValidas = al.notasModulos.filter(n => n !== null && n !== undefined);
            if (notasValidas.length > 0) {
              const ultimaNota = notasValidas[notasValidas.length - 1];
              if (ultimaNota >= 70) {
                aprobadosHoja++;
              } else {
                desaprobadosHoja++;
              }
            }
          });

          // Escribir los resultados en el bloque resumen correspondiente
          sheet.getCell(pag.resumen.inscriptos).value = inscriptosHoja;
          sheet.getCell(pag.resumen.examinados).value = examinadosHoja;
          sheet.getCell(pag.resumen.ausentes).value = ausentesHoja;
          sheet.getCell(pag.resumen.desaprobados).value = desaprobadosHoja;
          sheet.getCell(pag.resumen.aprobados).value = aprobadosHoja;
        }
      });

      // 10. Descargar archivo Excel rellenado
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
};

window.ActasModulo = ActasModulo;
