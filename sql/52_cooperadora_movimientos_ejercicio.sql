-- =====================================================================================
-- PASO 52 — Los movimientos de la Cooperadora deben caer dentro de un ejercicio cargado
-- Cada ejercicio va del 01/05 de ciclo_desde al 30/04 de ciclo_hasta. No se puede registrar
-- (ni mover a otra fecha) un ingreso/egreso cuya fecha no pertenezca a ningún ejercicio.
-- Los movimientos ya existentes no se tocan.
-- =====================================================================================
create or replace function public.coop_validar_fecha_movimiento()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.fecha is not distinct from old.fecha then return new; end if;
  if not exists (
    select 1 from public.cooperadora_ejercicios e
     where new.fecha between make_date(e.ciclo_desde, 5, 1) and make_date(e.ciclo_hasta, 4, 30)
  ) then
    raise exception 'La fecha % no pertenece a ningún ejercicio cargado (cada ejercicio va del 01/05 al 30/04). Creá primero el ejercicio correspondiente en «Ejercicio / PIA».',
      to_char(new.fecha, 'DD/MM/YYYY');
  end if;
  return new;
end $$;

drop trigger if exists trg_coop_fecha_movimiento on public.cooperadora_movimientos;
create trigger trg_coop_fecha_movimiento before insert or update on public.cooperadora_movimientos
  for each row execute function public.coop_validar_fecha_movimiento();
