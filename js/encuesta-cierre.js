/* ==========================================================================
   ENCUESTA DE CIERRE · una sola encuesta / autoevaluación para todo el CFP
   Archivo: js/encuesta-cierre.js   (base: sql/61_encuesta_de_cierre.sql)

   · Es la misma para todos los trayectos. Las preguntas las edita solo el Director.
   · Le aparece sola a cada estudiante activo unos días antes de la fecha de
     cierre del trayecto (7 por defecto) y no lleva nota.
   · Los resultados se ven siempre agrupados y sin nombres:
       - Dirección y Regencia: toda la institución y cada trayecto (Estadísticas).
       - Instructor: los de sus trayectos, sin los comentarios escritos.
   ========================================================================== */
const EncuestaCierre = {
  cfg: null,
  mias: null,
  ed: null,
  ciclo: null,

  esc(t) { return Actividades.esc(t); },
  rol() { return String((Actividades.perfil() || {}).rol || '').toLowerCase().trim(); },
  esDirector() { return window.Auth ? Auth.esAdmin(this.rol()) : false; },
  esDireccion() { return window.Auth ? Auth.esDireccion(this.rol()) : false; },
  fecha(iso) { return Actividades.fechaDMY(iso); },
  faltaSql(err) { return /encuesta_cierre|schema cache|does not exist|function/i.test((err && err.message) || ''); },

  async config(forzar = false) {
    if (this.cfg && !forzar) return this.cfg;
    const { data, error } = await supabase.from('encuesta_cierre_config').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    this.cfg = data || { activa: false, dias_antes: 7, dias_despues: 30, preguntas: [] };
    return this.cfg;
  },

  async cargarMias(forzar = false) {
    if (this.mias && !forzar) return this.mias;
    const { data, error } = await supabase.rpc('encuesta_cierre_mias');
    if (error) throw error;
    this.mias = Array.isArray(data) ? data : [];
    return this.mias;
  },

  /* ---------- Estudiante: aviso al entrar ---------- */
  async alIngresar() {
    if (this.rol() !== 'estudiante') return;
    try {
      const pend = (await this.cargarMias(true)).filter(e => !e.respondida);
      if (!pend.length || typeof Swal === 'undefined') return;
      const clave = 'enc_cierre_aviso_' + Actividades.miDni() + '_' + pend.map(e => e.trayecto_id).join('-');
      if (sessionStorage.getItem(clave)) return;
      sessionStorage.setItem(clave, '1');
      const e = pend[0];
      const r = await Swal.fire({
        icon: 'info',
        title: 'Encuesta de cierre',
        html: `Estás terminando <strong>${this.esc(e.nombre)}</strong>.<br>Contanos cómo te fue: son 2 minutos, no lleva nota y tus respuestas se ven sin tu nombre.`,
        showCancelButton: true, confirmButtonText: 'Responder ahora', cancelButtonText: 'Más tarde'
      });
      if (r.isConfirmed) this.abrir(e.trayecto_id);
    } catch (err) { console.warn('Encuesta de cierre:', err.message || err); }
  },

  /* ---------- Tarjeta dentro del trayecto ---------- */
  async tarjetaTrayecto(tid, esEstudiante) {
    try {
      if (esEstudiante) {
        const e = (await this.cargarMias()).find(x => Number(x.trayecto_id) === Number(tid));
        if (!e) return '';
        return `<div class="enc-tarjeta ${e.respondida ? 'ok' : ''}">
          <div><strong>📝 Encuesta de cierre del trayecto</strong>
            <span>${e.respondida ? '✔ Ya la respondiste. ¡Gracias!' : 'Contanos cómo te fue. No lleva nota y se ve sin tu nombre.'} Abierta hasta el ${this.fecha(e.hasta)}.</span></div>
          <button type="button" class="${e.respondida ? 'act-btn-sec' : 'act-btn'}" onclick="EncuestaCierre.abrir(${Number(tid)})">${e.respondida ? 'Ver o cambiar mis respuestas' : 'Responder'}</button>
        </div>`;
      }
      if (this.rol() !== 'docente' && !this.esDireccion()) return '';
      const c = await this.config();
      if (!c.activa) return '';
      return `<div class="enc-tarjeta suave">
        <div><strong>📝 Encuesta de cierre</strong>
          <span>Les aparece sola a los estudiantes ${Number(c.dias_antes)} días antes de la fecha de cierre del trayecto. No lleva nota y es la misma en todo el CFP.</span></div>
        <button type="button" class="act-btn-sec" onclick="EncuestaCierre.resultados(${Number(tid)})">📊 Resultados</button>
      </div>`;
    } catch (err) { console.warn('Encuesta de cierre:', err.message || err); return ''; }
  },

  /* ---------- Estudiante: responder ---------- */
  htmlPreguntas(ps, r, soloLectura = false) {
    let bloque = null, n = 0, h = '';
    ps.forEach(p => {
      if ((p.bloque || '') !== bloque) { bloque = p.bloque || ''; if (bloque) h += `<h5 class="enc-bloque">${this.esc(bloque)}</h5>`; }
      n++;
      const dis = soloLectura ? 'disabled' : '';
      let campo;
      if (p.tipo === 'escala') campo = `<div class="act-escala">${[1, 2, 3, 4, 5].map(v => `<label><input type="radio" name="${this.esc(p.id)}" value="${v}" ${Number(r[p.id]) === v ? 'checked' : ''} ${dis}><span>${v}</span></label>`).join('')}</div><div class="act-escala-ref"><span>1 = muy poco</span><span>5 = mucho</span></div>`;
      else if (p.tipo === 'opcion') campo = `<div class="act-ops">${(p.opciones || []).map(o => `<label class="act-op"><input type="radio" name="${this.esc(p.id)}" value="${this.esc(o)}" ${r[p.id] === o ? 'checked' : ''} ${dis}> <span>${this.esc(o)}</span></label>`).join('')}</div>`;
      else campo = `<textarea class="act-in" name="${this.esc(p.id)}" rows="3" maxlength="500" placeholder="Opcional" ${dis}>${this.esc(r[p.id] || '')}</textarea>`;
      h += `<div class="act-resp-preg" data-preg="${this.esc(p.id)}"><div class="act-resp-enun"><span class="act-resp-n">${n}</span><div>${this.esc(p.enunciado)}</div></div>${campo}</div>`;
    });
    return h;
  },

  async abrir(tid) {
    try {
      const [cfg, mias] = await Promise.all([this.config(true), this.cargarMias(true)]);
      const e = mias.find(x => Number(x.trayecto_id) === Number(tid));
      if (!e) return Actividades.aviso('info', 'Encuesta cerrada', 'La encuesta de este trayecto no está abierta en este momento.');
      const dni = Actividades.miDni();
      const { data: prev } = await supabase.from('encuesta_cierre_respuestas').select('id, respuestas').eq('trayecto_id', Number(tid)).eq('estudiante_user', dni).maybeSingle();
      const r = (prev && prev.respuestas) || {};
      const ps = cfg.preguntas || [];
      const cuerpo = `<p class="act-ayuda"><strong>${this.esc(e.nombre)}</strong> · No lleva nota. Tus respuestas se suman a las del grupo y se ven sin tu nombre. Sirven para mejorar los trayectos del CFP.</p>
        <form id="enc-form" class="act-form-resp" onsubmit="return false">${this.htmlPreguntas(ps, r)}</form>`;
      const m = Actividades.modal('📝 Encuesta de cierre del trayecto', cuerpo, `<button type="button" class="act-btn-sec" onclick="Actividades.cerrarModal()">Cancelar</button><button type="button" class="act-btn" id="enc-enviar">${prev ? 'Guardar cambios' : 'Enviar'}</button>`);
      m.querySelector('#enc-enviar').onclick = async () => {
        const out = {};
        let falta = null;
        ps.forEach(p => {
          if (p.tipo === 'texto') { const t = m.querySelector(`textarea[name="${CSS.escape(p.id)}"]`); if (t && t.value.trim()) out[p.id] = t.value.trim().slice(0, 500); return; }
          const s = m.querySelector(`input[name="${CSS.escape(p.id)}"]:checked`);
          if (s) out[p.id] = p.tipo === 'escala' ? Number(s.value) : s.value;
          else if (!falta) falta = p;
        });
        if (falta) {
          const el = m.querySelector(`[data-preg="${CSS.escape(falta.id)}"]`);
          if (el) { el.classList.add('enc-falta'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
          return Actividades.aviso('warning', 'Falta una respuesta', 'Marcá una opción en cada pregunta. Los comentarios escritos son opcionales.');
        }
        const datos = { respuestas: out, updated_at: new Date().toISOString() };
        const q = prev
          ? supabase.from('encuesta_cierre_respuestas').update(datos).eq('id', prev.id)
          : supabase.from('encuesta_cierre_respuestas').insert([{ trayecto_id: Number(tid), estudiante_user: dni, ...datos }]);
        const { error } = await q;
        if (error) return Actividades.aviso('error', 'No se pudo guardar', /row-level security|violates/i.test(error.message || '') ? 'La encuesta de este trayecto ya cerró.' : (error.message || String(error)));
        this.mias = null;
        Actividades.cerrarModal();
        Actividades.toast('¡Gracias por responder!');
        if (window.ClasesModulo && document.getElementById('lista-clases-cargadas')) ClasesModulo.cargarListaClases(true);
      };
    } catch (err) {
      Actividades.aviso('error', 'No se pudo abrir la encuesta', this.faltaSql(err) ? 'Falta actualizar la base de datos (sql/61_encuesta_de_cierre.sql). Avisale a la dirección.' : (err.message || String(err)));
    }
  },

  /* ---------- Resultados agrupados ---------- */
  promedio(resp, id) {
    const v = resp.map(x => Number(x[id])).filter(n => n >= 1 && n <= 5);
    return v.length ? v.reduce((s, n) => s + n, 0) / v.length : null;
  },
  fmt(n) { return n === null ? '–' : n.toFixed(1).replace('.', ','); },

  htmlResultados(ps, d) {
    const resp = d.respuestas || [];
    if (!resp.length) return '<p class="act-vacio">Todavía no hay respuestas.</p>';
    let bloque = null, h = '';
    ps.forEach((p, i) => {
      if (p.tipo === 'texto' && !d.ve_textos) return;
      if ((p.bloque || '') !== bloque) { bloque = p.bloque || ''; if (bloque) h += `<h5 class="enc-bloque">${this.esc(bloque)}</h5>`; }
      const vals = resp.filter(x => x[p.id] !== undefined && x[p.id] !== '');
      h += `<div class="act-caja"><h5>${i + 1}. ${this.esc(p.enunciado)}</h5>`;
      if (p.tipo === 'texto') {
        h += vals.length ? `<ul class="act-textos">${vals.map(x => `<li>${this.esc(x[p.id])}</li>`).join('')}</ul>` : '<p class="act-ayuda">Sin comentarios.</p>';
      } else {
        const ops = p.tipo === 'escala' ? ['1', '2', '3', '4', '5'] : (p.opciones || []);
        const cuenta = ops.map(o => vals.filter(x => String(x[p.id]) === String(o)).length);
        const max = Math.max(1, ...cuenta);
        if (p.tipo === 'escala') h += `<p><strong>Promedio: ${this.fmt(this.promedio(resp, p.id))}</strong> sobre 5</p>`;
        h += `<div class="act-barras">${ops.map((o, j) => `<div class="act-barra-fila"><span>${this.esc(o)}</span><div class="act-barra"><div style="width:${(cuenta[j] / max) * 100}%"></div></div><span>${cuenta[j]}</span></div>`).join('')}</div>`;
      }
      h += '</div>';
    });
    return h;
  },

  async resultados(tid) {
    try {
      const cfg = await this.config(true);
      const { data, error } = await supabase.rpc('encuesta_cierre_resultados', { p_trayecto: Number(tid), p_ciclo: null });
      if (error) throw error;
      const t = (data.trayectos || [])[0] || {};
      const abre = t.fecha_cierre ? new Date(new Date(t.fecha_cierre + 'T12:00:00').getTime() - Number(cfg.dias_antes) * 86400000).toISOString().slice(0, 10) : null;
      const cab = `<p class="act-ayuda"><strong>${this.esc(t.nombre || '')}</strong> · ${Number(data.respondieron)} respuesta(s) de ${Number(data.activos)} estudiantes activos.
        ${t.fecha_cierre ? `Se abre el ${this.fecha(abre)} (${Number(cfg.dias_antes)} días antes del cierre, ${this.fecha(t.fecha_cierre)}).` : '<br><strong>Este trayecto no tiene fecha de cierre cargada:</strong> sin esa fecha la encuesta no se abre.'}
        Los resultados se muestran agrupados y sin nombres${data.ve_textos ? '' : '; los comentarios escritos los lee la Dirección'}.</p>`;
      Actividades.modal('📊 Encuesta de cierre · Resultados', cab + this.htmlResultados(cfg.preguntas || [], data), '<button type="button" class="act-btn" onclick="Actividades.cerrarModal()">Cerrar</button>');
    } catch (err) {
      Actividades.aviso('error', 'No se pudieron cargar los resultados', this.faltaSql(err) ? 'Falta actualizar la base de datos (sql/61_encuesta_de_cierre.sql).' : (err.message || String(err)));
    }
  },

  /* ---------- Dirección: panel en Estadísticas ---------- */
  async panelDireccion(idCont) {
    const cont = document.getElementById(idCont);
    if (!cont || !this.esDireccion()) return;
    if (!this.ciclo) this.ciclo = new Date().getFullYear();
    cont.innerHTML = '<p class="seg-cargando">Cargando la encuesta de cierre…</p>';
    try {
      const cfg = await this.config(true);
      const { data, error } = await supabase.rpc('encuesta_cierre_resultados', { p_trayecto: null, p_ciclo: Number(this.ciclo) });
      if (error) throw error;
      const ps = cfg.preguntas || [];
      const escalas = ps.filter(p => p.tipo === 'escala');
      const anioHoy = new Date().getFullYear();
      const anios = [anioHoy + 1, anioHoy, anioHoy - 1, anioHoy - 2];
      const conResp = (data.trayectos || []).filter(t => Number(t.respondieron) > 0);
      const sinFecha = (data.trayectos || []).filter(t => !t.fecha_cierre).length;
      cont.innerHTML = `<section class="demo-panel">
        <div class="demo-cab"><div><h3>📝 Encuesta de cierre de los trayectos</h3>
          <p class="acta-ayuda">Una sola encuesta / autoevaluación para todo el CFP. Le aparece sola a cada estudiante activo ${Number(cfg.dias_antes)} días antes de la fecha de cierre de su trayecto y queda abierta ${Number(cfg.dias_despues)} días después. No lleva nota. ${cfg.activa ? '' : '<b>Ahora está desactivada.</b>'}</p></div>
          <div class="enc-acciones">
            <label>Ciclo <select class="form-control" onchange="EncuestaCierre.ciclo = Number(this.value); EncuestaCierre.panelDireccion('${idCont}')">${anios.map(a => `<option value="${a}" ${a === Number(this.ciclo) ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
            ${this.esDirector() ? `<button type="button" class="act-btn-sec" onclick="EncuestaCierre.editar('${idCont}')">✏️ Editar preguntas</button>` : ''}
          </div></div>
        <p><strong>${Number(data.respondieron)}</strong> respuesta(s) en ${conResp.length} trayecto(s) del ciclo ${Number(this.ciclo)}.${sinFecha ? ` <span class="enc-alerta">${sinFecha} trayecto(s) no tienen fecha de cierre cargada: ahí la encuesta no se abre.</span>` : ''}</p>
        ${escalas.length && (data.respuestas || []).length ? `<div class="enc-indicadores">${escalas.map(p => `<div><b>${this.fmt(this.promedio(data.respuestas, p.id))}</b><span>${this.esc(p.enunciado)}</span></div>`).join('')}</div>
          <p class="acta-ayuda">Promedios de toda la institución, sobre 5. Con pocas respuestas los promedios engañan: mirá siempre la cantidad.</p>` : ''}
        <div class="enc-acciones-pie">
          ${(data.respuestas || []).length ? `<button type="button" class="act-btn" onclick="EncuestaCierre.detalleInstitucion()">📊 Ver todas las respuestas del ciclo</button>` : ''}
        </div>
        ${(data.trayectos || []).length ? `<div class="sec-tabla-wrap"><table class="sec-tabla"><thead><tr><th>Trayecto</th><th>Cierre</th><th>Respondieron</th><th></th></tr></thead><tbody>
          ${data.trayectos.map(t => `<tr><td class="sec-nombre">${this.esc(t.nombre)}${t.sector ? `<br><small>${this.esc(t.sector)}</small>` : ''}</td>
            <td>${t.fecha_cierre ? this.fecha(t.fecha_cierre) : '<span class="enc-alerta">sin fecha</span>'}</td>
            <td><b>${Number(t.respondieron)}</b> de ${Number(t.activos)}</td>
            <td>${Number(t.respondieron) ? `<button type="button" class="act-mini" onclick="EncuestaCierre.resultados(${Number(t.id)})">Ver</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="prog-vacio">No hay trayectos en ese ciclo.</div>'}
      </section>`;
      this.datosCiclo = data;
    } catch (err) {
      console.error('Encuesta de cierre:', err);
      cont.innerHTML = `<div class="prog-vacio">No se pudo cargar la encuesta de cierre.${this.faltaSql(err) ? ' Falta ejecutar <strong>sql/61_encuesta_de_cierre.sql</strong> en Supabase.' : ''}</div>`;
    }
  },

  detalleInstitucion() {
    const d = this.datosCiclo;
    if (!d || !this.cfg) return;
    const cab = `<p class="act-ayuda">Toda la institución · ciclo ${Number(this.ciclo)} · ${Number(d.respondieron)} respuesta(s). Agrupadas y sin nombres.</p>`;
    Actividades.modal('📊 Encuesta de cierre · Toda la institución', cab + this.htmlResultados(this.cfg.preguntas || [], d), '<button type="button" class="act-btn" onclick="Actividades.cerrarModal()">Cerrar</button>');
  },

  /* ---------- Director: editar las preguntas ---------- */
  async editar(idCont) {
    if (!this.esDirector()) return;
    const cfg = await this.config(true);
    this.ed = {
      idCont, activa: !!cfg.activa, dias_antes: Number(cfg.dias_antes) || 7, dias_despues: Number(cfg.dias_despues) || 0,
      preguntas: (cfg.preguntas || []).map(p => ({ ...p, opcionesTxt: (p.opciones || []).join('; ') }))
    };
    this.dibujarEditor();
  },

  leerEditor() {
    const m = document.getElementById('modal-actividad');
    if (!m || !this.ed) return;
    this.ed.activa = !!m.querySelector('#enc-activa')?.checked;
    this.ed.dias_antes = Number(m.querySelector('#enc-dias-antes')?.value) || 7;
    this.ed.dias_despues = Number(m.querySelector('#enc-dias-despues')?.value) || 0;
    this.ed.preguntas.forEach((p, i) => {
      const v = (s) => { const el = m.querySelector(`[data-enc="${i}.${s}"]`); return el ? el.value : undefined; };
      p.enunciado = v('enunciado') ?? p.enunciado;
      p.bloque = v('bloque') ?? p.bloque;
      if (p.tipo === 'opcion') p.opcionesTxt = v('opcionesTxt') ?? p.opcionesTxt;
    });
  },

  dibujarEditor() {
    const e = this.ed;
    const nombreTipo = { escala: 'Escala del 1 al 5', opcion: 'Opciones', texto: 'Comentario escrito (opcional)' };
    const cuerpo = `<p class="act-ayuda">Estas preguntas son las mismas para todos los trayectos. Si borrás una pregunta, sus respuestas anteriores dejan de mostrarse; cambiarle la redacción no las borra.</p>
      <div class="act-caja enc-ajustes">
        <label class="act-check"><input type="checkbox" id="enc-activa" ${e.activa ? 'checked' : ''}> Encuesta activa</label>
        <label>Se abre <input type="number" id="enc-dias-antes" class="act-in" min="1" max="60" value="${e.dias_antes}"> días antes del cierre</label>
        <label>y queda abierta <input type="number" id="enc-dias-despues" class="act-in" min="0" max="120" value="${e.dias_despues}"> días después</label>
      </div>
      ${e.preguntas.map((p, i) => `<div class="act-preg">
        <div class="act-preg-cab"><strong>${i + 1}. ${nombreTipo[p.tipo] || p.tipo}</strong>
          <span><button type="button" class="act-mini" ${i === 0 ? 'disabled' : ''} onclick="EncuestaCierre.mover(${i}, -1)" aria-label="Subir">↑</button>
          <button type="button" class="act-mini" ${i === e.preguntas.length - 1 ? 'disabled' : ''} onclick="EncuestaCierre.mover(${i}, 1)" aria-label="Bajar">↓</button>
          <button type="button" class="act-mini act-quitar" onclick="EncuestaCierre.quitar(${i})">Quitar</button></span></div>
        <input type="text" class="act-in" data-enc="${i}.enunciado" maxlength="300" placeholder="Pregunta" value="${this.esc(p.enunciado || '')}">
        ${p.tipo === 'opcion' ? `<label>Opciones (separadas por punto y coma)<input type="text" class="act-in" data-enc="${i}.opcionesTxt" maxlength="400" value="${this.esc(p.opcionesTxt || '')}"></label>` : ''}
        <label>Grupo (título bajo el que aparece)<input type="text" class="act-in" data-enc="${i}.bloque" maxlength="60" value="${this.esc(p.bloque || '')}"></label>
      </div>`).join('')}
      <div class="act-agregar"><span>Agregar pregunta:</span>
        <button type="button" class="act-btn-sec" onclick="EncuestaCierre.agregar('escala')">1 a 5</button>
        <button type="button" class="act-btn-sec" onclick="EncuestaCierre.agregar('opcion')">Opciones</button>
        <button type="button" class="act-btn-sec" onclick="EncuestaCierre.agregar('texto')">Comentario escrito</button></div>`;
    Actividades.modal('✏️ Encuesta de cierre · Preguntas', cuerpo, '<button type="button" class="act-btn-sec" onclick="Actividades.cerrarModal()">Cancelar</button><button type="button" class="act-btn" onclick="EncuestaCierre.guardar()">💾 Guardar</button>');
  },

  mover(i, d) { this.leerEditor(); const a = this.ed.preguntas; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; this.dibujarEditor(); },
  quitar(i) { this.leerEditor(); this.ed.preguntas.splice(i, 1); this.dibujarEditor(); },
  agregar(tipo) {
    this.leerEditor();
    const ult = this.ed.preguntas[this.ed.preguntas.length - 1];
    this.ed.preguntas.push({ id: Actividades.uid('q'), tipo, enunciado: '', bloque: ult ? (ult.bloque || '') : '', opcionesTxt: '' });
    this.dibujarEditor();
    const c = Actividades.cuerpoModal(); if (c) c.scrollTop = c.scrollHeight;
  },

  async guardar() {
    this.leerEditor();
    const e = this.ed;
    const preguntas = [];
    for (let i = 0; i < e.preguntas.length; i++) {
      const p = e.preguntas[i];
      const q = { id: p.id, tipo: p.tipo, enunciado: String(p.enunciado || '').trim() };
      if (String(p.bloque || '').trim()) q.bloque = String(p.bloque).trim();
      if (!q.enunciado) return Actividades.aviso('warning', 'Falta completar', `Pregunta ${i + 1}: falta el texto.`);
      if (p.tipo === 'opcion') {
        q.opciones = String(p.opcionesTxt || '').split(';').map(s => s.trim()).filter(Boolean);
        if (q.opciones.length < 2) return Actividades.aviso('warning', 'Falta completar', `Pregunta ${i + 1}: escribí al menos dos opciones separadas por punto y coma.`);
      }
      preguntas.push(q);
    }
    if (!preguntas.length) return Actividades.aviso('warning', 'Sin preguntas', 'La encuesta necesita al menos una pregunta. Si no querés usarla, desmarcá «Encuesta activa».');
    const dias_antes = Math.min(60, Math.max(1, Math.round(e.dias_antes)));
    const dias_despues = Math.min(120, Math.max(0, Math.round(e.dias_despues)));
    const { data, error } = await supabase.from('encuesta_cierre_config')
      .update({ activa: e.activa, dias_antes, dias_despues, preguntas, updated_at: new Date().toISOString() }).eq('id', 1).select('id');
    if (error || !(data || []).length) return Actividades.aviso('error', 'No se pudo guardar', (error && error.message) || 'Solo el Director puede cambiar la encuesta.');
    this.cfg = null;
    Actividades.cerrarModal();
    Actividades.toast('Encuesta guardada');
    if (e.idCont) this.panelDireccion(e.idCont);
  }
};
window.EncuestaCierre = EncuestaCierre;
