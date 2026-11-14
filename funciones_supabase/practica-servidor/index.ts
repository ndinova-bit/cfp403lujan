// Función «practica-servidor» · corrige las prácticas de los trayectos virtuales EN EL SERVIDOR.
// Las respuestas correctas están en la tabla privada practica_claves; el navegador solo manda lo que el estudiante eligió
// y recibe si estuvo bien o mal. El puntaje lo calcula esta función (nunca lo manda el navegador) y la nota se carga
// en la plataforma con _registrar_nota_practica (solo ejecutable con la clave de servicio).
// Desplegar con «Verify JWT» DESACTIVADO (el ingreso lo valida esta misma función contra Auth).
// Acciones: iniciar · verificar · revelar · terminar

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const resp = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const db = (path: string, init: RequestInit = {}) =>
  fetch(URL_ + '/rest/v1/' + path, { ...init, headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json', ...(init.headers || {}) } });
const rpc = async (fn: string, args: unknown) => {
  const r = await db('rpc/' + fn, { method: 'POST', body: JSON.stringify(args) });
  if (!r.ok) throw new Error(fn + ': ' + (await r.text()));
  return r.json();
};

// deno-lint-ignore no-explicit-any
type A = any;
const TRAYECTOS_OK = /^[a-z-]{2,30}$/;
const VIDA_SESION_MS = 6 * 3600 * 1000;
const MAX_VERIFICACIONES = 700;
const MAX_SESIONES_NOTA_24H = 4;

async function cargarSesion(id: string, dni: string) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const r = await db('practica_sesiones?select=*&id=eq.' + id + '&dni=eq.' + encodeURIComponent(dni));
  const f = (await r.json())[0];
  return f || null;
}
// Guarda el estado con control de versión (si otra llamada lo cambió en el medio, devuelve false)
async function guardar(s: A): Promise<boolean> {
  const r = await db('practica_sesiones?id=eq.' + s.id + '&version=eq.' + s.version + '&terminada=is.null', {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ estado: s.estado, version: s.version + 1 }) });
  const j = await r.json();
  if (Array.isArray(j) && j.length === 1) { s.version++; return true; }
  return false;
}
async function claves(trayecto: string, practica: number) {
  const r = await db('practica_claves?select=claves&trayecto=eq.' + trayecto + '&practica=eq.' + practica);
  const f = (await r.json())[0];
  return f ? f.claves : null;
}

