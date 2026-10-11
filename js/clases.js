async cargarSabanaEstudiantes() {
    const contenedor = document.getElementById('contenedor-lista-alumnos');
    if (!contenedor) return;

    try {
      const { data: inscripciones, error: errIns } = await supabase
        .from('inscripciones')
        .select('estudiante_user')
        .eq('trayecto_id', Number(this.trayectoActualId));

      if (errIns) throw errIns;

      if (!inscripciones || inscripciones.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:1.5rem;">No hay estudiantes inscriptos en este trayecto.</p>';
        return;
      }

      const listaUsers = inscripciones.map(i => i.estudiante_user);

      const { data: alumnos } = await supabase
        .from('usuarios')
        .select('*')
        .in('usuario', listaUsers);

      const { data: modulos } = await supabase
        .from('modulos')
        .select('id, nombre, codigo')
        .eq('trayecto_id', Number(this.trayectoActualId))
        .order('id', { ascending: true });

      const { data: clases } = await supabase
        .from('clases')
        .select('id, modulo_id')
        .eq('trayecto_id', Number(this.trayectoActualId));

      const idsClases = (clases || []).map(c => c.id);
      let entregas = [];
      if (idsClases.length > 0) {
        const { data: ent } = await supabase
          .from('entregas_actividades')
          .select('*')
          .in('clase_id', idsClases);
        entregas = ent || [];
      }

      const { data: asistencias } = await supabase
        .from('asistencias')
        .select('*')
        .eq('trayecto_id', Number(this.trayectoActualId));

      const { data: excepciones } = await supabase
        .from('excepciones_estudiantes')
        .select('*')
        .eq('trayecto_id', Number(this.trayectoActualId));

      const tieneModulos = modulos && modulos.length > 0;

      let thModulosHTML = '';
      if (tieneModulos) {
        thModulosHTML = modulos.map(m => `<th style="padding:0.75rem; text-align:center;">${m.nombre}</th>`).join('');
      } else {
        thModulosHTML = `<th style="padding:0.75rem; text-align:center;">Promedio General</th>`;
      }

      let filasHTML = '';
      (alumnos || []).forEach((u, i) => {
        const nombreCompleto = `${u.apellido || ''} ${u.nombre || ''}`.trim();
        const userKey = String(u.usuario || u.dni || u.id);

        let celdasNotasHTML = '';

        if (tieneModulos) {
          modulos.forEach(mod => {
            // A. Promedio TPs
            const clasesDelModulo = (clases || []).filter(c => Number(c.modulo_id) === Number(mod.id)).map(c => c.id);
            const entregasAlumnoMod = entregas.filter(e => clasesDelModulo.includes(Number(e.clase_id)) && String(e.estudiante_user) === userKey);

            let sumaAct = 0, cantAct = 0;
            entregasAlumnoMod.forEach(e => {
              const val = parseFloat(e.nota);
              if (!isNaN(val)) { sumaAct += val; cantAct++; }
            });
            const promAct = cantAct > 0 ? (sumaAct / cantAct) : null;

            // B. Promedio Asistencia (Específica o General)
            const asisModUser = (asistencias || []).filter(a => (Number(a.modulo_id) === Number(mod.id) || a.modulo_id === null) && String(a.estudiante_user) === userKey);
            const totalClasesMod = asisModUser.length; // Incluye presente, ausente y justificado
            const presentesMod = asisModUser.filter(a => a.estado === 'presente').length; // Solo 'presente' suma
            const pctAsisMod = totalClasesMod > 0 ? ((presentesMod / totalClasesMod) * 100) : null;

            // C. Promedio 50/50 entre TPs y Asistencia
            let notaFinalModulo = null;
            let desgloseTexto = '';

            if (promAct !== null && pctAsisMod !== null) {
              notaFinalModulo = Math.round((promAct + pctAsisMod) / 2);
              desgloseTexto = `TPs: ${Math.round(promAct)}% | Asis: ${Math.round(pctAsisMod)}%`;
            } else if (promAct !== null) {
              notaFinalModulo = Math.round(promAct);
              desgloseTexto = `TPs: ${Math.round(promAct)}% (Sin Asis)`;
            } else if (pctAsisMod !== null) {
              notaFinalModulo = Math.round(pctAsisMod);
              desgloseTexto = `Asis: ${Math.round(pctAsisMod)}% (Sin TPs)`;
            }

            if (notaFinalModulo !== null) {
              const acreditado = notaFinalModulo >= 70;
              celdasNotasHTML += `
                <td style="padding:0.75rem; text-align:center;">
                  <span style="display:inline-block; padding:0.2rem 0.5rem; border-radius:4px; font-weight:600; font-size:0.8rem; ${acreditado ? 'background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.4);' : 'background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.4);'}">
                    ${notaFinalModulo}% ${acreditado ? '✅' : '⚠️'}
                  </span>
                  <span style="display:block; font-size:0.7rem; color:#94a3b8; margin-top:0.2rem;">${desgloseTexto}</span>
                </td>
              `;
            } else {
              celdasNotasHTML += `<td style="padding:0.75rem; text-align:center; color:#64748b; font-size:0.8rem;">S/D</td>`;
            }
          });
        } else {
          // General
          const entregasAlumno = entregas.filter(e => String(e.estudiante_user) === userKey);
          let sumaAct = 0, cantAct = 0;
          entregasAlumno.forEach(e => {
            const val = parseFloat(e.nota);
            if (!isNaN(val)) { sumaAct += val; cantAct++; }
          });
          const promAct = cantAct > 0 ? (sumaAct / cantAct) : null;

          const asisUser = (asistencias || []).filter(a => String(a.estudiante_user) === userKey);
          const totalClases = asisUser.length;
          const presentes = asisUser.filter(a => a.estado === 'presente').length;
          const pctAsis = totalClases > 0 ? ((presentes / totalClases) * 100) : null;

          let notaFinalGeneral = null;
          let desgloseTexto = '';

          if (promAct !== null && pctAsis !== null) {
            notaFinalGeneral = Math.round((promAct + pctAsis) / 2);
            desgloseTexto = `TPs: ${Math.round(promAct)}% | Asis: ${Math.round(pctAsis)}%`;
          } else if (promAct !== null) {
            notaFinalGeneral = Math.round(promAct);
          } else if (pctAsis !== null) {
            notaFinalGeneral = Math.round(pctAsis);
          }

          if (notaFinalGeneral !== null) {
            const acreditado = notaFinalGeneral >= 70;
            celdasNotasHTML += `
              <td style="padding:0.75rem; text-align:center;">
                <span style="display:inline-block; padding:0.2rem 0.5rem; border-radius:4px; font-weight:600; font-size:0.8rem; ${acreditado ? 'background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.4);' : 'background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.4);'}">
                  ${notaFinalGeneral}% ${acreditado ? '✅' : '⚠️'}
                </span>
                ${desgloseTexto ? `<span style="display:block; font-size:0.7rem; color:#94a3b8; margin-top:0.2rem;">${desgloseTexto}</span>` : ''}
              </td>
            `;
          } else {
            celdasNotasHTML += `<td style="padding:0.75rem; text-align:center; color:#64748b; font-size:0.8rem;">S/D</td>`;
          }
        }

        const exEspecial = (excepciones || []).find(x => String(x.estudiante_user) === userKey && x.habilitado);

        filasHTML += `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
            <td style="padding:0.75rem 1rem; color:#94a3b8;">${i + 1}</td>
            <td style="padding:0.75rem 1rem; font-weight:600; color:#f8fafc;">
              ${nombreCompleto}
              <span style="display:block; font-size:0.75rem; color:#94a3b8;">DNI: ${userKey}</span>
            </td>
            ${celdasNotasHTML}
            <td style="padding:0.75rem 1rem; text-align:center;">
              <button type="button" onclick="ClasesModulo.toggleExcepcionEstudiante('${userKey}', ${exEspecial ? 'false' : 'true'})" style="padding:0.3rem 0.6rem; border-radius:6px; border:none; font-size:0.75rem; font-weight:600; cursor:pointer; ${exEspecial ? 'background:#eab308; color:#000;' : 'background:rgba(255,255,255,0.08); color:#cbd5e1;'}">
                ${exEspecial ? '🔓 Excepción Activa' : '🔒 Excepción Inactiva'}
              </button>
            </td>
          </tr>
        `;
      });

      contenedor.innerHTML = `
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; overflow-x:auto;">
          <table id="tabla-sabana-notas" style="width:100%; border-collapse:collapse; text-align:left; font-size:0.88rem;">
            <thead>
              <tr style="background:#0f172a; color:#94a3b8; border-bottom:1px solid rgba(255,255,255,0.1);">
                <th style="padding:0.75rem 1rem;">N°</th>
                <th style="padding:0.75rem 1rem;">Estudiante</th>
                ${thModulosHTML}
                <th style="padding:0.75rem 1rem; text-align:center;">Permiso Excepcional</th>
              </tr>
            </thead>
            <tbody>
              ${filasHTML}
            </tbody>
          </table>
        </div>
      `;

    } catch (err) {
      console.error('Error al cargar sábana de estudiantes:', err);
      contenedor.innerHTML = '<p style="color:#f87171; text-align:center;">Error al cargar la información.</p>';
    }
  },
