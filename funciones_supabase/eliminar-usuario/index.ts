// =============================================================================
// Función de Supabase: eliminar-usuario
//
// Elimina DEFINITIVAMENTE a una persona: su cuenta de acceso (Supabase Auth) y su
// perfil. Solo la puede usar un administrador activo.
//
// Protecciones:
//   - No se puede eliminar a uno mismo.
//   - Si la persona tiene historial académico (inscripciones, entregas, asistencias)
//     la función NO elimina nada y avisa; hay que repetir el pedido con
//     "forzar": true. En ese caso también se borra ese historial (queda copia en la
//     tabla de auditoría).
//   - Lo recomendable es INHABILITAR (baja lógica) y no eliminar.
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
    let claveAdmin = '';
    try {
      const claves = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
      claveAdmin = claves['default'] || (Object.values(claves)[0] as string) || '';
    } catch (_) {
      claveAdmin = '';
    }
    if (!claveAdmin) claveAdmin = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!claveAdmin) return json({ error: 'El servidor no tiene una clave de administrador configurada' }, 500);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, claveAdmin, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. ¿Quién llama? Un administrador activo.
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: quien, error: errQuien } = await admin.auth.getUser(token);
    if (errQuien || !quien?.user) return json({ error: 'Sesión inválida' }, 401);

    const { data: perfilLlama } = await admin
      .from('profiles').select('rol, estado').eq('id', quien.user.id).maybeSingle();
    const rolLlama = String(perfilLlama?.rol || '').toLowerCase();
    if (!perfilLlama || !['admin', 'administrador'].includes(rolLlama) ||
        String(perfilLlama.estado || '').toUpperCase() !== 'ACTIVO') {
      return json({ error: 'No autorizado' }, 403);
    }

    // 2. Datos
    const body = await req.json();
    const userId = String(body.user_id || '');
    const forzar = body.forzar === true;
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'Datos incompletos' }, 400);
    if (userId === quien.user.id) return json({ error: 'No podés eliminar tu propia cuenta' }, 400);

    const { data: objetivo } = await admin
      .from('profiles').select('id, dni, nombre, apellido, rol').eq('id', userId).maybeSingle();
    const dni = String(objetivo?.dni || '');

    // 3. Historial académico
    const contar = async (tabla: string) => {
      if (!dni) return 0;
      const { count } = await admin.from(tabla).select('id', { count: 'exact', head: true }).eq('estudiante_user', dni);
      return count || 0;
    };
    const historial = {
      inscripciones: await contar('inscripciones'),
      entregas: await contar('entregas_actividades'),
      asistencias: await contar('asistencias'),
    };
    const tieneHistorial = historial.inscripciones + historial.entregas + historial.asistencias > 0;

    if (tieneHistorial && !forzar) {
      return json({ requiere_confirmacion: true, historial });
    }

    // 4. Borrado
    if (tieneHistorial && dni) {
      for (const tabla of ['entregas_actividades', 'asistencias', 'inscripciones']) {
        const { error } = await admin.from(tabla).delete().eq('estudiante_user', dni);
        if (error) return json({ error: `No se pudo borrar el historial (${tabla}): ${error.message}` }, 500);
      }
    }

    // Se borra el perfil (por si la base no lo elimina en cascada) y después la cuenta de acceso
    await admin.from('profiles').delete().eq('id', userId);
    const { error: errAuth } = await admin.auth.admin.deleteUser(userId);
    if (errAuth && !/not found/i.test(errAuth.message)) {
      return json({ error: 'No se pudo eliminar la cuenta de acceso: ' + errAuth.message }, 500);
    }

    return json({ ok: true, historial_borrado: tieneHistorial ? historial : null });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
