-- 28. Observaciones: la notificación oficial es el acta o el correo; la plataforma solo registra
--     cuándo la persona observada la abrió ("vista"), sin botón de "tomé conocimiento".
alter table public.observaciones_institucionales rename column conocimiento_at to vista_at;
alter table public.observaciones_institucionales drop column if exists conocimiento_comentario;
drop function if exists public.tomar_conocimiento(bigint, text);

-- Marca como vistas las observaciones que recibí y todavía no abrí. Devuelve cuántas.
create or replace function public.marcar_observaciones_vistas()
returns integer
language plpgsql security definer set search_path = public as $fn$
declare n integer;
begin
  update public.observaciones_institucionales set vista_at = now()
   where destinatario_id = auth.uid() and vista_at is null;
  get diagnostics n = row_count;
  return n;
end $fn$;
revoke all on function public.marcar_observaciones_vistas() from public, anon;
grant execute on function public.marcar_observaciones_vistas() to authenticated;

-- Quien la hizo puede corregirla mientras la persona observada no la haya abierto
create or replace function public.editar_observacion(
  p_id bigint, p_tipo text, p_fecha date, p_titulo text, p_texto text,
  p_link text default null, p_texto_doc text default null, p_trayecto bigint default null)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  update public.observaciones_institucionales
     set tipo = p_tipo, fecha = p_fecha, titulo = btrim(p_titulo), texto = btrim(p_texto),
         link_documento = nullif(btrim(coalesce(p_link, '')), ''),
         texto_documento = nullif(btrim(coalesce(p_texto_doc, '')), ''),
         trayecto_id = p_trayecto, editada_at = now()
   where id = p_id and autor_id = auth.uid() and vista_at is null;
  if not found then
    raise exception 'No se puede modificar: no es tuya o la persona ya la abrió. Agregá un seguimiento.';
  end if;
end $fn$;
