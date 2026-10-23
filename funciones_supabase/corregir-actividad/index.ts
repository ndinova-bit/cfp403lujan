// @ts-nocheck
// =============================================================================
// Función de Supabase: corregir-actividad
//
// Corrige los cuestionarios autocorregibles y los casos de diagnóstico.
// El alumno manda sus respuestas; la función:
//   1. Verifica que sea un estudiante activo, inscripto (y no dado de baja) en
//      el trayecto, que la actividad esté publicada, dentro del plazo y que le
//      queden intentos.
//   2. Lee las respuestas correctas (tabla claves_actividad, que los alumnos no
//      pueden leer) y calcula la nota con el mismo corrector de la plataforma.
//   3. Guarda la nota del MEJOR intento y solo el detalle de ese intento
//      (de los demás queda únicamente la nota).
//
// La clave de servicio (service_role) la pone Supabase sola y nunca sale del servidor.
// El bloque CORRECTOR es copia de js/corrector.js: si se cambia uno, cambiar el otro.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

// INICIO CORRECTOR
const Corrector = {
  /* ---------- Azar con semilla: el mismo alumno ve siempre los mismos valores ---------- */
  hash(str) {
    let h = 2166136261 >>> 0;
    const s = String(str);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  },
  azar(semilla) {
    let a = this.hash(semilla);
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  mezclar(lista, semilla) {
    const r = this.azar(semilla);
    const a = (lista || []).slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  },
  semilla(claseId, dni) { return `${claseId}:${dni}`; },

  /* ---------- Números ---------- */
  decimales(paso) {
    const s = String(paso);
    const i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  },
  // Lee un número escrito por el alumno: acepta coma o punto decimal y unidades al final ("12,5 A")
  leerNumero(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const m = String(v ?? '').replace(/\s/g, '').match(/^[+-]?[\d.,]+(e[+-]?\d+)?/i);
    if (!m) return null;
    let t = m[0];
    if (t.includes('.') && t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(',', '.');
    const n = Number(t);
    return isFinite(n) ? n : null;
  },
  mostrarNumero(n) {
    if (n === null || n === undefined || !isFinite(n)) return '';
    const r = Math.round(n * 1e6) / 1e6;
    return String(r).replace('.', ',');
  },

  /* ---------- Variables por alumno ({R}, {V}…) ---------- */
  valoresVariables(pregunta, semilla) {
    const out = {};
    (pregunta.variables || []).forEach(v => {
      const min = Number(v.min), max = Number(v.max);
      const paso = Number(v.paso) > 0 ? Number(v.paso) : 1;
      if (!isFinite(min) || !isFinite(max)) return;
      const n = Math.max(0, Math.floor((max - min) / paso + 1e-9));
      const r = this.azar(`${semilla}:${pregunta.id}:${v.nombre}`)();
      const val = min + paso * Math.floor(r * (n + 1));
      out[v.nombre] = Number(val.toFixed(this.decimales(paso)));
    });
    return out;
  },
  sustituir(texto, valores) {
    return String(texto || '').replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (m, k) => (k in valores ? this.mostrarNumero(valores[k]) : m));
  },

  /* ---------- Evaluador de fórmulas (sin eval) ----------
     Operaciones: + - * / ^ ( )   Decimales con punto o coma. Argumentos separados con ;
     Funciones: raiz/sqrt, abs, redondear/round(x;dec), sen/sin, cos, tan (en grados),
     asen/asin, acos, atan (devuelven grados), log (base 10), ln, exp, min, max. Constante: pi */
  evaluar(formula, valores = {}) {
    const src = String(formula || '').replace(/[{}]/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/√/g, 'raiz');
    let i = 0;
    const err = (m) => { throw new Error(m); };
    const esp = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    const G = Math.PI / 180;
    const F = {
      raiz: Math.sqrt, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10,
      sen: x => Math.sin(x * G), sin: x => Math.sin(x * G), cos: x => Math.cos(x * G), tan: x => Math.tan(x * G),
      asen: x => Math.asin(x) / G, asin: x => Math.asin(x) / G, acos: x => Math.acos(x) / G, atan: x => Math.atan(x) / G,
      redondear: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d, round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
      min: Math.min, max: Math.max
    };
    const C = { pi: Math.PI };
    const expr = () => {
      let v = term();
      for (;;) { esp(); const c = src[i]; if (c === '+') { i++; v += term(); } else if (c === '-') { i++; v -= term(); } else return v; }
    };
    const term = () => {
      let v = unario();
      for (;;) { esp(); const c = src[i]; if (c === '*') { i++; v *= unario(); } else if (c === '/') { i++; v /= unario(); } else return v; }
    };
    const unario = () => {
      esp();
      if (src[i] === '-') { i++; return -unario(); }
      if (src[i] === '+') { i++; return unario(); }
      return pot();
    };
    const pot = () => {
      const b = prim(); esp();
      if (src[i] === '^') { i++; return Math.pow(b, unario()); }
      return b;
    };
    const prim = () => {
      esp();
      const c = src[i];
      if (c === '(') { i++; const v = expr(); esp(); if (src[i] !== ')') err('Falta cerrar un paréntesis'); i++; return v; }
      const mn = src.slice(i).match(/^\d+([.,]\d+)?(e[+-]?\d+)?/i);
      if (mn) { i += mn[0].length; return Number(mn[0].replace(',', '.')); }
      const mi = src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (mi) {
        const nom = mi[0]; i += nom.length; esp();
        if (src[i] === '(') {
          const fn = F[nom.toLowerCase()];
          if (!fn) err(`Función desconocida: ${nom}`);
          i++; const args = [expr()]; esp();
          while (src[i] === ';') { i++; args.push(expr()); esp(); }
          if (src[i] !== ')') err('Falta cerrar un paréntesis');
          i++;
          return fn(...args);
        }
        if (nom in valores) return Number(valores[nom]);
        if (nom.toLowerCase() in C) return C[nom.toLowerCase()];
        err(`Variable sin definir: ${nom}`);
      }
      err(c === undefined ? 'La fórmula está incompleta' : `No se entiende "${c}"`);
    };
    const v = expr(); esp();
    if (i < src.length) err(`No se entiende "${src.slice(i)}"`);
    if (!isFinite(v)) err('El resultado no es un número (¿división por cero?)');
    return v;
  },

  /* ---------- Textos ---------- */
  normalizar(t) {
    return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '');
  },
  coincideTexto(dado, aceptadas) {
    const d = this.normalizar(dado);
    if (!d) return false;
    return (aceptadas || []).some(a => {
      const x = this.normalizar(a);
      if (x === d || x.replace(/ /g, '') === d.replace(/ /g, '')) return true;
      const nx = this.leerNumero(x), nd = this.leerNumero(d);
      return nx !== null && nd !== null && /^[+-]?[\d.,]+$/.test(x.replace(/ /g, '')) && Math.abs(nx - nd) <= Math.abs(nx) * 1e-9 + 1e-12;
    });
  },

  /* ---------- Corrección de una pregunta: devuelve una fracción entre 0 y 1 ---------- */
  corregirPregunta(p, k, r, semilla) {
    k = k || {};
    switch (p.tipo) {
      case 'opcion': {
        const ok = new Set((k.correctas || []).map(String));
        const dadas = new Set((Array.isArray(r) ? r : (r === undefined || r === null || r === '' ? [] : [r])).map(String));
        if (!ok.size) return 0;
        if (!p.multiple) return dadas.size === 1 && ok.has([...dadas][0]) ? 1 : 0;
        let bien = 0, mal = 0;
        dadas.forEach(x => (ok.has(x) ? bien++ : mal++));
        return Math.max(0, (bien - mal) / ok.size);
      }
      case 'vf': {
        if (r !== true && r !== false && r !== 'true' && r !== 'false') return 0;
        return (r === true || r === 'true') === (k.valor === true || k.valor === 'true') ? 1 : 0;
      }
      case 'numerica': {
        const dado = this.leerNumero(r);
        if (dado === null) return 0;
        let esperado;
        try { esperado = this.evaluar(k.formula, this.valoresVariables(p, semilla)); } catch (e) { return 0; }
        const t = Math.abs(Number(k.tolerancia) || 0);
        const margen = k.tolTipo === 'abs' ? t : Math.abs(esperado) * t / 100;
        return Math.abs(dado - esperado) <= margen + Math.abs(esperado) * 1e-9 + 1e-12 ? 1 : 0;
      }
      case 'ordenar': {
        const orden = (k.orden || []).map(String);
        const dado = (Array.isArray(r) ? r : []).map(String);
        if (!orden.length) return 0;
        let bien = 0;
        orden.forEach((id, idx) => { if (dado[idx] === id) bien++; });
        return bien / orden.length;
      }
      case 'relacionar': {
        const pares = k.pares || {};
        const ids = Object.keys(pares);
        if (!ids.length) return 0;
        const dado = (r && typeof r === 'object') ? r : {};
        return ids.filter(id => String(dado[id] ?? '') === String(pares[id])).length / ids.length;
      }
      case 'completar': {
        const huecos = k.huecos || {};
        const ids = Object.keys(huecos);
        if (!ids.length) return 0;
        const dado = (r && typeof r === 'object') ? r : {};
        return ids.filter(id => this.coincideTexto(dado[id], huecos[id])).length / ids.length;
      }
      case 'imagen': {
        if (p.modo === 'etiquetar') {
          const pares = k.pares || {};
          const ids = Object.keys(pares);
          if (!ids.length) return 0;
          const dado = (r && typeof r === 'object') ? r : {};
          return ids.filter(id => String(dado[id] ?? '') === String(pares[id])).length / ids.length;
        }
        const z = k.zona;
        if (!z || !r || !isFinite(Number(r.x)) || !isFinite(Number(r.y))) return 0;
        // x e y en % del ancho y del alto; el radio en % del ancho. "prop" = alto/ancho de la imagen
        const prop = Number(p.prop) > 0 ? Number(p.prop) : 1;
        const dx = Number(r.x) - Number(z.x);
        const dy = (Number(r.y) - Number(z.y)) * prop;
        return Math.sqrt(dx * dx + dy * dy) <= Number(z.r) ? 1 : 0;
      }
      default:
        return 0;
    }
  },

  /* ---------- Cuestionario completo ---------- */
  corregirCuestionario(contenido, clave, respuestas, semilla) {
    const preguntas = (contenido && contenido.preguntas) || [];
    const kp = (clave && clave.preguntas) || {};
    const r = respuestas || {};
    let total = 0, obtenido = 0;
    const detalle = {};
    preguntas.forEach(p => {
      const pts = Number(p.puntos) > 0 ? Number(p.puntos) : 1;
      const f = this.corregirPregunta(p, kp[p.id], r[p.id], semilla);
      total += pts; obtenido += f * pts;
      detalle[p.id] = { f: Math.round(f * 100) / 100, dev: (kp[p.id] && kp[p.id].explicacion) || '' };
    });
    return { nota: total ? Math.round(100 * obtenido / total) : 0, detalle };
  },

  /* ---------- Caso de diagnóstico con decisiones ramificadas ----------
     respuestas = { camino: [idOpcion, idOpcion, …] } */
  corregirDiagnostico(contenido, clave, respuestas) {
    const nodos = (contenido && contenido.nodos) || [];
    const ko = (clave && clave.opciones) || {};
    const porId = {};
    nodos.forEach(n => { porId[n.id] = n; });
    let actual = porId[contenido && contenido.inicio] || nodos[0];
    const camino = (respuestas && Array.isArray(respuestas.camino)) ? respuestas.camino.slice(0, 40) : [];
    const pasos = [];
    for (const idOp of camino) {
      if (!actual || !(actual.opciones || []).length) break;
      const op = actual.opciones.find(o => String(o.id) === String(idOp));
      if (!op) break;
      const k = ko[op.id] || {};
      pasos.push({ nodo: actual.id, op: op.id, v: Number(k.valor) || 0, dev: k.devolucion || '' });
      actual = op.destino && op.destino !== 'fin' ? porId[op.destino] : null;
    }
    const completo = !actual || !(actual.opciones || []).length;
    const nota = pasos.length ? Math.round(pasos.reduce((a, p) => a + p.v, 0) / pasos.length) : 0;
    return { nota, completo, pasos, final: actual ? actual.id : null };
  },

  /* ---------- Lista de cotejo: cada criterio Logrado (1) / Parcial (0,5) / No logrado (0) ---------- */
  notaCotejo(criterios, valores) {
    const cs = criterios || [];
    if (!cs.length) return null;
    let tot = 0, obt = 0;
    for (const c of cs) {
      const v = valores ? valores[c.id] : undefined;
      if (v === undefined || v === null || v === '') return null;
      const peso = Number(c.peso) > 0 ? Number(c.peso) : 1;
      tot += peso; obt += peso * Number(v);
    }
    return Math.round(100 * obt / tot);
  },

  /* ---------- Presupuesto / cómputo de materiales ---------- */
  totalesPresupuesto(filas) {
    let total = 0;
    const sub = (filas || []).map(f => {
      const c = this.leerNumero(f.cantidad), p = this.leerNumero(f.precio);
      const s = c !== null && p !== null ? Math.round(c * p * 100) / 100 : null;
      if (s !== null) total += s;
      return s;
    });
    return { subtotales: sub, total: Math.round(total * 100) / 100 };
  }
};
// FIN CORRECTOR

