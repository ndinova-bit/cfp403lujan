/* ==========================================================================
   js/dashboard.js - Lógica Dinámica del Dashboard Analítico
   ========================================================================== */

const DashboardAdmin = {
  async cargarEstadisticas() {
    const cicloSeleccionado = document.getElementById('filtro-ciclo-dashboard')?.value || '2026';

    try {
      // Cargar datos en paralelo desde Supabase
      const [rTrayectos, rInscripciones] = await Promise.all([
        supabase.from('trayectos').select('*'),
        supabase.from('inscripciones').select('*')
      ]);

      let trayectos = rTrayectos.data || [];
      let inscripciones = rInscripciones.data || [];

      // Filtrar por ciclo lectivo si corresponde
      if (cicloSeleccionado !== 'TODOS') {
        trayectos = trayectos.filter(t => String(t.ciclo_lectivo || '2026') === String(cicloSeleccionado));
        const idsTrayectosCiclo = trayectos.map(t => String(t.id));
        inscripciones = inscripciones.filter(i => idsTrayectosCiclo.includes(String(i.trayecto_id)));
      }

      // 1. Cálculos de KPIs
      const totalTrayectos = trayectos.length;
      const totalInscriptos = inscripciones.length;
      
      const aprobados = inscripciones.filter(i => i.estado === 'APROBADO' || i.acreditado === true).length;
      const certificadosEmitidos = inscripciones.filter(i => i.num_egresado && i.num_egresado.trim() !== '').length;
      const desaprobados = inscripciones.filter(i => i.estado === 'DESAPROBADO' || i.estado === 'AUSENTE').length;

      // 2. Renderizar KPIs en pantalla
      document.getElementById('kpi-trayectos').textContent = totalTrayectos;
      document.getElementById('kpi-inscriptos').textContent = totalInscriptos;
      document.getElementById('kpi-aprobados').textContent = aprobados;
      document.getElementById('kpi-certificados').textContent = certificadosEmitidos;
      document.getElementById('kpi-desaprobados').textContent = desaprobados;

      // 3. Renderizar tabla de desglose por trayecto
      const contenedorDesglose = document.getElementById('desglose-trayectos-dashboard');
      if (!contenedorDesglose) return;

      if (trayectos.length === 0) {
        contenedorDesglose.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem;">No hay trayectos registrados en este ciclo lectivo.</p>';
        return;
      }

      let htmlTabla = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #94a3b8;">
              <th style="padding: 0.5rem;">Trayecto</th>
              <th style="padding: 0.5rem; text-align: center;">Inscriptos</th>
              <th style="padding: 0.5rem; text-align: center;">Aprobados</th>
              <th style="padding: 0.5rem; text-align: right;">Efectividad</th>
            </tr>
          </thead>
          <tbody>
      `;

      trayectos.forEach(t => {
        const insT = inscripciones.filter(i => String(i.trayecto_id) === String(t.id));
        const cantInscriptos = insT.length;
        const cantAprobados = insT.filter(i => i.estado === 'APROBADO' || i.acreditado === true).length;
        const pctEfectividad = cantInscriptos > 0 ? Math.round((cantAprobados / cantInscriptos) * 100) : 0;

        htmlTabla += `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 0.6rem 0.5rem; font-weight: 600; color: #f8fafc;">${t.nombre}</td>
            <td style="padding: 0.6rem 0.5rem; text-align: center;">${cantInscriptos}</td>
            <td style="padding: 0.6rem 0.5rem; text-align: center; color: #4ade80;">${cantAprobados}</td>
            <td style="padding: 0.6rem 0.5rem; text-align: right; color: #fde047; font-weight: 700;">${pctEfectividad}%</td>
          </tr>
        `;
      });

      htmlTabla += '</tbody></table>';
      contenedorDesglose.innerHTML = htmlTabla;

    } catch (err) {
      console.error('Error al cargar métricas del Dashboard:', err);
    }
  }
};

// Cargar estadísticas automáticamente al presionar el botón Dashboard
document.addEventListener('DOMContentLoaded', () => {
  const btnDashboard = document.getElementById('btn-dashboard');
  if (btnDashboard) {
    btnDashboard.addEventListener('click', () => {
      DashboardAdmin.cargarEstadisticas();
    });
  }
  
  // Carga inicial
  DashboardAdmin.cargarEstadisticas();
});
