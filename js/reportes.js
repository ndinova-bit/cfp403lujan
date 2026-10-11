const ReportesModulo = {
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

  async descargarBackupCompletoJSON() {
    try {
      const [rClases, rEntregas, rInscripciones, rExcepciones, rAsistencias] = await Promise.all([
        supabase.from('clases').select('*'),
        supabase.from('entregas_actividades').select('*'),
        supabase.from('inscripciones').select('*'),
        supabase.from('excepciones_estudiantes').select('*'),
        supabase.from('asistencias').select('*')
      ]);

      const backup = {
        fecha_backup: new Date().toISOString(),
        clases: rClases.data || [],
        entregas_actividades: rEntregas.data || [],
        inscripciones: rInscripciones.data || [],
        excepciones_estudiantes: rExcepciones.data || [],
        asistencias: rAsistencias.data || []
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Backup_Plataforma_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

    } catch (err) {
      console.error('Error al generar backup:', err);
      alert('Error al generar backup de seguridad: ' + err.message);
    }
  }
};

window.ReportesModulo = ReportesModulo;
