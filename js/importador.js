/* ==========================================================================
   MÓDULO DE IMPORTACIÓN MASIVA (CSV / EXCEL)
   Archivo: js/importador.js
   ========================================================================== */

const ImportadorCSV = {
  async procesarCSV(archivoCSV, trayectoId) {
    if (!archivoCSV) return;

    if (!trayectoId) {
      alert('⚠️ Seleccioná un trayecto para vincular la nómina de estudiantes.');
      return;
    }

    const lector = new FileReader();
    lector.readAsText(archivoCSV);

    lector.onload = async (e) => {
      const contenido = e.target.result;
      const filas = contenido.split('\n').map(f => f.trim()).filter(f => f.length > 0);

      if (filas.length <= 1) {
        alert('El archivo CSV está vacío o solo contiene encabezados.');
        return;
      }

      const encabezados = filas[0].toLowerCase().split(',').map(h => h.trim());
      const idxDni = encabezados.indexOf('dni');
      const idxNombre = encabezados.indexOf('nombre');
      const idxApellido = encabezados.indexOf('apellido');
      const idxEmail = encabezados.indexOf('email');

      if (idxDni === -1) {
        alert('❌ Error: El archivo CSV debe incluir obligatoriamente la columna "dni".');
        return;
      }

      let procesados = 0;
      let errores = 0;

      for (let i = 1; i < filas.length; i++) {
        const cols = filas[i].split(',').map(c => c.trim());
        const dni = cols[idxDni];
        const nombre = idxNombre !== -1 ? cols[idxNombre].toUpperCase() : '';
        const apellido = idxApellido !== -1 ? cols[idxApellido].toUpperCase() : '';
        
        let email = idxEmail !== -1 ? cols[idxEmail].toLowerCase() : '';
        if (!email && dni) {
          email = `${dni}@cfp403.ar`;
        }

        if (!dni) continue;

        try {
          // 1. Verificar si la persona ya existe en 'profiles' por DNI
          const { data: perfilExistente } = await supabase
            .from('profiles')
            .select('id, dni')
            .eq('dni', String(dni))
            .maybeSingle();

          let userId = perfilExistente?.id;

          if (!userId) {
            // 2. Si NO existe en Auth, lo registramos mediante Supabase Auth
            const passwordTemp = `CFP403_${dni}`;
            const { data: authRes, error: authError } = await supabase.auth.signUp({
              email: email,
              password: passwordTemp
            });

            if (authError && !authError.message.includes('already registered')) {
              console.warn(`Auth warning para DNI ${dni}:`, authError.message);
            }

            userId = authRes?.user?.id;

            // 3. Crear el perfil en 'profiles'
            if (userId) {
              await supabase.from('profiles').upsert({
                id: userId,
                dni: String(dni),
                nombre: nombre,
                apellido: apellido,
                email: email,
                rol: 'estudiante',
                estado: 'ACTIVO'
              });
            } else {
              // Fallback directo a profiles si no retorna userId de Auth
              await supabase.from('profiles').upsert({
                dni: String(dni),
                nombre: nombre,
                apellido: apellido,
                email: email,
                rol: 'estudiante',
                estado: 'ACTIVO'
              }, { onConflict: 'dni' });
            }
          } else {
            // Si ya existía el perfil, solo actualizamos los datos
            await supabase.from('profiles').update({
              nombre: nombre,
              apellido: apellido,
              email: email,
              rol: 'estudiante',
              estado: 'ACTIVO'
            }).eq('id', userId);
          }

          // 4. Guardar también en 'usuarios' para compatibilidad con la Sábana de Notas
          const passHasheada = (typeof CryptoJS !== 'undefined' && CryptoJS.SHA256)
            ? CryptoJS.SHA256(String(dni)).toString()
            : String(dni);

          await supabase.from('usuarios').upsert({
            usuario: String(dni),
            pass: passHasheada,
            nombre: nombre,
            apellido: apellido,
            email: email,
            rol: 'estudiante',
            estado: 'ACTIVO'
          }, { onConflict: 'usuario' });

          // 5. Vincular alumno al trayecto actual en 'inscripciones' (evita duplicados)
          const { data: inscExistente } = await supabase
            .from('inscripciones')
            .select('id')
            .eq('trayecto_id', Number(trayectoId))
            .eq('estudiante_user', String(dni))
            .maybeSingle();

          if (!inscExistente) {
            const { error: errInsc } = await supabase
              .from('inscripciones')
              .insert([{
                trayecto_id: Number(trayectoId),
                estudiante_user: String(dni)
              }]);

            if (errInsc) throw errInsc;
          }

          procesados++;
        } catch (err) {
          console.error(`Error al procesar DNI ${dni}:`, err);
          errores++;
        }
      }

      alert(`✅ Proceso finalizado: ${procesados} estudiantes inscriptos correctamente.${errores > 0 ? ` (${errores} errores)` : ''}`);

      // Recargar vistas globales y locales
      if (window.ClasesModulo && typeof window.ClasesModulo.cargarSabanaEstudiantes === 'function') {
        await window.ClasesModulo.cargarSabanaEstudiantes();
      }
      if (typeof UsuariosAdmin !== 'undefined' && typeof UsuariosAdmin.cargarUsuarios === 'function') {
        await UsuariosAdmin.cargarUsuarios();
      }
    };
  }
};

window.ImportadorCSV = ImportadorCSV;
