/* Planificación del docente, por trayecto (y por módulo si el trayecto tiene módulos).
   La carga el docente (o el administrador); Director y Regente la pueden ver, no editarla.
   Campos genéricos por ahora: se ajustan cuando haya un modelo de planificación definido. */
const PlanificacionModulo = {
  trayectoId: null,
  modulos: [],
  moduloActual: null,
  registros: {},   // modulo_id (o 'null') -> fila

  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  CAMPOS: [
    ['fundamentacion', 'Fundamentación'],
    ['objetivos', 'Objetivos'],
    ['contenidos', 'Contenidos'],
    ['metodologia', 'Metodología / estrategias'],
    ['evaluacion', 'Evaluación (criterios e instrumentos)'],
    ['cronograma', 'Cronograma estimado'],
    ['bibliografia', 'Bibliografía / recursos']
  ],

  async cargar(trayectoId) {
    this.trayectoId = Number(trayectoId);
    const cont = document.getElementById('contenedor-planificacion');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#94a3b8; text-align:center;">Cargando planificación…</p>';

    const perfil = (window.Auth && Auth.usuarioActual) || {};
    const rol = String(perfil.rol || '').toLowerCase().trim();
    this.puedeEditar = Auth.esAdmin(rol) || rol === 'docente';

    try {
      const [rMod, rPlan] = await Promise.all([
        supabase.from('modulos').select('id, nombre').eq('trayecto_id', this.trayectoId).order('id'),
        supabase.from('planificaciones').select('*').eq('trayecto_id', this.trayectoId)
      ]);
      if (rPlan.error) throw rPlan.error;
      this.modulos = (!rMod.error && rMod.data) || [];
      this.registros = {};
      (rPlan.data || []).forEach(p => { this.registros[p.modulo_id || 'null'] = p; });
      this.moduloActual = this.modulos.length ? this.modulos[0].id : null;
      this.render();
    } catch (err) {
      cont.innerHTML = `<div class="prog-vacio">No se pudo cargar la planificación: ${this.esc(err.message || '')}${/planificaciones/.test(err.message || '') ? ' (falta ejecutar sql/33_planificacion.sql en Supabase)' : ''}</div>`;
    }
  },

  claveActual() { return this.modulos.length ? this.moduloActual : 'null'; },

  elegirModulo(id) {
    this.moduloActual = id === 'null' ? null : Number(id);
    this.render();
  },

  render() {
    const cont = document.getElementById('contenedor-planificacion');
    if (!cont) return;
    const reg = this.registros[this.claveActual()] || {};
    cont.innerHTML = `
      ${this.modulos.length ? `
        <div class="plan-tabs">
          ${this.modulos.map(m => `<button type="button" class="plan-tab ${Number(this.moduloActual) === Number(m.id) ? 'activo' : ''}" onclick="PlanificacionModulo.elegirModulo('${Number(m.id)}')">${this.esc(m.nombre)}</button>`).join('')}
        </div>` : ''}
      ${reg.updated_at ? `<p class="plan-meta">Última actualización: ${this.esc(reg.actualizado_por_nombre || '')} · ${String(reg.updated_at).slice(0, 10).split('-').reverse().join('/')}</p>` : '<p class="plan-meta">Todavía no hay planificación cargada.</p>'}
      <form id="plan-form" onsubmit="PlanificacionModulo.guardar(event)" style="display:grid; gap:0.7rem;">
        ${this.CAMPOS.map(([k, etiqueta]) => `
          <label>${etiqueta}<textarea id="plan-${k}" class="act-in" rows="${k === 'contenidos' ? 6 : 3}" ${this.puedeEditar ? '' : 'readonly'}>${this.esc(reg[k] || '')}</textarea></label>
        `).join('')}
        ${this.puedeEditar ? '<div class="act-form-pie"><button type="submit" class="act-btn">💾 Guardar planificación</button></div>' : ''}
      </form>
    `;
  },

  async guardar(e) {
    e.preventDefault();
    const perfil = (window.Auth && Auth.usuarioActual) || {};
    const registro = { trayecto_id: this.trayectoId, modulo_id: this.claveActual() === 'null' ? null : Number(this.claveActual()) };
    this.CAMPOS.forEach(([k]) => { registro[k] = document.getElementById(`plan-${k}`).value.trim() || null; });
    registro.actualizado_por = perfil.id;
    registro.actualizado_por_nombre = `${perfil.apellido || ''}, ${perfil.nombre || ''}`.trim();
    registro.updated_at = new Date().toISOString();
    try {
      let q = supabase.from('planificaciones').select('id').eq('trayecto_id', this.trayectoId);
      q = registro.modulo_id === null ? q.is('modulo_id', null) : q.eq('modulo_id', registro.modulo_id);
      const { data: existente } = await q.maybeSingle();
      const { error } = existente
        ? await supabase.from('planificaciones').update(registro).eq('id', existente.id)
        : await supabase.from('planificaciones').insert([registro]);
      if (error) throw error;
      if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Planificación guardada', showConfirmButton: false, timer: 2000 });
      await this.cargar(this.trayectoId);
    } catch (err) {
      alert('No se pudo guardar: ' + (err.message || ''));
    }
  }
};
window.PlanificacionModulo = PlanificacionModulo;
