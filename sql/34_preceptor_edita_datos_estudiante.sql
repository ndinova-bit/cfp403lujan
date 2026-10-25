-- 34. La preceptoría puede corregir apellido, nombre y correo de un ESTUDIANTE (no de personal).
--     Los datos demográficos (datos_estudiante) ya los podía editar; esto solo habilita
--     apellido/nombre/correo, que viven en profiles.
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.es_admin_total() or (public.es_preceptor() and lower(rol::text) = 'estudiante'))
  with check (public.es_admin_total() or (public.es_preceptor() and lower(rol::text) = 'estudiante'));
