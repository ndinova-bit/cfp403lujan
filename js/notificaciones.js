const NotificacionesModulo = {
  async inicializar() {
    const sesionRaw = localStorage.getItem('usuario_actual') || localStorage.getItem('usuario_logueado') || sessionStorage.getItem('usuario_logueado');
    if (!sesionRaw) return;

    const perfil = JSON.parse(sesionRaw);
    const esEstudiante = String(perfil.rol || '').toLowerCase().trim() === 'estudiante';
    if (!esEstudiante) return;

    const userEstudiante = String(perfil.usuario || perfil.dni || perfil.id);
    await this.renderizarCampana(userEstudiante);
  },

  async renderizarCampana(userEstudiante) {
    let contenedorNav = document.querySelector('.navbar, header, nav, .top-bar');
    if (!contenedorNav) contenedorNav = document.body;

    let btnCampana = document.getElementById('btn-notificaciones-campana');
    if (!btnCampana) {
      btnCampana = document.createElement('div');
      btnCampana.id = 'btn-notificaciones-campana';
      btnCampana.style.cssText = 'position:fixed; top:12px; right:20px; z-index:99999; cursor:pointer; font-size:1.3rem; background:#1e293b; padding:0.4rem 0.8rem; border-radius:20px; border:1px solid rgba(255,255,255,0.15); display:flex; align-items:center; gap:0.4rem; color:#fff; box-shadow:0 4px 10px rgba(0,0,0,0.3);';
      document.body.appendChild(btnCampana);
    }

    try {
      const { data: notifs, error } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('estudiante_user', userEstudiante)
        .order('id', { ascending: false });

      if (error) throw error;

      const noLeidas = (notifs || []).filter(n => !n.leido).length;

      btnCampana.innerHTML = `
        🔔 ${noLeidas > 0 ? `<span style="background:#ef4444; color:#fff; font-size:0.75rem; font-weight:bold; padding:0.1rem 0.4rem; border-radius:10px;">${noLeidas}</span>` : ''}
      `;

      btnCampana.onclick = () => this.abrirModalNotificaciones(notifs || [], userEstudiante);

    } catch (err) {
      console.error('Error al cargar notificaciones:', err);
    }
  },

  async abrirModalNotificaciones(notifs, userEstudiante) {
    let modal = document.getElementById('modal-notificaciones-panel');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-notificaciones-panel';
      modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:100000; justify-content:center; align-items:center; padding:1rem;';
      document.body.appendChild(modal);
    }

    const itemsHTML = notifs.length === 0 
      ? '<p style="color:#94a3b8; text-align:center; padding:1rem;">No tenés notificaciones recientes.</p>'
      : notifs.map(n => `
        <div style="background:${n.leido ? 'rgba(255,255,255,0.02)' : 'rgba(56,189,248,0.1)'}; border:1px solid ${n.leido ? 'rgba(255,255,255,0.05)' : 'rgba(56,189,248,0.3)'}; border-radius:8px; padding:0.8rem; margin-bottom:0.6rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <strong style="color:#38bdf8; font-size:0.88rem;">${escHtml(n.titulo)}</strong>
            <span style="font-size:0.72rem; color:#94a3b8;">${new Date(n.created_at).toLocaleDateString()}</span>
          </div>
          <p style="margin:0; font-size:0.82rem; color:#cbd5e1;">${escHtml(n.mensaje)}</p>
        </div>
      `).join('');

    modal.innerHTML = `
      <div style="background:#0f172a; border:1px solid rgba(255,255,255,0.15); border-radius:12px; width:100%; max-width:500px; max-height:80vh; display:flex; flex-direction:column; color:#fff; box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
        <div style="padding:1rem; background:#1e293b; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#facc15; font-size:0.95rem;">🔔 Centro de Notificaciones</strong>
          <button type="button" onclick="document.getElementById('modal-notificaciones-panel').style.display='none'" style="background:none; border:none; color:#f87171; font-size:1.4rem; cursor:pointer;">✕</button>
        </div>
        <div style="padding:1rem; overflow-y:auto; flex:1;">
          ${itemsHTML}
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    // Marcar todas como leídas al abrir
    try {
      await supabase
        .from('notificaciones')
        .update({ leido: true })
        .eq('estudiante_user', userEstudiante)
        .eq('leido', false);

      await this.renderizarCampana(userEstudiante);
    } catch (err) {
      console.error('Error al marcar leídas:', err);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => NotificacionesModulo.inicializar(), 1000);
});
