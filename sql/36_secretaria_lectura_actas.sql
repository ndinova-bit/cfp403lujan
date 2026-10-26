-- 36. Secretaría: acceso de solo lectura (ver e imprimir/descargar el Excel oficial) a
--   Fichas de Curso / Actas de Examen. Se agrega es_secretaria() a las políticas de
--   SELECT de las tablas que alimentan el acta. La edición de notas, ajustes,
--   equivalencias y datos del acta sigue siendo solo de Director, Regente,
--   Preceptoría y el/la docente del trayecto (no se toca ninguna política de escritura).

drop policy if exists inscripciones_select on public.inscripciones;
create policy inscripciones_select on public.inscripciones for select to authenticated
  using (es_personal() or es_secretaria() or (estudiante_user = mi_dni()) or es_docente_de(trayecto_id));

drop policy if exists clases_select on public.clases;
create policy clases_select on public.clases for select to authenticated
  using (es_personal() or es_secretaria() or es_docente_de(trayecto_id) or (esta_inscripto(trayecto_id) and ((estudiante_user is null) or (estudiante_user = mi_dni())) and ((fecha_publicacion is null) or (fecha_publicacion <= hoy_ar()))));

drop policy if exists asistencias_select on public.asistencias;
create policy asistencias_select on public.asistencias for select to authenticated
  using (es_personal() or es_secretaria() or es_docente_de(trayecto_id) or (estudiante_user = mi_dni()));

drop policy if exists entregas_select on public.entregas_actividades;
create policy entregas_select on public.entregas_actividades for select to authenticated
  using (es_personal() or es_secretaria() or (estudiante_user = mi_dni()) or es_docente_de(trayecto_de_clase(clase_id)));

drop policy if exists excepciones_select on public.excepciones_estudiantes;
create policy excepciones_select on public.excepciones_estudiantes for select to authenticated
  using (es_personal() or es_secretaria() or es_docente_de(trayecto_id) or (estudiante_user = mi_dni()));

drop policy if exists acreditados_select on public.modulos_acreditados;
create policy acreditados_select on public.modulos_acreditados for select to authenticated
  using (es_personal() or es_secretaria() or es_docente_de(trayecto_id) or (estudiante_user = mi_dni()));

drop policy if exists actas_select on public.actas_examen;
create policy actas_select on public.actas_examen for select to authenticated
  using (es_admin() or es_secretaria() or es_docente_de(trayecto_id));
