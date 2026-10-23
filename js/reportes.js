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

  /* ---------- Copia de seguridad (JSON) ----------
     Descarga TODAS las tablas de la plataforma, de a 1000 filas (Supabase devuelve como
     máximo 1000 por consulta: antes las tablas grandes quedaban cortadas). */
  TABLAS_BACKUP: [
    'profiles', 'padron_estudiantes', 'trayectos', 'modulos', 'trayecto_docentes', 'inscripciones', 'datos_estudiante',
    'observaciones_estudiante', 'clases', 'claves_actividad', 'banco_preguntas', 'entregas_actividades', 'asistencias',
    'excepciones_estudiantes', 'modulos_acreditados', 'actas_examen', 'certificados_emitidos', 'novedades',
    'notificaciones', 'auditoria'
  ],

  async leerTablaCompleta(tabla) {
    const filas = [];
    for (let desde = 0; desde < 500000; desde += 1000) {
      const { data, error } = await supabase.from(tabla).select('*').range(desde, desde + 999);
      if (error) throw error;
      filas.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return filas;
  },

  async descargarBackupCompletoJSON() {
    const aviso = (t) => { if (typeof Swal !== 'undefined') Swal.fire({ title: t, allowOutsideClick: false, didOpen: () => Swal.showLoading() }); };
    try {
      const backup = { fecha_backup: new Date().toISOString(), version: 2, tablas: {} };
      const omitidas = [];
      for (const t of this.TABLAS_BACKUP) {
        aviso(`Copiando ${t}…`);
        try { backup.tablas[t] = await this.leerTablaCompleta(t); } catch (e) { omitidas.push(t); }
      }
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Respaldo_CFP403_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      const resumen = Object.entries(backup.tablas).map(([t, f]) => `${t}: ${f.length}`).join(' · ');
      if (typeof Swal !== 'undefined') Swal.fire({ icon: 'success', title: 'Respaldo descargado', html: `<p style="font-size:.85rem">${resumen}</p>${omitidas.length ? `<p style="font-size:.8rem;color:#9b1c1c">No se pudieron copiar: ${omitidas.join(', ')}</p>` : ''}<p style="font-size:.8rem">Tiene datos personales: guardalo en un lugar seguro (no lo compartas ni lo subas a GitHub).</p>` });
    } catch (err) {
      console.error('Error al generar backup:', err);
      alert('Error al generar el respaldo: ' + err.message);
    }
  },

  // Restaurar desde un respaldo JSON (solo administración). Agrega o actualiza filas; no borra nada.
  async restaurarBackupDesdeJSON() {
    const perfil = (window.Auth && Auth.usuarioActual) || {};
    if (!['admin', 'administrador'].includes(String(perfil.rol || '').toLowerCase())) {
      alert('⛔ Esta acción está reservada a la Dirección.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;
      try {
        const data = JSON.parse(await archivo.text());
        // Formato nuevo { tablas: {...} } o anterior (tablas sueltas)
        const tablas = data && data.tablas ? data.tablas : data;
        const orden = this.TABLAS_BACKUP.filter(t => t !== 'auditoria' && Array.isArray(tablas[t]) && tablas[t].length);
        if (!orden.length) throw new Error('El archivo no tiene tablas de la plataforma.');
        const resumen = orden.map(t => `${t}: ${tablas[t].length}`).join('\n');
        if (!confirm(`Respaldo del ${data.fecha_backup ? new Date(data.fecha_backup).toLocaleString('es-AR') : '(sin fecha)'}.\n\nSe van a agregar o actualizar estas filas (no se borra nada):\n${resumen}\n\n¿Continuar?`)) return;
        const errores = [];
        for (const t of orden) {
          const filas = tablas[t];
          for (let i = 0; i < filas.length; i += 500) {
            const clave = t === 'claves_actividad' ? 'clase_id' : (t === 'datos_estudiante' ? 'dni' : 'id');
            const { error } = await supabase.from(t).upsert(filas.slice(i, i + 500), { onConflict: clave });
            if (error) { errores.push(`${t}: ${error.message}`); break; }
          }
        }
        if (errores.length) alert('⚠️ Restauración con observaciones:\n\n' + errores.join('\n'));
        else { alert('✅ Respaldo restaurado.'); window.location.reload(); }
      } catch (err) {
        console.error('Error al restaurar:', err);
        alert('❌ No se pudo restaurar: ' + err.message);
      }
    };
    input.click();
  }
};

window.ReportesModulo = ReportesModulo;
