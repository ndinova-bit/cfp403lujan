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
  }
};

window.ReportesModulo = ReportesModulo;
