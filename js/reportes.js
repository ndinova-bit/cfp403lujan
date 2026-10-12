const ReportesModulo = {
  // Exportar cualquier tabla visible a archivo CSV/Excel
  exportarExcelTabla(idTabla, nombreArchivo = 'Sabana_Notas.csv') {
    const tabla = document.getElementById(idTabla) || document.querySelector('table');
    if (!tabla) {
      alert('No hay datos disponibles en pantalla para exportar.');
      return;
    }

    let csvContent = '\uFEFF'; // UTF-8 BOM
    const filas = tabla.querySelectorAll('tr');

    filas.forEach(f => {
      const celdas = f.querySelectorAll('th, td');
      const filaTexto = Array.from(celdas).map(c => `"${c.innerText.replace(/"/g, '""').trim()}"`).join(';');
      csvContent += filaTexto + '\r\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nombreArchivo;
    link.click();
  },

  // Copia de seguridad integral en JSON (Todas las tablas de Supabase)
  async descargarBackupCompletoJSON() {
    try {
      const [
        rUsuarios,
        rTrayectos,
        rModulos,
        rClases,
        rInscripciones,
        rEntregas,
        rAsistencias,
        rExcepciones,
        rNotificaciones
      ] = await Promise.all([
        supabase.from('usuarios').select('*'),
        supabase.from('trayectos').select('*'),
        supabase.from('modulos').select('*'),
        supabase.from('clases').select('*'),
        supabase.from('inscripciones').select('*'),
        supabase.from('entregas_actividades').select('*'),
        supabase.from('asistencias').select('*'),
        supabase.from('excepciones_estudiantes').select('*'),
        supabase.from('notificaciones').select('*')
      ]);

      const backup = {
        fecha_backup: new Date().toISOString(),
        usuarios: rUsuarios.data || [],
        trayectos: rTrayectos.data || [],
        modulos: rModulos.data || [],
        clases: rClases.data || [],
        inscripciones: rInscripciones.data || [],
        entregas_actividades: rEntregas.data || [],
        asistencias: rAsistencias.data || [],
        excepciones_estudiantes: rExcepciones.data || [],
        notificaciones: rNotificaciones.data || []
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
      const downloadAnchor = document.createElement('a');
      const fechaHoy = new Date().toISOString().split('T')[0];

      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Backup_Plataforma_${fechaHoy}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      alert('✅ Copia de seguridad integral descargada en JSON.');

    } catch (err) {
      console.error('Error al generar backup:', err);
      alert('Error al generar backup de seguridad: ' + err.message);
    }
  },

  // Restaurar Base de Datos completa desde un archivo JSON (Exclusivo Admin)
  async restaurarBackupDesdeJSON() {
    const perfilRaw = localStorage.getItem('usuario_actual') || 
                      localStorage.getItem('usuario_logueado') || 
                      sessionStorage.getItem('usuario_logueado');
    const perfil = perfilRaw ? JSON.parse(perfilRaw) : {};
    const rolNorm = String(perfil.rol || '').toLowerCase().trim();

    if (rolNorm !== 'admin' && rolNorm !== 'administrador') {
      alert('⛔ Acceso denegado. Esta acción está reservada únicamente para el Administrador.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;

      if (!confirm('⚠️ ¿Estás seguro de que deseas restaurar la base de datos? Esto insertará o actualizará la información existente.')) {
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);

          if (!data || typeof data !== 'object') {
            throw new Error('El archivo cargado no contiene un formato JSON válido.');
          }

          const tablas = [
            'usuarios',
            'trayectos',
            'modulos',
            'clases',
            'inscripciones',
            'entregas_actividades',
            'asistencias',
            'excepciones_estudiantes',
            'notificaciones'
          ];

          let errores = [];

          for (const tabla of tablas) {
            if (Array.isArray(data[tabla]) && data[tabla].length > 0) {
              const { error } = await supabase.from(tabla).upsert(data[tabla]);
              if (error) {
                console.error(`Error procesando tabla ${tabla}:`, error);
                errores.push(`${tabla}: ${error.message}`);
              }
            }
          }

          if (errores.length > 0) {
            alert('⚠️ Restauración parcial. Ocurrieron errores en las siguientes tablas:\n\n' + errores.join('\n'));
          } else {
            alert('🎉 ¡Base de datos restaurada con éxito!');
            window.location.reload();
          }

        } catch (err) {
          console.error('Error al restaurar backup:', err);
          alert('❌ Error al procesar la restauración: ' + err.message);
        }
      };

      reader.readAsText(archivo);
    };

    input.click();
  };

window.ReportesModulo = ReportesModulo;
