/* ==========================================================================
   REGLAS DE EVALUACIÓN · Formación Profesional (DGCyE) · CFP N.º 403
   Única fuente de verdad para notas, asistencia y aprobación. La usan:
   Mi progreso, Ficha del alumno, Seguimiento, Calificaciones, desbloqueo de
   módulos y Actas de examen.

   • Asistencia: "presente" y "tarde" cuentan como asistencia.
     "ausente" y "justificado" cuentan como ausencia.
   • Nota de un módulo = promedio entre el promedio de sus actividades y el
     % de asistencia, redondeado sin decimales.
     – Si el trayecto no computa asistencia (virtual) o no hay asistencia
       cargada, la nota es solo el promedio de actividades (nunca se promedia con 0).
     – Si no hay actividades calificadas pero sí asistencia, la nota es la asistencia.
   • Un módulo se aprueba con 70 o más, o si está acreditado por equivalencia.
   • El trayecto se aprueba cuando TODOS sus módulos están aprobados o acreditados.
   • Correlatividad: un módulo solo se califica si el anterior está aprobado o
     acreditado (o si el docente dio una habilitación excepcional). Si no, queda
     "bloqueado": no lleva nota aunque tenga asistencia o entregas cargadas.
   ========================================================================== */
const ReglasFP = {
  MINIMO: 70,

  esPresente(estado) {
    const e = String(estado || '').toLowerCase();
    return e === 'presente' || e === 'tarde';
  },

  // % de asistencia (0-100) o null si no hay registros
  porcentajeAsistencia(registros) {
    const r = registros || [];
    if (!r.length) return null;
    return (r.filter(a => this.esPresente(a.estado)).length / r.length) * 100;
  },

  promedioActividades(entregas) {
    const vals = (entregas || []).map(e => parseFloat(e.nota)).filter(v => !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  },

  // Combina actividades y asistencia según la regla de FP
  combinar(promAct, pctAsis, computaAsistencia = true) {
    const asis = computaAsistencia === false ? null : pctAsis;
    if (promAct !== null && asis !== null) return Math.round((promAct + asis) / 2);
    if (promAct !== null) return Math.round(promAct);
    if (asis !== null) return Math.round(asis);
    return null;
  },

  computaAsistencia(trayecto) {
    if (!trayecto) return true;
    return trayecto.computa_asistencia !== false;
  },

  /* Evalúa a un estudiante en un trayecto.
     datos = { key, modulos, clases, entregas, asistencias, acreditados, computaAsistencia, excepcion }
     – entregas/asistencias/acreditados pueden venir con datos de otros alumnos: se filtran por key. */
  evaluar(datos) {
    const key = String(datos.key);
    const computa = datos.computaAsistencia !== false;
    const clases = datos.clases || [];
    const entregas = (datos.entregas || []).filter(e => String(e.estudiante_user) === key);
    const asis = (datos.asistencias || []).filter(a => String(a.estudiante_user) === key);
    const acred = (datos.acreditados || []).filter(a => String(a.estudiante_user) === key);
    const modulos = (datos.modulos && datos.modulos.length) ? datos.modulos : [{ id: null, nombre: 'Trayecto completo' }];

    const res = modulos.map(m => {
      const idsC = clases.filter(c => m.id === null || Number(c.modulo_id) === Number(m.id)).map(c => Number(c.id));
      const ent = entregas.filter(e => idsC.includes(Number(e.clase_id)));
      const as = m.id === null ? asis : asis.filter(a => a.modulo_id === null || a.modulo_id === undefined || Number(a.modulo_id) === Number(m.id));
      const eq = m.id !== null ? acred.find(a => Number(a.modulo_id) === Number(m.id)) : null;
      const promAct = this.promedioActividades(ent);
      const pctAsis = this.porcentajeAsistencia(as);
      const nota = eq ? null : this.combinar(promAct, pctAsis, computa);
      return {
        id: m.id,
        nombre: m.nombre,
        nota,
        equivalencia: !!eq,
        motivoEquivalencia: eq ? (eq.motivo || '') : '',
        aprobado: !!eq || (nota !== null && nota >= this.MINIMO),
        promAct: promAct === null ? null : Math.round(promAct),
        pctAsis: (computa && pctAsis !== null) ? Math.round(pctAsis) : null,
        entregas: ent.length,
        pendientes: ent.filter(e => isNaN(parseFloat(e.nota))).length,
        sinDatos: !eq && nota === null
      };
    });

    // Correlatividad: si un módulo no está aprobado, los siguientes quedan bloqueados
    this.aplicarCorrelatividad(res, !!datos.excepcion);

    const notas = res.filter(r => r.nota !== null).map(r => r.nota);
    const promedio = notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
    const todosAprobados = res.length > 0 && res.every(r => r.aprobado);
    const habilitados = res.filter(r => !r.bloqueado);
    const sinNingunDato = habilitados.every(r => r.sinDatos);
    const pctTotal = computa ? this.porcentajeAsistencia(asis) : null;

    let resultado = 'EN CURSO';
    if (todosAprobados) resultado = 'APROBADO';
    else if (sinNingunDato) resultado = 'AUSENTE';
    else if (habilitados.every(r => !r.sinDatos)) resultado = 'DESAPROBADO';

    return {
      modulos: res,
      promedio,
      aprobado: todosAprobados,
      resultado,                       // APROBADO | DESAPROBADO | AUSENTE | EN CURSO
      asistencia: pctTotal === null ? null : Math.round(pctTotal),
      computaAsistencia: computa
    };
  },

  // Marca como bloqueados los módulos cuyo anterior no está aprobado (salvo equivalencia o excepción).
  // Guarda la nota que tendría en "notaSinCorrelativa" por si se corrige el módulo anterior.
  aplicarCorrelatividad(mods, excepcion = false) {
    let anteriorOk = true;
    mods.forEach((r, i) => {
      r.bloqueado = false;
      if (i > 0 && !anteriorOk && !excepcion && !r.equivalencia) {
        r.bloqueado = true;
        r.notaSinCorrelativa = r.nota;
        r.nota = null;
        r.aprobado = false;
        r.sinDatos = false;
      }
      anteriorOk = r.aprobado;
    });
    return mods;
  },

  // ¿El módulo en la posición idx está habilitado? (el anterior aprobado/acreditado, o excepción del docente)
  moduloHabilitado(evaluacion, idx, tieneExcepcion = false) {
    if (tieneExcepcion || idx <= 0) return true;
    const ant = evaluacion.modulos[idx - 1];
    return !!(ant && ant.aprobado);
  },

  /* Número en letras (0-100), en mayúsculas, como se escribe en las actas */
  enLetras(n) {
    const v = Math.round(Number(n));
    if (isNaN(v) || v < 0 || v > 100) return '';
    const U = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
      'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
      'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
    const D = { 3: 'TREINTA', 4: 'CUARENTA', 5: 'CINCUENTA', 6: 'SESENTA', 7: 'SETENTA', 8: 'OCHENTA', 9: 'NOVENTA' };
    if (v === 100) return 'CIEN';
    if (v < 30) return U[v];
    const d = Math.floor(v / 10), u = v % 10;
    return u === 0 ? D[d] : `${D[d]} Y ${U[u]}`;
  }
};
window.ReglasFP = ReglasFP;
