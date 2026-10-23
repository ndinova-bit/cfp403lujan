/* ==========================================================================
   CERTIFICADOS DE FORMACIÓN PROFESIONAL
   Según Circular DFP 4/2020 (Anexo 2 · Instructivo de confección):
   • Frente: nombre y apellido como en el D.U. (mayúsculas, Arial 14 negrita);
     D.U. con puntos; nombre del trayecto y certificación TAL CUAL el Catálogo
     (Arial 12); horas del Catálogo; fecha de entrega "01 de Julio 18"
     (nunca anterior a la de egreso).
   • Reverso: módulos (denominación + código entre paréntesis, Arial 10, hasta
     2 niveles por renglón); fecha de egreso = examen final del acta
     ("29 de Noviembre 2017"); N.º de egresado; C.F.P. N.º y distrito.
   • Nunca se separan palabras en sílabas: se llena cada renglón hasta lo más
     cerca posible del final y el resto pasa abajo. El sobrante se testa con puntos.
   • El texto no se superpone con el renglón punteado ni se pasa del final.
   Se imprime en A5 en blanco con la plantilla (plantilla.pdf): un PDF con todos
   los frentes y otro con todos los reversos, en el mismo orden.
   (Helvetica es la versión de Arial que trae el PDF: mismas medidas de letra).
   ========================================================================== */

const CERT_CONFIG = {
  cfp: '403',
  distrito: 'Luján',
  plantilla: './plantilla.pdf'
};

/* ---------- Geometría de la plantilla (puntos PDF, origen abajo a la izquierda) ---------- */
const CERT_GEO = {
  frente: {
    nombre:  { y: 229.5, x0: 118, x1: 531, size: 14, min: 10, bold: true, centrar: true },
    dni:     { y: 204.5, x0: 99,  x1: 185, size: 12, min: 10, centrar: true },
    trayecto:{ y: 180.2, x0: 80,  x1: 404, size: 12, min: 8 },
    horas:   { y: 180.2, x0: 419, x1: 447, size: 12, min: 9, centrar: true },
    certificacion: [
      { y: 156.0, x0: 310, x1: 532 },
      { y: 131.8, x0: 66,  x1: 531 },
      { y: 113.2, x0: 66,  x1: 531 }
    ],
    certSize: 12, certMin: 8,
    dia:  { y: 96.2, x0: 236, x1: 287, size: 12, min: 10, centrar: true },
    mes:  { y: 96.2, x0: 301, x1: 464, size: 12, min: 10, centrar: true },
    anio: { y: 96.2, x0: 495, x1: 529, size: 12, min: 10, centrar: true }
  },
  reverso: {
    // Recuadro de módulos: se redibuja con 10 renglones de 2 niveles parejos
    borrar: { x: 23.6, y: 235.4, w: 548.6, h: 148 },
    filas: [372.5, 344, 315.5, 287, 258.5],   // 1.er nivel de cada renglón (y de los puntos)
    nivel2: 12.5,                              // distancia al 2.º nivel
    col: [ { etiqueta: 27, x0: 39, x1: 292 }, { etiqueta: 300, x0: 316, x1: 567 } ],
    modSize: 10, modMin: 7,
    egreso:   { y: 199.5, x0: 112, x1: 292, size: 12, min: 9, centrar: true },
    egresado: { y: 199.5, x0: 377, x1: 564, size: 12, min: 9, centrar: true },
    cfp:      { y: 68.8,  x0: 90,  x1: 280, size: 12, min: 9, centrar: true },
    distrito: { y: 68.8,  x0: 365, x1: 564, size: 12, min: 9, centrar: true }
  },
  sobreRenglon: 2.2,      // el texto va apenas arriba de los puntos (no se superpone)
  pasoPunto: 2.8
};

