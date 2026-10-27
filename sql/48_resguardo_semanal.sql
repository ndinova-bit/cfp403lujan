-- =====================================================================================
-- PASO 48 — RESGUARDO SEMANAL DE LA AUDITORÍA EN DRIVE
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
-- Todos los domingos a las 03:00 (hora de Argentina) la base llama a la función
-- «resguardo-semanal», que guarda en el Drive de la plataforma (carpeta Auditoria / <año>) un CSV con los
-- cambios registrados en los últimos 8 días. Requiere haber desplegado esa función y que el
-- puente de Apps Script esté actualizado (ver funciones_supabase/resguardo-semanal/).
-- =====================================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

do $$ begin perform cron.unschedule('resguardo-auditoria'); exception when others then null; end $$;

select cron.schedule(
  'resguardo-auditoria',
  '0 6 * * 0',      -- domingo 06:00 UTC = 03:00 en Argentina
  $cron$
    select net.http_post(
      url     := 'https://dxgqtdaexlegsaohdywx.supabase.co/functions/v1/resguardo-semanal',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $cron$
);

-- Verificación: tiene que aparecer 1 fila
select jobname, schedule, active from cron.job where jobname = 'resguardo-auditoria';
