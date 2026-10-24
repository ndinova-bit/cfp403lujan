-- =====================================================================================
-- PASO 19 — BAJAS AUTOMÁTICAS GUARDADAS Y QUIÉN PUEDE REINCORPORAR
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir).
--   • baja_tipo: 'manual' o 'automatica' (las automáticas se registran con un botón en Seguimiento).
--   • reincorporado: si se reincorpora a alguien con baja automática, no vuelve a darse de baja solo.
--   • Solo administración, regencia y preceptoría pueden reincorporar (un docente no).
-- =====================================================================================
alter table public.inscripciones add column if not exists baja_tipo text;
alter table public.inscripciones add column if not exists reincorporado boolean not null default false;
alter table public.inscripciones drop constraint if exists inscripciones_baja_tipo_chk;
alter table public.inscripciones add constraint inscripciones_baja_tipo_chk check (baja_tipo is null or baja_tipo in ('manual', 'automatica'));
-- Las bajas que ya existen fueron cargadas a mano
update public.inscripciones set baja_tipo = 'manual' where upper(coalesce(estado, '')) = 'BAJA' and baja_tipo is null;

create or replace function public.controlar_reincorporacion()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if upper(coalesce(old.estado, '')) = 'BAJA' and upper(coalesce(new.estado, '')) <> 'BAJA'
     and auth.uid() is not null and not public.es_personal() then
    raise exception 'Solo administración, regencia o preceptoría pueden reincorporar a un estudiante';
  end if;
  return new;
end $fn$;
drop trigger if exists trg_controlar_reincorporacion on public.inscripciones;
create trigger trg_controlar_reincorporacion before update on public.inscripciones
  for each row execute function public.controlar_reincorporacion();

-- Verificación: debe devolver 3 filas
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'inscripciones' and column_name in ('baja_tipo', 'reincorporado')
union all
select tgname from pg_trigger where tgname = 'trg_controlar_reincorporacion';
