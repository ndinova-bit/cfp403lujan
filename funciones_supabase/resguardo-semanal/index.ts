// =============================================================================
// Función de Supabase: resguardo-semanal
//
// Todas las semanas (la dispara la base, ver sql/48_resguardo_semanal.sql) exporta la tabla
// «auditoria» de los últimos 8 días a un CSV y se lo manda al puente de Apps Script, que lo guarda en
//   Drive de la plataforma / Plataforma CFP 403 / Auditoria / <año> / Auditoria_<fecha>.csv
// Para guardar TODO el historial (primera vez): invocarla con el cuerpo {"todo": true}.
// Es idempotente: si se repite el mismo día, reemplaza el mismo archivo.
// No devuelve datos. Deploy con «Verify JWT» desactivado, pero se autentica sola: encabezado x-internal-secret
// (lo manda la base de datos) o sesión de un administrador activo; cualquier otro pedido recibe 401.
// Secretos: APPS_SCRIPT_URL, APPS_SCRIPT_SECRET (los mismos que subir-preinscripcion-drive).
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

function aBase64(b: Uint8Array): string {
  let s = ''; const paso = 0x8000;
  for (let i = 0; i < b.length; i += paso) s += String.fromCharCode(...b.subarray(i, i + paso));
  return btoa(s);
}
const celda = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const t = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return '"' + t.replace(/"/g, '""') + '"';
};
const hoyAR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  let claveAdmin = '';
  try { const c = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); claveAdmin = c['default'] || (Object.values(c)[0] as string) || ''; } catch (_) { /* nada */ }
  if (!claveAdmin) claveAdmin = env('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(env('SUPABASE_URL'), claveAdmin, { auth: { persistSession: false, autoRefreshToken: false } });

  if (!(await autorizado(req, admin, ['admin', 'administrador']))) return json({ error: 'No autorizado' }, 401);
  let todo = false;
  try { const b = await req.json(); todo = !!b.todo; } catch (_) { /* vacío = semanal */ }

  try {
    if (!env('APPS_SCRIPT_URL') || !env('APPS_SCRIPT_SECRET')) throw new Error('Faltan los secretos APPS_SCRIPT_URL y APPS_SCRIPT_SECRET');
    const desde = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
    const cols = ['id', 'fecha', 'usuario_dni', 'usuario_rol', 'tabla', 'operacion', 'registro_id', 'datos_anteriores', 'datos_nuevos'];
    const filas: string[] = [cols.join(',')];
    let n = 0;
    for (let desdeN = 0; ; desdeN += 1000) {
      let q = admin.from('auditoria').select(cols.join(',')).order('id', { ascending: true }).range(desdeN, desdeN + 999);
      if (!todo) q = q.gte('fecha', desde);
      const { data, error } = await q;
      if (error) throw new Error('Base: ' + error.message);
      if (!data || !data.length) break;
      for (const r of data as Record<string, unknown>[]) { filas.push(cols.map((c) => celda(r[c])).join(',')); n++; }
      if (data.length < 1000) break;
    }
    const hoy = hoyAR();
    const nombre = todo ? `Auditoria_COMPLETA_hasta_${hoy}.csv` : `Auditoria_semana_al_${hoy}.csv`;
    const texto = '﻿' + filas.join('\r\n');
    const r = await fetch(env('APPS_SCRIPT_URL'), {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
      body: JSON.stringify({
        secreto: env('APPS_SCRIPT_SECRET'), destino: 'auditoria', ciclo: hoy.slice(0, 4), nombre,
        mime: 'text/csv', contenido: aBase64(new TextEncoder().encode(texto)),
      }),
    });
    const t = await r.text();
    let j: any = {}; try { j = JSON.parse(t); } catch (_) { throw new Error('El puente de Drive no respondió bien'); }
    if (!r.ok || j.error) throw new Error('Drive: ' + (j.error || r.status));
    return json({ ok: true, filas: n, archivo: nombre });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err).slice(0, 300) }, 500);
  }
});
