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
        .from('usuarios')
        .select('*');

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
      const nombreCompleto = u.apellido ? `${u.apellido}, ${u.nombre}` : (u.nombre || 'Sin Nombre');
      const idPrimario = u.id || u.usuario;
      const dniMostrar = u.dni || u.usuario || 'Sin DNI';

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 0.85rem 0.75rem;">
            <strong style="color: #f8fafc; font-size: 0.95rem;">${nombreCompleto}</strong><br>
            <span style="font-size: 0.8rem; color: #94a3b8;">DNI: ${dniMostrar}</span>
          </td>
          <td style="padding: 0.85rem 0.75rem; font-size: 0.85rem; color: #cbd5e1;">
            ${u.email || `${dniMostrar}@cfp403.ar`}
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
                ✓ Aprobar
              </button>
            ` : `
              <button class="btn btn-danger" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171;" onclick="UsuariosAdmin.cambiarEstado('${idPrimario}', 'PENDIENTE')">
                🔒 Inhabilitar
              </button>
            `}
            <button title="Eliminar definitivamente" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; border-radius: 6px; cursor: pointer;" onclick="UsuariosAdmin.eliminarUsuario('${idPrimario}', '${nombreCompleto.replace(/'/g, "\\'")}')">
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
      const { data: authRes, error: authError } = await supabase.auth.signUp({
        email: emailSintetico,
        password: passwordTemp
      });

      if (authError) {
        alert('Error al registrar en Auth: ' + authError.message);
        this.estaProcesando = false;
        return;
      }

      const userId = authRes.user?.id;

      const { error: profileError } = await supabase
        .from('usuarios')
        .upsert({
          id: userId,
          usuario: dniVal,
          dni: dniVal,
          nombre: nombre,
          apellido: apellido,
          email: emailSintetico,
          rol: rol,
          estado: 'ACTIVO'
        }, { onConflict: 'usuario' });

      if (profileError) {
        console.warn('Advertencia actualizando usuario:', profileError.message);
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

      alert(`✅ Usuario ${nombre} ${apellido} (${rol.toUpperCase()}) guardado correctamente en Supabase Auth.`);
      this.cerrarModal();
      this.cargarUsuarios();

    } catch (err) {
      console.error('Error general:', err);
      alert('Error inesperado: ' + (err.message || 'Consulte la consola.'));
    } finally {
      this.estaProcesando = false;
    }
  },

  async cambiarEstado(userId, nuevoEstado) {
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ estado: nuevoEstado })
        .or(`id.eq.${userId},usuario.eq.${userId}`);

      if (error) throw error;
      this.cargarUsuarios();
    } catch (err) {
      console.error('Error al actualizar estado:', err);
    }
  },

  async cambiarRol(userId, nuevoRol) {
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ rol: nuevoRol })
        .or(`id.eq.${userId},usuario.eq.${userId}`);

      if (error) throw error;
      
      const idx = this.listaUsuarios.findIndex(u => u.id === userId || u.usuario === userId);
      if (idx !== -1) this.listaUsuarios[idx].rol = nuevoRol;
      this.renderizarTabla();
    } catch (err) {
      console.error('Error al actualizar rol:', err);
    }
  },

  async eliminarUsuario(userId, nombreMostrar) {
    const usuarioABorrar = nombreMostrar || userId;

    const confirmar = confirm(`⚠️ ¿Estás seguro de que querés eliminar definitivamente a "${usuarioABorrar}"?\nEsta acción no se puede deshacer.`);
    if (!confirmar) return;

    try {
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .or(`id.eq.${userId},usuario.eq.${userId}`);

      if (error) throw error;

      alert(`🗑️ Usuario "${usuarioABorrar}" eliminado correctamente.`);
      await this.cargarUsuarios();

    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      alert('Error al eliminar usuario: ' + (err.message || 'Ocurrió un problema durante la baja.'));
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
