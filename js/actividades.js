/* ==========================================================================
   ACTIVIDADES · tipos de publicación, editor, respuestas del alumno y corrección
   Archivo: js/actividades.js   (usa js/corrector.js y lo llama js/clases.js)

   Tipos: material · trabajo práctico (link) · práctica en taller (lista de cotejo)
   · cuestionario autocorregible · respuesta escrita · caso de diagnóstico
   · presupuesto / cómputo · bitácora de taller · encuesta / autoevaluación.

   Las respuestas correctas se guardan en "claves_actividad", que los alumnos no
   pueden leer. Los cuestionarios y diagnósticos los corrige el servidor
   (función corregir-actividad). La nota queda en entregas_actividades.nota, así
   la usan sin cambios Mi progreso, la sábana, las actas y los certificados.
   ========================================================================== */
const Actividades = {
  TIPOS: {
    material:     { ico: '📘', nombre: 'Material de clase',        desc: 'Teoría, apuntes o videos. Sin entrega.' },
    tp:           { ico: '📎', nombre: 'Trabajo práctico',          desc: 'El alumno entrega un link (Drive, PDF, fotos).' },
    practica:     { ico: '🛠️', nombre: 'Práctica en taller',        desc: 'La calificás en el taller con lista de cotejo, sin entrega online.' },
    cuestionario: { ico: '✅', nombre: 'Cuestionario autocorregible', desc: 'Opción múltiple, V/F, cálculos con valores por alumno, ordenar, relacionar, completar, imagen.' },
    escrita:      { ico: '✍️', nombre: 'Respuesta escrita',         desc: 'El alumno escribe en la plataforma y corregís vos.' },
    diagnostico:  { ico: '🔎', nombre: 'Caso de diagnóstico',       desc: 'Una falla y decisiones paso a paso: cada elección lleva a otra situación.' },
    presupuesto:  { ico: '🧮', nombre: 'Presupuesto / cómputo',     desc: 'Tabla de materiales con subtotales y total automáticos.' },
    bitacora:     { ico: '📓', nombre: 'Bitácora de taller',        desc: 'Registro de lo hecho en cada clase, con link opcional a fotos.' },
    encuesta:     { ico: '💬', nombre: 'Encuesta / autoevaluación',  desc: 'Sin nota. Ves los resultados agrupados.' }
  },
  PREGUNTAS: {
    opcion:     { ico: '🔘', nombre: 'Opción múltiple' },
    vf:         { ico: '⚖️', nombre: 'Verdadero / Falso' },
    numerica:   { ico: '🔢', nombre: 'Cálculo numérico' },
    ordenar:    { ico: '↕️', nombre: 'Ordenar pasos' },
    relacionar: { ico: '🔗', nombre: 'Relacionar columnas' },
    completar:  { ico: '✏️', nombre: 'Completar espacios' },
    imagen:     { ico: '🖼️', nombre: 'Identificar en imagen' }
  },
  AUTO: ['cuestionario', 'diagnostico'],                         // los corrige el servidor
  RESPONDE_ALUMNO: ['tp', 'escrita', 'presupuesto', 'bitacora', 'encuesta', 'cuestionario', 'diagnostico'],
  NIVELES: [{ v: 1, txt: 'Logrado', cls: 'ok' }, { v: 0.5, txt: 'Parcial', cls: 'mid' }, { v: 0, txt: 'No logrado', cls: 'bad' }],
  MAX_TEXTO: 2000,

  /* ---------------- utilidades ---------------- */
  esc(t) {
    return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  uid(p = 'x') { return p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); },
  copia(o) { return JSON.parse(JSON.stringify(o ?? null)); },
  // Imagen: link https (por ejemplo GitHub) o ruta del sitio ("img/actividades/tablero.jpg")
  urlImagen(u) {
    const s = String(u || '').trim();
    if (/^img\/[\w\-./]+$/i.test(s) && !s.includes('..')) return s;
    try { const x = new URL(s); return x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; }
  },
  urlSegura(u) {
    try { const x = new URL(String(u || '').trim()); return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : ''; } catch (e) { return ''; }
  },
  get(obj, path) { return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); },
  set(obj, path, val) {
    const ks = String(path).split('.');
    let o = obj;
    ks.slice(0, -1).forEach(k => { if (o[k] == null) o[k] = {}; o = o[k]; });
    o[ks[ks.length - 1]] = val;
  },
  perfil() {
    if (window.Auth && Auth.usuarioActual) return Auth.usuarioActual;
    try { return JSON.parse(localStorage.getItem('usuario_actual') || sessionStorage.getItem('usuario_logueado') || '{}'); } catch (e) { return {}; }
  },
  miDni() { const p = this.perfil(); return String(p.usuario || p.dni || p.id || ''); },
  nombreAlumno(u, dni) {
    const ap = String((u && u.apellido) || '').toUpperCase().trim();
    const no = u && u.nombre ? u.nombre.charAt(0).toUpperCase() + u.nombre.slice(1).toLowerCase() : '';
    return ap && no ? `${ap}, ${no}` : (ap || no || String(dni || ''));
  },
  aviso(icon, title, text) {
    if (typeof Swal !== 'undefined') return Swal.fire({ icon, title, text });
    alert(title + (text ? '\n' + text : ''));
  },
  toast(title) {
    if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title, showConfirmButton: false, timer: 2200 });
  },
  tieneNota(e) { return !!e && e.nota !== null && e.nota !== undefined && e.nota !== ''; },

  /* ---------------- fechas ---------------- */
  hoyISO() { return (window.ReglasFP && ReglasFP.hoyISO) ? ReglasFP.hoyISO() : new Date().toISOString().slice(0, 10); },
  fechaDMY(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''; },
  // timestamptz → "YYYY-MM-DDTHH:MM" en hora argentina (para el campo del formulario)
  limiteLocal(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return '';
    return d.toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 16).replace(' ', 'T');
  },
  limiteISO(local) { return local ? `${local}:00-03:00` : null; },
  limiteTexto(ts) {
    const l = this.limiteLocal(ts);
    return l ? `${this.fechaDMY(l.slice(0, 10))} ${l.slice(11, 16)} h` : '';
  },
  // Estado del plazo: { cls, txt } — vencida, vence hoy, vence en 1-2 días, o vence más adelante
  plazo(c) {
    if (!c || !c.fecha_limite) return null;
    const fin = new Date(c.fecha_limite).getTime();
    if (isNaN(fin)) return null;
    const ahora = Date.now();
    const hoy = this.hoyISO();
    const diaFin = this.limiteLocal(c.fecha_limite).slice(0, 10);
    const dias = Math.round((new Date(diaFin + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / 86400000);
    if (ahora > fin) return { cls: 'vencida', txt: `Venció el ${this.limiteTexto(c.fecha_limite)}`, vencida: true, dias };
    if (dias <= 0) return { cls: 'pronto', txt: `Vence hoy a las ${this.limiteLocal(c.fecha_limite).slice(11, 16)} h`, dias: 0 };
    if (dias <= 2) return { cls: 'pronto', txt: `Vence en ${dias} día${dias > 1 ? 's' : ''} (${this.limiteTexto(c.fecha_limite)})`, dias };
    return { cls: 'normal', txt: `Entrega hasta el ${this.limiteTexto(c.fecha_limite)}`, dias };
  },

  /* ==========================================================================
     EDITOR (docente)
     El estado "ed" tiene las preguntas con su parte secreta en "_k". Al guardar,
     separar() lo divide en contenido (lo ve el alumno) y clave (solo docentes).
     ========================================================================== */
  ed: null,

  nuevo(kind) {
    const u = (p) => this.uid(p);
    switch (kind) {
      case 'opcion': return { id: u('p'), tipo: 'opcion', enunciado: '', puntos: 1, imagen: '', opciones: [{ id: u('o'), texto: '', ok: true }, { id: u('o'), texto: '', ok: false }, { id: u('o'), texto: '', ok: false }], _k: { explicacion: '' } };
      case 'vf': return { id: u('p'), tipo: 'vf', enunciado: '', puntos: 1, imagen: '', _k: { valor: true, explicacion: '' } };
      case 'numerica': return { id: u('p'), tipo: 'numerica', enunciado: '', puntos: 1, imagen: '', unidad: '', variables: [{ nombre: 'R', min: 10, max: 50, paso: 1 }], _k: { formula: '', tolerancia: 2, tolTipo: '%', explicacion: '' } };
      case 'ordenar': return { id: u('p'), tipo: 'ordenar', enunciado: '', puntos: 1, imagen: '', items: [{ id: u('i'), texto: '' }, { id: u('i'), texto: '' }, { id: u('i'), texto: '' }], _k: { explicacion: '' } };
      case 'relacionar': return { id: u('p'), tipo: 'relacionar', enunciado: '', puntos: 1, imagen: '', pares: [{ id: u('i'), did: u('d'), izq: '', der: '' }, { id: u('i'), did: u('d'), izq: '', der: '' }, { id: u('i'), did: u('d'), izq: '', der: '' }], distractores: [], _k: { explicacion: '' } };
      case 'completar': return { id: u('p'), tipo: 'completar', enunciado: 'Completá los espacios.', puntos: 1, imagen: '', texto: '', _k: { explicacion: '' } };
      case 'imagen': return { id: u('p'), tipo: 'imagen', enunciado: '', puntos: 1, imagen: '', modo: 'marcar', prop: 1, radio: 7, marcadores: [], distractores: [], _k: { zona: null, explicacion: '' } };
      case 'item_opcion': return { id: u('o'), texto: '', ok: false };
      case 'item_orden': return { id: u('i'), texto: '' };
      case 'par': return { id: u('i'), did: u('d'), izq: '', der: '' };
      case 'distractor': return { id: u('d'), texto: '' };
      case 'variable': return { nombre: '', min: 1, max: 10, paso: 1 };
      case 'criterio': return { id: u('c'), texto: '', peso: 1 };
      case 'consigna': return { id: u('p'), enunciado: '', max: 1000 };
      case 'item_presupuesto': return { id: u('i'), descripcion: '', unidad: 'u', precio: '' };
      case 'encuesta_escala': return { id: u('p'), tipo: 'escala', enunciado: '' };
      case 'encuesta_opcion': return { id: u('p'), tipo: 'opcion', enunciado: '', opcionesTxt: '' };
      case 'encuesta_texto': return { id: u('p'), tipo: 'texto', enunciado: '' };
      case 'nodo': return { id: u('n'), texto: '', imagen: '', opciones: [] };
      case 'opcion_nodo': return { id: u('o'), texto: '', destino: 'fin', _k: { valor: 100, devolucion: '' } };
      default: return {};
    }
  },

  // contenido + clave (como están guardados) → estado del editor
  unir(tipo, contenido, clave) {
    const c = this.copia(contenido) || {};
    const k = this.copia(clave) || {};
    const kp = k.preguntas || {};
    const ed = {
      tipo,
      opciones: Object.assign({ intentos: 1, mezclar: true, devolucion: 'detalle' }, c.opciones || {}),
      cotejo: c.cotejo || [],
      preguntas: [], consignas: [], encuesta: [], items: c.items || [], nodos: [],
      permitirFilas: c.permitirFilas !== false,
      anonima: !!c.anonima
    };
    if (tipo === 'cuestionario') {
      ed.preguntas = (c.preguntas || []).map(p => {
        const kk = kp[p.id] || {};
        const q = { ...p, _k: { explicacion: kk.explicacion || '' } };
        if (p.tipo === 'opcion') q.opciones = (p.opciones || []).map(o => ({ ...o, ok: (kk.correctas || []).includes(o.id) }));
        if (p.tipo === 'vf') q._k.valor = kk.valor !== false;
        if (p.tipo === 'numerica') Object.assign(q._k, { formula: kk.formula || '', tolerancia: kk.tolerancia ?? 2, tolTipo: kk.tolTipo || '%' });
        if (p.tipo === 'ordenar') {
          const orden = kk.orden || [];
          q.items = (p.items || []).slice().sort((a, b) => orden.indexOf(a.id) - orden.indexOf(b.id));
        }
        if (p.tipo === 'relacionar') {
          const pares = kk.pares || {};
          const der = {};
          (p.derecha || []).forEach(d => { der[d.id] = d.texto; });
          q.pares = (p.izquierda || []).map(i => ({ id: i.id, did: pares[i.id], izq: i.texto, der: der[pares[i.id]] || '' }));
          const usadas = new Set(Object.values(pares));
          q.distractores = (p.derecha || []).filter(d => !usadas.has(d.id)).map(d => ({ id: d.id, texto: d.texto }));
          delete q.izquierda; delete q.derecha;
        }
        if (p.tipo === 'completar') {
          const h = kk.huecos || {};
          q.texto = String(p.texto || '').replace(/\[\[(\d+)\]\]/g, (m, n) => `[${(h[n] || ['']).join('|')}]`);
        }
        if (p.tipo === 'imagen') {
          q.radio = p.radio || 7;
          if (p.modo === 'etiquetar') {
            const pares = kk.pares || {};
            const et = {};
            (p.etiquetas || []).forEach(e => { et[e.id] = e.texto; });
            q.marcadores = (p.marcadores || []).map(m => ({ ...m, eid: pares[m.id], texto: et[pares[m.id]] || '' }));
            const usadas = new Set(Object.values(pares));
            q.distractores = (p.etiquetas || []).filter(e => !usadas.has(e.id)).map(e => ({ id: e.id, texto: e.texto }));
            delete q.etiquetas;
          } else {
            q.marcadores = []; q.distractores = [];
            q._k.zona = kk.zona || null;
          }
        }
        return q;
      });
    }
    if (tipo === 'escrita') ed.consignas = c.preguntas || [];
    if (tipo === 'encuesta') ed.encuesta = (c.preguntas || []).map(p => ({ ...p, opcionesTxt: (p.opciones || []).join('; ') }));
    if (tipo === 'diagnostico') {
      const ko = k.opciones || {};
      ed.nodos = (c.nodos || []).map(n => ({ ...n, opciones: (n.opciones || []).map(o => ({ ...o, _k: { valor: (ko[o.id] || {}).valor ?? 0, devolucion: (ko[o.id] || {}).devolucion || '' } })) }));
    }
    return ed;
  },

  // estado del editor → { contenido, clave, calificable }
  separar(ed) {
    const mezclar = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    const t = ed.tipo;
    const contenido = {};
    const clave = {};
    if ((ed.cotejo || []).length && ['tp', 'practica', 'escrita', 'presupuesto', 'bitacora'].includes(t)) {
      contenido.cotejo = ed.cotejo.map(c => ({ id: c.id, texto: String(c.texto || '').trim(), peso: Number(c.peso) > 0 ? Number(c.peso) : 1 }));
    }
    if (t === 'cuestionario') {
      contenido.opciones = { intentos: Number(ed.opciones.intentos) || 0, mezclar: !!ed.opciones.mezclar, devolucion: ed.opciones.devolucion === 'nota' ? 'nota' : 'detalle' };
      contenido.preguntas = [];
      clave.preguntas = {};
      ed.preguntas.forEach(q => {
        const base = { id: q.id, tipo: q.tipo, enunciado: String(q.enunciado || '').trim(), puntos: Number(q.puntos) > 0 ? Number(q.puntos) : 1 };
        const img = this.urlImagen(q.imagen);
        if (img) base.imagen = img;
        const k = { explicacion: String((q._k && q._k.explicacion) || '').trim() };
        if (q.tipo === 'opcion') {
          base.opciones = q.opciones.map(o => ({ id: o.id, texto: String(o.texto || '').trim() }));
          k.correctas = q.opciones.filter(o => o.ok).map(o => o.id);
          base.multiple = k.correctas.length > 1;
        }
        if (q.tipo === 'vf') k.valor = q._k.valor !== false && q._k.valor !== 'false';
        if (q.tipo === 'numerica') {
          base.unidad = String(q.unidad || '').trim();
          base.variables = (q.variables || []).filter(v => v.nombre).map(v => ({ nombre: String(v.nombre).trim(), min: Number(v.min), max: Number(v.max), paso: Number(v.paso) > 0 ? Number(v.paso) : 1 }));
          Object.assign(k, { formula: String(q._k.formula || '').trim(), tolerancia: Math.abs(Number(q._k.tolerancia) || 0), tolTipo: q._k.tolTipo === 'abs' ? 'abs' : '%' });
        }
        if (q.tipo === 'ordenar') {
          const items = q.items.map(i => ({ id: i.id, texto: String(i.texto || '').trim() }));
          k.orden = items.map(i => i.id);
          base.items = mezclar(items);
        }
        if (q.tipo === 'relacionar') {
          base.izquierda = q.pares.map(p => ({ id: p.id, texto: String(p.izq || '').trim() }));
          const der = q.pares.map(p => ({ id: p.did || this.uid('d'), texto: String(p.der || '').trim() }));
          k.pares = {};
          q.pares.forEach((p, i) => { k.pares[p.id] = der[i].id; });
          base.derecha = mezclar(der.concat((q.distractores || []).filter(d => String(d.texto || '').trim()).map(d => ({ id: d.id, texto: String(d.texto).trim() }))));
        }
        if (q.tipo === 'completar') {
          let n = 0;
          k.huecos = {};
          base.texto = String(q.texto || '').replace(/\[([^\]]+)\]/g, (m, inner) => {
            n++;
            k.huecos[n] = inner.split('|').map(s => s.trim()).filter(Boolean);
            return `[[${n}]]`;
          });
        }
        if (q.tipo === 'imagen') {
          base.modo = q.modo === 'etiquetar' ? 'etiquetar' : 'marcar';
          base.prop = Number(q.prop) > 0 ? Math.round(Number(q.prop) * 1000) / 1000 : 1;
          if (base.modo === 'etiquetar') {
            base.marcadores = (q.marcadores || []).map(m => ({ id: m.id, x: m.x, y: m.y }));
            const et = (q.marcadores || []).map(m => ({ id: m.eid || this.uid('e'), texto: String(m.texto || '').trim() }));
            k.pares = {};
            (q.marcadores || []).forEach((m, i) => { k.pares[m.id] = et[i].id; });
            base.etiquetas = mezclar(et.concat((q.distractores || []).filter(d => String(d.texto || '').trim()).map(d => ({ id: d.id, texto: String(d.texto).trim() }))));
          } else {
            base.radio = Number(q.radio) || 7;
            k.zona = q._k.zona ? { x: q._k.zona.x, y: q._k.zona.y, r: Number(q.radio) || 7 } : null;
          }
        }
        contenido.preguntas.push(base);
        clave.preguntas[q.id] = k;
      });
    }
    if (t === 'diagnostico') {
      contenido.opciones = { intentos: Number(ed.opciones.intentos) || 0, devolucion: ed.opciones.devolucion === 'nota' ? 'nota' : 'detalle' };
      contenido.nodos = ed.nodos.map(n => {
        const nn = { id: n.id, texto: String(n.texto || '').trim(), opciones: (n.opciones || []).map(o => ({ id: o.id, texto: String(o.texto || '').trim(), destino: o.destino || 'fin' })) };
        const img = this.urlImagen(n.imagen);
        if (img) nn.imagen = img;
        return nn;
      });
      contenido.inicio = ed.nodos[0] ? ed.nodos[0].id : null;
      clave.opciones = {};
      ed.nodos.forEach(n => (n.opciones || []).forEach(o => { clave.opciones[o.id] = { valor: Number(o._k.valor) || 0, devolucion: String(o._k.devolucion || '').trim() }; }));
    }
    if (t === 'escrita') contenido.preguntas = ed.consignas.map(c => ({ id: c.id, enunciado: String(c.enunciado || '').trim(), max: Math.min(this.MAX_TEXTO, Math.max(50, Number(c.max) || 1000)) }));
    if (t === 'presupuesto') {
      contenido.items = ed.items.map(i => ({ id: i.id, descripcion: String(i.descripcion || '').trim(), unidad: String(i.unidad || '').trim(), precio: String(i.precio ?? '').trim() }));
      contenido.permitirFilas = !!ed.permitirFilas;
    }
    if (t === 'encuesta') {
      contenido.anonima = !!ed.anonima;
      contenido.preguntas = ed.encuesta.map(p => {
        const q = { id: p.id, tipo: p.tipo, enunciado: String(p.enunciado || '').trim() };
        if (p.tipo === 'opcion') q.opciones = String(p.opcionesTxt || '').split(';').map(s => s.trim()).filter(Boolean);
        return q;
      });
    }
    const calificable = !['material', 'encuesta'].includes(t) && !(t === 'bitacora' && ed.sinNota);
    if (t === 'bitacora' && ed.sinNota) contenido.sinNota = true;
    return { contenido: Object.keys(contenido).length ? contenido : null, clave: Object.keys(clave).length ? clave : null, calificable };
  },

  // Revisa que la actividad esté completa. Devuelve el primer problema o ''.
  validar(ed) {
    const t = ed.tipo;
    const nro = (i) => `Pregunta ${i + 1}`;
    if ((ed.cotejo || []).some(c => !String(c.texto || '').trim())) return 'Hay un criterio de la lista de cotejo sin texto.';
    if (t === 'cuestionario') {
      if (!ed.preguntas.length) return 'Agregá al menos una pregunta.';
      for (let i = 0; i < ed.preguntas.length; i++) {
        const q = ed.preguntas[i];
        if (q.tipo !== 'completar' && !String(q.enunciado || '').trim()) return `${nro(i)}: falta el enunciado.`;
        if (q.imagen && !this.urlImagen(q.imagen)) return `${nro(i)}: el link de la imagen tiene que empezar con https:// o ser una ruta img/…`;
        if (q.tipo === 'opcion') {
          const ops = q.opciones.filter(o => String(o.texto || '').trim());
          if (ops.length < 2 || ops.length !== q.opciones.length) return `${nro(i)}: completá todas las opciones (mínimo 2).`;
          if (!q.opciones.some(o => o.ok)) return `${nro(i)}: marcá cuál es la opción correcta.`;
        }
        if (q.tipo === 'numerica') {
          const vars = (q.variables || []).filter(v => String(v.nombre || '').trim());
          for (const v of vars) {
            if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(String(v.nombre).trim())) return `${nro(i)}: el nombre de variable "${v.nombre}" tiene que ser una letra o palabra sin espacios (ej.: R, V, I1).`;
            if (!(Number(v.max) >= Number(v.min))) return `${nro(i)}: en la variable ${v.nombre}, el máximo tiene que ser mayor o igual al mínimo.`;
          }
          if (!String(q._k.formula || '').trim()) return `${nro(i)}: falta la fórmula del resultado.`;
          try {
            const vals = {};
            vars.forEach(v => { vals[String(v.nombre).trim()] = Number(v.min); });
            Corrector.evaluar(q._k.formula, vals);
          } catch (e) { return `${nro(i)}: la fórmula tiene un error — ${e.message}.`; }
          const usadas = (String(q.enunciado).match(/\{([A-Za-z][A-Za-z0-9_]*)\}/g) || []).map(s => s.slice(1, -1));
          const faltan = usadas.filter(n => !vars.some(v => String(v.nombre).trim() === n));
          if (faltan.length) return `${nro(i)}: el enunciado usa {${faltan[0]}} pero esa variable no está definida.`;
        }
        if (q.tipo === 'ordenar' && (q.items.length < 2 || q.items.some(x => !String(x.texto || '').trim()))) return `${nro(i)}: completá todos los pasos (mínimo 2).`;
        if (q.tipo === 'relacionar' && (q.pares.length < 2 || q.pares.some(p => !String(p.izq || '').trim() || !String(p.der || '').trim()))) return `${nro(i)}: completá las dos columnas de cada par (mínimo 2 pares).`;
        if (q.tipo === 'completar' && !/\[[^\]]+\]/.test(q.texto || '')) return `${nro(i)}: marcá entre corchetes las palabras que el alumno tiene que completar, por ejemplo: La tensión es de [220] V.`;
        if (q.tipo === 'imagen') {
          if (!this.urlImagen(q.imagen)) return `${nro(i)}: falta el link de la imagen.`;
          if (q.modo === 'etiquetar') {
            if (!(q.marcadores || []).length) return `${nro(i)}: hacé clic en la imagen para poner al menos un número.`;
            if (q.marcadores.some(m => !String(m.texto || '').trim())) return `${nro(i)}: escribí el nombre correcto de cada número marcado.`;
          } else if (!q._k.zona) return `${nro(i)}: hacé clic en la imagen para marcar la zona correcta.`;
        }
      }
    }
    if (t === 'escrita' && (!ed.consignas.length || ed.consignas.some(c => !String(c.enunciado || '').trim()))) return 'Escribí al menos una consigna (y completá las que agregaste).';
    if (t === 'presupuesto' && !ed.items.length && !ed.permitirFilas) return 'Agregá materiales a la tabla o permití que el alumno agregue filas.';
    if (t === 'encuesta') {
      if (!ed.encuesta.length) return 'Agregá al menos una pregunta a la encuesta.';
      for (let i = 0; i < ed.encuesta.length; i++) {
        const p = ed.encuesta[i];
        if (!String(p.enunciado || '').trim()) return `${nro(i)} de la encuesta: falta el texto.`;
        if (p.tipo === 'opcion' && String(p.opcionesTxt || '').split(';').map(s => s.trim()).filter(Boolean).length < 2) return `${nro(i)} de la encuesta: escribí al menos dos opciones separadas por punto y coma.`;
      }
    }
    if (t === 'diagnostico') {
      if (!ed.nodos.length) return 'Agregá la situación inicial del caso.';
      if (!(ed.nodos[0].opciones || []).length) return 'La situación inicial necesita al menos una decisión.';
      const ids = new Set(ed.nodos.map(n => n.id));
      for (let i = 0; i < ed.nodos.length; i++) {
        const n = ed.nodos[i];
        if (!String(n.texto || '').trim()) return `Situación ${i + 1}: falta el texto.`;
        for (const o of n.opciones || []) {
          if (!String(o.texto || '').trim()) return `Situación ${i + 1}: hay una decisión sin texto.`;
          if (o.destino !== 'fin' && !ids.has(o.destino)) return `Situación ${i + 1}: una decisión lleva a una situación que ya no existe.`;
        }
      }
    }
    return '';
  },

  /* ---------- Dibujo del editor ---------- */
  iniciarEditor(tipo, clase, clave) {
    const cont = document.getElementById('act-editor');
    if (!cont) return;
    this.ed = this.unir(tipo, clase ? clase.contenido : null, clave);
    if (tipo === 'bitacora' && clase && clase.contenido && clase.contenido.sinNota) this.ed.sinNota = true;
    if (!clase) {
      if (tipo === 'cuestionario') this.ed.preguntas = [this.nuevo('opcion')];
      if (tipo === 'escrita') this.ed.consignas = [this.nuevo('consigna')];
      if (tipo === 'encuesta') this.ed.encuesta = [this.nuevo('encuesta_escala')];
      if (tipo === 'diagnostico') { const n = this.nuevo('nodo'); n.opciones = [this.nuevo('opcion_nodo'), this.nuevo('opcion_nodo')]; this.ed.nodos = [n]; }
      if (tipo === 'presupuesto') this.ed.items = [this.nuevo('item_presupuesto'), this.nuevo('item_presupuesto')];
      if (tipo === 'practica') this.ed.cotejo = [this.nuevo('criterio'), this.nuevo('criterio')];
    }
    if (!cont.dataset.listo) {
      cont.addEventListener('input', (e) => this.alEscribir(e));
      cont.addEventListener('change', (e) => this.alEscribir(e));
      cont.addEventListener('click', (e) => this.alClic(e));
      cont.dataset.listo = '1';
    }
    this.dibujarEditor();
  },

  alEscribir(e) {
    const el = e.target;
    if (!el.dataset || !el.dataset.f || !this.ed) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.t === 'num') v = el.value === '' ? '' : Number(el.value);
    this.set(this.ed, el.dataset.f, v);
    if ((el.dataset.redibujar || el.dataset.f.endsWith('.imagen')) && e.type === 'change') this.dibujarEditor();
    if (el.dataset.f.includes('_k.formula') || el.dataset.f.includes('.variables') || el.dataset.f.endsWith('.enunciado')) this.actualizarEjemplo(el);
  },
  alClic(e) {
    const b = e.target.closest('[data-a]');
    if (!b || !this.ed) return;
    const a = b.dataset.a, p = b.dataset.p, i = Number(b.dataset.i);
    if (a === 'add') {
      const lista = this.get(this.ed, p);
      if (Array.isArray(lista)) lista.push(this.nuevo(b.dataset.n));
    } else if (a === 'del') {
      const lista = this.get(this.ed, p);
      if (Array.isArray(lista)) {
        if (b.dataset.confirmar && !confirm(b.dataset.confirmar)) return;
        lista.splice(i, 1);
      }
    } else if (a === 'mover') {
      const lista = this.get(this.ed, p), j = i + Number(b.dataset.d);
      if (Array.isArray(lista) && j >= 0 && j < lista.length) [lista[i], lista[j]] = [lista[j], lista[i]];
    } else if (a === 'correcta') {
      const q = this.get(this.ed, p);
      const o = q.opciones[i];
      o.ok = !o.ok;
    } else if (a === 'banco-guardar') {
      this.guardarEnBanco(this.ed.preguntas[i]);
      return;
    } else if (a === 'banco-abrir') {
      this.abrirBanco();
      return;
    } else if (a === 'img') {
      this.clicImagenEditor(e, b);
    } else if (a === 'marcador-del') {
      const q = this.get(this.ed, p);
      q.marcadores.splice(i, 1);
    } else return;
    this.dibujarEditor();
  },

  clicImagenEditor(e, wrap) {
    const img = wrap.querySelector('img');
    if (!img || e.target.closest('.act-marca')) return;
    const r = img.getBoundingClientRect();
    if (!r.width) return;
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    const q = this.get(this.ed, wrap.dataset.p);
    q.prop = img.naturalWidth ? img.naturalHeight / img.naturalWidth : (r.height / r.width);
    if (q.modo === 'etiquetar') q.marcadores.push({ id: this.uid('m'), x, y, texto: '', eid: this.uid('e') });
    else q._k.zona = { x, y, r: Number(q.radio) || 7 };
  },

  // Ejemplo de valores y resultado para un alumno cualquiera (cálculo numérico)
  actualizarEjemplo(el) {
    const caja = el.closest('.act-preg');
    if (!caja) return;
    const idx = Number(caja.dataset.i);
    const q = this.ed.preguntas && this.ed.preguntas[idx];
    const sal = caja.querySelector('.act-ejemplo');
    if (!q || q.tipo !== 'numerica' || !sal) return;
    sal.innerHTML = this.textoEjemplo(q);
  },
  textoEjemplo(q) {
    try {
      const p = { id: q.id, variables: (q.variables || []).filter(v => v.nombre).map(v => ({ ...v, nombre: String(v.nombre).trim() })) };
      const vals = Corrector.valoresVariables(p, 'ejemplo:' + Math.floor(Date.now() / 60000));
      const res = String(q._k.formula || '').trim() ? Corrector.evaluar(q._k.formula, vals) : null;
      const valsTxt = Object.keys(vals).map(k => `${k} = ${Corrector.mostrarNumero(vals[k])}`).join(' · ');
      return `<strong>Ejemplo para un alumno:</strong> ${this.esc(Corrector.sustituir(q.enunciado, vals))}<br>${this.esc(valsTxt)}${res !== null ? ` → <strong>respuesta correcta: ${this.esc(Corrector.mostrarNumero(Math.round(res * 1000) / 1000))} ${this.esc(q.unidad || '')}</strong>` : ''}`;
    } catch (e) {
      return `<span class="act-error">⚠️ ${this.esc(e.message)}</span>`;
    }
  },

  // Campo de texto ligado al estado
  campo(path, valor, ph = '', extra = '') {
    return `<input class="act-in" data-f="${path}" value="${this.esc(valor ?? '')}" placeholder="${this.esc(ph)}" ${extra}>`;
  },
  area(path, valor, ph = '', filas = 2, extra = '') {
    return `<textarea class="act-in" rows="${filas}" data-f="${path}" placeholder="${this.esc(ph)}" ${extra}>${this.esc(valor ?? '')}</textarea>`;
  },
  numero(path, valor, extra = '') {
    return `<input class="act-in act-num" type="number" step="any" data-f="${path}" data-t="num" value="${this.esc(valor ?? '')}" ${extra}>`;
  },
  btn(a, txt, attrs = '', cls = 'act-mini') {
    return `<button type="button" class="${cls}" data-a="${a}" ${attrs}>${txt}</button>`;
  },
  barraOrden(p, i, n, confirmar = '') {
    return `<span class="act-orden">
      ${this.btn('mover', '↑', `data-p="${p}" data-i="${i}" data-d="-1" title="Subir" ${i === 0 ? 'disabled' : ''}`)}
      ${this.btn('mover', '↓', `data-p="${p}" data-i="${i}" data-d="1" title="Bajar" ${i === n - 1 ? 'disabled' : ''}`)}
      ${this.btn('del', '✕', `data-p="${p}" data-i="${i}" title="Quitar" ${confirmar ? `data-confirmar="${this.esc(confirmar)}"` : ''}`, 'act-mini act-quitar')}
    </span>`;
  },

  dibujarEditor() {
    const cont = document.getElementById('act-editor');
    if (!cont || !this.ed) return;
    const t = this.ed.tipo;
    let h = '';
    if (t === 'cuestionario') h += this.edOpciones(true) + this.edPreguntas();
    if (t === 'diagnostico') h += this.edOpciones(false) + this.edDiagnostico();
    if (t === 'escrita') h += this.edConsignas();
    if (t === 'presupuesto') h += this.edPresupuesto();
    if (t === 'bitacora') h += `<div class="act-caja"><label class="act-check"><input type="checkbox" data-f="sinNota" data-redibujar="1" ${this.ed.sinNota ? 'checked' : ''}> Sin nota (solo registro: no cuenta para el promedio del módulo)</label>
      <p class="act-ayuda">Cada alumno agrega entradas con la fecha, lo que hizo y, si quiere, un link a fotos (Google Fotos o Drive). No se suben archivos a la plataforma.</p></div>`;
    if (t === 'encuesta') h += this.edEncuesta();
    if (['tp', 'practica', 'escrita', 'presupuesto'].includes(t) || (t === 'bitacora' && !this.ed.sinNota)) h += this.edCotejo();
    cont.innerHTML = h;
    cont.querySelectorAll('.act-ejemplo').forEach(el => { const q = this.ed.preguntas[Number(el.closest('.act-preg').dataset.i)]; if (q) el.innerHTML = this.textoEjemplo(q); });
  },

  edOpciones(esCuestionario) {
    const o = this.ed.opciones;
    return `<div class="act-caja act-opciones">
      <h5>Opciones</h5>
      <div class="act-fila">
        <label>Intentos permitidos
          <select class="act-in" data-f="opciones.intentos" data-t="num">
            ${[[1, '1 intento'], [2, '2 intentos'], [3, '3 intentos'], [0, 'Sin límite']].map(([v, tx]) => `<option value="${v}" ${Number(o.intentos) === v ? 'selected' : ''}>${tx}</option>`).join('')}
          </select>
        </label>
        <label>Al terminar, el alumno ve
          <select class="act-in" data-f="opciones.devolucion">
            <option value="detalle" ${o.devolucion !== 'nota' ? 'selected' : ''}>La nota y qué respondió bien o mal, con la explicación</option>
            <option value="nota" ${o.devolucion === 'nota' ? 'selected' : ''}>Solo la nota</option>
          </select>
        </label>
        ${esCuestionario ? `<label class="act-check"><input type="checkbox" data-f="opciones.mezclar" ${o.mezclar ? 'checked' : ''}> Mezclar el orden de las preguntas y opciones para cada alumno</label>` : ''}
      </div>
      <p class="act-ayuda">Si hay más de un intento, queda la mejor nota. Solo se guarda el detalle del mejor intento (de los otros, solo la nota).</p>
    </div>`;
  },

  edPreguntas() {
    const qs = this.ed.preguntas;
    let h = `<div class="act-caja"><div class="act-cab"><h5>Preguntas (${qs.length})</h5>${this.btn('banco-abrir', '📚 Agregar desde el banco', '', 'act-btn-sec')}</div>`;
    qs.forEach((q, i) => {
      const p = `preguntas.${i}`;
      const T = this.PREGUNTAS[q.tipo] || {};
      h += `<div class="act-preg" data-i="${i}">
        <div class="act-preg-cab"><strong>${i + 1}. ${T.ico || ''} ${this.esc(T.nombre || q.tipo)}</strong>
          <span class="act-preg-pts">Puntos ${this.numero(`${p}.puntos`, q.puntos, 'min="0.5" max="100" title="Peso de la pregunta en la nota"')}</span>
          ${this.btn('banco-guardar', '⭐ Guardar en el banco', `data-i="${i}" title="Guardar esta pregunta para usarla en otros cuestionarios"`)}
          ${this.barraOrden('preguntas', i, qs.length, '¿Quitar esta pregunta?')}
        </div>
        ${q.tipo !== 'completar' ? this.area(`${p}.enunciado`, q.enunciado, q.tipo === 'numerica' ? 'Ej.: Una resistencia de {R} Ω se conecta a {V} V. ¿Qué corriente circula?' : 'Enunciado de la pregunta', 2) : ''}
        ${this.edPreguntaTipo(q, p)}
        <details class="act-mas" ${q.imagen || q._k.explicacion ? 'open' : ''}><summary>Imagen y explicación (opcional)</summary>
          ${q.tipo !== 'imagen' ? `<label>Imagen de apoyo ${this.campo(`${p}.imagen`, q.imagen, 'https://… o img/actividades/foto.jpg')}</label>` : ''}
          <label>Explicación que ve el alumno después de responder ${this.area(`${p}._k.explicacion`, q._k.explicacion, 'Por qué esa es la respuesta correcta', 2)}</label>
        </details>
      </div>`;
    });
    h += `<div class="act-agregar"><span>Agregar pregunta:</span>${Object.entries(this.PREGUNTAS).map(([k, v]) => this.btn('add', `${v.ico} ${v.nombre}`, `data-p="preguntas" data-n="${k}"`, 'act-btn-sec')).join('')}</div></div>`;
    return h;
  },

  edPreguntaTipo(q, p) {
    if (q.tipo === 'opcion') {
      return `<div class="act-lista">${q.opciones.map((o, j) => `<div class="act-fila-op">
          <button type="button" class="act-ok ${o.ok ? 'si' : ''}" data-a="correcta" data-p="${p}" data-i="${j}" title="Marcar como correcta">${o.ok ? '✔ Correcta' : 'Incorrecta'}</button>
          ${this.campo(`${p}.opciones.${j}.texto`, o.texto, `Opción ${j + 1}`)}
          ${this.barraOrden(`${p}.opciones`, j, q.opciones.length)}
        </div>`).join('')}
        ${this.btn('add', '+ Opción', `data-p="${p}.opciones" data-n="item_opcion"`)}
        <p class="act-ayuda">Podés marcar más de una correcta: el alumno tendrá que elegir todas (puntaje parcial; las elegidas por error restan).</p></div>`;
    }
    if (q.tipo === 'vf') {
      return `<label class="act-fila">La afirmación es
        <select class="act-in" data-f="${p}._k.valor"><option value="true" ${q._k.valor !== false && q._k.valor !== 'false' ? 'selected' : ''}>Verdadera</option><option value="false" ${q._k.valor === false || q._k.valor === 'false' ? 'selected' : ''}>Falsa</option></select></label>`;
    }
    if (q.tipo === 'numerica') {
      return `<div class="act-sub">
        <p class="act-ayuda">Escribí las variables entre llaves en el enunciado, por ejemplo <code>{R}</code>. Cada alumno recibe valores distintos dentro del rango, y la plataforma calcula su resultado con la fórmula.</p>
        <table class="act-tabla"><thead><tr><th>Variable</th><th>Mínimo</th><th>Máximo</th><th>De a (paso)</th><th></th></tr></thead><tbody>
        ${(q.variables || []).map((v, j) => `<tr><td>${this.campo(`${p}.variables.${j}.nombre`, v.nombre, 'R', 'maxlength="12"')}</td><td>${this.numero(`${p}.variables.${j}.min`, v.min)}</td><td>${this.numero(`${p}.variables.${j}.max`, v.max)}</td><td>${this.numero(`${p}.variables.${j}.paso`, v.paso)}</td><td>${this.btn('del', '✕', `data-p="${p}.variables" data-i="${j}"`, 'act-mini act-quitar')}</td></tr>`).join('')}
        </tbody></table>
        ${this.btn('add', '+ Variable', `data-p="${p}.variables" data-n="variable"`)}
        <div class="act-fila">
          <label class="act-crece">Fórmula del resultado ${this.campo(`${p}._k.formula`, q._k.formula, 'Ej.: V / R    ·    raiz(3) * U * I * 0,85')}</label>
          <label>Unidad ${this.campo(`${p}.unidad`, q.unidad, 'A', 'maxlength="12" style="width:5rem"')}</label>
          <label>Tolerancia ${this.numero(`${p}._k.tolerancia`, q._k.tolerancia, 'min="0" style="width:5rem"')}</label>
          <label>&nbsp;<select class="act-in" data-f="${p}._k.tolTipo"><option value="%" ${q._k.tolTipo !== 'abs' ? 'selected' : ''}>% del resultado</option><option value="abs" ${q._k.tolTipo === 'abs' ? 'selected' : ''}>en unidades</option></select></label>
        </div>
        <p class="act-ayuda">Operaciones: + − * / ^ y paréntesis. Funciones: raiz( ), abs( ), redondear(x; decimales), sen( ), cos( ), tan( ) en grados, log( ), ln( ), pi.</p>
        <div class="act-ejemplo"></div>
      </div>`;
    }
    if (q.tipo === 'ordenar') {
      return `<div class="act-lista"><p class="act-ayuda">Escribí los pasos <strong>en el orden correcto</strong>. Al alumno le aparecen mezclados.</p>
        ${q.items.map((it, j) => `<div class="act-fila-op"><span class="act-nro">${j + 1}</span>${this.campo(`${p}.items.${j}.texto`, it.texto, `Paso ${j + 1}`)}${this.barraOrden(`${p}.items`, j, q.items.length)}</div>`).join('')}
        ${this.btn('add', '+ Paso', `data-p="${p}.items" data-n="item_orden"`)}</div>`;
    }
    if (q.tipo === 'relacionar') {
      return `<div class="act-lista"><p class="act-ayuda">Cada fila es un par correcto. Al alumno le aparece la columna derecha mezclada.</p>
        ${q.pares.map((pa, j) => `<div class="act-fila-op">${this.campo(`${p}.pares.${j}.izq`, pa.izq, 'Ej.: Disyuntor diferencial')}<span class="act-flecha">↔</span>${this.campo(`${p}.pares.${j}.der`, pa.der, 'Ej.: Protege a las personas')}${this.btn('del', '✕', `data-p="${p}.pares" data-i="${j}"`, 'act-mini act-quitar')}</div>`).join('')}
        ${this.btn('add', '+ Par', `data-p="${p}.pares" data-n="par"`)}
        <p class="act-ayuda" style="margin-top:.6rem">Opciones de más en la columna derecha (distractores, opcional):</p>
        ${(q.distractores || []).map((d, j) => `<div class="act-fila-op">${this.campo(`${p}.distractores.${j}.texto`, d.texto, 'Opción que no corresponde a ninguna')}${this.btn('del', '✕', `data-p="${p}.distractores" data-i="${j}"`, 'act-mini act-quitar')}</div>`).join('')}
        ${this.btn('add', '+ Distractor', `data-p="${p}.distractores" data-n="distractor"`)}</div>`;
    }
    if (q.tipo === 'completar') {
      return `<label>Consigna ${this.campo(`${p}.enunciado`, q.enunciado, 'Completá los espacios.')}</label>
        <label>Texto ${this.area(`${p}.texto`, q.texto, 'Ej.: En una instalación monofásica la tensión es de [220|220 V] V y el conductor de protección es de color [verde y amarillo|verde amarillo].', 3)}</label>
        <p class="act-ayuda">Poné entre corchetes lo que el alumno tiene que escribir. Si aceptás varias respuestas, separalas con <code>|</code>. No importan mayúsculas ni tildes; en números, da lo mismo coma o punto.</p>`;
    }
    if (q.tipo === 'imagen') {
      const img = this.urlImagen(q.imagen);
      let marcas = '';
      if (img && q.modo === 'etiquetar') marcas = (q.marcadores || []).map((m, j) => `<span class="act-marca" style="left:${m.x}%;top:${m.y}%">${j + 1}</span>`).join('');
      if (img && q.modo !== 'etiquetar' && q._k.zona) marcas = `<span class="act-zona" style="left:${q._k.zona.x}%;top:${q._k.zona.y}%;width:${2 * (Number(q.radio) || 7)}%"></span>`;
      return `<div class="act-sub">
        <label>Link de la imagen ${this.campo(`${p}.imagen`, q.imagen, 'img/actividades/tablero.jpg  ·  https://…')}</label>
        <p class="act-ayuda">Subí la foto a la carpeta <code>img/actividades</code> del repositorio de GitHub y escribí la ruta (o pegá un link https a una imagen). Así no ocupa espacio en la base de datos.</p>
        <div class="act-fila">
          <label>Modo <select class="act-in" data-f="${p}.modo" data-redibujar="1">
            <option value="marcar" ${q.modo !== 'etiquetar' ? 'selected' : ''}>El alumno marca un lugar (ej.: “Señalá el disyuntor”)</option>
            <option value="etiquetar" ${q.modo === 'etiquetar' ? 'selected' : ''}>El alumno nombra partes numeradas</option>
          </select></label>
          ${q.modo !== 'etiquetar' ? `<label>Tamaño de la zona <select class="act-in" data-f="${p}.radio" data-t="num" data-redibujar="1">${[[4, 'Chica'], [7, 'Mediana'], [11, 'Grande']].map(([v, tx]) => `<option value="${v}" ${Number(q.radio) === v ? 'selected' : ''}>${tx}</option>`).join('')}</select></label>` : ''}
        </div>
        ${img ? `<p class="act-ayuda"><strong>${q.modo === 'etiquetar' ? 'Hacé clic en la imagen para poner cada número.' : 'Hacé clic en la imagen donde está la respuesta correcta.'}</strong></p>
          <div class="act-img-wrap" data-a="img" data-p="${p}"><img src="${this.esc(img)}" alt="Imagen de la pregunta" draggable="false">${marcas}</div>` : '<p class="act-ayuda">Cuando cargues el link, aparece la imagen acá.</p>'}
        ${q.modo === 'etiquetar' ? `<div class="act-lista">
          ${(q.marcadores || []).map((m, j) => `<div class="act-fila-op"><span class="act-nro">${j + 1}</span>${this.campo(`${p}.marcadores.${j}.texto`, m.texto, 'Nombre correcto de esta parte')}${this.btn('marcador-del', '✕', `data-p="${p}" data-i="${j}"`, 'act-mini act-quitar')}</div>`).join('')}
          <p class="act-ayuda">Nombres de más para confundir (opcional):</p>
          ${(q.distractores || []).map((d, j) => `<div class="act-fila-op">${this.campo(`${p}.distractores.${j}.texto`, d.texto, 'Nombre que no corresponde')}${this.btn('del', '✕', `data-p="${p}.distractores" data-i="${j}"`, 'act-mini act-quitar')}</div>`).join('')}
          ${this.btn('add', '+ Distractor', `data-p="${p}.distractores" data-n="distractor"`)}</div>` : ''}
      </div>`;
    }
    return '';
  },

  edCotejo() {
    const cs = this.ed.cotejo || [];
    const t = this.ed.tipo;
    return `<div class="act-caja">
      <div class="act-cab"><h5>Lista de cotejo ${t === 'practica' ? '' : '(opcional)'}</h5></div>
      <p class="act-ayuda">${t === 'practica'
        ? 'En el taller marcás cada criterio como Logrado, Parcial o No logrado y la nota se calcula sola. Queda registrado por qué tiene esa nota.'
        : 'Si cargás criterios, al corregir los marcás como Logrado, Parcial o No logrado y la nota se calcula sola. Si no, ponés la nota directamente.'}</p>
      ${cs.map((c, j) => `<div class="act-fila-op"><span class="act-nro">${j + 1}</span>${this.campo(`cotejo.${j}.texto`, c.texto, 'Ej.: Respeta las normas de seguridad · Conexiones firmes y prolijas')}
        <label class="act-peso" title="Un criterio con peso 2 vale el doble">Peso ${this.numero(`cotejo.${j}.peso`, c.peso, 'min="1" max="10" style="width:4rem"')}</label>
        ${this.barraOrden('cotejo', j, cs.length)}</div>`).join('')}
      ${this.btn('add', '+ Criterio', 'data-p="cotejo" data-n="criterio"')}
    </div>`;
  },

  edConsignas() {
    const cs = this.ed.consignas;
    return `<div class="act-caja"><h5>Consignas</h5>
      ${cs.map((c, j) => `<div class="act-preg"><div class="act-preg-cab"><strong>${j + 1}.</strong>
          <label class="act-peso">Máximo de caracteres ${this.numero(`consignas.${j}.max`, c.max, `min="50" max="${this.MAX_TEXTO}" style="width:6rem"`)}</label>
          ${this.barraOrden('consignas', j, cs.length)}</div>
        ${this.area(`consignas.${j}.enunciado`, c.enunciado, 'Ej.: Explicá con tus palabras por qué se usa un disyuntor diferencial en una vivienda.', 2)}</div>`).join('')}
      ${this.btn('add', '+ Consigna', 'data-p="consignas" data-n="consigna"')}
      <p class="act-ayuda">Hasta ${this.MAX_TEXTO} caracteres por respuesta (para cuidar el espacio de la base de datos).</p></div>`;
  },

  edPresupuesto() {
    const its = this.ed.items;
    return `<div class="act-caja"><h5>Materiales</h5>
      <p class="act-ayuda">El alumno completa las cantidades y los precios; los subtotales y el total se calculan solos. Si ponés un precio, el alumno no lo puede cambiar.</p>
      <table class="act-tabla"><thead><tr><th>Descripción</th><th>Unidad</th><th>Precio fijo (opcional)</th><th></th></tr></thead><tbody>
      ${its.map((it, j) => `<tr><td>${this.campo(`items.${j}.descripcion`, it.descripcion, 'Ej.: Cable unipolar 2,5 mm²')}</td><td>${this.campo(`items.${j}.unidad`, it.unidad, 'm', 'style="width:5rem"')}</td><td>${this.campo(`items.${j}.precio`, it.precio, '', 'style="width:8rem" inputmode="decimal"')}</td><td>${this.barraOrden('items', j, its.length)}</td></tr>`).join('')}
      </tbody></table>
      ${this.btn('add', '+ Material', 'data-p="items" data-n="item_presupuesto"')}
      <label class="act-check"><input type="checkbox" data-f="permitirFilas" ${this.ed.permitirFilas ? 'checked' : ''}> El alumno puede agregar materiales que no están en la lista</label></div>`;
  },

  edEncuesta() {
    const ps = this.ed.encuesta;
    return `<div class="act-caja"><h5>Preguntas de la encuesta</h5>
      ${ps.map((q, j) => `<div class="act-preg"><div class="act-preg-cab"><strong>${j + 1}. ${q.tipo === 'escala' ? 'Escala del 1 al 5' : q.tipo === 'opcion' ? 'Opciones' : 'Respuesta libre'}</strong>${this.barraOrden('encuesta', j, ps.length)}</div>
        ${this.campo(`encuesta.${j}.enunciado`, q.enunciado, q.tipo === 'escala' ? 'Ej.: ¿Qué tan seguro/a te sentís armando un tablero?' : 'Pregunta')}
        ${q.tipo === 'opcion' ? `<label>Opciones (separadas por punto y coma) ${this.campo(`encuesta.${j}.opcionesTxt`, q.opcionesTxt, 'Ej.: Muy útil; Útil; Poco útil')}</label>` : ''}</div>`).join('')}
      <div class="act-agregar"><span>Agregar:</span>
        ${this.btn('add', '1 a 5', 'data-p="encuesta" data-n="encuesta_escala"', 'act-btn-sec')}
        ${this.btn('add', 'Opciones', 'data-p="encuesta" data-n="encuesta_opcion"', 'act-btn-sec')}
        ${this.btn('add', 'Respuesta libre', 'data-p="encuesta" data-n="encuesta_texto"', 'act-btn-sec')}</div>
      <label class="act-check"><input type="checkbox" data-f="anonima" ${this.ed.anonima ? 'checked' : ''}> Mostrar los resultados sin nombres</label></div>`;
  },

  edDiagnostico() {
    const ns = this.ed.nodos;
    const destinos = (actual) => `<option value="fin">🏁 Termina el caso</option>` + ns.map((n, i) => n.id === actual ? '' : `<option value="${n.id}">→ Situación ${i + 1}${n.texto ? ': ' + this.esc(String(n.texto).slice(0, 40)) : ''}</option>`).join('');
    let h = `<div class="act-caja"><h5>Situaciones del caso</h5>
      <p class="act-ayuda">La situación 1 es el problema inicial (ej.: “Salta el disyuntor cuando se enciende el lavarropas”). Cada decisión lleva a otra situación o termina el caso. La nota es el promedio de las decisiones que tomó el alumno (Correcta 100 · Aceptable 50 · Incorrecta 0).</p>`;
    ns.forEach((n, i) => {
      const p = `nodos.${i}`;
      h += `<div class="act-preg act-nodo"><div class="act-preg-cab"><strong>Situación ${i + 1}${i === 0 ? ' (inicio)' : ''}</strong>${i > 0 ? this.btn('del', 'Quitar', `data-p="nodos" data-i="${i}" data-confirmar="¿Quitar esta situación?"`, 'act-mini act-quitar') : ''}</div>
        ${this.area(`${p}.texto`, n.texto, i === 0 ? 'Describí la falla o el problema' : 'Qué pasa después de esa decisión', 2)}
        <label>Imagen (opcional) ${this.campo(`${p}.imagen`, n.imagen, 'img/actividades/… o https://…')}</label>
        <div class="act-lista">${(n.opciones || []).map((o, j) => `<div class="act-dec">
            ${this.campo(`${p}.opciones.${j}.texto`, o.texto, `Decisión ${j + 1}: ej. Medir aislación con el megóhmetro`)}
            <select class="act-in" data-f="${p}.opciones.${j}.destino">${destinos(n.id).replace(`value="${o.destino}"`, `value="${o.destino}" selected`)}</select>
            <select class="act-in" data-f="${p}.opciones.${j}._k.valor" data-t="num">${[[100, '✔ Correcta'], [50, '◐ Aceptable'], [0, '✕ Incorrecta']].map(([v, tx]) => `<option value="${v}" ${Number(o._k.valor) === v ? 'selected' : ''}>${tx}</option>`).join('')}</select>
            ${this.campo(`${p}.opciones.${j}._k.devolucion`, o._k.devolucion, 'Devolución al alumno (por qué)')}
            ${this.btn('del', '✕', `data-p="${p}.opciones" data-i="${j}"`, 'act-mini act-quitar')}
          </div>`).join('')}
          ${this.btn('add', '+ Decisión', `data-p="${p}.opciones" data-n="opcion_nodo"`)}
          ${!(n.opciones || []).length ? '<p class="act-ayuda">Sin decisiones: esta situación es un final del caso.</p>' : ''}
        </div></div>`;
    });
    h += `${this.btn('add', '+ Situación', 'data-p="nodos" data-n="nodo"', 'act-btn-sec')}</div>`;
    return h;
  }
};
window.Actividades = Actividades;

