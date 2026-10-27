/* ==========================================================================
   PREINSCRIPCIONES (panel interno)
   Dirección y Secretaría: ven todas, corrigen datos, confirman o rechazan, exportan PDF y
   configuran el ciclo abierto, el link y el QR. El docente del trayecto las ve en solo lectura.
   Tablas y funciones: sql/43_preinscripciones.sql
   ========================================================================== */
const PreinscripcionesModulo = {
  lista: [],
  admin: false,
  config: null,
  sel: null,
  filtro: { estado: '', trayecto: '', q: '' },

  esc(v) { return FichaInscripcion.esc(v); },
  raiz() { return document.getElementById('preinscripciones-contenido'); },
  urlPublica() { return new URL('preinscripcion.html', location.href).href.replace(/[?#].*$/, ''); },

  async cargar() {
    const r = this.raiz();
    if (!r) return;
    r.innerHTML = '<p>Cargando…</p>';
    try {
      const perfil = await Auth.obtenerPerfilSesion();
      this.admin = !!perfil && Auth.esPersonal(String(perfil.rol || '').toLowerCase().trim());
      const [{ data, error }, cfg] = await Promise.all([
        supabase.from('preinscripciones').select('*, trayecto:trayectos(id, nombre, horario, sede, lugar_dictado)').order('created_at', { ascending: false }).limit(1000),
        this.admin ? supabase.from('inscripcion_config').select('*').eq('id', 1).maybeSingle() : Promise.resolve({ data: null })
      ]);
      if (error) throw error;
      this.lista = data || [];
      this.config = cfg.data || null;
      this.dibujar();
    } catch (err) {
      console.error('Preinscripciones:', err);
      r.innerHTML = `<div class="card"><p>No se pudieron cargar las preinscripciones. ${/preinscripciones/.test(err.message || '') ? 'Falta ejecutar el paso 46 en Supabase.' : this.esc(err.message || '')}</p></div>`;
    }
  },

  filtradas() {
    const f = this.filtro, q = f.q.trim().toLowerCase();
    return this.lista.filter(p => !q || `${p.apellido} ${p.nombre} ${p.dni} ${p.numero}`.toLowerCase().includes(q));
  },

  insignia(e) {
    const m = { pendiente: ['#b45309', '#fef3c7', 'Pendiente'], confirmada: ['#166534', '#dcfce7', 'Confirmada'], rechazada: ['#991b1b', '#fee2e2', 'Rechazada'] }[e] || ['#334155', '#e2e8f0', e];
    return `<span style="background:${m[1]};color:${m[0]};padding:.15rem .55rem;border-radius:99px;font-size:.75rem;font-weight:700">${m[2]}</span>`;
  },

  /* Vista 1: una tarjeta por trayecto. Vista 2: las preinscripciones de ese trayecto.
     Si se escribe en el buscador, se muestran los resultados de todos los trayectos. */
  dibujar() {
    const f = this.filtro, q = f.q.trim();
    const enTrayecto = !!f.trayecto && !q;
    let cuerpo;
    if (q) cuerpo = this.htmlTabla(this.filtradas(), true, `Resultados de la búsqueda (${this.filtradas().length})`);
    else if (enTrayecto) cuerpo = this.htmlTrayecto();
    else cuerpo = this.htmlTarjetas();
    this.raiz().innerHTML = `
      ${this.admin && !enTrayecto && !q ? this.htmlConfig() : ''}
      <div style="display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin-bottom:1rem">
        <input class="form-control" style="max-width:300px" placeholder="Buscar por nombre, DNI o N.º en todos los trayectos" value="${this.esc(f.q)}" onchange="PreinscripcionesModulo.filtro.q=this.value;PreinscripcionesModulo.dibujar()">
        ${q ? '<button class="btn-secondary" onclick="PreinscripcionesModulo.filtro.q=\'\';PreinscripcionesModulo.dibujar()">Limpiar búsqueda</button>' : ''}
        <button class="btn-primary" style="margin-left:auto" onclick="PreinscripcionesModulo.pdfBlanco()">📄 Ficha en blanco (PDF)</button>
      </div>
      ${cuerpo}
      <div id="preinsc-detalle"></div>`;
    const qr = document.getElementById('pc-qr');
    if (qr) qr.innerHTML = this.qrSvg(122) || '<span style="font-size:.7rem">QR no disponible sin conexión</span>';
  },

  /* Trayectos que tienen preinscripciones, con sus totales por estado */
  htmlTarjetas() {
    const mapa = new Map();
    this.lista.forEach(p => {
      const id = p.trayecto_id || 0;
      if (!mapa.has(id)) mapa.set(id, { id, nombre: p.trayecto?.nombre || 'Sin trayecto', ciclo: p.ciclo, pendiente: 0, confirmada: 0, rechazada: 0 });
      mapa.get(id)[p.estado]++;
    });
    const trs = [...mapa.values()].sort((a, b) => (b.ciclo - a.ciclo) || a.nombre.localeCompare(b.nombre, 'es'));
    if (!trs.length) return '<div class="card" style="padding:1.2rem;text-align:center">Todavía no hay preinscripciones.</div>';
    return `<h3 style="margin:.2rem 0 .8rem">Trayectos con preinscripciones</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.9rem">
        ${trs.map(t => `<button type="button" class="card" style="text-align:left;cursor:pointer;padding:1rem;border:1px solid #d5dbe6" onclick="PreinscripcionesModulo.filtro.trayecto='${t.id}';PreinscripcionesModulo.filtro.estado='';PreinscripcionesModulo.dibujar()">
          <div style="font-size:.74rem;opacity:.7">Ciclo ${this.esc(t.ciclo)}</div>
          <div style="font-weight:700;margin:.15rem 0 .6rem">${this.esc(t.nombre)}</div>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap">
            ${t.pendiente ? `<span style="background:#fef3c7;color:#b45309;padding:.12rem .5rem;border-radius:99px;font-size:.74rem;font-weight:700">${t.pendiente} pendiente${t.pendiente > 1 ? 's' : ''}</span>` : ''}
            ${t.confirmada ? `<span style="background:#dcfce7;color:#166534;padding:.12rem .5rem;border-radius:99px;font-size:.74rem;font-weight:700">${t.confirmada} confirmada${t.confirmada > 1 ? 's' : ''}</span>` : ''}
            ${t.rechazada ? `<span style="background:#fee2e2;color:#991b1b;padding:.12rem .5rem;border-radius:99px;font-size:.74rem;font-weight:700">${t.rechazada} rechazada${t.rechazada > 1 ? 's' : ''}</span>` : ''}
          </div></button>`).join('')}
      </div>`;
  },

  htmlTrayecto() {
    const f = this.filtro;
    const del = this.lista.filter(p => String(p.trayecto_id || 0) === f.trayecto);
    const nombre = del[0]?.trayecto?.nombre || 'Sin trayecto';
    const cuenta = e => del.filter(p => p.estado === e).length;
    const filas = del.filter(p => !f.estado || p.estado === f.estado);
    return `<div style="display:flex;flex-wrap:wrap;gap:.7rem;align-items:center;margin-bottom:.8rem">
        <button class="btn-secondary" onclick="PreinscripcionesModulo.filtro.trayecto='';PreinscripcionesModulo.filtro.estado='';PreinscripcionesModulo.dibujar()">← Todos los trayectos</button>
        <h3 style="margin:0">${this.esc(nombre)}</h3>
        <select class="form-control" style="max-width:210px;margin-left:auto" onchange="PreinscripcionesModulo.filtro.estado=this.value;PreinscripcionesModulo.dibujar()">
          <option value="">Todas (${del.length})</option>
          ${['pendiente', 'confirmada', 'rechazada'].map(e => `<option value="${e}" ${f.estado === e ? 'selected' : ''}>${e[0].toUpperCase() + e.slice(1)}s (${cuenta(e)})</option>`).join('')}
        </select></div>
      ${this.htmlTabla(filas, false)}`;
  },

  htmlTabla(filas, conTrayecto, titulo) {
    return `<div class="card" style="padding:1rem">
      ${titulo ? `<h3 style="margin:0 0 .6rem">${this.esc(titulo)}</h3>` : ''}
      <div style="overflow-x:auto">
        <table class="data-table" style="width:100%">
          <thead><tr><th>N.º</th><th>Apellido y nombre</th><th>DNI</th>${conTrayecto ? '<th>Trayecto</th>' : ''}<th>Fecha</th><th>Estado</th><th></th></tr></thead>
          <tbody>${filas.map(p => `<tr>
            <td>${this.esc(p.numero)}</td><td>${this.esc(p.apellido)}, ${this.esc(p.nombre)}</td><td>${this.esc(p.dni)}</td>
            ${conTrayecto ? `<td>${this.esc(p.trayecto?.nombre || '—')}</td>` : ''}<td>${FichaInscripcion.fechaAR(p.created_at)}</td><td>${this.insignia(p.estado)}</td>
            <td><button class="btn-secondary" onclick="PreinscripcionesModulo.abrir(${p.id})">${this.admin ? 'Ver / editar' : 'Ver'}</button></td></tr>`).join('') ||
            `<tr><td colspan="${conTrayecto ? 7 : 6}" style="text-align:center;padding:1.2rem">No hay preinscripciones con este filtro.</td></tr>`}</tbody>
        </table>
      </div></div>`;
  },

  htmlConfig() {
    const c = this.config || { ciclo: new Date().getFullYear(), abierta: false, mensaje: '' };
    return `<div class="card" style="padding:1rem;margin-bottom:1rem">
      <h3 style="margin:0 0 .6rem">Apertura de la preinscripción</h3>
      <div style="display:flex;flex-wrap:wrap;gap:.8rem;align-items:flex-end">
        <div><label style="font-size:.78rem;font-weight:600">Ciclo lectivo</label><input id="pc-ciclo" type="number" class="form-control" style="width:110px" value="${Number(c.ciclo)}"></div>
        <div><label style="font-size:.78rem;font-weight:600">Estado</label><select id="pc-abierta" class="form-control"><option value="1" ${c.abierta ? 'selected' : ''}>Abierta</option><option value="0" ${!c.abierta ? 'selected' : ''}>Cerrada</option></select></div>
        <div style="flex:1;min-width:220px"><label style="font-size:.78rem;font-weight:600">Mensaje para quien se inscribe (opcional)</label><input id="pc-mensaje" class="form-control" maxlength="300" value="${this.esc(c.mensaje || '')}"></div>
        <button class="btn-primary" onclick="PreinscripcionesModulo.guardarConfig()">Guardar</button>
      </div>
      <p style="font-size:.82rem;margin:.7rem 0 .3rem">En el desplegable aparecen solo los trayectos cuyo ciclo lectivo es el indicado. Link y QR para difundir:</p>
      <div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center">
        <div><input class="form-control" readonly style="min-width:280px" value="${this.esc(this.urlPublica())}" onclick="this.select()">
          <div style="margin-top:.5rem;display:flex;gap:.5rem"><button class="btn-secondary" onclick="PreinscripcionesModulo.copiarLink()">Copiar link</button><button class="btn-secondary" onclick="PreinscripcionesModulo.descargarQR()">Descargar QR</button></div></div>
        <div id="pc-qr" style="width:130px;height:130px;background:#fff;padding:4px;border:1px solid #d5dbe6;border-radius:8px"></div>
      </div></div>`;
  },

  qrSvg(px) {
    if (typeof qrcode === 'undefined') return '';
    const q = qrcode(0, 'M'); q.addData(this.urlPublica()); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + 2},${y + 2}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 4} ${n + 4}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  },

  async guardarConfig() {
    const reg = { id: 1, ciclo: Number(document.getElementById('pc-ciclo').value), abierta: document.getElementById('pc-abierta').value === '1', mensaje: document.getElementById('pc-mensaje').value.trim() || null, actualizado: new Date().toISOString() };
    if (!reg.ciclo || reg.ciclo < 2000) { Swal.fire('Revisá el ciclo', 'Indicá un año válido.', 'warning'); return; }
    const { id: _id, ...cambios } = reg;
    const { error } = await supabase.from('inscripcion_config').update(cambios).eq('id', 1);
    if (error) { Swal.fire('No se pudo guardar', error.message, 'error'); return; }
    this.config = reg;
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Configuración guardada', showConfirmButton: false, timer: 1800 });
  },

  async copiarLink() {
    try { await navigator.clipboard.writeText(this.urlPublica()); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Link copiado', showConfirmButton: false, timer: 1500 }); }
    catch (e) { Swal.fire('Copialo a mano', this.urlPublica(), 'info'); }
  },

  descargarQR() {
    const svg = this.qrSvg(1000);
    if (!svg) { Swal.fire('QR no disponible', 'No se pudo cargar el generador de QR. Revisá la conexión.', 'warning'); return; }
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 1000;
      c.getContext('2d').drawImage(img, 0, 0, 1000, 1000);
      const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'QR_preinscripcion_CFP403.png'; a.click();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  },

  actual() { return this.lista.find(p => p.id === this.sel); },

  abrir(id) {
    this.sel = id;
    const p = this.actual(); if (!p) return;
    const ro = !this.admin;
    const d = document.getElementById('preinsc-detalle');
    d.innerHTML = `<div class="card" style="padding:1rem">
      <div style="display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin-bottom:.8rem">
        <h3 style="margin:0">${this.esc(p.numero)} · ${this.esc(p.apellido)}, ${this.esc(p.nombre)}</h3> ${this.insignia(p.estado)}
        <span style="font-size:.85rem">Trayecto: <b>${this.esc(p.trayecto?.nombre || '—')}</b></span>
        ${this.estadoDrive(p)}
        <button class="btn-secondary" style="margin-left:auto" onclick="PreinscripcionesModulo.pdf()">📄 PDF</button>
        ${this.admin && !p.drive_subido_en ? '<button class="btn-secondary" onclick="PreinscripcionesModulo.subirADrive(PreinscripcionesModulo.actual());Swal.fire({toast:true,position:\'top-end\',icon:\'info\',title:\'Enviando a Drive…\',showConfirmButton:false,timer:1800})">☁ Enviar a Drive</button>' : ''}
        <button class="btn-secondary" onclick="document.getElementById('preinsc-detalle').innerHTML=''">Cerrar</button>
      </div>
      ${ro ? '<p style="font-size:.82rem;background:#eaf3ff;padding:.5rem .7rem;border-radius:8px">Solo lectura: contiene datos personales y de salud, usalos únicamente para la tarea docente.</p>' : ''}
      <form id="pi-detalle-form" class="fi-form">${FichaInscripcion.htmlFormulario({ datos: p.datos || {}, soloLectura: ro })}</form>
      ${this.admin ? `
        <label style="font-size:.78rem;font-weight:600">Nota interna (no sale en el PDF)</label>
        <textarea id="pi-nota" class="form-control" maxlength="500" rows="2">${this.esc(p.nota_interna || '')}</textarea>
        <div style="display:flex;flex-wrap:wrap;gap:.6rem;margin-top:.8rem">
          <button class="btn-primary" onclick="PreinscripcionesModulo.guardar()">💾 Guardar cambios</button>
          ${p.estado !== 'confirmada' ? '<button class="btn-primary" style="background:#166534" onclick="PreinscripcionesModulo.confirmar()">✔ Confirmar inscripción</button>' : ''}
          ${p.estado === 'pendiente' ? '<button class="btn-secondary" style="color:#991b1b" onclick="PreinscripcionesModulo.rechazar()">✖ Rechazar</button>' : ''}
          ${p.estado === 'rechazada' ? '<button class="btn-secondary" onclick="PreinscripcionesModulo.cambiarEstado(\'pendiente\')">Volver a pendiente</button>' : ''}
          <button class="btn-secondary" style="color:#991b1b;margin-left:auto" onclick="PreinscripcionesModulo.eliminar()">Eliminar</button>
        </div>` : ''}
    </div>`;
    FichaInscripcion.activar(document.getElementById('pi-detalle-form'));
    d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  estadoDrive(p) {
    if (p.drive_subido_en) return '<span style="font-size:.78rem;color:#166534">☁ Copia en Drive</span>';
    if (p.drive_error) return `<span style="font-size:.78rem;color:#b45309" title="${this.esc(p.drive_error)}">⚠ No se pudo copiar a Drive</span>`;
    return '';
  },

  /* Actualiza la copia de Drive (silencioso: si falla, la preinscripción sigue guardada) */
  subirADrive(p) {
    try {
      supabase.functions.invoke('subir-preinscripcion-drive', { body: { id: p.id, forzar: true } })
        .then(async () => {
          const { data } = await supabase.from('preinscripciones').select('drive_archivo_id, drive_subido_en, drive_error').eq('id', p.id).maybeSingle();
          if (data) { Object.assign(p, data); if (this.sel === p.id) { this.dibujar(); this.abrir(p.id); } }
        }).catch(() => {});
    } catch (e) { /* sin Drive no se corta nada */ }
  },

  datosForm() {
    const datos = FichaInscripcion.leer(document.getElementById('pi-detalle-form'));
    const prev = this.actual().datos || {};
    if (prev.fecha_envio) datos.fecha_envio = prev.fecha_envio;
    return datos;
  },

  async guardar(silencioso) {
    const p = this.actual();
    const datos = this.datosForm();
    const prob = FichaInscripcion.validar(datos);
    if (prob.length) { Swal.fire({ icon: 'warning', title: 'Revisá estos puntos', html: '<ul style="text-align:left">' + prob.map(x => `<li>${this.esc(x)}</li>`).join('') + '</ul>' }); return false; }
    const dni = String(datos.dni || '').replace(/\D/g, '');
    const { data: u } = await supabase.auth.getUser();
    const reg = { datos, dni, apellido: String(datos.apellido).toUpperCase().slice(0, 80), nombre: String(datos.nombre).slice(0, 80), email: datos.email ? String(datos.email).toLowerCase() : null,
      nota_interna: (document.getElementById('pi-nota')?.value || '').trim() || null, actualizado: new Date().toISOString(), actualizado_por: u?.user?.id || null };
    const { error } = await supabase.from('preinscripciones').update(reg).eq('id', p.id);
    if (error) { Swal.fire('No se pudo guardar', /unique|duplicate/i.test(error.message) ? 'Ya hay otra preinscripción con ese DNI en este trayecto.' : error.message, 'error'); return false; }
    Object.assign(p, reg);
    if (!silencioso) { Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Cambios guardados', showConfirmButton: false, timer: 1800 }); this.dibujar(); this.abrir(p.id); this.subirADrive(p); }
    return true;
  },

  async cambiarEstado(estado) {
    const p = this.actual();
    const { error } = await supabase.from('preinscripciones').update({ estado, actualizado: new Date().toISOString() }).eq('id', p.id);
    if (error) { Swal.fire('Error', error.message, 'error'); return; }
    p.estado = estado; this.dibujar(); this.abrir(p.id);
  },

  async rechazar() {
    const r = await Swal.fire({ title: '¿Rechazar la preinscripción?', text: 'Queda guardada como rechazada; podés volver a pendiente después.', icon: 'question', showCancelButton: true, confirmButtonText: 'Rechazar', cancelButtonText: 'Cancelar' });
    if (r.isConfirmed) { if (await this.guardar(true)) this.cambiarEstado('rechazada'); }
  },

  async eliminar() {
    const p = this.actual();
    const r = await Swal.fire({ title: '¿Eliminar definitivamente?', text: `${p.apellido}, ${p.nombre} (${p.numero}). No se puede deshacer.`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar' });
    if (!r.isConfirmed) return;
    const { error } = await supabase.from('preinscripciones').delete().eq('id', p.id);
    if (error) { Swal.fire('Error', error.message, 'error'); return; }
    this.lista = this.lista.filter(x => x.id !== p.id); this.sel = null;
    if (!this.lista.some(x => String(x.trayecto_id || 0) === this.filtro.trayecto)) this.filtro.trayecto = '';
    this.dibujar();
  },

  /* Confirmar: crea la cuenta del estudiante (usuario DNI), lo inscribe en el trayecto y vuelca
     los datos a la Ficha de Curso y a Inclusión. Es seguro repetirlo. */
  async confirmar() {
    const p = this.actual();
    if (!(await this.guardar(true))) return;
    const d = p.datos || {};
    if (!p.trayecto_id) { Swal.fire('Sin trayecto', 'La preinscripción no tiene trayecto asignado.', 'warning'); return; }
    const r = await Swal.fire({ title: '¿Confirmar la inscripción?', html: `Se crea la cuenta del estudiante (usuario: su DNI) si no la tiene, se lo inscribe en <b>${this.esc(p.trayecto?.nombre)}</b> y se cargan sus datos en la ficha.`, icon: 'question', showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar' });
    if (!r.isConfirmed) return;
    Swal.fire({ title: 'Procesando…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const { data, error } = await supabase.functions.invoke('importar-estudiantes', { body: { trayecto_id: p.trayecto_id, estudiantes: [{ dni: p.dni, nombre: p.nombre, apellido: p.apellido, email: p.email }] } });
      if (error) throw new Error(error.message || 'Falló la función de alta');
      if (data?.error) throw new Error(data.error);
      if (data?.errores?.length) throw new Error(data.errores.join('\n'));

      const dom = [d.calle, d.altura, d.piso && 'piso ' + d.piso, d.torre && 'torre ' + d.torre, d.dpto && 'dpto ' + d.dpto].filter(Boolean).join(' ');
      const niv = { egb: 'EGB', polimodal: 'Polimodal', secundario: 'Secundario', terciario: 'Terciario', universitario: 'Universitario' }[d.nivel_max] || '';
      const estudios = niv ? `${niv} ${d.estado_estudios === 'completo' ? 'completo' : (d.estado_estudios === 'incompleto' ? 'incompleto' : '')}`.trim() : null;
      const ficha = { dni: p.dni, tipo_documento: d.tipo_doc || null, genero: d.sexo_dni || null, fecha_nacimiento: d.fecha_nac || null, lugar_nacimiento: d.lugar_nac || null,
        domicilio: dom || null, localidad: d.localidad || null, codigo_postal: d.cp || null, telefono: d.telefono || d.whatsapp || null, estudios, actualizado: new Date().toISOString() };
      const incl = { dni: p.dni, pais_origen: d.nacionalidad || null, discapacidad: d.discapacidad === 'si' ? true : (d.discapacidad === 'no' ? false : null), actualizado: new Date().toISOString() };
      const avisos = [];
      // Si ya había datos cargados por Secretaría, no se pisan los campos que ya tienen valor
      const { data: previo } = await supabase.from('datos_estudiante').select('*').eq('dni', p.dni).maybeSingle();
      if (previo) Object.keys(ficha).forEach(k => { if (k !== 'dni' && k !== 'actualizado' && previo[k]) ficha[k] = previo[k]; });
      const r1 = await supabase.from('datos_estudiante').upsert(ficha, { onConflict: 'dni' }); if (r1.error) avisos.push('ficha: ' + r1.error.message);
      const { data: pi } = await supabase.from('datos_inclusion').select('*').eq('dni', p.dni).maybeSingle();
      if (pi) { incl.con_cud = pi.con_cud; incl.apoyo = pi.apoyo; }
      const r2 = await supabase.from('datos_inclusion').upsert(incl, { onConflict: 'dni' }); if (r2.error) avisos.push('inclusión: ' + r2.error.message);

      const { data: u } = await supabase.auth.getUser();
      const { error: e3 } = await supabase.from('preinscripciones').update({ estado: 'confirmada', confirmada_por: u?.user?.id || null, confirmada_en: new Date().toISOString() }).eq('id', p.id);
      if (e3) throw e3;
      p.estado = 'confirmada';
      this.dibujar(); this.abrir(p.id); this.subirADrive(p);
      const nueva = data?.creados ? `<br>Cuenta nueva: usuario <b>${this.esc(p.dni)}</b>, clave inicial <b>CFP403_${this.esc(p.dni)}</b>.` : '<br>La persona ya tenía cuenta.';
      Swal.fire({ icon: avisos.length ? 'warning' : 'success', title: 'Inscripción confirmada', html: nueva + (avisos.length ? '<br><br>Atención, no se pudo cargar: ' + this.esc(avisos.join('; ')) : '') });
    } catch (err) {
      console.error(err);
      Swal.fire('No se pudo confirmar', String(err.message || err), 'error');
    }
  },

  opcionesPDF(p, enBlanco) {
    const t = p?.trayecto || {};
    return { datos: p?.datos || {}, enBlanco: !!enBlanco, numero: p?.numero, ciclo: p?.ciclo || this.config?.ciclo || new Date().getFullYear(),
      trayecto: { nombre: t.nombre, horario: t.horario, sede: t.sede, lugar: t.lugar_dictado } };
  },

  async pdf() {
    const p = this.actual();
    try { await FichaInscripcion.descargarPDF(this.opcionesPDF(p), `Ficha_inscripcion_${p.numero}_${String(p.apellido).replace(/\W+/g, '_')}.pdf`); }
    catch (err) { Swal.fire('No se pudo armar el PDF', String(err.message || err), 'error'); }
  },

  async pdfBlanco() {
    try { await FichaInscripcion.descargarPDF({ enBlanco: true, ciclo: this.config?.ciclo || new Date().getFullYear(), trayecto: {} }, 'Ficha_inscripcion_en_blanco.pdf'); }
    catch (err) { Swal.fire('No se pudo armar el PDF', String(err.message || err), 'error'); }
  }
};
window.PreinscripcionesModulo = PreinscripcionesModulo;
