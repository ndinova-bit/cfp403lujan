/* ==========================================================================
   CARGA MASIVA CON PANTALLA DE ESPERA INTERACTIVA Y BLOQUEO DE NAVEGACIÓN
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

    // Modal emergente de espera bloqueante
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: '⏳ Carga Masiva en Proceso',
        html: `
          <div style="margin-top: 10px;">
            <p style="font-size: 14px; color: #aaa;">Por favor no cierre ni recargue la página.</p>
            <strong id="contador-importacion" style="font-size: 18px; color: #3085d6;">Iniciando lectura de datos...</strong>
          </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
      });
    }

    // Activar protección contra recarga de pestaña accidental (F5 / Salir)
    const prevenirSalida = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', prevenirSalida);

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const contenido = e.target.result;
        const lineas = contenido.split(/\r\n|\n/).filter(l => l.trim().length > 0);

        if (lineas.length <= 1) {
          window.removeEventListener('beforeunload', prevenirSalida);
          if (typeof Swal !== 'undefined') Swal.close();
          alert('El archivo CSV está vacío.');
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
          window.removeEventListener('beforeunload', prevenirSalida);
          if (typeof Swal !== 'undefined') Swal.close();
          alert('Columna DNI no encontrada.');
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

        const total = estudiantesProcesar.length;
        let procesados = 0;

        for (const est of estudiantesProcesar) {
          procesados++;
          
          // Actualizar contador en la pantalla de espera
          const txtContador = document.getElementById('contador-importacion');
          if (txtContador) {
            txtContador.innerText = `Registrando estudiante ${procesados} de ${total}...`;
          }

          // 1. Inserción/Sincronización en Usuarios
          await supabase.from('usuarios').upsert({
            usuario: est.dni,
            nombre: est.nombre,
            apellido: est.apellido,
            email: est.email,
            rol: 'estudiante',
            estado: 'ACTIVO',
            pass: est.dni
          }, { onConflict: 'usuario' });

          // 2. Inscripción al Trayecto
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
        }

        // Liberar protección de navegación al finalizar
        window.removeEventListener('beforeunload', prevenirSalida);

        if (typeof Swal !== 'undefined') {
          Swal.fire({
            icon: 'success',
            title: '¡Importación Finalizada!',
            text: `Se procesaron correctamente ${total} estudiantes.`,
            confirmButtonText: 'Entendido'
          });
        }

        // Refrescar vistas en pantalla
        if (window.ClasesModulo && typeof window.ClasesModulo.cargarSabanaEstudiantes === 'function') {
          await window.ClasesModulo.cargarSabanaEstudiantes();
        }
        if (window.UsuariosAdmin && typeof window.UsuariosAdmin.cargarUsuarios === 'function') {
          await window.UsuariosAdmin.cargarUsuarios();
        }

      } catch (err) {
        window.removeEventListener('beforeunload', prevenirSalida);
        console.error('Error durante la importación:', err);
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            icon: 'error',
            title: 'Error de Importación',
            text: 'Ocurrió un inconveniente al procesar el archivo.'
          });
        }
      }
    };

    reader.readAsText(file, 'UTF-8');
  }
};

window.ImportadorModulo = ImportadorModulo;
