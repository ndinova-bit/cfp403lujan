-- PASO 17 — Los módulos se ven igual que su trayecto:
-- los visitantes solo ven los del ciclo vigente; quien está inscripto, dicta o es personal ve los demás.
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir).
drop policy if exists modulos_select on public.modulos;
create policy modulos_select on public.modulos for select to anon, authenticated
  using (exists (select 1 from public.trayectos t where t.id = modulos.trayecto_id));

-- Verificación: debe devolver 1 fila
select policyname, qual from pg_policies where schemaname = 'public' and tablename = 'modulos' and policyname = 'modulos_select';