/* ==========================================================================
   VENTANA, FORMULARIOS DEL ALUMNO Y RESULTADOS
   ========================================================================== */
Object.assign(Actividades, {
  modal(titulo, cuerpo, pie = '', ancho = 860) {
    let m = document.getElementById('modal-actividad');
    if (!m) {
      m = document.createElement('div');
      m.id = 'modal-actividad';
      m.className = 'act-overlay';
      document.body.appendChild(m);
      m.addEventListener('click', (e) => { if (e.target === m) this.cerrarModal(); });
    }
    m.innerHTML = `<div class="act-ventana" role="dialog" aria-modal="true" style="max-width:${ancho}px">
        <div class="act-ventana-cab"><h4>${titulo}</h4><button type="button" class="act-cerrar" aria-label="Cerrar" onclick="Actividades.cerrarModal()">×</button></div>
        <div class="act-ventana-cuerpo">${cuerpo}</div>
        ${pie ? `<div class="act-ventana-pie">${pie}</div>` : ''}
      </div>`;
    m.style.display = 'flex';
    return m;
  },
  cerrarModal() {
    const m = document.getElementById('modal-actividad');
    if (m) { m.style.display = 'none'; m.innerHTML = ''; }
  },
  cuerpoModal() { return document.querySelector('#modal-actividad .act-ventana-cuerpo'); },

  /* ---------- Preguntas para responder ---------- */
  textoConSaltos(t) { return this.esc(t).replace(/\n/g, '<br>'); },

  preguntasOrdenadas(contenido, semilla) {
    const ps = (contenido && contenido.preguntas) || [];
    const op = (contenido && contenido.opciones) || {};
    return op.mezclar ? Corrector.mezclar(ps, semilla + ':orden') : ps;
  },

  preguntaHTML(p, n, semilla, mezclar) {
    const nom = `r-${p.id}`;
    const vals = p.tipo === 'numerica' ? Corrector.valoresVariables(p, semilla) : {};
    const enun = p.tipo === 'numerica' ? Corrector.sustituir(p.enunciado, vals) : p.enunciado;
    const img = p.imagen && p.tipo !== 'imagen' ? `<img class="act-img-apoyo" src="${this.esc(p.imagen)}" alt="Imagen de apoyo" loading="lazy">` : '';
    let cuerpo = '';
    if (p.tipo === 'opcion') {
      const ops = mezclar ? Corrector.mezclar(p.opciones || [], semilla + ':' + p.id) : (p.opciones || []);
      cuerpo = `${p.multiple ? '<p class="act-ayuda">Marcá todas las correctas.</p>' : ''}<div class="act-ops">` + ops.map(o => `<label class="act-op"><input type="${p.multiple ? 'checkbox' : 'radio'}" name="${nom}" value="${this.esc(o.id)}"> <span>${this.esc(o.texto)}</span></label>`).join('') + '</div>';
    } else if (p.tipo === 'vf') {
      cuerpo = `<div class="act-ops act-ops-fila"><label class="act-op"><input type="radio" name="${nom}" value="true"> <span>Verdadero</span></label><label class="act-op"><input type="radio" name="${nom}" value="false"> <span>Falso</span></label></div>`;
    } else if (p.tipo === 'numerica') {
      cuerpo = `<div class="act-num-resp"><input class="act-in" name="${nom}" inputmode="decimal" autocomplete="off" placeholder="Tu resultado"> <span>${this.esc(p.unidad || '')}</span></div><p class="act-ayuda">Podés usar coma o punto para los decimales.</p>`;
    } else if (p.tipo === 'ordenar') {
      const its = Corrector.mezclar(p.items || [], semilla + ':' + p.id);
      cuerpo = `<p class="act-ayuda">Usá las flechas para dejar los pasos en orden.</p><ol class="act-ordenar" data-q="${this.esc(p.id)}">` + its.map(it => `<li data-id="${this.esc(it.id)}"><span>${this.esc(it.texto)}</span><span class="act-orden"><button type="button" class="act-mini" data-ord="-1" aria-label="Subir">↑</button><button type="button" class="act-mini" data-ord="1" aria-label="Bajar">↓</button></span></li>`).join('') + '</ol>';
    } else if (p.tipo === 'relacionar') {
      const der = Corrector.mezclar(p.derecha || [], semilla + ':' + p.id);
      cuerpo = '<div class="act-rel">' + (p.izquierda || []).map(i => `<div class="act-rel-fila"><span>${this.esc(i.texto)}</span><select class="act-in" name="${nom}" data-izq="${this.esc(i.id)}"><option value="">— Elegí —</option>${der.map(d => `<option value="${this.esc(d.id)}">${this.esc(d.texto)}</option>`).join('')}</select></div>`).join('') + '</div>';
    } else if (p.tipo === 'completar') {
      cuerpo = `<div class="act-completar">${this.esc(p.texto || '').replace(/\[\[(\d+)\]\]/g, (m, k) => `<input class="act-in act-hueco" name="${nom}" data-n="${k}" autocomplete="off" aria-label="Espacio ${k}">`).replace(/\n/g, '<br>')}</div>`;
    } else if (p.tipo === 'imagen') {
      if (p.modo === 'etiquetar') {
        const ets = Corrector.mezclar(p.etiquetas || [], semilla + ':' + p.id);
        cuerpo = `<div class="act-img-wrap"><img src="${this.esc(p.imagen)}" alt="Imagen de la pregunta">${(p.marcadores || []).map((m, j) => `<span class="act-marca" style="left:${Number(m.x)}%;top:${Number(m.y)}%">${j + 1}</span>`).join('')}</div>
          <div class="act-rel">${(p.marcadores || []).map((m, j) => `<div class="act-rel-fila"><span class="act-nro">${j + 1}</span><select class="act-in" name="${nom}" data-izq="${this.esc(m.id)}"><option value="">— Elegí —</option>${ets.map(e => `<option value="${this.esc(e.id)}">${this.esc(e.texto)}</option>`).join('')}</select></div>`).join('')}</div>`;
      } else {
        cuerpo = `<p class="act-ayuda">Tocá la imagen en el lugar que corresponde.</p><div class="act-img-wrap act-img-marcar" data-q="${this.esc(p.id)}"><img src="${this.esc(p.imagen)}" alt="Imagen de la pregunta" draggable="false"></div>`;
      }
    }
    return `<div class="act-resp-preg" data-q="${this.esc(p.id)}"><div class="act-resp-enun"><span class="act-resp-n">${n}</span><div>${this.textoConSaltos(enun)}${Number(p.puntos) > 1 ? ` <span class="act-pts">(${p.puntos} puntos)</span>` : ''}</div></div>${img}${cuerpo}</div>`;
  },

  // Interacciones de los formularios: ordenar con flechas y marcar en imagen
  activarFormulario(root) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ord]');
      if (b) {
        const li = b.closest('li');
        const d = Number(b.dataset.ord);
        if (d < 0 && li.previousElementSibling) li.parentNode.insertBefore(li, li.previousElementSibling);
        if (d > 0 && li.nextElementSibling) li.parentNode.insertBefore(li.nextElementSibling, li);
        return;
      }
      const w = e.target.closest('.act-img-marcar');
      if (w && !w.classList.contains('solo-lectura')) {
        const img = w.querySelector('img');
        const r = img.getBoundingClientRect();
        if (!r.width) return;
        const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
        const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
        if (x < 0 || y < 0 || x > 100 || y > 100) return;
        w.dataset.x = x; w.dataset.y = y;
        let pin = w.querySelector('.act-pin');
        if (!pin) { pin = document.createElement('span'); pin.className = 'act-pin'; w.appendChild(pin); }
        pin.style.left = x + '%'; pin.style.top = y + '%';
      }
    });
  },

  leerCuestionario(root, contenido) {
    const out = {};
    ((contenido && contenido.preguntas) || []).forEach(p => {
      const nom = `r-${p.id}`;
      const caja = root.querySelector(`.act-resp-preg[data-q="${CSS.escape(p.id)}"]`);
      if (!caja) return;
      if (p.tipo === 'opcion') {
        const v = [...caja.querySelectorAll(`input[name="${nom}"]:checked`)].map(i => i.value);
        if (v.length) out[p.id] = v;
      } else if (p.tipo === 'vf') {
        const v = caja.querySelector(`input[name="${nom}"]:checked`);
        if (v) out[p.id] = v.value === 'true';
      } else if (p.tipo === 'numerica') {
        const v = caja.querySelector(`input[name="${nom}"]`).value.trim();
        if (v) out[p.id] = v.slice(0, 40);
      } else if (p.tipo === 'ordenar') {
        out[p.id] = [...caja.querySelectorAll('.act-ordenar li')].map(li => li.dataset.id);
      } else if (p.tipo === 'relacionar' || (p.tipo === 'imagen' && p.modo === 'etiquetar')) {
        const o = {};
        caja.querySelectorAll(`select[name="${nom}"]`).forEach(s => { if (s.value) o[s.dataset.izq] = s.value; });
        if (Object.keys(o).length) out[p.id] = o;
      } else if (p.tipo === 'completar') {
        const o = {};
        caja.querySelectorAll(`input[name="${nom}"]`).forEach(i => { if (i.value.trim()) o[i.dataset.n] = i.value.trim().slice(0, 200); });
        if (Object.keys(o).length) out[p.id] = o;
      } else if (p.tipo === 'imagen') {
        const w = caja.querySelector('.act-img-marcar');
        if (w && w.dataset.x) out[p.id] = { x: Number(w.dataset.x), y: Number(w.dataset.y) };
      }
    });
    return out;
  },
  sinResponder(contenido, resp) {
    return ((contenido && contenido.preguntas) || []).filter(p => resp[p.id] === undefined && p.tipo !== 'ordenar').length;
  },

  /* ---------- Entrada del alumno: abre la actividad según el tipo ---------- */
  claseYEntrega(claseId) {
    const clase = (window.clasesGuardadasCache || []).find(c => Number(c.id) === Number(claseId));
    const dni = this.miDni();
    const entrega = ((window.ClasesModulo && ClasesModulo.entregasCache) || []).find(e => Number(e.clase_id) === Number(claseId) && String(e.estudiante_user) === dni) || null;
    return { clase, entrega, dni };
  },

  intentosInfo(clase, entrega) {
    const op = (clase.contenido && clase.contenido.opciones) || {};
    const maximo = op.intentos === undefined || op.intentos === null ? 1 : Number(op.intentos) || 0;
    const usados = entrega ? Number(entrega.intentos) || 0 : 0;
    return { maximo, usados, quedan: maximo === 0 ? Infinity : Math.max(0, maximo - usados) };
  },

  async abrir(claseId) {
    const { clase, entrega, dni } = this.claseYEntrega(claseId);
    if (!clase) return;
    const T = this.TIPOS[clase.tipo] || {};
    const pl = this.plazo(clase);
    const vencida = pl && pl.vencida;
    const titulo = `${T.ico || ''} ${this.esc(clase.titulo)}`;
    if (this.AUTO.includes(clase.tipo)) {
      const inf = this.intentosInfo(clase, entrega);
      const calificadaPorDocente = entrega && this.tieneNota(entrega) && !inf.usados;
      if (entrega && (inf.quedan <= 0 || vencida || calificadaPorDocente)) return this.verResultado(claseId);
      if (vencida) return this.aviso('info', 'Venció el plazo', 'Ya no se puede responder esta actividad.');
      return clase.tipo === 'diagnostico' ? this.abrirDiagnostico(clase, dni, false) : this.abrirCuestionario(clase, dni, false);
    }
    const bloqueada = this.tieneNota(entrega) || vencida;
    if (bloqueada) return this.verResultado(claseId);
    if (clase.tipo === 'escrita') return this.abrirEscrita(clase, entrega);
    if (clase.tipo === 'presupuesto') return this.abrirPresupuesto(clase, entrega);
    if (clase.tipo === 'bitacora') return this.abrirBitacora(clase, entrega);
    if (clase.tipo === 'encuesta') return this.abrirEncuesta(clase, entrega);
    return this.modal(titulo, '<p>Esta actividad no tiene nada para responder en la plataforma.</p>');
  },

  encabezadoActividad(clase, entrega) {
    const pl = this.plazo(clase);
    const inf = this.AUTO.includes(clase.tipo) ? this.intentosInfo(clase, entrega) : null;
    const partes = [];
    if (clase.es_evaluacion) partes.push('<span class="act-chip eval">🎓 Evaluación</span>');
    if (pl) partes.push(`<span class="act-chip ${pl.cls}">⏰ ${this.esc(pl.txt)}</span>`);
    if (inf) partes.push(`<span class="act-chip">Intento ${inf.usados + 1}${inf.maximo ? ' de ' + inf.maximo : ''}</span>`);
    return `${partes.length ? `<div class="act-chips">${partes.join('')}</div>` : ''}${clase.descripcion ? `<p class="act-consigna">${this.textoConSaltos(clase.descripcion)}</p>` : ''}`;
  },

  /* ---------- Cuestionario ---------- */
  abrirCuestionario(clase, dni, prueba, clave = null) {
    const semilla = Corrector.semilla(clase.id, dni);
    const mezclar = !!(clase.contenido && clase.contenido.opciones && clase.contenido.opciones.mezclar);
    const ps = this.preguntasOrdenadas(clase.contenido, semilla);
    const cuerpo = `${prueba ? '<div class="act-prueba">👁️ Vista de prueba: así lo ve el alumno. La nota no se guarda.</div>' : ''}${this.encabezadoActividad(clase, prueba ? null : this.claseYEntrega(clase.id).entrega)}
      <form id="act-form-resp" class="act-form-resp" onsubmit="return false">${ps.map((p, i) => this.preguntaHTML(p, i + 1, semilla, mezclar)).join('')}</form>`;
    const pie = `<button type="button" class="act-btn-sec" onclick="Actividades.cerrarModal()">Cancelar</button><button type="button" class="act-btn" id="act-enviar">Enviar respuestas</button>`;
    const m = this.modal(`✅ ${this.esc(clase.titulo)}`, cuerpo, pie);
    this.activarFormulario(m.querySelector('#act-form-resp'));
    m.querySelector('#act-enviar').onclick = async () => {
      const resp = this.leerCuestionario(m.querySelector('#act-form-resp'), clase.contenido);
      const faltan = this.sinResponder(clase.contenido, resp);
      if (faltan && !confirm(`Te faltan responder ${faltan} pregunta(s). ¿Enviar igual?`)) return;
      if (prueba) {
        const r = Corrector.corregirCuestionario(clase.contenido, clave, resp, semilla);
        return this.mostrarCorreccion(clase, { nota: r.nota, detalle: r.detalle, respuestas: resp, dni, prueba: true });
      }
      if (!confirm('¿Enviar tus respuestas? Se corrigen en el momento.')) return;
      await this.enviarAuto(clase, resp, dni);
    };
  },

  async enviarAuto(clase, resp, dni) {
    const btn = document.getElementById('act-enviar');
    if (btn) { btn.disabled = true; btn.textContent = 'Corrigiendo…'; }
    try {
      const { data, error } = await supabase.functions.invoke('corregir-actividad', { body: { clase_id: clase.id, respuestas: resp } });
      if (error) {
        let msg = error.message || '';
        try { const b = error.context && await error.context.json(); if (b && b.error) msg = b.error; } catch (_) { /* sin cuerpo */ }
        if (/Failed to send|Function not found|404/i.test(msg)) msg = 'La corrección automática todavía no está instalada (función corregir-actividad). Avisale a la dirección.';
        throw new Error(msg);
      }
      if (data && data.error) throw new Error(data.error);
      this.mostrarCorreccion(clase, { ...data, respuestas: resp, dni });
      if (window.ClasesModulo) ClasesModulo.cargarListaClases(true);
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Enviar respuestas'; }
      this.aviso('error', 'No se pudo enviar', e.message);
    }
  },

  mostrarCorreccion(clase, r) {
    const ok = Number(r.nota) >= 70;
    let h = `${r.prueba ? '<div class="act-prueba">👁️ Vista de prueba: la nota no se guarda.</div>' : ''}
      <div class="act-nota-grande ${ok ? 'ok' : 'bad'}"><span>${r.nota}</span><small>${ok ? 'Aprobado (70 o más)' : 'No alcanza 70'}</small></div>`;
    if (!r.prueba && r.mejor !== undefined && Number(r.mejor) !== Number(r.nota)) h += `<p class="act-centro">Tu mejor nota en esta actividad sigue siendo <strong>${r.mejor}</strong>.</p>`;
    if (!r.prueba && r.maximo) h += `<p class="act-centro act-ayuda">Usaste ${r.intentos} de ${r.maximo} intento(s).</p>`;
    if (r.detalle) {
      const ent = { respuestas: { r: r.respuestas, d: r.detalle } };
      h += this.respuestasHTML(clase, ent, { dni: r.dni });
    } else if (!r.prueba) h += '<p class="act-centro act-ayuda">El docente eligió mostrar solo la nota.</p>';
    this.modal(`${(this.TIPOS[clase.tipo] || {}).ico || ''} ${this.esc(clase.titulo)} · Resultado`, h, '<button type="button" class="act-btn" onclick="Actividades.cerrarModal()">Listo</button>');
  },

  /* ---------- Caso de diagnóstico ---------- */
  abrirDiagnostico(clase, dni, prueba, clave = null) {
    const c = clase.contenido || {};
    const porId = {};
    (c.nodos || []).forEach(n => { porId[n.id] = n; });
    const est = { camino: [], textos: [], actual: porId[c.inicio] || (c.nodos || [])[0] };
    const pintar = () => {
      const n = est.actual;
      const fin = !n || !(n.opciones || []).length;
      let h = `${prueba ? '<div class="act-prueba">👁️ Vista de prueba: así lo ve el alumno. La nota no se guarda.</div>' : ''}${this.encabezadoActividad(clase, prueba ? null : this.claseYEntrega(clase.id).entrega)}`;
      if (est.textos.length) h += `<ol class="act-camino">${est.textos.map(t => `<li>${this.esc(t)}</li>`).join('')}</ol>`;
      if (n) {
        h += `<div class="act-nodo-actual">${n.imagen ? `<img class="act-img-apoyo" src="${this.esc(n.imagen)}" alt="Imagen de la situación">` : ''}<p>${this.textoConSaltos(n.texto)}</p></div>`;
      }
      if (!fin) {
        h += `<p class="act-ayuda">¿Qué hacés?</p><div class="act-decisiones">${n.opciones.map(o => `<button type="button" class="act-decision" data-op="${this.esc(o.id)}">${this.esc(o.texto)}</button>`).join('')}</div>`;
      } else {
        h += '<div class="act-fin-caso">🏁 Llegaste al final del caso.</div>';
      }
      const pie = `<button type="button" class="act-btn-sec" id="act-reiniciar" ${est.camino.length ? '' : 'disabled'}>Volver a empezar</button><button type="button" class="act-btn" id="act-enviar" ${fin && est.camino.length ? '' : 'disabled'}>Enviar</button>`;
      const m = this.modal(`🔎 ${this.esc(clase.titulo)}`, h, pie);
      m.querySelectorAll('.act-decision').forEach(b => {
        b.onclick = () => {
          const o = n.opciones.find(x => x.id === b.dataset.op);
          est.camino.push(o.id); est.textos.push(o.texto);
          est.actual = o.destino && o.destino !== 'fin' ? porId[o.destino] : null;
          if (est.camino.length >= 40) est.actual = null;
          pintar();
        };
      });
      m.querySelector('#act-reiniciar').onclick = () => { est.camino = []; est.textos = []; est.actual = porId[c.inicio] || (c.nodos || [])[0]; pintar(); };
      m.querySelector('#act-enviar').onclick = async () => {
        const resp = { camino: est.camino.slice() };
        if (prueba) {
          const r = Corrector.corregirDiagnostico(c, clave, resp);
          return this.mostrarCorreccion(clase, { nota: r.nota, detalle: r.pasos, respuestas: resp, dni, prueba: true });
        }
        if (!confirm('¿Enviar tu recorrido del caso?')) return;
        await this.enviarAuto(clase, resp, dni);
      };
    };
    pintar();
  },

  /* ---------- Respuesta escrita ---------- */
  abrirEscrita(clase, entrega) {
    const r = (entrega && entrega.respuestas && entrega.respuestas.r) || {};
    const ps = (clase.contenido && clase.contenido.preguntas) || [];
    const cuerpo = `${this.encabezadoActividad(clase, entrega)}<form id="act-form-resp" class="act-form-resp" onsubmit="return false">
      ${ps.map((p, i) => `<div class="act-resp-preg"><div class="act-resp-enun"><span class="act-resp-n">${i + 1}</span><div>${this.textoConSaltos(p.enunciado)}</div></div>
        <textarea class="act-in act-texto" name="${this.esc(p.id)}" rows="5" maxlength="${Number(p.max) || this.MAX_TEXTO}" oninput="this.nextElementSibling.textContent = this.value.length + ' / ' + this.maxLength">${this.esc(r[p.id] || '')}</textarea><span class="act-contador">${String(r[p.id] || '').length} / ${Number(p.max) || this.MAX_TEXTO}</span></div>`).join('')}
      </form><p class="act-ayuda">Podés modificar tu respuesta hasta que el docente la corrija${clase.fecha_limite ? ' o venza el plazo' : ''}.</p>`;
    const m = this.modal(`✍️ ${this.esc(clase.titulo)}`, cuerpo, `<button type="button" class="act-btn-sec" onclick="Actividades.cerrarModal()">Cancelar</button><button type="button" class="act-btn" id="act-enviar">${entrega ? 'Guardar cambios' : 'Enviar'}</button>`);
    m.querySelector('#act-enviar').onclick = async () => {
      const out = {};
      m.querySelectorAll('textarea.act-texto').forEach(t => { if (t.value.trim()) out[t.name] = t.value.trim().slice(0, Number(t.maxLength) || this.MAX_TEXTO); });
      if (!Object.keys(out).length) return this.aviso('warning', 'No escribiste nada', 'Respondé al menos una consigna.');
      await this.guardarDirecto(clase, out);
    };
  },

  /* ---------- Presupuesto / cómputo ---------- */
  abrirPresupuesto(clase, entrega) {
    const c = clase.contenido || {};
    const prev = (entrega && entrega.respuestas && entrega.respuestas.r && entrega.respuestas.r.filas) || [];
    const filas = (c.items || []).map(it => {
      const p = prev.find(f => f.id === it.id) || {};
      return { id: it.id, descripcion: it.descripcion, unidad: it.unidad, fijo: String(it.precio || '').trim() !== '', precio: String(it.precio || '').trim() !== '' ? it.precio : (p.precio || ''), cantidad: p.cantidad || '' };
    }).concat(prev.filter(f => f.extra).map(f => ({ ...f })));
    const pintar = () => {
      const tot = Corrector.totalesPresupuesto(filas);
      const fmt = (n) => n === null ? '—' : '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const cuerpo = `${this.encabezadoActividad(clase, entrega)}
        <div class="act-tabla-scroll"><table class="act-tabla act-presu"><thead><tr><th>Material</th><th>Unidad</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th><th></th></tr></thead><tbody>
        ${filas.map((f, i) => `<tr>
          <td>${f.extra ? `<input class="act-in" data-i="${i}" data-c="descripcion" value="${this.esc(f.descripcion)}" maxlength="120" placeholder="Material">` : this.esc(f.descripcion)}</td>
          <td>${f.extra ? `<input class="act-in" data-i="${i}" data-c="unidad" value="${this.esc(f.unidad)}" maxlength="12" style="width:4.5rem">` : this.esc(f.unidad)}</td>
          <td><input class="act-in act-num" data-i="${i}" data-c="cantidad" value="${this.esc(f.cantidad)}" inputmode="decimal" maxlength="15"></td>
          <td>${f.fijo ? this.esc(f.precio) : `<input class="act-in act-num" data-i="${i}" data-c="precio" value="${this.esc(f.precio)}" inputmode="decimal" maxlength="15">`}</td>
          <td class="act-sub-total">${fmt(tot.subtotales[i])}</td>
          <td>${f.extra ? `<button type="button" class="act-mini act-quitar" data-quitar="${i}">✕</button>` : ''}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="4">TOTAL</td><td class="act-total">${fmt(tot.total)}</td><td></td></tr></tfoot></table></div>
        ${c.permitirFilas !== false ? '<button type="button" class="act-btn-sec" id="act-fila-mas">+ Agregar material</button>' : ''}`;
      const m = this.modal(`🧮 ${this.esc(clase.titulo)}`, cuerpo, `<button type="button" class="act-btn-sec" onclick="Actividades.cerrarModal()">Cancelar</button><button type="button" class="act-btn" id="act-enviar">${entrega ? 'Guardar cambios' : 'Enviar'}</button>`, 960);
      m.querySelectorAll('input[data-c]').forEach(inp => {
        inp.oninput = () => {
          filas[Number(inp.dataset.i)][inp.dataset.c] = inp.value;
          const t2 = Corrector.totalesPresupuesto(filas);
          m.querySelectorAll('.act-sub-total').forEach((td, j) => { td.textContent = fmt(t2.subtotales[j]); });
          m.querySelector('.act-total').textContent = fmt(t2.total);
        };
      });
      m.querySelectorAll('[data-quitar]').forEach(b => { b.onclick = () => { filas.splice(Number(b.dataset.quitar), 1); pintar(); }; });
      const mas = m.querySelector('#act-fila-mas');
      if (mas) mas.onclick = () => { if (filas.length >= 60) return; filas.push({ id: this.uid('f'), extra: true, descripcion: '', unidad: 'u', cantidad: '', precio: '' }); pintar(); };
      m.querySelector('#act-enviar').onclick = async () => {
        const salida = filas.filter(f => String(f.cantidad).trim() || f.extra).map(f => {
          const o = { id: f.id, cantidad: String(f.cantidad).trim().slice(0, 15) };
          if (!f.fijo) o.precio = String(f.precio).trim().slice(0, 15);
          if (f.extra) Object.assign(o, { extra: true, descripcion: String(f.descripcion).trim().slice(0, 120), unidad: String(f.unidad).trim().slice(0, 12) });
          return o;
        });
        if (!salida.length) return this.aviso('warning', 'La tabla está vacía', 'Completá al menos una cantidad.');
        await this.guardarDirecto(clase, { filas: salida });
      };
    };
    pintar();
  },

  /* ---------- Bitácora ---------- */
  abrirBitacora(clase, entrega) {
    const entradas = ((entrega && entrega.respuestas && entrega.respuestas.r && entrega.respuestas.r.entradas) || []).slice();
    const hoy = this.hoyISO();
    const lista = entradas.length ? `<ul class="act-bitacora">${entradas.map((en, i) => `<li><div class="act-bit-cab"><strong>${this.fechaDMY(en.f)}</strong><button type="button" class="act-mini act-quitar" data-quitar="${i}">Quitar</button></div><p>${this.textoConSaltos(en.t)}</p>${this.urlSegura(en.l) ? `<a href="${this.esc(this.urlSegura(en.l))}" target="_blank" rel="noopener noreferrer">📷 Ver fotos</a>` : ''}</li>`).join('')}</ul>` : '<p class="act-ayuda">Todavía no cargaste entradas.</p>';
    const cuerpo = `${this.encabezadoActividad(clase, entrega)}${lista}
      <div class="act-caja"><h5>Nueva entrada</h5>
        <div class="act-fila"><label>Fecha <input type="date" class="act-in" id="bit-fecha" value="${hoy}" max="${hoy}"></label>
        <label class="act-crece">Link a fotos (opcional) <input class="act-in" id="bit-link" placeholder="https://photos.app.goo.gl/…" maxlength="300"></label></div>
        <label>¿Qué hiciste hoy? <textarea class="act-in" id="bit-texto" rows="4" maxlength="1500" placeholder="Tareas realizadas, herramientas usadas, dificultades, medidas tomadas…"></textarea></label>
      </div>`;
    const m = this.modal(`📓 ${this.esc(clase.titulo)}`, cuerpo, `<button type="button" class="act-btn-sec" onclick="Actividades.cerrarModal()">Cerrar</button><button type="button" class="act-btn" id="act-enviar">Agregar entrada</button>`);
    m.querySelectorAll('[data-quitar]').forEach(b => {
      b.onclick = async () => {
        if (!confirm('¿Quitar esta entrada?')) return;
        entradas.splice(Number(b.dataset.quitar), 1);
        if (await this.guardarDirecto(clase, { entradas }, true)) this.abrirBitacora(clase, this.claseYEntrega(clase.id).entrega);
      };
    });
    m.querySelector('#act-enviar').onclick = async () => {
      const t = m.querySelector('#bit-texto').value.trim();
      const l = m.querySelector('#bit-link').value.trim();
      if (!t) return this.aviso('warning', 'Falta el texto', 'Contá qué hiciste en la clase.');
      if (l && !this.urlSegura(l)) return this.aviso('warning', 'Link no válido', 'Tiene que empezar con https://');
      if (entradas.length >= 30) return this.aviso('warning', 'Bitácora completa', 'Llegaste al máximo de 30 entradas.');
      entradas.push({ f: m.querySelector('#bit-fecha').value || hoy, t: t.slice(0, 1500), l: l ? this.urlSegura(l) : '' });
      if (await this.guardarDirecto(clase, { entradas }, true)) this.abrirBitacora(clase, this.claseYEntrega(clase.id).entrega);
    };
  },

  /* ---------- Encuesta ---------- */
  abrirEncuesta(clase, entrega) {
    const r = (entrega && entrega.respuestas && entrega.respuestas.r) || {};
    const ps = (clase.contenido && clase.contenido.preguntas) || [];
    const cuerpo = `${this.encabezadoActividad(clase, entrega)}<form id="act-form-resp" class="act-form-resp" onsubmit="return false">
      ${ps.map((p, i) => {
        let campo = '';
        if (p.tipo === 'escala') campo = `<div class="act-escala">${[1, 2, 3, 4, 5].map(v => `<label><input type="radio" name="${this.esc(p.id)}" value="${v}" ${Number(r[p.id]) === v ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div><div class="act-escala-ref"><span>1 = muy poco</span><span>5 = mucho</span></div>`;
        else if (p.tipo === 'opcion') campo = `<div class="act-ops">${(p.opciones || []).map(o => `<label class="act-op"><input type="radio" name="${this.esc(p.id)}" value="${this.esc(o)}" ${r[p.id] === o ? 'checked' : ''}> <span>${this.esc(o)}</span></label>`).join('')}</div>`;
        else campo = `<textarea class="act-in" name="${this.esc(p.id)}" rows="3" maxlength="500">${this.esc(r[p.id] || '')}</textarea>`;
        return `<div class="act-resp-preg"><div class="act-resp-enun"><span class="act-resp-n">${i + 1}</span><div>${this.textoConSaltos(p.enunciado)}</div></div>${campo}</div>`;
      }).join('')}</form>
      <p class="act-ayuda">Esta encuesta no lleva nota.${clase.contenido && clase.contenido.anonima ? ' El docente ve los resultados sin nombres.' : ''}</p>`;
    const m = this.modal(`💬 ${this.esc(clase.titulo)}`, cuerpo, `<button type="button" class="act-btn-sec" onclick="Actividades.cerrarModal()">Cancelar</button><button type="button" class="act-btn" id="act-enviar">${entrega ? 'Guardar cambios' : 'Enviar'}</button>`);
    m.querySelector('#act-enviar').onclick = async () => {
      const out = {};
      ps.forEach(p => {
        if (p.tipo === 'texto') { const t = m.querySelector(`textarea[name="${CSS.escape(p.id)}"]`); if (t && t.value.trim()) out[p.id] = t.value.trim().slice(0, 500); }
        else { const s = m.querySelector(`input[name="${CSS.escape(p.id)}"]:checked`); if (s) out[p.id] = p.tipo === 'escala' ? Number(s.value) : s.value; }
      });
      if (!Object.keys(out).length) return this.aviso('warning', 'Sin respuestas', 'Respondé al menos una pregunta.');
      await this.guardarDirecto(clase, out);
    };
  },

  /* ---------- Guardado directo (escrita, presupuesto, bitácora, encuesta) ---------- */
  async guardarDirecto(clase, respuestas, quedarse = false) {
    const dni = this.miDni();
    try {
      const { data: prev } = await supabase.from('entregas_actividades').select('id, nota').eq('clase_id', clase.id).eq('estudiante_user', dni);
      const existe = (prev || [])[0];
      if (existe && this.tieneNota(existe)) throw new Error('El docente ya corrigió esta actividad: no se puede modificar.');
      const datos = { respuestas: { r: respuestas }, updated_at: new Date().toISOString() };
      const q = existe
        ? supabase.from('entregas_actividades').update(datos).eq('id', existe.id)
        : supabase.from('entregas_actividades').insert([{ clase_id: clase.id, estudiante_user: dni, ...datos }]);
      const { error } = await q;
      if (error) {
        if (/row-level security|violates/i.test(error.message || '')) throw new Error('Venció el plazo o la actividad ya no admite cambios.');
        if (/respuestas|intentos/i.test(error.message || '')) throw new Error('Falta actualizar la base de datos (sql/11_clases_y_actividades.sql). Avisale a la dirección.');
        throw error;
      }
      if (window.ClasesModulo) await ClasesModulo.cargarListaClases(true);
      if (!quedarse) { this.cerrarModal(); this.toast(clase.tipo === 'encuesta' ? '¡Gracias por responder!' : 'Respuesta enviada'); }
      else this.toast('Guardado');
      return true;
    } catch (e) {
      this.aviso('error', 'No se pudo guardar', e.message || String(e));
      return false;
    }
  },

  /* ---------- Resultado (alumno) ---------- */
  verResultado(claseId) {
    const { clase, entrega, dni } = this.claseYEntrega(claseId);
    if (!clase) return;
    const op = (clase.contenido && clase.contenido.opciones) || {};
    let h = '';
    if (this.tieneNota(entrega)) {
      const n = parseFloat(entrega.nota);
      h += `<div class="act-nota-grande ${n >= 70 ? 'ok' : 'bad'}"><span>${this.esc(entrega.nota)}</span><small>${n >= 70 ? 'Aprobado (70 o más)' : 'No alcanza 70'}</small></div>`;
    } else if (entrega) {
      h += `<p class="act-centro">${clase.tipo === 'encuesta' ? '✔ Respondiste esta encuesta.' : '⏳ Entregado: falta la corrección del docente.'}</p>`;
    } else {
      h += '<p class="act-centro">No entregaste esta actividad.</p>';
    }
    if (entrega && this.AUTO.includes(clase.tipo)) {
      const inf = this.intentosInfo(clase, entrega);
      if (inf.usados) h += `<p class="act-centro act-ayuda">Intentos usados: ${inf.usados}${inf.maximo ? ' de ' + inf.maximo : ''}. Queda la mejor nota.</p>`;
    }
    if (entrega && entrega.cotejo && clase.contenido && clase.contenido.cotejo) h += this.cotejoLecturaHTML(clase.contenido.cotejo, entrega.cotejo);
    if (entrega && entrega.comentario_docente) h += `<div class="act-devolucion">💬 <strong>Devolución del docente:</strong> ${this.textoConSaltos(entrega.comentario_docente)}</div>`;
    if (entrega && entrega.respuestas) {
      if (entrega.respuestas.archivado) h += `<p class="act-ayuda">El detalle de las respuestas se archivó al cierre del ciclo (${this.fechaDMY(entrega.respuestas.archivado)}).</p>`;
      else if (!(this.AUTO.includes(clase.tipo) && op.devolucion === 'nota')) h += this.respuestasHTML(clase, entrega, { dni });
    }
    this.modal(`${(this.TIPOS[clase.tipo] || {}).ico || ''} ${this.esc(clase.titulo)}`, h, '<button type="button" class="act-btn" onclick="Actividades.cerrarModal()">Cerrar</button>');
  },

  cotejoLecturaHTML(criterios, valores) {
    return `<div class="act-caja"><h5>Lista de cotejo</h5><ul class="act-cotejo-lect">${(criterios || []).map(c => {
      const v = valores ? valores[c.id] : undefined;
      const nv = this.NIVELES.find(n => Number(n.v) === Number(v));
      return `<li><span>${this.esc(c.texto)}${Number(c.peso) > 1 ? ` <small>(peso ${c.peso})</small>` : ''}</span><span class="act-nivel ${nv ? nv.cls : ''}">${nv ? nv.txt : '—'}</span></li>`;
    }).join('')}</ul></div>`;
  },

  /* ---------- Respuestas en modo lectura (alumno y docente) ----------
     opts: { dni, clave } — con clave (docente) se muestra también la respuesta correcta */
  respuestasHTML(clase, entrega, opts = {}) {
    const c = clase.contenido || {};
    const res = (entrega && entrega.respuestas) || {};
    const r = res.r || {};
    const dni = opts.dni;
    const semilla = Corrector.semilla(clase.id, dni);
    const marca = (f) => f === undefined || f === null ? '' : (f >= 1 ? '<span class="act-marca-res ok">✔ Correcta</span>' : f > 0 ? `<span class="act-marca-res mid">◐ Parcial (${Math.round(f * 100)}%)</span>` : '<span class="act-marca-res bad">✕ Incorrecta</span>');
    if (clase.tipo === 'cuestionario') {
      let d = res.d || null;
      if (!d && opts.clave) d = Corrector.corregirCuestionario(c, opts.clave, r, semilla).detalle;
      const kp = (opts.clave && opts.clave.preguntas) || {};
      return `<div class="act-revision">${(c.preguntas || []).map((p, i) => {
        const vals = p.tipo === 'numerica' ? Corrector.valoresVariables(p, semilla) : {};
        const det = d && d[p.id];
        return `<div class="act-rev-preg"><div class="act-resp-enun"><span class="act-resp-n">${i + 1}</span><div>${this.textoConSaltos(p.tipo === 'numerica' ? Corrector.sustituir(p.enunciado, vals) : p.enunciado)}</div></div>
          <div class="act-rev-resp"><span class="act-rev-et">Respuesta:</span> ${this.textoRespuesta(p, r[p.id], semilla, opts.clave ? kp[p.id] : null)} ${marca(det ? det.f : undefined)}</div>
          ${opts.clave ? `<div class="act-rev-resp act-rev-ok"><span class="act-rev-et">Correcta:</span> ${this.textoCorrecta(p, kp[p.id], semilla)}</div>` : ''}
          ${det && det.dev ? `<div class="act-rev-exp">💡 ${this.textoConSaltos(det.dev)}</div>` : ''}</div>`;
      }).join('')}</div>`;
    }
    if (clase.tipo === 'diagnostico') {
      let pasos = Array.isArray(res.d) ? res.d : null;
      if (!pasos && opts.clave) pasos = Corrector.corregirDiagnostico(c, opts.clave, r).pasos;
      const ops = {};
      const nodos = {};
      (c.nodos || []).forEach(n => { nodos[n.id] = n; (n.opciones || []).forEach(o => { ops[o.id] = o; }); });
      if (!pasos) pasos = (r.camino || []).map(id => ({ op: id }));
      return `<ol class="act-revision act-camino-rev">${pasos.map(p => `<li><div class="act-ayuda">${this.esc(String((nodos[p.nodo] || {}).texto || '').slice(0, 160))}</div><div><strong>${this.esc((ops[p.op] || {}).texto || '')}</strong> ${p.v !== undefined ? marca(p.v / 100) : ''}</div>${p.dev ? `<div class="act-rev-exp">💡 ${this.esc(p.dev)}</div>` : ''}</li>`).join('')}</ol>`;
    }
    if (clase.tipo === 'escrita') {
      return `<div class="act-revision">${(c.preguntas || []).map((p, i) => `<div class="act-rev-preg"><div class="act-resp-enun"><span class="act-resp-n">${i + 1}</span><div>${this.textoConSaltos(p.enunciado)}</div></div><div class="act-rev-texto">${r[p.id] ? this.textoConSaltos(r[p.id]) : '<em>Sin respuesta</em>'}</div></div>`).join('')}</div>`;
    }
    if (clase.tipo === 'presupuesto') {
      const filas = (r.filas || []).map(f => {
        const it = (c.items || []).find(x => x.id === f.id) || {};
        return { descripcion: f.extra ? f.descripcion : it.descripcion, unidad: f.extra ? f.unidad : it.unidad, cantidad: f.cantidad, precio: f.precio !== undefined ? f.precio : it.precio };
      });
      const tot = Corrector.totalesPresupuesto(filas);
      const fmt = (n) => n === null ? '—' : '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `<div class="act-tabla-scroll"><table class="act-tabla act-presu"><thead><tr><th>Material</th><th>Unidad</th><th>Cantidad</th><th>Precio unit.</th><th>Subtotal</th></tr></thead><tbody>
        ${filas.map((f, i) => `<tr><td>${this.esc(f.descripcion)}</td><td>${this.esc(f.unidad)}</td><td>${this.esc(f.cantidad)}</td><td>${this.esc(f.precio)}</td><td>${fmt(tot.subtotales[i])}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="4">TOTAL</td><td>${fmt(tot.total)}</td></tr></tfoot></table></div>`;
    }
    if (clase.tipo === 'bitacora') {
      const en = r.entradas || [];
      return en.length ? `<ul class="act-bitacora">${en.map(e => `<li><strong>${this.fechaDMY(e.f)}</strong><p>${this.textoConSaltos(e.t)}</p>${this.urlSegura(e.l) ? `<a href="${this.esc(this.urlSegura(e.l))}" target="_blank" rel="noopener noreferrer">📷 Ver fotos</a>` : ''}</li>`).join('')}</ul>` : '<p class="act-ayuda">Sin entradas.</p>';
    }
    if (clase.tipo === 'encuesta') {
      return `<div class="act-revision">${(c.preguntas || []).map((p, i) => `<div class="act-rev-preg"><div class="act-resp-enun"><span class="act-resp-n">${i + 1}</span><div>${this.esc(p.enunciado)}</div></div><div class="act-rev-texto">${r[p.id] !== undefined ? this.esc(r[p.id]) : '<em>Sin respuesta</em>'}</div></div>`).join('')}</div>`;
    }
    return '';
  },

  textoRespuesta(p, r, semilla, k) {
    const nada = '<em>Sin responder</em>';
    if (r === undefined || r === null || r === '') return nada;
    if (p.tipo === 'opcion') {
      const ids = Array.isArray(r) ? r : [r];
      return this.esc(ids.map(id => ((p.opciones || []).find(o => o.id === id) || {}).texto || '?').join(' · ')) || nada;
    }
    if (p.tipo === 'vf') return r === true || r === 'true' ? 'Verdadero' : 'Falso';
    if (p.tipo === 'numerica') return `${this.esc(r)} ${this.esc(p.unidad || '')}`;
    if (p.tipo === 'ordenar') return `<ol class="act-rev-lista">${(Array.isArray(r) ? r : []).map(id => `<li>${this.esc(((p.items || []).find(x => x.id === id) || {}).texto || '?')}</li>`).join('')}</ol>`;
    if (p.tipo === 'relacionar') {
      const der = {}; (p.derecha || []).forEach(d => { der[d.id] = d.texto; });
      return `<ul class="act-rev-lista">${(p.izquierda || []).map(i => `<li>${this.esc(i.texto)} → <strong>${this.esc(der[r[i.id]] || '—')}</strong></li>`).join('')}</ul>`;
    }
    if (p.tipo === 'completar') return this.esc(p.texto || '').replace(/\[\[(\d+)\]\]/g, (m, n) => `<span class="act-hueco-lect">${this.esc(r[n] || '___')}</span>`).replace(/\n/g, '<br>');
    if (p.tipo === 'imagen') {
      if (p.modo === 'etiquetar') {
        const et = {}; (p.etiquetas || []).forEach(e => { et[e.id] = e.texto; });
        return `<ul class="act-rev-lista">${(p.marcadores || []).map((m, j) => `<li>${j + 1} → <strong>${this.esc(et[r[m.id]] || '—')}</strong></li>`).join('')}</ul>`;
      }
      const z = k && k.zona;
      return `<div class="act-img-wrap act-img-chica solo-lectura"><img src="${this.esc(p.imagen)}" alt="">${z ? `<span class="act-zona" style="left:${z.x}%;top:${z.y}%;width:${2 * z.r}%"></span>` : ''}<span class="act-pin" style="left:${Number(r.x)}%;top:${Number(r.y)}%"></span></div>`;
    }
    return this.esc(JSON.stringify(r));
  },

  textoCorrecta(p, k, semilla) {
    if (!k) return '—';
    if (p.tipo === 'opcion') return this.esc((k.correctas || []).map(id => ((p.opciones || []).find(o => o.id === id) || {}).texto || '?').join(' · '));
    if (p.tipo === 'vf') return k.valor === false ? 'Falso' : 'Verdadero';
    if (p.tipo === 'numerica') {
      try {
        const v = Corrector.evaluar(k.formula, Corrector.valoresVariables(p, semilla));
        return `${this.esc(Corrector.mostrarNumero(Math.round(v * 1000) / 1000))} ${this.esc(p.unidad || '')} <small>(±${this.esc(k.tolerancia)}${k.tolTipo === 'abs' ? ' ' + this.esc(p.unidad || '') : '%'})</small>`;
      } catch (e) { return '—'; }
    }
    if (p.tipo === 'ordenar') return `<ol class="act-rev-lista">${(k.orden || []).map(id => `<li>${this.esc(((p.items || []).find(x => x.id === id) || {}).texto || '?')}</li>`).join('')}</ol>`;
    if (p.tipo === 'relacionar') {
      const der = {}; (p.derecha || []).forEach(d => { der[d.id] = d.texto; });
      return `<ul class="act-rev-lista">${(p.izquierda || []).map(i => `<li>${this.esc(i.texto)} → ${this.esc(der[(k.pares || {})[i.id]] || '?')}</li>`).join('')}</ul>`;
    }
    if (p.tipo === 'completar') return this.esc(p.texto || '').replace(/\[\[(\d+)\]\]/g, (m, n) => `<span class="act-hueco-lect">${this.esc(((k.huecos || {})[n] || []).join(' / '))}</span>`).replace(/\n/g, '<br>');
    if (p.tipo === 'imagen') {
      if (p.modo === 'etiquetar') {
        const et = {}; (p.etiquetas || []).forEach(e => { et[e.id] = e.texto; });
        return `<ul class="act-rev-lista">${(p.marcadores || []).map((m, j) => `<li>${j + 1} → ${this.esc(et[(k.pares || {})[m.id]] || '?')}</li>`).join('')}</ul>`;
      }
      return 'Zona marcada en verde';
    }
    return '—';
  }
});

