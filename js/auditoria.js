/* ==========================================================================
   AUDITORÍA DE CAMBIOS (solo administración)
   Archivo: js/auditoria.js
   Muestra quién cambió qué y cuándo, en frases legibles, con filtros por rol,
   por persona, por tipo de dato y por fechas. Los datos salen de la tabla
   `auditoria`, que llenan automáticamente disparadores de la base de datos.
   ========================================================================== */

const AuditoriaModulo = {
  POR_PAGINA: 300,
  ROLES: {
    admin: { txt: 'Administración', cls: 'adm' },
    administrador: { txt: 'Administración', cls: 'adm' },
    regente: { txt: 'Regencia', cls: 'adm' },
    secretaria: { txt: 'Secretaría', cls: 'pre' },
    preceptor: { txt: 'Preceptoría', cls: 'pre' },
    docente: { txt: 'Instructor/a', cls: 'doc' },
    estudiante: { txt: 'Estudiante', cls: 'est' },
    sistema: { txt: 'Sistema', cls: 'sis' }
  },
  FILTROS_ROL: [['', 'Todos'], ['admin', 'Administración'], ['regente', 'Regencia'], ['preceptor', 'Preceptoría'], ['secretaria', 'Secretaría'], ['docente', 'Instructores'], ['estudiante', 'Estudiantes'], ['sistema', 'Automático']],
  TABLAS: {
    entregas_actividades: 'Entregas y notas', asistencias: 'Asistencia', inscripciones: 'Inscripciones y bajas',
    profiles: 'Cuentas y roles', clases: 'Clases y actividades', trayectos: 'Trayectos', modulos: 'Módulos',
    modulos_acreditados: 'Equivalencias', actas_examen: 'Actas', certificados_emitidos: 'Certificados',
    observaciones_estudiante: 'Observaciones', datos_estudiante: 'Datos personales', novedades: 'Novedades',
    trayecto_docentes: 'Suplentes', excepciones_modulos: 'Excepciones'
  },
  CAMPOS: {
    nota: 'Nota', comentario_docente: 'Devolución', estado: 'Estado', rol: 'Rol', motivo_baja: 'Motivo de baja',
    fecha_baja: 'Fecha de baja', titulo: 'Título', descripcion: 'Descripción', url_recurso: 'Material', url_actividad: 'Consigna',
    url_entrega: 'Link entregado', fecha_publicacion: 'Se publica', fecha_limite: 'Fecha límite', modulo_id: 'Módulo',
    estudiante_user: 'Estudiante', docente_user: 'Instructor/a', nombre: 'Nombre', apellido: 'Apellido', ciclo_lectivo: 'Ciclo',
    resolucion: 'Resolución', certificacion: 'N.º de curso', horas: 'Horas', fecha_inicio: 'Inicio', fecha_fin: 'Fin',
    fecha_cierre: 'Cierre', sede: 'Sede', horario: 'Horario', tipo: 'Tipo', es_evaluacion: 'Evaluación', calificable: 'Con nota',
    intentos: 'Intentos', cotejo: 'Lista de cotejo', num_egresado: 'N.º de egresado', numero_egresado: 'N.º de egresado',
    fecha_examen: 'Fecha del examen', fecha_entrega: 'Fecha de entrega', ajustes: 'Correcciones del acta', motivo: 'Motivo',
    desde: 'Desde', hasta: 'Hasta', texto: 'Texto', visible_docente: 'Visible para el docente', fecha: 'Fecha',
    computa_asistencia: 'Computa asistencia', email: 'Email', dni: 'DNI'
  },
  OCULTOS: ['id', 'created_at', 'updated_at', 'actualizado', 'actualizado_por', 'creado_por', 'emitido_por', 'respuestas', 'contenido', 'trayecto_id', 'clase_id'],

  filtros: { rol: '', persona: '', tabla: '', desde: '', hasta: '' },
  filas: [],
  pagina: 0,
  personas: null,

  esc(t) { return (window.escHtml ? window.escHtml(t) : String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))); },
  rolDe(r) { return this.ROLES[String(r || 'sistema').toLowerCase()] || { txt: r, cls: 'sis' }; },
  fechaDMY(v) { return v ? String(v).slice(0, 10).split('-').reverse().join('/') : ''; },
  diaAR(ts) { return new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }); },
  horaAR(ts) { return new Date(ts).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' }); },

  /* ---------- Barra de filtros ---------- */
  async dibujarFiltros() {
    const cont = document.getElementById('auditoria-filtros');
    if (!cont) return;
    if (!this.personas) {
      const { data } = await supabase.from('profiles').select('dni, nombre, apellido, rol').in('rol', ['admin', 'administrador', 'regente', 'secretaria', 'preceptor', 'docente']).order('apellido', { ascending: true });
      this.personas = data || [];
    }
    const f = this.filtros;
    cont.innerHTML = `
      <div class="aud-chips" role="group" aria-label="Filtrar por rol">
        ${this.FILTROS_ROL.map(([v, t]) => `<button type="button" class="aud-chip ${f.rol === v ? 'sel' : ''} ${v ? 'r-' + this.rolDe(v).cls : ''}" onclick="AuditoriaModulo.filtrar({ rol: '${v}', persona: '' })">${t}</button>`).join('')}
      </div>
      <div class="aud-fila">
        <label>Persona
          <select class="form-control" onchange="AuditoriaModulo.filtrar({ persona: this.value })">
            <option value="">Todas</option>
            ${this.personas.filter(p => !f.rol || f.rol === 'sistema' || f.rol === 'estudiante' ? true : (f.rol === 'admin' ? ['admin', 'administrador'].includes(String(p.rol).toLowerCase()) : String(p.rol).toLowerCase() === f.rol))
              .map(p => `<option value="${this.esc(p.dni)}" ${f.persona === String(p.dni) ? 'selected' : ''}>${this.esc(String(p.apellido || '').toUpperCase())}, ${this.esc(p.nombre || '')} · ${this.esc(this.rolDe(p.rol).txt)}</option>`).join('')}
            ${f.persona && !this.personas.some(p => String(p.dni) === f.persona) ? `<option value="${this.esc(f.persona)}" selected>DNI ${this.esc(f.persona)}</option>` : ''}
          </select>
        </label>
        <label>Qué se cambió
          <select class="form-control" onchange="AuditoriaModulo.filtrar({ tabla: this.value })">
            <option value="">Todo</option>
            ${Object.entries(this.TABLAS).map(([k, v]) => `<option value="${k}" ${f.tabla === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </label>
        <label>Desde <input type="date" class="form-control" value="${this.esc(f.desde)}" onchange="AuditoriaModulo.filtrar({ desde: this.value })"></label>
        <label>Hasta <input type="date" class="form-control" value="${this.esc(f.hasta)}" onchange="AuditoriaModulo.filtrar({ hasta: this.value })"></label>
        <label>DNI <input class="form-control" inputmode="numeric" placeholder="De quien hizo el cambio" value="${this.esc(f.persona)}" onkeydown="if (event.key === 'Enter') AuditoriaModulo.filtrar({ persona: this.value.replace(/\\D/g, '') })"></label>
        ${Object.values(f).some(Boolean) ? '<button type="button" class="btn btn-outline aud-limpiar" onclick="AuditoriaModulo.filtrar(null)">Limpiar filtros</button>' : ''}
      </div>`;
  },

  filtrar(cambios) {
    this.filtros = cambios === null ? { rol: '', persona: '', tabla: '', desde: '', hasta: '' } : { ...this.filtros, ...cambios };
    this.cargar();
  },

  /* ---------- Carga ---------- */
  async cargar(mas = false) {
    const cont = document.getElementById('auditoria-contenido');
    if (!cont) return;
    if (!mas) { this.pagina = 0; this.filas = []; cont.innerHTML = '<p class="aud-vacio">Cargando…</p>'; }
    this.dibujarFiltros();
    const f = this.filtros;
    const desdeN = this.pagina * this.POR_PAGINA;
    let q = supabase.from('auditoria').select('*').order('fecha', { ascending: false }).range(desdeN, desdeN + this.POR_PAGINA - 1);
    if (f.rol === 'admin') q = q.in('usuario_rol', ['admin', 'administrador']);
    else if (f.rol === 'sistema') q = q.is('usuario_rol', null);
    else if (f.rol) q = q.eq('usuario_rol', f.rol);
    if (f.persona) q = q.eq('usuario_dni', f.persona);
    if (f.tabla) q = q.eq('tabla', f.tabla);
    if (f.desde) q = q.gte('fecha', `${f.desde}T00:00:00-03:00`);
    if (f.hasta) q = q.lte('fecha', `${f.hasta}T23:59:59-03:00`);
    const { data, error } = await q;
    if (error) {
      cont.innerHTML = `<p class="aud-vacio">No se pudo leer la auditoría: ${this.esc(error.message)}.</p>`;
      return;
    }
    this.hayMas = (data || []).length === this.POR_PAGINA;
    this.filas = this.filas.concat(data || []);
    this.pagina++;
    try { await this.enriquecer(this.filas); } catch (e) { console.warn('Auditoría: no se pudieron completar algunos nombres', e); }
    this.dibujar();
  },

  // Busca nombres de personas, trayectos, clases y módulos, y el estado actual de los registros editados
  async enriquecer(filas) {
    this.ctx = this.ctx || { personas: {}, trayectos: {}, clases: {}, modulos: {}, filas: {} };
    const c = this.ctx;
    const dnis = new Set(), tids = new Set(), cids = new Set(), mids = new Set();
    const porTabla = {};
    filas.forEach(a => {
      if (a.usuario_dni) dnis.add(String(a.usuario_dni));
      if (a.operacion === 'UPDATE' && a.registro_id && this.TABLAS[a.tabla] && a.tabla !== 'datos_estudiante') {
        (porTabla[a.tabla] = porTabla[a.tabla] || new Set()).add(a.registro_id);
      }
    });
    // Estado actual de los registros que fueron editados (los cambios solo guardan los campos modificados)
    await Promise.all(Object.entries(porTabla).map(async ([t, ids]) => {
      const faltan = [...ids].filter(id => !c.filas[`${t}#${id}`]);
      for (let i = 0; i < faltan.length; i += 150) {
        const { data } = await supabase.from(t).select('*').in('id', faltan.slice(i, i + 150));
        (data || []).forEach(r => { c.filas[`${t}#${r.id}`] = r; });
      }
    }));
    filas.forEach(a => {
      const r = this.registro(a);
      ['estudiante_user', 'docente_user', 'dni'].forEach(k => { if (r[k]) dnis.add(String(r[k])); });
      if (r.trayecto_id) tids.add(Number(r.trayecto_id));
      if (a.tabla === 'trayectos' && r.id) tids.add(Number(r.id));
      if (r.clase_id) cids.add(Number(r.clase_id));
      if (r.modulo_id) mids.add(Number(r.modulo_id));
    });
    const nuevos = (set, mapa) => [...set].filter(x => x && !(x in mapa));
    const [rU, rC, rM] = await Promise.all([
      nuevos(dnis, c.personas).length ? supabase.from('usuarios').select('usuario, nombre, apellido, rol').in('usuario', nuevos(dnis, c.personas)) : { data: [] },
      nuevos(cids, c.clases).length ? supabase.from('clases').select('id, titulo, trayecto_id').in('id', nuevos(cids, c.clases)) : { data: [] },
      nuevos(mids, c.modulos).length ? supabase.from('modulos').select('id, nombre, trayecto_id').in('id', nuevos(mids, c.modulos)) : { data: [] }
    ]);
    (rU.data || []).forEach(u => { c.personas[String(u.usuario)] = u; });
    (rC.data || []).forEach(x => { c.clases[x.id] = x; if (x.trayecto_id) tids.add(Number(x.trayecto_id)); });
    (rM.data || []).forEach(x => { c.modulos[x.id] = x; });
    const tf = nuevos(tids, c.trayectos);
    if (tf.length) {
      const { data } = await supabase.from('trayectos').select('id, nombre, ciclo_lectivo').in('id', tf);
      (data || []).forEach(t => { c.trayectos[t.id] = t; });
    }
  },

  registro(a) {
    const actual = (this.ctx && this.ctx.filas[`${a.tabla}#${a.registro_id}`]) || {};
    return { ...actual, ...(a.datos_anteriores || {}), ...(a.datos_nuevos || {}) };
  },

  /* ---------- Frases ---------- */
  persona(dni) {
    if (!dni) return 'un estudiante';
    const u = this.ctx && this.ctx.personas[String(dni)];
    return u ? `${String(u.apellido || '').toUpperCase()}, ${u.nombre || ''}`.trim() : `DNI ${dni}`;
  },
  tray(id) { const t = this.ctx && this.ctx.trayectos[Number(id)]; return t ? `${t.nombre}${t.ciclo_lectivo ? ' ' + t.ciclo_lectivo : ''}` : (id ? `trayecto #${id}` : 'un trayecto'); },
  clase(id) { const c = this.ctx && this.ctx.clases[Number(id)]; return c ? `«${c.titulo}»` : (id ? `la actividad #${id}` : 'una actividad'); },
  trayDeClase(id) { const c = this.ctx && this.ctx.clases[Number(id)]; return c ? this.tray(c.trayecto_id) : ''; },
  modulo(id) { const m = this.ctx && this.ctx.modulos[Number(id)]; return m ? `«${m.nombre}»` : (id ? `módulo #${id}` : ''); },
  b(t) { return `<b>${this.esc(t)}</b>`; },
  camposCambiados(a) {
    return Object.keys(a.datos_nuevos || {}).filter(k => !this.OCULTOS.includes(k)).map(k => this.CAMPOS[k] || k.replace(/_/g, ' '));
  },

  describir(a) {
    const r = this.registro(a), n = a.datos_nuevos || {}, o = a.datos_anteriores || {};
    const op = a.operacion, B = (t) => this.b(t);
    const campos = this.camposCambiados(a);
    const lista = campos.length ? ` (${this.esc(campos.join(', '))})` : '';
    switch (a.tabla) {
      case 'entregas_actividades': {
        const alu = B(this.persona(r.estudiante_user)), cl = B(this.clase(r.clase_id)), tr = this.trayDeClase(r.clase_id);
        const en = tr ? ` · ${this.esc(tr)}` : '';
        const conCotejo = n.cotejo ? ' con lista de cotejo' : '';
        if (!a.usuario_rol && 'nota' in n) return `🤖 Corrección automática: ${alu} obtuvo ${B(n.nota)} en ${cl}${en}`;
        if (op === 'DELETE') return `🗑️ borró la entrega de ${alu} en ${cl}${en}`;
        if (op === 'INSERT') {
          if (String(a.usuario_rol) === 'estudiante') return `📤 entregó ${cl}${en}`;
          if (n.nota !== null && n.nota !== undefined) return `✅ calificó con ${B(n.nota)} a ${alu} en ${cl}${conCotejo}${en}`;
          return `📝 cargó la entrega de ${alu} en ${cl}${en}`;
        }
        if ('nota' in n) {
          if (o.nota === null || o.nota === undefined || o.nota === '') return `✅ calificó con ${B(n.nota ?? '—')} a ${alu} en ${cl}${conCotejo}${en}`;
          return `✏️ cambió la nota de ${alu} en ${cl}: ${B(o.nota)} → ${B(n.nota ?? 'sin nota')}${en}`;
        }
        if ('intentos' in n && Number(n.intentos) < Number(o.intentos)) return `↻ le dio otro intento a ${alu} en ${cl}${en}`;
        if ('comentario_docente' in n) return `💬 escribió una devolución a ${alu} en ${cl}${en}`;
        if (String(a.usuario_rol) === 'estudiante') return `📤 actualizó su entrega de ${cl}${en}`;
        return `✏️ modificó la entrega de ${alu} en ${cl}${lista}${en}`;
      }
      case 'asistencias': {
        if (a._grupo) {
          const g = a._grupo;
          const PL = { presente: 'presentes', ausente: 'ausentes', justificado: 'justificados', tarde: 'tarde' };
          const det = Object.entries(g.estados).map(([k, v]) => `${v} ${v > 1 ? (PL[k] || k) : k}`).join(', ');
          return `📅 tomó asistencia del ${B(this.fechaDMY(g.fecha))} en ${B(this.tray(g.trayecto))}${g.modulo ? ' · ' + this.esc(this.modulo(g.modulo)) : ''}: ${g.cantidad} estudiantes (${this.esc(det)})`;
        }
        const alu = B(this.persona(r.estudiante_user)), dia = B(this.fechaDMY(r.fecha)), tr = this.esc(this.tray(r.trayecto_id));
        if (op === 'UPDATE' && 'estado' in n) return `✏️ cambió la asistencia de ${alu} del ${dia}: ${B(o.estado)} → ${B(n.estado)} · ${tr}`;
        if (op === 'DELETE') return `🗑️ borró la asistencia de ${alu} del ${dia} · ${tr}`;
        return `📅 registró ${B(r.estado || '')} a ${alu} el ${dia} · ${tr}`;
      }
      case 'inscripciones': {
        const alu = B(this.persona(r.estudiante_user)), tr = B(this.tray(r.trayecto_id));
        if (op === 'INSERT') return `➕ inscribió a ${alu} en ${tr}`;
        if (op === 'DELETE') return `🗑️ quitó la inscripción de ${alu} en ${tr}`;
        if (String(n.estado || '').toUpperCase() === 'BAJA') return `⛔ dio de baja a ${alu} en ${tr}${n.motivo_baja ? ' — ' + this.esc(n.motivo_baja) : ''}`;
        if ('estado' in n && String(o.estado || '').toUpperCase() === 'BAJA') return `↩️ reincorporó a ${alu} en ${tr}`;
        if ('numero_egresado' in n || 'num_egresado' in n) return `🎓 asignó el N.º de egresado ${B(n.numero_egresado ?? n.num_egresado ?? '—')} a ${alu} · ${tr}`;
        return `✏️ modificó la inscripción de ${alu} en ${tr}${lista}`;
      }
      case 'profiles': {
        const quien = B(r.apellido || r.nombre ? `${String(r.apellido || '').toUpperCase()}, ${r.nombre || ''}` : (r.dni ? this.persona(r.dni) : 'una cuenta que ya no existe'));
        if (op === 'INSERT') return `👤 se creó la cuenta de ${quien} (${this.esc(this.rolDe(r.rol).txt)})`;
        if (op === 'DELETE') return `🗑️ eliminó la cuenta de ${quien}`;
        if ('rol' in n) return `🔑 cambió el rol de ${quien}: ${B(this.rolDe(o.rol).txt)} → ${B(this.rolDe(n.rol).txt)}`;
        if ('estado' in n) return `🔑 cambió el estado de la cuenta de ${quien}: ${B(o.estado)} → ${B(n.estado)}`;
        return `✏️ modificó la cuenta de ${quien}${lista}`;
      }
      case 'clases': {
        const t = B(`«${r.titulo || 'sin título'}»`), tr = this.esc(this.tray(r.trayecto_id));
        if (op === 'INSERT') return `📚 publicó ${t} en ${tr}`;
        if (op === 'DELETE') return `🗑️ eliminó ${t} de ${tr}`;
        return `✏️ editó ${t} en ${tr}${lista}`;
      }
      case 'trayectos': {
        const t = B(r.nombre ? `${r.nombre}${r.ciclo_lectivo ? ' ' + r.ciclo_lectivo : ''}` : this.tray(a.registro_id));
        if (op === 'INSERT') return `🏫 creó el trayecto ${t}`;
        if (op === 'DELETE') return `🗑️ eliminó el trayecto ${t}`;
        if ('docente_user' in n) return `👩‍🏫 cambió el instructor titular de ${t}: ${B(this.persona(o.docente_user))} → ${B(this.persona(n.docente_user))}`;
        return `✏️ editó el trayecto ${t}${lista}`;
      }
      case 'modulos': {
        const m = B(`«${r.nombre || 'módulo'}»`), tr = this.esc(this.tray(r.trayecto_id));
        if (op === 'INSERT') return `➕ agregó el módulo ${m} a ${tr}`;
        if (op === 'DELETE') return `🗑️ quitó el módulo ${m} de ${tr}`;
        return `✏️ editó el módulo ${m} de ${tr}${lista}`;
      }
      case 'modulos_acreditados': {
        const alu = B(this.persona(r.estudiante_user)), m = B(this.modulo(r.modulo_id));
        if (op === 'DELETE') return `🗑️ quitó la equivalencia de ${m} a ${alu}`;
        return `🎓 acreditó por equivalencia ${m} a ${alu}${r.motivo ? ' — ' + this.esc(r.motivo) : ''}`;
      }
      case 'actas_examen': return `📋 ${op === 'INSERT' ? 'creó' : 'guardó cambios en'} el acta de ${B(this.tray(r.trayecto_id))}${lista}`;
      case 'certificados_emitidos': return `🎓 registró la emisión del certificado de ${B(this.persona(r.estudiante_user))}${r.num_egresado ? ' (N.º ' + this.esc(r.num_egresado) + ')' : ''} · ${this.esc(this.tray(r.trayecto_id))}`;
      case 'observaciones_estudiante': {
        const alu = B(this.persona(r.estudiante_user));
        if (op === 'DELETE') return `🗑️ borró una observación de ${alu}`;
        return `🗒️ ${op === 'INSERT' ? 'agregó' : 'editó'} una observación (${this.esc(String(r.tipo || 'general').replace('_', ' '))}) de ${alu}`;
      }
      case 'datos_estudiante': return `🪪 ${op === 'INSERT' ? 'cargó' : 'actualizó'} los datos personales de ${B(this.persona(r.dni))}${op === 'UPDATE' ? lista : ''}`;
      case 'novedades': {
        const t = B(`«${r.titulo || 'novedad'}»`);
        if (op === 'INSERT') return `📣 publicó la novedad ${t}`;
        if (op === 'DELETE') return `🗑️ borró la novedad ${t}`;
        return `✏️ editó la novedad ${t}${lista}`;
      }
      case 'trayecto_docentes': {
        const d = B(this.persona(r.docente_user)), tr = B(this.tray(r.trayecto_id));
        if (op === 'DELETE') return `👩‍🏫 quitó a ${d} como suplente de ${tr}`;
        if (op === 'INSERT') return `👩‍🏫 agregó a ${d} como suplente en ${tr}${r.hasta ? ' hasta el ' + this.fechaDMY(r.hasta) : ''}${r.motivo ? ' — ' + this.esc(r.motivo) : ''}`;
        return `✏️ cambió la suplencia de ${d} en ${tr}${lista}`;
      }
      default: {
        const nom = this.TABLAS[a.tabla] || a.tabla;
        return `${op === 'INSERT' ? '➕ agregó' : op === 'DELETE' ? '🗑️ borró' : '✏️ modificó'} un registro en ${this.esc(nom)}${lista}`;
      }
    }
  },

  // Las asistencias se guardan alumno por alumno: se agrupan en "tomó asistencia del día X"
  agrupar(filas) {
    const out = [];
    filas.forEach(a => {
      if (a.tabla === 'asistencias' && a.operacion !== 'DELETE') {
        const r = this.registro(a);
        const ant = out[out.length - 1];
        const clave = `${a.usuario_dni}|${r.trayecto_id}|${r.modulo_id || ''}|${r.fecha}|${a.operacion}`;
        if (ant && ant._clave === clave && Math.abs(new Date(ant.fecha) - new Date(a.fecha)) < 15 * 60000) {
          ant._grupo.cantidad++;
          const e = String(r.estado || '?');
          ant._grupo.estados[e] = (ant._grupo.estados[e] || 0) + 1;
          ant._miembros.push(a);
          return;
        }
        const g = { ...a, _clave: clave, _miembros: [a], _grupo: { cantidad: 1, fecha: r.fecha, trayecto: r.trayecto_id, modulo: r.modulo_id, estados: { [String(r.estado || '?')]: 1 } } };
        out.push(g);
        return;
      }
      out.push(a);
    });
    out.forEach(g => { if (g._grupo && g._grupo.cantidad === 1) delete g._grupo; });
    return out;
  },

  detalleHTML(a) {
    if (a._grupo) {
      return `<ul class="aud-det-lista">${a._miembros.map(m => { const r = this.registro(m); return `<li>${this.esc(this.persona(r.estudiante_user))}: <b>${this.esc(r.estado || '')}</b></li>`; }).join('')}</ul>`;
    }
    const n = a.datos_nuevos || {}, o = a.datos_anteriores || {};
    const claves = [...new Set([...Object.keys(o), ...Object.keys(n)])].filter(k => !this.OCULTOS.includes(k));
    if (!claves.length) return '<p class="aud-det-nada">Sin más detalle.</p>';
    const val = (v, k) => {
      if (v === null || v === undefined || v === '') return '<span class="aud-nulo">vacío</span>';
      if (k === 'modulo_id') return this.esc(this.modulo(v));
      if (k === 'estudiante_user' || k === 'docente_user') return this.esc(this.persona(v));
      if (k === 'rol') return this.esc(this.rolDe(v).txt);
      if (typeof v === 'boolean') return v ? 'Sí' : 'No';
      if (typeof v === 'object') { const s = JSON.stringify(v); return this.esc(s.length > 160 ? s.slice(0, 160) + '…' : s); }
      const s = String(v);
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return this.esc(s.length > 10 ? new Date(s).toLocaleString('es-AR') : this.fechaDMY(s));
      return this.esc(s.length > 200 ? s.slice(0, 200) + '…' : s);
    };
    return `<table class="aud-det"><thead><tr><th>Dato</th>${a.operacion !== 'INSERT' ? '<th>Antes</th>' : ''}${a.operacion !== 'DELETE' ? '<th>Después</th>' : ''}</tr></thead><tbody>
      ${claves.map(k => `<tr><td>${this.esc(this.CAMPOS[k] || k.replace(/_/g, ' '))}</td>${a.operacion !== 'INSERT' ? `<td class="ant">${val(o[k], k)}</td>` : ''}${a.operacion !== 'DELETE' ? `<td class="nue">${val(n[k], k)}</td>` : ''}</tr>`).join('')}
    </tbody></table>`;
  },

  /* ---------- Dibujo ---------- */
  dibujar() {
    const cont = document.getElementById('auditoria-contenido');
    if (!cont) return;
    if (!this.filas.length) {
      cont.innerHTML = '<p class="aud-vacio">No hay cambios registrados con estos filtros.</p>';
      return;
    }
    // Resumen por persona
    const cuenta = {};
    this.filas.forEach(a => {
      const k = a.usuario_dni || 'sistema';
      cuenta[k] = cuenta[k] || { dni: a.usuario_dni, rol: a.usuario_rol, n: 0, ultima: a.fecha };
      cuenta[k].n++;
    });
    const top = Object.values(cuenta).sort((x, y) => y.n - x.n).slice(0, 12);
    const nombreActor = (dni, rol) => dni && dni !== 'sistema' ? this.persona(dni) : (rol ? '—' : 'Sistema (automático)');
    const resumen = this.filtros.persona ? '' : `<div class="aud-resumen">${top.map(p => {
      const R = this.rolDe(p.rol);
      return `<button type="button" class="aud-persona" ${p.dni ? `onclick="AuditoriaModulo.filtrar({ persona: '${this.esc(p.dni)}' })"` : `onclick="AuditoriaModulo.filtrar({ rol: 'sistema' })"`}>
        <span class="aud-avatar r-${R.cls}">${this.esc(p.dni ? nombreActor(p.dni, p.rol).split(/,\s*|\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() : '⚙')}</span>
        <span class="aud-persona-txt"><strong>${this.esc(nombreActor(p.dni, p.rol))}</strong><small>${this.esc(R.txt)} · ${p.n} cambio${p.n === 1 ? '' : 's'}</small></span></button>`;
    }).join('')}</div>`;

    const items = this.agrupar(this.filas);
    const hoy = this.diaAR(Date.now()), ayer = this.diaAR(Date.now() - 86400000);
    let html = resumen, diaActual = '';
    items.forEach((a, i) => {
      const dia = this.diaAR(a.fecha);
      if (dia !== diaActual) {
        if (diaActual) html += '</ol>';
        diaActual = dia;
        const etiqueta = dia === hoy ? 'Hoy' : dia === ayer ? 'Ayer' : new Date(dia + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        html += `<h4 class="aud-dia">${this.esc(etiqueta)}</h4><ol class="aud-lista">`;
      }
      const R = this.rolDe(a.usuario_rol);
      let frase;
      try { frase = this.describir(a); } catch (e) { frase = this.esc(`${a.operacion} en ${this.TABLAS[a.tabla] || a.tabla}`); }
      html += `<li class="aud-item">
        <span class="aud-hora">${this.horaAR(a.fecha)}</span>
        <div class="aud-cuerpo">
          <div class="aud-quien"><span class="aud-rol r-${R.cls}">${this.esc(R.txt)}</span> <strong>${this.esc(nombreActor(a.usuario_dni, a.usuario_rol))}</strong></div>
          <div class="aud-frase">${frase}</div>
          <details class="aud-mas"><summary>Ver detalle</summary>${this.detalleHTML(a)}</details>
        </div></li>`;
    });
    html += '</ol>';
    html += this.hayMas ? '<div class="aud-pie"><button type="button" class="btn btn-outline" onclick="AuditoriaModulo.cargar(true)">Ver cambios anteriores</button></div>'
      : `<p class="aud-vacio">Son todos los cambios con estos filtros (${this.filas.length}).</p>`;
    cont.innerHTML = html;
  }
};

window.AuditoriaModulo = AuditoriaModulo;
