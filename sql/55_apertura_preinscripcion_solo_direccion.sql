-- =====================================================================================
-- PASO 55 — APERTURA DE LA PREINSCRIPCIÓN: SOLO DIRECTOR Y REGENTE
-- Antes, preceptores también podían cambiar ciclo lectivo y estado (abierta/cerrada).
-- Ahora solo pueden hacerlo el administrador y el regente (es_admin() = admin o regente).
-- La lectura queda como estaba (es_personal), así que el resto del personal sigue viendo
-- la configuración vigente pero no puede modificarla.
-- =====================================================================================

drop policy if exists inscripcion_config_update on public.inscripcion_config;
create policy inscripcion_config_update on public.inscripcion_config
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());