/* ==========================================================================
   DOCENTE: respuestas, corrección con lista de cotejo, planilla de taller,
   resultados de encuestas, vista de prueba y banco de preguntas
   ========================================================================== */
Object.assign(Actividades, {
  async datosDocente(claseId) {
    let clase = (window.clasesGuardadasCache || []).find(c => Number(c.id) === Number(claseId));
    if (!clase) { const { data } = await supabase.from('clases').select('*').eq('id', claseId).maybeSingle(); clase = data; }
    if (!clase) throw new Error('No se encontró la actividad.');
    const [rI, rE, rK] = await Promise.all([
      supabase.from('inscripciones').select('*').eq('trayecto_id', Number(clase.trayecto_id)),
      supabase.from('entregas_actividades').select('*').eq('clase_id', Number(claseId)),
      this.AUTO.includes(clase.tipo) ? supabase.from('claves_actividad').select('clave').eq('clase_id', Number(claseId)).maybeSingle() : Promise.resolve({ data: null })
    ]);
    let insc = (rI.data || []).filter(i => String(i.estado || '').toUpperCase() !== 'BAJA');
    if (clase.estudiante_user) insc = insc.filter(i => String(i.estudiante_user) === String(clase.estudiante_user));
    const entregas = rE.data || [];
    const dnis = [...new Set(insc.map(i => String(i.estudiante_user)).concat(entregas.map(e => String(e.estudiante_user))))];
    let usuarios = [];
    if (dnis.length) { const { data } = await supabase.from('usuarios').select('usuario, nombre, apellido').in('usuario', dnis); usuarios = data || []; }
    const activos = new Set(insc.map(i => String(i.estudiante_user)));
    const alumnos = dnis.map(dni => ({
      dni,
      nombre: this.nombreAlumno(usuarios.find(u => String(u.usuario) === dni), dni),
      activo: activos.has(dni),
      entrega: entregas.find(e => String(e.estudiante_user) === dni) || null
    })).filter(a => a.activo || a.entrega).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return { clase, alumnos, clave: (rK.data && rK.data.clave) || null };
  },

  estadoEntrega(clase, a) {
    const e = a.entrega;
    const pl = this.plazo(clase);
    if (!e) return { cls: pl && pl.vencida ? 'bad' : 'gris', txt: pl && pl.vencida ? (clase.calificable !== false && clase.tipo !== 'encuesta' ? 'No entregó (10)' : 'No respondió') : (clase.tipo === 'practica' ? 'Sin calificar' : 'Sin entregar') };
    if (this.tieneNota(e)) return { cls: parseFloat(e.nota) >= 70 ? 'ok' : 'bad', txt: 'Corregida' };
    if (clase.tipo === 'encuesta') return { cls: 'ok', txt: 'Respondió' };
    return { cls: 'mid', txt: 'Para corregir' };
  },

  /* ---------- Lista de alumnos de una actividad (incluye quién falta) ---------- */
  async verRespuestas(claseId) {
    this.modal('Cargando…', '<p class="act-centro">Cargando respuestas…</p>');
    try {
      const d = await this.datosDocente(claseId);
      const { clase, alumnos } = d;
      this._docente = d;
      const T = this.TIPOS[clase.tipo] || {};
      const act = alumnos.filter(a => a.activo);
      const entregaron = act.filter(a => a.entrega).length;
      const sinCorregir = act.filter(a => a.entrega && !this.tieneNota(a.entrega) && clase.tipo !== 'encuesta').length;
      const faltan = act.filter(a => !a.entrega);
      const pl = this.plazo(clase);
      let h = `<div class="act-resumen">
          <div><strong>${entregaron}</strong><span>de ${act.length} ${clase.tipo === 'practica' ? 'calificados' : clase.tipo === 'encuesta' ? 'respondieron' : 'entregaron'}</span></div>
          ${clase.calificable !== false && clase.tipo !== 'practica' ? `<div><strong>${sinCorregir}</strong><span>para corregir</span></div>` : ''}
          <div><strong>${faltan.length}</strong><span>${clase.tipo === 'practica' ? 'sin calificar' : 'faltan'}</span></div>
          ${pl ? `<div class="act-resumen-plazo ${pl.cls}">⏰ ${this.esc(pl.txt)}</div>` : ''}
        </div>
        <div class="act-acciones-sup">
          ${clase.tipo === 'practica' ? `<button type="button" class="act-btn" onclick="Actividades.planillaTaller(${Number(clase.id)})">🛠️ Abrir planilla de taller</button>` : ''}
          ${clase.tipo === 'encuesta' ? `<button type="button" class="act-btn" onclick="Actividades.resultadosEncuesta(${Number(clase.id)})">📊 Ver resultados</button>` : ''}
          ${this.AUTO.includes(clase.tipo) ? `<button type="button" class="act-btn-sec" onclick="Actividades.probar(${Number(clase.id)})">👁️ Probar como alumno</button>` : ''}
          ${faltan.length ? `<button type="button" class="act-btn-sec" id="act-copiar-faltan">📋 Copiar lista de quienes faltan</button>` : ''}
        </div>`;
      const ocultarNombres = clase.tipo === 'encuesta' && clase.contenido && clase.contenido.anonima;
      h += `<div class="act-tabla-scroll"><table class="act-tabla act-lista-alumnos"><thead><tr><th>Estudiante</th><th>Estado</th><th>Nota</th>${this.AUTO.includes(clase.tipo) ? '<th>Intentos</th>' : ''}<th>Última actualización</th><th></th></tr></thead><tbody>
        ${alumnos.map((a, i) => {
          const est = this.estadoEntrega(clase, a);
          const e = a.entrega;
          const fecha = e ? (e.updated_at || e.created_at) : null;
          const puedeVer = clase.tipo !== 'encuesta' || !ocultarNombres;
          return `<tr class="${a.activo ? '' : 'fila-baja'}"><td>${ocultarNombres ? `Estudiante ${i + 1}` : this.esc(a.nombre)}${a.activo ? '' : ' <small>(baja)</small>'}</td>
            <td><span class="act-estado ${est.cls}">${est.txt}</span></td>
            <td>${e && this.tieneNota(e) ? `<strong>${this.esc(e.nota)}</strong>` : '—'}</td>
            ${this.AUTO.includes(clase.tipo) ? `<td>${e ? Number(e.intentos) || 0 : 0}</td>` : ''}
            <td>${fecha ? new Date(fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
            <td>${puedeVer && (e || ['practica', 'tp', 'escrita', 'presupuesto', 'bitacora'].includes(clase.tipo)) && clase.tipo !== 'encuesta' ? `<button type="button" class="act-mini" onclick="Actividades.verEntrega(${Number(clase.id)}, '${this.esc(a.dni)}')">${e && !this.tieneNota(e) ? 'Corregir' : 'Ver'}</button>` : ''}</td></tr>`;
        }).join('')}
        </tbody></table></div>`;
      const m = this.modal(`${T.ico || ''} ${this.esc(clase.titulo)} · Respuestas`, h, '<button type="button" class="act-btn" onclick="Actividades.cerrarModal()">Cerrar</button>', 980);
      const cp = m.querySelector('#act-copiar-faltan');
      if (cp) cp.onclick = async () => {
        const txt = `${clase.titulo} — faltan entregar:\n` + faltan.map(a => `• ${a.nombre}`).join('\n');
        try { await navigator.clipboard.writeText(txt); this.toast('Lista copiada'); } catch (e) { prompt('Copiá la lista:', txt); }
      };
    } catch (e) {
      this.modal('Error', `<p>No se pudieron cargar las respuestas: ${this.esc(e.message)}</p>`);
    }
  },

  /* ---------- Ver y corregir la entrega de un alumno ---------- */
  async verEntrega(claseId, dni) {
    try {
      const d = (this._docente && Number(this._docente.clase.id) === Number(claseId)) ? this._docente : await this.datosDocente(claseId);
      this._docente = d;
      const { clase, clave } = d;
      const a = d.alumnos.find(x => x.dni === String(dni)) || { dni: String(dni), nombre: String(dni), entrega: null };
      const e = a.entrega;
      const c = clase.contenido || {};
      const cs = c.cotejo || [];
      const valores = Object.assign({}, (e && e.cotejo) || {});
      let h = '';
      if (clase.tipo === 'tp') {
        const u = e && this.urlSegura(e.url_entrega);
        h += u ? `<p><a class="act-btn-sec" href="${this.esc(u)}" target="_blank" rel="noopener noreferrer">🔗 Abrir el trabajo entregado</a></p>` : '<p class="act-ayuda">No entregó el link del trabajo. Igual podés calificarlo.</p>';
      }
      if (e && e.respuestas && e.respuestas.archivado) h += `<p class="act-ayuda">El detalle de las respuestas se archivó al cierre del ciclo (${this.fechaDMY(e.respuestas.archivado)}).</p>`;
      else if (e && e.respuestas) h += this.respuestasHTML(clase, e, { dni: a.dni, clave });
      if (this.AUTO.includes(clase.tipo) && e) {
        const hist = (e.respuestas && e.respuestas.h) || [];
        h += `<p class="act-ayuda">Intentos: ${Number(e.intentos) || 0}${hist.length ? ' · Notas: ' + hist.map(x => x.n).join(', ') : ''}. La nota es la del mejor intento; podés cambiarla.</p>`;
      }
      h += `<div class="act-caja act-calificar"><h5>Calificación</h5>
        ${cs.length ? `<table class="act-tabla act-cotejo"><tbody>${cs.map(cr => `<tr><td>${this.esc(cr.texto)}${Number(cr.peso) > 1 ? ` <small>(peso ${cr.peso})</small>` : ''}</td><td class="act-niveles">${this.NIVELES.map(n => `<button type="button" class="act-nivel-btn ${n.cls} ${Number(valores[cr.id]) === n.v && valores[cr.id] !== undefined && valores[cr.id] !== null ? 'sel' : ''}" data-cr="${this.esc(cr.id)}" data-v="${n.v}">${n.txt}</button>`).join('')}</td></tr>`).join('')}</tbody></table>
          <p class="act-ayuda">La nota se calcula sola con la lista de cotejo (podés corregirla a mano).</p>` : ''}
        <div class="act-fila"><label>Nota (0 a 100) <input class="act-in act-num" id="act-nota" type="number" min="0" max="100" value="${e && this.tieneNota(e) ? this.esc(e.nota) : ''}"></label>
        <label class="act-crece">Devolución para el alumno <textarea class="act-in" id="act-coment" rows="2" maxlength="1000">${this.esc((e && e.comentario_docente) || '')}</textarea></label></div>
      </div>`;
      const pie = `${this.AUTO.includes(clase.tipo) && e && Number(e.intentos) > 0 ? '<button type="button" class="act-btn-sec" id="act-otro-intento">↻ Darle un intento más</button>' : ''}
        <button type="button" class="act-btn-sec" onclick="Actividades.verRespuestas(${Number(clase.id)})">← Volver</button>
        <button type="button" class="act-btn" id="act-guardar-nota">💾 Guardar calificación</button>`;
      const m = this.modal(`${this.esc(a.nombre)} · ${this.esc(clase.titulo)}`, h, pie, 900);
      this.activarFormulario(m);
      m.querySelectorAll('.act-nivel-btn').forEach(b => {
        b.onclick = () => {
          const id = b.dataset.cr;
          const v = Number(b.dataset.v);
          if (valores[id] !== undefined && Number(valores[id]) === v) delete valores[id]; else valores[id] = v;
          m.querySelectorAll(`.act-nivel-btn[data-cr="${CSS.escape(id)}"]`).forEach(x => x.classList.toggle('sel', valores[id] !== undefined && Number(x.dataset.v) === Number(valores[id])));
          const n = Corrector.notaCotejo(cs, valores);
          if (n !== null) m.querySelector('#act-nota').value = n;
        };
      });
      const oi = m.querySelector('#act-otro-intento');
      if (oi) oi.onclick = async () => {
        if (!confirm('¿Darle un intento más a este alumno? Conserva su mejor nota.')) return;
        const { error } = await supabase.from('entregas_actividades').update({ intentos: Math.max(0, (Number(e.intentos) || 1) - 1) }).eq('id', e.id);
        if (error) return this.aviso('error', 'No se pudo', error.message);
        e.intentos = Math.max(0, (Number(e.intentos) || 1) - 1);
        this.toast('Se habilitó un intento más');
        this.verEntrega(claseId, dni);
      };
      m.querySelector('#act-guardar-nota').onclick = async () => {
        const nv = m.querySelector('#act-nota').value.trim();
        const com = m.querySelector('#act-coment').value.trim();
        if (nv !== '' && (isNaN(Number(nv)) || Number(nv) < 0 || Number(nv) > 100)) return this.aviso('warning', 'Nota no válida', 'Tiene que ser un número de 0 a 100.');
        const datos = { nota: nv === '' ? null : String(Math.round(Number(nv))), comentario_docente: com || null, cotejo: Object.keys(valores).length ? valores : null };
        if (await this.guardarCalificacion(clase, a.dni, e, datos)) {
          this.toast('Calificación guardada');
          this._docente = null;
          this.verRespuestas(claseId);
          if (window.ClasesModulo) ClasesModulo.cargarListaClases(false);
        }
      };
    } catch (err) {
      this.aviso('error', 'No se pudo abrir la entrega', err.message);
    }
  },

  async guardarCalificacion(clase, dni, entrega, datos, notificar = true) {
    try {
      let error;
      if (entrega) ({ error } = await supabase.from('entregas_actividades').update(datos).eq('id', entrega.id));
      else ({ error } = await supabase.from('entregas_actividades').insert([{ clase_id: Number(clase.id), estudiante_user: String(dni), ...datos }]));
      if (error) throw error;
      const cambio = !entrega || String(entrega.nota ?? '') !== String(datos.nota ?? '') || String(entrega.comentario_docente ?? '') !== String(datos.comentario_docente ?? '');
      if (notificar && cambio && datos.nota !== null) {
        const n = Number(datos.nota);
        await supabase.from('notificaciones').insert([{
          estudiante_user: String(dni), trayecto_id: Number(clase.trayecto_id), clase_id: Number(clase.id),
          titulo: `Novedad en ${clase.titulo}`,
          mensaje: `Tu actividad fue calificada con ${n} (${n >= 70 ? 'aprobada ✅' : 'no alcanza 70 ⚠️'}).${datos.comentario_docente ? ` Devolución: "${datos.comentario_docente}"` : ''}`
        }]);
      }
      return true;
    } catch (e) {
      this.aviso('error', 'No se pudo guardar la calificación', (e.message || '') + (/cotejo/.test(e.message || '') ? '\n\nFalta ejecutar sql/11_clases_y_actividades.sql en Supabase.' : ''));
      return false;
    }
  },

  /* ---------- Planilla de taller: todo el grupo en una tabla ---------- */
  async planillaTaller(claseId) {
    try {
      const d = await this.datosDocente(claseId);
      this._docente = d;
      const { clase } = d;
      const cs = (clase.contenido && clase.contenido.cotejo) || [];
      const alumnos = d.alumnos.filter(a => a.activo);
      const est = alumnos.map(a => ({ dni: a.dni, nombre: a.nombre, entrega: a.entrega, valores: Object.assign({}, (a.entrega && a.entrega.cotejo) || {}), nota: a.entrega && this.tieneNota(a.entrega) ? a.entrega.nota : '', com: (a.entrega && a.entrega.comentario_docente) || '', tocado: false }));
      const ciclo = [undefined, 1, 0.5, 0];
      const celda = (v) => { const n = this.NIVELES.find(x => v !== undefined && v !== null && Number(x.v) === Number(v)); return n ? `<span class="act-nivel ${n.cls}">${n.v === 1 ? '✔' : n.v === 0.5 ? '½' : '✕'}</span>` : '<span class="act-nivel vacio">·</span>'; };
      const h = `<p class="act-ayuda">Tocá cada casilla para marcar: ✔ Logrado · ½ Parcial · ✕ No logrado. ${cs.length ? 'La nota se calcula sola cuando están todos los criterios marcados (se puede cambiar a mano).' : 'Esta práctica no tiene lista de cotejo: cargá la nota directamente.'}</p>
        <div class="act-tabla-scroll"><table class="act-tabla act-planilla"><thead><tr><th>Estudiante</th>${cs.map((c, i) => `<th title="${this.esc(c.texto)}">${i + 1}. ${this.esc(c.texto.length > 28 ? c.texto.slice(0, 26) + '…' : c.texto)}</th>`).join('')}<th>Nota</th><th>Observación</th></tr></thead><tbody>
        ${est.map((a, i) => `<tr data-i="${i}"><td>${this.esc(a.nombre)}</td>${cs.map(c => `<td class="act-celda" data-c="${this.esc(c.id)}">${celda(a.valores[c.id])}</td>`).join('')}
          <td><input class="act-in act-num act-nota-fila" type="number" min="0" max="100" value="${this.esc(a.nota)}"></td>
          <td><input class="act-in act-com-fila" maxlength="300" value="${this.esc(a.com)}" placeholder="Opcional"></td></tr>`).join('')}
        </tbody></table></div>
        ${cs.length ? `<ol class="act-ref-criterios">${cs.map(c => `<li>${this.esc(c.texto)}${Number(c.peso) > 1 ? ` (peso ${c.peso})` : ''}</li>`).join('')}</ol>` : ''}`;
      const m = this.modal(`🛠️ ${this.esc(clase.titulo)} · Planilla de taller`, h, `<button type="button" class="act-btn-sec" onclick="Actividades.verRespuestas(${Number(clase.id)})">← Volver</button><button type="button" class="act-btn" id="act-guardar-planilla">💾 Guardar planilla</button>`, 1100);
      m.querySelectorAll('.act-celda').forEach(td => {
        td.onclick = () => {
          const a = est[Number(td.closest('tr').dataset.i)];
          const id = td.dataset.c;
          const pos = ciclo.findIndex(v => (v === undefined ? a.valores[id] === undefined || a.valores[id] === null : Number(a.valores[id]) === v));
          const nv = ciclo[(pos + 1) % ciclo.length];
          if (nv === undefined) delete a.valores[id]; else a.valores[id] = nv;
          td.innerHTML = celda(a.valores[id]);
          a.tocado = true;
          const n = Corrector.notaCotejo(cs, a.valores);
          if (n !== null) { a.nota = String(n); td.closest('tr').querySelector('.act-nota-fila').value = n; }
        };
      });
      m.querySelectorAll('.act-nota-fila').forEach(inp => { inp.oninput = () => { const a = est[Number(inp.closest('tr').dataset.i)]; a.nota = inp.value.trim(); a.tocado = true; }; });
      m.querySelectorAll('.act-com-fila').forEach(inp => { inp.oninput = () => { const a = est[Number(inp.closest('tr').dataset.i)]; a.com = inp.value.trim(); a.tocado = true; }; });
      m.querySelector('#act-guardar-planilla').onclick = async (ev) => {
        const malos = est.filter(a => a.nota !== '' && (isNaN(Number(a.nota)) || Number(a.nota) < 0 || Number(a.nota) > 100));
        if (malos.length) return this.aviso('warning', 'Hay notas no válidas', `Revisá: ${malos.map(a => a.nombre).join(', ')}`);
        const cambios = est.filter(a => a.tocado);
        if (!cambios.length) return this.toast('No hay cambios');
        ev.target.disabled = true; ev.target.textContent = 'Guardando…';
        let ok = 0;
        for (const a of cambios) {
          const datos = { nota: a.nota === '' ? null : String(Math.round(Number(a.nota))), comentario_docente: a.com || null, cotejo: Object.keys(a.valores).length ? a.valores : null };
          if (!a.entrega && datos.nota === null && !datos.cotejo && !datos.comentario_docente) continue;
          if (await this.guardarCalificacion(clase, a.dni, a.entrega, datos)) ok++;
          else break;
        }
        this.toast(`Planilla guardada (${ok} estudiante${ok === 1 ? '' : 's'})`);
        this._docente = null;
        if (window.ClasesModulo) ClasesModulo.cargarListaClases(false);
        this.planillaTaller(claseId);
      };
    } catch (e) {
      this.aviso('error', 'No se pudo abrir la planilla', e.message);
    }
  },

  /* ---------- Resultados de una encuesta ---------- */
  async resultadosEncuesta(claseId) {
    try {
      const d = await this.datosDocente(claseId);
      const { clase } = d;
      const c = clase.contenido || {};
      const resp = d.alumnos.filter(a => a.entrega && a.entrega.respuestas && a.entrega.respuestas.r).map(a => ({ nombre: a.nombre, r: a.entrega.respuestas.r }));
      const anon = !!c.anonima;
      let h = `<p class="act-ayuda">${resp.length} respuesta(s) de ${d.alumnos.filter(a => a.activo).length} estudiantes.</p>`;
      (c.preguntas || []).forEach((p, i) => {
        const vals = resp.filter(x => x.r[p.id] !== undefined && x.r[p.id] !== '');
        h += `<div class="act-caja"><h5>${i + 1}. ${this.esc(p.enunciado)}</h5>`;
        if (p.tipo === 'escala' || p.tipo === 'opcion') {
          const ops = p.tipo === 'escala' ? ['1', '2', '3', '4', '5'] : (p.opciones || []);
          const cuenta = ops.map(o => vals.filter(x => String(x.r[p.id]) === String(o)).length);
          const max = Math.max(1, ...cuenta);
          if (p.tipo === 'escala' && vals.length) h += `<p><strong>Promedio: ${(vals.reduce((s, x) => s + Number(x.r[p.id]), 0) / vals.length).toFixed(1).replace('.', ',')}</strong> sobre 5</p>`;
          h += `<div class="act-barras">${ops.map((o, j) => `<div class="act-barra-fila"><span>${this.esc(o)}</span><div class="act-barra"><div style="width:${(cuenta[j] / max) * 100}%"></div></div><span>${cuenta[j]}</span></div>`).join('')}</div>`;
        } else {
          h += vals.length ? `<ul class="act-textos">${vals.map(x => `<li>${this.esc(x.r[p.id])}${anon ? '' : ` <small>— ${this.esc(x.nombre)}</small>`}</li>`).join('')}</ul>` : '<p class="act-ayuda">Sin respuestas.</p>';
        }
        h += '</div>';
      });
      this.modal(`📊 ${this.esc(clase.titulo)} · Resultados`, h, `<button type="button" class="act-btn-sec" onclick="Actividades.verRespuestas(${Number(clase.id)})">← Volver</button><button type="button" class="act-btn" onclick="Actividades.cerrarModal()">Cerrar</button>`);
    } catch (e) {
      this.aviso('error', 'No se pudieron cargar los resultados', e.message);
    }
  },

  /* ---------- Vista de prueba (docente) ---------- */
  async probar(claseId) {
    const clase = (window.clasesGuardadasCache || []).find(c => Number(c.id) === Number(claseId));
    if (!clase) return;
    const { data } = await supabase.from('claves_actividad').select('clave').eq('clase_id', Number(claseId)).maybeSingle();
    const clave = (data && data.clave) || {};
    if (clase.tipo === 'diagnostico') this.abrirDiagnostico(clase, 'PRUEBA-' + this.miDni(), true, clave);
    else this.abrirCuestionario(clase, 'PRUEBA-' + this.miDni(), true, clave);
  },
  // Desde el editor, antes de publicar
  probarEditor(datosClase) {
    const err = this.validar(this.ed);
    if (err) return this.aviso('warning', 'Falta completar', err);
    const sep = this.separar(this.ed);
    const clase = { id: 0, ...datosClase, tipo: this.ed.tipo, contenido: sep.contenido };
    if (this.ed.tipo === 'diagnostico') this.abrirDiagnostico(clase, 'PRUEBA', true, sep.clave);
    else this.abrirCuestionario(clase, 'PRUEBA', true, sep.clave);
  },

  /* ---------- Banco de preguntas ---------- */
  async guardarEnBanco(q) {
    if (!q) return;
    const modulo = (window.ClasesModulo && ClasesModulo.nombreModuloElegido) ? ClasesModulo.nombreModuloElegido() : '';
    const enun = String(q.tipo === 'completar' ? q.texto : q.enunciado || '').trim();
    if (!enun) return this.aviso('warning', 'Pregunta vacía', 'Escribí el enunciado antes de guardarla en el banco.');
    const { error } = await supabase.from('banco_preguntas').insert([{
      modulo_nombre: modulo || null,
      trayecto_nombre: (window.ClasesModulo && ClasesModulo.nombreTrayectoActual) || null,
      tipo: q.tipo, enunciado: enun.slice(0, 300), pregunta: this.copia(q)
    }]);
    if (error) return this.aviso('error', 'No se pudo guardar en el banco', error.message + (/banco_preguntas/.test(error.message) ? '\n\nFalta ejecutar sql/11_clases_y_actividades.sql.' : ''));
    this.toast('Pregunta guardada en el banco');
  },

  async abrirBanco() {
    const { data, error } = await supabase.from('banco_preguntas').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) return this.aviso('error', 'No se pudo abrir el banco', error.message);
    const lista = data || [];
    const modActual = (window.ClasesModulo && ClasesModulo.nombreModuloElegido) ? ClasesModulo.nombreModuloElegido() : '';
    const modulos = [...new Set(lista.map(x => x.modulo_nombre).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const yo = this.miDni();
    const esAdmin = ['admin', 'administrador', 'regente'].includes(String(this.perfil().rol || '').toLowerCase());
    const cuerpo = `<div class="act-fila"><label>Módulo <select class="act-in" id="banco-mod"><option value="">Todos</option>${modulos.map(m => `<option ${m === modActual ? 'selected' : ''}>${this.esc(m)}</option>`).join('')}</select></label>
        <label class="act-crece">Buscar <input class="act-in" id="banco-buscar" placeholder="Palabra del enunciado"></label></div>
      <div id="banco-lista" class="act-banco"></div>`;
    const m = this.modal('📚 Banco de preguntas', cuerpo, '<button type="button" class="act-btn-sec" onclick="Actividades.cerrarModal()">Cancelar</button><button type="button" class="act-btn" id="banco-agregar">Agregar seleccionadas</button>', 900);
    const pintar = () => {
      const mod = m.querySelector('#banco-mod').value;
      const txt = Corrector.normalizar(m.querySelector('#banco-buscar').value);
      const vis = lista.filter(x => (!mod || x.modulo_nombre === mod) && (!txt || Corrector.normalizar(x.enunciado).includes(txt)));
      m.querySelector('#banco-lista').innerHTML = vis.length ? vis.map(x => `<label class="act-banco-item"><input type="checkbox" value="${Number(x.id)}">
          <span><strong>${(this.PREGUNTAS[x.tipo] || {}).ico || ''} ${this.esc(x.enunciado)}</strong><small>${this.esc((this.PREGUNTAS[x.tipo] || {}).nombre || x.tipo)}${x.modulo_nombre ? ' · ' + this.esc(x.modulo_nombre) : ''}${x.trayecto_nombre ? ' · ' + this.esc(x.trayecto_nombre) : ''}</small></span>
          ${esAdmin || String(x.creado_por) === yo ? `<button type="button" class="act-mini act-quitar" data-borrar="${Number(x.id)}" title="Borrar del banco">🗑</button>` : ''}</label>`).join('') : '<p class="act-ayuda">No hay preguntas con ese filtro. Guardá preguntas con el botón ⭐ de cada pregunta.</p>';
      m.querySelectorAll('[data-borrar]').forEach(b => {
        b.onclick = async (ev) => {
          ev.preventDefault();
          if (!confirm('¿Borrar esta pregunta del banco? (No se borra de los cuestionarios donde ya se usó)')) return;
          const { error: e2 } = await supabase.from('banco_preguntas').delete().eq('id', Number(b.dataset.borrar));
          if (e2) return this.aviso('error', 'No se pudo borrar', e2.message);
          const k = lista.findIndex(x => Number(x.id) === Number(b.dataset.borrar));
          if (k >= 0) lista.splice(k, 1);
          pintar();
        };
      });
    };
    m.querySelector('#banco-mod').onchange = pintar;
    m.querySelector('#banco-buscar').oninput = pintar;
    pintar();
    m.querySelector('#banco-agregar').onclick = () => {
      const ids = [...m.querySelectorAll('#banco-lista input:checked')].map(i => Number(i.value));
      if (!ids.length) return this.aviso('info', 'Elegí preguntas', 'Marcá las preguntas que querés agregar.');
      ids.forEach(id => {
        const x = lista.find(y => Number(y.id) === id);
        if (x && x.pregunta) { const q = this.copia(x.pregunta); q.id = this.uid('p'); this.ed.preguntas.push(q); }
      });
      this.cerrarModal();
      this.dibujarEditor();
      this.toast(`${ids.length} pregunta(s) agregada(s)`);
    };
  }
});
