/* ==========================================================================
   MÓDULO DE AUTENTICACIÓN OFICIAL (DIRECTO Y RÁPIDO)
   Archivo: js/auth.js
   ========================================================================== */

const Auth = {
  usuarioActual: null,

  limpiarIdentificador(val) {
    if (!val) return '';
    return String(val).trim();
  },

  async cerrarSesion() {
    this.usuarioActual = null;
        
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
      // 1. Buscar en la tabla usuarios para obtener el mail exacto y el DNI real
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

      // 2. Autenticar directo en Supabase Auth (sin reintentos lentos)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailAUsar,
        password: passVal
      });

      if (authError || !authData) {
        alert('Usuario, DNI o contraseña incorrectos.');
        return;
      }

      // 3. Obtener el perfil definitivo desde la tabla usuarios
      if (!perfilLocal) {
        const { data: uRes } = await supabase
          .from('usuarios')
          .select('*')
          .or(`email.eq.${emailAUsar},usuario.eq.${userClean}`)
          .maybeSingle();
        perfilLocal = uRes;
      }

      if (!perfilLocal) {
        perfilLocal = {
          id: authData.user.id,
          email: emailAUsar,
          usuario: userClean,
          dni: userClean,
          rol: 'estudiante'
        };
      }

      this.usuarioActual = perfilLocal;

      if (typeof notify === 'function') {
        notify('success', `¡Bienvenido/a ${perfilLocal.nombre || perfilLocal.usuario}!`);
      }

      if (loginScreenEl) {
        loginScreenEl.style.setProperty('display', 'none', 'important');
      }

      if (typeof UI !== 'undefined' && typeof UI.mostrarDashboard === 'function') {
        UI.mostrarDashboard(perfilLocal);
      }

    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      alert('Error de conexión o credenciales inválidas.');
    }
  }
};

window.Auth = Auth;
window.AuthModulo = Auth;
