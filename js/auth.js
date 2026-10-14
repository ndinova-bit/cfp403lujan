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
   * Inicio de Sesión Oficial con Supabase Auth
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

    // Si ingresó solo el DNI o usuario, armamos el correo sintético oficial
    const emailFormat = userValRaw.includes('@') ? userValRaw : `${userValRaw.toLowerCase()}@cfp403.ar`;

    try {
      // 1. Autenticación real mediante Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailFormat,
        password: passVal
      });

      if (error) {
        if (typeof alertError === 'function') {
          alertError('Error al ingresar', 'Usuario, DNI o contraseña incorrectos.');
        } else {
          alert('Usuario, DNI o contraseña incorrectos.');
        }
        return;
      }

      // 2. Traer el perfil validado desde la tabla 'profiles' (protegida por RLS)
      const { data: perfil, errorPerfil } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (errorPerfil || !perfil) {
        await supabase.auth.signOut();
        alertError('Error de perfil', 'No se encontró un perfil válido asociado a este usuario.');
        return;
      }

      // 3. Validar estado habilitado
      const estado = String(perfil.estado || 'ACTIVO').toUpperCase();
      const rolNorm = String(perfil.rol || '').toLowerCase().trim();

      if (rolNorm !== 'admin' && estado !== 'ACTIVO' && estado !== 'HABILITADO' && estado !== 'APROBADO') {
        await supabase.auth.signOut();
        if (typeof alertError === 'function') {
          alertError('Cuenta pendiente', 'Tu cuenta está pendiente de aprobación por un administrador.');
        } else {
          alert('Tu cuenta está pendiente de aprobación por un administrador.');
        }
        return;
      }

      // 4. Iniciar sesión e impactar UI
      this.usuarioActual = perfil;

      if (typeof notify === 'function') {
        notify('success', `¡Bienvenido/a ${perfil.nombre || perfil.dni}!`);
      }

      if (loginScreenEl) {
        loginScreenEl.style.setProperty('display', 'none', 'important');
      }

      if (typeof UI !== 'undefined' && typeof UI.mostrarDashboard === 'function') {
        UI.mostrarDashboard(perfil);
      }

    } catch (err) {
      console.error('Error Auth:', err);
      if (typeof alertError === 'function') {
        alertError('Error al ingresar', 'Credenciales inválidas o problema de conexión.');
      } else {
        alert('Credenciales inválidas o problema de conexión.');
      }
    }
  }
};

window.Auth = Auth;
window.AuthModulo = Auth;
