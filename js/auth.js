/* ==========================================================================
   MÓDULO DE AUTENTICACIÓN OFICIAL (SUPABASE AUTH NATIVO)
   Archivo: js/auth.js
   ========================================================================== */

const Auth = {
  usuarioActual: null,

  limpiarIdentificador(val) {
    if (!val) return '';
    return String(val).trim();
  },

  /**
   * Cierra la sesión activa de forma segura
   */
  async cerrarSesion() {
    this.usuarioActual = null;
    localStorage.removeItem('usuario_actual');
    
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Error al cerrar sesión en Supabase:', e);
    }

    if (typeof UI !== 'undefined' && typeof UI.showLoginScreen === 'function') {
      UI.showLoginScreen();
    } else {
      window.location.reload();
    }
  },

  /**
   * Inicio de Sesión Oficial con Supabase Auth (Soporte inteligente DNI / Email)
   */
  iniciarSesion: async function() {
    const loginScreenEl = document.getElementById('login-screen');
    if (loginScreenEl) loginScreenEl.removeAttribute('aria-hidden');

    const userValRaw = document.getElementById('login-user')?.value?.trim() || '';
    const passVal = document.getElementById('login-pass')?.value?.trim() || '';

    if (!userValRaw || !passVal) {
      if (typeof alertError === 'function') {
        alertError('Campos incompletos', 'Por favor ingresá tu usuario/DNI y contraseña.');
      } else {
        alert('Por favor ingresá tu usuario/DNI y contraseña.');
      }
      return;
    }

    const userClean = userValRaw.toLowerCase();
    let candidateEmails = [];

    if (userClean.includes('@')) {
      candidateEmails.push(userClean);
    } else {
      candidateEmails.push(`${userClean}@cfp403.ar`);

      try {
        const { data: dbUser } = await supabase
          .from('usuarios')
          .select('email')
          .eq('usuario', userClean)
          .maybeSingle();

        if (dbUser && dbUser.email) {
          candidateEmails.push(dbUser.email.toLowerCase());
        }
      } catch (e) {
        console.warn('Error al buscar email alternativo por DNI:', e);
      }
    }

    let authData = null;
    let authError = null;

    for (const emailToTry of candidateEmails) {
      const res = await supabase.auth.signInWithPassword({
        email: emailToTry,
        password: passVal
      });

      if (!res.error) {
        authData = res.data;
        authError = null;
        break;
      } else {
        authError = res.error;
      }
    }

    if (authError || !authData) {
      if (typeof alertError === 'function') {
        alertError('Error al ingresar', 'Usuario, DNI o contraseña incorrectos.');
      } else {
        alert('Usuario, DNI o contraseña incorrectos.');
      }
      return;
    }

    let perfil = null;
    const { data: profileRes } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    perfil = profileRes;

    if (!perfil) {
      const { data: usuarioRes } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', authData.user.email)
        .maybeSingle();

      perfil = usuarioRes;
    }

    if (!perfil) {
      await supabase.auth.signOut();
      alertError('Error de perfil', 'No se encontró un perfil válido asociado a este usuario.');
      return;
    }

    const estado = String(perfil.estado || 'ACTIVO').toUpperCase();
    const rolNorm = String(perfil.rol || '').toLowerCase().trim();

    if (rolNorm !== 'admin' && rolNorm !== 'administrador' && estado !== 'ACTIVO' && estado !== 'HABILITADO' && estado !== 'APROBADO') {
      await supabase.auth.signOut();
      if (typeof alertError === 'function') {
        alertError('Cuenta pendiente', 'Tu cuenta está pendiente de aprobación por un administrador.');
      } else {
        alert('Tu cuenta está pendiente de aprobación por un administrador.');
      }
      return;
    }

    this.usuarioActual = perfil;

    if (typeof notify === 'function') {
      notify('success', `¡Bienvenido/a ${perfil.nombre || perfil.dni || 'Usuario'}!`);
    }

    if (loginScreenEl) {
      loginScreenEl.style.setProperty('display', 'none', 'important');
    }

    if (typeof UI !== 'undefined' && typeof UI.mostrarDashboard === 'function') {
      UI.mostrarDashboard(perfil);
    }
  }
};

window.Auth = Auth;
window.AuthModulo = Auth;
