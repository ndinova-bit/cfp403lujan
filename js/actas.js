/* ==========================================================================
   FICHAS DE CURSO / ACTAS DE EXAMEN
   1. Vista previa: cada alumno con la nota de cada módulo (regla FP de js/reglas.js),
      resultado (APROBADO / DESAPROBADO / AUSENTE) y totales.
   2. Ajustes: se puede corregir a mano la nota de un módulo para el acta y acreditar
      módulos por equivalencia (técnicos, títulos previos, etc.).
   3. Datos del acta: fecha del examen y comisión examinadora (se guardan por trayecto).
   4. Excel del acta con el formato del CFP: nota en números y en letras, todas las
      páginas que hagan falta (30 alumnos por hoja), totales por hoja e impresión A4.
   ========================================================================== */
const ActasModulo = {
  trayectoSeleccionado: null,
  datos: null,        // { trayecto, modulos, alumnos[], acreditados[], acta }
  ROMANOS: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'],
  MESES: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],

  esc(t) { return window.escHtml ? window.escHtml(t) : String(t ?? ''); },

  async inicializar() {
    const perfil = (window.Auth && Auth.usuarioActual) || await Auth.obtenerPerfilSesion();
    const rol = String(perfil?.rol || '').toLowerCase().trim();
    // Secretaría ve e imprime/descarga el acta oficial, pero no corrige notas, ajustes,
    // equivalencias ni los datos de la mesa examinadora (eso sigue siendo de dirección,
    // regencia, preceptoría o el/la docente del trayecto).
    this.soloLectura = Auth.esSecretaria(rol) && !Auth.esPersonal(rol);
    this.poblarCiclos();
    await this.cargarTrayectosActas();
  },

  poblarCiclos() {
    const select = document.getElementById('filtro-ciclo-actas');
    if (!select || select.options.length) return;
    const anioActual = new Date().getFullYear();
    let html = '';
    for (let anio = anioActual + 1; anio >= 2024; anio--) {
      html += `<option value="${anio}" ${anio === anioActual ? 'selected' : ''}>Ciclo Lectivo ${anio}</option>`;
    }
    select.innerHTML = html;
  },

  async cargarTrayectosActas() {
    const contenedor = document.getElementById('contenedor-modulo-actas');
    const ciclo = document.getElementById('filtro-ciclo-actas')?.value || new Date().getFullYear();
    if (!contenedor) return;
    contenedor.innerHTML = '<p class="asis-cargando">Cargando trayectos…</p>';

    try {
      const { data: trayectos, error } = await supabase
        .from('trayectos').select('id, nombre').eq('ciclo_lectivo', Number(ciclo)).order('nombre', { ascending: true });
      if (error) throw error;
      if (!trayectos || !trayectos.length) {
        contenedor.innerHTML = `<div class="prog-vacio">No hay trayectos para el ciclo ${this.esc(ciclo)}.</div>`;
        return;
      }
      contenedor.innerHTML = `
        <div class="acta-tabs" role="tablist">
          ${trayectos.map((t, i) => `<button type="button" role="tab" class="acta-tab ${i === 0 ? 'activo' : ''}" onclick="ActasModulo.seleccionarTrayecto(${Number(t.id)}, this)">${this.esc(t.nombre)}</button>`).join('')}
        </div>
        <div id="vista-acta-detalle"></div>`;
      await this.seleccionarTrayecto(trayectos[0].id, null);
    } catch (err) {
      console.error('Actas:', err);
      contenedor.innerHTML = '<div class="prog-vacio">No se pudieron cargar los trayectos.</div>';
    }
  },

  async seleccionarTrayecto(trayectoId, boton) {
    if (boton) {
      document.querySelectorAll('.acta-tab').forEach(b => b.classList.remove('activo'));
      boton.classList.add('activo');
    }
    const vista = document.getElementById('vista-acta-detalle');
    if (vista) vista.innerHTML = '<p class="asis-cargando">Calculando notas…</p>';
    try {
      await this.cargarDatos(Number(trayectoId));
      this.renderizarVistaPrevia();
    } catch (err) {
      console.error('Acta:', err);
      if (vista) vista.innerHTML = '<div class="prog-vacio">No se pudo armar el acta de este trayecto.</div>';
    }
  },

  async cargarDatos(tid) {
    const [rT, rI, rM, rC, rA, rX, rActa, rExc] = await Promise.all([
      supabase.from('trayectos').select('*').eq('id', tid).single(),
      supabase.from('inscripciones').select('*').eq('trayecto_id', tid),
      supabase.from('modulos').select('*').eq('trayecto_id', tid).order('id', { ascending: true }),
      ReglasFP.selectClases('id, modulo_id', q => q.eq('trayecto_id', tid)),
      supabase.from('asistencias').select('estudiante_user, modulo_id, estado').eq('trayecto_id', tid),
      supabase.from('modulos_acreditados').select('*').eq('trayecto_id', tid),
      supabase.from('actas_examen').select('*').eq('trayecto_id', tid).maybeSingle(),
      supabase.from('excepciones_estudiantes').select('estudiante_user, habilitado').eq('trayecto_id', tid)
    ]);
    const conExcepcion = new Set(((rExc && rExc.data) || []).filter(x => x.habilitado).map(x => String(x.estudiante_user)));
    if (rT.error) throw rT.error;
    const trayecto = rT.data;
    this.trayectoSeleccionado = trayecto;
    const modulos = rM.data || [];
    const clases = rC.data || [];
    const inscripciones = rI.data || [];
    const ids = clases.map(c => c.id);
    let entregas = [];
    if (ids.length) {
      const { data } = await supabase.from('entregas_actividades').select('clase_id, estudiante_user, nota').in('clase_id', ids);
      entregas = data || [];
    }
    const dnis = inscripciones.map(i => String(i.estudiante_user));
    let usuarios = [];
    if (dnis.length) {
      const { data } = await supabase.from('usuarios').select('usuario, dni, nombre, apellido').in('usuario', dnis);
      usuarios = data || [];
    }
    const acreditados = rX.error ? [] : (rX.data || []);
    const acta = rActa.error ? null : rActa.data;
    this.faltaSQL = !!(rX.error || rActa.error);
    const ajustes = (acta && acta.ajustes) || {};
    const computa = ReglasFP.computaAsistencia(trayecto);

    const alumnos = inscripciones.map(ins => {
      const key = String(ins.estudiante_user);
      const u = usuarios.find(x => String(x.usuario || x.dni) === key) || {};
      const ap = (u.apellido || '').toUpperCase().trim();
      const no = (u.nombre || '').toUpperCase().trim();
      const excepcion = conExcepcion.has(key);
      const ev = ReglasFP.evaluar({ key, modulos, clases, entregas, asistencias: rA.data || [], acreditados, computaAsistencia: computa, excepcion });
      const baja = String(ins.estado || '').toUpperCase() === 'BAJA';
      return { dni: key, nombre: ap && no ? `${ap}, ${no}` : (ap || no || `DNI ${key}`), numEgresado: ins.num_egresado || '', ev, excepcion, baja, fechaBaja: ins.fecha_baja || null, motivoBaja: ins.motivo_baja || '' };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    this.datos = { trayecto, modulos, alumnos, acreditados, acta, ajustes: JSON.parse(JSON.stringify(ajustes)), computa };
    this.recalcular();
  },

  // Aplica los ajustes manuales y calcula el resultado final de cada alumno para el acta
  recalcular() {
    const { alumnos, ajustes } = this.datos;
    alumnos.forEach(a => {
      const aj = ajustes[a.dni] || {};
      // 1. Valor de cada módulo: equivalencia, ajuste manual o nota calculada (sin correlatividad todavía)
      const vals = a.ev.modulos.map(m => {
        const manual = aj[String(m.id)];
        if (m.equivalencia) return { ...m, valor: 'EQ', manual: false };
        if (manual !== undefined && manual !== null && manual !== '') {
          return { ...m, valor: Math.round(Number(manual)), manual: true };
        }
        const base = m.bloqueado ? (m.notaSinCorrelativa ?? null) : m.nota;
        return { ...m, valor: base, manual: false };
      });
      // 2. Correlatividad (con los ajustes aplicados): si un módulo no está aprobado, los siguientes no se califican
      let anteriorOk = true;
      vals.forEach((m, i) => {
        const aprobado = m.valor === 'EQ' || (typeof m.valor === 'number' && m.valor >= ReglasFP.MINIMO);
        if (i > 0 && !anteriorOk && !a.excepcion && m.valor !== 'EQ') {
          m.valor = 'BLOQ';
          m.manual = false;
          m.aprobado = false;
        } else {
          m.aprobado = aprobado;
        }
        anteriorOk = m.aprobado;
      });
      // Baja: conserva las notas de los módulos aprobados; el módulo donde abandonó sale AUSENTE
      // y los siguientes quedan en blanco con una línea.
      if (a.baja) {
        let corte = false;
        vals.forEach(m => {
          if (corte) { m.valor = 'BAJA'; m.aprobado = false; m.manual = false; return; }
          if (!m.aprobado) {
            corte = true;
            if (!m.manual) m.valor = null;
          }
        });
      }
      a.final = vals;
      const habilitados = vals.filter(m => m.valor !== 'BLOQ');
      const sinDatos = habilitados.every(m => m.valor === null);
      const todos = vals.length > 0 && vals.every(m => m.aprobado);
      a.resultado = a.baja ? 'BAJA' : (todos ? 'APROBADO' : (sinDatos ? 'AUSENTE' : 'DESAPROBADO'));
      const nums = vals.filter(m => typeof m.valor === 'number').map(m => m.valor);
      a.promedio = nums.length ? Math.round(nums.reduce((x, y) => x + y, 0) / nums.length) : null;
    });
  },

  totales(lista) {
    const ins = lista.length;
    const aus = lista.filter(a => a.resultado === 'AUSENTE' || a.resultado === 'BAJA').length;
    const apr = lista.filter(a => a.resultado === 'APROBADO').length;
    return { inscriptos: ins, examinados: ins - aus, ausentes: aus, desaprobados: ins - aus - apr, aprobados: apr };
  },

  renderizarVistaPrevia() {
    const vista = document.getElementById('vista-acta-detalle');
    if (!vista || !this.datos) return;
    const { trayecto, modulos, alumnos, acta, computa } = this.datos;
    const t = this.totales(alumnos);
    const mods = modulos.length ? modulos : [{ id: null, nombre: 'Trayecto completo' }];
    const a = acta || {};

    vista.innerHTML = `
      ${this.faltaSQL ? '<div class="asis-aviso">Para guardar los datos del acta y usar equivalencias, ejecutá <strong>sql/07_asistencia_y_equivalencias.sql</strong> en Supabase. Igual podés descargar el acta.</div>' : ''}
      <div class="acta-cab">
        <div>
          <h3>${this.esc(trayecto.nombre)}</h3>
          <p>Curso N.º ${this.esc(trayecto.certificacion_oficial || trayecto.certificacion || 'S/D')} · ${mods.length} módulo(s) · ${computa ? 'Computa asistencia' : 'Sin asistencia (solo actividades)'}</p>
        </div>
        <div class="acta-totales">
          <span><b>${t.inscriptos}</b> inscriptos</span><span><b>${t.examinados}</b> examinados</span>
          <span><b>${t.ausentes}</b> ausentes</span><span class="bad"><b>${t.desaprobados}</b> desaprobados</span>
          <span class="ok"><b>${t.aprobados}</b> aprobados</span>
        </div>
      </div>

      ${this.soloLectura ? '<p class="plan-meta">Modo solo lectura: Secretaría puede ver e imprimir/descargar el acta, pero no corregir notas, ajustes, equivalencias ni los datos de la mesa examinadora.</p>' : ''}
      <div class="acta-datos">
        <div class="form-group"><label for="acta-fecha">Fecha del examen</label><input type="date" id="acta-fecha" class="form-control" value="${this.esc(a.fecha_examen || '')}" ${this.soloLectura ? 'disabled' : ''}></div>
        <div class="form-group"><label for="acta-presidente">Presidente</label><input id="acta-presidente" class="form-control" maxlength="120" value="${this.esc(a.presidente || '')}" placeholder="Nombre y apellido" ${this.soloLectura ? 'disabled' : ''}></div>
        <div class="form-group"><label for="acta-vocal">Vocal</label><input id="acta-vocal" class="form-control" maxlength="120" value="${this.esc(a.vocal || '')}" placeholder="Nombre y apellido" ${this.soloLectura ? 'disabled' : ''}></div>
        <div class="form-group"><label for="acta-director">Director/a</label><input id="acta-director" class="form-control" maxlength="120" value="${this.esc(a.director || '')}" placeholder="Nombre y apellido" ${this.soloLectura ? 'disabled' : ''}></div>
        <div class="form-group"><label for="acta-inspector">Inspector/a</label><input id="acta-inspector" class="form-control" maxlength="120" value="${this.esc(a.inspector || '')}" placeholder="Nombre y apellido" ${this.soloLectura ? 'disabled' : ''}></div>
      </div>

      ${modulos.length > 10 ? `<div class="asis-aviso">Este trayecto tiene ${modulos.length} módulos y el acta tiene lugar para 10: en el Excel salen los 10 primeros.</div>` : ''}
      <p class="acta-ayuda">La nota de cada módulo sale de las actividades${computa ? ' y la asistencia' : ''}. Para el acta podés escribir otra nota en la casilla (queda marcada en amarillo); borrala para volver a la calculada. <b>EQ</b> = acreditado por equivalencia. <b>No habilitado</b> = el módulo anterior no está aprobado (correlatividad); se habilita solo si el anterior llega a 70.</p>

      <div class="acta-tabla-wrap">
        <table class="acta-tabla">
          <thead><tr>
            <th>N.º</th><th>Apellido y nombres</th>
            ${mods.map((m, i) => `<th title="${this.esc(m.nombre)}">Mód. ${this.ROMANOS[i] || i + 1}<small>${this.esc(m.nombre)}</small></th>`).join('')}
            <th>Resultado</th><th></th>
          </tr></thead>
          <tbody>
            ${alumnos.length ? alumnos.map((al, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${this.esc(al.nombre)}</strong><span>DNI ${this.esc(al.dni)}${al.baja ? ' · BAJA' + (al.fechaBaja ? ' ' + String(al.fechaBaja).split('-').reverse().join('/') : '') : ''}${al.numEgresado ? ' · Egresado N.º ' + this.esc(al.numEgresado) : ''}</span></td>
                ${al.final.map(m => this.celdaModulo(al, m)).join('')}
                <td><span class="acta-res ${al.resultado.toLowerCase()}">${al.resultado}</span></td>
                <td>${(modulos.length && !this.soloLectura) ? `<button type="button" class="btn-ficha" onclick="ActasModulo.editarEquivalencias('${this.esc(al.dni)}')" title="Acreditar módulos por equivalencia">Equivalencias</button>` : ''}</td>
              </tr>`).join('') : `<tr><td colspan="${mods.length + 4}">No hay estudiantes inscriptos.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="acta-acciones">
        <button type="button" class="btn btn-secondary" onclick="FichaCurso.descargar(${Number(trayecto.id)})">Ficha de Curso (Excel)</button>
        ${this.soloLectura ? '' : `<button type="button" class="btn btn-outline" onclick="ActasModulo.guardarDatos()">Guardar datos y ajustes</button>`}
        <button type="button" class="btn btn-gold" onclick="ActasModulo.generarExcelOficialDesdePlantilla()" ${alumnos.length ? '' : 'disabled'}>Descargar acta (Excel)</button>
      </div>`;
  },

  celdaModulo(al, m) {
    if (m.valor === 'BAJA') {
      return `<td class="acta-celda bloq" title="Baja: no cursó este módulo"><span>—</span></td>`;
    }
    if (m.valor === 'BLOQ') {
      return `<td class="acta-celda bloq" title="No se califica: el módulo anterior no está aprobado (correlatividad)"><span>No habilitado</span></td>`;
    }
    if (m.valor === 'EQ') {
      return `<td class="acta-celda eq" title="${this.esc(m.motivoEquivalencia || 'Acreditado por equivalencia')}"><span>EQ</span></td>`;
    }
    const calc = m.nota === null ? 'sin datos' : `calculada: ${m.nota}`;
    const det = [m.promAct !== null ? `actividades ${m.promAct}` : null, m.pctAsis !== null ? `asistencia ${m.pctAsis}%` : null].filter(Boolean).join(' · ');
    const cls = m.valor === null ? 'vacia' : (m.valor >= ReglasFP.MINIMO ? 'ok' : 'bad');
    const valorTexto = m.manual ? m.valor : (m.valor === null ? '' : m.valor);
    if (this.soloLectura) {
      return `<td class="acta-celda ${cls} ${m.manual ? 'manual' : ''}">
        <span>${valorTexto === '' ? '–' : this.esc(valorTexto)}</span>
        <small title="${this.esc(det)}">${m.manual ? calc : this.esc(det || calc)}</small>
      </td>`;
    }
    return `<td class="acta-celda ${cls} ${m.manual ? 'manual' : ''}">
      <input type="text" inputmode="numeric" maxlength="3" aria-label="Nota ${this.esc(m.nombre)} de ${this.esc(al.nombre)}"
        value="${valorTexto}" placeholder="–"
        onchange="ActasModulo.ajustar('${this.esc(al.dni)}', '${m.id}', this.value)">
      <small title="${this.esc(det)}">${m.manual ? calc : this.esc(det || calc)}</small>
    </td>`;
  },

  ajustar(dni, moduloId, valor) {
    const v = String(valor || '').trim().replace(',', '.');
    const al = this.datos.alumnos.find(a => a.dni === dni);
    const mod = al && al.ev.modulos.find(m => String(m.id) === String(moduloId));
    if (!this.datos.ajustes[dni]) this.datos.ajustes[dni] = {};
    if (v === '' || (mod && mod.nota !== null && Number(v) === mod.nota)) {
      delete this.datos.ajustes[dni][moduloId];
    } else {
      const n = Number(v);
      if (isNaN(n) || n < 0 || n > 100) { alert('⚠️ La nota tiene que ser un número entre 0 y 100.'); this.renderizarVistaPrevia(); return; }
      this.datos.ajustes[dni][moduloId] = Math.round(n);
    }
    this.recalcular();
    this.renderizarVistaPrevia();
  },

  leerDatosActa() {
    const v = id => (document.getElementById(id)?.value || '').trim();
    return { fecha_examen: v('acta-fecha') || null, presidente: v('acta-presidente') || null, vocal: v('acta-vocal') || null, director: v('acta-director') || null, inspector: v('acta-inspector') || null };
  },

  async guardarDatos(silencioso = false) {
    const reg = { trayecto_id: Number(this.datos.trayecto.id), ...this.leerDatosActa(), ajustes: this.datos.ajustes, actualizado: new Date().toISOString() };
    const { error } = await supabase.from('actas_examen').upsert(reg, { onConflict: 'trayecto_id' });
    if (error) {
      if (!silencioso) alert('No se pudieron guardar los datos del acta: ' + error.message + (/actas_examen/.test(error.message) ? '\n\nFalta ejecutar sql/07_asistencia_y_equivalencias.sql en Supabase.' : ''));
      return false;
    }
    this.datos.acta = { ...(this.datos.acta || {}), ...reg };
    if (!silencioso && typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Datos del acta guardados', showConfirmButton: false, timer: 2000 });
    return true;
  },

  async editarEquivalencias(dni) {
    const al = this.datos.alumnos.find(a => a.dni === dni);
    if (!al || typeof Swal === 'undefined') return;
    const { modulos, acreditados } = this.datos;
    const actuales = acreditados.filter(x => String(x.estudiante_user) === dni);
    const motivo = (actuales[0] && actuales[0].motivo) || '';
    const r = await Swal.fire({
      title: 'Módulos acreditados por equivalencia',
      html: `<p class="eq-alumno">${this.esc(al.nombre)} · DNI ${this.esc(dni)}</p>
        <div class="eq-lista">${modulos.map((m, i) => `<label class="eq-item"><input type="checkbox" class="eq-chk" value="${Number(m.id)}" ${actuales.some(x => Number(x.modulo_id) === Number(m.id)) ? 'checked' : ''}> Módulo ${this.ROMANOS[i] || i + 1} · ${this.esc(m.nombre)}</label>`).join('')}</div>
        <label for="eq-motivo" class="eq-label">Motivo / respaldo</label>
        <input id="eq-motivo" class="swal2-input eq-motivo" maxlength="300" placeholder="Ej: Técnico electromecánico (título EEST N.º …)" value="${this.esc(motivo)}">`,
      showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', focusConfirm: false,
      preConfirm: () => ({
        ids: [...document.querySelectorAll('.eq-chk:checked')].map(c => Number(c.value)),
        motivo: document.getElementById('eq-motivo').value.trim()
      })
    });
    if (!r.isConfirmed) return;
    const { ids, motivo: mot } = r.value;
    if (ids.length && !mot) { alert('⚠️ Indicá el motivo de la equivalencia (queda registrado).'); return; }
    const tid = Number(this.datos.trayecto.id);
    try {
      const borrar = actuales.filter(x => !ids.includes(Number(x.modulo_id))).map(x => x.id);
      if (borrar.length) {
        const { error } = await supabase.from('modulos_acreditados').delete().in('id', borrar);
        if (error) throw error;
      }
      const filas = ids.map(id => ({ trayecto_id: tid, modulo_id: id, estudiante_user: dni, motivo: mot }));
      if (filas.length) {
        const { error } = await supabase.from('modulos_acreditados').upsert(filas, { onConflict: 'modulo_id,estudiante_user' });
        if (error) throw error;
      }
      await this.cargarDatos(tid);
      this.renderizarVistaPrevia();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Equivalencias actualizadas', showConfirmButton: false, timer: 2000 });
    } catch (err) {
      alert('No se pudieron guardar las equivalencias: ' + (err.message || '') + (/modulos_acreditados/.test(err.message || '') ? '\n\nFalta ejecutar sql/07_asistencia_y_equivalencias.sql en Supabase.' : ''));
    }
  },

  /* ---------------- Excel del acta ---------------- */
  async generarExcelOficialDesdePlantilla() {
    if (!this.datos) return;
    if (typeof ExcelJS === 'undefined') { alert('No se pudo cargar el generador de Excel. Recargá la página.'); return; }
    await this.guardarDatos(true);   // se guardan fecha, firmantes y ajustes (si la tabla existe)

    const { trayecto, modulos, alumnos } = this.datos;
    const da = this.leerDatosActa();
    // El acta es siempre el mismo formulario: 10 columnas de módulos (ACTA I a X).
    // Las que el trayecto no usa se cruzan con una línea, como en el acta en papel.
    const MAX_MOD = 10;
    const mods = (modulos.length ? modulos : [{ id: null, nombre: '' }]).slice(0, MAX_MOD);
    const usados = mods.length;
    const nM = MAX_MOD;
    const COL_MOD = 4;                   // D
    const COL_DOC = COL_MOD + nM * 2;    // tipo de documento
    const ULT = COL_DOC + 1;             // número de documento
    const POR_HOJA = 30;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('ACTA EXAMEN', {
      pageSetup: { paperSize: 5, orientation: 'landscape', fitToPage: false,   // 5 = oficio (legal)
        margins: { left: 0.3, right: 0.3, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 }, horizontalCentered: true }
    });
    ws.getColumn(1).width = 7;   // N.º egresado
    ws.getColumn(2).width = 4;   // N.º de orden
    ws.getColumn(3).width = 32;  // Apellido y nombres
    for (let i = 0; i < nM; i++) { ws.getColumn(COL_MOD + i * 2).width = 5; ws.getColumn(COL_MOD + i * 2 + 1).width = 14; }
    ws.getColumn(COL_DOC).width = 5;
    ws.getColumn(ULT).width = 10;

    const fino = { style: 'thin', color: { argb: 'FF000000' } };
    const caja = { top: fino, left: fino, bottom: fino, right: fino };
    const f = da.fecha_examen ? da.fecha_examen.split('-') : null;
    const dia = f ? String(Number(f[2])) : '................';
    const mes = f ? this.MESES[Number(f[1]) - 1] : '......................................................';
    const anio = f ? f[0] : '......................';
    const especialidad = String(trayecto.nombre || '').toUpperCase();
    const curso = String(trayecto.certificacion_oficial || trayecto.certificacion || '').trim();

    const paginas = Math.max(1, Math.ceil(alumnos.length / POR_HOJA));
    let r = 1;
    for (let p = 0; p < paginas; p++) {
      const lista = alumnos.slice(p * POR_HOJA, (p + 1) * POR_HOJA);
      const inicio = r;

      // Encabezado: institución a la izquierda, título al centro, hoja a la derecha
      ws.mergeCells(r, 1, r, 3);
      ws.getCell(r, 1).value = 'CFP N° 403 "OSCAR SMITH"';
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { vertical: 'middle' };
      ws.mergeCells(r, COL_MOD, r, COL_DOC - 1);
      ws.getCell(r, COL_MOD).value = 'ACTA DE EXAMEN';
      ws.getCell(r, COL_MOD).font = { bold: true, size: 16 };
      ws.getCell(r, COL_MOD).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.mergeCells(r, COL_DOC, r, ULT);
      ws.getCell(r, COL_DOC).value = paginas > 1 ? `Hoja ${p + 1} de ${paginas}` : '';
      ws.getCell(r, COL_DOC).font = { size: 9 };
      ws.getCell(r, COL_DOC).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getRow(r).height = 26;
      r += 2;

      // Especialidad (centrada en todo el ancho) y número de curso a la derecha
      ws.mergeCells(r, 1, r, COL_DOC - 1);
      ws.getCell(r, 1).value = `ESPECIALIDAD: ${especialidad}`;
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.mergeCells(r, COL_DOC, r, ULT);
      ws.getCell(r, COL_DOC).value = `CURSO N.º ${curso}`;
      ws.getCell(r, COL_DOC).font = { bold: true, size: 12 };
      ws.getCell(r, COL_DOC).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(r).height = 22;
      r++;

      // Texto del acta en un solo párrafo, justificado en todo el ancho de la hoja
      ws.mergeCells(r, 1, r, ULT);
      ws.getCell(r, 1).value = `En dependencias del Centro de Formación Profesional N° 403 de la localidad de Luján, domicilio en Lavalle 740, a los ${dia} días del mes de ${mes} del año ${anio} se reúne la Comisión Examinadora, con el objetivo de llevar a cabo la evaluación final a los alumnos del curso cuya Especialidad y N° están detallados en la presente, llegando al resultado que se consigna a continuación:`;
      ws.getCell(r, 1).font = { size: 10 };
      ws.getCell(r, 1).alignment = { horizontal: 'justify', vertical: 'middle', wrapText: true };
      ws.getRow(r).height = 30;
      r += 2;

      // Encabezado de la tabla (2 filas)
      const h1 = r, h2 = r + 1;
      const cab = (c1, c2, texto) => {
        if (c2 > c1) ws.mergeCells(h1, c1, h1, c2);
        ws.getCell(h1, c1).value = texto;
      };
      ws.mergeCells(h1, 1, h2, 1); ws.getCell(h1, 1).value = 'N°\nEgresado';
      ws.mergeCells(h1, 2, h2, 2); ws.getCell(h1, 2).value = 'N°';
      ws.mergeCells(h1, 3, h2, 3); ws.getCell(h1, 3).value = 'APELLIDO Y NOMBRES';
      const colCruce = COL_MOD + usados * 2;          // primera columna sin módulo
      const finTabla = h2 + POR_HOJA;                  // última fila de alumnos
      const enCruce = (fila, c) => usados < MAX_MOD && c >= colCruce && c < COL_DOC && fila >= h2 && fila <= finTabla;
      for (let i = 0; i < MAX_MOD; i++) {
        const c = COL_MOD + i * 2;
        ws.getCell(h1, c).value = `ACTA ${this.ROMANOS[i]}`;
        ws.getCell(h1, c + 1).value = 'NUMERO';
        if (i < usados) {
          ws.mergeCells(h2, c, h2, c + 1);
          ws.getCell(h2, c).value = mods[i].nombre;
          ws.getCell(h2, c).font = { size: 7, italic: true };
        }
      }
      if (usados < MAX_MOD) {
        // Bloque de módulos que no se usan: una sola celda cruzada con una diagonal
        ws.mergeCells(h2, colCruce, finTabla, COL_DOC - 1);
        ws.getCell(h2, colCruce).border = {
          top: fino, left: fino, bottom: fino, right: fino,
          diagonal: { up: true, down: false, style: 'thin', color: { argb: 'FF000000' } }
        };
      }
      cab(COL_DOC, ULT, 'DOCUMENTO');
      ws.getCell(h2, COL_DOC).value = 'TIPO';
      ws.getCell(h2, ULT).value = 'N°';
      for (const hr of [h1, h2]) {
        for (let c = 1; c <= ULT; c++) {
          if (enCruce(hr, c)) continue;
          const cell = ws.getCell(hr, c);
          cell.border = caja;
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          if (!cell.font || !cell.font.italic) cell.font = { bold: true, size: 8 };
        }
      }
      ws.getRow(h1).height = 24;
      ws.getRow(h2).height = 22;
      r += 2;

      // Alumnos (siempre 30 filas por hoja, como el acta impresa)
      for (let k = 0; k < POR_HOJA; k++) {
        const al = lista[k];
        const row = ws.getRow(r);
        row.height = 14;
        row.getCell(2).value = p * POR_HOJA + k + 1;
        if (al) {
          row.getCell(1).value = al.numEgresado || '';
          row.getCell(3).value = al.nombre;
          al.final.slice(0, MAX_MOD).forEach((m, i) => {
            const c = COL_MOD + i * 2;
            if (m.valor === 'EQ') { row.getCell(c).value = 'EQ'; row.getCell(c + 1).value = 'EQUIVALENCIA'; }
            else if (m.valor === 'BAJA') { row.getCell(c).value = '-'; row.getCell(c + 1).value = ''; }
            else if (m.valor === 'BLOQ') { row.getCell(c).value = '-'; row.getCell(c + 1).value = 'NO HABILITADO'; }
            else if (m.valor === null) { row.getCell(c).value = '-'; row.getCell(c + 1).value = 'AUSENTE'; }
            else { row.getCell(c).value = m.valor; row.getCell(c + 1).value = ReglasFP.enLetras(m.valor); }
          });
          row.getCell(COL_DOC).value = 'DNI';
          row.getCell(ULT).value = /^\d+$/.test(al.dni) ? Number(al.dni) : al.dni;
          row.getCell(ULT).numFmt = '0';
        }
        for (let c = 1; c <= ULT; c++) {
          if (enCruce(r, c)) continue;
          const cell = row.getCell(c);
          cell.border = caja;
          cell.font = { size: 9 };
          cell.alignment = { vertical: 'middle', horizontal: c === 3 ? 'left' : 'center', shrinkToFit: c === 3 || (c > COL_MOD && (c - COL_MOD) % 2 === 1) };
        }
        r++;
      }

      // Firmas y totales de la hoja
      const tot = this.totales(lista);
      const filasTot = [['Inscriptos', tot.inscriptos], ['Examinados', tot.examinados], ['Ausentes', tot.ausentes], ['Desaprobados', tot.desaprobados], ['APROBADOS', tot.aprobados]];
      const r0 = r + 1;
      filasTot.forEach(([txt, val], i) => {
        const fr = r0 + i;
        ws.getCell(fr, COL_DOC - 1).value = txt;
        ws.getCell(fr, COL_DOC - 1).alignment = { horizontal: 'right' };
        ws.getCell(fr, COL_DOC - 1).font = { bold: txt === 'APROBADOS', size: 9 };
        ws.mergeCells(fr, COL_DOC, fr, ULT);
        ws.getCell(fr, COL_DOC).value = val;
        ws.getCell(fr, COL_DOC).border = caja;
        ws.getCell(fr, COL_DOC).alignment = { horizontal: 'center' };
        ws.getCell(fr, COL_DOC).font = { bold: true, size: 10 };
      });

      const firmas = [['Vocal', da.vocal], ['Presidente', da.presidente], ['Director/a', da.director], ['Inspector/a', da.inspector]];
      const firma = (fila, c1, c2, rol, nombre) => {
        if (c2 > c1) { ws.mergeCells(fila, c1, fila, c2); ws.mergeCells(fila + 1, c1, fila + 1, c2); }
        const linea = ws.getCell(fila, c1);
        linea.value = nombre || '';
        linea.font = { size: 8 };
        linea.alignment = { horizontal: 'center', vertical: 'bottom' };
        linea.border = { bottom: { style: 'dashed', color: { argb: 'FF000000' } } };
        const et = ws.getCell(fila + 1, c1);
        et.value = rol;
        et.font = { size: 9 };
        et.alignment = { horizontal: 'center' };
        ws.getRow(fila).height = 28;
      };
      let finFirmas;
      if (COL_DOC - 2 >= 8) {
        // 4 firmas en una fila, a la izquierda de los totales
        const rf = r0 + 3;
        const ancho = Math.floor((COL_DOC - 2) / 4);
        firmas.forEach(([rol, nombre], i) => firma(rf, 1 + i * ancho, Math.min(COL_DOC - 2, i * ancho + ancho), rol, nombre));
        finFirmas = r0 + filasTot.length;
      } else {
        // Pocos módulos: firmas de a dos, debajo de los totales
        const rf = r0 + filasTot.length + 1;
        firma(rf, 1, 2, firmas[0][0], firmas[0][1]);
        firma(rf, 3, 3, firmas[1][0], firmas[1][1]);
        firma(rf + 3, 1, 2, firmas[2][0], firmas[2][1]);
        firma(rf + 3, 3, 3, firmas[3][0], firmas[3][1]);
        finFirmas = rf + 4;
      }

      r = finFirmas + 1;
      ws.getCell(r, 1).value = 'Se considerará aprobado con un mínimo de 70 puntos. EQ: módulo acreditado por equivalencia. NO HABILITADO: no aprobó el módulo anterior (correlatividad).';
      ws.getCell(r, 1).font = { size: 9 };
      r++;
      ws.getCell(r, 1).value = 'Dirección General de Cultura y Educación - Dirección de Formación Profesional';
      ws.getCell(r, 1).font = { italic: true, bold: true, size: 9 };
      if (p < paginas - 1) ws.getRow(r).addPageBreak();
      r += 1;
    }
    ws.pageSetup.printArea = `A1:${ws.getColumn(ULT).letter}${r}`;
    // Escala para que cada hoja del acta (30 alumnos) entre completa en una carilla oficio apaisada
    let anchoPt = 0;
    for (let c = 1; c <= ULT; c++) anchoPt += ((ws.getColumn(c).width || 9) * 7 + 5) * 0.75;
    let altoPt = 0;
    for (let k = 1; k < r; k++) altoPt += (ws.getRow(k).height || 15);
    const altoHojaPt = altoPt / paginas + 10;
    const escala = Math.floor(Math.min(965 / anchoPt, 561 / altoHojaPt) * 100);
    ws.pageSetup.fitToPage = false;
    ws.pageSetup.scale = Math.max(40, Math.min(100, escala));

    const buffer = await wb.xlsx.writeBuffer();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    link.download = `Acta_Examen_${String(trayecto.nombre || 'trayecto').replace(/[^\wÁÉÍÓÚÑáéíóúñ]+/g, '_')}.xlsx`;
    link.click();
  }
};

window.ActasModulo = ActasModulo;
