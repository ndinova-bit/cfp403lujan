/* ==========================================================================
   MÓDULO DE IMPORTACIÓN MASIVA Y CREACIÓN OFICIAL EN SUPABASE AUTH
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
        title: 'Creando cuentas de acceso...',
        text: 'Registrando estudiantes en Supabase Auth e inscribiendo al trayecto.',
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

        const estudiantesProcesar = [];
        const dnisSet = new Set();

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

          estudiantesProcesar.push({
            dni: String(dniRaw),
            nombre: nom || 'ESTUDIANTE',
            apellido: ap || 'SIN APELLIDO',
            email: emailRaw
          });
        }

        if (estudiantesProcesar.length === 0) {
          if (typeof Swal !== 'undefined') Swal.close();
          alert('No se encontraron DNI válidos para procesar.');
          return;
        }

        let creadosExito = 0;

        for (const est of estudiantesProcesar) {
          // 1. Alta oficial en Supabase Auth
          const { data: authData, error: authErr } = await supabase.auth.signUp({
            email: est.email,
            password: est.dni // La clave predeterminada es su DNI
          });

          let userId = authData.user?.id;

          // If user already exists in Auth, fetch their ID
          if (authErr && authErr.message.includes('already registered')) {
            const { data: pExist } = await supabase
              .from('profiles')
              .select('id')
              .eq('dni', est.dni)
              .maybeSingle();
            if (pExist) userId = pExist.id;
          }

          // 2. Guardar/Actualizar Perfil vinculado al Auth ID
          if (userId) {
            await supabase.from('profiles').upsert({
              id: userId,
              dni: est.dni,
              nombre: est.nombre,
              apellido: est.apellido,
              email: est.email,
              rol: 'estudiante',
              estado: 'ACTIVO'
            });
          }

          // 3. Guardar en la tabla 'usuarios' para compatibilidad con la Sábana de Notas
          await supabase.from('usuarios').upsert({
            usuario: est.dni,
            nombre: est.nombre,
            apellido: est.apellido,
            email: est.email,
            rol: 'estudiante',
            estado: 'ACTIVO',
            pass: (typeof CryptoJS !== 'undefined') ? CryptoJS.SHA256(est.dni).toString() : est.dni
          }, { onConflict: 'usuario' });

          // 4. Inscripción al Trayecto
          const { data: inscExiste } = await supabase
            .from('inscripciones')
            .select('id')
            .eq('trayecto_id', Number(this.trayectoIdActual))
            .eq('estudiante_user', est.dni)
            .maybeSingle();

          if (!inscExiste) {
            await supabase.from('inscripciones').insert({
              trayecto_id: Number(this.trayectoIdActual),
              estudiante_user: est.dni
            });
          }

          creadosExito++;
        }

        if (typeof Swal !== 'undefined') Swal.close();
        
        alert(`¡Carga masiva completada! Se registraron ${creadosExito} cuentas de acceso en el sistema.`);

        // Refrescar vistas
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
