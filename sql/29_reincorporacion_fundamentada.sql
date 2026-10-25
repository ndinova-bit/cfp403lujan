-- 29. Reincorporar a un estudiante dado de baja exige una fundamentación escrita (mínimo 10 caracteres);
--     queda guardada con fecha y quién la hizo. Las bajas automáticas se registran con el botón de Seguimiento.
-- Ya aplicado en producción; este archivo es el registro.
alter table public.inscripciones
  add column if not exists motivo_reincorporacion text,
  add column if not exists fecha_reincorporacion date,
  add column if not exists reincorporado_por uuid;

create or replace function public.controlar_reincorporacion()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if upper(coalesce(old.estado, '')) = 'BAJA' and upper(coalesce(new.estado, '')) <> 'BAJA' and auth.uid() is not null then
    if not public.es_personal() then
      raise exception 'Solo administración, regencia o preceptoría pueden reincorporar a un estudiante';
    end if;
    if char_length(btrim(coalesce(new.motivo_reincorporacion, ''))) < 10 then
      raise exception 'Para reincorporar hay que escribir la fundamentación (al menos 10 caracteres)';
    end if;
    new.motivo_reincorporacion := btrim(new.motivo_reincorporacion);
    new.fecha_reincorporacion := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
    new.reincorporado_por := auth.uid();
  end if;
  return new;
end $fn$;
