-- 30. Novedades: avisos generales y web pública solo para el Director (administrador).
--     Los docentes publican avisos internos solo en los trayectos que dictan; los preceptores, avisos internos en los trayectos.
--     Regencia y secretaría no publican (por ahora).
drop policy if exists novedades_select_auth on public.novedades;
drop policy if exists novedades_insert on public.novedades;
drop policy if exists novedades_update on public.novedades;
drop policy if exists novedades_delete on public.novedades;

create policy novedades_select_auth on public.novedades for select to authenticated
  using (
    public.es_admin_total() or creado_por = auth.uid()
    or (publicado
        and (vence is null or vence >= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
        and (trayecto_id is null or public.puede_ver_trayecto(trayecto_id)))
  );

create policy novedades_insert on public.novedades for insert to authenticated
  with check (public.es_admin_total()
    or (trayecto_id is not null and publica = false
        and (public.es_docente_de(trayecto_id) or public.es_preceptor())));

create policy novedades_update on public.novedades for update to authenticated
  using (public.es_admin_total() or (creado_por = auth.uid() and (public.es_docente() or public.es_preceptor())))
  with check (public.es_admin_total()
    or (trayecto_id is not null and publica = false
        and (public.es_docente_de(trayecto_id) or public.es_preceptor())));

create policy novedades_delete on public.novedades for delete to authenticated
  using (public.es_admin_total() or (creado_por = auth.uid() and (public.es_docente() or public.es_preceptor())));
