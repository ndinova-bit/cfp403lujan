-- 53. Cooperadora: número de socio correlativo + domicilio.
--   · numero_socio: único; si se da de alta sin número, se asigna solo el siguiente al mayor existente.
--   · domicilio: dato de la planilla de socios.
-- Es seguro ejecutarlo más de una vez.

alter table public.cooperadora_socios add column if not exists numero_socio integer;
alter table public.cooperadora_socios add column if not exists domicilio text;

create unique index if not exists cooperadora_socios_numero_uq
  on public.cooperadora_socios (numero_socio) where numero_socio is not null;

create or replace function public.coop_socio_numero_auto()
returns trigger language plpgsql as $$
begin
  if new.numero_socio is null then
    -- bloqueo para que dos altas simultáneas no tomen el mismo número
    perform pg_advisory_xact_lock(53001);
    select coalesce(max(numero_socio), 0) + 1 into new.numero_socio from public.cooperadora_socios;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_coop_socio_numero on public.cooperadora_socios;
create trigger trg_coop_socio_numero before insert on public.cooperadora_socios
  for each row execute function public.coop_socio_numero_auto();

-- Socios que ya existían sin número: se numeran a continuación del mayor, en orden de alta.
do $$
declare r record;
begin
  for r in select id from public.cooperadora_socios where numero_socio is null order by id loop
    update public.cooperadora_socios
       set numero_socio = (select coalesce(max(numero_socio), 0) + 1 from public.cooperadora_socios)
     where id = r.id;
  end loop;
end $$;