// Puntos y máximo de una misión según lo que ya registró el servidor (comp: lo que informó el navegador, con tope)
function puntos(k: A, ms: A, comp: A): { p: number; x: number } {
  ms = ms || {};
  switch (k.t) {
    case 'quiz': { let p = 0; k.items.forEach((_: A, i: number) => { const s = ms[i]; if (s && s.d && !s.w) p++; }); return { p, x: k.max }; }
    case 'sort': { let p = 0; k.items.forEach((_: A, i: number) => { const s = ms[i]; if (s && s.d && !s.w) p++; }); return { p, x: k.max }; }
    case 'spot': return { p: Object.keys(ms.f || {}).length, x: k.max };
    case 'tiles': return { p: Object.keys(ms.f || {}).length, x: k.max };
    case 'order': return { p: ms.fin ? ((ms.tries || 0) === 0 ? 1 : (ms.tries === 1 ? 0.5 : 0)) : 0, x: 1 };
    default: { // comp: lo informa el navegador (no se puede verificar en el servidor), pero con tope y máximos fijos
      const permit: number[] = k.maxs || [k.max]; const c = comp || {};
      const x = permit.includes(Number(c.x)) ? Number(c.x) : permit[0];
      const p = Math.max(0, Math.min(x, Number(c.p) || 0));
      return { p: Math.round(p * 100) / 100, x };
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resp(405, { error: 'Método no permitido' });
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return resp(401, { error: 'Falta ingresar' });
    const body: A = await req.json().catch(() => ({}));
    const ur = await fetch(URL_ + '/auth/v1/user', { headers: { apikey: ANON, Authorization: 'Bearer ' + token } });
    if (!ur.ok) return resp(401, { error: 'La sesión venció. Volvé a ingresar.' });
    const user = await ur.json();
    const pr = (await (await db('profiles?select=id,dni,rol,estado&id=eq.' + encodeURIComponent(user.id))).json())[0];
    if (!pr || !pr.dni) return resp(403, { error: 'No encontramos tu perfil.' });
    const rol = String(pr.rol || '').toLowerCase().trim();
    const esAdmin = rol === 'admin' || rol === 'administrador';
    if (String(pr.estado || 'ACTIVO').toUpperCase() !== 'ACTIVO') return resp(403, { error: 'Tu cuenta no está activa.' });
    const dni = String(pr.dni);
    const accion = String(body.accion || '');

    // ---------- iniciar ----------
    if (accion === 'iniciar') {
      const trayecto = String(body.trayecto || ''), practica = Number(body.practica), modo = body.modo === 'nota' ? 'nota' : 'practica';
      if (!TRAYECTOS_OK.test(trayecto) || !Number.isInteger(practica) || practica < 1 || practica > 100) return resp(400, { error: 'Datos inválidos' });
      const k = await claves(trayecto, practica);
      if (!k) return resp(404, { error: 'Esta práctica no se corrige en el servidor.' });
      const est = await rpc('_estado_practica', { p_dni: dni, p_trayecto: trayecto, p_practica: practica });
      const e = est && est.estado;
      if (!esAdmin && (e === 'no_inscripto' || e === 'sin_sesion')) return resp(403, { error: 'No figurás inscripto/a en este trayecto.' });
      if (modo === 'nota' && !esAdmin && e !== 'primer_intento' && e !== 'reintento' && e !== 'sin_clase' && e !== 'no_publicada')
        return resp(409, { error: 'Esta práctica no admite otro intento con nota.', estado: e });
      if (modo === 'nota') {
        const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const r = await db('practica_sesiones?select=id&modo=eq.nota&dni=eq.' + encodeURIComponent(dni) + '&trayecto=eq.' + trayecto + '&practica=eq.' + practica + '&creada=gte.' + desde);
        if ((await r.json()).length >= MAX_SESIONES_NOTA_24H) return resp(429, { error: 'Empezaste esta práctica demasiadas veces hoy. Probá mañana o hablá con tu docente.' });
      }
      const ins = await db('practica_sesiones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ dni, trayecto, practica, modo, estado: { n: 0, m: {} } }) });
      const fila = (await ins.json())[0];
      if (!fila) return resp(500, { error: 'No se pudo iniciar' });
      return resp(200, { sesion: fila.id, estado: e || null });
    }

    // ---------- sincronizar: pasa a la plataforma las notas que quedaron pendientes (práctica todavía no publicada) ----------
    if (accion === 'sincronizar') {
      const r = await db('practica_sesiones?select=id,trayecto,practica,puntaje,estado&modo=eq.nota&dni=eq.' + encodeURIComponent(dni) + '&terminada=not.is.null&estado->>pend=eq.1&order=creada.asc&limit=20');
      const filas = await r.json(); const hechas: A[] = [];
      for (const f of Array.isArray(filas) ? filas : []) {
        const n = await rpc('_registrar_nota_practica', { p_dni: dni, p_trayecto: f.trayecto, p_practica: f.practica, p_puntaje: f.puntaje, p_detalle: ['[carga diferida: la práctica se publicó después]'] });
        if (n !== 'sin_clase' && n !== 'no_publicada') {
          const e2 = f.estado || {}; delete e2.pend; e2.cargada = n;
          await db('practica_sesiones?id=eq.' + f.id, { method: 'PATCH', body: JSON.stringify({ estado: e2 }) });
          hechas.push({ trayecto: f.trayecto, practica: f.practica, nota: n });
        }
      }
      return resp(200, { hechas });
    }

    // ---------- verificar / revelar / terminar: necesitan la sesión ----------
    const s = await cargarSesion(body.sesion, dni);
    if (!s) return resp(404, { error: 'No encontramos esa práctica en curso. Empezala de nuevo.' });
    if (s.terminada) return resp(409, { error: 'Esta práctica ya terminó.' });
    if (Date.now() - new Date(s.creada).getTime() > VIDA_SESION_MS) return resp(410, { error: 'Pasó mucho tiempo. Empezá la práctica de nuevo.' });
    const k = await claves(s.trayecto, s.practica);
    if (!k) return resp(500, { error: 'Faltan las claves de esta práctica.' });
    const est = s.estado || { n: 0, m: {} }; est.m = est.m || {};

    if (accion === 'verificar' || accion === 'revelar') {
      const mi = Number(body.m);
      if (!Number.isInteger(mi) || mi < 0 || mi >= k.misiones.length) return resp(400, { error: 'Misión inválida' });
      const km = k.misiones[mi]; const ms = (est.m[mi] = est.m[mi] || {});
      est.n = (est.n || 0) + 1; if (est.n > MAX_VERIFICACIONES) return resp(429, { error: 'Demasiadas respuestas en esta práctica.' });
      let out: A;
      const idx = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < max ? (v as number) : -1);
      if (accion === 'revelar') {
        if (km.t === 'spot') {
          const f = ms.f || (ms.f = {}); ms.r = ms.r || {}; const faltan: A[] = [];
          km.spans.forEach((sp: A, i: number) => { if (sp.ok != null && !f[i]) { ms.r[i] = 1; faltan.push({ ix: i, l: sp.ok }); } });
          out = { faltan };
        } else if (km.t === 'tiles') {
          const f = ms.f || (ms.f = {}); ms.r = ms.r || {}; const faltan: number[] = [];
          km.items.forEach((it: A, i: number) => { if (it.f && !f[i]) { ms.r[i] = 1; faltan.push(i); } });
          out = { faltan: faltan.map((i) => ({ k: i, x: km.items[i].x })) };
        } else return resp(400, { error: 'No corresponde' });
      } else if (km.t === 'quiz') {
        const i = idx(body.i, km.items.length), kk = Number(body.k); if (i < 0 || !Number.isInteger(kk)) return resp(400, { error: 'Datos inválidos' });
        const st = ms[i] || (ms[i] = { w: 0, d: 0 }); const it = km.items[i];
        if (st.d || kk === it.a) { st.d = 1; out = { ok: true, why: it.why }; } else { st.w = 1; out = { ok: false }; }
      } else if (km.t === 'sort') {
        const i = idx(body.k, km.items.length), b = Number(body.b); if (i < 0 || !Number.isInteger(b)) return resp(400, { error: 'Datos inválidos' });
        const st = ms[i] || (ms[i] = { w: 0, d: 0 }); const it = km.items[i];
        if (st.d || b === it.b) { st.d = 1; out = { ok: true, r: it.w || 'Va en «' + it.ok + '».' }; } else { st.w = 1; out = { ok: false }; }
      } else if (km.t === 'spot') {
        const i = idx(body.ix, km.spans.length); if (i < 0) return resp(400, { error: 'Datos inválidos' });
        const f = ms.f || (ms.f = {}); const sp = km.spans[i];
        if (sp.ok != null) { f[i] = 1; out = { ok: true, label: sp.ok, found: Object.keys(f).length }; } else { ms.miss = (ms.miss || 0) + 1; out = { ok: false, no: sp.no, miss: ms.miss }; }
      } else if (km.t === 'tiles') {
        const i = idx(body.k, km.items.length); if (i < 0) return resp(400, { error: 'Datos inválidos' });
        const f = ms.f || (ms.f = {}); const it = km.items[i];
        if (it.f) { f[i] = 1; out = { ok: true, x: it.x, found: Object.keys(f).length }; } else { ms.miss = (ms.miss || 0) + 1; out = { ok: false, x: it.x, miss: ms.miss }; }
      } else if (km.t === 'order') {
        const kk = idx(body.k, km.rank.length); if (kk < 0) return resp(400, { error: 'Datos inválidos' });
        ms.pos = ms.pos || 0; ms.tries = ms.tries || 0;
        if (ms.fin) out = { ok: true, fin: true, why: km.why };
        else if (km.rank[kk] < ms.pos) out = { ok: true, dup: true };
        else if (km.rank[kk] === ms.pos) { ms.pos++; if (ms.pos === km.rank.length) { ms.fin = 1; out = { ok: true, fin: true, why: km.why }; } else out = { ok: true }; }
        else { ms.tries++; ms.pos = 0; out = { ok: false }; }
      } else return resp(400, { error: 'Esta misión no se verifica acá' });
      s.estado = est;
      if (!(await guardar(s))) return resp(409, { error: 'Se cruzaron dos respuestas. Probá de nuevo.', reintentar: true });
      return resp(200, out);
    }

    if (accion === 'terminar') {
      const comp = body.comp && typeof body.comp === 'object' ? body.comp : {};
      let tot = 0, pts = 0; const rev: A[] = [];
      k.misiones.forEach((km: A, mi: number) => {
        const ms = est.m[mi] || {}; const r = puntos(km, ms, comp[mi]); tot += r.x; pts += r.p;
        if (km.t === 'quiz') km.items.forEach((it: A, i: number) => { if (ms[i] && ms[i].w) rev.push(it.rv); });
        else if (km.t === 'sort') km.items.forEach((it: A, i: number) => { if (ms[i] && ms[i].w) rev.push(it.rv); });
        else if (km.t === 'order') { if (ms.tries) rev.push(km.rv); }
        else if (km.t === 'spot') { let j = 0; km.spans.forEach((sp: A, i: number) => { if (sp.ok != null) { if (ms.r && ms.r[i] && !(ms.f && ms.f[i])) rev.push(km.rv[j]); j++; } }); }
        else if (km.t === 'tiles') km.items.forEach((it: A, i: number) => { if (ms.r && ms.r[i] && !(ms.f && ms.f[i]) && it.rv) rev.push(it.rv); });
      });
      const puntaje = tot > 0 ? Math.round(pts / tot * 100) : 0;
      // Cerrar la sesión de forma atómica: si ya estaba cerrada, no se carga dos veces
      const cierre = await db('practica_sesiones?id=eq.' + s.id + '&terminada=is.null', { method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ terminada: new Date().toISOString(), puntaje, estado: est }) });
      const cj = await cierre.json(); if (!Array.isArray(cj) || cj.length !== 1) return resp(409, { error: 'Esta práctica ya terminó.' });
      let nota: string | null = null;
      if (s.modo === 'nota') {
        const det = Array.isArray(body.log) ? body.log.slice(0, 10).map((x: unknown) => String(x).slice(0, 600)) : null;
        nota = await rpc('_registrar_nota_practica', { p_dni: dni, p_trayecto: s.trayecto, p_practica: s.practica, p_puntaje: puntaje, p_detalle: det });
        if (nota === 'sin_clase' || nota === 'no_publicada') { est.pend = 1; await db('practica_sesiones?id=eq.' + s.id, { method: 'PATCH', body: JSON.stringify({ estado: est }) }); }
      }
      return resp(200, { puntaje, nota, rev });
    }
    return resp(400, { error: 'Acción desconocida' });
  } catch (e) {
    return resp(500, { error: 'Error interno', detalle: String(e) });
  }
});
