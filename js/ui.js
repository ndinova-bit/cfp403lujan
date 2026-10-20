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
    const isAdmin = rolNorm === 'admin' || rolNorm === 'administrador';

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
    if (btnActas) btnActas.style.setProperty('display', isAdmin ? 'flex' : 'none', 'important');

    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.setProperty('display', isAdmin ? (el.tagName === 'BUTTON' ? 'inline-flex' : 'block') : 'none', 'important');
    });

    if (!isAdmin) {
      this.showTab('trayectos');
    } else {
      this.showTab('dashboard');
    }
  },

// Cambia entre secciones dentro del Panel validando permisos reales en 'usuarios'
  async showTab(tabId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      this.showLoginScreen();
      return;
    }

    // Consultar rol verificado en la tabla auténtica 'usuarios'
    let isAdmin = false;
    try {
      const emailNorm = session.user.email ? session.user.email.toLowerCase() : '';
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('rol')
        .or(`email.ilike.${emailNorm},usuario.ilike.${emailNorm.split('@')[0]}`)
        .maybeSingle();

      const rolNorm = String(perfil?.rol || '').toLowerCase().trim();
      isAdmin = (rolNorm === 'admin' || rolNorm === 'administrador');
    } catch (e) {
      console.warn('Error al verificar permisos:', e);
    }

    if (!isAdmin && (tabId === 'dashboard' || tabId === 'nuevo-trayecto' || tabId === 'certificados' || tabId === 'usuarios' || tabId === 'actas')) {
      tabId = 'trayectos';
    }

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
        'trayectos': isAdmin ? 'Trayectos Formativos' : 'Mis Trayectos Formativos',
        'actas': 'Fichas de Curso / Actas de Examen',
        'nuevo-trayecto': 'Cargar Trayecto',
        'certificados': 'Emitir Certificados',
        'usuarios': 'Usuarios y Roles'
      };
      titleEl.innerText = titles[tabId] || 'Panel de Control';
    }

    if (tabId === 'usuarios' && window.UsuariosAdmin) {
      window.UsuariosAdmin.cargarUsuarios();
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

  // 1. Validar sesión activa en Supabase Auth
  const { data: { session }, error } = await supabase.auth.getSession();

  if (!session || error) {
    localStorage.removeItem('usuario_actual');
    UI.showLanding();
    return;
  }

  // 2. Traer perfil REAL validado desde la base de datos (tabla 'usuarios')
  const emailNorm = session.user.email ? session.user.email.toLowerCase() : '';
  const { data: perfilValido } = await supabase
    .from('usuarios')
    .select('*')
    .or(`email.ilike.${emailNorm},usuario.ilike.${emailNorm.split('@')[0]}`)
    .maybeSingle();

  if (!perfilValido) {
    await supabase.auth.signOut();
    localStorage.removeItem('usuario_actual');
    UI.showLanding();
    return;
  }

  const rolNorm = String(perfilValido.rol || 'estudiante').toLowerCase().trim();
  perfilValido.rol = rolNorm;

  // 3. Renderizar plataforma con el perfil validado por la base de datos
  if (window.AuthModulo) {
    window.AuthModulo.usuarioActual = perfilValido;
  }
  
  document.body.setAttribute('data-rol', rolNorm);
  UI.mostrarDashboard(perfilValido);

  if (rolNorm === 'admin' || rolNorm === 'administrador') {
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

      // 3. Criterio de Aprobado / Apto
      const esAprobado = (i) => {
        const est = String(i.estado || '').toUpperCase();
        if (est === 'DESAPROBADO' || est === 'AUSENTE') return false;

        const tieneNumEgresado = i.num_egresado && String(i.num_egresado).trim() !== '';
        const notaNum = parseFloat(String(i.nota || i.porcentaje || '0').replace('%', ''));
        const notaAprobada = !isNaN(notaNum) && notaNum >= 70;

        return tieneNumEgresado || est === 'APROBADO' || est === 'ACREDITADO' || i.acreditado === true || notaAprobada;
      };

      const cantTrayectos = trayectos.length;
      const cantInscriptos = inscripciones.length;
      const cantAprobados = inscripciones.filter(esAprobado).length;
      
      const cantCertificados = inscripciones.filter(i => 
        i.num_egresado && String(i.num_egresado).trim() !== ''
      ).length;

      const cantDesaprobados = inscripciones.filter(i => {
        const est = String(i.estado || '').toUpperCase();
        return est === 'DESAPROBADO' || est === 'AUSENTE';
      }).length;

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

        let htmlTabla = `
          <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #94a3b8;">
                <th style="padding: 0.5rem;">Trayecto</th>
                <th style="padding: 0.5rem; text-align: center;">Inscriptos</th>
                <th style="padding: 0.5rem; text-align: center;">Aprobados</th>
                <th style="padding: 0.5rem; text-align: right;">Rendimiento</th>
              </tr>
            </thead>
            <tbody>
        `;

        trayectos.forEach(t => {
          const insT = inscripciones.filter(i => String(i.trayecto_id) === String(t.id));
          const inscrip = insT.length;
          const aprob = insT.filter(esAprobado).length;
          const pct = inscrip > 0 ? Math.round((aprob / inscrip) * 100) : 0;

          htmlTabla += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 0.6rem 0.5rem; font-weight: 600; color: #f8fafc;">${(t.nombre || 'Sin Nombre').toUpperCase()}</td>
              <td style="padding: 0.6rem 0.5rem; text-align: center;">${inscrip}</td>
              <td style="padding: 0.6rem 0.5rem; text-align: center; color: #4ade80;">${aprob}</td>
              <td style="padding: 0.6rem 0.5rem; text-align: right; color: #fde047; font-weight: 700;">${pct}%</td>
            </tr>
          `;
        });

        htmlTabla += '</tbody></table>';
        elDesglose.innerHTML = htmlTabla;
      }

    } catch (err) {
      console.error('Error al calcular métricas del Dashboard:', err);
    }
  }
};

window.DashboardAdmin = DashboardAdmin;
