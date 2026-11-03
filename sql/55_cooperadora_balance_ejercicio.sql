-- 55. Cooperadora: el "balance anual" de Secretaría pasa a ser el del ejercicio en curso
-- (01/05 al 30/04), no el año calendario. 'anio' devuelve p. ej. '2026/2027'.
create or replace function public.coop_balance_vigente()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  hoy   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  mes   text := to_char(hoy, 'YYYY-MM');
  desde int  := case when extract(month from hoy) >= 5 then extract(year from hoy)::int else extract(year from hoy)::int - 1 end;
  ini   date := make_date(desde, 5, 1);
  fin   date := make_date(desde + 1, 4, 30);
begin
  if not (public.es_admin() or public.es_preceptor() or public.es_secretaria()) then
    raise exception 'No autorizado';
  end if;
  return jsonb_build_object(
    'mes', mes, 'anio', desde::text || '/' || (desde + 1)::text,
    'movs_mes', coalesce((select jsonb_agg(x) from (
        select tipo, seccion, rubro_codigo, rubro_nombre, sum(monto) as monto
          from public.cooperadora_movimientos where to_char(fecha, 'YYYY-MM') = mes
         group by tipo, seccion, rubro_codigo, rubro_nombre) x), '[]'::jsonb),
    'movs_anio', coalesce((select jsonb_agg(x) from (
        select tipo, seccion, rubro_codigo, rubro_nombre, sum(monto) as monto
          from public.cooperadora_movimientos where fecha between ini and fin
         group by tipo, seccion, rubro_codigo, rubro_nombre) x), '[]'::jsonb)
  );
end $function$;
