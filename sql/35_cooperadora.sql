-- 35. Cooperadora escolar: padrón de socios, libro de ingresos/egresos (mensual y anual),
--   datos del ejercicio para la PIA (planilla de información anual) y nómina de comisiones.
--   Carga de movimientos: solo Director, Regente y Preceptoría.
--   Lo ven (lectura): esos tres más Secretaría. No lo ven Docentes ni Estudiantes.

create table if not exists public.cooperadora_socios (
  id          bigint generated always as identity primary key,
  apellido    text not null,
  nombre      text not null,
  dni         text not null unique,
  categoria   text not null default 'activo' check (categoria in ('activo', 'honorario', 'adherente')),
  email       text,
  telefono    text,
  estado      text not null default 'ACTIVO' check (estado in ('ACTIVO', 'BAJA')),
  fecha_alta  date not null default current_date,
  fecha_baja  date,
  creado_por  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.cooperadora_ejercicios (
  id                      bigint generated always as identity primary key,
  ciclo_desde             integer not null,
  ciclo_hasta             integer not null,
  distrito                text, escuela_nombre text, escuela_nro text, nro_cue text, cuit text,
  domicilio               text, barrio text, localidad text,
  asesor_email            text, asesor_telefono text, cooperadora_email text, cooperadora_telefono text,
  socios_activos          integer, socios_honorarios integer, socios_adherentes integer,
  acta_numero             text, acta_fojas text, asamblea_fecha date, asamblea_asistieron integer,
  decisiones              jsonb not null default '[]'::jsonb,   -- [{orden, decision}] (1 a 5 del orden del día)
  cuota_monto             numeric, cuota_periodicidad text check (cuota_periodicidad in ('mensual', 'anual')),
  caja_chica_monto        numeric,
  nro_foja_tesoreria      text,   -- "fojas .... del libro de Tesorería" (cuadro 7)
  firma_presidente        text, firma_secretario text, firma_asesor text,   -- cuadro 7: autoridades período anterior
  banco_nombre            text, banco_sucursal text, banco_cuenta text, banco_cbu text,
  kiosco_posee            boolean, kiosco_tipo text check (kiosco_tipo in ('propio', 'licitado')),
  kiosco_desde            date, kiosco_hasta date,
  saldo_inicial_banco_cc      numeric not null default 0,
  saldo_inicial_plazo_fijo    numeric not null default 0,
  saldo_inicial_caja_chica    numeric not null default 0,
  informe_autoridad       text,   -- cuadro 12
  observaciones           text,
  creado_por  uuid default auth.uid(), created_at timestamptz not null default now(),
  actualizado_por uuid, updated_at timestamptz not null default now(),
  unique (ciclo_desde, ciclo_hasta)
);

create table if not exists public.cooperadora_comision (
  id              bigint generated always as identity primary key,
  ejercicio_id    bigint not null references public.cooperadora_ejercicios(id) on delete cascade,
  tipo            text not null check (tipo in ('directiva', 'revisora', 'federacion')),
  cargo           text not null,
  apellido_nombre text,
  documento       text,     -- CUIL (directiva) o DNI (revisora/federación)
  vencimiento     text,     -- "1 año", etc. (solo revisora)
  orden           integer not null default 0
);
create index if not exists coop_comision_ejercicio_idx on public.cooperadora_comision (ejercicio_id);

create table if not exists public.cooperadora_movimientos (
  id              bigint generated always as identity primary key,
  fecha           date not null,
  tipo            text not null check (tipo in ('entrada', 'salida')),
  seccion         smallint not null,     -- entradas: 1 Recursos propios, 2 Oficiales, 3 Otros · salidas: 1 Alumno, 2 Escuela, 3 Entidad, 4 Otros
  rubro_codigo    text not null,         -- 'a','b','c'... según el cuadro 8, u 'otro'
  rubro_nombre    text not null,         -- etiqueta visible (para pantalla y PDF)
  descripcion     text,
  monto           numeric not null check (monto > 0),
  nro_comprobante text,
  medio           text not null default 'banco_cc' check (medio in ('banco_cc', 'caja_chica', 'plazo_fijo')),
  socio_id        bigint references public.cooperadora_socios(id) on delete set null,   -- cobro de cuota social: a qué socio corresponde
  periodo         text,     -- 'YYYY-MM' (mensual) o 'YYYY' (anual) cuando es cuota social
  creado_por      uuid default auth.uid(), creado_por_nombre text,
  created_at      timestamptz not null default now()
);
create index if not exists coop_mov_fecha_idx on public.cooperadora_movimientos (fecha);
create index if not exists coop_mov_socio_idx on public.cooperadora_movimientos (socio_id);

alter table public.cooperadora_socios enable row level security;
alter table public.cooperadora_ejercicios enable row level security;
alter table public.cooperadora_comision enable row level security;
alter table public.cooperadora_movimientos enable row level security;

-- Lectura: administración, regencia, preceptoría y secretaría. Nunca docentes ni estudiantes.
drop policy if exists coop_socios_select on public.cooperadora_socios;
create policy coop_socios_select on public.cooperadora_socios for select to authenticated
  using (public.es_admin() or public.es_preceptor() or public.es_secretaria());
drop policy if exists coop_ejer_select on public.cooperadora_ejercicios;
create policy coop_ejer_select on public.cooperadora_ejercicios for select to authenticated
  using (public.es_admin() or public.es_preceptor() or public.es_secretaria());
drop policy if exists coop_com_select on public.cooperadora_comision;
create policy coop_com_select on public.cooperadora_comision for select to authenticated
  using (public.es_admin() or public.es_preceptor() or public.es_secretaria());
drop policy if exists coop_mov_select on public.cooperadora_movimientos;
create policy coop_mov_select on public.cooperadora_movimientos for select to authenticated
  using (public.es_admin() or public.es_preceptor() or public.es_secretaria());

-- Escritura: solo Director, Regente y Preceptoría (nunca Secretaría, que solo mira)
drop policy if exists coop_socios_write on public.cooperadora_socios;
create policy coop_socios_write on public.cooperadora_socios for all to authenticated
  using (public.es_admin() or public.es_preceptor()) with check (public.es_admin() or public.es_preceptor());
drop policy if exists coop_ejer_write on public.cooperadora_ejercicios;
create policy coop_ejer_write on public.cooperadora_ejercicios for all to authenticated
  using (public.es_admin() or public.es_preceptor()) with check (public.es_admin() or public.es_preceptor());
drop policy if exists coop_com_write on public.cooperadora_comision;
create policy coop_com_write on public.cooperadora_comision for all to authenticated
  using (public.es_admin() or public.es_preceptor()) with check (public.es_admin() or public.es_preceptor());
drop policy if exists coop_mov_write on public.cooperadora_movimientos;
create policy coop_mov_write on public.cooperadora_movimientos for all to authenticated
  using (public.es_admin() or public.es_preceptor()) with check (public.es_admin() or public.es_preceptor());

grant select, insert, update, delete on public.cooperadora_socios to authenticated;
grant select, insert, update, delete on public.cooperadora_ejercicios to authenticated;
grant select, insert, update, delete on public.cooperadora_comision to authenticated;
grant select, insert, update, delete on public.cooperadora_movimientos to authenticated;

drop trigger if exists trg_auditoria on public.cooperadora_socios;
create trigger trg_auditoria after insert or update or delete on public.cooperadora_socios
  for each row execute function public.registrar_auditoria();
drop trigger if exists trg_auditoria on public.cooperadora_ejercicios;
create trigger trg_auditoria after insert or update or delete on public.cooperadora_ejercicios
  for each row execute function public.registrar_auditoria();
drop trigger if exists trg_auditoria on public.cooperadora_comision;
create trigger trg_auditoria after insert or update or delete on public.cooperadora_comision
  for each row execute function public.registrar_auditoria();
drop trigger if exists trg_auditoria on public.cooperadora_movimientos;
create trigger trg_auditoria after insert or update or delete on public.cooperadora_movimientos
  for each row execute function public.registrar_auditoria();
