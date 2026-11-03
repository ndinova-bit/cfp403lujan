-- 54. Cooperadora: se guarda el N.º de socio que tenía cada persona en la planilla anterior
-- (numero_anterior) cuando se renumeró el padrón de corrido en el orden de la planilla (3/11/2026).
-- Es solo de consulta: la pantalla lo muestra como "(antes N)" y se puede buscar por ese número.
alter table public.cooperadora_socios add column if not exists numero_anterior integer;
