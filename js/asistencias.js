const AsistenciasModulo = {
  trayectoActualId: null,

  async renderizarVista(trayectoId, contenedorId) {
    this.trayectoActualId = trayectoId;
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    try {
      const { data: inscripciones } = await supabase
        .from('inscripciones')
        .select('estudiante_user')
        .eq('trayecto_id', Number(trayectoId));

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
        .select('id, nombre')
        .eq('trayecto_id', Number(trayectoId));

      const { data: historialAsistencias } = await supabase
        .from('asistencias')
        .select('*')
        .eq('trayecto_id', Number(trayectoId))
        .order('fecha', { ascending: false });

      const hoy = new Date().toISOString().split('T')[0];

      const fechasMap = {};
      (historialAsistencias || []).forEach(a => {
        const modObj = (modulos || []).find(m => Number(m.id) === Number(a.modulo_id));
        const modNombre = modObj ? modObj.nombre : 'General (Todos los módulos)';
        const key = a.fecha + '___' + modNombre;
        if (!fechasMap[key]) {
          fechasMap[key] = { fecha: a.fecha, modulo: modNombre, total: 0, presentes: 0 };
        }
        fechasMap[key].total++;
        if (a.estado === 'presente' || a.estado === 'justificado') {
          fechasMap[key].presentes++;
        }
      });

      const filasHistorialHTML = Object.values(fechasMap).map(f => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:0.5rem 0.8rem; color:#cbd5e1;">${f.fecha.split('-').reverse().join('/')}</td>
          <td style="padding:0.5rem 0.8rem; color:#facc15;">${f.modulo}</td>
          <td style="padding:0.5rem 0.8rem; text-align:center; color:#4ade80; font-weight:600;">${f.presentes} / ${f.total} Presentes</td>
        </tr>
      `).join('');

      contenedor.innerHTML = `
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:1rem; margin-bottom:1rem;">
          <h4 style="margin:0 0 0.8rem 0; color:#38bdf8;">📅 Registrar Toma de Asistencia</h4>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.8rem; margin-bottom:0.8rem;">
            <div>
              <label style="display:block; font-size:0.8rem; color:#cbd5e1; margin-bottom:0.2rem;">Fecha de Clase</label>
              <input type="date" id="asistencia-fecha" value="${hoy}" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px; font-size:0.85rem;">
            </div>
            <div>
              <label style="display:block; font-size:0.8rem; color:#cbd5e1; margin-bottom:0.2rem;">Módulo Afectado</label>
              <select id="asistencia-modulo-id" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px; font-size:0.85rem;">
                <option value="">Aplica a Todos los Módulos (General)</option>
                ${(modulos || []).map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Acciones Rápidas en Lote -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; padding:0.6rem 0.8rem; border-radius:6px; border:1px solid #334155; flex-wrap:wrap; gap:0.5rem;">
            <div style="display:flex; gap:0.4rem;">
              <button type="button" onclick="AsistenciasModulo.marcarTodos('presente')" style="padding:0.35rem 0.7rem; background:rgba(34,197,94,0.2); border:1px solid rgba(34,197,94,0.4); color:#4ade80; border-radius:4px; font-size:0.78rem; font-weight:600; cursor:pointer;">
                ✅ Marcar Todos Presentes
              </button>
              <button type="button" onclick="AsistenciasModulo.marcarTodos('ausente')" style="padding:0.35rem 0.7rem; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#f87171; border-radius:4px; font-size:0.78rem; font-weight:600; cursor:pointer;">
                ❌ Marcar Todos Ausentes
              </button>
            </div>
            <button type="button" onclick="AsistenciasModulo.guardarAsistenciaLote()" style="padding:0.45rem 1.2rem; background:#0284c7; color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.85rem;">
              💾 Guardar Asistencia del Día
            </button>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; overflow-x:auto; margin-bottom:1rem;">
          <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.88rem;">
            <thead>
              <tr style="background:#0f172a; color:#94a3b8; border-bottom:1px solid rgba(255,255,255,0.1);">
                <th style="padding:0.75rem 1rem;">N°</th>
                <th style="padding:0.75rem 1rem;">Estudiante</th>
                <th style="padding:0.75rem 1rem; text-align:center;">Estado de Presentismo</th>
              </tr>
            </thead>
            <tbody>
              ${(alumnos || []).map((u, i) => {
                const userKey = String(u.usuario || u.dni || u.id);
                const ap = u.apellido ? u.apellido : '';
                const nom = u.nombre ? u.nombre : '';
                const nombreCompleto = (ap + ' ' + nom).trim() || userKey;
                return `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:0.75rem 1rem; color:#94a3b8;">${i + 1}</td>
                    <td style="padding:0.75rem 1rem; color:#f8fafc; font-weight:600;">
                      ${nombreCompleto} 
                      <span style="font-size:0.75rem; color:#94a3b8; display:block;">DNI: ${userKey}</span>
                    </td>
                    <td style="padding:0.75rem 1rem; text-align:center;">
                      <select class="select-asistencia-item" data-user="${userKey}" style="padding:0.4rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px; font-size:0.82rem;">
                        <option value="presente">✅ Presente</option>
                        <option value="ausente">❌ Ausente</option>
                        <option value="justificado">⏳ Ausente Justificado</option>
                      </select>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        ${filasHistorialHTML ? `
          <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:1rem;">
            <h5 style="margin:0 0 0.6rem 0; color:#cbd5e1; font-size:0.85rem;">📋 Historial de Asistencias Tomadas</h5>
            <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
              <thead>
                <tr style="background:#0f172a; color:#94a3b8;">
                  <th style="padding:0.5rem 0.8rem;">Fecha</th>
                  <th style="padding:0.5rem 0.8rem;">Módulo</th>
                  <th style="padding:0.5rem 0.8rem; text-align:center;">Presentismo Registrado</th>
                </tr>
              </thead>
              <tbody>
                ${filasHistorialHTML}
              </tbody>
            </table>
          </div>
        ` : ''}
      `;

    } catch (err) {
      console.error('Error al renderizar asistencias:', err);
      contenedor.innerHTML = '<p style="color:#f87171; text-align:center;">Error al cargar el módulo de asistencia.</p>';
    }
  },

  marcarTodos(estado) {
    const combos = document.querySelectorAll('.select-asistencia-item');
    combos.forEach(cb => { cb.value = estado; });
  },

  async guardarAsistenciaLote() {
    const fecha = document.getElementById('asistencia-fecha')?.value;
    const moduloId = document.getElementById('asistencia-modulo-id')?.value;
    const combos = document.querySelectorAll('.select-asistencia-item');

    if (!fecha) {
      alert('Por favor seleccioná una fecha.');
      return;
    }

    try {
      const registros = [];
      combos.forEach(cb => {
        registros.push({
          trayecto_id: Number(this.trayectoActualId),
          modulo_id: moduloId ? Number(moduloId) : null,
          estudiante_user: cb.getAttribute('data-user'),
          fecha: fecha,
          estado: cb.value
        });
      });

      await supabase
        .from('asistencias')
        .delete()
        .eq('trayecto_id', Number(this.trayectoActualId))
        .eq('fecha', fecha);

      const { error } = await supabase.from('asistencias').insert(registros);
      if (error) throw error;

      alert('✅ Asistencia guardada correctamente para la fecha ' + fecha);
      await this.renderizarVista(this.trayectoActualId, 'contenedor-vista-asistencias');

    } catch (err) {
      console.error('Error al guardar asistencias:', err);
      alert('Error al guardar asistencias: ' + err.message);
    }
  }
};

window.AsistenciasModulo = AsistenciasModulo;
