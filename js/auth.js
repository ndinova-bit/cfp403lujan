/* ==========================================================================
   MÓDULO DE AUTENTICACIÓN OFICIAL (CORREGIDO Y SIN ERRORES DE SINTAXIS)
   Archivo: js/auth.js
   ========================================================================== */

const Auth = {
  usuarioActual: null,

  limpiarIdentificador(val) {
    if (!val) return '';
    return String(val).trim();
  },

  async obtenerPerfilSesion() {
    if (this.usuarioActual) return this.usuarioActual;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) return null;

      const emailNorm = session.user.email ? session.user.email.toLowerCase() : '';

      const { data: dbUser } = await supabase
        .from('usuarios')
        .select('*')
        .or(`email.ilike.${emailNorm},usuario.ilike.${emailNorm.split('@')[0]}`)
        .maybeSingle();

      if (dbUser) {
        this.usuarioActual = dbUser;
        window.usuarioActual = dbUser;
        return dbUser;
      }
    } catch (err) {
      console.warn('Error obteniendo sesión de usuario:', err);
    }
    return null;
  },

  async cerrarSesion() {
    this.usuarioActual = null;
    window.usuarioActual = null;

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Error al cerrar sesión:', e);
    }

    if (typeof UI !== 'undefined' && typeof UI.showLoginScreen === 'function') {
      UI.showLoginScreen();
    } else {
      window.location.reload();
    }
  },

  iniciarSesion: async function() {
    const loginScreenEl = document.getElementById('login-screen');
    if (loginScreenEl) loginScreenEl.removeAttribute('aria-hidden');

    const userValRaw = document.getElementById('login-user')?.value?.trim() || '';
    const passVal = document.getElementById('login-pass')?.value?.trim() || '';
    const roleSelectVal = document.getElementById('role-select')?.value || 'estudiante';

    if (!userValRaw || !passVal) {
      alert('Por favor ingresá tu usuario/DNI y contraseña.');
      return;
    }

    const userClean = userValRaw.toLowerCase();

    try {
      let emailAUsar = userClean;
      let perfilLocal = null;

      if (!userClean.includes('@')) {
        const { data: dbUser } = await supabase
          .from('usuarios')
          .select('*')
          .or(`usuario.eq.${userClean},email.ilike.${userClean}@%`)
          .maybeSingle();

        if (dbUser) {
          perfilLocal = dbUser;
          emailAUsar = dbUser.email ? dbUser.email.toLowerCase() : `${userClean}@cfp403.ar`;
        } else {
          emailAUsar = `${userClean}@cfp403.ar`;
        }
      }

      // 1. Autenticación con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailAUsar,
        password: passVal
      });

      if (authError || !authData) {
        alert('Usuario, DNI o contraseña incorrectos.');
        return;
      }

      // 2. Obtener perfil de la tabla usuarios
      if (!perfilLocal) {
        const { data: uRes } = await supabase
          .from('usuarios')
          .select('*')
          .or(`email.ilike.${emailAUsar},usuario.eq.${userClean}`)
          .maybeSingle();
        perfilLocal = uRes;
      }

      // 3. Asignación/respeto del rol seleccionado o de base de datos
      if (perfilLocal) {
        // Si en BD no tiene rol o es estudiante, pero seleccionó Administrador en el desplegable, asigna el rol
        if (!perfilLocal.rol || (roleSelectVal === 'admin' && perfilLocal.rol !== 'admin')) {
          perfilLocal.rol = roleSelectVal;
        }
      } else {
        perfilLocal = {
          id: authData.user.id,
          email: emailAUsar,
          usuario: userClean,
          dni: userClean,
          rol: roleSelectVal
        };
      }

      this.usuarioActual = perfilLocal;
      window.usuarioActual = perfilLocal;

      if (typeof notify === 'function') {
        notify('success', `¡Bienvenido/a ${perfilLocal.nombre || perfilLocal.usuario}!`);
      }

      if (loginScreenEl) {
        loginScreenEl.style.setProperty('display', 'none', 'important');
      }

      if (typeof UI !== 'undefined' && typeof UI.mostrarDashboard === 'function') {
        UI.mostrarDashboard(perfilLocal);
      }

      if (typeof Trayectos !== 'undefined' && typeof Trayectos.cargarTrayectos === 'function') {
        await Trayectos.cargarTrayectos();
      }

    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      alert('Error de conexión o credenciales inválidas.');
    }
  }
};

window.Auth = Auth;
window.AuthModulo = Auth;
