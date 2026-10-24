/* ==========================================================================
   APP INSTALABLE · celular y computadora
   Archivo: js/app.js
   - Registra el service worker (sw.js) para instalar la plataforma y abrirla sin señal.
   - Muestra el botón "Instalar app" (Android, Chrome y Edge) o cómo hacerlo en iPhone.
   - Avisa cuando hay una versión nueva y cuando no hay conexión.
   - Cuando vuelve la señal, envía la asistencia que quedó guardada en el dispositivo.
   ========================================================================== */
const AppCFP = {
  eventoInstalar: null,
  CLAVE_OCULTO: 'cfp_app_instalar_oculto',

  esInstalada() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  },
  esIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  },
  leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  escribir(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },

  iniciar() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').then((reg) => this.vigilarActualizaciones(reg)).catch((e) => console.warn('App: sin service worker', e));
      let recargando = false;
      const habiaVersion = !!navigator.serviceWorker.controller;   // la primera instalación no recarga la página
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recargando || !habiaVersion) return;
        recargando = true;
        location.reload();
      });
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.eventoInstalar = e;
      this.mostrarInvitacion();
    });
    window.addEventListener('appinstalled', () => {
      this.eventoInstalar = null;
      this.quitar('app-invitacion');
      this.toast('¡Listo! La plataforma quedó instalada.');
    });
    window.addEventListener('online', () => { this.estadoConexion(); this.sincronizar(); });
    window.addEventListener('offline', () => this.estadoConexion());
    this.estadoConexion();
    // En iPhone no hay botón automático: se explica cómo agregarla a la pantalla de inicio
    if (this.esIOS() && !this.esInstalada()) setTimeout(() => this.mostrarInvitacion(), 4000);
    // Envía lo pendiente al abrir y cada 2 minutos mientras haya algo guardado
    setTimeout(() => this.sincronizar(), 5000);
    setInterval(() => this.sincronizar(), 120000);
  },

  vigilarActualizaciones(reg) {
    const avisar = (sw) => {
      if (!sw || !navigator.serviceWorker.controller) return;
      this.barra('app-actualizar', '🔄 Hay una versión nueva de la plataforma.', 'Actualizar', () => sw.postMessage('actualizar'));
    };
    if (reg.waiting) avisar(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      if (nuevo) nuevo.addEventListener('statechange', () => { if (nuevo.state === 'installed') avisar(nuevo); });
    });
    setInterval(() => reg.update().catch(() => null), 30 * 60000);
  },

  /* ---------- Invitación a instalar ---------- */
  mostrarInvitacion() {
    if (this.esInstalada() || this.leer(this.CLAVE_OCULTO)) return;
    if (!this.eventoInstalar && !this.esIOS()) return;
    const texto = this.esIOS()
      ? '📲 Instalá la plataforma: tocá <b>Compartir</b> <span aria-hidden="true">⬆️</span> y después <b>Agregar a inicio</b>.'
      : '📲 Instalá la plataforma en este dispositivo para abrirla como una app.';
    this.barra('app-invitacion', texto, this.esIOS() ? 'Cómo' : 'Instalar', () => this.instalar(), () => this.escribir(this.CLAVE_OCULTO, '1'));
  },

  async instalar() {
    if (this.esIOS()) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({ title: 'Instalar en iPhone o iPad', html: '1. Abrí la plataforma en <b>Safari</b>.<br>2. Tocá <b>Compartir</b> (el cuadrado con la flecha).<br>3. Elegí <b>Agregar a inicio</b>.', icon: 'info' });
      }
      return;
    }
    if (!this.eventoInstalar) {
      if (this.esInstalada()) return this.toast('La plataforma ya está instalada en este dispositivo.');
      if (typeof Swal !== 'undefined') {
        Swal.fire({ title: 'Instalar la plataforma', html: 'En <b>Chrome</b> o <b>Edge</b>: abrí el menú (⋮) y elegí <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.<br><br>En iPhone: Safari → <b>Compartir</b> → <b>Agregar a inicio</b>.', icon: 'info' });
      }
      return;
    }
    try {
      await this.eventoInstalar.prompt();
      await this.eventoInstalar.userChoice;
    } catch (e) {
      // El navegador ya no deja usar el aviso automático: se explica el camino manual
      this.eventoInstalar = null;
      if (typeof Swal !== 'undefined') Swal.fire({ title: 'Instalar la plataforma', html: 'Abrí el menú del navegador (⋮) y elegí <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.', icon: 'info' });
      return;
    }
    this.eventoInstalar = null;
    this.quitar('app-invitacion');
  },

  /* ---------- Conexión ---------- */
  estadoConexion() {
    if (navigator.onLine) {
      this.quitar('app-sin-senal');
      return;
    }
    this.barra('app-sin-senal', '📵 Sin conexión. Podés tomar asistencia: se guarda en este dispositivo y se envía sola cuando vuelva la señal.', null, null, null, 'aviso');
  },

  async sincronizar() {
    if (!navigator.onLine || !window.AsistenciasModulo || !AsistenciasModulo.pendientes) return;
    if (!AsistenciasModulo.pendientes().length) return;
    try {
      const n = await AsistenciasModulo.enviarPendientes();
      if (n) this.toast(`✅ Se enviaron ${n} asistencia(s) que estaban guardadas en el dispositivo.`);
    } catch (e) { /* se reintenta más tarde */ }
  },

  /* ---------- Barras de aviso ---------- */
  barra(id, html, accion, alAccionar, alCerrar, tipo = '') {
    this.quitar(id);
    const d = document.createElement('div');
    d.id = id;
    d.className = `app-barra ${tipo}`;
    d.setAttribute('role', 'status');
    d.innerHTML = `<span class="app-barra-txt">${html}</span>${accion ? `<button type="button" class="app-barra-btn">${accion}</button>` : ''}${alCerrar !== undefined ? '<button type="button" class="app-barra-x" aria-label="Cerrar">×</button>' : ''}`;
    document.body.appendChild(d);
    const b = d.querySelector('.app-barra-btn');
    if (b && alAccionar) { b.onclick = alAccionar; const t = d.querySelector('.app-barra-txt'); if (t) { t.style.cursor = 'pointer'; t.onclick = alAccionar; } }
    const x = d.querySelector('.app-barra-x');
    if (x) x.onclick = () => { if (alCerrar) alCerrar(); this.quitar(id); };
    this.apilar();
  },
  quitar(id) { const el = document.getElementById(id); if (el) el.remove(); this.apilar(); },
  apilar() {
    let abajo = 16;
    document.querySelectorAll('.app-barra').forEach((el) => { el.style.bottom = abajo + 'px'; abajo += el.offsetHeight + 8; });
  },
  toast(t) {
    if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: t, showConfirmButton: false, timer: 3000 });
  }
};
window.AppCFP = AppCFP;
document.addEventListener('DOMContentLoaded', () => AppCFP.iniciar());
