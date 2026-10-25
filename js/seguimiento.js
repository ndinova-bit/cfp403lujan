/* Panel "Seguimiento" (docentes y administración)
   1. Entregas por corregir: todas las entregas sin nota de los trayectos del docente (o de todos, si es admin).
   2. Alumnos en riesgo: asistencia menor a 70 %, promedio de actividades menor a 70 o ninguna entrega. */
const SeguimientoModulo = {
  MINIMO: 70,
  datos: null,

  esc(t) {
    return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  urlSegura(u) {
    try { const x = new URL(String(u || '').trim()); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : '#'; }
    catch { return '#'; }
  },
  nombreDe(alumnos, key) {
    const a = alumnos.find(x => String(x.usuario) === String(key));
    if (!a) return `DNI ${key}`;
    const ap = (a.apellido || '').toUpperCase().trim();
    const no = (a.nombre || '').trim();
    return ap && no ? `${ap}, ${no}` : (ap || no || `DNI ${key}`);
  },
  sinNota(e) { return e.nota === null || e.nota === undefined || String(e.nota).trim() === ''; },

  async cargar() {
    const cont = document.getElementById('seguimiento-contenido');
    if (!cont) return;
    cont.innerHTML = '<p class="seg-cargando">Cargando seguimiento…</p>';
    try {
      const perfil = await Auth.obtenerPerfilSesion();
      const esAdmin = Auth.esPersonal ? Auth.esPersonal(perfil.rol) : Auth.esAdmin(perfil.rol);   // admin o preceptor: todos
      this.esPreceptor = Auth.esPreceptor ? Auth.esPreceptor(perfil.rol) : false;
      this.puedeRegistrar = !!esAdmin;     // administración, regencia y preceptoría
      const anio = String(new Date().getFullYear());

      let q = supabase.from('trayectos').select('*');
      if (!esAdmin) {
        const sup = window.Trayectos ? Object.keys(await Trayectos.misSuplencias(perfil.dni)).map(Number) : [];
        const dniD = String(perfil.dni || '').replace(/[^0-9A-Za-z_-]/g, '');
        q = sup.length ? q.or(`docente_user.eq.${dniD},id.in.(${sup.join(',')})`) : q.eq('docente_user', dniD);
      }
      const { data: tr } = await q;
      const trayectos = (tr || []).filter(t => String(t.ciclo_lectivo || anio) === anio);

      if (!trayectos.length) {
        cont.innerHTML = `<div class="prog-vacio">${esAdmin ? 'No hay trayectos en el ciclo ' + anio + '.' : 'No tenés trayectos asignados en el ciclo ' + anio + '.'}</div>`;
        return;
      }
      const ids = trayectos.map(t => Number(t.id));
      const [rC, rI, rA, rM, rX, rE] = await Promise.all([
        ReglasFP.selectClases('id, titulo, trayecto_id, modulo_id', q => q.in('trayecto_id', ids)),
        supabase.from('inscripciones').select('*').in('trayecto_id', ids),
        supabase.from('asistencias').select('trayecto_id, estudiante_user, estado, modulo_id').in('trayecto_id', ids),
        supabase.from('modulos').select('*').in('trayecto_id', ids).order('id', { ascending: true }),
        supabase.from('modulos_acreditados').select('*').in('trayecto_id', ids),
        supabase.from('excepciones_estudiantes').select('trayecto_id, estudiante_user, habilitado').in('trayecto_id', ids)
      ]);
      const modulos = rM.data || [];
      const acreditados = (!rX.error && rX.data) || [];
      const excepciones = (!rE.error && rE.data) || [];
      const clases = rC.data || [];
      const insc = rI.data || [];
      const asis = rA.data || [];
      let entregas = [];
      const cids = clases.map(c => c.id);
      if (cids.length) {
        const { data } = await supabase.from('entregas_actividades').select('*').in('clase_id', cids).order('id', { ascending: true });
        entregas = data || [];
      }
      const dnis = [...new Set([...insc.map(i => String(i.estudiante_user)), ...entregas.map(e => String(e.estudiante_user))])];
      let alumnos = [];
      if (dnis.length) {
        const { data } = await supabase.from('usuarios').select('usuario, nombre, apellido').in('usuario', dnis);
        alumnos = data || [];
      }
      this.datos = { trayectos, clases, insc, asis, entregas, alumnos, modulos, acreditados, excepciones };
      this.render();
    } catch (e) {
      console.error('Seguimiento:', e);
      cont.innerHTML = '<div class="prog-vacio">No se pudo cargar el seguimiento. Probá recargar la página.</div>';
    }
  },

  render() {
    const { trayectos, clases, insc, asis, entregas, alumnos, modulos = [], acreditados = [], excepciones = [] } = this.datos;
    const cont = document.getElementById('seguimiento-contenido');

    // ---- Bajas (manuales y automáticas): no cuentan como "en riesgo"
    const bajas = [];
    const claveBaja = new Set();
    trayectos.forEach(t => {
      const tid = Number(t.id);
      const modsT = modulos.filter(m => Number(m.trayecto_id) === tid);
      insc.filter(i => Number(i.trayecto_id) === tid).forEach(i => {
        const key = String(i.estudiante_user);
        const excepcion = excepciones.some(x => Number(x.trayecto_id) === tid && String(x.estudiante_user) === key && x.habilitado);
        const ev = ReglasFP.evaluar({
          key, modulos: modsT, clases: clases.filter(c => Number(c.trayecto_id) === tid), entregas,
          asistencias: asis.filter(a => Number(a.trayecto_id) === tid), acreditados: acreditados.filter(a => Number(a.trayecto_id) === tid),
          computaAsistencia: ReglasFP.computaAsistencia(t), excepcion
        });
        const c = ReglasFP.estadoCursada(ev, modsT, i, { excepcion });
        if (c.baja) { bajas.push({ t, key, nombre: this.nombreDe(alumnos, key), ...c }); claveBaja.add(tid + '|' + key); }
      });
    });
    const califIds = new Set(clases.filter(c => c.calificable !== false && c.tipo !== 'encuesta').map(c => Number(c.id)));
    const pendientes = entregas.filter(e => this.sinNota(e) && califIds.has(Number(e.clase_id)));

    // ---- 1. Entregas por corregir
    let htmlPend = '';
    trayectos.forEach(t => {
      const cT = clases.filter(c => Number(c.trayecto_id) === Number(t.id));
      const idsC = cT.map(c => Number(c.id));
      const pT = pendientes.filter(e => idsC.includes(Number(e.clase_id)));
      if (!pT.length) return;
      htmlPend += `<details class="seg-grupo"><summary><span class="seg-g-nom">${this.esc(t.nombre)}</span><span class="seg-cuenta">${pT.length}</span></summary>`;
      pT.forEach(e => {
        const c = cT.find(x => Number(x.id) === Number(e.clase_id));
        const url = this.urlSegura(e.url_entrega);
        htmlPend += `
          <div class="seg-item" id="seg-ent-${Number(e.id)}">
            <div class="seg-item-info">
              <strong><button type="button" class="seg-nombre" onclick="FichaAlumno.abrir('${this.esc(String(e.estudiante_user).replace(/\D/g, ''))}')">${this.esc(this.nombreDe(alumnos, e.estudiante_user))}</button></strong>
              <span>${this.esc(c ? c.titulo : 'Actividad')}</span>
            </div>
            ${url !== '#' ? `<a class="seg-ver" href="${this.esc(url)}" target="_blank" rel="noopener noreferrer">Ver trabajo</a>`
              : (c && c.tipo && c.tipo !== 'tp' && window.Actividades ? `<button type="button" class="seg-ver" onclick="Actividades.verEntrega(${Number(c.id)}, '${this.esc(String(e.estudiante_user).replace(/[^0-9A-Za-z_-]/g, ''))}')">Ver respuestas</button>` : '<span class="seg-sinlink">Sin enlace</span>')}
            <input class="form-control seg-nota" id="seg-nota-${Number(e.id)}" inputmode="numeric" placeholder="Nota" aria-label="Nota de 0 a 100">
            <input class="form-control seg-coment" id="seg-coment-${Number(e.id)}" placeholder="Devolución (opcional)" aria-label="Devolución">
            <button type="button" class="btn btn-primary seg-guardar" onclick="SeguimientoModulo.calificar(${Number(e.id)}, ${Number(t.id)})">Guardar</button>
          </div>`;
      });
      htmlPend += '</details>';
    });
    if (!htmlPend) htmlPend = '<div class="seg-ok">No hay entregas pendientes de corrección. ¡Todo al día!</div>';

    // ---- 2. Alumnos en riesgo
    let htmlRiesgo = '';
    let totalRiesgo = 0;
    trayectos.forEach(t => {
      const tid = Number(t.id);
      const idsC = clases.filter(c => Number(c.trayecto_id) === tid).map(c => Number(c.id));
      const filas = [];
      insc.filter(i => Number(i.trayecto_id) === tid).forEach(i => {
        const key = String(i.estudiante_user);
        if (claveBaja.has(tid + '|' + key)) return;
        const a = asis.filter(x => Number(x.trayecto_id) === tid && String(x.estudiante_user) === key);
        const pctAs = (ReglasFP.computaAsistencia(t) && a.length) ? Math.round(ReglasFP.porcentajeAsistencia(a)) : null;
        const ent = entregas.filter(e => idsC.includes(Number(e.clase_id)) && String(e.estudiante_user) === key);
        const notas = ent.map(e => parseFloat(e.nota)).filter(v => !isNaN(v));
        const prom = notas.length ? Math.round(notas.reduce((x, y) => x + y, 0) / notas.length) : null;
        const motivos = [];
        if (pctAs !== null && a.length >= 3 && pctAs < this.MINIMO) motivos.push(`Asistencia ${pctAs}%`);
        if (prom !== null && prom < this.MINIMO) motivos.push(`Promedio ${prom}`);
        if (idsC.length >= 2 && ent.length === 0) motivos.push('Sin entregas');
        if (motivos.length) filas.push({ nombre: this.nombreDe(alumnos, key), key, motivos, pctAs, prom });
      });
      if (!filas.length) return;
      totalRiesgo += filas.length;
      filas.sort((x, y) => y.motivos.length - x.motivos.length || x.nombre.localeCompare(y.nombre));
      htmlRiesgo += `<details class="seg-grupo"><summary><span class="seg-g-nom">${this.esc(t.nombre)}</span><span class="seg-cuenta riesgo">${filas.length}</span></summary>`;
      filas.forEach(f => {
        htmlRiesgo += `<div class="seg-item riesgo">
            <div class="seg-item-info"><strong>${this.esc(f.nombre)}</strong><span>DNI ${this.esc(f.key)}</span></div>
            <button type="button" class="seg-ver" onclick="FichaAlumno.abrir('${this.esc(String(f.key).replace(/\D/g, ''))}')">Ver ficha</button>
            <div class="seg-chips">${f.motivos.map(m => `<span class="seg-chip">${this.esc(m)}</span>`).join('')}</div>
          </div>`;
      });
      htmlRiesgo += '</details>';
    });
    if (!htmlRiesgo) htmlRiesgo = '<div class="seg-ok">Ningún alumno en riesgo por ahora.</div>';

    let htmlBajas = '<div class="seg-ok">No hay bajas registradas.</div>';
    if (bajas.length) {
      const porT = new Map();
      bajas.sort((x, y) => String(x.t.nombre).localeCompare(String(y.t.nombre)) || String(x.key).localeCompare(String(y.key)))
        .forEach(b => { const k = Number(b.t.id); if (!porT.has(k)) porT.set(k, { t: b.t, lista: [] }); porT.get(k).lista.push(b); });
      htmlBajas = [...porT.values()].map(g => `<details class="seg-grupo"><summary><span class="seg-g-nom">${this.esc(g.t.nombre)}</span><span class="seg-cuenta riesgo">${g.lista.length}</span></summary>
        ${g.lista.map(b => `<div class="seg-item riesgo">
          <div class="seg-item-info"><strong>${this.esc(this.nombreDe(alumnos, b.key))}</strong><span>DNI ${this.esc(b.key)}</span></div>
          <button type="button" class="seg-ver" onclick="FichaAlumno.abrir('${this.esc(String(b.key).replace(/\D/g, ''))}')">Ver ficha</button>
          ${this.puedeRegistrar && b.guardada ? `<button type="button" class="seg-ver" onclick="SeguimientoModulo.reincorporarDesdeLista(${Number(b.t.id)}, '${this.esc(String(b.key).replace(/[^0-9A-Za-z_-]/g, ''))}')">Reincorporar</button>` : ''}
          <div class="seg-chips"><span class="seg-chip">${b.tipo === 'automatica' ? 'Baja automática' : 'Baja'}</span><span class="seg-motivo">${this.esc(b.motivo)}</span></div>
        </div>`).join('')}</details>`).join('');
    }
    // Bajas automáticas todavía sin guardar (la planilla de matrícula solo cuenta las guardadas)
    this._bajasVistas = bajas;
    this.bajasAuto = bajas.filter(b => b.tipo === 'automatica' && !b.guardada);
    const btnRegistrar = (this.puedeRegistrar && this.bajasAuto.length)
      ? `<div class="seg-registrar"><span><b>${this.bajasAuto.length}</b> baja(s) automática(s) sin registrar: la planilla de matrícula todavía las cuenta como matriculados.</span>
         <button type="button" class="btn btn-gold" onclick="SeguimientoModulo.registrarBajasAuto()">Registrar bajas automáticas</button></div>` : '';
    // Con un solo trayecto con novedades, se muestra desplegado
    const abrirUnico = (h) => (h.match(/<details/g) || []).length === 1 ? h.replace('<details', '<details open') : h;
    htmlPend = abrirUnico(htmlPend); htmlRiesgo = abrirUnico(htmlRiesgo); htmlBajas = abrirUnico(htmlBajas);
    const barraPlegar = '<div class="seg-plegar"><button type="button" onclick="SeguimientoModulo.plegar(this, true)">Abrir todos</button><button type="button" onclick="SeguimientoModulo.plegar(this, false)">Cerrar todos</button></div>';

    cont.innerHTML = `
      <div class="seg-resumen">
        ${this.esPreceptor ? '' : `<div class="stat-card"><div class="stat-info"><h4>Entregas por corregir</h4><p class="stat-value">${pendientes.length}</p></div></div>`}
        <div class="stat-card"><div class="stat-info"><h4>Alumnos en riesgo</h4><p class="stat-value">${totalRiesgo}</p></div></div>
        <div class="stat-card"><div class="stat-info"><h4>Bajas</h4><p class="stat-value">${bajas.length}</p></div></div>
        <div class="stat-card"><div class="stat-info"><h4>Trayectos del ciclo</h4><p class="stat-value">${trayectos.length}</p></div></div>
      </div>
      ${this.esPreceptor ? '' : `<section class="card-panel seg-panel">
        <div class="card-panel-header"><h3 style="margin:0">Entregas por corregir</h3></div>
        ${barraPlegar}
        ${htmlPend}
      </section>`}
      <section class="card-panel seg-panel">
        <div class="card-panel-header"><h3 style="margin:0">Alumnos en riesgo</h3></div>
        <p class="seg-ayuda">Se marcan quienes tienen asistencia menor a ${this.MINIMO}% (con 3 o más clases registradas), promedio de actividades menor a ${this.MINIMO}, o ninguna entrega cuando ya hay 2 o más clases publicadas.</p>
        ${barraPlegar}
        ${htmlRiesgo}
      </section>
      <section class="card-panel seg-panel">
        <div class="card-panel-header"><h3 style="margin:0">Bajas</h3></div>
        <p class="seg-ayuda">Baja manual: cargada en la pestaña Estudiantes del trayecto. Baja automática: cerró un módulo (pasó su fecha de fin) y la nota quedó debajo de ${this.MINIMO}; no corre si el docente dio habilitación excepcional.</p>
        ${btnRegistrar}
        ${barraPlegar}
        ${htmlBajas}
      </section>`;
    this.actualizarContador(this.esPreceptor ? 0 : pendientes.length);
  },

  plegar(btn, abrir) {
    const sec = btn.closest('.seg-panel');
    if (sec) sec.querySelectorAll('details.seg-grupo').forEach(d => { d.open = abrir; });
  },

  /* Pasa las bajas automáticas a bajas guardadas, con la fecha en que cerró el módulo no aprobado */
  async registrarBajasAuto() {
    const lista = this.bajasAuto || [];
    if (!lista.length || typeof Swal === 'undefined') return;
    const fecha = (f) => String(f || '').split('-').reverse().join('/');
    const r = await Swal.fire({
      title: 'Registrar bajas automáticas', width: 720, showCancelButton: true, confirmButtonText: 'Registrar las marcadas', cancelButtonText: 'Cancelar',
      html: `<p style="font-size:.85rem;text-align:left">Desmarcá a quienes no deban darse de baja. Cada baja queda con la fecha en que cerró el módulo no aprobado, y se puede deshacer con «Reincorporar».</p>
        <div style="max-height:300px;overflow:auto;text-align:left;font-size:.85rem">${lista.map((b, i) => `<label style="display:flex;gap:.5rem;padding:.35rem 0;border-bottom:1px solid #e5e7eb"><input type="checkbox" class="bj-chk" data-i="${i}" checked>
          <span><b>${this.esc(b.nombre)}</b> · ${this.esc(b.t.nombre)}<br><small>Baja desde ${this.esc(fecha(b.fecha))} · ${this.esc(b.motivo)}</small></span></label>`).join('')}</div>`,
      preConfirm: () => [...document.querySelectorAll('.bj-chk')].filter(c => c.checked).map(c => lista[Number(c.dataset.i)])
    });
    if (!r.isConfirmed || !r.value.length) return;
    const perfil = window.Auth && Auth.usuarioActual;
    Swal.fire({ title: 'Registrando…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    let ok = 0; const fallas = [];
    for (const b of r.value) {
      const { error } = await supabase.from('inscripciones').update({
        estado: 'BAJA', fecha_baja: b.fecha, motivo_baja: String(b.motivo).slice(0, 200), baja_tipo: 'automatica', baja_por: perfil ? perfil.id : null
      }).eq('trayecto_id', Number(b.t.id)).eq('estudiante_user', String(b.key));
      if (error) fallas.push(error.message); else ok++;
    }
    Swal.close();
    if (fallas.length) {
      const falta = /baja_tipo|reincorporado/.test(fallas[0]) ? ' Falta ejecutar sql/19_bajas_guardadas.sql en Supabase.' : '';
      Swal.fire({ icon: 'warning', title: `Se registraron ${ok} de ${r.value.length}`, text: fallas[0] + falta });
    } else {
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `${ok} baja(s) registrada(s)`, showConfirmButton: false, timer: 2500 });
    }
    this.cargar();
  },

  /* Reincorporar a un estudiante con fundamentación escrita (administración, regencia y preceptoría) */
  async reincorporar(trayectoId, dni, nombre) {
    if (typeof Swal === 'undefined') return false;
    const r = await Swal.fire({
      title: 'Reincorporar estudiante', icon: 'question', width: 560, showCancelButton: true,
      confirmButtonText: 'Reincorporar', cancelButtonText: 'Cancelar', focusConfirm: false,
      html: `<p style="font-size:.88rem;text-align:left"><b>${this.esc(nombre || ('DNI ' + dni))}</b> vuelve a figurar como activo en este trayecto y no se le vuelve a aplicar la baja automática. Escribí la fundamentación: queda registrada con tu nombre y la fecha.</p>`,
      input: 'textarea', inputPlaceholder: 'Ej.: Presentó certificado médico por el período; rindió el recuperatorio el 12/10 con nota 80.',
      inputAttributes: { maxlength: 1000 },
      inputValidator: (v) => (!v || v.trim().length < 10) ? 'Escribí la fundamentación (al menos 10 caracteres).' : null
    });
    if (!r.isConfirmed) return false;
    const { error } = await supabase.from('inscripciones').update({
      estado: 'ACTIVA', motivo_baja: null, fecha_baja: null, baja_tipo: null, reincorporado: true, motivo_reincorporacion: r.value.trim()
    }).eq('trayecto_id', Number(trayectoId)).eq('estudiante_user', String(dni));
    if (error) {
      const falta = /motivo_reincorporacion/.test(error.message || '') ? ' Falta ejecutar sql/29_reincorporacion_fundamentada.sql en Supabase.' : '';
      Swal.fire({ icon: 'error', title: 'No se pudo reincorporar', text: (error.message || '') + falta });
      return false;
    }
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Estudiante reincorporado', showConfirmButton: false, timer: 2000 });
    return true;
  },

  async reincorporarDesdeLista(trayectoId, dni) {
    const b = (this._bajasVistas || []).find(x => Number(x.t.id) === Number(trayectoId) && String(x.key) === String(dni));
    if (await this.reincorporar(trayectoId, dni, b ? b.nombre : '')) this.cargar();
  },

  async reincorporarDesdeLista(trayectoId, dni) {
    const b = (this._bajasVistas || []).find(x => Number(x.t.id) === Number(trayectoId) && String(x.key) === String(dni));
    if (await this.reincorporar(trayectoId, dni, b ? b.nombre : '')) this.cargar();
  },

  actualizarContador(n) {
    const b = document.getElementById('btn-seguimiento');
    if (!b) return;
    let badge = b.querySelector('.seg-badge');
    if (!badge) { badge = document.createElement('span'); badge.className = 'seg-badge'; b.appendChild(badge); }
    badge.textContent = n > 0 ? String(n) : '';
    badge.style.display = n > 0 ? 'inline-flex' : 'none';
  },

  async calificar(entregaId, trayectoId) {
    const notaTxt = (document.getElementById(`seg-nota-${entregaId}`)?.value || '').trim();
    const coment = (document.getElementById(`seg-coment-${entregaId}`)?.value || '').trim();
    const nota = Number(notaTxt.replace(',', '.'));
    if (notaTxt === '' || isNaN(nota) || nota < 0 || nota > 100) {
      alert('⚠️ Ingresá una nota entre 0 y 100.');
      return;
    }
    try {
      const e = this.datos.entregas.find(x => Number(x.id) === Number(entregaId));
      const { error } = await supabase.from('entregas_actividades')
        .update({ nota: String(nota), comentario_docente: coment || null })
        .eq('id', entregaId);
      if (error) throw error;

      const c = this.datos.clases.find(x => Number(x.id) === Number(e?.clase_id));
      const estado = nota >= this.MINIMO ? `calificado con ${nota} (acreditado) ✅` : `calificado con ${nota} (no acreditado) ⚠️`;
      await supabase.from('notificaciones').insert([{
        estudiante_user: String(e.estudiante_user),
        trayecto_id: Number(trayectoId),
        clase_id: Number(e.clase_id),
        titulo: `Novedad en ${c ? c.titulo : 'una actividad'}`,
        mensaje: `Tu trabajo fue ${estado}.${coment ? ` Observación: "${coment}"` : ''}`
      }]);

      e.nota = String(nota);
      e.comentario_docente = coment || null;
      if (typeof Swal !== 'undefined') {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Nota guardada y alumno notificado', showConfirmButton: false, timer: 2200 });
      }
      this.render();
    } catch (err) {
      console.error('Calificar:', err);
      alert('No se pudo guardar la nota: ' + (err.message || 'error de conexión'));
    }
  },

  // Al entrar a la plataforma, muestra en el menú cuántas entregas esperan corrección
  async contarPendientes() {
    try {
      const perfil = await Auth.obtenerPerfilSesion();
      if (!perfil) return;
      const rol = String(perfil.rol || '').toLowerCase();
      if (rol !== 'docente' && !Auth.esDireccion(perfil.rol)) return;
      let q = supabase.from('trayectos').select('id, ciclo_lectivo');
      if (rol === 'docente') {
        const sup = window.Trayectos ? Object.keys(await Trayectos.misSuplencias(perfil.dni)).map(Number) : [];
        const dniD = String(perfil.dni || '').replace(/[^0-9A-Za-z_-]/g, '');
        q = sup.length ? q.or(`docente_user.eq.${dniD},id.in.(${sup.join(',')})`) : q.eq('docente_user', dniD);
      }
      const { data: tr } = await q;
      const anio = String(new Date().getFullYear());
      const ids = (tr || []).filter(t => String(t.ciclo_lectivo || anio) === anio).map(t => Number(t.id));
      if (!ids.length) return this.actualizarContador(0);
      const { data: cl } = await ReglasFP.selectClases('id', q => q.in('trayecto_id', ids));
      const cids = (cl || []).filter(c => c.calificable !== false && c.tipo !== 'encuesta').map(c => c.id);
      if (!cids.length) return this.actualizarContador(0);
      const { data: en } = await supabase.from('entregas_actividades').select('id, nota').in('clase_id', cids);
      this.actualizarContador((en || []).filter(e => this.sinNota(e)).length);
    } catch (e) { /* el contador es opcional */ }
  }
};
window.SeguimientoModulo = SeguimientoModulo;
