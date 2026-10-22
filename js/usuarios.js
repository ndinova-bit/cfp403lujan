/* ==========================================================================
   GESTIÓN DE USUARIOS Y ROLES (ADMINISTRACIÓN SEGURA CON SUPABASE AUTH)
   Archivo: js/usuarios.js
   ========================================================================== */

const UsuariosAdmin = {
  estaProcesando: false,
  listaUsuarios: [],
  filtroRolActual: 'todos',

  abrirModal() {
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
                ${estadoRaw === 'INHABILITADO' ? '↩ Reactivar' : '✓ Aprobar'}
              </button>
            ` : `
              <button class="btn btn-danger" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171;" onclick="UsuariosAdmin.cambiarEstado('${idPrimario}', 'INHABILITADO')">
                🔒 Inhabilitar
              </button>
            `}
            ${u.rol === 'estudiante' ? `<button title="Ver ficha de cursada" class="btn-ficha" onclick="FichaAlumno.abrir('${Trayectos.esc(String(u.dni || u.usuario || '').replace(/\D/g, ''))}')">Ficha</button>` : ''}
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
