/* ==========================================================================
   MÓDULO DE AUTENTICACIÓN
   Archivo: js/auth.js

   Cómo funciona (regla única para toda la plataforma):
   - Quién sos lo decide Supabase Auth (email + contraseña).
   - Qué sos (admin / docente / estudiante) lo decide la tabla `profiles`,
     que tiene una fila por usuario con el MISMO id que Supabase Auth.
   - La clave de negocio de un estudiante es su DNI (profiles.dni), que es el
     mismo valor que se guarda en inscripciones.estudiante_user.
   - Lo que el usuario puede VER lo decide la base de datos (RLS), no este
     archivo. Acá solo se decide qué mostrar en pantalla.
   ========================================================================== */

const Auth = {
  usuarioActual: null,

  /* ---------- utilidades ---------- */

  esAdmin(rol) {
    const r = String(rol || '').toLowerCase().trim();
    return r === 'admin' || r === 'administrador';
  },

  // Regencia: casi todo lo de la administración, salvo usuarios/roles/claves, eliminar cuentas, cierre de ciclo y respaldos
  esRegente(rol) {
    return String(rol || '').toLowerCase().trim() === 'regente';
  },

  esSecretaria(rol) {
    const r = String(rol || '').toLowerCase().trim();
    return r === 'secretaria' || r === 'secretario';
  },

  // Dirección en sentido amplio: administración o regencia (lo que se ve y se gestiona a diario)
  esDireccion(rol) {
    return this.esAdmin(rol) || this.esRegente(rol);
  },

  esPreceptor(rol) {
    return String(rol || '').toLowerCase().trim() === 'preceptor';
  },

  // Personal del CFP con acceso a todos los trayectos: administración y preceptoría
  esPersonal(rol) {
    return this.esDireccion(rol) || this.esPreceptor(rol);
  },

  avisar(mensaje) {
    if (typeof alertError === 'function') alertError('Atención', mensaje);
    else alert(mensaje);
  },

  // Normaliza un perfil de la tabla `profiles` al formato que usa toda la app.
  // `usuario` se mantiene como alias del DNI porque otros módulos (clases,
  // asistencias, actas) todavía lo leen con ese nombre.
  normalizarPerfil(p) {
    if (!p) return null;
    const perfil = { ...p };
    perfil.dni = String(perfil.dni || '').trim();
    perfil.usuario = perfil.dni;
    perfil.rol = String(perfil.rol || 'estudiante').toLowerCase().trim();
    perfil.estado = String(perfil.estado || 'ACTIVO').toUpperCase().trim();
    return perfil;
  },

  // Guarda el perfil en memoria y en el navegador (solo para pintar la interfaz).
  guardarPerfil(perfil) {
    this.usuarioActual = perfil;
    window.usuarioActual = perfil;
    try {
      localStorage.setItem('usuario_actual', JSON.stringify(perfil));
    } catch (e) { /* navegador sin storage: no es grave */ }
    document.body.setAttribute('data-rol', perfil.rol);
  },

  limpiarPerfil() {
    this.usuarioActual = null;
    window.usuarioActual = null;
    try { localStorage.removeItem('usuario_actual'); } catch (e) { /* nada */ }
    document.body.removeAttribute('data-rol');
  },

  async cargarPerfilPorId(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('No se pudo leer el perfil:', error.message);
      this.errorDeRed = this.esErrorDeRed(error);
      return null;
    }
    return this.normalizarPerfil(data);
  },

  esErrorDeRed(e) {
    return !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed|fetch/i.test(String((e && (e.message || e)) || ''));
  },

  // Sin señal: se usa el último perfil guardado en este dispositivo (solo para mostrar la
  // interfaz y la asistencia guardada; los datos igual los protege la base de datos).
  perfilSinConexion(userId) {
    try {
      const p = JSON.parse(localStorage.getItem('usuario_actual') || 'null');
      if (p && (!userId || !p.id || p.id === userId)) return this.normalizarPerfil(p);
    } catch (e) { /* nada */ }
    return null;
  },

  // Convierte lo que escribió la persona en el email con el que está registrada.
  // - Si escribió un email, se usa tal cual.
  // - Si escribió un DNI, se usa la convención DNI@cfp403.ar.
  identificadorAEmail(valor) {
    const v = String(valor || '').trim().toLowerCase();
    if (v.includes('@')) return v;
    return `${v.replace(/\D/g, '')}@cfp403.ar`;
  },

  /* ---------- sesión ---------- */

  // Devuelve el perfil de la sesión activa (o null si no hay sesión válida).
  async obtenerPerfilSesion() {
    if (this.usuarioActual) return this.usuarioActual;

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session?.user) {
        if (this.esErrorDeRed(error)) {
          const guardado = this.perfilSinConexion(null);
          if (guardado) { this.guardarPerfil(guardado); return guardado; }
        }
        return null;
      }

      this.errorDeRed = false;
      let perfil = await this.cargarPerfilPorId(data.session.user.id);
      if (!perfil && this.errorDeRed) perfil = this.perfilSinConexion(data.session.user.id);
      if (!perfil) return null;

      this.guardarPerfil(perfil);
      return perfil;
    } catch (err) {
      console.warn('Error obteniendo la sesión:', err);
      if (this.esErrorDeRed(err)) {
        const guardado = this.perfilSinConexion(null);
        if (guardado) { this.guardarPerfil(guardado); return guardado; }
      }
      return null;
    }
  },

  async cerrarSesion() {
    const pend = window.AsistenciasModulo && AsistenciasModulo.pendientes ? AsistenciasModulo.pendientes().length : 0;
    if (pend && !confirm(`Hay ${pend} asistencia(s) guardadas en este dispositivo que todavía no se enviaron (falta señal). Si cerrás la sesión, se envían cuando vuelvas a entrar con tu usuario. ¿Cerrar igual?`)) return;
    this.limpiarPerfil();
    // Las listas guardadas para usar sin señal se borran al salir (la asistencia pendiente no)
    try { Object.keys(localStorage).filter(k => k.startsWith('cfp_cache_')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* nada */ }
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

  /* ---------- ingreso ---------- */

  async iniciarSesion() {
    const userRaw = document.getElementById('login-user')?.value?.trim() || '';
    const pass = document.getElementById('login-pass')?.value || '';

    if (!userRaw || !pass) {
      this.avisar('Ingresá tu usuario / DNI y tu contraseña.');
      return;
    }

    const boton = document.querySelector('#form-login button[type="submit"]');
    if (boton) { boton.disabled = true; boton.dataset.txt = boton.textContent; boton.textContent = 'Ingresando…'; }

    try {
      // 1. Autenticación en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: this.identificadorAEmail(userRaw),
        password: pass
      });

      if (authError || !authData?.user) {
        const msg = String(authError?.message || '');
        if (/email not confirmed/i.test(msg)) {
          this.avisar('Tu cuenta todavía no está confirmada. Avisale a la administración del CFP.');
        } else {
          this.avisar('Usuario, DNI o contraseña incorrectos.');
        }
        return;
      }

      // 2. Perfil real en la tabla `profiles` (mismo id que Auth)
      const perfil = await this.cargarPerfilPorId(authData.user.id);

      if (!perfil) {
        await supabase.auth.signOut();
        this.avisar('Tu cuenta existe pero no tiene perfil asociado. Avisale a la administración del CFP.');
        return;
      }

      // 3. Solo entran cuentas aprobadas
      if (perfil.estado !== 'ACTIVO') {
        await supabase.auth.signOut();
        if (perfil.estado === 'INACTIVO') {
          this.avisar('Tu cuenta está inactiva porque no tenés una inscripción vigente. Si querés volver a cursar, consultá con la administración del CFP.');
          return;
        }
        this.avisar('Tu cuenta está pendiente de aprobación o fue inhabilitada. Consultá con la administración del CFP.');
        return;
      }

      // 4. El rol sale SIEMPRE de la base de datos (el selector del login es solo decorativo)
      this.guardarPerfil(perfil);

      if (typeof notify === 'function') {
        notify('success', `¡Bienvenido/a ${perfil.nombre || perfil.dni}!`);
      }

      const loginScreenEl = document.getElementById('login-screen');
      if (loginScreenEl) loginScreenEl.style.setProperty('display', 'none', 'important');

      if (typeof UI !== 'undefined' && typeof UI.mostrarDashboard === 'function') {
        UI.mostrarDashboard(perfil);
      }
      if (typeof Trayectos !== 'undefined' && typeof Trayectos.cargarTrayectos === 'function') {
        await Trayectos.cargarTrayectos();
      }
      if (this.esDireccion(perfil.rol) && typeof DashboardAdmin !== 'undefined') {
        DashboardAdmin.cargarEstadisticas();
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      this.avisar('No se pudo conectar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      if (boton) { boton.disabled = false; boton.textContent = boton.dataset.txt || 'Iniciar Sesión'; }
    }
  },

  /* ---------- cambio de contraseña (cualquier usuario con sesión) ---------- */

  async cambiarMiClave() {
    if (typeof Swal === 'undefined') {
      this.avisar('No se pudo abrir el formulario. Recargá la página e intentá de nuevo.');
      return;
    }

    const { value: datos } = await Swal.fire({
      title: 'Cambiar mi contraseña',
      html: `
        <input id="clave-actual" type="password" class="swal2-input" placeholder="Contraseña actual" autocomplete="current-password">
        <input id="clave-nueva" type="password" class="swal2-input" placeholder="Contraseña nueva (mínimo 8 caracteres)" autocomplete="new-password">
        <input id="clave-repetir" type="password" class="swal2-input" placeholder="Repetir la contraseña nueva" autocomplete="new-password">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const actual = document.getElementById('clave-actual').value;
        const nueva = document.getElementById('clave-nueva').value;
        const repetir = document.getElementById('clave-repetir').value;
        if (!actual || !nueva || !repetir) { Swal.showValidationMessage('Completá los tres campos.'); return false; }
        if (nueva.length < 8) { Swal.showValidationMessage('La contraseña nueva debe tener al menos 8 caracteres.'); return false; }
        if (nueva !== repetir) { Swal.showValidationMessage('Las contraseñas nuevas no coinciden.'); return false; }
        if (nueva === actual) { Swal.showValidationMessage('La contraseña nueva debe ser distinta de la actual.'); return false; }
        return { actual, nueva };
      }
    });

    if (!datos) return;

    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u?.user?.email;
      if (!email) {
        this.avisar('Tu sesión venció. Volvé a ingresar.');
        return;
      }

      // Se verifica la contraseña actual antes de cambiarla
      const { error: errActual } = await supabase.auth.signInWithPassword({ email, password: datos.actual });
      if (errActual) {
        this.avisar('La contraseña actual no es correcta.');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: datos.nueva, current_password: datos.actual });
      if (error) {
        this.avisar('No se pudo cambiar la contraseña: ' + error.message);
        return;
      }

      if (typeof alertSuccess === 'function') alertSuccess('Contraseña actualizada', 'La próxima vez que ingreses usá tu contraseña nueva.');
      else alert('Contraseña actualizada.');
    } catch (err) {
      console.error('Error al cambiar la contraseña:', err);
      this.avisar('No se pudo conectar. Intentá de nuevo en unos minutos.');
    }
  },

  /* ---------- solicitud de cuenta ---------- */

  // Formulario "Solicitar Cuenta". Crea el usuario en Auth; un trigger de la
  // base crea su fila en `profiles` como ESTUDIANTE y estado PENDIENTE.
  // El rol y la aprobación los define siempre la administración.
  async solicitarRegistro() {
    const nombre = (document.getElementById('reg-nombre')?.value || '').trim().toUpperCase();
    const dni = (document.getElementById('reg-dni')?.value || '').replace(/\D/g, '');
    const pass = document.getElementById('reg-pass')?.value || '';

    if (!nombre || !dni || !pass) {
      this.avisar('Completá nombre, DNI y contraseña.');
      return;
    }
    if (dni.length < 6 || dni.length > 9) {
      this.avisar('El DNI debe tener entre 6 y 9 números, sin puntos.');
      return;
    }
    if (pass.length < 8) {
      this.avisar('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    const boton = document.querySelector('#form-register button[type="submit"]');
    if (boton) boton.disabled = true;

    try {
      const { error } = await supabase.auth.signUp({
        email: `${dni}@cfp403.ar`,
        password: pass,
        options: { data: { dni, nombre, apellido: '' } }
      });

      if (error) {
        if (/already registered|already been registered/i.test(error.message)) {
          this.avisar('Ya existe una cuenta con ese DNI. Si no recordás la contraseña, consultá con la administración.');
        } else {
          this.avisar('No se pudo enviar la solicitud: ' + error.message);
        }
        return;
      }

      // signUp puede dejar la sesión abierta: la cerramos hasta que aprueben la cuenta.
      await supabase.auth.signOut();
      this.limpiarPerfil();

      document.getElementById('form-register')?.reset();
      if (typeof alertSuccess === 'function') {
        alertSuccess('Solicitud enviada', 'Cuando la administración apruebe tu cuenta vas a poder ingresar con tu DNI y tu contraseña.');
      } else {
        alert('Solicitud enviada. Cuando la administración apruebe tu cuenta vas a poder ingresar.');
      }
      if (typeof UI !== 'undefined') UI.toggleAuthTab('login');
    } catch (err) {
      console.error('Error en el registro:', err);
      this.avisar('No se pudo conectar. Intentá de nuevo en unos minutos.');
    } finally {
      if (boton) boton.disabled = false;
    }
  }
};

window.Auth = Auth;
window.AuthModulo = Auth;
