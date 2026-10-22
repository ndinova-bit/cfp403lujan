/* ==========================================================================
   AUDITORÍA DE CAMBIOS (solo administrador)
   Archivo: js/auditoria.js
   Muestra quién cambió qué y cuándo (tabla `auditoria`, que llenan
   automáticamente disparadores de la base de datos).
   ========================================================================== */

const AuditoriaModulo = {
  nombres: {
    profiles: 'Usuarios / roles',
    inscripciones: 'Inscripciones',
    entregas_actividades: 'Entregas y notas',
    asistencias: 'Asistencias',
    clases: 'Clases',
    trayectos: 'Trayectos',
    modulos: 'Módulos',
    excepciones_modulos: 'Excepciones'
  },
  ops: { INSERT: '➕ Alta', UPDATE: '✏️ Cambio', DELETE: '🗑️ Baja' },

  resumir(obj) {
    if (!obj) return '';
    const txt = Object.entries(obj)
      .filter(([k]) => !['created_at', 'updated_at'].includes(k))
      .map(([k, v]) => `${k}: ${v === null ? '(vacío)' : (typeof v === 'object' ? JSON.stringify(v) : v)}`)
      .join(' · ');
    return txt.length > 220 ? txt.slice(0, 220) + '…' : txt;
  },

  async cargar() {
    const cont = document.getElementById('auditoria-contenido');
    if (!cont) return;
    const e = window.escHtml;
    cont.innerHTML = '<p style="color:#94a3b8;">Cargando…</p>';

    const tabla = document.getElementById('auditoria-filtro-tabla')?.value || '';
    const texto = (document.getElementById('auditoria-filtro-texto')?.value || '').trim();

    let q = supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(200);
    if (tabla) q = q.eq('tabla', tabla);
    if (texto) q = q.or(`usuario_dni.ilike.%${texto.replace(/[,()%]/g, '')}%,registro_id.ilike.%${texto.replace(/[,()%]/g, '')}%`);

    const { data, error } = await q;
    if (error) {
      cont.innerHTML = `<p style="color:#f87171;">No se pudo leer la auditoría: ${e(error.message)}.<br>¿Ya ejecutaste el archivo sql/04_auditoria_y_bajas.sql?</p>`;
      return;
    }
    if (!data || data.length === 0) {
      cont.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:1.5rem;">Todavía no hay cambios registrados.</p>';
      return;
    }

    cont.innerHTML = `
      <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
        <thead><tr style="color:#94a3b8; text-align:left; border-bottom:1px solid rgba(255,255,255,0.1);">
          <th style="padding:0.5rem;">Fecha</th><th style="padding:0.5rem;">Quién</th>
          <th style="padding:0.5rem;">Qué</th><th style="padding:0.5rem;">Antes</th><th style="padding:0.5rem;">Después</th>
        </tr></thead>
        <tbody>${data.map(a => `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05); vertical-align:top;">
            <td style="padding:0.5rem; white-space:nowrap; color:#cbd5e1;">${e(new Date(a.fecha).toLocaleString('es-AR'))}</td>
            <td style="padding:0.5rem; color:#f8fafc;">${e(a.usuario_dni || '—')}<br><span style="color:#94a3b8; font-size:0.72rem;">${e(a.usuario_rol || '')}</span></td>
            <td style="padding:0.5rem; color:#facc15;">${e(this.ops[a.operacion] || a.operacion)}<br><span style="color:#38bdf8;">${e(this.nombres[a.tabla] || a.tabla)}</span> <span style="color:#94a3b8;">#${e(a.registro_id || '')}</span></td>
            <td style="padding:0.5rem; color:#f87171; word-break:break-word;">${e(this.resumir(a.datos_anteriores))}</td>
            <td style="padding:0.5rem; color:#4ade80; word-break:break-word;">${e(this.resumir(a.datos_nuevos))}</td>
          </tr>`).join('')}
        </tbody></table></div>
      <p style="color:#64748b; font-size:0.75rem; margin-top:0.5rem;">Se muestran los últimos 200 movimientos.</p>`;
  }
};

window.AuditoriaModulo = AuditoriaModulo;
