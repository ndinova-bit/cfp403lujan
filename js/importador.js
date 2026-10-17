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
        text: 'Importando estudiantes y registrando inscripciones.',
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

        let procesadosExito = 0;
        let erroresConteo = 0;
        const dnisProcesados = new Set();

        for (let i = 1; i < lineas.length; i++) {
          const valores = lineas[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
          const dniRaw = valores[idxDni] ? valores[idxDni].replace(/\D/g, '') : '';

          if (!dniRaw || dnisProcesados.has(dniRaw)) continue;
          dnisProcesados.add(dniRaw);

          let nom = (idxNombre !== -1 && valores[idxNombre]) ? valores[idxNombre].toUpperCase() : '';
          let ap = (idxApellido !== -1 && valores[idxApellido]) ? valores[idxApellido].toUpperCase() : '';

          if (!ap && nom.includes(',')) {
            const partes = nom.split(',');
            ap = partes[0].trim();
            nom = partes[1].trim();
          }

          let emailRaw = (idxEmail !== -1 && valores[idxEmail]) ? valores[idxEmail].toLowerCase().replace(/\s+/g, '') : '';
          if (!emailRaw || !emailRaw.includes('@')) {
            emailRaw = `${dniRaw}@cfp403.edu.ar`;
          }

          const usuarioObj = {
            usuario: String(dniRaw),
            dni: String(dniRaw),
            nombre: nom || 'ESTUDIANTE',
            apellido: ap || 'SIN APELLIDO',
            email: emailRaw,
            rol: 'estudiante',
            estado: 'ACTIVO',
            pass: (typeof CryptoJS !== 'undefined') ? CryptoJS.SHA256(dniRaw).toString() : String(dniRaw)
          };

          // 1. Guardar o verificar usuario
          const { data: usrExiste } = await supabase
            .from('usuarios')
            .select('usuario')
            .eq('usuario', String(dniRaw))
            .maybeSingle();

          let errorUsuario = null;
          if (usrExiste) {
            const { error } = await supabase.from('usuarios').update(usuarioObj).eq('usuario', String(dniRaw));
            errorUsuario = error;
          } else {
            const { error } = await supabase.from('usuarios').insert([usuarioObj]);
            errorUsuario = error;
          }

          if (errorUsuario) {
            console.error(`Error en usuario DNI ${dniRaw}:`, errorUsuario);
            erroresConteo++;
            continue; 
          }

          // 2. Vincular inscripción
          const { data: inscExiste } = await supabase
            .from('inscripciones')
            .select('id')
            .eq('trayecto_id', Number(this.trayectoIdActual))
            .eq('estudiante_user', String(dniRaw))
            .maybeSingle();

          if (!inscExiste) {
            const { error: errInsc } = await supabase.from('inscripciones').insert([{
              trayecto_id: Number(this.trayectoIdActual),
              estudiante_user: String(dniRaw)
            }]);

            if (errInsc) {
              console.error(`Error en inscripcion DNI ${dniRaw}:`, errInsc);
            }
          }

          procesadosExito++;
        }

        if (typeof Swal !== 'undefined') Swal.close();

        if (erroresConteo > 0) {
          alert(`⚠️ Proceso finalizado:\n- ${procesadosExito} usuarios importados correctamente.\n- ${erroresConteo} rebotaron por conflicto de esquema en Supabase (Revisar consola).`);
        } else {
          alert(`¡Carga masiva completada con éxito! Se procesaron ${procesadosExito} estudiantes.`);
        }

        // Recargar vistas
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
