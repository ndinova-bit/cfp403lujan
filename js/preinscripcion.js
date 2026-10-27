/* ==========================================================================
   PREINSCRIPCIÓN PÚBLICA (preinscripcion.html)
   Sin cuenta: la persona completa la ficha, elige un trayecto del ciclo con la inscripción
   abierta, la envía y descarga el PDF para imprimir y firmar. Lo enviado solo lo puede leer
   el personal autorizado desde la plataforma (ver sql/43_preinscripciones.sql).
   ========================================================================== */
const Preinscripcion = {
  trayectos: [],
  estado: null,
  enviada: null,        // { numero, datos, trayecto } después de enviar

  esc(v) { return FichaInscripcion.esc(v); },
  raiz() { return document.getElementById('pi-raiz'); },

  async iniciar() {
    try {
      const { data, error } = await supabase.rpc('inscripcion_estado');
      if (error) throw error;
      this.estado = data || {};
      if (!this.estado.abierta) {
        this.raiz().innerHTML = `<div class="pi-card"><h2>La preinscripción está cerrada por el momento</h2>
          <p>${this.esc(this.estado.mensaje || 'Consultá en el CFP las fechas de inscripción.')}</p></div>`;
        return;
      }
      const r = await supabase.rpc('trayectos_para_inscripcion');
      if (r.error) throw r.error;
      this.trayectos = Array.isArray(r.data) ? r.data : [];
      this.dibujar();
    } catch (err) {
      console.error('Preinscripción:', err);
      const falta = /inscripcion_estado|function|PGRST202/i.test(err.message || '');
      this.raiz().innerHTML = `<div class="pi-card"><h2>No se pudo cargar el formulario</h2><p>${falta ? 'El sistema todavía no está habilitado. Consultá en el CFP.' : 'Probá recargar la página en unos minutos.'}</p></div>`;
    }
  },

  dibujar() {
    const hoy = new Date().toISOString().slice(0, 10);
    this.raiz().innerHTML = `
      <div class="pi-card">
        <h2>Ficha de inscripción · ciclo lectivo ${this.esc(this.estado.ciclo)}</h2>
        <p class="pi-nota">Completá tus datos, elegí el curso y enviá la preinscripción. Al terminar vas a poder <b>descargar la ficha en PDF</b> para imprimirla, firmarla y presentarla en el CFP junto con tu DNI y título, según corresponda al trayecto, cuando el CFP te lo comunique. La preinscripción se confirma cuando el CFP revisa tus datos.</p>
        ${this.estado.mensaje ? `<div class="pi-info pi-aviso">${this.esc(this.estado.mensaje)}</div>` : ''}
      </div>
      <form id="pi-form" class="fi-form" novalidate autocomplete="off">
        <fieldset class="fi-seccion"><legend>Curso / trayecto</legend>
          <div class="fi-fila"><div class="fi-campo" style="flex:1 1 100%">
            <label class="fi-label" for="pi-trayecto">Curso o trayecto al que te querés inscribir <span class="fi-req">*</span></label>
            <select id="pi-trayecto" class="fi-input" onchange="Preinscripcion.mostrarTrayecto()">
              <option value="">Elegí un curso…</option>
              ${this.trayectos.map(t => `<option value="${Number(t.id)}">${this.esc(t.nombre)}${t.nro ? ' (N.º ' + this.esc(t.nro) + ')' : ''}</option>`).join('')}
            </select>
            <div id="pi-trayecto-info"></div>
            ${this.trayectos.length ? '' : '<p class="pi-nota">Todavía no hay cursos cargados para este ciclo.</p>'}
          </div></div>
        </fieldset>
        ${FichaInscripcion.htmlFormulario({ datos: {} })}
        <div class="pi-card"><label class="pi-consent"><input type="checkbox" id="pi-consent">
          <span>Declaro que los datos consignados son verdaderos y autorizo al CFP N.º 403 a tratarlos para la inscripción y la gestión educativa, conforme a la Ley N.º 25.326 de Protección de los Datos Personales.</span></label></div>
        <div class="pi-hp" aria-hidden="true"><label>No completar este campo <input type="text" id="pi-web" tabindex="-1" autocomplete="off"></label></div>
        <div id="pi-errores"></div>
        <div class="pi-acciones"><button type="submit" class="pi-btn" id="pi-enviar">Enviar preinscripción</button></div>
      </form>`;
    const f = document.getElementById('pi-form');
    FichaInscripcion.activar(f);
    f.addEventListener('submit', e => { e.preventDefault(); this.enviar(); });
    this.cargado = Date.now();
    this.hoy = hoy;
  },

  trayectoElegido() {
    const id = Number(document.getElementById('pi-trayecto')?.value || 0);
    return this.trayectos.find(t => Number(t.id) === id) || null;
  },

  mostrarTrayecto() {
    const t = this.trayectoElegido();
    const el = document.getElementById('pi-trayecto-info');
    if (!el) return;
    el.innerHTML = t ? `<div class="pi-info">${t.horario ? '🕒 ' + this.esc(t.horario) + '<br>' : ''}${t.sede === 'fuera' ? '📍 ' + this.esc(t.lugar || 'Se dicta fuera de la sede') : '📍 CFP N.º 403 (sede)'}${t.inicio ? '<br>📅 Inicio: ' + FichaInscripcion.fechaAR(t.inicio) : ''}</div>` : '';
  },

  mostrarErrores(lista) {
    const el = document.getElementById('pi-errores');
    if (!el) return;
    el.innerHTML = lista.length ? `<div class="fi-error" role="alert"><b>Revisá estos puntos:</b><ul>${lista.map(x => `<li>${this.esc(x)}</li>`).join('')}</ul></div>` : '';
    if (lista.length) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  async enviar() {
    const t = this.trayectoElegido();
    const datos = FichaInscripcion.leer(document.getElementById('pi-form'));
    const prob = FichaInscripcion.validar(datos);
    if (!t) prob.unshift('Elegí el curso o trayecto.');
    if (!document.getElementById('pi-consent')?.checked) prob.push('Tenés que aceptar la declaración para enviar la preinscripción.');
    this.mostrarErrores(prob);
    if (prob.length) return;

    // Un envío en menos de 5 segundos no lo hace una persona
    if (Date.now() - (this.cargado || 0) < 5000) { this.mostrarErrores(['Esperá unos segundos y volvé a enviar.']); return; }

    const btn = document.getElementById('pi-enviar');
    btn.disabled = true; btn.textContent = 'Enviando…';
    datos.fecha_envio = this.hoy;
    try {
      const { data, error } = await supabase.rpc('preinscribir', { p_trayecto: Number(t.id), p_datos: datos, p_web: document.getElementById('pi-web')?.value || '' });
      if (error) throw error;
      this.enviada = { numero: data.numero, datos, trayecto: t };
      this.dibujarExito();
    } catch (err) {
      console.error('Preinscribir:', err);
      const msg = String(err.message || '');
      const amable = /Ya existe|cerrada|demasiadas|no está disponible|DNI|apellido|correo/i.test(msg) ? msg : 'No se pudo enviar. Revisá tu conexión y probá de nuevo.';
      this.mostrarErrores([amable]);
      btn.disabled = false; btn.textContent = 'Enviar preinscripción';
    }
  },

  dibujarExito() {
    const e = this.enviada;
    this.raiz().innerHTML = `<div class="pi-card pi-ok">
      <h2>¡Preinscripción enviada!</h2>
      <div class="pi-num">${this.esc(e.numero)}</div>
      <p>Guardá este número. Ahora <b>descargá la ficha en PDF</b>, imprimila, firmala y presentala en el CFP junto con tu DNI y título, según corresponda al trayecto, cuando el CFP te lo comunique.</p>
      <div class="pi-acciones" style="justify-content:center">
        <button type="button" class="pi-btn" onclick="Preinscripcion.pdf()">Descargar ficha en PDF</button>
        <button type="button" class="pi-btn sec" onclick="Preinscripcion.imprimir()">Imprimir</button>
      </div>
      <p class="pi-nota">Curso: ${this.esc(e.trayecto.nombre)}${e.trayecto.horario ? ' · ' + this.esc(e.trayecto.horario) : ''}</p>
      <p class="pi-nota">Si te equivocaste en algún dato, avisá en el CFP: lo pueden corregir.</p></div>`;
    window.scrollTo({ top: 0 });
  },

  async opcionesPDF() {
    const e = this.enviada;
    return { datos: e.datos, trayecto: e.trayecto, numero: e.numero, ciclo: this.estado.ciclo };
  },

  async pdf() {
    try { await FichaInscripcion.descargarPDF(await this.opcionesPDF(), `Ficha_inscripcion_${this.enviada.numero}.pdf`); }
    catch (err) { alert('No se pudo armar el PDF: ' + (err.message || err)); }
  },

  async imprimir() {
    try {
      const bytes = await FichaInscripcion.generarPDF(await this.opcionesPDF());
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const w = window.open(url, '_blank');
      if (!w) { await this.pdf(); return; }
      setTimeout(() => { try { w.print(); } catch (e) { /* el usuario imprime desde el visor */ } }, 800);
    } catch (err) { alert('No se pudo armar el PDF: ' + (err.message || err)); }
  }
};

window.Preinscripcion = Preinscripcion;
window.addEventListener('DOMContentLoaded', () => Preinscripcion.iniciar());
