-- 37. Regente: puede publicar y administrar Novedades igual que Director (avisos
--   generales, institucionales y para la web pública), porque el Art. 37.49-50 de la
--   Res. 1984 la hace responsable de comunicar novedades y suscribir con el Director
--   las comunicaciones institucionales. Docentes y preceptores siguen limitados a
--   avisos internos (no públicos) de sus propios trayectos, sin cambios.

drop policy if exists novedades_insert on public.novedades;
create policy novedades_insert on public.novedades for insert to authenticated
  with check (es_admin_total() or es_regente() or ((trayecto_id is not null) and (publica = false) and (es_docente_de(trayecto_id) or es_preceptor())));

drop policy if exists novedades_update on public.novedades;
create policy novedades_update on public.novedades for update to authenticated
  using (es_admin_total() or es_regente() or ((creado_por = auth.uid()) and (es_docente() or es_preceptor())))
  with check (es_admin_total() or es_regente() or ((trayecto_id is not null) and (publica = false) and (es_docente_de(trayecto_id) or es_preceptor())));

drop policy if exists novedades_delete on public.novedades;
create policy novedades_delete on public.novedades for delete to authenticated
  using (es_admin_total() or es_regente() or ((creado_por = auth.uid()) and (es_docente() or es_preceptor())));

drop policy if exists novedades_select_auth on public.novedades;
create policy novedades_select_auth on public.novedades for select to authenticated
  using (es_admin_total() or es_regente() or (creado_por = auth.uid()) or (publicado and ((vence is null) or (vence >= ((now() at time zone 'America/Argentina/Buenos_Aires'))::date)) and ((trayecto_id is null) or puede_ver_trayecto(trayecto_id))));
