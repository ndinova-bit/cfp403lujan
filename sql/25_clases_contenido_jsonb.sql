-- 25. clases.contenido debe ser jsonb (en producción estaba como text y la plataforma
--     no leía los criterios de la lista de cotejo, las preguntas, etc. al reabrir una actividad).
-- Ya aplicado en producción; este archivo es el registro.
alter table public.clases drop constraint if exists clases_contenido_tamano;
alter table public.clases alter column contenido type jsonb using nullif(btrim(contenido), '')::jsonb;
alter table public.clases add constraint clases_contenido_tamano check (contenido is null or octet_length(contenido::text) <= 200000);
