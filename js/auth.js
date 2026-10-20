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
    if (this.usuarioActual) {
      const rolNorm = String(this.usuarioActual.rol || '').toLowerCase().trim();
      document.body.setAttribute('data-rol', rolNorm);
      return this.usuarioActual;
    }

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
        
        const rolNorm = String(dbUser.rol || '').toLowerCase().trim();
        document.body.setAttribute('data-rol', rolNorm);

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
    document.body.removeAttribute('data-rol');

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
          .or(`usuario.eq.${userClean},dni.eq.${userClean},email.ilike.${userClean}@%`)
          .maybeSingle();

        if (dbUser) {
          perfilLocal = dbUser;
          emailAUsar = dbUser.email ? dbUser.email.toLowerCase() : `${userClean}@cfp403.ar`;
        } else {
          emailAUsar = `${userClean}@cfp403.ar`;
        }
      }

      // 1. Autenticación oficial en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailAUsar,
        password: passVal
      });

      if (authError || !authData) {
        alert('Usuario, DNI o contraseña incorrectos.');
        return;
      }

      // 2. Obtener el perfil REAL de la tabla usuarios de Supabase
      if (!perfilLocal) {
        const { data: uRes } = await supabase
          .from('usuarios')
          .select('*')
          .or(`email.ilike.${emailAUsar},usuario.eq.${userClean},dni.eq.${userClean}`)
          .maybeSingle();
        perfilLocal = uRes;
      }

      if (!perfilLocal) {
        alert('Error: No se encontró el perfil de usuario asociado en la base de datos.');
        return;
      }

      // 3. ROL REAL DE LA BASE DE DATOS (Sin sobreescribir con el selector del login)
      const rolReal = String(perfilLocal.rol || 'estudiante').toLowerCase().trim();
      perfilLocal.rol = rolReal;

      this.usuarioActual = perfilLocal;
      window.usuarioActual = perfilLocal;

      // Asignar el atributo de rol en la etiqueta <body> para bloqueo CSS estricto
      document.body.setAttribute('data-rol', rolReal);

      if (typeof notify === 'function') {
        notify('success', `¡Bienvenido/a ${perfilLocal.nombre || perfilLocal.usuario}!`);
      }

      if (loginScreenEl) {
        loginScreenEl.style.setProperty('display', 'none', 'important');
      }

      // Renderizar la interfaz según el rol auténtico de BD
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

window.Auth = Auth;
window.AuthModulo = Auth;
