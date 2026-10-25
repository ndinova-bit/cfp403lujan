-- 31. Preceptoría también puede acreditar módulos por equivalencia (admin, regente y preceptor).
--     La fecha de inscripción (para la planilla de matrícula) ya la puede corregir el personal
--     (admin, regente, preceptor) vía inscripciones_update; esto solo habilita la pantalla.
drop policy if exists acreditados_insert on public.modulos_acreditados;
drop policy if exists acreditados_update on public.modulos_acreditados;
drop policy if exists acreditados_delete on public.modulos_acreditados;

create policy acreditados_insert on public.modulos_acreditados for insert to authenticated
  with check (public.es_admin() or public.es_preceptor());
create policy acreditados_update on public.modulos_acreditados for update to authenticated
  using (public.es_admin() or public.es_preceptor()) with check (public.es_admin() or public.es_preceptor());
create policy acreditados_delete on public.modulos_acreditados for delete to authenticated
  using (public.es_admin() or public.es_preceptor());
