/* ==========================================================================
   GESTIÓN DE USUARIOS Y ROLES (ADMINISTRACIÓN SEGURA CON SUPABASE AUTH)
   Archivo: js/usuarios.js
   ========================================================================== */

const UsuariosAdmin = {
  estaProcesando: false,
  listaUsuarios: [],
  filtroRolActual: 'todos',

  abrirModal() {
    // Solo el Director (administrador) crea cuentas y asigna roles; la regencia solo restablece claves y aprueba pendientes
    const rolYo = (window.Auth && Auth.usuarioActual && Auth.usuarioActual.rol) || '';
    if (window.Auth && !Auth.esAdmin(rolYo)) { alert('Solo el administrador puede crear usuarios y asignar roles.'); return; }
    const modal = document.getElementById('modal-alta-usuario');
    if (modal) {
      modal.classList.add('open', 'active');
      modal.style.display = 'flex';
      this.cargarTrayectosEnModal();
      this.escucharCambioRol();
    }
  },

  cerrarModal() {
    const modal = document.getElementById('modal-alta-usuario');
    if (modal) {
      modal.classList.remove('open', 'active');
      modal.style.display = 'none';
      const form = document.getElementById('form-alta-usuario');
      if (form) form.reset();
    }
    this.estaProcesando = false;
  },

  escucharCambioRol() {
    const selectRol = document.getElementById('usr-alta-rol');
    const contenedor = document.getElementById('usr-alta-trayectos');
    if (!selectRol || !contenedor) return;

    const actualizarVista = () => {
      if (selectRol.value === 'estudiante') {
        contenedor.parentElement.style.display = 'block';
      } else {
        contenedor.parentElement.style.display = 'none';
      }
    };

    selectRol.removeEventListener('change', actualizarVista);
    selectRol.addEventListener('change', actualizarVista);
    actualizarVista();
  },

  setFiltro(nuevoFiltro) {
    this.filtroRolActual = nuevoFiltro;
    this.renderizarTabla();
  },

  async cargarUsuarios() {
    const tbody = document.getElementById('tabla-usuarios');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: #94a3b8;">
          Cargando usuarios de forma segura...
        </td>
      </tr>
    `;

    try {
      const { data: usuarios, error } = await supabase
        .from('profiles')
        .select('*')
        .order('apellido', { ascending: true });

      if (error) throw error;

      this.listaUsuarios = usuarios || [];
      this.renderizarTabla();

    } catch (err) {
      console.error('Error al cargar usuarios:', err);
    }
  },

  renderizarTabla() {
    const tbody = document.getElementById('tabla-usuarios');
    if (!tbody) return;

    let contenedorFiltros = document.getElementById('usr-pestañas-filtros');
    if (!contenedorFiltros) {
      const tarjetaContenedora = tbody.closest('.card') || tbody.closest('div') || tbody.parentElement;
      contenedorFiltros = document.createElement('div');
      contenedorFiltros.id = 'usr-pestañas-filtros';
      contenedorFiltros.style.cssText = 'display: flex; gap: 0.5rem; padding: 1rem 1rem 0.5rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); flex-wrap: wrap;';
      if (tarjetaContenedora && tarjetaContenedora.firstChild) {
        tarjetaContenedora.insertBefore(contenedorFiltros, tarjetaContenedora.firstChild);
      }
    }

    if (contenedorFiltros) {
      const cantTodos = this.listaUsuarios.length;
      const cantPersonal = this.listaUsuarios.filter(u => u.rol !== 'estudiante').length;
      const cantEstudiantes = this.listaUsuarios.filter(u => u.rol === 'estudiante').length;

      const estiloBtnActivo = 'background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); padding: 0.4rem 0.85rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;';
      const estiloBtnInactivo = 'background: rgba(255, 255, 255, 0.05); color: #94a3b8; border: 1px solid rgba(255, 255, 255, 0.1); padding: 0.4rem 0.85rem; border-radius: 6px; font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all 0.2s;';

      contenedorFiltros.innerHTML = `
        <button type="button" style="${this.filtroRolActual === 'todos' ? estiloBtnActivo : estiloBtnInactivo}" onclick="UsuariosAdmin.setFiltro('todos')">
          👥 Todos (${cantTodos})
        </button>
        <button type="button" style="${this.filtroRolActual === 'personal' ? estiloBtnActivo : estiloBtnInactivo}" onclick="UsuariosAdmin.setFiltro('personal')">
          👨‍🏫 Personal / Docentes (${cantPersonal})
        </button>
        <button type="button" style="${this.filtroRolActual === 'estudiante' ? estiloBtnActivo : estiloBtnInactivo}" onclick="UsuariosAdmin.setFiltro('estudiante')">
          🎓 Estudiantes (${cantEstudiantes})
        </button>
      `;
    }

    const usuariosFiltrados = this.listaUsuarios.filter(u => {
      if (this.filtroRolActual === 'personal') return u.rol !== 'estudiante';
      if (this.filtroRolActual === 'estudiante') return u.rol === 'estudiante';
      return true;
    });

    if (usuariosFiltrados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: #94a3b8;">
            No hay usuarios en esta categoría.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = usuariosFiltrados.map(u => {
      const estadoRaw = String(u.estado || 'ACTIVO').toUpperCase();
      const esActivo = estadoRaw === 'ACTIVO' || estadoRaw === 'HABILITADO' || estadoRaw === 'APROBADO';
      const nombreCompleto = Trayectos.esc(u.apellido ? `${u.apellido}, ${u.nombre}` : (u.nombre || 'Sin Nombre'));
      const idPrimario = u.id || u.usuario;
      const dniMostrar = Trayectos.esc(u.dni || u.usuario || 'Sin DNI');

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 0.85rem 0.75rem;">
            <strong style="color: #f8fafc; font-size: 0.95rem;">${nombreCompleto}</strong><br>
            <span style="font-size: 0.8rem; color: #94a3b8;">DNI: ${dniMostrar}</span>
          </td>
          <td style="padding: 0.85rem 0.75rem; font-size: 0.85rem; color: #cbd5e1;">
            ${Trayectos.esc(u.email) || `${dniMostrar}@cfp403.ar`}
          </td>
          <td style="padding: 0.85rem 0.75rem;">
            <select class="form-control" style="padding: 0.3rem 0.5rem; font-size: 0.85rem; width: auto;" onchange="UsuariosAdmin.cambiarRol('${idPrimario}', this.value)">
              <option value="estudiante" ${u.rol === 'estudiante' ? 'selected' : ''}>Estudiante</option>
              <option value="docente" ${u.rol === 'docente' ? 'selected' : ''}>Docente</option>
              <option value="preceptor" ${u.rol === 'preceptor' ? 'selected' : ''}>Preceptor/a</option>
              <option value="regente" ${u.rol === 'regente' ? 'selected' : ''}>Regente</option>
              <option value="secretaria" ${u.rol === 'secretaria' ? 'selected' : ''}>Secretaría</option>
              <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
          </td>
          <td style="padding: 0.85rem 0.75rem;">
            <span class="badge" style="background: ${esActivo ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)'}; color: ${esActivo ? '#4ade80' : '#facc15'}; border: 1px solid ${esActivo ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">
              ${estadoRaw}
            </span>
          </td>
          <td style="padding: 0.85rem 0.75rem; text-align: right; display: flex; gap: 0.4rem; justify-content: flex-end; align-items: center;">
            ${!esActivo ? `
              <button class="btn btn-gold" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="UsuariosAdmin.cambiarEstado('${idPrimario}', 'ACTIVO')">
                ${(estadoRaw === 'INHABILITADO' || estadoRaw === 'INACTIVO') ? '↩ Reactivar' : '✓ Aprobar'}
              </button>
            ` : `
              <button class="btn btn-danger" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171;" onclick="UsuariosAdmin.cambiarEstado('${idPrimario}', 'INHABILITADO')">
                🔒 Inhabilitar
              </button>
            `}
            ${u.rol === 'estudiante' ? `<button title="Ver ficha de cursada" class="btn-ficha" onclick="FichaAlumno.abrir('${Trayectos.esc(String(u.dni || u.usuario || '').replace(/\D/g, ''))}')">Ficha</button>` : ''}
            <button title="Corregir apellido, nombre o correo" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; background: rgba(148, 163, 184, 0.15); border: 1px solid rgba(148, 163, 184, 0.3); color: #cbd5e1; border-radius: 6px; cursor: pointer;" onclick="UsuariosAdmin.editarDatos('${idPrimario}')">
              ✏️
            </button>
            <button title="Restablecer contraseña" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #60a5fa; border-radius: 6px; cursor: pointer;" onclick="UsuariosAdmin.restablecerClave('${idPrimario}')">
              🔑
            </button>
            <button title="Eliminar definitivamente" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; border-radius: 6px; cursor: pointer;" onclick="UsuariosAdmin.eliminarUsuario('${idPrimario}')">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async cargarTrayectosEnModal() {
    const contenedor = document.getElementById('usr-alta-trayectos');
    if (!contenedor) return;

    contenedor.innerHTML = '<span style="color: #94a3b8; font-size: 0.85rem;">Cargando trayectos...</span>';

    try {
      const { data: trayectos, error } = await supabase
        .from('trayectos')
        .select('*');

      if (error) throw error;

      if (!trayectos || trayectos.length === 0) {
        contenedor.innerHTML = '<span style="color: #94a3b8; font-size: 0.85rem;">No hay trayectos disponibles aún.</span>';
        return;
      }

      contenedor.innerHTML = trayectos.map(t => `
        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #cbd5e1; cursor: pointer; margin-bottom: 0.4rem;">
          <input type="checkbox" name="trayectos_seleccionados" value="${t.id}">
          <span>${t.nombre}</span>
        </label>
      `).join('');
    } catch (err) {
      console.error('Error al cargar trayectos:', err);
      contenedor.innerHTML = '<span style="color: #f87171; font-size: 0.85rem;">Error al obtener trayectos.</span>';
    }
  },

  async crearUsuarioManual(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    if (this.estaProcesando) return;
    this.estaProcesando = true;

    const apellido = document.getElementById('usr-alta-apellido')?.value.trim().toUpperCase();
    const nombre = document.getElementById('usr-alta-nombre')?.value.trim().toUpperCase();
    const dniVal = document.getElementById('usr-alta-dni')?.value.trim();
    const emailRaw = document.getElementById('usr-alta-email')?.value.trim();
    const rol = document.getElementById('usr-alta-rol')?.value || 'estudiante';

    if (!nombre || !apellido || !dniVal) {
      alert('Por favor completá Nombre, Apellido y DNI.');
      this.estaProcesando = false;
      return;
    }

    const emailSintetico = emailRaw ? emailRaw.toLowerCase() : `${dniVal.toLowerCase()}@cfp403.ar`;
    const passwordTemp = `CFP403_${dniVal}`;

    try {
      // Cliente temporal: así la sesión del administrador no se cierra al crear la cuenta
      const clienteAlta = window.crearClienteTemporal();
      const { data: authRes, error: authError } = await clienteAlta.auth.signUp({
        email: emailSintetico,
        password: passwordTemp,
        options: { data: { dni: dniVal, nombre: nombre, apellido: apellido } }
      });

      if (authError) {
        alert('Error al registrar en Auth: ' + authError.message);
        this.estaProcesando = false;
        return;
      }

      const userId = authRes.user?.id;
      // Supabase devuelve un usuario sin identidades cuando el email ya estaba registrado
      if (!userId || (authRes.user.identities && authRes.user.identities.length === 0)) {
        alert('Ya existe una cuenta con ese email o DNI.');
        this.estaProcesando = false;
        return;
      }

      // El trigger de la base ya creó el perfil (estudiante / PENDIENTE): lo completa el administrador
      const { data: filasPerfil, error: profileError } = await supabase
        .from('profiles')
        .update({ dni: dniVal, nombre: nombre, apellido: apellido, email: emailSintetico, rol: rol, estado: 'ACTIVO' })
        .eq('id', userId)
        .select('id');

      if (profileError || !filasPerfil || filasPerfil.length === 0) {
        alert('⚠️ La cuenta se creó pero no se pudo asignar el rol: ' + (profileError ? profileError.message : 'el perfil no existe todavía (¿ejecutaste el paso 1 de SQL?)'));
        this.estaProcesando = false;
        return;
      }

      if (rol === 'estudiante') {
        const checkboxes = document.querySelectorAll('input[name="trayectos_seleccionados"]:checked');
        const trayectoIds = Array.from(checkboxes).map(cb => cb.value);

        if (trayectoIds.length > 0) {
          const inscripciones = trayectoIds.map(tId => ({
            estudiante_user: String(dniVal),
            trayecto_id: Number(tId)
          }));

          const { error: errInsc } = await supabase
            .from('inscripciones')
            .insert(inscripciones);

          if (errInsc) {
            alert('⚠️ Usuario creado pero falló la inscripción: ' + errInsc.message);
            this.estaProcesando = false;
            return;
          }
        }
      }

      this.cerrarModal();
      this.cargarUsuarios();
      await Swal.fire({
        icon: 'success',
        title: 'Usuario creado',
        html: `<b>${Trayectos.esc(nombre)} ${Trayectos.esc(apellido)}</b> (${Trayectos.esc(rol)})<br><br>
               Usuario: <b>${Trayectos.esc(dniVal)}</b><br>
               Contraseña inicial: <code style="font-size:1.1rem; user-select:all;">${Trayectos.esc(passwordTemp)}</code><br><br>
               <small>La persona puede cambiarla desde "Cambiar mi contraseña".</small>`
      });

    } catch (err) {
      console.error('Error general:', err);
      alert('Error inesperado: ' + (err.message || 'Consulte la consola.'));
    } finally {
      this.estaProcesando = false;
    }
  },

  // El administrador define una contraseña nueva para otra persona
  async restablecerClave(userId) {
    const u = this.listaUsuarios.find(x => String(x.id) === String(userId));
    if (!u) return;

    const nombre = u.apellido ? `${u.apellido}, ${u.nombre}` : (u.nombre || u.dni);
    const { value: nueva } = await Swal.fire({
      title: 'Restablecer contraseña',
      html: `Contraseña nueva para <b>${Trayectos.esc(nombre)}</b><br><small>DNI ${Trayectos.esc(u.dni)}</small>`,
      input: 'text',
      inputPlaceholder: 'Mínimo 8 caracteres',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      inputValidator: (v) => (!v || v.trim().length < 8) ? 'Escribí al menos 8 caracteres.' : null
    });
    if (!nueva) return;

    const { error } = await supabase.rpc('admin_restablecer_clave', {
      p_user_id: userId,
      p_nueva: nueva.trim()
    });

    if (error) {
      alert('No se pudo restablecer la contraseña: ' + error.message);
      return;
    }

    Swal.fire({
      icon: 'success',
      title: 'Contraseña actualizada',
      text: 'Pasásela a la persona. Después puede cambiarla desde "Cambiar mi contraseña".'
    });
  },

  esMiUsuario(userId) {
    return !!(window.Auth && Auth.usuarioActual && String(Auth.usuarioActual.id) === String(userId));
  },

  /* Cierre de año: pasa a INACTIVO a los estudiantes sin inscripción vigente (sin baja) en un ciclo
     posterior al que se cierra. No borra nada: ficha, inscripciones, notas y asistencias quedan.
     Se reactivan solos cuando los inscriben de nuevo. Solo Director y Regente (lo exige la base). */
  async cierreAnio() {
    if (typeof Swal === 'undefined') return;
    const esc = s => Trayectos.esc(String(s ?? ''));
    const ciclo0 = new Date().getFullYear();
    const { value: ciclo } = await Swal.fire({
      title: 'Cierre de año', input: 'number', inputValue: ciclo0, inputLabel: 'Ciclo lectivo que se cierra',
      text: 'Se listan los estudiantes activos que NO tienen una inscripción vigente (sin baja) en un ciclo posterior.',
      showCancelButton: true, confirmButtonText: 'Ver lista', cancelButtonText: 'Cancelar',
      inputValidator: v => (!v || Number(v) < 2020 || Number(v) > 2100) ? 'Ingresá un año válido' : null
    });
    if (!ciclo) return;
    const cierre = Number(ciclo);
    try {
      const { data, error } = await supabase.rpc('cierre_estudiantes_inactivables', { p_ciclo: cierre });
      if (error) throw error;
      const lista = data || [];
      if (!lista.length) { Swal.fire('Nada para inactivar', 'Todos los estudiantes activos tienen una inscripción vigente posterior al ciclo ' + cierre + '.', 'info'); return; }
      const r = await Swal.fire({
        title: `${lista.length} estudiantes para inactivar`, width: 720, showCancelButton: true,
        confirmButtonText: 'Inactivar seleccionados', cancelButtonText: 'Cancelar', focusConfirm: false,
        html: `
          <p style="font-size:.9rem;text-align:left;">Pierden el acceso al login, pero <strong>no se borra nada</strong>. Si se vuelven a inscribir, se reactivan solos. Destildá a quien quieras dejar activo.</p>
          <label style="display:block;text-align:left;margin:.3rem 0;"><input type="checkbox" id="cierre-todos" checked> Seleccionar todos</label>
          <div style="max-height:320px;overflow:auto;text-align:left;border:1px solid #cbd5e1;border-radius:8px;padding:.4rem .6rem;">
            ${lista.map(u => `<label style="display:block;font-size:.88rem;padding:.15rem 0;"><input type="checkbox" class="cierre-dni" value="${esc(u.dni)}" checked> ${esc(u.apellido)}, ${esc(u.nombre)} <span style="color:#64748b;">· DNI ${esc(u.dni)}${u.ultimo_ciclo ? ' · último ciclo ' + esc(u.ultimo_ciclo) : ' · sin inscripciones'}</span></label>`).join('')}
          </div>`,
        didOpen: () => {
          document.getElementById('cierre-todos').addEventListener('change', e => document.querySelectorAll('.cierre-dni').forEach(c => { c.checked = e.target.checked; }));
        },
        preConfirm: () => {
          const dnis = [...document.querySelectorAll('.cierre-dni:checked')].map(c => c.value);
          if (!dnis.length) { Swal.showValidationMessage('No seleccionaste a nadie.'); return false; }
          return dnis;
        }
      });
      if (!r.isConfirmed) return;
      const { data: n, error: e2 } = await supabase.rpc('cierre_inactivar_estudiantes', { p_ciclo: cierre, p_dnis: r.value });
      if (e2) throw e2;
      Swal.fire('Listo', `${n} estudiantes quedaron INACTIVOS.`, 'success');
      this.cargarUsuarios();
    } catch (err) {
      Swal.fire('No se pudo completar', err.message || '', 'error');
    }
  },

  async cambiarEstado(userId, nuevoEstado) {
    if (this.esMiUsuario(userId) && nuevoEstado !== 'ACTIVO') {
      alert('No podés inhabilitar tu propia cuenta.');
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ estado: nuevoEstado })
        .eq('id', userId);

      if (error) throw error;
      this.cargarUsuarios();
    } catch (err) {
      console.error('Error al actualizar estado:', err);
    }
  },

  /* Corregir apellido, nombre o correo de contacto. El DNI no se edita acá: lo usan las
     inscripciones, asistencias y notas para identificar al estudiante, y cambiarlo
     rompería esos vínculos. Si hay que corregir un DNI mal cargado, avisame y lo vemos aparte. */
  async editarDatos(userId) {
    if (typeof Swal === 'undefined') return;
    const u = this.listaUsuarios.find(x => (x.id || x.usuario) === userId);
    if (!u) return;
    const r = await Swal.fire({
      title: 'Corregir datos del usuario',
      html: `<div style="text-align:left; font-size:0.85rem;">
        <p style="margin:0 0 0.6rem; color:#94a3b8;">DNI ${Trayectos.esc(u.dni || u.usuario)} (no se edita acá)</p>
        <label class="eq-label">Apellido</label><input id="ed-apellido" class="swal2-input eq-motivo" value="${(u.apellido || '').replace(/"/g, '&quot;')}">
        <label class="eq-label">Nombre</label><input id="ed-nombre" class="swal2-input eq-motivo" value="${(u.nombre || '').replace(/"/g, '&quot;')}">
        <label class="eq-label">${String(u.rol || '').toLowerCase() === 'estudiante' ? 'Correo de contacto' : 'Correo (también es el de acceso)'}</label><input id="ed-email" type="email" class="swal2-input eq-motivo" value="${(u.email || '').replace(/"/g, '&quot;')}" placeholder="nombre@dominio.com">
      </div>`,
      showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', focusConfirm: false,
      preConfirm: () => ({
        apellido: document.getElementById('ed-apellido').value.trim().toUpperCase(),
        nombre: document.getElementById('ed-nombre').value.trim(),
        email: document.getElementById('ed-email').value.trim().toLowerCase()
      })
    });
    if (!r.isConfirmed) return;
    if (!r.value.apellido || !r.value.nombre) { alert('Apellido y nombre son obligatorios.'); return; }
    try {
      const esEstudiante = String(u.rol || '').toLowerCase() === 'estudiante';
      const cambioMail = (r.value.email || '') !== String(u.email || '').toLowerCase();
      let emailPerfil = r.value.email || null;
      if (cambioMail && r.value.email && !esEstudiante) {
        // Personal: el correo es también el de acceso (Auth), se cambia en los dos lugares
        const { error: errAcc } = await supabase.rpc('cambiar_email_acceso', { p_user_id: userId, p_email: r.value.email });
        if (errAcc) throw errAcc;
      }
      const { error } = await supabase.from('profiles')
        .update({ apellido: r.value.apellido, nombre: r.value.nombre, email: emailPerfil })
        .eq('id', userId);
      if (error) throw error;
      Object.assign(u, { apellido: r.value.apellido, nombre: r.value.nombre, email: emailPerfil });
      this.renderizarTabla();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Datos actualizados', showConfirmButton: false, timer: 2000 });
    } catch (err) {
      alert('No se pudo guardar: ' + (err.message || ''));
    }
  },

  async cambiarRol(userId, nuevoRol) {
    if (this.esMiUsuario(userId) && !Auth.esAdmin(nuevoRol)) {
      alert('No podés quitarte a vos mismo el rol de administrador.');
      this.renderizarTabla();
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ rol: nuevoRol })
        .eq('id', userId);

      if (error) throw error;
      
      const idx = this.listaUsuarios.findIndex(u => u.id === userId || u.usuario === userId);
      if (idx !== -1) this.listaUsuarios[idx].rol = nuevoRol;
      this.renderizarTabla();
    } catch (err) {
      console.error('Error al actualizar rol:', err);
    }
  },

  // Baja de una persona. Lo recomendable es INHABILITAR (conserva el historial);
  // eliminar borra también su cuenta de acceso.
  async eliminarUsuario(userId) {
    if (this.esMiUsuario(userId)) {
      Swal.fire({ icon: 'info', title: 'No es posible', text: 'No podés eliminar ni inhabilitar tu propia cuenta.' });
      return;
    }
    const u = this.listaUsuarios.find(x => String(x.id) === String(userId));
    const nombre = u ? (u.apellido ? `${u.apellido}, ${u.nombre}` : (u.nombre || u.dni)) : String(userId);

    const r = await Swal.fire({
      icon: 'warning',
      title: 'Dar de baja',
      html: `<b>${Trayectos.esc(nombre)}</b><br><br>
        <b>Inhabilitar</b> (recomendado): no puede ingresar, pero se conserva su historial y se puede reactivar.<br><br>
        <b>Eliminar definitivamente</b>: borra su cuenta de acceso. No se puede deshacer.`,
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Inhabilitar',
      denyButtonText: 'Eliminar definitivamente',
      cancelButtonText: 'Cancelar'
    });

    if (r.isConfirmed) {
      await this.cambiarEstado(userId, 'INHABILITADO');
      return;
    }
    if (!r.isDenied) return;

    await this._eliminarDefinitivo(userId, nombre, false);
  },

  async _eliminarDefinitivo(userId, nombre, forzar) {
    try {
      const { data, error } = await supabase.functions.invoke('eliminar-usuario', {
        body: { user_id: userId, forzar }
      });
      if (error) throw error;
      if (data && data.error) throw new Error(data.error);

      if (data && data.requiere_confirmacion) {
        const h = data.historial || {};
        const c = await Swal.fire({
          icon: 'warning',
          title: 'Esta persona tiene historial',
          html: `${h.inscripciones || 0} inscripciones, ${h.entregas || 0} entregas/notas y ${h.asistencias || 0} asistencias.<br><br>
                 Si la eliminás, <b>se borra también ese historial</b> (queda una copia en Auditoría).<br>
                 Para conservarlo, mejor <b>inhabilitala</b>.`,
          showCancelButton: true,
          confirmButtonText: 'Eliminar todo igual',
          confirmButtonColor: '#dc2626',
          cancelButtonText: 'Cancelar'
        });
        if (c.isConfirmed) await this._eliminarDefinitivo(userId, nombre, true);
        return;
      }

      Swal.fire({ icon: 'success', title: 'Usuario eliminado', text: nombre });
      await this.cargarUsuarios();
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      Swal.fire({
        icon: 'error',
        title: 'No se pudo eliminar',
        text: (err.message || 'Error desconocido') + ' — Si la función "eliminar-usuario" todavía no está instalada en Supabase, usá Inhabilitar.'
      });
    }
  }
};

document.addEventListener('submit', function(e) {
  if (e.target && e.target.id === 'form-alta-usuario') {
    e.preventDefault();
    UsuariosAdmin.crearUsuarioManual(e);
  }
});

UsuariosAdmin.cargarTrayectosModal = UsuariosAdmin.cargarTrayectosEnModal;
UsuariosAdmin.cargarTrayectos = UsuariosAdmin.cargarTrayectosEnModal;

window.UsuariosAdmin = UsuariosAdmin;
window.Usuarios = UsuariosAdmin;
window.crearUsuarioManual = (e) => UsuariosAdmin.crearUsuarioManual(e);
window.cerrarModal = () => UsuariosAdmin.cerrarModal();
window.abrirModal = () => UsuariosAdmin.abrirModal();
