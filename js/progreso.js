/* Panel "Mi progreso" del estudiante.
   Regla: nota del módulo = promedio de (promedio de actividades, % de asistencia) si están ambos;
   aprobado >= 70; un módulo se habilita al aprobar el anterior (o con habilitación excepcional). */
const ProgresoModulo = {
  MINIMO: 70,

  esc(t) {
    return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  ICO: {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
    curso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    bloq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  },

  // La nota de cada módulo se calcula con ReglasFP (js/reglas.js)

  async cargar() {
    const cont = document.getElementById('progreso-contenido');
    if (!cont) return;
    const perfil = await Auth.obtenerPerfilSesion();
    if (!perfil) return;
    await this.cargarPara(String(perfil.usuario || perfil.dni || perfil.id), cont, { boton: true });
  },

  // Dibuja el progreso de un estudiante (por DNI) dentro de un contenedor.
  // Lo usan "Mi progreso" (el propio alumno) y la ficha del alumno (admin / docente).
  async cargarPara(key, cont, opciones = {}) {
    cont.innerHTML = '<p style="color:#5B6B82">Cargando progreso…</p>';
    try {
      const { data: insc } = await supabase.from('inscripciones').select('*').eq('estudiante_user', key);
      const ids = (insc || []).map(i => Number(i.trayecto_id));
      if (!ids.length) {
        cont.innerHTML = `<div class="prog-vacio">${opciones.boton ? 'Todavía no estás inscripto/a en ningún trayecto.' : 'No tiene inscripciones en trayectos.'}</div>`;
        return { entregas: [], clases: [] };
      }
      const [rT, rM, rC, rA, rX, rQ] = await Promise.all([
        supabase.from('trayectos').select('*').in('id', ids),
        supabase.from('modulos').select('*').in('trayecto_id', ids).order('id', { ascending: true }),
        ReglasFP.selectClases('id, titulo, modulo_id, trayecto_id', q => q.in('trayecto_id', ids)),
        supabase.from('asistencias').select('*').eq('estudiante_user', key),
        supabase.from('excepciones_estudiantes').select('*').eq('estudiante_user', key).eq('habilitado', true),
        supabase.from('modulos_acreditados').select('*').eq('estudiante_user', key)
      ]);
      const acreditados = (rQ && !rQ.error && rQ.data) || [];
      const clases = rC.data || [];
      const claseIds = clases.map(c => c.id);
      let entregas = [];
      if (claseIds.length) {
        const { data } = await supabase.from('entregas_actividades').select('*').eq('estudiante_user', key).in('clase_id', claseIds);
        entregas = data || [];
      }
      const asis = rA.data || [];
      const exc = rX.data || [];

      cont.innerHTML = '<div class="prog-wrap">' + (rT.data || []).map(t => {
        const ins = (insc || []).find(i => Number(i.trayecto_id) === Number(t.id));
        return this.tarjeta(t, (rM.data || []).filter(m => Number(m.trayecto_id) === Number(t.id)), clases, entregas, asis, exc, { ...opciones, key, acreditados }, ins);
      }).join('') + '</div>';
      return { entregas, clases, trayectos: rT.data || [] };
    } catch (e) {
      console.error('Progreso:', e);
      cont.innerHTML = '<div class="prog-vacio">No se pudo cargar el progreso. Probá recargar la página.</div>';
      return { entregas: [], clases: [] };
    }
  },

  tarjeta(t, modulos, clases, entregas, asis, exc, opciones = { boton: true }, ins = null) {
    const tid = Number(t.id);
    const vos = !!opciones.boton;   // true = lo ve el propio alumno
    const habExc = exc.some(x => Number(x.trayecto_id) === tid);
    const ev = ReglasFP.evaluar({
      key: opciones.key,
      modulos,
      clases: clases.filter(c => Number(c.trayecto_id) === tid),
      entregas,
      asistencias: asis.filter(a => Number(a.trayecto_id) === tid),
      acreditados: (opciones.acreditados || []).filter(a => Number(a.trayecto_id) === tid),
      computaAsistencia: ReglasFP.computaAsistencia(t),
      excepcion: habExc
    });

    let filas = '';
    ev.modulos.forEach((m, i) => {
      const titulo = `Módulo ${i + 1} · ${this.esc(m.nombre || 'Contenidos generales')}`;
      if (m.bloqueado) {
        filas += `<div class="prog-mod bloq"><span class="prog-mod-ico bloq">${this.ICO.bloq}</span><div class="prog-mod-info"><strong style="color:#5B6B82">${titulo}</strong><span>Se habilita al aprobar el módulo anterior (mínimo ${this.MINIMO})</span></div></div>`;
        return;
      }
      if (m.equivalencia) {
        filas += `<div class="prog-mod"><span class="prog-mod-ico ok">${this.ICO.ok}</span><div class="prog-mod-info"><strong>${titulo}</strong><span>Acreditado por equivalencia${m.motivoEquivalencia ? ' · ' + this.esc(m.motivoEquivalencia) : ''}</span></div><span class="prog-mod-nota ok">EQ</span></div>`;
        return;
      }
      const estado = m.aprobado ? 'ok' : 'curso';
      const partes = [];
      if (m.promAct !== null) partes.push(`actividades ${m.promAct}`);
      if (m.pctAsis !== null) partes.push(`asistencia ${m.pctAsis}%`);
      const detalle = m.aprobado ? 'Aprobado' : (m.nota === null ? 'Sin calificaciones todavía' : `En curso · ${vos ? 'necesitás' : 'se necesita'} ${this.MINIMO} o más`);
      const clsNota = m.aprobado ? 'ok' : (m.nota !== null ? 'bad' : 'curso');
      filas += `<div class="prog-mod ${estado === 'curso' ? 'curso' : ''}"><span class="prog-mod-ico ${estado}">${this.ICO[estado]}</span><div class="prog-mod-info"><strong>${titulo}</strong><span>${detalle}${partes.length ? ' · ' + partes.join(' · ') : ''} · ${m.entregas} entrega(s)${m.pendientes ? `, ${m.pendientes} sin corregir` : ''}${m.sinEntregar ? `, ${m.sinEntregar} vencida(s) sin entregar (cuentan 10)` : ''}</span></div>${m.nota !== null ? `<span class="prog-mod-nota ${clsNota}">${m.nota}</span>` : ''}</div>`;
    });

    const prom = ev.promedio;
    const total = ev.modulos.length;
    const aprobados = ev.modulos.filter(m => m.aprobado).length;
    const grados = prom === null ? 0 : Math.min(100, prom);
    let chip = '<span class="prog-estado none">Sin datos aún</span>';
    if (ev.aprobado) chip = `<span class="prog-estado ok">${vos ? '¡Trayecto aprobado!' : 'Trayecto aprobado'}</span>`;
    else if (prom !== null) chip = prom >= this.MINIMO
      ? `<span class="prog-estado ok">${vos ? 'Vas en camino' : 'En camino'}</span>`
      : (prom >= this.MINIMO - 10 ? `<span class="prog-estado mid">${vos ? 'Casi llegás' : 'Cerca del mínimo'}</span>` : `<span class="prog-estado bad">${vos ? 'Necesitás recuperar' : 'Debajo del mínimo'}</span>`);
    const color = prom === null ? '#E3EBF5' : (prom >= this.MINIMO ? '#1E9E6A' : (prom >= this.MINIMO - 10 ? '#F6B81A' : '#D64545'));
    const pctAs = ev.asistencia;

    return `
    <section class="prog-trayecto">
      <div class="prog-top">
        <div class="prog-top-info">
          <span class="prog-chip">${this.esc(t.modalidad || (ev.computaAsistencia ? 'Trayecto formativo' : 'Trayecto virtual'))}</span>
          <h2 class="prog-title">${this.esc(t.nombre)}</h2>
          ${(() => { const c = ReglasFP.estadoCursada(ev, modulos, ins, { excepcion: habExc }); return c.baja ? `<div class="prog-baja">${c.tipo === 'automatica' ? 'Baja automática' : 'Baja'}${c.fecha ? ' · ' + this.esc(String(c.fecha).split('-').reverse().join('/')) : ''}: ${this.esc(c.motivo)}</div>` : ''; })()}
          <p class="prog-sub">Para certificar ${vos ? 'necesitás' : 'se necesita'} aprobar <strong>todos los módulos con ${this.MINIMO} o más</strong>. ${total > 1 ? `Aprobados: <strong>${aprobados} de ${total}</strong>.` : ''}</p>
          <div class="prog-bar"><div class="prog-bar-fill" style="width:${grados}%"></div><div class="prog-bar-mark"></div></div>
          <div class="prog-bar-legend"><span>0</span><span>Mínimo para aprobar: ${this.MINIMO}</span><span>100</span></div>
        </div>
        <div class="prog-ring">
          <div class="prog-ring-circle" style="background:conic-gradient(${color} 0 ${grados}%, #E3EBF5 ${grados}% 100%)">
            <div class="prog-ring-inner"><strong>${prom === null ? '–' : prom}</strong><span>promedio</span></div>
          </div>
          ${chip}
        </div>
      </div>
      <div class="prog-cols">
        <div class="prog-mods"><h3>Módulos</h3>${filas}</div>
        <div class="prog-side">
          <div class="prog-side-card">
            <h3>Asistencia</h3>
            ${ev.computaAsistencia
              ? `<div class="prog-asis-num">${pctAs === null ? '–' : pctAs + '%'} <small>de las clases</small></div>
                 <div class="prog-mini"><div style="width:${pctAs || 0}%"></div></div>`
              : '<p class="prog-sub" style="margin:0">Este trayecto no computa asistencia: la nota sale de las actividades.</p>'}
          </div>
          ${ins && ins.num_egresado ? `<div class="prog-side-card prog-egresado"><h3>Egresado/a</h3><div>N° de egresado: <strong>${this.esc(ins.num_egresado)}</strong></div></div>` : ''}
          ${vos ? `<button class="prog-open" onclick="UI.showTab('trayectos')">Ir a mis clases y actividades</button>` : ''}
        </div>
      </div>
    </section>`;
  }
};
window.ProgresoModulo = ProgresoModulo;
