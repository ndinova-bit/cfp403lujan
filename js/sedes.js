/* ==========================================================================
   SEDES Y SUBSEDES (lista con nombre y dirección)
   Se elige en el formulario del trayecto; la planilla de matrícula escribe
   «Subsede Nombre - Dirección». Las administran dirección y regencia.
   Archivo: js/sedes.js
   ========================================================================== */
const SedesModulo = {
  lista: [],

  esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  async cargar() {
    try {
      const { data, error } = await supabase.from('sedes').select('*').order('tipo', { ascending: true }).order('nombre', { ascending: true });
      this.lista = error ? [] : (data || []);
      this.disponible = !error;
    } catch (e) { this.lista = []; this.disponible = false; }
    return this.lista;
  },

  /* Llena el desplegable del formulario del trayecto */
  async poblar() {
    const sel = document.getElementById('trayecto-sede-id');
    if (!sel) return;
    await this.cargar();
    const actual = sel.value;
    sel.innerHTML = `<option value="">En sede (sin elegir una de la lista)</option>
      ${this.lista.map(s => `<option value="${Number(s.id)}">${s.tipo === 'subsede' ? 'Subsede' : 'Sede'} ${this.esc(s.nombre)} · ${this.esc(s.direccion)}</option>`).join('')}
      <option value="otro">Otro lugar (escribir a mano)</option>`;
    sel.value = [...sel.options].some(o => o.value === actual) ? actual : '';
    this.alElegir();
  },

  /* Al elegir, se ajustan los campos viejos (sede / lugar) que usa el resto de la plataforma */
  alElegir() {
    const sel = document.getElementById('trayecto-sede-id');
    const leg = document.getElementById('trayecto-sede');
    const grupo = document.getElementById('grupo-lugar-dictado');
    if (!sel || !leg) return;
    const v = sel.value;
    if (v === 'otro') { leg.value = 'fuera'; if (grupo) grupo.style.display = ''; return; }
    const s = this.lista.find(x => String(x.id) === v);
    leg.value = s && s.tipo === 'subsede' ? 'fuera' : 'sede';
    if (grupo) grupo.style.display = 'none';
  },

  /* Al editar un trayecto: deja elegida su sede */
  alCargar(trayecto) {
    const sel = document.getElementById('trayecto-sede-id');
    if (!sel) return;
    sel.value = trayecto.sede_id ? String(trayecto.sede_id) : (trayecto.sede === 'fuera' ? 'otro' : '');
    if (sel.value !== (trayecto.sede_id ? String(trayecto.sede_id) : (trayecto.sede === 'fuera' ? 'otro' : ''))) sel.value = '';
    const grupo = document.getElementById('grupo-lugar-dictado');
    if (sel.value === 'otro' && grupo) grupo.style.display = '';
    else if (sel.value !== 'otro') this.alElegir();
  },

  /* ---------- Administración de la lista ---------- */
  async abrirAdmin() {
    await this.cargar();
    if (!this.disponible) { alert('Falta ejecutar sql/20_sedes.sql en Supabase.'); return; }
    const filas = this.lista.map(s => `<tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:.4rem"><b>${s.tipo === 'subsede' ? 'Subsede' : 'Sede'} ${this.esc(s.nombre)}</b><br><small>${this.esc(s.direccion)}</small></td>
      <td style="padding:.4rem;text-align:right;white-space:nowrap">
        <button type="button" class="swal2-styled" style="margin:0 .2rem;padding:.3rem .6rem;font-size:.8rem" onclick="SedesModulo.editar(${Number(s.id)})">Editar</button>
        <button type="button" class="swal2-styled" style="margin:0;padding:.3rem .6rem;font-size:.8rem;background:#dc2626" onclick="SedesModulo.borrar(${Number(s.id)})">Quitar</button></td></tr>`).join('');
    await Swal.fire({
      title: 'Sedes y subsedes', width: 700, showConfirmButton: false, showCloseButton: true,
      html: `<div style="text-align:left"><table style="width:100%;border-collapse:collapse;font-size:.9rem">${filas || '<tr><td>Todavía no hay ninguna.</td></tr>'}</table>
        <div style="text-align:center;margin-top:1rem"><button type="button" class="swal2-confirm swal2-styled" onclick="SedesModulo.editar(null)">+ Agregar sede o subsede</button></div></div>`
    });
    this.poblar();
  },

  async editar(id) {
    const s = id ? this.lista.find(x => Number(x.id) === Number(id)) : null;
    const r = await Swal.fire({
      title: s ? 'Editar' : 'Nueva sede o subsede', showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Volver',
      html: `<div style="text-align:left;display:grid;gap:.5rem">
        <label>Tipo<select id="sd-tipo" class="swal2-select" style="width:100%;margin:.2rem 0 0"><option value="subsede" ${s && s.tipo === 'sede' ? '' : 'selected'}>Subsede</option><option value="sede" ${s && s.tipo === 'sede' ? 'selected' : ''}>Sede</option></select></label>
        <label>Nombre (ej.: Olivera)<input id="sd-nombre" class="swal2-input" style="width:100%;margin:.2rem 0 0" maxlength="80" value="${this.esc(s ? s.nombre : '')}"></label>
        <label>Dirección<input id="sd-dir" class="swal2-input" style="width:100%;margin:.2rem 0 0" maxlength="160" value="${this.esc(s ? s.direccion : '')}"></label></div>`,
      preConfirm: () => {
        const v = { tipo: document.getElementById('sd-tipo').value, nombre: document.getElementById('sd-nombre').value.trim(), direccion: document.getElementById('sd-dir').value.trim() };
        if (!v.nombre || !v.direccion) { Swal.showValidationMessage('Completá el nombre y la dirección'); return false; }
        return v;
      }
    });
    if (!r.isConfirmed) { this.abrirAdmin(); return; }
    const { error } = s ? await supabase.from('sedes').update(r.value).eq('id', Number(s.id)) : await supabase.from('sedes').insert(r.value);
    if (error) alert('No se pudo guardar: ' + error.message);
    this.abrirAdmin();
  },

  async borrar(id) {
    if (!confirm('¿Quitar esta sede de la lista? Los trayectos que la usan conservan el lugar que ya tenían escrito.')) { this.abrirAdmin(); return; }
    const { error } = await supabase.from('sedes').delete().eq('id', Number(id));
    if (error) alert('No se pudo quitar: ' + error.message);
    this.abrirAdmin();
  }
};
window.SedesModulo = SedesModulo;
