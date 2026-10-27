/* ==========================================================================
   FICHA DE INSCRIPCIÓN · esquema único, formulario y PDF
   Una sola definición de la ficha (secciones y campos) alimenta:
     - el formulario público (preinscripcion.html),
     - la edición interna (Preinscripciones, dentro de la plataforma),
     - el PDF para imprimir y firmar (con el logo del CFP y de la DGCyE).
   Archivo: js/ficha_inscripcion.js
   ========================================================================== */
const FichaInscripcion = {
  SI_NO: [['si', 'SÍ'], ['no', 'NO']],
  NIVEL: [['muy_bueno', 'Muy bueno'], ['bueno', 'Bueno'], ['regular', 'Regular'], ['no_sabe', 'No sabe']],
  /* Región Educativa 10 (DGCyE): distritos y sus localidades. Son sugerencias: la persona puede escribir cualquier otra. */
  DISTRITOS_R10: ['Luján', 'San Andrés de Giles', 'Mercedes', 'General Rodríguez', 'Marcos Paz', 'Navarro', 'Suipacha', 'Las Heras', 'Cañuelas'],
  LOCALIDADES_R10: [
    ['San Andrés de Giles', 'San Andrés de Giles'], ['Azcuénaga', 'San Andrés de Giles'], ['Cucullú', 'San Andrés de Giles'],
    ['Espora', 'San Andrés de Giles'], ['Franklin', 'San Andrés de Giles'], ['Solís', 'San Andrés de Giles'], ['Villa Ruiz', 'San Andrés de Giles'],
    ['Luján', 'Luján'], ['Carlos Keen', 'Luján'], ['Cortínez', 'Luján'], ['Jáuregui', 'Luján'], ['Lezica y Torrezuri', 'Luján'],
    ['Olivera', 'Luján'], ['Open Door', 'Luján'], ['Torres', 'Luján'], ['Villa Flandria', 'Luján'],
    ['Mercedes', 'Mercedes'], ['Gowland', 'Mercedes'], ['Goldney', 'Mercedes'], ['Tomás Jofré', 'Mercedes'],
    ['General Rodríguez', 'General Rodríguez'], ['Marcos Paz', 'Marcos Paz'], ['Navarro', 'Navarro'], ['Las Marianas', 'Navarro'], ['Villa Moll', 'Navarro'],
    ['Suipacha', 'Suipacha'], ['General Las Heras', 'Las Heras'], ['Plomer', 'Las Heras'], ['Villars', 'Las Heras'],
    ['Cañuelas', 'Cañuelas'], ['Uribelarrea', 'Cañuelas'], ['Máximo Paz', 'Cañuelas'], ['Alejandro Petión', 'Cañuelas'], ['Vicente Casares', 'Cañuelas']
  ],
  PAISES: ['Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Ecuador', 'Paraguay', 'Perú', 'Uruguay', 'Venezuela',
           'Otros países de América', 'Europa', 'Asia', 'África', 'Oceanía'],

  /* w = ancho en la fila (1 = toda la fila). t = text | number | date | tel | email | select | radio | checks | area
     req = obligatorio en el formulario público. si = solo se muestra cuando otro campo tiene ese valor. */
  secciones() {
    const SN = this.SI_NO;
    return [
      { id: 'inscripto', titulo: 'Datos del/de la inscripto/a', campos: [
        { k: 'tipo_doc', l: 'Tipo de documento', t: 'select', op: ['DNI', 'LC', 'LE', 'Pasaporte', 'Otro'], w: 0.25, req: true, def: 'DNI' },
        { k: 'dni', l: 'N.º de documento (sin puntos)', t: 'text', w: 0.25, req: true, max: 12 },
        { k: 'estado_doc', l: 'Estado del documento', t: 'radio', op: [['extraviado_tramite', 'Extraviado y en trámite'], ['extraviado_sin_tramite', 'Extraviado y NO en trámite'], ['posee', 'Posee el físico']], w: 0.5 },
        { k: 'apellido', l: 'Apellido/s', t: 'text', w: 0.4, req: true, max: 80 },
        { k: 'nombre', l: 'Nombres', t: 'text', w: 0.4, req: true, max: 80 },
        { k: 'sobrenombre', l: 'Sobrenombre', t: 'text', w: 0.2, max: 40 },
        { k: 'sexo_dni', l: 'Sexo según DNI', t: 'select', op: [['F', 'Femenino'], ['M', 'Masculino'], ['X', 'X']], w: 0.25, req: true },
        { k: 'identidad_genero', l: 'Identidad de género', t: 'text', w: 0.25, max: 40 },
        { k: 'nacionalidad', l: 'Nacionalidad', t: 'select', op: this.PAISES, w: 0.25, req: true, def: 'Argentina' },
        { k: 'fecha_nac', l: 'Fecha de nacimiento', t: 'date', w: 0.25, req: true },
        { k: 'lugar_nac', l: 'Lugar de nacimiento', t: 'text', w: 0.5, max: 120 },
        { k: 'cuil', l: 'CUIL', t: 'text', w: 0.5, max: 15 },
        { k: 'calle', l: 'Domicilio: calle', t: 'text', w: 0.4, req: true, max: 100 },
        { k: 'altura', l: 'Altura', t: 'text', w: 0.15, max: 10 },
        { k: 'piso', l: 'Piso', t: 'text', w: 0.15, max: 6 },
        { k: 'torre', l: 'Torre', t: 'text', w: 0.15, max: 6 },
        { k: 'dpto', l: 'Dpto.', t: 'text', w: 0.15, max: 6 },
        { k: 'localidad', l: 'Localidad', t: 'lista', lista: 'localidades', w: 0.4, req: true, max: 80 },
        { k: 'distrito', l: 'Distrito', t: 'lista', lista: 'distritos', w: 0.35, max: 80 },
        { k: 'cp', l: 'Código postal', t: 'text', w: 0.25, max: 12 },
        { k: 'telefono', l: 'Celular / teléfono', t: 'tel', w: 0.4, req: true, max: 40 },
        { k: 'whatsapp', l: '¿Tiene WhatsApp?', t: 'radio', op: SN, w: 0.2 },
        { k: 'email', l: 'Correo electrónico', t: 'email', w: 0.4, max: 150 }
      ] },
      { id: 'vivienda', titulo: 'Vivienda y hogar', campos: [
        { k: 'zona', l: 'Ubicación de su vivienda', t: 'radio', op: [['rural', 'Zona rural'], ['urbana', 'Zona urbana'], ['encierro', 'Contexto de encierro']], w: 1 },
        { k: 'personas_hogar', l: '¿Cuántas personas viven su hogar?', t: 'number', w: 0.34 },
        { k: 'adultos', l: '¿Cuántos adultos?', t: 'number', w: 0.33 },
        { k: 'ninos', l: '¿Cuántas niñas/os?', t: 'number', w: 0.33 },
        { k: 'hijos_a_cargo', l: '¿Tiene hijos/as a cargo?', t: 'radio', op: SN, w: 0.34 },
        { k: 'otra_lengua', l: '¿Se habla otra lengua en el hogar?', t: 'radio', op: SN, w: 0.33 },
        { k: 'lengua_tipo', l: 'Tipo de lengua', t: 'radio', op: [['extranjera', 'Lengua extranjera'], ['indigena', 'Lengua indígena']], w: 0.33, si: { k: 'otra_lengua', v: 'si' } },
        { k: 'pueblos_originarios', l: '¿Se reconoce perteneciente o descendiente de Pueblos Originarios?', t: 'radio', op: SN, w: 1 }
      ] },
      { id: 'transporte', titulo: 'Transporte y redes', campos: [
        { k: 'transporte', l: 'Transporte que usa', t: 'radio', op: [['a_pie', 'A pie / bicicleta'], ['colectivo', 'Colectivo'], ['tren', 'Tren'], ['particular', 'Vehículo particular'], ['taxi', 'Taxi / remis'], ['otro', 'Otro']], w: 1 },
        { k: 'redes', l: 'Redes que usa', t: 'checks', op: [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tiktok', 'Tik-tok'], ['twitter', 'Twitter'], ['whatsapp', 'WhatsApp'], ['youtube', 'YouTube'], ['snapchat', 'Snapchat']], w: 1 }
      ] },
      { id: 'programas', titulo: 'Programas y prestaciones', campos: [
        { k: 'programa_benef', l: '¿Es beneficiario de algún programa?', t: 'radio', op: SN, w: 1 },
        { k: 'programas', l: 'Denominación', t: 'checks', op: [['progresar', 'PRO.GRE.SAR'], ['auh', 'AUH'], ['sube', 'SUBE'], ['sumar', 'SUMAR'], ['potenciar', 'Potenciar Joven'], ['otros', 'Otros']], w: 0.7, si: { k: 'programa_benef', v: 'si' } },
        { k: 'programas_otros', l: 'Otros programas', t: 'text', w: 0.3, max: 80, si: { k: 'programa_benef', v: 'si' } },
        { k: 'prestacion', l: '¿Percibe algún tipo de prestación?', t: 'radio', op: SN, w: 1 },
        { k: 'prestaciones', l: 'Tipo de prestación', t: 'checks', op: [['jubilacion', 'Jubilación'], ['pension_nc', 'Pensión no contributiva'], ['otra_estado', 'Otra prestación del Estado'], ['pension', 'Pensión'], ['programa_social', 'Programa social']], w: 1, si: { k: 'prestacion', v: 'si' } }
      ] },
      { id: 'educativa', titulo: 'Trayectoria educativa', campos: [
        { k: 'nivel_max', l: 'Máximo nivel de estudios alcanzado', t: 'radio', op: [['egb', 'EGB'], ['polimodal', 'Polimodal'], ['secundario', 'Secundario'], ['terciario', 'Terciario'], ['universitario', 'Universitario']], w: 1, req: true },
        { k: 'cursa_actualmente', l: '¿Cursa actualmente?', t: 'radio', op: SN, w: 0.34 },
        { k: 'estado_estudios', l: 'Estado de sus estudios', t: 'radio', op: [['completo', 'Completo'], ['incompleto', 'Incompleto']], w: 0.33, req: true },
        { k: 'completar_secundario', l: 'Si tiene el secundario incompleto, ¿quisiera completarlo?', t: 'radio', op: SN, w: 0.33 }
      ] },
      { id: 'laboral', titulo: 'Trayectoria laboral y expectativas', campos: [
        { k: 'trabaja', l: 'Actualmente, ¿está trabajando?', t: 'radio', op: SN, w: 1 },
        { k: 'ocupacion', l: 'Ocupación', t: 'text', w: 0.5, max: 100, si: { k: 'trabaja', v: 'si' } },
        { k: 'lugar_trabajo', l: 'Lugar de trabajo', t: 'text', w: 0.5, max: 100, si: { k: 'trabaja', v: 'si' } },
        { k: 'contratacion', l: 'Tipo de contratación laboral', t: 'radio', op: [['dependencia', 'Relación de dependencia'], ['cuenta_propia', 'Trabajador por cuenta propia / independiente'], ['pasantia', 'Pasantía laboral'], ['autonomo', 'Profesional autónomo'], ['comerciante', 'Propietario de comercio / pyme']], w: 1, si: { k: 'trabaja', v: 'si' } },
        { k: 'trabajo_desde', l: 'Desde', t: 'date', w: 0.34, si: { k: 'trabaja', v: 'si' } },
        { k: 'trabajo_actual', l: '¿Es su trabajo actual?', t: 'radio', op: SN, w: 0.33, si: { k: 'trabaja', v: 'si' } },
        { k: 'trabajo_hasta', l: 'Hasta', t: 'date', w: 0.33, si: { k: 'trabaja', v: 'si' } },
        { k: 'motivo', l: 'Principal razón por la que se inscribió en el curso', t: 'radio', op: [['trabajo', 'Conseguir o cambiar de trabajo'], ['certificado', 'Obtener un certificado/título'], ['conocimientos', 'Mejorar y actualizar mis conocimientos'], ['oficio', 'Tener un oficio para trabajar independientemente'], ['tiempo_libre', 'Ocupar mi tiempo libre']], w: 1 },
        { k: 'vinculado_trabajo', l: '¿El curso está vinculado con su trabajo actual?', t: 'radio', op: SN, w: 0.5 },
        { k: 'cambiara_condicion', l: '¿Considera que le permitirá cambiar su condición laboral?', t: 'radio', op: SN, w: 0.5 },
        { k: 'nivel_contenidos', l: '¿Cómo supone que será el nivel de contenidos?', t: 'radio', op: this.NIVEL, w: 0.5 },
        { k: 'nivel_experiencia', l: '¿Cómo imagina que será la experiencia con docentes y compañeros?', t: 'radio', op: this.NIVEL, w: 0.5 },
        { k: 'una_palabra', l: 'En una palabra, ¿qué espera de este curso?', t: 'text', w: 1, max: 80 },
        { k: 'como_supo', l: '¿De qué manera accedió a la información sobre la inscripción?', t: 'radio', op: [['recomendacion', 'Recomendación'], ['cercania', 'Cercanía'], ['redes', 'Publicidad en redes'], ['calle', 'Publicidad en calle'], ['otros', 'Otros']], w: 0.7 },
        { k: 'como_supo_otros', l: 'Otros', t: 'text', w: 0.3, max: 80, si: { k: 'como_supo', v: 'otros' } },
        { k: 'encontro_curso', l: '¿Encontró en la institución el curso que le interesaba inicialmente?', t: 'radio', op: SN, w: 0.5 },
        { k: 'otras_ofertas', l: '¿Encontró otras ofertas de su interés?', t: 'radio', op: SN, w: 0.5 }
      ] },
      { id: 'tutor', titulo: 'Familiares / tutores (completar si es menor de edad)', campos: [
        { k: 'tutor_parentesco', l: 'Parentesco', t: 'radio', op: [['madre', 'Madre'], ['padre', 'Padre'], ['tutor', 'Tutor/Responsable']], w: 0.6 },
        { k: 'tutor_jefe_hogar', l: '¿Es jefe/a de hogar?', t: 'radio', op: SN, w: 0.4 },
        { k: 'tutor_apellido', l: 'Apellido/s', t: 'text', w: 0.5, max: 80 },
        { k: 'tutor_nombre', l: 'Nombres', t: 'text', w: 0.5, max: 80 },
        { k: 'tutor_nacionalidad', l: 'Nacionalidad', t: 'text', w: 0.5, max: 60 },
        { k: 'tutor_profesion', l: 'Profesión u ocupación', t: 'text', w: 0.5, max: 80 },
        { k: 'tutor_domicilio', l: 'Domicilio', t: 'text', w: 0.5, max: 140 },
        { k: 'tutor_tel', l: 'Tel./cel. de contacto', t: 'tel', w: 0.25, max: 40 },
        { k: 'tutor_dni', l: 'DNI', t: 'text', w: 0.25, max: 12 }
      ] },
      { id: 'emergencia', titulo: 'En caso de emergencia', campos: [
        { k: 'emerg_contacto', l: 'Avisar a', t: 'text', w: 0.6, req: true, max: 100 },
        { k: 'emerg_tel', l: 'Tel./cel.', t: 'tel', w: 0.4, req: true, max: 40 },
        { k: 'emerg_recurrir', l: 'Recurrir a', t: 'radio', op: [['hospital', 'Hospital local'], ['clinica', 'Clínica privada']], w: 0.5 },
        { k: 'emerg_clinica', l: 'Clínica', t: 'text', w: 0.5, max: 100, si: { k: 'emerg_recurrir', v: 'clinica' } }
      ] },
      { id: 'salud', titulo: 'Información de salud', campos: [
        { k: 'discapacidad', l: '¿Tiene algún tipo de discapacidad?', t: 'radio', op: SN, w: 0.4 },
        { k: 'discapacidad_cual', l: '¿Cuál?', t: 'text', w: 0.6, max: 160, si: { k: 'discapacidad', v: 'si' } },
        { k: 'enfermedad', l: '¿Padece alguna enfermedad que requiera tratamiento o control médico?', t: 'radio', op: SN, w: 0.4 },
        { k: 'enfermedad_cual', l: '¿Cuál?', t: 'text', w: 0.6, max: 160, si: { k: 'enfermedad', v: 'si' } },
        { k: 'alergia', l: '¿Tiene algún tipo de alergia?', t: 'radio', op: SN, w: 0.4 },
        { k: 'alergia_como', l: '¿Cómo se manifiesta?', t: 'text', w: 0.6, max: 160, si: { k: 'alergia', v: 'si' } },
        { k: 'condiciones', l: '¿Padece o ha padecido alguna de las siguientes condiciones de salud?', t: 'checks', w: 1, op: [
          ['asma', 'Asma / broncoespasmos a repetición'], ['celiaquia', 'Celiaquía'], ['cardiacas', 'Condiciones cardíacas'], ['diabetes', 'Diabetes'],
          ['presion', 'Presión arterial'], ['convulsiones', 'Convulsiones'], ['sangre', 'Alteraciones sanguíneas'], ['organo', 'Falta o no funcionamiento de algún órgano'],
          ['onco', 'Enfermedades onco-hematológicas'], ['inmuno', 'Inmunodeficiencias'], ['fracturas', 'Fracturas, luxaciones, lesiones'], ['craneo', 'Traumatismos de cráneo'],
          ['quemaduras', 'Quemaduras moderadas o severas'], ['piel', 'Problemas de piel'], ['alergias_graves', 'Alergias graves'], ['internado', '¿Fue internado/a alguna vez?'],
          ['operado', '¿Fue operado/a alguna vez?'], ['medicacion', '¿Recibe habitualmente algún tipo de medicación?']] },
        { k: 'medicacion_cual', l: 'Si recibe medicación, ¿cuál?', t: 'text', w: 1, max: 160 }
      ] },
      { id: 'judicial', titulo: 'Restricción judicial', campos: [
        { k: 'restriccion_judicial', l: '¿Tiene restricciones judiciales?', t: 'radio', op: SN, w: 1 }
      ] }
    ];
  },

  esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  opVal(o) { return Array.isArray(o) ? o[0] : o; },
  opLab(o) { return Array.isArray(o) ? o[1] : o; },

  /* ---------- Formulario ---------- */
  // opciones: { datos: {...}, soloLectura: bool }
  htmlFormulario(opciones = {}) {
    const d = opciones.datos || {};
    const ro = opciones.soloLectura ? 'disabled' : '';
    const campo = c => {
      const v = d[c.k] !== undefined ? d[c.k] : (c.def !== undefined ? c.def : '');
      const w = Math.round((c.w || 1) * 1000) / 10;
      const req = c.req && !opciones.soloLectura ? ' <span class="fi-req" aria-hidden="true">*</span>' : '';
      let ctl = '';
      if (c.t === 'radio') {
        ctl = `<div class="fi-opciones" role="radiogroup">${c.op.map(o => `<label class="fi-op"><input type="radio" name="fi_${c.k}" value="${this.esc(this.opVal(o))}" ${String(v) === String(this.opVal(o)) ? 'checked' : ''} ${ro}> <span>${this.esc(this.opLab(o))}</span></label>`).join('')}</div>`;
      } else if (c.t === 'checks') {
        const sel = Array.isArray(v) ? v : [];
        ctl = `<div class="fi-opciones">${c.op.map(o => `<label class="fi-op"><input type="checkbox" name="fi_${c.k}" value="${this.esc(this.opVal(o))}" ${sel.includes(this.opVal(o)) ? 'checked' : ''} ${ro}> <span>${this.esc(this.opLab(o))}</span></label>`).join('')}</div>`;
      } else if (c.t === 'select') {
        ctl = `<select name="fi_${c.k}" class="fi-input" ${ro} ${c.req ? 'aria-required="true"' : ''}><option value="">Elegí…</option>${c.op.map(o => `<option value="${this.esc(this.opVal(o))}" ${String(v) === String(this.opVal(o)) ? 'selected' : ''}>${this.esc(this.opLab(o))}</option>`).join('')}</select>`;
      } else if (c.t === 'lista') {
        const opciones = c.lista === 'distritos' ? this.DISTRITOS_R10.map(x => [x, '']) : this.LOCALIDADES_R10;
        ctl = `<input name="fi_${c.k}" type="text" class="fi-input" list="fi_dl_${c.k}" maxlength="${c.max || 80}" autocomplete="off" placeholder="Elegí de la lista o escribila" value="${this.esc(v)}" ${ro} ${c.req ? 'aria-required="true"' : ''}>
          <datalist id="fi_dl_${c.k}">${opciones.map(o => `<option value="${this.esc(o[0])}">${this.esc(o[1])}</option>`).join('')}</datalist>`;
      } else {
        const tipo = ['number', 'date', 'tel', 'email'].includes(c.t) ? c.t : 'text';
        ctl = `<input name="fi_${c.k}" type="${tipo}" class="fi-input" ${c.max ? `maxlength="${c.max}"` : ''} ${tipo === 'number' ? 'min="0" max="30"' : ''} value="${this.esc(v)}" ${ro} ${c.req ? 'aria-required="true"' : ''} ${c.k === 'dni' ? 'inputmode="numeric" autocomplete="off"' : ''}>`;
      }
      return `<div class="fi-campo" data-k="${c.k}" ${c.si ? `data-si-k="${c.si.k}" data-si-v="${c.si.v}"` : ''} style="flex:0 0 calc(${w}% - .75rem)"><label class="fi-label">${this.esc(c.l)}${req}</label>${ctl}</div>`;
    };
    return this.secciones().map(s => `
      <fieldset class="fi-seccion" data-sec="${s.id}"><legend>${this.esc(s.titulo)}</legend>
        <div class="fi-fila">${s.campos.map(campo).join('')}</div>
      </fieldset>`).join('');
  },

  /* Muestra u oculta los campos condicionales y avisa cuando algo cambia */
  activar(raiz, alCambiar) {
    const aplicar = () => {
      raiz.querySelectorAll('.fi-campo[data-si-k]').forEach(el => {
        const k = el.getAttribute('data-si-k'), v = el.getAttribute('data-si-v');
        const marcado = raiz.querySelector(`input[name="fi_${k}"]:checked`);
        el.style.display = marcado && marcado.value === v ? '' : 'none';
      });
    };
    raiz.addEventListener('change', () => { aplicar(); if (alCambiar) alCambiar(); });
    aplicar();
  },

  leer(raiz) {
    const datos = {};
    this.secciones().forEach(s => s.campos.forEach(c => {
      if (c.t === 'radio') {
        const m = raiz.querySelector(`input[name="fi_${c.k}"]:checked`);
        if (m) datos[c.k] = m.value;
      } else if (c.t === 'checks') {
        const lista = Array.from(raiz.querySelectorAll(`input[name="fi_${c.k}"]:checked`)).map(i => i.value);
        if (lista.length) datos[c.k] = lista;
      } else {
        const el = raiz.querySelector(`[name="fi_${c.k}"]`);
        const v = el ? String(el.value || '').trim() : '';
        if (v) datos[c.k] = v;
      }
    }));
    // Los campos condicionales ocultos no se envían
    this.secciones().forEach(s => s.campos.forEach(c => {
      if (c.si && datos[c.si.k] !== c.si.v) delete datos[c.k];
    }));
    return datos;
  },

  edad(fechaISO, hasta) {
    if (!fechaISO) return null;
    const n = new Date(fechaISO + 'T00:00:00'), h = hasta || new Date();
    if (isNaN(n)) return null;
    let e = h.getFullYear() - n.getFullYear();
    if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--;
    return e;
  },

  // Devuelve una lista de problemas (vacía si está todo bien)
  validar(datos) {
    const faltan = [];
    this.secciones().forEach(s => s.campos.forEach(c => {
      if (c.req && !(datos[c.k] && String(datos[c.k]).length)) faltan.push(c.l);
    }));
    const prob = faltan.map(l => `Falta completar: ${l}`);
    const dni = String(datos.dni || '').replace(/\D/g, '');
    if (datos.dni && (dni.length < 6 || dni.length > 9)) prob.push('El DNI debe tener entre 6 y 9 números, sin puntos.');
    const e = this.edad(datos.fecha_nac);
    if (datos.fecha_nac && (e === null || e < 5 || e > 100)) prob.push('Revisá la fecha de nacimiento.');
    if (e !== null && e < 18 && !(datos.tutor_apellido && datos.tutor_nombre && datos.tutor_tel)) prob.push('Por ser menor de edad, completá apellido, nombre y teléfono de la madre, padre o tutor/a.');
    if (datos.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email)) prob.push('El correo electrónico no es válido.');
    return prob;
  },

  /* ---------- PDF (pdf-lib) ---------- */
  limpio(t) {
    return String(t ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
      .replace(/\r?\n/g, ' ').replace(/[^\x20-\x7E -ÿ]/g, '?');
  },
  fechaAR(iso) { const p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''; },

  async imagen(doc, ruta) {
    try {
      const r = await fetch(ruta);
      if (!r.ok) return null;
      const b = new Uint8Array(await r.arrayBuffer());
      return /\.jpe?g$/i.test(ruta) ? await doc.embedJpg(b) : await doc.embedPng(b);
    } catch (e) { return null; }
  },

  /* opciones: { datos, trayecto: {nombre,nro,horario,sede,lugar}, numero, ciclo, enBlanco } → Uint8Array */
  async generarPDF(opciones = {}) {
    if (typeof PDFLib === 'undefined') throw new Error('No se pudo cargar el generador de PDF');
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const datos = opciones.enBlanco ? {} : (opciones.datos || {});
    const tr = opciones.trayecto || {};
    const doc = await PDFDocument.create();
    const fN = await doc.embedFont(StandardFonts.Helvetica);
    const fB = await doc.embedFont(StandardFonts.HelveticaBold);
    const [logoCfp, logoDg] = await Promise.all([this.imagen(doc, 'img/logo-cfp-ficha.png'), this.imagen(doc, 'img/logo-dgcye.png')]);
    const W = 595.28, H = 841.89, M = 34, ANCHO = W - 2 * M;
    const NEGRO = rgb(0.08, 0.1, 0.16), GRIS = rgb(0.4, 0.43, 0.5), AZUL = rgb(0.03, 0.11, 0.22), LINEA = rgb(0.6, 0.64, 0.7);
    let pag, y, nPag = 0;
    const L = t => this.limpio(t);
    const ancho = (t, f, s) => f.widthOfTextAtSize(L(t), s);

    const nuevaPagina = () => {
      pag = doc.addPage([W, H]); nPag++;
      if (nPag === 1) {
        pag.drawRectangle({ x: M, y: H - M - 96, width: ANCHO, height: 96, borderColor: NEGRO, borderWidth: 1 });
        if (logoCfp) { const d = logoCfp.scaleToFit(74, 74); pag.drawImage(logoCfp, { x: M + 10, y: H - M - 86, width: d.width, height: d.height }); }
        if (logoDg) { const d = logoDg.scaleToFit(100, 50); pag.drawImage(logoDg, { x: W - M - 10 - d.width, y: H - M - 62, width: d.width, height: d.height }); }
        const centro = (t, f, s, yy) => pag.drawText(L(t), { x: W / 2 - f.widthOfTextAtSize(L(t), s) / 2, y: yy, size: s, font: f, color: NEGRO });
        centro('FICHA DE INSCRIPCIÓN', fB, 17, H - M - 30);
        centro('DIRECCIÓN DE EDUCACIÓN TÉCNICO PROFESIONAL', fB, 9.5, H - M - 48);
        centro('DIRECCIÓN DE FORMACIÓN PROFESIONAL', fB, 9.5, H - M - 61);
        centro('Centro de Formación Profesional N.º 403 · Distrito Luján · Gestión estatal', fN, 8.5, H - M - 78);
        y = H - M - 96 - 12;
        if (opciones.numero) {
          pag.drawText(L(`Preinscripción N.º ${opciones.numero}${opciones.ciclo ? ' · Ciclo lectivo ' + opciones.ciclo : ''}`), { x: M, y, size: 9, font: fB, color: AZUL });
          y -= 14;
        }
      } else {
        pag.drawText(L(`Ficha de inscripción · CFP N.º 403${opciones.numero ? ' · N.º ' + opciones.numero : ''}`), { x: M, y: H - M + 6, size: 7.5, font: fN, color: GRIS });
        y = H - M - 14;
      }
      pag.drawText(L(`Página ${nPag}`), { x: W - M - 40, y: 18, size: 7.5, font: fN, color: GRIS });
    };
    const asegurar = alto => { if (y - alto < M + 10) nuevaPagina(); };

    // Texto con corte de línea
    const partir = (t, f, s, max) => {
      const palabras = L(t).split(' '); const lineas = []; let act = '';
      palabras.forEach(p => {
        const prueba = act ? act + ' ' + p : p;
        if (f.widthOfTextAtSize(prueba, s) <= max) act = prueba; else { if (act) lineas.push(act); act = p; }
      });
      if (act) lineas.push(act);
      return lineas.length ? lineas : [''];
    };

    const titulo = t => {
      asegurar(30);
      y -= 4;
      pag.drawRectangle({ x: M, y: y - 15, width: ANCHO, height: 15, color: AZUL });
      pag.drawText(L(t.toUpperCase()), { x: M + 6, y: y - 11, size: 8.5, font: fB, color: rgb(1, 1, 1) });
      y -= 21;
    };

    // Opciones tipo ( ) / (●): se acomodan en renglones
    const dibujarOpciones = (x0, ancho0, ops, marcados) => {
      let x = x0, yy = y; const alto = 12;
      ops.forEach(o => {
        const et = L(this.opLab(o)), w = fN.widthOfTextAtSize(et, 8) + 16;
        if (x + w > x0 + ancho0 && x > x0) { x = x0; yy -= alto; }
        pag.drawCircle({ x: x + 3.5, y: yy + 2.6, size: 3.4, borderColor: NEGRO, borderWidth: 0.7 });
        if (marcados.includes(this.opVal(o))) pag.drawCircle({ x: x + 3.5, y: yy + 2.6, size: 1.9, color: NEGRO });
        pag.drawText(et, { x: x + 10, y: yy, size: 8, font: fN, color: NEGRO });
        x += w + 6;
      });
      return y - yy + alto;       // alto usado
    };
    const altoOpciones = (ancho0, ops) => {
      let x = 0, filas = 1;
      ops.forEach(o => { const w = fN.widthOfTextAtSize(L(this.opLab(o)), 8) + 16; if (x + w > ancho0 && x > 0) { x = 0; filas++; } x += w + 6; });
      return filas * 12;
    };

    nuevaPagina();

    // Establecimiento y trayecto
    titulo('Inscripción');
    const lineaCampo = (etq, valor, x, w, yy) => {
      pag.drawText(L(etq), { x, y: yy + 12, size: 6.8, font: fB, color: GRIS });
      pag.drawText(L(valor), { x, y: yy + 2, size: 9, font: fN, color: NEGRO, maxWidth: w });
      pag.drawLine({ start: { x, y: yy - 1 }, end: { x: x + w - 6, y: yy - 1 }, thickness: 0.5, color: LINEA });
    };
    asegurar(40);
    lineaCampo('CURSO / TRAYECTO', tr.nombre || '', M, ANCHO * 0.7, y - 12);
    lineaCampo('N.º', tr.nro || '', M + ANCHO * 0.7, ANCHO * 0.3, y - 12);
    y -= 30;
    asegurar(30);
    lineaCampo('SUBSEDE / LUGAR DE DICTADO', tr.sede === 'fuera' ? (tr.lugar || 'Fuera de sede') : 'CFP N.º 403 (sede)', M, ANCHO * 0.5, y - 12);
    lineaCampo('TURNO / HORARIO', tr.horario || '', M + ANCHO * 0.5, ANCHO * 0.5, y - 12);
    y -= 30;

    this.secciones().forEach(sec => {
      if (sec.id !== 'inscripcion') titulo(sec.titulo);
      // Armado de filas según el ancho de cada campo
      let fila = [], suma = 0;
      const filas = [];
      sec.campos.forEach(c => {
        if (c.si && !opciones.enBlanco && datos[c.si.k] !== c.si.v) return;   // campo condicional no aplicable
        const w = c.w || 1;
        if (suma + w > 1.001 && fila.length) { filas.push(fila); fila = []; suma = 0; }
        fila.push(c); suma += w;
      });
      if (fila.length) filas.push(fila);

      filas.forEach(f => {
        // alto de la fila
        let alto = 22;
        f.forEach(c => {
          const w = ANCHO * (c.w || 1) - 8;
          if (c.t === 'radio' || c.t === 'checks') alto = Math.max(alto, 11 + altoOpciones(w, c.op) + 4);
          else {
            const v = c.t === 'date' ? this.fechaAR(datos[c.k]) : (datos[c.k] ?? '');
            alto = Math.max(alto, 11 + partir(String(v), fN, 9, w).length * 11 + 3);
          }
        });
        asegurar(alto + 2);
        let x = M;
        f.forEach(c => {
          const w = ANCHO * (c.w || 1);
          pag.drawText(L(c.l), { x, y: y - 8, size: 6.8, font: fB, color: GRIS, maxWidth: w - 8 });
          if (c.t === 'radio' || c.t === 'checks') {
            const marc = c.t === 'radio' ? [datos[c.k]] : (Array.isArray(datos[c.k]) ? datos[c.k] : []);
            const yy0 = y;
            y -= 20;
            dibujarOpciones(x, w - 8, c.op, marc);
            y = yy0;
          } else {
            const v = c.t === 'date' ? this.fechaAR(datos[c.k]) : (datos[c.k] ?? '');
            const lineas = partir(String(v), fN, 9, w - 8);
            lineas.forEach((ln, i) => pag.drawText(ln, { x, y: y - 19 - i * 11, size: 9, font: fN, color: NEGRO }));
            pag.drawLine({ start: { x, y: y - 21 - (lineas.length - 1) * 11 }, end: { x: x + w - 8, y: y - 21 - (lineas.length - 1) * 11 }, thickness: 0.5, color: LINEA });
          }
          x += w;
        });
        y -= alto;
      });
      y -= 4;
    });

    // Cierre: declaración y firmas
    asegurar(120);
    y -= 6;
    const decl = 'Declaro que los datos consignados son verdaderos y autorizo al CFP N.º 403 a tratarlos para la inscripción y la gestión educativa, conforme a la Ley N.º 25.326 de Protección de los Datos Personales. Esta ficha es válida solo con las firmas.';
    partir(decl, fN, 7.5, ANCHO).forEach(ln => { pag.drawText(ln, { x: M, y, size: 7.5, font: fN, color: GRIS }); y -= 10; });
    y -= 26;
    const fechaTxt = datos.fecha_envio ? this.fechaAR(datos.fecha_envio) : '';
    pag.drawText(L('FECHA:'), { x: M, y, size: 8.5, font: fB, color: NEGRO });
    pag.drawText(L(fechaTxt || '____ / ____ / ________'), { x: M + 40, y, size: 9, font: fN, color: NEGRO });
    [['FIRMA DEL/DE LA INSCRIPTO/A', M + 150], ['FIRMA MADRE / PADRE / TUTOR/A (si es menor)', M + 350]].forEach(([t, x]) => {
      pag.drawLine({ start: { x, y }, end: { x: x + 160, y }, thickness: 0.6, color: NEGRO });
      pag.drawText(L(t), { x, y: y - 9, size: 6.5, font: fN, color: GRIS });
    });
    y -= 34;
    pag.drawLine({ start: { x: M + 350, y }, end: { x: M + 510, y }, thickness: 0.6, color: NEGRO });
    pag.drawText(L('ACLARACIÓN Y DNI'), { x: M + 350, y: y - 9, size: 6.5, font: fN, color: GRIS });
    pag.drawLine({ start: { x: M + 150, y }, end: { x: M + 310, y }, thickness: 0.6, color: NEGRO });
    pag.drawText(L('FIRMA Y SELLO DEL CFP (recepción)'), { x: M + 150, y: y - 9, size: 6.5, font: fN, color: GRIS });

    return await doc.save();
  },

  async descargarPDF(opciones, nombreArchivo) {
    const bytes = await this.generarPDF(opciones);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombreArchivo || 'Ficha_de_inscripcion.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return blob;
  }
};

window.FichaInscripcion = FichaInscripcion;