const AUTOCORREGIBLES = ['cuestionario', 'diagnostico'];

function hoyAR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

// Se queda solo con las respuestas a preguntas que existen (evita guardar basura)
function limpiar(tipo, contenido, r) {
  if (tipo === 'diagnostico') {
    const camino = Array.isArray(r && r.camino) ? r.camino.slice(0, 40).map((x) => String(x).slice(0, 40)) : [];
    return { camino };
  }
  const out = {};
  const ids = new Set(((contenido && contenido.preguntas) || []).map((p) => String(p.id)));
  if (r && typeof r === 'object') {
    for (const k of Object.keys(r)) if (ids.has(k)) out[k] = r[k];
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    let claveAdmin = '';
    try {
      const claves = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
      claveAdmin = claves['default'] || Object.values(claves)[0] || '';
    } catch (_) {
      claveAdmin = '';
    }
    if (!claveAdmin) claveAdmin = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!claveAdmin) return json({ error: 'El servidor no tiene una clave de administrador configurada' }, 500);

    const admin = createClient(Deno.env.get('SUPABASE_URL'), claveAdmin, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. ¿Quién responde?
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: quien, error: errQuien } = await admin.auth.getUser(token);
    if (errQuien || !quien?.user) return json({ error: 'Sesión inválida. Volvé a ingresar.' }, 401);

    const { data: perfil } = await admin.from('profiles').select('dni, rol, estado').eq('id', quien.user.id).maybeSingle();
    if (!perfil || String(perfil.estado || 'ACTIVO').toUpperCase() !== 'ACTIVO') return json({ error: 'Usuario no habilitado' }, 403);
    const dni = String(perfil.dni || '');
    if (!dni) return json({ error: 'Usuario sin DNI' }, 403);

    // 2. Actividad
    const body = await req.json();
    const claseId = Number(body.clase_id);
    if (!claseId) return json({ error: 'Falta la actividad' }, 400);
    if (JSON.stringify(body.respuestas ?? {}).length > 40000) return json({ error: 'Las respuestas son demasiado largas' }, 400);

    const { data: clase } = await admin.from('clases').select('*').eq('id', claseId).maybeSingle();
    if (!clase) return json({ error: 'La actividad no existe' }, 404);
    if (!AUTOCORREGIBLES.includes(clase.tipo)) return json({ error: 'Esta actividad no se corrige automáticamente' }, 400);
    if (clase.estudiante_user && String(clase.estudiante_user) !== dni) return json({ error: 'Esta actividad es para otro estudiante' }, 403);

    const { data: insc } = await admin.from('inscripciones').select('estado')
      .eq('trayecto_id', clase.trayecto_id).eq('estudiante_user', dni).limit(1);
    const ins = (insc || [])[0];
    if (!ins) return json({ error: 'No estás inscripto/a en este trayecto' }, 403);
    if (String(ins.estado || '').toUpperCase() === 'BAJA') return json({ error: 'Tu inscripción en este trayecto está dada de baja' }, 403);

    if (clase.fecha_publicacion && String(clase.fecha_publicacion).slice(0, 10) > hoyAR()) return json({ error: 'La actividad todavía no está publicada' }, 403);
    if (clase.fecha_limite && Date.now() > new Date(clase.fecha_limite).getTime()) return json({ error: 'Venció el plazo para responder esta actividad' }, 403);

    const contenido = clase.contenido || {};
    const opciones = contenido.opciones || {};
    const maximo = opciones.intentos === undefined || opciones.intentos === null ? 1 : Number(opciones.intentos) || 0; // 0 = sin límite

    const { data: ents } = await admin.from('entregas_actividades').select('*')
      .eq('clase_id', claseId).eq('estudiante_user', dni).order('id', { ascending: true }).limit(1);
    const entrega = (ents || [])[0] || null;
    const usados = entrega ? Number(entrega.intentos) || 0 : 0;
    if (entrega && usados === 0 && entrega.nota !== null && entrega.nota !== '') return json({ error: 'El docente ya calificó esta actividad' }, 409);
    if (maximo > 0 && usados >= maximo) return json({ error: 'Ya usaste todos los intentos de esta actividad' }, 409);

    // 3. Corrección
    const { data: filaClave } = await admin.from('claves_actividad').select('clave').eq('clase_id', claseId).maybeSingle();
    const clave = (filaClave && filaClave.clave) || {};
    const respuestas = limpiar(clase.tipo, contenido, body.respuestas);
    const semilla = Corrector.semilla(claseId, dni);

    let nota = 0, detalle = null;
    if (clase.tipo === 'diagnostico') {
      const res = Corrector.corregirDiagnostico(contenido, clave, respuestas);
      if (!res.completo) return json({ error: 'Todavía no llegaste al final del caso' }, 400);
      nota = res.nota; detalle = res.pasos;
    } else {
      const res = Corrector.corregirCuestionario(contenido, clave, respuestas, semilla);
      nota = res.nota; detalle = res.detalle;
    }

    // 4. Guardar: nota del mejor intento y detalle solo de ese intento
    const anterior = entrega && entrega.nota !== null && entrega.nota !== '' ? parseFloat(entrega.nota) : null;
    const mejora = anterior === null || isNaN(anterior) || nota >= anterior;
    const previas = (entrega && entrega.respuestas && Array.isArray(entrega.respuestas.h)) ? entrega.respuestas.h : [];
    const historial = previas.concat([{ n: nota, f: new Date().toISOString() }]).slice(-20);
    const nuevas = mejora ? { r: respuestas, d: detalle, h: historial } : { ...(entrega.respuestas || {}), h: historial };
    const fila = {
      intentos: usados + 1,
      respuestas: nuevas,
      nota: mejora ? String(nota) : entrega.nota,
      updated_at: new Date().toISOString(),
    };

    if (entrega) {
      const { error } = await admin.from('entregas_actividades').update(fila).eq('id', entrega.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from('entregas_actividades').insert([{ clase_id: claseId, estudiante_user: dni, ...fila }]);
      if (error) throw error;
    }

    return json({
      nota,
      mejor: Number(fila.nota),
      intentos: usados + 1,
      maximo,
      mejoro: mejora,
      detalle: opciones.devolucion === 'nota' ? null : detalle,
    });
  } catch (e) {
    return json({ error: 'No se pudo corregir: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
});
