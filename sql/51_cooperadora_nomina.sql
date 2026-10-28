-- =====================================================================================
-- PASO 51 — NÓMINA DE AUTORIDADES DE LA COMISIÓN DIRECTIVA (Cooperadora), por ejercicio
-- No tiene carga propia: sale de la Comisión Directiva y Revisora del ejercicio (Ejercicio / PIA,
-- cuadros 4 y 5), que va del 01/05 al 30/04. Se agregan domicilio y localidad a cada integrante
-- (los pide el formulario oficial). La nómina la ven y descargan todos los usuarios con sesión
-- mediante una función que devuelve solo estos campos; la carga sigue siendo de Director,
-- Regente y Preceptoría (políticas ya existentes de cooperadora_comision).
-- =====================================================================================
-- (Opcional, limpieza de un diseño anterior ya sin uso; las tablas están vacías:)
-- drop function if exists public.guardar_nomina_coop(jsonb, jsonb);
-- drop table if exists public.cooperadora_nomina;
-- drop table if exists public.cooperadora_nomina_datos;

alter table public.cooperadora_comision add column if not exists domicilio text;
alter table public.cooperadora_comision add column if not exists localidad text;

create or replace function public.nomina_cooperadora(p_ejercicio bigint default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ej public.cooperadora_ejercicios;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  select * into ej from public.cooperadora_ejercicios
   where id = coalesce(p_ejercicio, (select id from public.cooperadora_ejercicios order by ciclo_desde desc limit 1));
  return jsonb_build_object(
    'ejercicios', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ciclo_desde', ciclo_desde, 'ciclo_hasta', ciclo_hasta) order by ciclo_desde desc), '[]'::jsonb)
                     from public.cooperadora_ejercicios),
    'ejercicio', case when ej.id is null then null else jsonb_build_object(
        'id', ej.id, 'ciclo_desde', ej.ciclo_desde, 'ciclo_hasta', ej.ciclo_hasta,
        'distrito', ej.distrito, 'escuela_nombre', ej.escuela_nombre, 'escuela_nro', ej.escuela_nro) end,
    'filas', case when ej.id is null then '[]'::jsonb else
      (select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'cargo', cargo, 'apellido_nombre', apellido_nombre,
                'documento', documento, 'domicilio', domicilio, 'localidad', localidad, 'vencimiento', vencimiento, 'orden', orden)
                order by tipo, orden), '[]'::jsonb)
         from public.cooperadora_comision where ejercicio_id = ej.id and tipo in ('directiva', 'revisora')) end);
end $$;
revoke all on function public.nomina_cooperadora(bigint) from public, anon;
grant execute on function public.nomina_cooperadora(bigint) to authenticated;
