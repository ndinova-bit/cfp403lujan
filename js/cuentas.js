/* ==========================================================================
   CUENTAS (regencia y preceptoría)
   Restablecer la clave de estudiantes y docentes (queda CFP403_<DNI>) y
   aprobar estudiantes que se registraron y están pendientes. No cambia roles
   ni crea o borra usuarios: eso sigue siendo solo de administración.
   Archivo: js/cuentas.js
   ========================================================================== */

const CuentasModulo = {
  lista: [],
  busqueda: '',
  LIMITE: 40,

  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  async cargar() {
    const cont = document.getElementById('cuentas-contenido');
    if (!cont) return;
    cont.innerHTML = '<p class="seg-cargando">Cargando cuentas…</p>';
    try {
      const { data, error } = await supabase.from('profiles')
        .select('id, dni, nombre, apellido, rol, estado')
        .in('rol', ['estudiante', 'docente'])
        .order('apellido', { ascending: true });
      if (error) throw error;
      this.lista = data || [];
      this.dibujar();
    } catch (err) {
      console.error('Cuentas:', err);
      cont.innerHTML = '<div class="prog-vacio">No se pudieron cargar las cuentas. Probá recargar la página.</div>';
    }
  },

  nombre(u) { return u.apellido ? `${u.apellido}, ${u.nombre || ''}` : (u.nombre || u.dni || ''); },
  pendiente(u) { return String(u.estado || '').toUpperCase() === 'PENDIENTE'; },

  fila(u) {
    const pend = this.pendiente(u);
    return `<tr>
      <td class="sec-nombre">${this.esc(this.nombre(u))}<br><small>DNI ${this.esc(u.dni || '—')}</small></td>
      <td>${u.rol === 'docente' ? 'Docente' : 'Estudiante'}</td>
      <td>${pend ? '<span class="sec-aviso">Pendiente</span>' : this.esc(String(u.estado || 'ACTIVO').toLowerCase())}</td>
      <td class="cuentas-acc">
        ${pend && u.rol === 'estudiante' ? `<button type="button" class="btn btn-gold" onclick="CuentasModulo.aprobar('${this.esc(u.id)}')">✓ Aprobar</button>` : ''}
        <button type="button" class="btn btn-outline" onclick="CuentasModulo.restablecer('${this.esc(u.id)}')">🔑 Restablecer clave</button>
      </td></tr>`;
  },

  dibujar() {
    const cont = document.getElementById('cuentas-contenido');
    if (!cont) return;
    const q = this.busqueda.trim().toLowerCase();
    const coincide = u => !q || `${u.dni || ''} ${u.apellido || ''} ${u.nombre || ''}`.toLowerCase().includes(q);
    const pendientes = this.lista.filter(u => this.pendiente(u) && u.rol === 'estudiante');
    const resto = this.lista.filter(u => !(this.pendiente(u) && u.rol === 'estudiante') && coincide(u));
    const vista = resto.slice(0, this.LIMITE);

    cont.innerHTML = `
      <p class="acta-ayuda">Acá podés restablecer la clave de estudiantes y docentes (queda <b>CFP403_</b> seguido del DNI) y aprobar a los estudiantes que se registraron. Los roles y el resto de las cuentas los gestiona administración. Cada restablecimiento queda registrado en la auditoría.</p>
      ${pendientes.length ? `
        <h3 class="cuentas-tit">Pendientes de aprobación (${pendientes.length})</h3>
        <div class="sec-tabla-wrap"><table class="sec-tabla"><tbody>${pendientes.map(u => this.fila(u)).join('')}</tbody></table></div>` : ''}
      <h3 class="cuentas-tit">Buscar una cuenta</h3>
      <div class="sec-barra"><label>DNI, apellido o nombre
        <input id="cuentas-buscar" class="form-control" type="search" autocomplete="off" value="${this.esc(this.busqueda)}" oninput="CuentasModulo.buscar(this.value)" placeholder="Escribí para buscar"></label></div>
      <div class="sec-tabla-wrap"><table class="sec-tabla"><tbody>
        ${vista.length ? vista.map(u => this.fila(u)).join('') : '<tr><td>No hay cuentas que coincidan.</td></tr>'}
      </tbody></table></div>
      ${resto.length > vista.length ? `<p class="acta-ayuda">Se muestran ${vista.length} de ${resto.length}. Escribí el DNI o el apellido para acotar.</p>` : ''}`;
  },

  buscar(v) {
    this.busqueda = v || '';
    this.dibujar();
    const i = document.getElementById('cuentas-buscar');
    if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  },

  async restablecer(id) {
    const u = this.lista.find(x => String(x.id) === String(id));
    if (!u) return;
    const ok = await Swal.fire({
      title: 'Restablecer contraseña',
      html: `La clave de <b>${this.esc(this.nombre(u))}</b> (DNI ${this.esc(u.dni || '')}) pasa a ser <b>CFP403_${this.esc(u.dni || '')}</b>. Se cierran sus sesiones abiertas.`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'Restablecer', cancelButtonText: 'Cancelar'
    });
    if (!ok.isConfirmed) return;
    const { data, error } = await supabase.rpc('restablecer_clave_basica', { p_user_id: id });
    if (error) { Swal.fire({ icon: 'error', title: 'No se pudo restablecer', text: error.message }); return; }
    Swal.fire({ icon: 'success', title: 'Contraseña restablecida', html: `Pasásela a la persona: <b>${this.esc(data || '')}</b><br><small>Puede cambiarla desde «Cambiar mi contraseña».</small>` });
  },

  async aprobar(id) {
    const u = this.lista.find(x => String(x.id) === String(id));
    if (!u) return;
    const ok = await Swal.fire({
      title: 'Aprobar estudiante',
      html: `¿Aprobar la cuenta de <b>${this.esc(this.nombre(u))}</b> (DNI ${this.esc(u.dni || '')})? Entra como estudiante.`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'Aprobar', cancelButtonText: 'Cancelar'
    });
    if (!ok.isConfirmed) return;
    const { error } = await supabase.rpc('aprobar_pendiente', { p_user_id: id });
    if (error) { Swal.fire({ icon: 'error', title: 'No se pudo aprobar', text: error.message }); return; }
    if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Cuenta aprobada', showConfirmButton: false, timer: 1800 });
    this.cargar();
  }
};

window.CuentasModulo = CuentasModulo;
