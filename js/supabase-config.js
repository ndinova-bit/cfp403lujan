// ---------------------------------------------------------------------------
// Entorno de prueba (opcional): si en js/entorno-prueba.js se cargaron los datos de un
// segundo proyecto de Supabase, se activa abriendo la página con  ?entorno=prueba
// y se desactiva con  ?entorno=produccion.  Mientras está activo se ve un cartel naranja.
// ---------------------------------------------------------------------------
(function () {
  try {
    const pedido = new URLSearchParams(window.location.search).get('entorno');
    if (pedido === 'prueba') localStorage.setItem('cfp403_entorno', 'prueba');
    if (pedido === 'produccion') localStorage.removeItem('cfp403_entorno');

    const cfg = window.ENTORNO_PRUEBA;
    if (localStorage.getItem('cfp403_entorno') === 'prueba' && cfg && cfg.url && cfg.anonKey) {
      window.SUPABASE_URL = cfg.url;
      window.SUPABASE_ANON_KEY = cfg.anonKey;
      window.addEventListener('DOMContentLoaded', () => {
        const b = document.createElement('div');
        b.textContent = '🧪 ENTORNO DE PRUEBA — los datos de esta pantalla NO son los reales';
        b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:30000;background:#f97316;color:#000;text-align:center;font:600 13px sans-serif;padding:4px;';
        document.body.appendChild(b);
      });
    }
  } catch (e) { /* sin storage: se usa producción */ }
})();

// Configuración de Supabase
if (typeof SUPABASE_URL === 'undefined') {
  var SUPABASE_URL = 'https://dxgqtdaexlegsaohdywx.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3F0ZGFleGxlZ3Nhb2hkeXd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MDk3MTMsImV4cCI6MjEwNTk4NTcxM30.XFH0vQYm68RQcY8fQNbCx_5kt6Iclb-QeJWGBuyNQow';
}

// Inicializar el cliente Supabase de forma segura
// Guardamos la librería antes de que `window.supabase` pase a ser el cliente
if (!window.supabaseLib) window.supabaseLib = window.supabase;

if (typeof window.supabaseClient === 'undefined') {
  window.supabaseClient = window.supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Aseguramos que la instancia global tenga la referencia correcta
window.supabase = window.supabaseClient;

// Cliente secundario que NO toca la sesión del administrador
// (se usa para dar de alta usuarios sin que el admin quede deslogueado)
window.crearClienteTemporal = function () {
  return window.supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'cfp403-alta-temporal'
    }
  });
};

// Funciones globales de alertas
function alertError(titulo, mensaje) {
  const text = mensaje || titulo;
  const title = mensaje ? titulo : 'Error';
  if (typeof Swal !== 'undefined') {
    Swal.fire({ icon: 'error', title: title, text: text, confirmButtonColor: '#2563eb' });
  } else {
    alert(`${title}: ${text}`);
  }
}

function alertSuccess(titulo, mensaje) {
  const text = mensaje || titulo;
  const title = mensaje ? titulo : '¡Éxito!';
  if (typeof Swal !== 'undefined') {
    Swal.fire({ icon: 'success', title: title, text: text, confirmButtonColor: '#2563eb' });
  } else {
    alert(`${title}: ${text}`);
  }
}

// Función notify compatible con notify(tipo, mensaje) o notify(mensaje)
function notify(tipoOrMensaje, mensaje) {
  const icon = mensaje ? tipoOrMensaje : 'info';
  const text = mensaje || tipoOrMensaje;

  if (typeof Swal !== 'undefined') {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });

    Toast.fire({
      icon: ['success', 'error', 'warning', 'info', 'question'].includes(icon) ? icon : 'info',
      title: text
    });
  } else {
    alert(text);
  }
}

// Exportamos globalmente
window.alertError = alertError;
window.alertSuccess = alertSuccess;
window.windowNotify = notify;
window.notify = notify;

// Escapa texto para mostrarlo de forma segura dentro de HTML (usar en todo dato que escribió una persona)
window.escHtml = function (t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
};

// Contraseña inicial aleatoria (sin letras ni números que se confundan: 0/O, 1/l/I)
window.generarClaveInicial = function (largo = 9) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(largo);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
};
