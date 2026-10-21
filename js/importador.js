/* ==========================================================================
   CARGA MASIVA DE ESTUDIANTES (CSV) A UN TRAYECTO
   Archivo: js/importador.js

   Qué hace el importador:
   1. Guarda a cada persona en el PADRÓN (tabla padron_estudiantes): DNI, nombre,
      apellido y email si lo trae. El padrón NO es una cuenta.
   2. Inscribe a cada DNI en el trayecto elegido (tabla inscripciones).

   Qué NO hace (a propósito): crear cuentas de acceso. Cada estudiante se
   registra solo desde "Solicitar Cuenta" con su DNI y su propia contraseña, y
   la administración aprueba la cuenta. Al registrarse, la base completa su
   nombre y apellido desde el padrón y ya lo encuentra inscripto.
   ========================================================================== */

var ImportadorModulo = {
  trayectoIdActual: null,

  abrirModal(trayectoId) {
    this.trayectoIdActual = trayectoId;

    const input = document.getElementById('input-importar-csv');
    if (input) {
      input.value = '';
      input.click();
    } else {
      alert('No se encontró el selector de archivos en pantalla.');
    }
  },

  // Divide una línea CSV respetando comillas ("PEREZ, JUAN";38123456)
  dividirLinea(linea, sep) {
    const out = [];
    let actual = '';
    let entreComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') {
        if (entreComillas && linea[i + 1] === '"') { actual += '"'; i++; }
        else entreComillas = !entreComillas;
      } else if (c === sep && !entreComillas) {
        out.push(actual.trim());
        actual = '';
      } else {
        actual += c;
      }
    }
    out.push(actual.trim());
    return out;
  },

  cerrarEspera(prevenirSalida) {
    window.removeEventListener('beforeunload', prevenirSalida);
    if (typeof Swal !== 'undefined') Swal.close();
  },

  async procesarCSV(file) {
    if (!file || !this.trayectoIdActual) {
      alert('⚠️ No se seleccionó un archivo válido o no se identificó el trayecto.');
      return;
    }

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: '⏳ Carga Masiva en Proceso',
        html: `
          <div style="margin-top: 10px;">
            <p style="font-size: 14px; color: #aaa;">Por favor no cierre ni recargue la página.</p>
            <strong id="contador-importacion" style="font-size: 18px; color: #3085d6;">Leyendo el archivo...</strong>
          </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
      });
    }

    const prevenirSalida = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', prevenirSalida);

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const contenido = String(e.target.result || '').replace(/^﻿/, '');
        const lineas = contenido.split(/\r\n|\n/).filter(l => l.trim().length > 0);

        if (lineas.length <= 1) {
          this.cerrarEspera(prevenirSalida);
          alert('El archivo CSV está vacío.');
          return;
        }

        const sep = lineas[0].includes(';') ? ';' : ',';
        const colsHeader = this.dividirLinea(lineas[0], sep).map(c => c.toLowerCase());

        const idxDni = colsHeader.findIndex(c => c.includes('dni') || c.includes('documento') || c.includes('usuario'));
        const idxNombre = colsHeader.findIndex(c => c.includes('nombre'));
        const idxApellido = colsHeader.findIndex(c => c.includes('apellido'));
        const idxEmail = colsHeader.findIndex(c => c.includes('email') || c.includes('correo'));

        if (idxDni === -1) {
          this.cerrarEspera(prevenirSalida);
          alert('Columna DNI no encontrada. La primera fila debe tener una columna llamada DNI.');
          return;
        }

        // ---- 1. Leer y limpiar filas ----
        const estudiantes = [];
        const dnisVistos = new Set();
        let filasInvalidas = 0;

        for (let i = 1; i < lineas.length; i++) {
          const valores = this.dividirLinea(lineas[i], sep);
          const dni = (valores[idxDni] || '').replace(/\D/g, '');

          if (dni.length < 6 || dni.length > 9) { filasInvalidas++; continue; }
          if (dnisVistos.has(dni)) continue;
          dnisVistos.add(dni);

          let nombre = (idxNombre !== -1 && valores[idxNombre]) ? valores[idxNombre].toUpperCase() : '';
          let apellido = (idxApellido !== -1 && valores[idxApellido]) ? valores[idxApellido].toUpperCase() : '';

          // Formato "APELLIDO, NOMBRE" en una sola columna
          if (!apellido && nombre.includes(',')) {
            const partes = nombre.split(',');
            apellido = partes[0].trim();
            nombre = (partes[1] || '').trim();
          }

          const emailRaw = (idxEmail !== -1 && valores[idxEmail])
            ? valores[idxEmail].toLowerCase().replace(/\s+/g, '')
            : '';

          estudiantes.push({
            dni,
            nombre: nombre || 'SIN NOMBRE',
            apellido: apellido || 'SIN APELLIDO',
            email: emailRaw.includes('@') ? emailRaw : null
          });
        }

        if (estudiantes.length === 0) {
          this.cerrarEspera(prevenirSalida);
          alert('No se encontró ningún DNI válido en el archivo.');
          return;
        }

        const trayectoId = Number(this.trayectoIdActual);
        const contador = () => document.getElementById('contador-importacion');
        const TAM_LOTE = 200;
        let errores = [];

        // ---- 2. Padrón (se pisan nombre/apellido si el DNI ya estaba) ----
        for (let i = 0; i < estudiantes.length; i += TAM_LOTE) {
          const lote = estudiantes.slice(i, i + TAM_LOTE);
          if (contador()) contador().innerText = `Guardando padrón ${Math.min(i + TAM_LOTE, estudiantes.length)} de ${estudiantes.length}...`;

          const { error } = await supabase
            .from('padron_estudiantes')
            .upsert(lote, { onConflict: 'dni' });

          if (error) errores.push('Padrón: ' + error.message);
        }

        // ---- 3. Inscripciones (solo las que faltan) ----
        const { data: yaInscriptos, error: errLectura } = await supabase
          .from('inscripciones')
          .select('estudiante_user')
          .eq('trayecto_id', trayectoId);

        if (errLectura) errores.push('Lectura de inscripciones: ' + errLectura.message);

        const setYa = new Set((yaInscriptos || []).map(i => String(i.estudiante_user)));
        const nuevos = estudiantes.filter(e => !setYa.has(e.dni));

        for (let i = 0; i < nuevos.length; i += TAM_LOTE) {
          const lote = nuevos.slice(i, i + TAM_LOTE).map(e => ({
            trayecto_id: trayectoId,
            estudiante_user: e.dni
          }));
          if (contador()) contador().innerText = `Inscribiendo ${Math.min(i + TAM_LOTE, nuevos.length)} de ${nuevos.length}...`;

          const { error } = await supabase.from('inscripciones').insert(lote);
          if (error) errores.push('Inscripción: ' + error.message);
        }

        this.cerrarEspera(prevenirSalida);

        // ---- 4. Resumen ----
        const resumen = `
          <div style="text-align:left; font-size: 14px; line-height: 1.6;">
            ✅ <b>${estudiantes.length}</b> estudiantes leídos del archivo<br>
            🆕 <b>${nuevos.length}</b> inscriptos nuevos en este trayecto<br>
            ↩️ <b>${estudiantes.length - nuevos.length}</b> ya estaban inscriptos<br>
            ${filasInvalidas ? `⚠️ <b>${filasInvalidas}</b> filas ignoradas por DNI inválido<br>` : ''}
            ${errores.length ? `<br><span style="color:#f87171">❌ Hubo errores:<br>${errores.map(x => Trayectos.esc(x)).join('<br>')}</span>` : ''}
            <br><small style="color:#94a3b8">Cada estudiante debe registrarse en "Solicitar Cuenta" con su DNI y vos aprobás su cuenta en Usuarios y Roles.</small>
          </div>`;

        if (typeof Swal !== 'undefined') {
          Swal.fire({
            icon: errores.length ? 'warning' : 'success',
            title: errores.length ? 'Importación con errores' : '¡Importación finalizada!',
            html: resumen,
            confirmButtonText: 'Entendido'
          });
        }

        if (window.ClasesModulo && typeof window.ClasesModulo.cargarSabanaEstudiantes === 'function') {
          await window.ClasesModulo.cargarSabanaEstudiantes();
        }
        if (window.UsuariosAdmin && typeof window.UsuariosAdmin.cargarUsuarios === 'function') {
          await window.UsuariosAdmin.cargarUsuarios();
        }

      } catch (err) {
        this.cerrarEspera(prevenirSalida);
        console.error('Error durante la importación:', err);
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            icon: 'error',
            title: 'Error de Importación',
            text: 'Ocurrió un inconveniente al procesar el archivo: ' + (err.message || err)
          });
        }
      }
    };

    reader.readAsText(file, 'UTF-8');
  }
};

window.ImportadorModulo = ImportadorModulo;