const MESES_CERT = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/* ---------- Motor de renglones (independiente de la librería de PDF) ---------- */
const CertLayout = {
  // ¿Qué tamaño hace falta para que el texto entre en un renglón?
  tamanioQueEntra(texto, ancho, base, min, medir) {
    for (let s = base; s >= min - 0.001; s -= 0.5) {
      if (medir(texto, s) <= ancho) return { size: s, entra: true };
    }
    return { size: min, entra: false };
  },

  // Reparte palabras completas en varios renglones (sin cortar en sílabas).
  // Devuelve { lineas, size, entra } con el mayor tamaño posible entre base y min.
  repartir(texto, renglones, base, min, medir) {
    const palabras = String(texto || '').trim().split(/\s+/).filter(Boolean);
    for (let s = base; s >= min - 0.001; s -= 0.5) {
      const lineas = renglones.map(() => '');
      let i = 0, ok = true;
      for (const p of palabras) {
        while (i < renglones.length) {
          const prueba = lineas[i] ? `${lineas[i]} ${p}` : p;
          if (medir(prueba, s) <= renglones[i].x1 - renglones[i].x0) { lineas[i] = prueba; break; }
          if (!lineas[i]) { ok = false; break; }   // una palabra sola no entra en el renglón
          i++;
        }
        if (i >= renglones.length || !ok) { ok = false; break; }
      }
      if (ok) return { lineas, size: s, entra: true };
    }
    // No entra ni al mínimo: se devuelve el mejor intento al mínimo (se avisa)
    const lineas = renglones.map(() => '');
    let i = 0;
    for (const p of palabras) {
      const prueba = lineas[i] ? `${lineas[i]} ${p}` : p;
      if (medir(prueba, min) <= renglones[i].x1 - renglones[i].x0 || !lineas[i]) lineas[i] = prueba;
      else if (i < renglones.length - 1) { i++; lineas[i] = p; }
      else lineas[i] = prueba;
    }
    return { lineas, size: min, entra: false };
  }
};

