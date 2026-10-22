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

  // Combina actividades y asistencia en una nota 0-100 (o null si no hay datos)
  nota(entregas, asist) {
    const vals = entregas.map(e => parseFloat(e.nota)).filter(v => !isNaN(v));
    const prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const pct = asist.length ? (asist.filter(a => a.estado === 'presente').length / asist.length) * 100 : null;
    if (prom !== null && pct !== null) return Math.round((prom + pct) / 2);
    if (prom !== null) return Math.round(prom);
    if (pct !== null) return Math.round(pct);
    return null;
  },

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
      const { data: insc } = await supabase.from('inscripciones').select('trayecto_id, num_egresado').eq('estudiante_user', key);
      const ids = (insc || []).map(i => Number(i.trayecto_id));
      if (!ids.length) {
        cont.innerHTML = `<div class="prog-vacio">${opciones.boton ? 'Todavía no estás inscripto/a en ningún trayecto.' : 'No tiene inscripciones en trayectos.'}</div>`;
        return { entregas: [], clases: [] };
      }
      const [rT, rM, rC, rA, rX] = await Promise.all([
        supabase.from('trayectos').select('*').in('id', ids),
        supabase.from('modulos').select('*').in('trayecto_id', ids).order('id', { ascending: true }),
        supabase.from('clases').select('id, titulo, modulo_id, trayecto_id').in('trayecto_id', ids),
        supabase.from('asistencias').select('*').eq('estudiante_user', key),
        supabase.from('excepciones_estudiantes').select('*').eq('estudiante_user', key).eq('habilitado', true)
      ]);
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
        return this.tarjeta(t, (rM.data || []).filter(m => Number(m.trayecto_id) === Number(t.id)), clases, entregas, asis, exc, opciones, ins);
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
    const asT = asis.filter(a => Number(a.trayecto_id) === tid);
    const habExc = exc.some(x => Number(x.trayecto_id) === tid);
    let aprobadoAnterior = true;
    let enCursoMarcado = false;
    const notas = [];
    let filas = '';

    const lista = modulos.length ? modulos : [{ id: null, nombre: 'Contenidos generales' }];
    lista.forEach((m, i) => {
      const cids = clases.filter(c => m.id === null ? true : Number(c.modulo_id) === Number(m.id)).map(c => Number(c.id));
      const ent = entregas.filter(e => cids.includes(Number(e.clase_id)));
      const as = m.id === null ? asT : asT.filter(a => Number(a.modulo_id) === Number(m.id) || a.modulo_id === null);
      const nota = this.nota(ent, as);
      const titulo = `Módulo ${i + 1} · ${this.esc(m.nombre || '')}`;
      const bloqueado = i > 0 && !aprobadoAnterior && !habExc;

      if (bloqueado) {
        filas += `<div class="prog-mod bloq"><span class="prog-mod-ico bloq">${this.ICO.bloq}</span><div class="prog-mod-info"><strong style="color:#5B6B82">${titulo}</strong><span>Se habilita al aprobar el módulo anterior (mínimo ${this.MINIMO})</span></div></div>`;
        return;
      }
      if (nota !== null) notas.push(nota);
      const aprobado = nota !== null && nota >= this.MINIMO;
      let estado = 'curso';
      if (aprobado) estado = 'ok';
      else if (enCursoMarcado) estado = 'curso';
      if (!aprobado) enCursoMarcado = true;
      const detalle = aprobado ? 'Aprobado' : (nota === null ? 'Sin calificaciones todavía' : `En curso · ${opciones.boton ? 'necesitás' : 'se necesita'} ${this.MINIMO} o más`);
      const clsNota = aprobado ? 'ok' : (nota !== null && nota < this.MINIMO ? 'bad' : 'curso');
      filas += `<div class="prog-mod ${estado === 'curso' ? 'curso' : ''}"><span class="prog-mod-ico ${estado}">${this.ICO[estado]}</span><div class="prog-mod-info"><strong>${titulo}</strong><span>${detalle} · ${ent.length} actividad(es) entregada(s)</span></div>${nota !== null ? `<span class="prog-mod-nota ${clsNota}">${nota}</span>` : ''}</div>`;
      aprobadoAnterior = aprobado;
    });

    const prom = notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
    const pctAs = asT.length ? Math.round(asT.filter(a => a.estado === 'presente').length / asT.length * 100) : null;
    const grados = prom === null ? 0 : Math.min(100, prom);
    let chip = '<span class="prog-estado none">Sin datos aún</span>';
    if (prom !== null) chip = prom >= this.MINIMO
      ? (opciones.boton ? '<span class="prog-estado ok">Vas en camino</span>' : '<span class="prog-estado ok">En condiciones</span>')
      : (prom >= this.MINIMO - 10 ? (opciones.boton ? '<span class="prog-estado mid">Casi llegás</span>' : '<span class="prog-estado mid">Cerca del mínimo</span>') : (opciones.boton ? '<span class="prog-estado bad">Necesitás recuperar</span>' : '<span class="prog-estado bad">Debajo del mínimo</span>'));
    const color = prom === null ? '#E3EBF5' : (prom >= this.MINIMO ? '#1E9E6A' : (prom >= this.MINIMO - 10 ? '#F6B81A' : '#D64545'));

    return `
    <section class="prog-trayecto">
      <div class="prog-top">
        <div class="prog-top-info">
          <span class="prog-chip">${this.esc(t.modalidad || 'Trayecto formativo')}</span>
          <h2 class="prog-title">${this.esc(t.nombre)}</h2>
          <p class="prog-sub">Para certificar ${opciones.boton ? 'necesitás' : 'se necesita'} un promedio de <strong>${this.MINIMO} o más</strong>.</p>
          <div class="prog-bar"><div class="prog-bar-fill" style="width:${grados}%"></div><div class="prog-bar-mark"></div></div>
          <div class="prog-bar-legend"><span>0</span><span>Mínimo para certificar: ${this.MINIMO}</span><span>100</span></div>
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
            <div class="prog-asis-num">${pctAs === null ? '–' : pctAs + '%'} <small>de las clases</small></div>
            <div class="prog-mini"><div style="width:${pctAs || 0}%"></div></div>
          </div>
          ${ins && ins.num_egresado ? `<div class="prog-side-card prog-egresado"><h3>Egresado/a</h3><div>N° de egresado: <strong>${this.esc(ins.num_egresado)}</strong></div></div>` : ''}
          ${opciones.boton ? `<button class="prog-open" onclick="UI.showTab('trayectos')">Ir a mis clases y actividades</button>` : ''}
        </div>
      </div>
    </section>`;
  }
};
window.ProgresoModulo = ProgresoModulo;
