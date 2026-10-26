/* ==========================================================================
   INTERFAZ DE USUARIO Y NAVEGACIÓN (UI)
   Archivo: js/ui.js
   ========================================================================== */

const UI = {
  // Muestra la vista pública inicial
  showLanding() {
    const landing = document.getElementById('landing-screen') || document.querySelector('.public-landing');
    const login = document.getElementById('login-screen');
    const app = document.getElementById('app-screen');

    if (landing) landing.style.setProperty('display', 'block', 'important');
    if (login) login.style.setProperty('display', 'none', 'important');
    if (app) app.style.setProperty('display', 'none', 'important');

    // Sin sesión activa, la web pública recarga solo la oferta del ciclo vigente
    if (window.Trayectos && !(window.Auth && Auth.usuarioActual)) {
      Trayectos.cargarTrayectos();
    }
  },

  // Muestra la pantalla o modal de Login centrado
  showLoginScreen() {
    const landing = document.getElementById('landing-screen') || document.querySelector('.public-landing');
    const login = document.getElementById('login-screen');
    const app = document.getElementById('app-screen');

    if (landing) landing.style.setProperty('display', 'none', 'important');
    if (app) app.style.setProperty('display', 'none', 'important');
    
    if (login) {
      login.removeAttribute('aria-hidden');
      login.style.setProperty('display', 'flex', 'important');
      login.style.setProperty('justify-content', 'center', 'important');
      login.style.setProperty('align-items', 'center', 'important');
      login.style.setProperty('min-height', '100vh', 'important');
      this.toggleAuthTab('login');
    }
  },

  // Cambia entre las pestañas de Login y Registro
  toggleAuthTab(tab) {
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const tabLogin = document.getElementById('tab-btn-login');
    const tabRegister = document.getElementById('tab-btn-register');

    if (tab === 'login') {
      if (formLogin) formLogin.style.display = 'block';
      if (formRegister) formRegister.style.display = 'none';
      if (tabLogin) tabLogin.classList.add('active');
      if (tabRegister) tabRegister.classList.remove('active');
    } else {
      if (formLogin) formLogin.style.display = 'none';
      if (formRegister) formRegister.style.display = 'block';
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabRegister) tabRegister.classList.add('active');
    }
  },

  // Muestra la plataforma adaptada estrictamente al rol del usuario
  mostrarDashboard(perfil) {
    if (!perfil) return;

    if (perfil.usuario) perfil.usuario = String(perfil.usuario).split(':')[0].trim();
    if (perfil.dni) perfil.dni = String(perfil.dni).split(':')[0].trim();

    const landing = document.getElementById('landing-screen') || document.querySelector('.public-landing');
    const login = document.getElementById('login-screen');
    const app = document.getElementById('app-screen');

    if (landing) landing.style.setProperty('display', 'none', 'important');
    if (login) login.style.setProperty('display', 'none', 'important');
    if (app) app.style.setProperty('display', 'flex', 'important'); 

    const displayUsername = document.getElementById('display-username');
    const displayRole = document.getElementById('display-role');

    if (displayUsername) {
      let nombreMostrar = perfil.nombre || perfil.usuario || 'USUARIO';
      if (perfil.apellido && perfil.nombre) {
        nombreMostrar = `${perfil.apellido}, ${perfil.nombre}`;
      } else if (perfil.apellido) {
        nombreMostrar = perfil.apellido;
      }
      displayUsername.innerText = nombreMostrar;
    }

    if (displayRole) displayRole.innerText = (perfil.rol || '').toUpperCase();

    const rolNorm = (perfil.rol || '').toLowerCase().trim();
    const isAdmin = Auth.esDireccion(rolNorm);          // administración o regencia
    const esAdminTotal = Auth.esAdmin(rolNorm);          // solo administración: usuarios, roles y respaldos
    const esSecretaria = Auth.esSecretaria(rolNorm);

    if (app) app.setAttribute('data-rol', rolNorm);

    // Filtrar visibilidad de botones en la barra lateral
    const btnDashboard = document.getElementById('btn-dashboard');
    const btnNuevoTrayecto = document.getElementById('btn-nuevo-trayecto');
    const btnCertificados = document.getElementById('btn-certificados');
    const btnUsuarios = document.getElementById('btn-usuarios');
    const btnActas = document.getElementById('btn-actas');

    if (btnDashboard) btnDashboard.style.setProperty('display', isAdmin ? 'flex' : 'none', 'important');
    if (btnNuevoTrayecto) btnNuevoTrayecto.style.setProperty('display', isAdmin ? 'flex' : 'none', 'important');
    if (btnCertificados) btnCertificados.style.setProperty('display', isAdmin ? 'flex' : 'none', 'important');
    if (btnUsuarios) btnUsuarios.style.setProperty('display', isAdmin ? 'flex' : 'none', 'important');
    // Fichas / Actas de Examen: carga para dirección; Secretaría solo ve e imprime (sin editar).
    if (btnActas) btnActas.style.setProperty('display', (isAdmin || esSecretaria) ? 'flex' : 'none', 'important');

    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.setProperty('display', isAdmin ? (el.tagName === 'BUTTON' ? 'inline-flex' : 'block') : 'none', 'important');
    });

    // Regencia no gestiona usuarios/roles/claves ni respaldos y cierre de ciclo
    ['btn-usuarios', 'btn-backups'].forEach(id => {
      const b = document.getElementById(id);
      if (b && !esAdminTotal) b.style.setProperty('display', 'none', 'important');
    });
    // Novedades: Director y Regente publican avisos generales; docentes y preceptores, avisos internos de trayectos
    const btnNov = document.getElementById('btn-novedades');
    if (btnNov) btnNov.style.setProperty('display', (isAdmin || rolNorm === 'docente' || rolNorm === 'preceptor') ? 'flex' : 'none', 'important');
    // Crear usuarios y asignar roles: solo el administrador (la regencia no ve esos botones)
    document.querySelectorAll('.solo-admin-total').forEach(el => {
      if (!esAdminTotal) el.style.setProperty('display', 'none', 'important');
      else el.style.removeProperty('display');
    });
    // Panel de cifras: Secretaría, dirección, regencia y preceptoría
    const btnPlan = document.getElementById('btn-planilla');   // planilla de matrícula: todo el personal
    if (btnPlan) btnPlan.style.setProperty('display', (rolNorm !== 'estudiante') ? 'flex' : 'none', 'important');
    const btnCons = document.getElementById('btn-constancias');   // constancias: dirección, regencia, preceptoría y secretaría
    if (btnCons) btnCons.style.setProperty('display', (esSecretaria || isAdmin || rolNorm === 'preceptor') ? 'flex' : 'none', 'important');
    const btnCue = document.getElementById('btn-cuentas');   // restablecer claves y aprobar estudiantes: regencia y preceptoría
    if (btnCue) btnCue.style.setProperty('display', (rolNorm === 'regente' || rolNorm === 'preceptor') ? 'flex' : 'none', 'important');
    const btnObs = document.getElementById('btn-observaciones');   // todo el personal (no estudiantes)
    if (btnObs) btnObs.style.setProperty('display', rolNorm !== 'estudiante' ? 'flex' : 'none', 'important');
    if (rolNorm !== 'estudiante' && window.ObservacionesModulo) setTimeout(() => ObservacionesModulo.contarPendientes(), 1000);
    const btnSec = document.getElementById('btn-secretaria');
    if (btnSec) btnSec.style.setProperty('display', (esSecretaria || isAdmin || rolNorm === 'preceptor') ? 'flex' : 'none', 'important');
    // Cooperadora: carga (director, regente, preceptoría) y visualización (+ secretaría). Nunca docentes ni estudiantes.
    const btnCoop = document.getElementById('btn-cooperadora');
    if (btnCoop) btnCoop.style.setProperty('display', (Auth.esPersonal(rolNorm) || esSecretaria) ? 'flex' : 'none', 'important');
    if (esSecretaria) {
      const bt = document.getElementById('btn-trayectos');
      if (bt) bt.style.setProperty('display', 'none', 'important');
    }

    const btnProg = document.getElementById('btn-progreso');
    if (btnProg) btnProg.style.setProperty('display', rolNorm === 'estudiante' ? 'flex' : 'none', 'important');
    const btnSeg = document.getElementById('btn-seguimiento');
    const puedeSeguir = isAdmin || rolNorm === 'docente' || rolNorm === 'preceptor';
    if (btnSeg) btnSeg.style.setProperty('display', puedeSeguir ? 'flex' : 'none', 'important');
    if (puedeSeguir && window.SeguimientoModulo) setTimeout(() => SeguimientoModulo.contarPendientes(), 800);

    if (esSecretaria) {
      this.showTab('secretaria');
    } else if (!isAdmin) {
      this.showTab('trayectos');
    } else {
      this.showTab('dashboard');
    }
  },

