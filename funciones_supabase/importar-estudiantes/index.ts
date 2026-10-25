// =============================================================================
// Función de Supabase: importar-estudiantes
//
// Qué hace, para cada estudiante que le manda la plataforma (CSV):
//   1. Lo guarda en el padrón (padron_estudiantes).
//   2. Si no tiene cuenta, la crea en Supabase Auth ya confirmada, con
//      usuario = DNI@cfp403.ar y contraseña inicial CFP403_<DNI>,
//      y deja su perfil como ESTUDIANTE / ACTIVO.
//      Si tenía una cuenta pendiente (hecha con "Registrarse"), la reemplaza por una
//      nueva con la contraseña inicial, para que nadie entre con una clave ajena.
//   3. Lo inscribe en el trayecto elegido (si todavía no estaba).
//
// Seguridad: solo funciona si quien la llama es administración, regencia o preceptoría activa.
// La clave de servicio (service_role) la pone Supabase sola y nunca sale del servidor.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Clave de administrador: se usa el formato nuevo de Supabase (SUPABASE_SECRET_KEYS)
    // y, si no existe, el formato anterior (SUPABASE_SERVICE_ROLE_KEY).
    let claveAdmin = '';
    try {
      const claves = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
      claveAdmin = claves['default'] || (Object.values(claves)[0] as string) || '';
    } catch (_) {
      claveAdmin = '';
    }
    if (!claveAdmin) claveAdmin = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!claveAdmin) return json({ error: 'El servidor no tiene una clave de administrador configurada' }, 500);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      claveAdmin,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // 1. ¿Quién llama? Tiene que ser un administrador activo.
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: quien, error: errQuien } = await admin.auth.getUser(token);
    if (errQuien || !quien?.user) return json({ error: 'Sesión inválida' }, 401);

    const { data: perfilLlama } = await admin
      .from('profiles')
      .select('rol, estado')
      .eq('id', quien.user.id)
      .maybeSingle();

    const rolLlama = String(perfilLlama?.rol || '').toLowerCase();
    const estadoLlama = String(perfilLlama?.estado || '').toUpperCase();
    if (!perfilLlama || !['admin', 'administrador', 'regente', 'preceptor'].includes(rolLlama) || estadoLlama !== 'ACTIVO') {
      return json({ error: 'No autorizado' }, 403);
    }

    // 2. Datos recibidos
    const body = await req.json();
    const trayectoId = Number(body.trayecto_id);
    const lista: any[] = Array.isArray(body.estudiantes) ? body.estudiantes.slice(0, 50) : [];
    if (!trayectoId || lista.length === 0) return json({ error: 'Datos incompletos' }, 400);

    const resultado = {
      creados: 0,
      ya_tenian_cuenta: 0,
      aprobados: 0,
      inscriptos_nuevos: 0,
      ya_inscriptos: 0,
      errores: [] as string[],
    };

    // 3. Estudiante por estudiante
    for (const e of lista) {
      const dni = String(e.dni || '').replace(/\D/g, '');
      if (dni.length < 6 || dni.length > 9) {
        resultado.errores.push(`DNI inválido: ${e.dni}`);
        continue;
      }

      const nombre = String(e.nombre || 'SIN NOMBRE').toUpperCase();
      const apellido = String(e.apellido || 'SIN APELLIDO').toUpperCase();
      const emailReal = e.email && String(e.email).includes('@') ? String(e.email).toLowerCase() : null;
      // El usuario de acceso es siempre DNI@cfp403.ar (así todos ingresan con el DNI).
      // El email real, si viene en el CSV, se guarda solo como dato de contacto.
      const email = `${dni}@cfp403.ar`;

      // 3.1 Padrón
      const { error: errPad } = await admin
        .from('padron_estudiantes')
        .upsert({ dni, nombre, apellido, email: emailReal }, { onConflict: 'dni' });
      if (errPad) {
        resultado.errores.push(`DNI ${dni} (padrón): ${errPad.message}`);
        continue;
      }

      // 3.2 Cuenta. Un perfil cuenta como "con cuenta" solo si tiene un usuario real en Supabase Auth.
      const { data: perfiles } = await admin
        .from('profiles')
        .select('*')
        .eq('dni', dni);

      let conCuenta = false;
      let esPersonal = false;
      const huerfanos: any[] = [];

      for (const pf of perfiles || []) {
        if (String(pf.rol || '').toLowerCase() !== 'estudiante') esPersonal = true;

        const { data: au } = await admin.auth.admin.getUserById(pf.id);
        if (au?.user && String(pf.estado || '').toUpperCase() === 'PENDIENTE' &&
            String(pf.rol || '').toLowerCase() === 'estudiante') {
          // Cuenta creada con "Registrarse" y nunca aprobada: no se sabe quién eligió esa
          // contraseña (podría ser otra persona usando este DNI). No se aprueba tal cual:
          // se elimina (con sus sesiones abiertas) y más abajo se crea una cuenta nueva
          // con la contraseña inicial de siempre, CFP403_<DNI>.
          const { error: errElim } = await admin.auth.admin.deleteUser(pf.id);
          if (errElim) {
            // Queda PENDIENTE (sin acceso a nada) y se avisa.
            resultado.errores.push(`DNI ${dni} (cuenta pendiente): ${errElim.message}`);
            conCuenta = true;
          } else {
            await admin.from('profiles').delete().eq('id', pf.id);
            resultado.aprobados++;
          }
        } else if (au?.user) {
          conCuenta = true;
        } else {
          huerfanos.push(pf);
        }
      }

      if (esPersonal) {
        resultado.errores.push(`DNI ${dni}: corresponde a personal del CFP (docente o administrador), no se modificó`);
        continue;
      }

      if (conCuenta) {
        resultado.ya_tenian_cuenta++;
      } else {
        // Perfiles sin usuario en Auth (quedaron de una carga anterior): se reemplazan por una cuenta real.
        const emailContacto = emailReal || huerfanos.find((h) => h.email)?.email || email;

        if (huerfanos.length > 0) {
          const { error: errBorrar } = await admin
            .from('profiles')
            .delete()
            .in('id', huerfanos.map((h) => h.id));
          if (errBorrar) {
            resultado.errores.push(`DNI ${dni} (perfil anterior): ${errBorrar.message}`);
            continue;
          }
        }

        const clave = `CFP403_${dni}`;
        const { data: nuevo, error: errCrear } = await admin.auth.admin.createUser({
          email,
          password: clave,
          email_confirm: true,
          user_metadata: { dni, nombre, apellido },
        });

        if (errCrear || !nuevo?.user) {
          // Si no se pudo crear la cuenta, se restauran los perfiles que se habían quitado
          if (huerfanos.length > 0) await admin.from('profiles').insert(huerfanos);
          resultado.errores.push(`DNI ${dni} (cuenta): ${errCrear?.message || 'no se pudo crear'}`);
          continue;
        }

        // El trigger de la base ya creó el perfil como PENDIENTE: lo dejamos completo y activo.
        const { error: errPerfil } = await admin
          .from('profiles')
          .update({ dni, nombre, apellido, email: emailContacto, rol: 'estudiante', estado: 'ACTIVO' })
          .eq('id', nuevo.user.id);

        if (errPerfil) {
          resultado.errores.push(`DNI ${dni} (perfil): ${errPerfil.message}`);
          continue;
        }
        resultado.creados++;
      }

      // 3.3 Inscripción
      const { data: yaInsc } = await admin
        .from('inscripciones')
        .select('id')
        .eq('trayecto_id', trayectoId)
        .eq('estudiante_user', dni)
        .limit(1);

      if (yaInsc && yaInsc.length > 0) {
        resultado.ya_inscriptos++;
      } else {
        const { error: errInsc } = await admin
          .from('inscripciones')
          .insert({ trayecto_id: trayectoId, estudiante_user: dni });
        if (errInsc) resultado.errores.push(`DNI ${dni} (inscripción): ${errInsc.message}`);
        else resultado.inscriptos_nuevos++;
      }
    }

    return json(resultado);
  } catch (err) {
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
