/* ==========================================================================
   CARGA MASIVA DE ESTUDIANTES (CSV o Excel) A UN TRAYECTO
   Archivo: js/importador.js

   Qué hace el importador con cada fila del CSV, usando la función segura
   "importar-estudiantes" que corre dentro de Supabase:
   1. Guarda a la persona en el padrón (DNI, nombre, apellido).
   2. Le crea la cuenta si no tiene (usuario: su DNI; contraseña inicial:
      CFP403_ + DNI) y la deja aprobada.
   3. La inscribe en el trayecto.

   Si la función todavía no está instalada en Supabase, el importador usa el
   modo de respaldo: carga solo el padrón y las inscripciones, sin crear
   cuentas (cada estudiante debe registrarse en "Solicitar Cuenta").
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

    // Fecha de inscripción: si el trayecto ya empezó, se pregunta desde cuándo cuentan como inscriptos
    // (la planilla de matrícula cuenta como inscriptos a quienes se inscribieron hasta el primer día de clases).
    this.fechaInscripcion = null;
    try {
      const { data: tr } = await supabase.from('trayectos').select('fecha_inicio').eq('id', Number(this.trayectoIdActual)).maybeSingle();
      const ini = tr && tr.fecha_inicio ? String(tr.fecha_inicio).slice(0, 10) : '';
      const hoyISO = new Date().toISOString().slice(0, 10);
      if (ini && ini < hoyISO && typeof Swal !== 'undefined') {
        const r = await Swal.fire({
          icon: 'question', title: '¿Desde cuándo están inscriptos?',
          html: `<p style="font-size:.9rem">El trayecto empezó el <b>${ini.split('-').reverse().join('/')}</b>.</p>
                 <p style="font-size:.85rem;color:#555">Si estos estudiantes ya cursaban desde el comienzo, elegí la primera opción: así figuran como inscriptos al primer día en la planilla de matrícula.</p>`,
          showDenyButton: true, showCancelButton: true,
          confirmButtonText: 'Desde el inicio del curso', denyButtonText: 'Desde hoy', cancelButtonText: 'Cancelar'
        });
        if (r.isDismissed) return;
        if (r.isConfirmed) this.fechaInscripcion = ini;
      }
    } catch (e) { /* si no se puede consultar, se usa la fecha de hoy */ }

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
        // Excel suele guardar los CSV en Windows-1252 (ANSI): si no es UTF-8 válido, se decodifica así
        // para que las tildes y las ñ no se rompan.
        const bytes = e.target.result;
        let lineas;
        let noConfirmados = 0;
        if (/\.xlsx$/i.test(file.name)) {
          // Excel (por ejemplo, el listado de inscriptos del IPFL): se convierte a líneas con ";"
          if (typeof ExcelJS === 'undefined') throw new Error('No se pudo cargar el lector de Excel. Recargá la página.');
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(bytes);
          const ws = wb.worksheets[0];
          const celda = (v) => {
            if (v && typeof v === 'object') v = v.text !== undefined ? v.text : (v.result !== undefined ? v.result : (v.richText ? v.richText.map(r => r.text).join('') : ''));
            return String(v ?? '').replace(/[;\r\n]/g, ' ').trim();
          };
          const filas = [];
          ws.eachRow({ includeEmpty: false }, (row) => {
            const vals = [];
            for (let c = 1; c <= ws.columnCount; c++) vals.push(celda(row.getCell(c).value));
            if (vals.some(x => x)) filas.push(vals);
          });
          // Si hay columna "Estado", se descartan las canceladas o dadas de baja en el IPFL
          const cab = (filas[0] || []).map(x => x.toLowerCase());
          const iEst = cab.findIndex(x => x.includes('estado'));
          const utiles = iEst === -1 ? filas : filas.filter((f, i) => {
            if (i === 0) return true;
            // Solo se descartan las inscripciones canceladas (Aprobado, Ausente, Confirmada, etc. se importan)
            const ok = !/cancel|anulad|rechaz|desinscri|baja/i.test(f[iEst] || '');
            if (!ok) noConfirmados++;
            return ok;
          });
          lineas = utiles.map(f => f.join(';'));
        } else {
          let texto;
          try {
            texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
          } catch (_) {
            texto = new TextDecoder('windows-1252').decode(bytes);
          }
          const contenido = texto.replace(/^\uFEFF/, '');
          lineas = contenido.split(/\r\n|\n/).filter(l => l.trim().length > 0);
        }

        if (lineas.length <= 1) {
          this.cerrarEspera(prevenirSalida);
          alert('El archivo está vacío o no tiene filas para importar.');
          return;
        }

        const sep = lineas[0].includes(';') ? ';' : ',';
        const colsHeader = this.dividirLinea(lineas[0], sep).map(c => c.toLowerCase());

        const idxDni = colsHeader.findIndex(c => c.includes('dni') || c.includes('documento') || c.includes('usuario'));
        const idxNombre = colsHeader.findIndex(c => c.includes('nombre'));
        const idxApellido = colsHeader.findIndex(c => c.includes('apellido'));
        const idxEmail = colsHeader.findIndex(c => c.includes('email') || c.includes('correo'));
        // Columnas opcionales de la Ficha de Curso
        const idxCol = (fn) => colsHeader.findIndex(fn);
        const extra = {
          fecha_nacimiento: idxCol(c => c.includes('nacimiento') && c.includes('fecha')),
          lugar_nacimiento: idxCol(c => c.includes('lugar') && c.includes('nac')),
          domicilio: idxCol(c => c.includes('domicilio') || c.includes('direcci')),
          localidad: idxCol(c => c.includes('localidad')),
          codigo_postal: idxCol(c => c.includes('postal') || c.trim() === 'cp'),
          telefono: idxCol(c => c.includes('tel') || c.includes('celular')),
          estudios: idxCol(c => c.includes('estudio')),
          genero: idxCol(c => c.includes('genero') || c.includes('género') || c.includes('sexo'))
        };
        const hayExtra = Object.values(extra).some(i => i !== -1);
        const fechaISO = (v) => {
          const t = String(v || '').trim();
          let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
          if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
          m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          return m ? t : null;
        };
        const datosPersonales = [];

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

          if (hayExtra) {
            const d = { dni };
            Object.entries(extra).forEach(([k, idx]) => {
              if (idx === -1) return;
              const v = String(valores[idx] || '').trim();
              if (!v) return;
              if (k === 'genero') {
                const g = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                const norm = /^(f|fem|femenino|mujer|female)$/.test(g) ? 'F' : /^(m|masc|masculino|varon|hombre|male)$/.test(g) ? 'M' : /^(x|otro|otra|no binario|nb|no binarie)$/.test(g) ? 'X' : null;
                if (norm) d[k] = norm;
                return;
              }
              d[k] = k === 'fecha_nacimiento' ? fechaISO(v) : v.slice(0, 160);
            });
            if (Object.keys(d).length > 1) datosPersonales.push(d);
          }
        }

        if (estudiantes.length === 0) {
          this.cerrarEspera(prevenirSalida);
          alert('No se encontró ningún DNI válido en el archivo.');
          return;
        }

        const trayectoId = Number(this.trayectoIdActual);
        const contador = () => document.getElementById('contador-importacion');
        const errores = [];

        // ---- 2. Función del servidor: cuentas + padrón + inscripción ----
        const srv = { creados: 0, ya_tenian_cuenta: 0, aprobados: 0, inscriptos_nuevos: 0, ya_inscriptos: 0 };
        let usoServidor = true;
        let motivoFallback = '';
        const TAM_SRV = 25;

        for (let i = 0; i < estudiantes.length; i += TAM_SRV) {
          const lote = estudiantes.slice(i, i + TAM_SRV);
          if (contador()) contador().innerText = `Creando cuentas e inscribiendo ${Math.min(i + TAM_SRV, estudiantes.length)} de ${estudiantes.length}...`;

          let data = null;
          let error = null;
          try {
            const r = await supabase.functions.invoke('importar-estudiantes', {
              body: { trayecto_id: trayectoId, estudiantes: lote }
            });
            data = r.data;
            error = r.error;
          } catch (ex) {
            error = ex;
          }

          if (error || !data || data.error) {
            if (i === 0) {
              // La función no está instalada o no respondió: se usa el modo de respaldo
              usoServidor = false;
              motivoFallback = (data && data.error) || (error && error.message) || 'sin respuesta';
              break;
            }
            errores.push('Servidor: ' + ((data && data.error) || (error && error.message) || 'error desconocido'));
            continue;
          }

          Object.keys(srv).forEach(k => { srv[k] += data[k] || 0; });
          (data.errores || []).forEach(x => errores.push(x));
        }

        // ---- 3. Modo de respaldo: solo padrón e inscripción (sin crear cuentas) ----
        let nuevos = [];
        if (!usoServidor) {
          const TAM_LOTE = 200;

          for (let i = 0; i < estudiantes.length; i += TAM_LOTE) {
            const lote = estudiantes.slice(i, i + TAM_LOTE);
            if (contador()) contador().innerText = `Guardando padrón ${Math.min(i + TAM_LOTE, estudiantes.length)} de ${estudiantes.length}...`;

            const { error } = await supabase
              .from('padron_estudiantes')
              .upsert(lote, { onConflict: 'dni' });
            if (error) errores.push('Padrón: ' + error.message);
          }

          const { data: yaInscriptos, error: errLectura } = await supabase
            .from('inscripciones')
            .select('estudiante_user')
            .eq('trayecto_id', trayectoId);
          if (errLectura) errores.push('Lectura de inscripciones: ' + errLectura.message);

          const setYa = new Set((yaInscriptos || []).map(i => String(i.estudiante_user)));
          nuevos = estudiantes.filter(x => !setYa.has(x.dni));

          for (let i = 0; i < nuevos.length; i += TAM_LOTE) {
            const lote = nuevos.slice(i, i + TAM_LOTE).map(x => ({ trayecto_id: trayectoId, estudiante_user: x.dni }));
            if (contador()) contador().innerText = `Inscribiendo ${Math.min(i + TAM_LOTE, nuevos.length)} de ${nuevos.length}...`;

            const { error } = await supabase.from('inscripciones').insert(lote);
            if (error) errores.push('Inscripción: ' + error.message);
          }
        }

        // ---- 3b. Datos personales para la Ficha de Curso (si el CSV los trae) ----
        let datosGuardados = 0;
        if (datosPersonales.length) {
          if (contador()) contador().innerText = 'Guardando datos personales…';
          for (let i = 0; i < datosPersonales.length; i += 200) {
            const { error } = await supabase.from('datos_estudiante').upsert(datosPersonales.slice(i, i + 200), { onConflict: 'dni' });
            if (error) { errores.push('Datos personales: ' + error.message); break; }
            datosGuardados += Math.min(200, datosPersonales.length - i);
          }
        }

        // ---- 3c. Fecha de inscripción elegida (solo si es anterior a la que guardó el servidor) ----
        if (this.fechaInscripcion) {
          const dnis = estudiantes.map(x => x.dni);
          for (let i = 0; i < dnis.length; i += 100) {
            const { error } = await supabase.from('inscripciones').update({ fecha_inscripcion: this.fechaInscripcion })
              .eq('trayecto_id', trayectoId).in('estudiante_user', dnis.slice(i, i + 100)).gt('fecha_inscripcion', this.fechaInscripcion);
            if (error) { errores.push('Fecha de inscripción: ' + error.message); break; }
          }
        }

        this.cerrarEspera(prevenirSalida);

        // ---- 4. Resumen ----
        const esc = (t) => (window.Trayectos ? Trayectos.esc(t) : String(t));

        const detalle = usoServidor ? `
            ✅ <b>${estudiantes.length}</b> estudiantes leídos del archivo<br>
            🔑 <b>${srv.creados}</b> cuentas creadas: ya pueden ingresar con su DNI<br>
            👤 <b>${srv.ya_tenian_cuenta}</b> ya tenían cuenta${srv.aprobados ? ` (<b>${srv.aprobados}</b> estaban pendientes y quedaron aprobadas)` : ''}<br>
            🆕 <b>${srv.inscriptos_nuevos}</b> inscriptos nuevos en este trayecto<br>
            ↩️ <b>${srv.ya_inscriptos}</b> ya estaban inscriptos<br>`
        : `
            ⚠️ <b>No se crearon cuentas</b>: la función del servidor no respondió (${esc(motivoFallback)}). Se cargó solo el padrón y la inscripción.<br>
            ✅ <b>${estudiantes.length}</b> estudiantes leídos del archivo<br>
            🆕 <b>${nuevos.length}</b> inscriptos nuevos en este trayecto<br>
            ↩️ <b>${estudiantes.length - nuevos.length}</b> ya estaban inscriptos<br>`;

        const pie = usoServidor
          ? 'Usuario: el DNI. Contraseña inicial: CFP403_ seguido del DNI. Cada persona puede cambiarla desde "Cambiar mi contraseña".'
          : 'Cada estudiante debe registrarse en "Solicitar Cuenta" con su DNI y vos aprobás su cuenta en Usuarios y Roles.';

        const resumen = `
          <div style="text-align:left; font-size: 14px; line-height: 1.6;">
            ${detalle}
            ${filasInvalidas ? `⚠️ <b>${filasInvalidas}</b> filas ignoradas por DNI inválido<br>` : ''}
            ${noConfirmados ? `⏸️ <b>${noConfirmados}</b> inscripciones canceladas en el IPFL (no se cargaron)<br>` : ''}
            ${datosGuardados ? `🗂️ <b>${datosGuardados}</b> con datos personales para la Ficha de Curso<br>` : ''}
            ${errores.length ? `<br><span style="color:#f87171">❌ Hubo errores:<br>${errores.map(x => esc(x)).join('<br>')}</span><br>` : ''}
            <br><small style="color:#94a3b8">${pie}</small>
          </div>`;

        if (typeof Swal !== 'undefined') {
          Swal.fire({
            icon: (errores.length || !usoServidor) ? 'warning' : 'success',
            title: errores.length ? 'Importación con errores' : '¡Importación finalizada!',
            html: resumen,
            confirmButtonText: 'Entendido',
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

    reader.readAsArrayBuffer(file);
  }
};

window.ImportadorModulo = ImportadorModulo;
