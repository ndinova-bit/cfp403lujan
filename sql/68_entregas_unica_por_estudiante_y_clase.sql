-- 68 · Una sola entrega por estudiante y actividad (no había duplicados al aplicarlo).
-- Junto con el bloqueo optimista de la función corregir-actividad evita pasarse del límite de intentos
-- enviando dos veces a la vez.
create unique index if not exists entregas_actividades_clase_estudiante_uq
  on public.entregas_actividades (clase_id, estudiante_user);