// Menú lateral en celulares: se abre con el botón ☰ y se cierra al elegir una opción
  toggleMenu(abrir) {
    const sb = document.querySelector('#app-screen .sidebar');
    const ov = document.getElementById('menu-overlay');
    if (!sb) return;
    const abierto = typeof abrir === 'boolean' ? abrir : !sb.classList.contains('open');
    sb.classList.toggle('open', abierto);
    if (ov) ov.classList.toggle('open', abierto);
  },

  // Cambia entre secciones dentro del Panel validando permisos reales en 'usuarios'
  async showTab(tabId) {
    this.toggleMenu(false);
    // El rol sale del perfil de la sesión (tabla `profiles`)
    const perfil = await Auth.obtenerPerfilSesion();
    if (!perfil) {
      this.showLoginScreen();
      return;
    }
    const isAdmin = Auth.esDireccion(perfil.rol);
    const rolPerfil = String(perfil.rol || '').toLowerCase().trim();
    if (Auth.esSecretaria(rolPerfil) && !['secretaria', 'observaciones', 'cooperadora', 'actas'].includes(tabId)) tabId = 'secretaria';
    if (tabId === 'secretaria' && !(Auth.esSecretaria(rolPerfil) || isAdmin || rolPerfil === 'preceptor')) tabId = 'trayectos';
    if (tabId === 'estadisticas' && !isAdmin) tabId = 'trayectos';
    if (tabId === 'observaciones' && rolPerfil === 'estudiante') tabId = 'trayectos';
    if (tabId === 'cuentas' && !(rolPerfil === 'regente' || rolPerfil === 'preceptor')) tabId = isAdmin ? 'dashboard' : 'trayectos';
    if (tabId === 'cooperadora' && !(Auth.esPersonal(rolPerfil) || Auth.esSecretaria(rolPerfil))) tabId = isAdmin ? 'dashboard' : 'trayectos';
    // Regencia: no entra a usuarios/roles ni a respaldos
    if ((tabId === 'usuarios' || tabId === 'backups') && !Auth.esAdmin(perfil.rol)) tabId = isAdmin ? 'dashboard' : 'trayectos';

    if (tabId === 'novedades' && !(isAdmin || rolPerfil === 'docente' || rolPerfil === 'preceptor')) tabId = isAdmin ? 'dashboard' : 'trayectos';
    // Fichas / Actas de Examen: dirección edita; Secretaría solo ve e imprime (ver showTab de más abajo).
    if (tabId === 'actas' && !(isAdmin || Auth.esSecretaria(rolPerfil))) tabId = isAdmin ? 'dashboard' : 'trayectos';
    if (!isAdmin && (tabId === 'dashboard' || tabId === 'nuevo-trayecto' || tabId === 'certificados' || tabId === 'usuarios' || tabId === 'backups' || tabId === 'auditoria')) {
      tabId = 'trayectos';
    }

    const rolActual = String(perfil.rol || '').toLowerCase().trim();
    if (tabId === 'seguimiento' && !isAdmin && rolActual !== 'docente' && rolActual !== 'preceptor') tabId = 'trayectos';

    document.querySelectorAll('.section-tab').forEach(sec => {
      sec.style.setProperty('display', 'none', 'important');
      sec.classList.remove('active');
    });

    document.querySelectorAll('.sidebar-nav .nav-item-btn, .sidebar-nav button').forEach(btn => {
      btn.classList.remove('active');
    });

    const targetSection = document.getElementById(tabId === 'dashboard' ? 'sec-dashboard' : tabId);
    if (targetSection) {
      targetSection.style.setProperty('display', 'block', 'important');
      targetSection.classList.add('active');
    }

    const activeBtn = document.getElementById(`btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');

    const titleEl = document.getElementById('current-section-title');
    if (titleEl) {
      const titles = {
        'dashboard': 'Dashboard',
        'progreso': 'Mi progreso',
        'seguimiento': 'Seguimiento',
        'secretaria': 'Panel de cifras por trayecto',
        'cuentas': 'Cuentas y claves',
        'estadisticas': 'Estadísticas de trayectos',
        'observaciones': 'Observaciones',
        'cooperadora': 'Cooperadora Escolar',
        'novedades': 'Novedades y calendario',
        'trayectos': (isAdmin || rolActual === 'preceptor') ? 'Trayectos Formativos' : 'Mis Trayectos Formativos',
        'actas': 'Fichas de Curso / Actas de Examen',
        'nuevo-trayecto': 'Cargar Trayecto',
        'certificados': 'Emitir Certificados',
        'usuarios': 'Usuarios y Roles',
        'backups': 'Base de Datos',
        'auditoria': 'Auditoría de cambios'
      };
      titleEl.innerText = titles[tabId] || 'Panel de Control';
    }

    if (tabId === 'usuarios' && window.UsuariosAdmin) {
      window.UsuariosAdmin.cargarUsuarios();
    }

    if (tabId === 'backups' && window.UsoBase) {
      window.UsoBase.cargar();
    }

    if (tabId === 'certificados' && window.CertificadosAdmin) {
      window.CertificadosAdmin.cargarNominaCertificados();
    }

    if (tabId === 'novedades' && window.NovedadesModulo) {
      window.NovedadesModulo.cargarAdmin();
    }

    if ((tabId === 'trayectos' || tabId === 'progreso') && window.NovedadesModulo) {
      window.NovedadesModulo.mostrarEnPlataforma();
    }

    if (tabId === 'seguimiento' && window.SeguimientoModulo) {
      window.SeguimientoModulo.cargar();
    }

    if (tabId === 'progreso' && window.ProgresoModulo) {
      window.ProgresoModulo.cargar();
    }

    if (tabId === 'observaciones' && window.ObservacionesModulo) {
      window.ObservacionesModulo.cargar();
    }

    if (tabId === 'estadisticas' && window.EstadisticasModulo) {
      window.EstadisticasModulo.cargar();
    }

    if (tabId === 'cuentas' && window.CuentasModulo) {
      window.CuentasModulo.cargar();
    }

    if (tabId === 'secretaria' && window.SecretariaModulo) {
      window.SecretariaModulo.cargar();
    }

    if (tabId === 'cooperadora' && window.CooperadoraModulo) {
      window.CooperadoraModulo.cargar();
    }

    if (tabId === 'auditoria' && window.AuditoriaModulo) {
      window.AuditoriaModulo.cargar();
    }

    if (tabId === 'actas' && window.ActasModulo) {
      window.ActasModulo.inicializar();
    }

    if (tabId === 'trayectos') {
      await this.cargarTrayectosDelUsuario();
    }
  },

  // Carga los trayectos vinculados al usuario según su rol delegando en Trayectos
  async cargarTrayectosDelUsuario() {
    if (window.Trayectos && typeof window.Trayectos.cargarTrayectos === 'function') {
      await window.Trayectos.cargarTrayectos();
    }
  },

  // Cierra el modal de alta de usuario
  cerrarModalNuevoUsuario() {
    const modal = document.getElementById('modal-alta-usuario');
    if (modal) {
      modal.classList.remove('open', 'active');
      modal.style.display = 'none';
      document.getElementById('form-alta-usuario')?.reset();
    }
  },

  // Agrega una fila de módulo en el formulario
  agregarFilaModulo() {
    if (window.Trayectos && Trayectos.agregarFilaModulo) { Trayectos.agregarFilaModulo(); return; }
    const contenedor = document.getElementById('contenedor-modulos');
    if (!contenedor) return;

    const div = document.createElement('div');
    div.className = 'modulo-item-card';
    div.innerHTML = `
      <div class="form-grid-2">
        <input type="text" class="mod-nombre form-control" placeholder="Nombre del Módulo" required>
        <input type="text" class="mod-codigo form-control" placeholder="Código (Ej: GH 0050)">
      </div>
      <div class="form-grid-2" style="margin-top: 0.75rem;">
        <div>
          <label style="font-size: 0.75rem;">Fecha Inicio</label>
          <input type="date" class="mod-inicio form-control">
        </div>
        <div>
          <label style="font-size: 0.75rem;">Fecha Fin</label>
          <input type="date" class="mod-fin form-control">
        </div>
      </div>
    `;
    contenedor.appendChild(div);
  }
};

window.UI = UI;

/* ==========================================================================
   VERIFICACIÓN ESTRICTA DE SESIÓN AL INICIAR LA APLICACIÓN
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const btnDashboard = document.getElementById('btn-dashboard');
  if (btnDashboard) {
    btnDashboard.addEventListener('click', () => DashboardAdmin.cargarEstadisticas());
  }

  // 1. Perfil de la sesión activa (null si no hay sesión o si venció)
  let perfilValido = null;
  try {
    perfilValido = await Auth.obtenerPerfilSesion();
  } catch (e) {
    console.warn('Sesión no válida:', e);
  }

  // 2. Sin sesión, sin perfil o cuenta no aprobada: se muestra la web pública
  if (!perfilValido || perfilValido.estado !== 'ACTIVO') {
    // Limpia sesiones viejas que ya no se pueden renovar (evita el error 400 de refresh_token)
    try { await supabase.auth.signOut({ scope: 'local' }); } catch (e) { /* nada */ }
    Auth.limpiarPerfil();
    UI.showLanding();
    return;
  }

  // 3. Renderizar plataforma con el perfil validado por la base de datos
  const rolNorm = perfilValido.rol;
  UI.mostrarDashboard(perfilValido);

  if (Auth.esDireccion(rolNorm)) {
    setTimeout(() => DashboardAdmin.cargarEstadisticas(), 500);
  }
});

/* ==========================================================================
   LÓGICA DINÁMICA DEL DASHBOARD ANALÍTICO (SUPABASE)
   ========================================================================== */

const DashboardAdmin = {
  async cargarEstadisticas() {
    const selectCiclo = document.getElementById('filtro-ciclo-dashboard');
    const cicloSeleccionado = selectCiclo ? selectCiclo.value : '2026';

    const elTrayectos = document.getElementById('stat-count-trayectos');
    const elInscriptos = document.getElementById('stat-count-inscriptos');
    const elAprobados = document.getElementById('stat-count-aprobados');
    const elCertificados = document.getElementById('stat-count-certificados');
    const elDesaprobados = document.getElementById('stat-count-desaprobados');
    const elDesglose = document.getElementById('desglose-trayectos-dashboard');

    try {
      // 1. Traer datos desde Supabase
      const [rTrayectos, rInscripciones] = await Promise.all([
        supabase.from('trayectos').select('*'),
        supabase.from('inscripciones').select('*')
      ]);

      let trayectos = rTrayectos.data || [];
      let inscripciones = rInscripciones.data || [];

      // 2. Filtrar por Ciclo Lectivo
      if (cicloSeleccionado !== 'TODOS') {
        trayectos = trayectos.filter(t => String(t.ciclo_lectivo || '2026') === String(cicloSeleccionado));
        const idsTrayectosCiclo = trayectos.map(t => String(t.id));
        inscripciones = inscripciones.filter(i => idsTrayectosCiclo.includes(String(i.trayecto_id)));
      }

      // 3. Criterio: aprobado = tiene número de egresado cargado (certificación oficial)
      const esAprobado = (i) => !!(i.num_egresado && String(i.num_egresado).trim() !== '');

      const cantTrayectos = trayectos.length;
      const cantInscriptos = inscripciones.length;
      const cantAprobados = inscripciones.filter(esAprobado).length;
      const cantCertificados = cantAprobados;
      const cantDesaprobados = Math.max(0, cantInscriptos - cantAprobados);

      // 4. Inyectar números en las tarjetas KPI
      if (elTrayectos) elTrayectos.textContent = cantTrayectos;
      if (elInscriptos) elInscriptos.textContent = cantInscriptos;
      if (elAprobados) elAprobados.textContent = cantAprobados;
      if (elCertificados) elCertificados.textContent = cantCertificados;
      if (elDesaprobados) elDesaprobados.textContent = cantDesaprobados;

      // 5. Renderizar la tabla de desglose por trayecto
      if (elDesglose) {
        if (trayectos.length === 0) {
          elDesglose.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; padding: 0.5rem;">No hay trayectos registrados para este ciclo lectivo.</p>';
          return;
        }

        let htmlTabla = '<div class="dash-leyenda"><span><i style="background:#3FA7E0"></i>Inscriptos</span><span><i style="background:#F6B81A"></i>Aprobados</span></div><div class="dash-rows">';
        const maxIns = Math.max(1, ...trayectos.map(t => inscripciones.filter(i => String(i.trayecto_id) === String(t.id)).length));
        trayectos.forEach(t => {
          const insT = inscripciones.filter(i => String(i.trayecto_id) === String(t.id));
          const inscrip = insT.length;
          const aprob = insT.filter(esAprobado).length;
          const pct = inscrip > 0 ? Math.round((aprob / inscrip) * 100) : 0;
          const w = Math.round(inscrip / maxIns * 100);
          const wa = inscrip > 0 ? Math.round(aprob / maxIns * 100) : 0;
          htmlTabla += `<div><div class="dash-row-head"><span>${escHtml(t.nombre || 'Sin nombre')}</span><span>${aprob} de ${inscrip} · ${pct}%</span></div><div class="dash-bar"><div class="dash-bar-insc" style="width:${w}%"></div><div class="dash-bar-aprob" style="width:${wa}%"></div></div></div>`;
        });
        htmlTabla += '</div>';
        elDesglose.innerHTML = htmlTabla;
      }

    } catch (err) {
      console.error('Error al calcular métricas del Dashboard:', err);
    }
  }
};

window.DashboardAdmin = DashboardAdmin;
