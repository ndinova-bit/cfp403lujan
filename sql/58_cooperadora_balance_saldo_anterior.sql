-- 58. Cooperadora: el balance de Secretaría incluye el saldo del ejercicio anterior.
-- Devuelve además:
--   saldo_inicial_anio: saldos iniciales cargados en el ejercicio (banco cta. cte. + plazo fijo + caja chica)
--   saldo_inicial_mes : saldo inicial + resultado (entradas - salidas) de los meses previos del ejercicio
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
  ini_mes date := date_trunc('month', hoy)::date;
  saldo_ini numeric := 0;
  previo    numeric := 0;
begin
  if not (public.es_admin() or public.es_preceptor() or public.es_secretaria()) then
    raise exception 'No autorizado';
  end if;

  select coalesce(saldo_inicial_banco_cc, 0) + coalesce(saldo_inicial_plazo_fijo, 0) + coalesce(saldo_inicial_caja_chica, 0)
    into saldo_ini
    from public.cooperadora_ejercicios where ciclo_desde = desde limit 1;
  saldo_ini := coalesce(saldo_ini, 0);

  select coalesce(sum(case when tipo = 'entrada' then monto else -monto end), 0)
    into previo
    from public.cooperadora_movimientos where fecha >= ini and fecha < ini_mes;

  return jsonb_build_object(
    'mes', mes, 'anio', desde::text || '/' || (desde + 1)::text,
    'saldo_inicial_anio', saldo_ini,
    'saldo_inicial_mes', saldo_ini + previo,
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
