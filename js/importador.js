/* ==========================================================================
   MÓDULO DE IMPORTACIÓN MASIVA DE ALUMNOS (CSV) - ULTRA RÁPIDO & BATCH
   Archivo: js/importador.js
   ========================================================================== */

const ImportadorModulo = {
  trayectoIdActual: null,

  abrirModal(trayectoId) {
    this.trayectoIdActual = trayectoId;
    const input = document.getElementById('input-file-csv');
    if (input) {
      input.value = '';
      input.click();
    }
  },

  async procesarCSV(file) {
    if (!file || !this.trayectoIdActual) return;

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Procesando nómina...',
        text: 'Importando estudiantes y registrando inscripciones en lote.',
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
          alertError('El archivo CSV está vacío o no contiene filas de datos.');
          return;
        }

        // 1. Detectar delimitador (, o ;) y mapear encabezados
        const cabeceraRaw = lineas[0].toLowerCase();
        const sep = cabeceraRaw.includes(';') ? ';' : ',';
        const colsHeader = lineas[0].split(sep).map(c => c.trim().toLowerCase().replace(/"/g, ''));

        const idxDni = colsHeader.findIndex(c => c.includes('dni') || c.includes('documento') || c.includes('usuario'));
        const idxNombre = colsHeader.findIndex(c => c.includes('nombre'));
        const idxApellido = colsHeader.findIndex(c => c.includes('apellido'));
        const idxEmail = colsHeader.findIndex(c => c.includes('email') || c.includes('correo'));

        if (idxDni === -1) {
          alertError('Columna DNI no encontrada en la primera fila del CSV.');
          return;
        }

        const usuariosNuevosBatch = [];
        const dnisProcesados = new Set();

        // 2. Parsear filas del CSV
        for (let i = 1; i < lineas.length; i++) {
          const valores = lineas[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
          const dniRaw = valores[idxDni] ? valores[idxDni].replace(/\D/g, '') : '';

          if (!dniRaw || dnisProcesados.has(dniRaw)) continue;
          dnisProcesados.add(dniRaw);

          let nom = idxNombre !== -1 && valores[idxNombre] ? valores[idxNombre].toUpperCase() : '';
          let ap = idxApellido !== -1 && valores[idxApellido] ? valores[idxApellido].toUpperCase() : '';

          // Manejo si nombre y apellido vienen unificados en un campo
          if (!ap && nom.includes(',')) {
            const partes = nom.split(',');
            ap = partes[0].trim();
            nom = partes[1].trim();
          }

          let emailRaw = idxEmail !== -1 && valores[idxEmail] ? valores[idxEmail].toLowerCase().replace(/\s+/g, '') : '';
          if (!emailRaw || !emailRaw.includes('@')) {
            emailRaw = `${dniRaw}@cfp403.edu.ar`;
          }

          usuariosNuevosBatch.push({
            usuario: dniRaw,
            dni: dniRaw,
            nombre: nom || 'ESTUDIANTE',
            apellido: ap || 'SIN APELLIDO',
            email: emailRaw,
            rol: 'estudiante',
            estado: 'aprobado', // Crucial para que aparezca en "Usuarios y Roles"
            pass: CryptoJS.SHA256(dniRaw).toString()
          });
        }

        if (usuariosNuevosBatch.length === 0) {
          alertError('No se encontraron registros de DNI válidos para procesar.');
          return;
        }

        // 3. Upsert masivo de Usuarios en 1 sola consulta HTTP (En lugar de bucle)
        const { error: errUsr } = await supabase
          .from('usuarios')
          .upsert(usuariosNuevosBatch, { onConflict: 'usuario' });

        if (errUsr) {
          console.warn('Advertencia al insertar usuarios batch, reintentando por DNI:', errUsr);
          await supabase.from('usuarios').upsert(usuariosNuevosBatch, { onConflict: 'dni' });
        }

        // 4. Inscripción masiva al Trayecto en 1 sola consulta HTTP
        const inscripcionesBatch = Array.from(dnisProcesados).map(dni => ({
          trayecto_id: Number(this.trayectoIdActual),
          estudiante_user: String(dni)
        }));

        const { error: errInsc } = await supabase
          .from('inscripciones')
          .upsert(inscripcionesBatch, { onConflict: 'trayecto_id,estudiante_user' });

        if (errInsc) console.warn('Aviso inscripciones:', errInsc);

        if (typeof Swal !== 'undefined') Swal.close();
        alertSuccess(`¡Carga masiva completada! Se procesaron ${usuariosNuevosBatch.length} estudiantes en segundos.`);

        // 5. Recargar vistas de la plataforma
        if (window.ClasesModulo && window.ClasesModulo.trayectoIdActual) {
          await ClasesModulo.cargarNominaEstudiantes();
        }
        if (window.UsuariosAdmin && window.UsuariosAdmin.cargarUsuarios) {
          await UsuariosAdmin.cargarUsuarios();
        }

      } catch (err) {
        console.error('Error durante la importación masiva:', err);
        if (typeof Swal !== 'undefined') Swal.close();
        alertError('Ocurrió un error inesperado al importar el CSV.');
      }
    };

    reader.readAsText(file, 'UTF-8');
  }
};

window.ImportadorModulo = ImportadorModulo;
