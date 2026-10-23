/* Indicador de espacio usado en la base (sección "Base de Datos", solo administración).
   El plan gratuito de Supabase permite 500 MB de base de datos. */
const UsoBase = {
  LIMITE_MB: 500,

  formato(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  },

  NOMBRES: {
    auditoria: 'Registro de cambios (auditoría)', asistencias: 'Asistencias', entregas_actividades: 'Entregas y notas',
    inscripciones: 'Inscripciones', profiles: 'Usuarios', clases: 'Clases', notificaciones: 'Notificaciones',
    observaciones_estudiante: 'Observaciones', datos_estudiante: 'Datos personales', trayectos: 'Trayectos',
    modulos: 'Módulos', novedades: 'Novedades', padron_estudiantes: 'Padrón', certificados_emitidos: 'Certificados emitidos'
  },

  async cargar() {
    const cont = document.getElementById('uso-base');
    if (!cont) return;
    cont.innerHTML = '<p class="asis-cargando">Midiendo el espacio usado…</p>';
    const { data, error } = await supabase.rpc('uso_base');
    if (error || !data) {
      cont.innerHTML = '<div class="prog-vacio">Para ver el espacio usado, ejecutá <b>sql/10_uso_de_la_base.sql</b> en Supabase.</div>';
      return;
    }
    const total = Number(data.total_bytes) || 0;
    const limite = this.LIMITE_MB * 1024 * 1024;
    const pct = Math.min(100, Math.round(total / limite * 1000) / 10);
    const nivel = pct >= 85 ? 'bad' : (pct >= 70 ? 'mid' : 'ok');
    const mensaje = nivel === 'bad'
      ? 'Queda poco espacio: descargá un respaldo y limpiá el registro de cambios más viejo (te ayudo a hacerlo).'
      : nivel === 'mid'
        ? 'Pasó el 70%: conviene planificar una limpieza del registro de cambios antiguo.'
        : 'Hay espacio de sobra. Los certificados, actas y planillas no ocupan lugar: se generan en el momento.';
    const tablas = (data.tablas || []).filter(t => Number(t.bytes) > 0).slice(0, 8);
    const maxT = Math.max(1, ...tablas.map(t => Number(t.bytes)));
    cont.innerHTML = `
      <div class="uso-cab">
        <div><span class="uso-num">${this.formato(total)}</span><span class="uso-de"> de ${this.LIMITE_MB} MB · ${String(pct).replace('.', ',')}%</span></div>
        <span class="uso-estado ${nivel}">${nivel === 'ok' ? 'Todo bien' : nivel === 'mid' ? 'Atención' : 'Casi lleno'}</span>
      </div>
      <div class="uso-barra" role="img" aria-label="Espacio usado: ${pct}%"><div class="uso-fill ${nivel}" style="width:${Math.max(pct, 1)}%"></div><div class="uso-marca" style="left:70%"></div></div>
      <p class="uso-msg">${mensaje}</p>
      <details class="uso-detalle"><summary>Qué ocupa más</summary>
        <div class="uso-tablas">${tablas.map(t => `
          <div class="uso-fila"><span>${this.NOMBRES[t.tabla] || t.tabla}</span>
            <div class="uso-mini"><div style="width:${Math.max(2, Math.round(Number(t.bytes) / maxT * 100))}%"></div></div>
            <b>${this.formato(Number(t.bytes))}</b></div>`).join('')}</div>
      </details>`;
  }
};
window.UsoBase = UsoBase;
