/* ==========================================================================
   MÓDULO DE IMPORTACIÓN MASIVA DE ALUMNOS (CSV)
   Archivo: js/importador.js
   ========================================================================== */

var ImportadorModulo = {
  trayectoIdActual: null,

  abrirModal(trayectoId) {
    this.trayectoIdActual = trayectoId;

    let input = document.getElementById('input-importar-csv');
    if (input) {
      input.value = '';
      input.click();
    } else {
      alert('No se encontró el selector de archivos en pantalla.');
    }
  },

  async procesarCSV(file) {
    if (!file || !this.trayectoIdActual) {
      alert('⚠️ No se seleccionó un archivo válido o no se identificó el trayecto.');
      return;
    }

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Procesando nómina...',
        text: 'Sincronizando estudiantes en usuarios, profiles e inscripciones.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const contenido = e.target.result;
        const lineas = contenido.split(/\r\n|\n/).filter(l => l.trim().length > 0);

        if (lineas.length <= 1) {
          if (typeof Swal !== 'undefined') Swal.close();
          alert('El archivo CSV está vacío o no contiene filas de datos.');
          return;
        }

        // 1. Detectar delimitador (, o ;)
        const cabeceraRaw = lineas[0].toLowerCase();
        const sep = cabeceraRaw.includes(';') ? ';' : ',';
        const colsHeader = lineas[0].split(sep).map(c => c.trim().toLowerCase().replace(/"/g, ''));

        const idxDni = colsHeader.findIndex(c => c.includes('dni') || c.includes('documento') || c.includes('usuario'));
        const idxNombre = colsHeader.findIndex(c => c.includes('nombre'));
        const idxApellido = colsHeader.findIndex(c => c.includes('apellido'));
        const idxEmail = colsHeader.findIndex(c => c.includes('email') || c.includes('correo'));

        if (idxDni === -1) {
          if (typeof Swal !== 'undefined') Swal.close();
          alert('Columna DNI no encontrada en la primera fila del CSV.');
          return;
        }

        const usuariosBatch = [];
        const dnisSet = new Set();

        // 2. Parsear filas del CSV
        for (let i = 1; i < lineas.length; i++) {
          const valores = lineas[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
          const dniRaw = valores[idxDni] ? valores[idxDni].replace(/\D/g, '') : '';

          if (!dniRaw || dnisSet.has(dniRaw)) continue;
          dnisSet.add(dniRaw);

          let nom = (idxNombre !== -1 && valores[idxNombre]) ? valores[idxNombre].toUpperCase() : '';
          let ap = (idxApellido !== -1 && valores[idxApellido]) ? valores[idxApellido].toUpperCase() : '';

          if (!ap && nom.includes(',')) {
            const partes = nom.split(',');
            ap = partes[0].trim();
            nom = partes[1].trim();
          }

          let emailRaw = (idxEmail !== -1 && valores[idxEmail]) ? valores[idxEmail].toLowerCase().replace(/\s+/g, '') : '';
          if (!emailRaw || !emailRaw.includes('@')) {
            emailRaw = `${dniRaw}@cfp403.ar`;
          }

          usuariosBatch.push({
            dniRaw: String(dniRaw),
            nombre: nom || 'ESTUDIANTE',
            apellido: ap || 'SIN APELLIDO',
            email: emailRaw
          });
        }

        if (usuariosBatch.length === 0) {
          if (typeof Swal !== 'undefined') Swal.close();
          alert('No se encontraron DNI válidos para procesar.');
          return;
        }

        // 3. Procesar individualmente comprobando 'profiles' por DNI
        for (const u of usuariosBatch) {
          // A) Tabla 'usuarios'
          const objUsuario = {
            usuario: u.dniRaw,
            nombre: u.nombre,
            apellido: u.apellido,
            email: u.email,
            rol: 'estudiante',
            estado: 'ACTIVO',
            pass: (typeof CryptoJS !== 'undefined') ? CryptoJS.SHA256(u.dniRaw).toString() : u.dniRaw
          };

          await supabase.from('usuarios').upsert([objUsuario], { onConflict: 'usuario' });

          // B) Tabla 'profiles'
          const { data: profExiste } = await supabase
            .from('profiles')
            .select('id')
            .eq('dni', u.dniRaw)
            .maybeSingle();

          if (profExiste) {
            // Si el perfil ya existe, actualizamos sus datos
            await supabase
              .from('profiles')
              .update({
                nombre: u.nombre,
                apellido: u.apellido,
                email: u.email,
                rol: 'estudiante',
                estado: 'ACTIVO'
              })
              .eq('dni', u.dniRaw);
          } else {
            // Si es nuevo, generamos un UUID válido para cumplir la restricción NOT NULL de 'id'
            const nuevoUUID = (typeof crypto !== 'undefined' && crypto.randomUUID) 
              ? crypto.randomUUID() 
              : 'f' + Math.random().toString(36).substring(2, 11) + '-4000-8000-000000000000';

            await supabase.from('profiles').insert([{
              id: nuevoUUID,
              dni: u.dniRaw,
              nombre: u.nombre,
              apellido: u.apellido,
              email: u.email,
              rol: 'estudiante',
              estado: 'ACTIVO'
            }]);
          }

          // C) Tabla 'inscripciones'
          const { data: inscExiste } = await supabase
            .from('inscripciones')
            .select('id')
            .eq('trayecto_id', Number(this.trayectoIdActual))
            .eq('estudiante_user', u.dniRaw)
            .maybeSingle();

          if (!inscExiste) {
            await supabase.from('inscripciones').insert([{
              trayecto_id: Number(this.trayectoIdActual),
              estudiante_user: u.dniRaw
            }]);
          }
        }

        if (typeof Swal !== 'undefined') Swal.close();
        
        alert(`¡Carga masiva completada con éxito! Se procesaron y sincronizaron ${usuariosBatch.length} estudiantes.`);

        // Refrescar vistas en pantalla
        if (window.ClasesModulo && typeof window.ClasesModulo.cargarSabanaEstudiantes === 'function') {
          await window.ClasesModulo.cargarSabanaEstudiantes();
        }
        if (window.UsuariosAdmin && typeof window.UsuariosAdmin.cargarUsuarios === 'function') {
          await window.UsuariosAdmin.cargarUsuarios();
        }

      } catch (err) {
        console.error('Error crítico durante la importación:', err);
        if (typeof Swal !== 'undefined') Swal.close();
        alert('Ocurrió un error inesperado al procesar el archivo CSV.');
      }
    };

    reader.readAsText(file, 'UTF-8');
  }
};

window.ImportadorModulo = ImportadorModulo;
