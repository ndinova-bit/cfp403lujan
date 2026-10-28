-- =====================================================================================
-- PASO 50 — COOPERADORA: la secretaría solo ve el balance del mes y del año en curso
-- Hasta ahora la secretaría podía leer socios, movimientos, ejercicio y comisión. Ahora:
--   · Pierde la lectura directa de socios, movimientos y ejercicios (quedan para
--     administración, regencia y preceptoría).
--   · Ve el balance del mes y del año en curso a través de coop_balance_vigente(), que solo
--     devuelve totales por rubro (nada de socios, comprobantes ni descripciones).
--   · La lectura de la comisión (nómina de autoridades) no se toca.
-- =====================================================================================
drop policy if exists coop_socios_select on public.cooperadora_socios;
create policy coop_socios_select on public.cooperadora_socios for select to authenticated
  using (public.es_admin() or public.es_preceptor());
drop policy if exists coop_ejer_select on public.cooperadora_ejercicios;
create policy coop_ejer_select on public.cooperadora_ejercicios for select to authenticated
  using (public.es_admin() or public.es_preceptor());
drop policy if exists coop_mov_select on public.cooperadora_movimientos;
create policy coop_mov_select on public.cooperadora_movimientos for select to authenticated
  using (public.es_admin() or public.es_preceptor());

create or replace function public.coop_balance_vigente()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  hoy  date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  mes  text := to_char(hoy, 'YYYY-MM');
  anio text := to_char(hoy, 'YYYY');
begin
  if not (public.es_admin() or public.es_preceptor() or public.es_secretaria()) then
    raise exception 'No autorizado';
  end if;
  return jsonb_build_object(
    'mes', mes, 'anio', anio,
    'movs_mes', coalesce((select jsonb_agg(x) from (
        select tipo, seccion, rubro_codigo, rubro_nombre, sum(monto) as monto
          from public.cooperadora_movimientos where to_char(fecha, 'YYYY-MM') = mes
         group by tipo, seccion, rubro_codigo, rubro_nombre) x), '[]'::jsonb),
    'movs_anio', coalesce((select jsonb_agg(x) from (
        select tipo, seccion, rubro_codigo, rubro_nombre, sum(monto) as monto
          from public.cooperadora_movimientos where to_char(fecha, 'YYYY') = anio
         group by tipo, seccion, rubro_codigo, rubro_nombre) x), '[]'::jsonb)
  );
end $$;
revoke all on function public.coop_balance_vigente() from public, anon;
grant execute on function public.coop_balance_vigente() to authenticated;
