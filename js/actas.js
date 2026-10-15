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
      const trayecto = this.trayectoSeleccionado;

      // 1. Obtener inscripciones
      const { data: inscripciones, error: errInsc } = await supabase
        .from('inscripciones')
        .select('*')
        .eq('trayecto_id', trayecto.id);

      if (errInsc) throw errInsc;

      if (!inscripciones || inscripciones.length === 0) {
        alert("⚠️ No hay estudiantes inscriptos en este trayecto para generar el acta.");
        return;
      }

      // 2. Cargar módulos del trayecto
      const { data: modulos } = await supabase
        .from('modulos')
        .select('id, nombre')
        .eq('trayecto_id', Number(trayecto.id))
        .order('id', { ascending: true });

      // 3. Cargar clases y entregas
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

      // 4. Cargar asistencias
      const { data: asistencias } = await supabase
        .from('asistencias')
        .select('*')
        .eq('trayecto_id', Number(trayecto.id));

      // 5. Traer datos personales
      const listaDNIs = inscripciones.map(i => String(i.estudiante_user));
      const { data: datosUsuarios } = await supabase
        .from('usuarios')
        .select('*')
        .in('usuario', listaDNIs);

      const mapaUsuarios = {};
      (datosUsuarios || []).forEach(u => {
        mapaUsuarios[String(u.usuario || u.dni || u.id)] = u;
      });

      // 6. Armar lista de estudiantes
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

      // 7. Cargar plantilla Excel
      const response = await fetch('MODELO ASISTENCIA  + NOTAS MODULOS.xlsx');
      const arrayBuffer = await response.arrayBuffer();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      // Mapeo Módulos
      const colsCalificacion = ['F', 'H', 'J', 'L', 'N', 'P', 'R', 'T', 'V', 'X'];
      const colsNumero       = ['G', 'I', 'K', 'M', 'O', 'Q', 'S', 'U', 'W', 'Y'];

      const limitePorHoja = 30;
      const totalHojas = Math.ceil(listaEstudiantes.length / limitePorHoja);

      for (let h = 0; h < totalHojas; h++) {
        let worksheet = workbook.worksheets[h];

        if (!worksheet) continue;

        // R3: Nombre de Especialidad / Trayecto (Cubre R3 a Y3 en cada hoja)
        worksheet.getCell('R3').value = String(trayecto.nombre || '').toUpperCase();
        
        // Z3: Número de Curso
        const numCursoVal = trayecto.certificacion_oficial || trayecto.numero_curso || trayecto.id || '';
        worksheet.getCell('Z3').value = String(numCursoVal);

        const estudiantesHoja = listaEstudiantes.slice(h * limitePorHoja, (h + 1) * limitePorHoja);
        const filaInicial = 8;

        estudiantesHoja.forEach((al, idx) => {
          const fila = filaInicial + idx;

          worksheet.getCell(`A${fila}`).value = al.numEgresado;
          worksheet.getCell(`C${fila}`).value = (h * limitePorHoja) + idx + 1;
          worksheet.getCell(`D${fila}`).value = al.nombreCompleto;
          worksheet.getCell(`Z${fila}`).value = 'DNI';
          worksheet.getCell(`AA${fila}`).value = al.dni;

          al.notasModulos.forEach((notaMod, mIdx) => {
            if (mIdx < colsCalificacion.length) {
              const colCal = colsCalificacion[mIdx];
              const colNum = colsNumero[mIdx];

              if (notaMod !== null && notaMod !== undefined) {
                const notaEscala10 = notaMod > 10 ? Math.round(notaMod / 10) : notaMod;
                worksheet.getCell(`${colCal}${fila}`).value = notaEscala10;
                worksheet.getCell(`${colNum}${fila}`).value = notaEscala10;
              } else {
                worksheet.getCell(`${colCal}${fila}`).value = '';
                worksheet.getCell(`${colNum}${fila}`).value = '';
              }
            }
          });
        });
      }

      // 8. Descargar
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
