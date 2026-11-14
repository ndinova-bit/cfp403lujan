// =============================================================================
// Función de Supabase: subir-preinscripcion-drive
//
// Recibe { id } (lo manda la base cuando entra una preinscripción, y la plataforma cuando se
// corrige o confirma), arma el PDF de la ficha y lo guarda en Google Drive:
//   <carpeta raíz> / <ciclo> / <nombre del trayecto> / Ficha_inscripcion_<N.º>_<APELLIDO>.pdf
// Si el archivo ya existe y se pide "forzar", lo reemplaza con la versión actual.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   APPS_SCRIPT_URL, APPS_SCRIPT_SECRET   (puente de Apps Script, ver LEEME.md)
//   SITE_URL          dirección publicada de la plataforma (sin / final): de ahí se toma el generador de PDF y los logos
//
// Desplegar con «Verify JWT» DESACTIVADO (la llama la base de datos), pero la función se autentica sola:
//   · la base de datos manda el encabezado x-internal-secret (secreto guardado en Vault), o
//   · una persona del personal (admin, regente o preceptor activo) manda su sesión.
// Cualquier otro pedido recibe 401. El generador de PDF (js/ficha_inscripcion.js) está fijado por huella (ver
// scripts/huella-ficha.js): el generador de PDF se baja del sitio, pero solo se ejecuta si su huella SHA-256 coincide.
// Solo puede leer preinscripciones que ya existen y solo guarda ese PDF; nunca devuelve datos personales.
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as PDFLib from 'https://esm.sh/pdf-lib@1.17.1';


const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

// Comparación de texto en tiempo constante
function igual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}

// ¿Quién llama? secreto interno (la base de datos) o sesión de personal. Si no, no pasa.
async function autorizado(req: Request, admin: any, roles: string[]): Promise<boolean> {
  const sec = req.headers.get('x-internal-secret');
  if (sec) {
    const { data } = await admin.rpc('secreto_interno');
    if (typeof data === 'string' && data.length >= 20 && igual(sec, data)) return true;
    return false;
  }
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!tok) return false;
  const { data: u } = await admin.auth.getUser(tok);
  if (!u?.user) return false;
  const { data: perfil } = await admin.from('profiles').select('rol, estado').eq('id', u.user.id).maybeSingle();
  if (!perfil) return false;
  return roles.includes(String(perfil.rol).toLowerCase()) && String(perfil.estado || 'ACTIVO').toUpperCase() === 'ACTIVO';
}
const env = (k: string) => Deno.env.get(k) || '';

// Huella SHA-256 de js/ficha_inscripcion.js. Si se modifica ese archivo: node scripts/huella-ficha.js, actualizar acá y redesplegar.
const FICHA_SHA256 = 'c387447e7ca291e8af5f5e47edbbcbe010186bdb9ba0186b378f93194137f2b0';

async function sha256(b: ArrayBuffer): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', b));
  return Array.from(d).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Envía el PDF al «puente» de Apps Script (corre con la cuenta dueña del Drive, sin Google Cloud)
async function enviarAlPuente(d: Record<string, unknown>): Promise<{ archivo_id: string }> {
  const r = await fetch(env('APPS_SCRIPT_URL'), {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
    body: JSON.stringify({ ...d, secreto: env('APPS_SCRIPT_SECRET') }),
  });
  const t = await r.text();
  let j: any = {}; try { j = JSON.parse(t); } catch (_) { throw new Error('El puente de Drive no respondió bien (revisá la implementación del script)'); }
  if (!r.ok || j.error) throw new Error('Drive: ' + (j.error || r.status));
  return j;
}

function aBase64(b: Uint8Array): string {
  let s = ''; const paso = 0x8000;
  for (let i = 0; i < b.length; i += paso) s += String.fromCharCode(...b.subarray(i, i + paso));
  return btoa(s);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  let claveAdmin = '';
  try { const c = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); claveAdmin = c['default'] || (Object.values(c)[0] as string) || ''; } catch (_) { /* nada */ }
  if (!claveAdmin) claveAdmin = env('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(env('SUPABASE_URL'), claveAdmin, { auth: { persistSession: false, autoRefreshToken: false } });

  if (!(await autorizado(req, admin, ['admin', 'administrador', 'regente', 'preceptor']))) return json({ error: 'No autorizado' }, 401);

  let id = 0; let forzar = false;
  try { const b = await req.json(); id = Number(b.id || b.record?.id); forzar = !!b.forzar; } catch (_) { /* vacío */ }
  if (!id) return json({ error: 'Falta el id' }, 400);

  const { data: p, error } = await admin.from('preinscripciones')
    .select('*, trayecto:trayectos(nombre, horario, sede, lugar_dictado)').eq('id', id).maybeSingle();
  if (error || !p) return json({ error: 'Preinscripción no encontrada' }, 404);
  if (p.drive_archivo_id && !forzar) return json({ ok: true, ya_subida: true });

  try {
    if (!env('APPS_SCRIPT_URL') || !env('APPS_SCRIPT_SECRET')) throw new Error('Faltan los secretos APPS_SCRIPT_URL y APPS_SCRIPT_SECRET');

    // PDF: el mismo generador que usa la plataforma
    const sitio = (env('SITE_URL') || 'https://cfp403lujan.com.ar').replace(/\/$/, '');
    const fetchSitio = (ruta: string) => fetch(/^https?:/.test(ruta) ? ruta : `${sitio}/${ruta.replace(/^\//, '')}`);
    // El generador se baja del sitio pero solo se ejecuta si es EXACTAMENTE el archivo conocido (huella fijada)
    const rj = await fetchSitio('js/ficha_inscripcion.js');
    if (!rj.ok) throw new Error('No se pudo leer js/ficha_inscripcion.js de ' + sitio + ' (revisá el secreto SITE_URL)');
    const bytes = await rj.arrayBuffer();
    if ((await sha256(bytes)) !== FICHA_SHA256) throw new Error('js/ficha_inscripcion.js publicado no coincide con la huella esperada: no se ejecuta (actualizá la función)');
    const FICHA_JS = new TextDecoder().decode(bytes);
    const fabrica = new Function('PDFLib', 'window', 'fetch', FICHA_JS + '\nreturn FichaInscripcion;');
    const Ficha = fabrica(PDFLib, {}, fetchSitio);
    const t = p.trayecto || {};
    const pdf: Uint8Array = await Ficha.generarPDF({
      datos: p.datos || {}, numero: p.numero, ciclo: p.ciclo,
      trayecto: { nombre: t.nombre, horario: t.horario, sede: t.sede, lugar: t.lugar_dictado },
    });

    const nombre = `Ficha_inscripcion_${p.numero}_${String(p.apellido || '').replace(/[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]+/g, '_')}.pdf`;
    const archivo = await enviarAlPuente({
      ciclo: String(p.ciclo), trayecto: t.nombre || 'Sin trayecto', nombre,
      archivo_id: p.drive_archivo_id || null, pdf: aBase64(pdf),
    });
    await admin.from('preinscripciones').update({ drive_archivo_id: archivo.archivo_id, drive_subido_en: new Date().toISOString(), drive_error: null }).eq('id', id);
    return json({ ok: true });
  } catch (err) {
    const msg = String((err as Error)?.message || err).slice(0, 300);
    await admin.from('preinscripciones').update({ drive_error: msg }).eq('id', id);
    return json({ error: msg }, 500);
  }
});
