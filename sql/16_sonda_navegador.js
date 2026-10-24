/* Prueba de seguridad desde el navegador. NO modifica datos reales.
   Uso: abrir la plataforma, apretar F12 → pestaña "Consola", pegar todo y Enter.
   1) Probala SIN iniciar sesión (pantalla de login).  2) Probala con una cuenta de ESTUDIANTE.
   Resultado esperado: sin sesión, todo "0 filas"/bloqueado; como estudiante, solo ve lo suyo. */
(async () => {
  const sb = window.supabaseClient || window.supabase;
  const { data: { session } } = await sb.auth.getSession();
  console.log(session ? 'Con sesión: ' + session.user.email : 'SIN sesión (visitante)');
  const tablas = ['profiles','padron_estudiantes','datos_estudiante','inscripciones','trayectos','modulos','clases',
    'asistencias','actas_examen','modulos_acreditados','certificados_emitidos','auditoria','novedades','notificaciones',
    'observaciones_estudiante','excepciones_estudiantes','entregas_actividades','claves_actividad','banco_preguntas','trayecto_docentes'];
  const filas = [];
  for (const t of tablas) {
    const r = await sb.from(t).select('*', { count: 'exact' }).limit(1);
    filas.push({ tabla: t, 'puede leer (filas)': r.error ? 'bloqueado' : r.count });
  }
  console.table(filas);
  // Intentos de escritura con datos inexistentes (si algo se escribe, es una grieta)
  const esc = [];
  const prueba = async (nombre, p) => { const r = await p; esc.push({ intento: nombre, resultado: r.error ? 'bloqueado ✔' : (r.data && r.data.length ? '¡SE MODIFICÓ! ✖' : 'sin efecto (0 filas)') }); };
  await prueba('cambiarme el rol a admin', sb.from('profiles').update({ rol: 'admin' }).eq('dni', '00000000').select());
  await prueba('modificar notas/acreditaciones', sb.from('modulos_acreditados').update({ nota: 10 }).eq('id', -1).select());
  await prueba('borrar inscripciones', sb.from('inscripciones').delete().eq('id', -1).select());
  await prueba('borrar auditoría', sb.from('auditoria').delete().eq('id', -1).select());
  await prueba('crear novedad', sb.from('novedades').insert({ titulo: 'PRUEBA', trayecto_id: -1 }).select());
  await prueba('cargar asistencia', sb.from('asistencias').insert({ trayecto_id: -1, estudiante_user: '00000000', fecha: '2000-01-01', estado: 'P' }).select());
  for (const f of ['admin_restablecer_clave','uso_base','resumen_respuestas','archivar_respuestas','panel_cifras','planilla_matricula','alertas_inasistencias']) {
    const r = await sb.rpc(f, f === 'admin_restablecer_clave' ? { p_dni: '00000000', p_clave: 'x' } : {});
    esc.push({ intento: 'función ' + f, resultado: r.error ? 'bloqueado ✔ (' + (r.error.message || '').slice(0, 40) + ')' : 'respondió ⚠ (revisar si corresponde a este rol)' });
  }
  console.table(esc);
})();