/* ---------- Formatos ---------- */
const CertFormato = {
  dni(v) {
    const s = String(v || '').trim().toUpperCase();
    const m = s.match(/^([A-Z]*)\s*(\d+)\s*([A-Z]*)$/);
    if (!m) return s;
    const num = m[2].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${m[1] ? m[1] + ' ' : ''}${num}${m[3] ? ' ' + m[3] : ''}`;
  },
  partesFecha(iso) {
    const [y, mo, d] = String(iso || '').slice(0, 10).split('-').map(Number);
    if (!y || !mo || !d) return null;
    return { dia: String(d).padStart(2, '0'), mes: MESES_CERT[mo - 1], anio: String(y) };
  },
  // Frente: "01" / "Julio" / "18"
  fechaFrente(iso) {
    const p = this.partesFecha(iso);
    return p ? { dia: p.dia, mes: p.mes, anio: p.anio.slice(-2) } : null;
  },
  // Reverso: "29 de Noviembre 2017"
  fechaEgreso(iso) {
    const p = this.partesFecha(iso);
    return p ? `${p.dia} de ${p.mes} ${p.anio}` : '';
  },
  nombreCertificado(nombre, apellido) {
    return `${String(nombre || '').trim()} ${String(apellido || '').trim()}`.trim().toUpperCase().replace(/\s+/g, ' ');
  },
  modulo(m) {
    const nom = String(m.nombre || '').trim();
    const cod = String(m.codigo || '').trim();
    return cod ? `${nom} (${cod})` : nom;
  }
};

/* ---------- Dibujo de un certificado sobre una plantilla (frente + reverso) ---------- */
const CertDibujo = {
  // lienzo = { texto(pag, txt, x, y, size, bold), rect(pag, x, y, w, h), punto(pag, x, y), medir(txt, size, bold) }
  // Devuelve la lista de avisos (textos que no entraron a su tamaño reglamentario)
  certificado(lienzo, frente, reverso, d) {
    const G = CERT_GEO, avisos = [];
    const sobre = G.sobreRenglon;

    const campo = (pag, c, texto, nombre, testar = false) => {
      if (!texto) { if (testar) this.testar(lienzo, pag, c.x0, c.x1, c.y + sobre); return; }
      const medir = (t, s) => lienzo.medir(t, s, !!c.bold);
      const r = CertLayout.tamanioQueEntra(texto, c.x1 - c.x0, c.size, c.min, medir);
      if (r.size < c.size) avisos.push(`${nombre}: se imprime en tamaño ${r.size} (no entra en ${c.size})${r.entra ? '' : ' y se pasa del renglón'}`);
      const w = medir(texto, r.size);
      const x = c.centrar ? c.x0 + Math.max(0, (c.x1 - c.x0 - w) / 2) : c.x0;
      lienzo.texto(pag, texto, x, c.y + sobre, r.size, !!c.bold);
      if (testar && !c.centrar) this.testar(lienzo, pag, x + w + 3, c.x1, c.y + sobre);
    };

    const varios = (pag, renglones, texto, base, min, nombre, testarVacios = true) => {
      const medir = (t, s) => lienzo.medir(t, s, false);
      const r = CertLayout.repartir(texto, renglones, base, min, medir);
      if (r.size < base) avisos.push(`${nombre}: se imprime en tamaño ${r.size} (no entra en ${base})${r.entra ? '' : ' y se pasa del renglón'}`);
      let ultima = -1;
      r.lineas.forEach((l, i) => { if (l) ultima = i; });
      renglones.forEach((ren, i) => {
        const l = r.lineas[i];
        if (l) lienzo.texto(pag, l, ren.x0, ren.y + sobre, r.size, false);
        // Se testa con puntos lo que sobra del último renglón usado y los renglones vacíos
        if (i === ultima) this.testar(lienzo, pag, ren.x0 + medir(l, r.size) + 3, ren.x1, ren.y + sobre);
        else if (i > ultima && testarVacios) this.testar(lienzo, pag, ren.x0, ren.x1, ren.y + sobre);
      });
      return r;
    };

    // ----- FRENTE -----
    campo(frente, G.frente.nombre, d.nombre, 'Nombre y apellido');
    campo(frente, G.frente.dni, d.dni, 'D.U.');
    campo(frente, G.frente.trayecto, d.trayecto, 'Nombre del trayecto', true);
    campo(frente, G.frente.horas, d.horas ? String(d.horas) : '', 'Horas');
    varios(frente, G.frente.certificacion, d.certificacion, G.frente.certSize, G.frente.certMin, 'Certificación');
    if (d.fechaEntrega) {
      campo(frente, G.frente.dia, d.fechaEntrega.dia, 'Día');
      campo(frente, G.frente.mes, d.fechaEntrega.mes, 'Mes');
      campo(frente, G.frente.anio, d.fechaEntrega.anio, 'Año');
    }

    // ----- REVERSO -----
    const R = G.reverso;
    lienzo.rect(reverso, R.borrar.x, R.borrar.y, R.borrar.w, R.borrar.h);   // se limpia el recuadro de módulos
    for (let i = 0; i < 10; i++) {
      const col = R.col[i < 5 ? 0 : 1];
      const y1 = R.filas[i % 5], y2 = y1 - R.nivel2;
      lienzo.texto(reverso, `${i + 1}.`, col.etiqueta, y1 + 1.2, 10, false);
      this.punteado(lienzo, reverso, col.x0, col.x1, y1);
      this.punteado(lienzo, reverso, col.x0, col.x1, y2);
      const ren = [{ x0: col.x0, x1: col.x1, y: y1 }, { x0: col.x0, x1: col.x1, y: y2 }];
      const m = d.modulos[i];
      // Los renglones vacíos quedan solo con su línea de puntos (sin doble punteado)
      if (m) varios(reverso, ren, m, R.modSize, R.modMin, `Módulo ${i + 1}`, false);
    }
    campo(reverso, R.egreso, d.fechaEgreso, 'Fecha de egreso');
    campo(reverso, R.egresado, d.numEgresado, 'N.º de egresado');
    campo(reverso, R.cfp, d.cfp, 'C.F.P. N.º');
    campo(reverso, R.distrito, d.distrito, 'Distrito');
    return avisos;
  },

  // Renglón punteado como el de la plantilla
  punteado(lienzo, pag, x0, x1, y) {
    for (let x = x0; x <= x1; x += CERT_GEO.pasoPunto) lienzo.punto(pag, x, y);
  },
  // "Testar" el espacio sobrante: línea de puntos a la altura del texto
  testar(lienzo, pag, x0, x1, y) {
    if (x1 - x0 < 4) return;
    for (let x = x0; x <= x1; x += CERT_GEO.pasoPunto) lienzo.punto(pag, x, y);
  }
};

/* ---------- Lienzo pdf-lib (navegador) ---------- */
async function crearLienzoPDF(doc) {
  const reg = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const neg = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const negro = PDFLib.rgb(0, 0, 0), blanco = PDFLib.rgb(1, 1, 1);
  return {
    medir: (t, s, b) => (b ? neg : reg).widthOfTextAtSize(String(t), s),
    texto: (pag, t, x, y, s, b) => pag.drawText(String(t), { x, y, size: s, font: b ? neg : reg, color: negro }),
    rect: (pag, x, y, w, h) => pag.drawRectangle({ x, y, width: w, height: h, color: blanco }),
    punto: (pag, x, y) => pag.drawRectangle({ x, y, width: 0.75, height: 0.75, color: negro })
  };
}

/* ==========================================================================
   Pantalla de emisión
   ========================================================================== */
const CertificadosAdmin = {
  trayectoId: null,
  datos: null,     // { trayecto, modulos, alumnos[], fechaEgreso, fechaEntrega, avisosTrayecto[] }
  _plantilla: null,

  esc(t) { return window.escHtml ? window.escHtml(t) : String(t ?? ''); },
  fechaAR(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''; },

  async cargarNominaCertificados() {
    const cont = document.getElementById('contenedor-certificados-trayectos');
    if (!cont) return;
    const anio = new Date().getFullYear();
    cont.innerHTML = `
      <div class="cert-filtro">
        <label for="cert-ciclo">Ciclo lectivo</label>
        <select id="cert-ciclo" class="form-control" onchange="CertificadosAdmin.listarTrayectos()">
          ${[anio + 1, anio, anio - 1, anio - 2].map(a => `<option value="${a}" ${a === anio ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
      </div>
      <div id="cert-tabs" class="acta-tabs"></div>
      <div id="cert-detalle"></div>`;
    await this.listarTrayectos();
  },

  async listarTrayectos() {
    const ciclo = Number(document.getElementById('cert-ciclo')?.value || new Date().getFullYear());
    const tabs = document.getElementById('cert-tabs');
    const det = document.getElementById('cert-detalle');
    tabs.innerHTML = '';
    det.innerHTML = '<p class="asis-cargando">Cargando trayectos…</p>';
    const { data, error } = await supabase.from('trayectos').select('id, nombre').eq('ciclo_lectivo', ciclo).order('nombre');
    if (error || !data || !data.length) { det.innerHTML = `<div class="prog-vacio">No hay trayectos en el ciclo ${ciclo}.</div>`; return; }
    tabs.innerHTML = data.map((t, i) => `<button type="button" class="acta-tab ${i === 0 ? 'activo' : ''}" onclick="CertificadosAdmin.seleccionar(${Number(t.id)}, this)">${this.esc(t.nombre)}</button>`).join('');
    await this.seleccionar(data[0].id, null);
  },

  async seleccionar(tid, boton) {
    if (boton) {
      document.querySelectorAll('#cert-tabs .acta-tab').forEach(b => b.classList.remove('activo'));
      boton.classList.add('activo');
    }
    this.trayectoId = Number(tid);
    const det = document.getElementById('cert-detalle');
    det.innerHTML = '<p class="asis-cargando">Revisando quiénes aprobaron…</p>';
    try {
      // Resultado oficial: el mismo cálculo del acta de examen (regla FP, correlatividad, equivalencias y ajustes)
      await ActasModulo.cargarDatos(this.trayectoId);
      const A = ActasModulo.datos;
      const [rI, rU] = await Promise.all([
        supabase.from('inscripciones').select('id, estudiante_user, num_egresado').eq('trayecto_id', this.trayectoId),
        supabase.from('usuarios').select('usuario, dni, nombre, apellido').in('usuario', A.alumnos.map(a => a.dni))
      ]);
      const ins = rI.data || [], us = rU.data || [];
      const alumnos = A.alumnos.map(a => {
        const i = ins.find(x => String(x.estudiante_user) === a.dni) || {};
        const u = us.find(x => String(x.usuario || x.dni) === a.dni) || {};
        return {
          dni: a.dni, inscripcionId: i.id, numEgresado: i.num_egresado || '',
          nombreCert: CertFormato.nombreCertificado(u.nombre, u.apellido) || a.nombre,
          nombreLista: a.nombre, resultado: a.resultado
        };
      });
      const t = A.trayecto;
      this.datos = {
        trayecto: t, modulos: A.modulos, alumnos,
        fechaEgreso: (A.acta && A.acta.fecha_examen) || '',
        fechaEntrega: (A.acta && A.acta.fecha_entrega) || ''
      };
      this.render();
    } catch (err) {
      console.error('Certificados:', err);
      det.innerHTML = '<div class="prog-vacio">No se pudo cargar la nómina de este trayecto.</div>';
    }
  },

  problemasTrayecto() {
    const { trayecto: t, modulos, fechaEgreso, fechaEntrega } = this.datos;
    const p = [];
    if (!String(t.resolucion || '').trim()) p.push('Falta la <b>Certificación</b> (texto del Catálogo con la resolución). Cargala en Cargar Trayecto → Editar.');
    if (!Number(t.horas)) p.push('Faltan las <b>horas</b> del Catálogo. Cargalas en Cargar Trayecto → Editar.');
    if (modulos.length > 10) p.push(`El trayecto tiene ${modulos.length} módulos y el certificado tiene lugar para 10.`);
    if (!fechaEgreso) p.push('Falta la <b>fecha de egreso</b>: es la fecha del examen final. Cargala en Fichas / Actas → Fecha del examen.');
    if (!fechaEntrega) p.push('Elegí la <b>fecha de entrega</b> (la del frente).');
    else if (fechaEgreso && fechaEntrega < fechaEgreso) p.push('La fecha de entrega no puede ser anterior a la fecha de egreso.');
    return p;
  },

  render() {
    const det = document.getElementById('cert-detalle');
    const { trayecto: t, modulos, alumnos, fechaEgreso, fechaEntrega } = this.datos;
    const aprobados = alumnos.filter(a => a.resultado === 'APROBADO');
    const otros = alumnos.filter(a => a.resultado !== 'APROBADO');
    const problemas = this.problemasTrayecto();
    const nums = aprobados.map(a => String(a.numEgresado).trim()).filter(Boolean);
    const repetidos = new Set(nums.filter((n, i) => nums.indexOf(n) !== i));
    const listos = aprobados.filter(a => String(a.numEgresado).trim());

    det.innerHTML = `
      <div class="cert-ficha">
        <div><span>Nombre del trayecto (Catálogo)</span><strong>${this.esc(t.nombre)}</strong></div>
        <div><span>Certificación (Catálogo)</span><strong>${this.esc(t.resolucion || '—')}</strong></div>
        <div><span>Horas</span><strong>${this.esc(t.horas || '—')}</strong></div>
        <div><span>Módulos</span><strong>${modulos.length}</strong></div>
        <div><span>Fecha de egreso (acta)</span><strong>${fechaEgreso ? this.fechaAR(fechaEgreso) : '—'}</strong></div>
        <div class="form-group"><label for="cert-entrega">Fecha de entrega (frente)</label>
          <input type="date" id="cert-entrega" class="form-control" value="${this.esc(fechaEntrega)}" ${fechaEgreso ? `min="${this.esc(fechaEgreso)}"` : ''} onchange="CertificadosAdmin.guardarEntrega(this.value)"></div>
        <div><span>C.F.P. N.º / Distrito</span><strong>${CERT_CONFIG.cfp} · ${this.esc(CERT_CONFIG.distrito)}</strong></div>
        <div><button type="button" class="btn btn-outline" onclick="Trayectos.editarTrayecto(${Number(t.id)})">Editar datos del trayecto</button></div>
      </div>
      ${problemas.length ? `<div class="asis-aviso"><ul class="cert-problemas">${problemas.map(p => `<li>${p}</li>`).join('')}</ul></div>` : ''}
      <div id="cert-avisos-texto"></div>

      <div class="acta-tabla-wrap">
        <table class="acta-tabla">
          <thead><tr><th>N.º</th><th>Nombre y apellido (como en el certificado)</th><th>D.U.</th><th>N.º de egresado</th><th></th></tr></thead>
          <tbody>
          ${aprobados.length ? aprobados.map((a, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${this.esc(a.nombreCert)}</strong></td>
              <td>${this.esc(CertFormato.dni(a.dni))}</td>
              <td><input class="form-control cert-egresado ${repetidos.has(String(a.numEgresado).trim()) ? 'repetido' : ''}" value="${this.esc(a.numEgresado)}"
                     aria-label="N.º de egresado de ${this.esc(a.nombreCert)}" placeholder="Sin asignar"
                     onchange="CertificadosAdmin.guardarNumEgresado('${this.esc(a.inscripcionId)}', this.value)">
                  ${repetidos.has(String(a.numEgresado).trim()) ? '<small class="cert-rep">Repetido</small>' : ''}</td>
              <td><button type="button" class="btn-ficha" onclick="CertificadosAdmin.vistaPrevia('${this.esc(a.dni)}')">Vista previa</button></td>
            </tr>`).join('') : '<tr><td colspan="5">Todavía no hay alumnos aprobados en el acta de este trayecto.</td></tr>'}
          </tbody>
        </table>
      </div>

      ${otros.length ? `<details class="cert-otros"><summary>${otros.length} inscripto(s) sin aprobar (no se certifican)</summary>
        <ul>${otros.map(a => `<li>${this.esc(a.nombreLista)} · DNI ${this.esc(a.dni)} · <span class="acta-res ${a.resultado.toLowerCase()}">${this.esc(a.resultado)}</span></li>`).join('')}</ul></details>` : ''}

      <div class="acta-acciones">
        <span class="cert-resumen">${listos.length} de ${aprobados.length} aprobado(s) con N.º de egresado</span>
        <button type="button" class="btn btn-gold" ${listos.length && !problemas.length ? '' : 'disabled'} onclick="CertificadosAdmin.descargarLote('frentes')">Descargar frentes (PDF)</button>
        <button type="button" class="btn btn-gold" ${listos.length && !problemas.length ? '' : 'disabled'} onclick="CertificadosAdmin.descargarLote('reversos')">Descargar reversos (PDF)</button>
      </div>
      <p class="acta-ayuda">Imprimí primero los frentes; después volvé a poner las hojas en la bandeja e imprimí los reversos. Están en el mismo orden (alfabético).</p>`;
    this.revisarTextos();
  },

  // Mide los textos del trayecto con la letra reglamentaria y avisa si algo no entra
  async revisarTextos() {
    const cont = document.getElementById('cert-avisos-texto');
    if (!cont || typeof PDFLib === 'undefined') return;
    try {
      const doc = await PDFLib.PDFDocument.create();
      const p1 = doc.addPage([595, 421]), p2 = doc.addPage([595, 421]);
      const lienzo = await crearLienzoPDF(doc);
      const avisos = CertDibujo.certificado(lienzo, p1, p2, this.armarDatos({ nombreCert: 'NOMBRE DE PRUEBA', dni: '30000000', numEgresado: '1' }));
      const propios = avisos.filter(a => !/^Nombre y apellido|^D\.U\.|^N\.º de egresado/.test(a));
      cont.innerHTML = propios.length
        ? `<div class="asis-aviso"><b>Textos largos:</b><ul class="cert-problemas">${propios.map(a => `<li>${this.esc(a)}</li>`).join('')}</ul>Revisá la vista previa antes de imprimir.</div>` : '';
    } catch (e) { cont.innerHTML = ''; }
  },

  armarDatos(a) {
    const { trayecto: t, modulos, fechaEgreso, fechaEntrega } = this.datos;
    return {
      nombre: a.nombreCert,
      dni: CertFormato.dni(a.dni),
      trayecto: String(t.nombre || '').trim(),
      horas: t.horas || '',
      certificacion: String(t.resolucion || '').trim(),
      fechaEntrega: CertFormato.fechaFrente(fechaEntrega),
      modulos: modulos.slice(0, 10).map(m => CertFormato.modulo(m)),
      fechaEgreso: CertFormato.fechaEgreso(fechaEgreso),
      numEgresado: String(a.numEgresado || '').trim(),
      cfp: CERT_CONFIG.cfp,
      distrito: CERT_CONFIG.distrito
    };
  },

  async guardarEntrega(valor) {
    const { fechaEgreso } = this.datos;
    if (valor && fechaEgreso && valor < fechaEgreso) {
      alert('⚠️ La fecha de entrega no puede ser anterior a la fecha de egreso (' + this.fechaAR(fechaEgreso) + ').');
      this.render();
      return;
    }
    this.datos.fechaEntrega = valor;
    const { error } = await supabase.from('actas_examen').upsert({ trayecto_id: this.trayectoId, fecha_entrega: valor || null }, { onConflict: 'trayecto_id' });
    if (error) console.warn('No se guardó la fecha de entrega (¿falta ejecutar sql/08_certificados.sql?):', error.message);
    this.render();
  },

  async guardarNumEgresado(inscripcionId, valor) {
    const v = String(valor || '').trim();
    try {
      if (v) {
        const { data: otros } = await supabase.from('inscripciones').select('id, trayecto_id, estudiante_user').eq('num_egresado', v).neq('id', inscripcionId);
        if (otros && otros.length) {
          const ok = confirm(`El N.º de egresado ${v} ya está asignado a otra inscripción (DNI ${otros[0].estudiante_user}). ¿Guardarlo igual?`);
          if (!ok) { this.render(); return; }
        }
      }
      const { error } = await supabase.from('inscripciones').update({ num_egresado: v || null }).eq('id', inscripcionId);
      if (error) throw error;
      const a = this.datos.alumnos.find(x => String(x.inscripcionId) === String(inscripcionId));
      if (a) a.numEgresado = v;
      if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'N.º de egresado guardado', showConfirmButton: false, timer: 1800 });
      this.render();
    } catch (err) {
      alert('Error al guardar el N.º de egresado: ' + (err.message || ''));
    }
  },

  async plantilla() {
    if (!this._plantilla) {
      const r = await fetch(CERT_CONFIG.plantilla);
      if (!r.ok) throw new Error('No se encontró plantilla.pdf');
      this._plantilla = await r.arrayBuffer();
    }
    return this._plantilla;
  },

  // Genera un PDF con frentes y reversos para una lista de alumnos
  async generar(lista, que) {
    const base = await this.plantilla();
    const salida = await PDFLib.PDFDocument.create();
    const avisos = [];
    for (const a of lista) {
      const doc = await PDFLib.PDFDocument.load(base);
      const [frente, reverso] = doc.getPages();
      const lienzo = await crearLienzoPDF(doc);
      CertDibujo.certificado(lienzo, frente, reverso, this.armarDatos(a)).forEach(x => avisos.push(`${a.nombreCert}: ${x}`));
      const indices = que === 'frentes' ? [0] : que === 'reversos' ? [1] : [0, 1];
      const paginas = await salida.copyPages(doc, indices);
      paginas.forEach(p => salida.addPage(p));
    }
    return { bytes: await salida.save(), avisos };
  },

  descargar(bytes, nombre) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    link.download = nombre;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 4000);
  },

  async vistaPrevia(dni) {
    const a = this.datos.alumnos.find(x => x.dni === dni);
    if (!a) return;
    try {
      const { bytes, avisos } = await this.generar([a], 'ambos');
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const w = window.open(url, '_blank');
      if (!w) this.descargar(bytes, `Vista_previa_${a.dni}.pdf`);
      if (avisos.length && typeof Swal !== 'undefined') {
        Swal.fire({ icon: 'warning', title: 'Revisá estos textos', html: `<ul style="text-align:left">${avisos.map(x => `<li>${this.esc(x)}</li>`).join('')}</ul>` });
      }
    } catch (err) {
      alert('No se pudo generar la vista previa: ' + (err.message || ''));
    }
  },

  async descargarLote(que) {
    const problemas = this.problemasTrayecto();
    if (problemas.length) { alert('⚠️ Antes de emitir, completá los datos que faltan (ver el aviso en amarillo).'); return; }
    const lista = this.datos.alumnos.filter(a => a.resultado === 'APROBADO' && String(a.numEgresado).trim());
    const sinNumero = this.datos.alumnos.filter(a => a.resultado === 'APROBADO' && !String(a.numEgresado).trim());
    if (!lista.length) { alert('⚠️ No hay aprobados con N.º de egresado asignado.'); return; }
    try {
      const { bytes, avisos } = await this.generar(lista, que);
      const nombreT = String(this.datos.trayecto.nombre || 'trayecto').replace(/[^\wÁÉÍÓÚÑáéíóúñ]+/g, '_');
      this.descargar(bytes, `Certificados_${que}_${nombreT}.pdf`);
      if (que === 'frentes') await this.registrarEmision(lista);
      const msgs = [];
      if (sinNumero.length) msgs.push(`No se incluyeron ${sinNumero.length} aprobado(s) sin N.º de egresado.`);
      if (avisos.length) msgs.push('Algunos textos se achicaron para entrar en el renglón: revisá la vista previa.');
      if (msgs.length && typeof Swal !== 'undefined') Swal.fire({ icon: 'info', title: `${lista.length} certificado(s) generados`, html: msgs.join('<br>') });
    } catch (err) {
      console.error('Lote certificados:', err);
      alert('No se pudieron generar los certificados: ' + (err.message || ''));
    }
  },

  // Registro de emisiones (quién y cuándo). Si la tabla no existe todavía, no interrumpe.
  async registrarEmision(lista) {
    try {
      const filas = lista.map(a => ({
        inscripcion_id: a.inscripcionId, trayecto_id: this.trayectoId, estudiante_user: a.dni,
        num_egresado: String(a.numEgresado).trim(), fecha_egreso: this.datos.fechaEgreso || null, fecha_entrega: this.datos.fechaEntrega || null
      }));
      const { error } = await supabase.from('certificados_emitidos').insert(filas);
      if (error) console.warn('Registro de emisión no guardado:', error.message);
    } catch (e) { /* opcional */ }
  }
};

window.CertificadosAdmin = CertificadosAdmin;
window.CertDibujo = CertDibujo;
window.CertLayout = CertLayout;
window.CertFormato = CertFormato;
