/* ==========================================================================
   COOPERADORA ESCOLAR (CFP 403)
   Padrón de socios (independiente de estudiantes), libro de ingresos/egresos
   según el Cuadro 8 de la PIA, balance mensual y anual, datos del ejercicio
   (Cuadros 1 a 7) y generación de la PIA completa en PDF, más constancias de
   pago de cuota por socio.
   Carga (alta/edición/borrado): solo Director, Regente y Preceptoría.
   Visualización: esos tres más Secretaría. Nunca Docentes ni Estudiantes.
   Archivo: js/cooperadora.js
   ========================================================================== */

/* ---------- Taxonomía fija del Cuadro 8 (PIA) ---------- */
const COOP_RUBROS = {
  entrada: [
    { seccion: 1, nombreSeccion: '1. Recursos Propios', rubros: [
      { codigo: 'a', nombre: 'Cuota Social' },
      { codigo: 'b', nombre: 'Donación de dinero' },
      { codigo: 'c', nombre: 'Rifas' },
      { codigo: 'd', nombre: 'Festivales, actos, quermese' },
      { codigo: 'e', nombre: 'Kiosco' },
      { codigo: 'f', nombre: 'Intereses bancarios' },
      { codigo: 'g', nombre: 'Reintegrados banco (débitos, mant., etc.)' }
    ]},
    { seccion: 2, nombreSeccion: '2. Recursos Oficiales', rubros: [
      { codigo: 'a', nombre: 'Subsidios de la DGCyE' }
    ]},
    { seccion: 3, nombreSeccion: '3. Otros Ingresos / Subsidios', rubros: [
      { codigo: 'a', nombre: 'Otro ingreso (a)', libre: true },
      { codigo: 'b', nombre: 'Otro ingreso (b)', libre: true }
    ]}
  ],
  salida: [
    { seccion: 1, nombreSeccion: '1. Gastos para el Alumno', rubros: [
      { codigo: 'a', nombre: 'Ropa y calzado' },
      { codigo: 'b', nombre: 'Libros y útiles' },
      { codigo: 'c', nombre: 'Excursiones' },
      { codigo: 'd', nombre: 'Emergencias sanitarias' },
      { codigo: 'e', nombre: 'Golosinas, premios y medallas' },
      { codigo: 'f', nombre: 'Otro gasto para el alumno (f)', libre: true },
      { codigo: 'g', nombre: 'Otro gasto para el alumno (g)', libre: true }
    ]},
    { seccion: 2, nombreSeccion: '2. Gastos para la Escuela', rubros: [
      { codigo: 'a', nombre: 'Material didáctico' },
      { codigo: 'b', nombre: 'Mant. y mejoras con subsidios' },
      { codigo: 'c', nombre: 'Mant. y mejoras con fondos propios' },
      { codigo: 'd', nombre: 'Artículos de limpieza' },
      { codigo: 'e', nombre: 'Combustible y calefacción' },
      { codigo: 'f', nombre: 'Librería' },
      { codigo: 'g', nombre: 'Mobiliario' },
      { codigo: 'h', nombre: 'Otro gasto para la escuela (h)', libre: true },
      { codigo: 'i', nombre: 'Otro gasto para la escuela (i)', libre: true }
    ]},
    { seccion: 3, nombreSeccion: '3. Gastos propios de la Entidad', rubros: [
      { codigo: 'a', nombre: 'Organización de rifas' },
      { codigo: 'b', nombre: 'Organización de festivales' },
      { codigo: 'c', nombre: 'Kiosco' },
      { codigo: 'd', nombre: 'Otro gasto propio de la entidad (d)', libre: true },
      { codigo: 'e', nombre: 'Otro gasto propio de la entidad (e)', libre: true }
    ]},
    { seccion: 4, nombreSeccion: '4. Otros gastos', rubros: [
      { codigo: '1', nombre: 'Otro gasto (línea 1)', libre: true },
      { codigo: '2', nombre: 'Otro gasto (línea 2)', libre: true }
    ]}
  ]
};

/* ---------- Mapa de campos del PDF oficial (203 campos AcroForm) ---------- */
const PIA_PDF = {
  archivo: 'assets/PIA_COOPERADORAS.pdf',

  // Cuadro 1: datos institucionales (página 0)
  cuadro1: {
    ciclo_desde: 'AÑO 1', ciclo_hasta: 'año 2', distrito: 'DISTRITO',
    escuela_nombre: 'ESCUELA', escuela_nro: 'nro', nro_cue: 'CUE',
    cuit1: 'CUIT1', cuit2: 'CUIT2', cuit3: 'CUIT3',
    domicilio: 'DOMICILIO', barrio: 'BARRIO', localidad: 'LOCALIDAD',
    socios_activos: 'activos', socios_honorarios: 'honorarios', socios_adherentes: 'adherentes',
    cooperadora_email: 'EMAIL', cooperadora_telefono: 'TELÉFONO',
    asesor_email: 'EMAIL2', asesor_telefono: 'TELÉFONO2'
  },
  // Cuadro 3: síntesis del acta de asamblea
  cuadro3: {
    acta_numero: 'acta', acta_fojas: 'foja',
    dia: 'dia', mes: 'mes', anio: 'año', asistieron: 'asistieron',
    decisiones: ['1DECISIÓN ADOPTADA', '2DECISIÓN ADOPTADA', '3DECISIÓN ADOPTADA', '4DECISIÓN ADOPTADA', '5DECISIÓN ADOPTADA'],
    cuota_monto: '6', chkMensual: 'Check Box34', chkAnual: 'Check Box35',
    caja_chica_monto: '7'
  },
  // Cuadro 4: comisión directiva (14 filas) — cargo, nombre, CUIL (3 partes) y vencimiento de mandato
  cuadro4filas: 14,
  cuadro4(n) {
    return { cargo: `CARGO${n}`, nombre: `NOMBRE Y APELLIDO${n}`, cuil1: `CUIL${n}`, cuil2: `CUIL${n + 14}`, cuil3: `CUIL${n + 28}`, vencimiento: `Texto${n + 3}` };
  },
  // Cuadro 5: comisión revisora de cuentas (filas fijas)
  cuadro5: {
    'titular_docente': { nombre: 'TITULAR DOCENTE', dni: 'DNI1' },
    'titular':          { nombre: 'TITULAR',         dni: 'DNI2' },
    'suplente':         { nombre: 'SUPLENTE',        dni: 'DNI3' },
    'asesor':           { nombre: 'ASESOR/A',        dni: 'DNI4' }
  },
  // Cuadro 6: representante ante la federación
  cuadro6: {
    'titular':  { nombre: 'TITULAR 2',  dni: 'DNI5' },
    'suplente': { nombre: 'SUPLENTE 2', dni: 'DNI6' }
  },
  // Cuadro 7
  cuadro7: { nro_foja_tesoreria: 'NRO FOJA' },

  // Cuadro 8: recursos y gastos (página 1) — monto de cada rubro fijo
  entradaMonto: { '1a': 'Texto18', '1b': 'Texto19', '1c': 'Texto20', '1d': 'Texto21', '1e': 'Texto22', '1f': 'Texto23', '1g': 'Texto24', '2a': 'Texto25', '3a': 'Texto26', '3b': 'Texto27' },
  entradaLibre: { '3a': 'INGRESO A', '3b': 'INGRESO B' },   // etiqueta editable de rubros libres
  salidaMonto: { '1a': 'Texto28', '1b': 'Texto29', '1c': 'Texto30', '1d': 'Texto31', '1e': 'Texto32', '1f': 'Texto33', '1g': 'Texto34', '2a': 'Texto35', '2b': 'Texto36', '2c': 'Texto37', '2d': 'Texto38', '2e': 'Texto39', '2f': 'Texto40', '2g': 'Texto41', '2h': 'Texto42', '2i': 'Texto43', '3a': 'Texto51', '3b': 'Texto52', '3c': 'Texto53', '3d': 'Texto54', '3e': 'Texto55', '41': 'Texto56', '42': 'Texto57' },
  salidaLibre: { '1f': 'GASTOS F', '1g': 'GASTOS G', '2h': 'GASTOS H', '2i': 'GASTOS I', '3d': 'GASTOS D', '3e': 'GASTOS E', '41': 'Texto50', '42': 'Texto49' },
  totalEntradasTop: 'TOTAL ENTRADAS', totalSalidasTop: 'TOTAL SALIDAS',
  resumen: {
    totalEntradas: 'Texto44', saldoAnterior: 'Texto45', totalGeneral: 'Texto46',
    totalSalidas: 'Texto47', saldoProximo: 'Texto48',
    banco_cc: 'CC', plazo_fijo: 'PF', caja_chica_efectivo: 'EFECTIVO'
  },
  observaciones: ['OBSERVACIONES 1', 'OBSERVACIONES 2'],
  banco: { banco_nombre: 'DATOS BANCO', banco_sucursal: 'SUCURSAL', banco_cuenta: 'CUENTA CORRIENTE', banco_cbu: 'CBU' },
  kiosco: {
    chkSi: 'Check Box194', chkNo: 'Check Box195', chkPropio: 'Check Box196', chkLicitado: 'Check Box197',
    desdeDia: 'D', desdeMes: 'M', desdeAnio: 'A', hastaDia: 'DIA 2', hastaMes: 'MES 2', hastaAnio: 'AÑO 2'
  }
};

const CooperadoraModulo = {
  tab: 'socios',
  puedeEditar: false,
  puedeVer: false,
  socios: [],
  movimientos: [],
  ejercicios: [],
  ejercicioActual: null,
  comision: [],

  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  money(n) { return '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  fecha(s) { return s ? String(s).slice(0, 10).split('-').reverse().join('/') : ''; },

  async cargar() {
    const cont = document.getElementById('cooperadora-contenido');
    if (!cont) return;
    const perfil = (window.Auth && Auth.usuarioActual) || await Auth.obtenerPerfilSesion();
    const rol = String(perfil?.rol || '').toLowerCase().trim();
    this.puedeEditar = Auth.esPersonal(rol);
    this.puedeVer = this.puedeEditar || Auth.esSecretaria(rol);
    if (!this.puedeVer) { cont.innerHTML = '<div class="prog-vacio">No tenés acceso a este panel.</div>'; return; }

    cont.innerHTML = '<p class="seg-cargando">Cargando cooperadora…</p>';
    try {
      const [rSocios, rMov, rEjer, rCom] = await Promise.all([
        supabase.from('cooperadora_socios').select('*').order('apellido'),
        supabase.from('cooperadora_movimientos').select('*').order('fecha', { ascending: false }),
        supabase.from('cooperadora_ejercicios').select('*').order('ciclo_desde', { ascending: false }),
        supabase.from('cooperadora_comision').select('*').order('orden')
      ]);
      if (rSocios.error) throw rSocios.error;
      this.socios = rSocios.data || [];
      this.movimientos = (rMov.error ? [] : rMov.data) || [];
      this.ejercicios = (rEjer.error ? [] : rEjer.data) || [];
      this.comision = (rCom.error ? [] : rCom.data) || [];
      if (!this.ejercicioActual && this.ejercicios.length) this.ejercicioActual = this.ejercicios[0].id;
      this.render();
    } catch (err) {
      console.error('Cooperadora:', err);
      const falta = /cooperadora_/i.test(err.message || '');
      cont.innerHTML = `<div class="prog-vacio">No se pudo cargar la cooperadora.${falta ? ' Falta ejecutar <strong>sql/35_cooperadora.sql</strong> en Supabase.' : ''}<br><small>${this.esc(err.message || '')}</small></div>`;
    }
  },

  irA(tab) { this.tab = tab; this.render(); },

  render() {
    const cont = document.getElementById('cooperadora-contenido');
    if (!cont) return;
    const tabs = [
      ['socios', '👥 Socios'], ['movimientos', '💵 Ingresos y Egresos'],
      ['balance', '📊 Balance'], ['ejercicio', '📋 Ejercicio / PIA'], ['constancias', '🧾 Constancias']
    ];
    cont.innerHTML = `
      <div class="plan-tabs">
        ${tabs.map(([id, et]) => `<button type="button" class="plan-tab ${this.tab === id ? 'activo' : ''}" onclick="CooperadoraModulo.irA('${id}')">${et}</button>`).join('')}
      </div>
      <div id="coop-panel"></div>
    `;
    const panel = document.getElementById('coop-panel');
    if (this.tab === 'socios') panel.innerHTML = this.vistaSocios();
    else if (this.tab === 'movimientos') panel.innerHTML = this.vistaMovimientos();
    else if (this.tab === 'balance') panel.innerHTML = this.vistaBalance();
    else if (this.tab === 'ejercicio') panel.innerHTML = this.vistaEjercicio();
    else if (this.tab === 'constancias') panel.innerHTML = this.vistaConstancias();
  },

  /* ============================== SOCIOS ============================== */
  vistaSocios() {
    const activos = this.socios.filter(s => s.estado === 'ACTIVO');
    return `
      ${this.puedeEditar ? `<div style="margin-bottom:0.8rem;"><button class="act-btn" onclick="CooperadoraModulo.formSocio()">➕ Nuevo socio</button></div>` : ''}
      <p class="plan-meta">${activos.length} socio${activos.length === 1 ? '' : 's'} activo${activos.length === 1 ? '' : 's'} de ${this.socios.length} en total.</p>
      <div class="sec-tabla-wrap"><table class="sec-tabla">
        <thead><tr><th>Apellido y nombre</th><th>DNI</th><th>Categoría</th><th>Contacto</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${this.socios.map(s => `
            <tr>
              <td>${this.esc(s.apellido)}, ${this.esc(s.nombre)}</td>
              <td>${this.esc(s.dni)}</td>
              <td>${this.esc(s.categoria)}</td>
              <td>${this.esc(s.email || '')}${s.telefono ? ' · ' + this.esc(s.telefono) : ''}</td>
              <td>${s.estado === 'ACTIVO' ? '🟢 Activo' : '🔴 Baja'}</td>
              <td>
                ${this.puedeEditar ? `
                  <button style="padding: 0.3rem 0.55rem; font-size: 0.85rem; background: rgba(148, 163, 184, 0.15); border: 1px solid rgba(148, 163, 184, 0.3); color: #cbd5e1; border-radius: 6px; cursor: pointer; margin-right:0.25rem;" title="Editar" onclick="CooperadoraModulo.formSocio(${s.id})">✏️</button>
                  <button style="padding: 0.3rem 0.55rem; font-size: 0.85rem; background: rgba(148, 163, 184, 0.15); border: 1px solid rgba(148, 163, 184, 0.3); color: #cbd5e1; border-radius: 6px; cursor: pointer; margin-right:0.25rem;" title="Historial / constancia" onclick="CooperadoraModulo.irA('constancias'); CooperadoraModulo.socioConstancia=${s.id}; CooperadoraModulo.render();">🧾</button>
                ` : ''}
              </td>
            </tr>
          `).join('') || '<tr><td colspan="6">Todavía no hay socios cargados.</td></tr>'}
        </tbody>
      </table></div>
    `;
  },

  async formSocio(id) {
    const s = id ? this.socios.find(x => x.id === id) : null;
    const { value } = await Swal.fire({
      title: s ? 'Editar socio' : 'Nuevo socio',
      html: `
        <input id="sw-apellido" class="swal2-input" placeholder="Apellido" value="${this.esc(s?.apellido || '')}">
        <input id="sw-nombre" class="swal2-input" placeholder="Nombre" value="${this.esc(s?.nombre || '')}">
        <input id="sw-dni" class="swal2-input" placeholder="DNI" value="${this.esc(s?.dni || '')}">
        <select id="sw-categoria" class="swal2-input">
          <option value="activo" ${s?.categoria === 'activo' ? 'selected' : ''}>Activo</option>
          <option value="honorario" ${s?.categoria === 'honorario' ? 'selected' : ''}>Honorario</option>
          <option value="adherente" ${s?.categoria === 'adherente' ? 'selected' : ''}>Adherente</option>
        </select>
        <input id="sw-email" class="swal2-input" placeholder="Correo (opcional)" value="${this.esc(s?.email || '')}">
        <input id="sw-tel" class="swal2-input" placeholder="Teléfono (opcional)" value="${this.esc(s?.telefono || '')}">
        <select id="sw-estado" class="swal2-input">
          <option value="ACTIVO" ${!s || s.estado === 'ACTIVO' ? 'selected' : ''}>Activo</option>
          <option value="BAJA" ${s?.estado === 'BAJA' ? 'selected' : ''}>Baja</option>
        </select>
      `,
      focusConfirm: false, showCancelButton: true, confirmButtonText: 'Guardar',
      preConfirm: () => {
        const apellido = document.getElementById('sw-apellido').value.trim();
        const nombre = document.getElementById('sw-nombre').value.trim();
        const dni = document.getElementById('sw-dni').value.trim();
        if (!apellido || !nombre || !dni) { Swal.showValidationMessage('Apellido, nombre y DNI son obligatorios.'); return false; }
        return {
          apellido, nombre, dni,
          categoria: document.getElementById('sw-categoria').value,
          email: document.getElementById('sw-email').value.trim() || null,
          telefono: document.getElementById('sw-tel').value.trim() || null,
          estado: document.getElementById('sw-estado').value,
          fecha_baja: document.getElementById('sw-estado').value === 'BAJA' ? new Date().toISOString().slice(0, 10) : null
        };
      }
    });
    if (!value) return;
    try {
      const { error } = s
        ? await supabase.from('cooperadora_socios').update(value).eq('id', s.id)
        : await supabase.from('cooperadora_socios').insert([value]);
      if (error) throw error;
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Guardado', showConfirmButton: false, timer: 1800 });
      await this.cargar();
    } catch (err) {
      Swal.fire('No se pudo guardar', err.message || '', 'error');
    }
  },

  /* ============================ MOVIMIENTOS ============================ */
  vistaMovimientos() {
    const filas = this.movimientos.slice(0, 200);
    return `
      ${this.puedeEditar ? `
        <div style="margin-bottom:0.8rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button class="act-btn" onclick="CooperadoraModulo.formMovimiento('entrada')">➕ Registrar ingreso</button>
          <button class="act-btn" style="background:#b91c1c;" onclick="CooperadoraModulo.formMovimiento('salida')">➖ Registrar egreso</button>
        </div>` : ''}
      <div class="sec-tabla-wrap"><table class="sec-tabla">
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Rubro</th><th>Descripción</th><th>Monto</th><th>Medio</th><th>Socio</th>${this.puedeEditar ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${filas.map(m => `
            <tr>
              <td>${this.fecha(m.fecha)}</td>
              <td>${m.tipo === 'entrada' ? '🟢 Ingreso' : '🔴 Egreso'}</td>
              <td>${this.esc(m.rubro_nombre)}</td>
              <td>${this.esc(m.descripcion || '')}</td>
              <td>${this.money(m.monto)}</td>
              <td>${({ banco_cc: 'Banco cta. cte.', caja_chica: 'Caja chica', plazo_fijo: 'Plazo fijo' })[m.medio] || m.medio}</td>
              <td>${m.socio_id ? this.esc((this.socios.find(s => s.id === m.socio_id) || {}).apellido || '') : ''}</td>
              ${this.puedeEditar ? `<td><button style="padding: 0.3rem 0.55rem; font-size: 0.85rem; background: rgba(148, 163, 184, 0.15); border: 1px solid rgba(148, 163, 184, 0.3); color: #cbd5e1; border-radius: 6px; cursor: pointer; margin-right:0.25rem;" title="Eliminar" onclick="CooperadoraModulo.borrarMovimiento(${m.id})">🗑️</button></td>` : ''}
            </tr>
          `).join('') || `<tr><td colspan="${this.puedeEditar ? 8 : 7}">Todavía no hay movimientos registrados.</td></tr>`}
        </tbody>
      </table></div>
    `;
  },

  async formMovimiento(tipo) {
    const secciones = COOP_RUBROS[tipo];
    const opciones = [];
    secciones.forEach(sec => sec.rubros.forEach(r => opciones.push({ val: `${sec.seccion}|${r.codigo}`, label: `${sec.nombreSeccion.replace(/^\d+\.\s*/, '')} — ${r.nombre}`, libre: !!r.libre })));
    const socios = this.socios.filter(s => s.estado === 'ACTIVO');
    const { value } = await Swal.fire({
      title: tipo === 'entrada' ? 'Registrar ingreso' : 'Registrar egreso',
      html: `
        <input id="sw-fecha" type="date" class="swal2-input" value="${new Date().toISOString().slice(0, 10)}">
        <select id="sw-rubro" class="swal2-input">
          ${opciones.map(o => `<option value="${o.val}" data-libre="${o.libre ? '1' : ''}">${this.esc(o.label)}</option>`).join('')}
        </select>
        <input id="sw-rubro-libre" class="swal2-input" placeholder="Si elegiste 'Otro…', escribí el detalle" style="display:none">
        <input id="sw-desc" class="swal2-input" placeholder="Descripción / comprobante">
        <input id="sw-monto" type="number" step="0.01" min="0.01" class="swal2-input" placeholder="Monto $">
        <select id="sw-medio" class="swal2-input">
          <option value="banco_cc">Banco cuenta corriente</option>
          <option value="caja_chica">Caja chica</option>
          <option value="plazo_fijo">Plazo fijo</option>
        </select>
        ${tipo === 'entrada' ? `
        <select id="sw-socio" class="swal2-input">
          <option value="">(no corresponde a cuota de un socio)</option>
          ${socios.map(s => `<option value="${s.id}">${this.esc(s.apellido)}, ${this.esc(s.nombre)} — DNI ${this.esc(s.dni)}</option>`).join('')}
        </select>
        <input id="sw-periodo" class="swal2-input" placeholder="Período de la cuota (AAAA-MM o AAAA, opcional)">
        ` : ''}
        <input id="sw-comprobante" class="swal2-input" placeholder="N.º de comprobante (opcional)">
      `,
      didOpen: () => {
        const sel = document.getElementById('sw-rubro');
        const libreIn = document.getElementById('sw-rubro-libre');
        const toggle = () => { libreIn.style.display = sel.selectedOptions[0]?.dataset.libre ? 'block' : 'none'; };
        sel.addEventListener('change', toggle); toggle();
      },
      focusConfirm: false, showCancelButton: true, confirmButtonText: 'Guardar',
      preConfirm: () => {
        const [seccion, codigo] = document.getElementById('sw-rubro').value.split('|');
        const opt = opciones.find(o => o.val === document.getElementById('sw-rubro').value);
        const monto = Number(document.getElementById('sw-monto').value);
        if (!monto || monto <= 0) { Swal.showValidationMessage('Ingresá un monto válido.'); return false; }
        let rubroNombre = opt.label.split(' — ')[1];
        if (opt.libre) {
          const libre = document.getElementById('sw-rubro-libre').value.trim();
          if (!libre) { Swal.showValidationMessage('Describí el rubro "Otro…" elegido.'); return false; }
          rubroNombre = libre;
        }
        return {
          fecha: document.getElementById('sw-fecha').value,
          tipo,
          seccion: Number(seccion),
          rubro_codigo: codigo,
          rubro_nombre: rubroNombre,
          descripcion: document.getElementById('sw-desc').value.trim() || null,
          monto,
          medio: document.getElementById('sw-medio').value,
          nro_comprobante: document.getElementById('sw-comprobante').value.trim() || null,
          socio_id: tipo === 'entrada' ? (Number(document.getElementById('sw-socio')?.value) || null) : null,
          periodo: tipo === 'entrada' ? (document.getElementById('sw-periodo')?.value.trim() || null) : null
        };
      }
    });
    if (!value) return;
    try {
      const perfil = (window.Auth && Auth.usuarioActual) || {};
      value.creado_por_nombre = `${perfil.apellido || ''}, ${perfil.nombre || ''}`.trim();
      const { error } = await supabase.from('cooperadora_movimientos').insert([value]);
      if (error) throw error;
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Movimiento registrado', showConfirmButton: false, timer: 1800 });
      await this.cargar();
    } catch (err) {
      Swal.fire('No se pudo guardar', err.message || '', 'error');
    }
  },

  async borrarMovimiento(id) {
    const ok = await Swal.fire({ title: '¿Eliminar este movimiento?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', confirmButtonColor: '#b91c1c' });
    if (!ok.isConfirmed) return;
    try {
      const { error } = await supabase.from('cooperadora_movimientos').delete().eq('id', id);
      if (error) throw error;
      await this.cargar();
    } catch (err) {
      Swal.fire('No se pudo eliminar', err.message || '', 'error');
    }
  },

  /* ============================== BALANCE ============================== */
  // Agrupa movimientos por período (mensual: AAAA-MM; anual: AAAA) para un rango dado.
  balanceDe(movs) {
    const res = { entradas: {}, salidas: {}, totalEntradas: 0, totalSalidas: 0 };
    COOP_RUBROS.entrada.forEach(sec => sec.rubros.forEach(r => { res.entradas[`${sec.seccion}${r.codigo}`] = { nombre: r.nombre, seccion: sec.nombreSeccion, monto: 0 }; }));
    COOP_RUBROS.salida.forEach(sec => sec.rubros.forEach(r => { res.salidas[`${sec.seccion}${r.codigo}`] = { nombre: r.nombre, seccion: sec.nombreSeccion, monto: 0 }; }));
    movs.forEach(m => {
      const clave = `${m.seccion}${m.rubro_codigo}`;
      const bolsa = m.tipo === 'entrada' ? res.entradas : res.salidas;
      if (!bolsa[clave]) bolsa[clave] = { nombre: m.rubro_nombre, seccion: '', monto: 0 };
      bolsa[clave].nombre = m.rubro_nombre || bolsa[clave].nombre;
      bolsa[clave].monto += Number(m.monto || 0);
      if (m.tipo === 'entrada') res.totalEntradas += Number(m.monto || 0); else res.totalSalidas += Number(m.monto || 0);
    });
    return res;
  },

  vistaBalance() {
    if (!this.balMes) this.balMes = new Date().toISOString().slice(0, 7);
    if (!this.balAnio) this.balAnio = new Date().getFullYear();
    const movsMes = this.movimientos.filter(m => String(m.fecha || '').slice(0, 7) === this.balMes);
    const movsAnio = this.movimientos.filter(m => String(m.fecha || '').slice(0, 4) === String(this.balAnio));
    const bMes = this.balanceDe(movsMes);
    const bAnio = this.balanceDe(movsAnio);
    const bloque = (titulo, b) => `
      <h4 style="margin:1rem 0 0.4rem;">${titulo}</h4>
      <div class="sec-tabla-wrap"><table class="sec-tabla">
        <thead><tr><th>Entradas</th><th style="text-align:right;">Monto</th><th>Salidas</th><th style="text-align:right;">Monto</th></tr></thead>
        <tbody>
          ${Array.from({ length: Math.max(Object.keys(b.entradas).length, Object.keys(b.salidas).length) }).map((_, i) => {
            const e = Object.values(b.entradas)[i]; const s = Object.values(b.salidas)[i];
            return `<tr><td>${e ? this.esc(e.nombre) : ''}</td><td style="text-align:right;">${e && e.monto ? this.money(e.monto) : ''}</td><td>${s ? this.esc(s.nombre) : ''}</td><td style="text-align:right;">${s && s.monto ? this.money(s.monto) : ''}</td></tr>`;
          }).join('')}
          <tr style="font-weight:700;"><td>TOTAL ENTRADAS</td><td style="text-align:right;">${this.money(b.totalEntradas)}</td><td>TOTAL SALIDAS</td><td style="text-align:right;">${this.money(b.totalSalidas)}</td></tr>
          <tr style="font-weight:700;"><td colspan="3">SALDO DEL PERÍODO</td><td style="text-align:right;">${this.money(b.totalEntradas - b.totalSalidas)}</td></tr>
        </tbody>
      </table></div>
    `;
    return `
      <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:0.5rem;">
        <label>Balance mensual: <input type="month" class="form-control" value="${this.balMes}" onchange="CooperadoraModulo.balMes=this.value; CooperadoraModulo.render();"></label>
        <label>Balance anual: <input type="number" class="form-control" style="width:7rem;" value="${this.balAnio}" onchange="CooperadoraModulo.balAnio=this.value; CooperadoraModulo.render();"></label>
      </div>
      ${bloque('Balance mensual — ' + this.balMes, bMes)}
      ${bloque('Balance anual — ' + this.balAnio, bAnio)}
    `;
  },

  /* ============================ EJERCICIO / PIA ============================ */
  vistaEjercicio() {
    const ej = this.ejercicios.find(e => e.id === this.ejercicioActual) || {};
    const dir = this.comision.filter(c => c.tipo === 'directiva' && c.ejercicio_id === this.ejercicioActual);
    const rev = this.comision.filter(c => c.tipo === 'revisora' && c.ejercicio_id === this.ejercicioActual);
    const fed = this.comision.filter(c => c.tipo === 'federacion' && c.ejercicio_id === this.ejercicioActual);
    return `
      <div style="display:flex; gap:0.6rem; align-items:center; margin-bottom:0.8rem; flex-wrap:wrap;">
        <select class="form-control" style="max-width:16rem;" onchange="CooperadoraModulo.ejercicioActual=Number(this.value)||null; CooperadoraModulo.render();">
          <option value="">(elegir ejercicio)</option>
          ${this.ejercicios.map(e => `<option value="${e.id}" ${e.id === this.ejercicioActual ? 'selected' : ''}>Ejercicio ${e.ciclo_desde}/${e.ciclo_hasta}</option>`).join('')}
        </select>
        ${this.puedeEditar ? `<button class="act-btn" onclick="CooperadoraModulo.formEjercicio()">➕ Nuevo ejercicio</button>` : ''}
        ${this.ejercicioActual && this.puedeEditar ? `<button class="act-btn" onclick="CooperadoraModulo.formEjercicio(${this.ejercicioActual})">✏️ Editar datos (Cuadros 1, 3, 7)</button>` : ''}
        ${this.ejercicioActual && this.puedeEditar ? `<button class="act-btn" onclick="CooperadoraModulo.formComision(${this.ejercicioActual})">✏️ Comisión (Cuadros 4, 5, 6)</button>` : ''}
        ${this.ejercicioActual ? `<button class="act-btn" style="background:#0f766e;" onclick="CooperadoraModulo.generarPIA()">📄 Generar PIA en PDF</button>` : ''}
      </div>
      ${!this.ejercicioActual ? '<div class="prog-vacio">Elegí o creá un ejercicio para ver y completar sus datos.</div>' : `
        <div class="sec-tabla-wrap"><table class="sec-tabla"><tbody>
          <tr><td>Escuela</td><td>${this.esc(ej.escuela_nombre || '')} N.º ${this.esc(ej.escuela_nro || '')} — ${this.esc(ej.distrito || '')}</td></tr>
          <tr><td>Domicilio</td><td>${this.esc(ej.domicilio || '')} ${ej.barrio ? '(' + this.esc(ej.barrio) + ')' : ''} — ${this.esc(ej.localidad || '')}</td></tr>
          <tr><td>CUIT</td><td>${this.esc(ej.cuit || '')}</td></tr>
          <tr><td>Socios</td><td>Activos: ${ej.socios_activos ?? '–'} · Honorarios: ${ej.socios_honorarios ?? '–'} · Adherentes: ${ej.socios_adherentes ?? '–'}</td></tr>
          <tr><td>Acta de asamblea</td><td>N.º ${this.esc(ej.acta_numero || '')}, fojas ${this.esc(ej.acta_fojas || '')} — ${this.fecha(ej.asamblea_fecha)} (asistieron ${ej.asamblea_asistieron ?? '–'})</td></tr>
          <tr><td>Cuota social</td><td>${ej.cuota_monto ? this.money(ej.cuota_monto) : '–'} (${this.esc(ej.cuota_periodicidad || '')})</td></tr>
          <tr><td>Caja chica aprobada</td><td>${ej.caja_chica_monto ? this.money(ej.caja_chica_monto) : '–'}</td></tr>
          <tr><td>Banco</td><td>${this.esc(ej.banco_nombre || '')} ${this.esc(ej.banco_sucursal || '')} — Cta. ${this.esc(ej.banco_cuenta || '')} — CBU ${this.esc(ej.banco_cbu || '')}</td></tr>
          <tr><td>Kiosco/librería</td><td>${ej.kiosco_posee ? 'Sí (' + this.esc(ej.kiosco_tipo || '') + ')' : 'No'}</td></tr>
        </tbody></table></div>
        <h4 style="margin:1rem 0 0.4rem;">Nómina de la Comisión Directiva</h4>
        <div class="sec-tabla-wrap"><table class="sec-tabla"><thead><tr><th>Cargo</th><th>Apellido y nombre</th><th>CUIL</th><th>Vencimiento mandato</th></tr></thead>
          <tbody>${dir.map(c => `<tr><td>${this.esc(c.cargo)}</td><td>${this.esc(c.apellido_nombre || '')}</td><td>${this.esc(c.documento || '')}</td><td>${this.esc(c.vencimiento || '')}</td></tr>`).join('') || '<tr><td colspan="4">Sin cargar.</td></tr>'}</tbody>
        </table></div>
        <h4 style="margin:1rem 0 0.4rem;">Comisión Revisora de Cuentas</h4>
        <div class="sec-tabla-wrap"><table class="sec-tabla"><thead><tr><th>Cargo</th><th>Apellido y nombre</th><th>DNI</th></tr></thead>
          <tbody>${rev.map(c => `<tr><td>${this.esc(c.cargo)}</td><td>${this.esc(c.apellido_nombre || '')}</td><td>${this.esc(c.documento || '')}</td></tr>`).join('') || '<tr><td colspan="3">Sin cargar.</td></tr>'}</tbody>
        </table></div>
        <h4 style="margin:1rem 0 0.4rem;">Representante ante la Federación</h4>
        <div class="sec-tabla-wrap"><table class="sec-tabla"><thead><tr><th>Cargo</th><th>Apellido y nombre</th><th>DNI</th></tr></thead>
          <tbody>${fed.map(c => `<tr><td>${this.esc(c.cargo)}</td><td>${this.esc(c.apellido_nombre || '')}</td><td>${this.esc(c.documento || '')}</td></tr>`).join('') || '<tr><td colspan="3">Sin cargar.</td></tr>'}</tbody>
        </table></div>
      `}
    `;
  },

  async formEjercicio(id) {
    const e = id ? this.ejercicios.find(x => x.id === id) : null;
    const { value } = await Swal.fire({
      title: e ? 'Editar ejercicio (Cuadros 1, 3 y 7)' : 'Nuevo ejercicio',
      width: 640,
      html: `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; text-align:left;">
          <input id="e-desde" type="number" class="swal2-input" placeholder="Año desde" value="${e?.ciclo_desde || ''}">
          <input id="e-hasta" type="number" class="swal2-input" placeholder="Año hasta" value="${e?.ciclo_hasta || ''}">
        </div>
        <input id="e-distrito" class="swal2-input" placeholder="Distrito" value="${this.esc(e?.distrito || 'Luján')}">
        <input id="e-escuela" class="swal2-input" placeholder="Nombre de la escuela" value="${this.esc(e?.escuela_nombre || '')}">
        <input id="e-nro" class="swal2-input" placeholder="N.º de escuela (CFP)" value="${this.esc(e?.escuela_nro || '403')}">
        <input id="e-cue" class="swal2-input" placeholder="N.º CUE" value="${this.esc(e?.nro_cue || '')}">
        <input id="e-cuit" class="swal2-input" placeholder="CUIT cooperadora (XX-XXXXXXXX-X)" value="${this.esc(e?.cuit || '')}">
        <input id="e-domicilio" class="swal2-input" placeholder="Domicilio" value="${this.esc(e?.domicilio || '')}">
        <input id="e-barrio" class="swal2-input" placeholder="Barrio/Paraje" value="${this.esc(e?.barrio || '')}">
        <input id="e-localidad" class="swal2-input" placeholder="Localidad" value="${this.esc(e?.localidad || 'Luján')}">
        <input id="e-coop-email" class="swal2-input" placeholder="E-mail de la cooperadora" value="${this.esc(e?.cooperadora_email || '')}">
        <input id="e-coop-tel" class="swal2-input" placeholder="Teléfono de la cooperadora" value="${this.esc(e?.cooperadora_telefono || '')}">
        <input id="e-asesor-email" class="swal2-input" placeholder="E-mail del asesor/a" value="${this.esc(e?.asesor_email || '')}">
        <input id="e-asesor-tel" class="swal2-input" placeholder="Teléfono del asesor/a" value="${this.esc(e?.asesor_telefono || '')}">
        <input id="e-activos" type="number" class="swal2-input" placeholder="Socios activos" value="${e?.socios_activos ?? ''}">
        <input id="e-honorarios" type="number" class="swal2-input" placeholder="Socios honorarios" value="${e?.socios_honorarios ?? ''}">
        <input id="e-adherentes" type="number" class="swal2-input" placeholder="Socios adherentes" value="${e?.socios_adherentes ?? ''}">
        <hr><strong>Síntesis del acta de asamblea</strong>
        <input id="e-acta-nro" class="swal2-input" placeholder="Acta N.º" value="${this.esc(e?.acta_numero || '')}">
        <input id="e-acta-fojas" class="swal2-input" placeholder="Fojas" value="${this.esc(e?.acta_fojas || '')}">
        <input id="e-asamblea-fecha" type="date" class="swal2-input" value="${e?.asamblea_fecha || ''}">
        <input id="e-asamblea-asist" type="number" class="swal2-input" placeholder="Socios activos que asistieron" value="${e?.asamblea_asistieron ?? ''}">
        <input id="e-cuota-monto" type="number" step="0.01" class="swal2-input" placeholder="Monto de cuota social aprobado $" value="${e?.cuota_monto ?? ''}">
        <select id="e-cuota-period" class="swal2-input">
          <option value="mensual" ${e?.cuota_periodicidad === 'mensual' ? 'selected' : ''}>Mensual</option>
          <option value="anual" ${e?.cuota_periodicidad === 'anual' ? 'selected' : ''}>Anual</option>
        </select>
        <input id="e-caja-chica" type="number" step="0.01" class="swal2-input" placeholder="Monto de caja chica aprobado $" value="${e?.caja_chica_monto ?? ''}">
        <hr><strong>Decisiones de la asamblea (orden del día 1 a 5)</strong>
        ${[1, 2, 3, 4, 5].map(n => `<input id="e-dec${n}" class="swal2-input" placeholder="Decisión ${n}" value="${this.esc((e?.decisiones || [])[n - 1]?.decision || '')}">`).join('')}
        <hr><strong>Banco y kiosco</strong>
        <input id="e-banco-nombre" class="swal2-input" placeholder="Banco" value="${this.esc(e?.banco_nombre || '')}">
        <input id="e-banco-sucursal" class="swal2-input" placeholder="N.º de sucursal" value="${this.esc(e?.banco_sucursal || '')}">
        <input id="e-banco-cuenta" class="swal2-input" placeholder="N.º de cuenta corriente" value="${this.esc(e?.banco_cuenta || '')}">
        <input id="e-banco-cbu" class="swal2-input" placeholder="CBU (22 dígitos)" value="${this.esc(e?.banco_cbu || '')}">
        <select id="e-kiosco-posee" class="swal2-input">
          <option value="0" ${!e?.kiosco_posee ? 'selected' : ''}>No posee kiosco/librería</option>
          <option value="1" ${e?.kiosco_posee ? 'selected' : ''}>Posee kiosco/librería</option>
        </select>
        <select id="e-kiosco-tipo" class="swal2-input">
          <option value="propio" ${e?.kiosco_tipo === 'propio' ? 'selected' : ''}>Propio</option>
          <option value="licitado" ${e?.kiosco_tipo === 'licitado' ? 'selected' : ''}>Licitado</option>
        </select>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
          <input id="e-kiosco-desde" type="date" class="swal2-input" placeholder="Desde" value="${e?.kiosco_desde || ''}">
          <input id="e-kiosco-hasta" type="date" class="swal2-input" placeholder="Hasta" value="${e?.kiosco_hasta || ''}">
        </div>
        <hr><strong>Saldos iniciales del ejercicio</strong>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem;">
          <input id="e-saldo-cc" type="number" step="0.01" class="swal2-input" placeholder="Banco cta. cte." value="${e?.saldo_inicial_banco_cc ?? 0}">
          <input id="e-saldo-pf" type="number" step="0.01" class="swal2-input" placeholder="Plazo fijo" value="${e?.saldo_inicial_plazo_fijo ?? 0}">
          <input id="e-saldo-cch" type="number" step="0.01" class="swal2-input" placeholder="Caja chica" value="${e?.saldo_inicial_caja_chica ?? 0}">
        </div>
        <textarea id="e-nro-foja" class="swal2-input" placeholder="N.º de foja del libro de Tesorería">${this.esc(e?.nro_foja_tesoreria || '')}</textarea>
        <textarea id="e-observaciones" class="swal2-textarea" placeholder="Observaciones">${this.esc(e?.observaciones || '')}</textarea>
      `,
      focusConfirm: false, showCancelButton: true, confirmButtonText: 'Guardar',
      preConfirm: () => {
        const g = id => document.getElementById(id).value.trim();
        const desde = Number(g('e-desde')), hasta = Number(g('e-hasta'));
        if (!desde || !hasta) { Swal.showValidationMessage('Completá los años del ejercicio.'); return false; }
        return {
          ciclo_desde: desde, ciclo_hasta: hasta,
          distrito: g('e-distrito') || null, escuela_nombre: g('e-escuela') || null, escuela_nro: g('e-nro') || null,
          nro_cue: g('e-cue') || null, cuit: g('e-cuit') || null,
          domicilio: g('e-domicilio') || null, barrio: g('e-barrio') || null, localidad: g('e-localidad') || null,
          cooperadora_email: g('e-coop-email') || null, cooperadora_telefono: g('e-coop-tel') || null,
          asesor_email: g('e-asesor-email') || null, asesor_telefono: g('e-asesor-tel') || null,
          socios_activos: Number(g('e-activos')) || null, socios_honorarios: Number(g('e-honorarios')) || null, socios_adherentes: Number(g('e-adherentes')) || null,
          acta_numero: g('e-acta-nro') || null, acta_fojas: g('e-acta-fojas') || null,
          asamblea_fecha: g('e-asamblea-fecha') || null, asamblea_asistieron: Number(g('e-asamblea-asist')) || null,
          cuota_monto: Number(g('e-cuota-monto')) || null, cuota_periodicidad: document.getElementById('e-cuota-period').value,
          caja_chica_monto: Number(g('e-caja-chica')) || null,
          decisiones: [1, 2, 3, 4, 5].map(n => ({ orden: n, decision: g(`e-dec${n}`) })).filter(d => d.decision),
          banco_nombre: g('e-banco-nombre') || null, banco_sucursal: g('e-banco-sucursal') || null,
          banco_cuenta: g('e-banco-cuenta') || null, banco_cbu: g('e-banco-cbu') || null,
          kiosco_posee: document.getElementById('e-kiosco-posee').value === '1',
          kiosco_tipo: document.getElementById('e-kiosco-tipo').value,
          kiosco_desde: g('e-kiosco-desde') || null, kiosco_hasta: g('e-kiosco-hasta') || null,
          saldo_inicial_banco_cc: Number(g('e-saldo-cc')) || 0, saldo_inicial_plazo_fijo: Number(g('e-saldo-pf')) || 0, saldo_inicial_caja_chica: Number(g('e-saldo-cch')) || 0,
          nro_foja_tesoreria: g('e-nro-foja') || null, observaciones: g('e-observaciones') || null
        };
      }
    });
    if (!value) return;
    try {
      const perfil = (window.Auth && Auth.usuarioActual) || {};
      value.actualizado_por = perfil.id;
      const { data, error } = e
        ? await supabase.from('cooperadora_ejercicios').update(value).eq('id', e.id).select().single()
        : await supabase.from('cooperadora_ejercicios').insert([value]).select().single();
      if (error) throw error;
      this.ejercicioActual = data.id;
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Ejercicio guardado', showConfirmButton: false, timer: 1800 });
      await this.cargar();
    } catch (err) {
      Swal.fire('No se pudo guardar', err.message || '', 'error');
    }
  },

  async formComision(ejercicioId) {
    const tabla = tipo => this.comision.filter(c => c.tipo === tipo && c.ejercicio_id === ejercicioId);
    const dir = tabla('directiva');
    const fila = (i, c) => `
      <div style="display:grid; grid-template-columns:1.3fr 2fr 1.3fr 0.9fr; gap:0.3rem; margin-bottom:0.3rem;">
        <input id="d-cargo${i}" class="swal2-input" style="margin:0;" placeholder="Cargo" value="${this.esc(c?.cargo || '')}">
        <input id="d-nombre${i}" class="swal2-input" style="margin:0;" placeholder="Apellido y nombre" value="${this.esc(c?.apellido_nombre || '')}">
        <input id="d-cuil${i}" class="swal2-input" style="margin:0;" placeholder="CUIL XX-XXXXXXXX-X" value="${this.esc(c?.documento || '')}">
        <input id="d-venc${i}" class="swal2-input" style="margin:0;" placeholder="Vencimiento" value="${this.esc(c?.vencimiento || '')}">
      </div>`;
    const { value } = await Swal.fire({
      title: 'Comisión Directiva, Revisora y Representante (Cuadros 4, 5 y 6)', width: 760,
      html: `
        <strong>Comisión Directiva (hasta 14 cargos)</strong>
        ${Array.from({ length: 14 }).map((_, i) => fila(i, dir[i])).join('')}
        <hr><strong>Comisión Revisora de Cuentas</strong>
        <div style="display:grid; grid-template-columns:1fr 2fr 1fr; gap:0.3rem; margin-bottom:0.3rem;"><b>Titular Docente</b>
          <input id="r-nombre0" class="swal2-input" style="margin:0;" placeholder="Apellido y nombre" value="${this.esc(tabla('revisora').find(c => c.cargo === 'Titular Docente')?.apellido_nombre || '')}">
          <input id="r-dni0" class="swal2-input" style="margin:0;" placeholder="DNI" value="${this.esc(tabla('revisora').find(c => c.cargo === 'Titular Docente')?.documento || '')}">
        </div>
        <div style="display:grid; grid-template-columns:1fr 2fr 1fr; gap:0.3rem; margin-bottom:0.3rem;"><b>Titular</b>
          <input id="r-nombre1" class="swal2-input" style="margin:0;" value="${this.esc(tabla('revisora').find(c => c.cargo === 'Titular')?.apellido_nombre || '')}">
          <input id="r-dni1" class="swal2-input" style="margin:0;" value="${this.esc(tabla('revisora').find(c => c.cargo === 'Titular')?.documento || '')}">
        </div>
        <div style="display:grid; grid-template-columns:1fr 2fr 1fr; gap:0.3rem; margin-bottom:0.3rem;"><b>Suplente</b>
          <input id="r-nombre2" class="swal2-input" style="margin:0;" value="${this.esc(tabla('revisora').find(c => c.cargo === 'Suplente')?.apellido_nombre || '')}">
          <input id="r-dni2" class="swal2-input" style="margin:0;" value="${this.esc(tabla('revisora').find(c => c.cargo === 'Suplente')?.documento || '')}">
        </div>
        <div style="display:grid; grid-template-columns:1fr 2fr 1fr; gap:0.3rem; margin-bottom:0.3rem;"><b>Asesor/a</b>
          <input id="r-nombre3" class="swal2-input" style="margin:0;" value="${this.esc(tabla('revisora').find(c => c.cargo === 'Asesor/a')?.apellido_nombre || '')}">
          <input id="r-dni3" class="swal2-input" style="margin:0;" value="${this.esc(tabla('revisora').find(c => c.cargo === 'Asesor/a')?.documento || '')}">
        </div>
        <hr><strong>Representante ante la Federación</strong>
        <div style="display:grid; grid-template-columns:1fr 2fr 1fr; gap:0.3rem; margin-bottom:0.3rem;"><b>Titular</b>
          <input id="f-nombre0" class="swal2-input" style="margin:0;" value="${this.esc(tabla('federacion').find(c => c.cargo === 'Titular')?.apellido_nombre || '')}">
          <input id="f-dni0" class="swal2-input" style="margin:0;" value="${this.esc(tabla('federacion').find(c => c.cargo === 'Titular')?.documento || '')}">
        </div>
        <div style="display:grid; grid-template-columns:1fr 2fr 1fr; gap:0.3rem; margin-bottom:0.3rem;"><b>Suplente</b>
          <input id="f-nombre1" class="swal2-input" style="margin:0;" value="${this.esc(tabla('federacion').find(c => c.cargo === 'Suplente')?.apellido_nombre || '')}">
          <input id="f-dni1" class="swal2-input" style="margin:0;" value="${this.esc(tabla('federacion').find(c => c.cargo === 'Suplente')?.documento || '')}">
        </div>
      `,
      focusConfirm: false, showCancelButton: true, confirmButtonText: 'Guardar',
      preConfirm: () => {
        const filas = [];
        for (let i = 0; i < 14; i++) {
          const cargo = document.getElementById(`d-cargo${i}`).value.trim();
          const nombre = document.getElementById(`d-nombre${i}`).value.trim();
          if (!cargo && !nombre) continue;
          filas.push({ tipo: 'directiva', cargo: cargo || `Vocal ${i + 1}`, apellido_nombre: nombre || null, documento: document.getElementById(`d-cuil${i}`).value.trim() || null, vencimiento: document.getElementById(`d-venc${i}`).value.trim() || null, orden: i });
        }
        ['Titular Docente', 'Titular', 'Suplente', 'Asesor/a'].forEach((cargo, i) => {
          const nombre = document.getElementById(`r-nombre${i}`).value.trim();
          const dni = document.getElementById(`r-dni${i}`).value.trim();
          if (nombre || dni) filas.push({ tipo: 'revisora', cargo, apellido_nombre: nombre || null, documento: dni || null, orden: i });
        });
        ['Titular', 'Suplente'].forEach((cargo, i) => {
          const nombre = document.getElementById(`f-nombre${i}`).value.trim();
          const dni = document.getElementById(`f-dni${i}`).value.trim();
          if (nombre || dni) filas.push({ tipo: 'federacion', cargo, apellido_nombre: nombre || null, documento: dni || null, orden: i });
        });
        return filas;
      }
    });
    if (!value) return;
    try {
      await supabase.from('cooperadora_comision').delete().eq('ejercicio_id', ejercicioId);
      if (value.length) {
        const { error } = await supabase.from('cooperadora_comision').insert(value.map(f => ({ ...f, ejercicio_id: ejercicioId })));
        if (error) throw error;
      }
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Comisión guardada', showConfirmButton: false, timer: 1800 });
      await this.cargar();
    } catch (err) {
      Swal.fire('No se pudo guardar', err.message || '', 'error');
    }
  },

  /* ============================ GENERAR PIA (PDF) ============================ */
  async generarPIA() {
    const ej = this.ejercicios.find(e => e.id === this.ejercicioActual);
    if (!ej) return;
    try {
      Swal.fire({ title: 'Generando PIA…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const bytes = await fetch(PIA_PDF.archivo).then(r => { if (!r.ok) throw new Error('No se encontró la plantilla de la PIA.'); return r.arrayBuffer(); });
      const doc = await PDFLib.PDFDocument.load(bytes);
      const form = doc.getForm();

      const setTx = (name, val) => { try { const f = form.getTextField(name); if (f) f.setText(val == null ? '' : String(val)); } catch (e) { /* campo inexistente: se omite */ } };
      const setChk = (name, on) => { try { const f = form.getCheckBox(name); if (f) { on ? f.check() : f.uncheck(); } } catch (e) { /* omite */ } };
      const montoStr = n => (n === null || n === undefined || n === 0) ? '' : Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Cuadro 1
      const c1 = PIA_PDF.cuadro1;
      setTx(c1.ciclo_desde, ej.ciclo_desde); setTx(c1.ciclo_hasta, ej.ciclo_hasta);
      setTx(c1.distrito, ej.distrito); setTx(c1.escuela_nombre, ej.escuela_nombre); setTx(c1.escuela_nro, ej.escuela_nro);
      setTx(c1.nro_cue, ej.nro_cue);
      const cuitPartes = String(ej.cuit || '').split('-');
      setTx(c1.cuit1, cuitPartes[0] || ''); setTx(c1.cuit2, cuitPartes[1] || ''); setTx(c1.cuit3, cuitPartes[2] || '');
      setTx(c1.domicilio, ej.domicilio); setTx(c1.barrio, ej.barrio); setTx(c1.localidad, ej.localidad);
      setTx(c1.socios_activos, ej.socios_activos); setTx(c1.socios_honorarios, ej.socios_honorarios); setTx(c1.socios_adherentes, ej.socios_adherentes);
      setTx(c1.cooperadora_email, ej.cooperadora_email); setTx(c1.cooperadora_telefono, ej.cooperadora_telefono);
      setTx(c1.asesor_email, ej.asesor_email); setTx(c1.asesor_telefono, ej.asesor_telefono);

      // Cuadro 3
      const c3 = PIA_PDF.cuadro3;
      setTx(c3.acta_numero, ej.acta_numero); setTx(c3.acta_fojas, ej.acta_fojas);
      if (ej.asamblea_fecha) { const [a, m, d] = String(ej.asamblea_fecha).split('-'); setTx(c3.dia, d); setTx(c3.mes, m); setTx(c3.anio, a); }
      setTx(c3.asistieron, ej.asamblea_asistieron);
      (ej.decisiones || []).forEach(d => { const campo = c3.decisiones[(d.orden || 1) - 1]; if (campo) setTx(campo, d.decision); });
      setTx(c3.cuota_monto, montoStr(ej.cuota_monto));
      setChk(c3.chkMensual, ej.cuota_periodicidad === 'mensual'); setChk(c3.chkAnual, ej.cuota_periodicidad === 'anual');
      setTx(c3.caja_chica_monto, montoStr(ej.caja_chica_monto));

      // Cuadro 4: comisión directiva
      const dir = this.comision.filter(c => c.tipo === 'directiva' && c.ejercicio_id === ej.id).sort((a, b) => (a.orden || 0) - (b.orden || 0));
      for (let i = 0; i < Math.min(PIA_PDF.cuadro4filas, dir.length); i++) {
        const campos = PIA_PDF.cuadro4(i + 1);
        const c = dir[i];
        setTx(campos.cargo, c.cargo); setTx(campos.nombre, c.apellido_nombre); setTx(campos.vencimiento, c.vencimiento);
        const cuil = String(c.documento || '').split('-');
        setTx(campos.cuil1, cuil[0] || ''); setTx(campos.cuil2, cuil[1] || ''); setTx(campos.cuil3, cuil[2] || '');
      }

      // Cuadro 5: comisión revisora
      const rev = this.comision.filter(c => c.tipo === 'revisora' && c.ejercicio_id === ej.id);
      const porCargo5 = { 'Titular Docente': 'titular_docente', 'Titular': 'titular', 'Suplente': 'suplente', 'Asesor/a': 'asesor' };
      rev.forEach(c => { const campos = PIA_PDF.cuadro5[porCargo5[c.cargo]]; if (campos) { setTx(campos.nombre, c.apellido_nombre); setTx(campos.dni, c.documento); } });

      // Cuadro 6: representante federación
      const fed = this.comision.filter(c => c.tipo === 'federacion' && c.ejercicio_id === ej.id);
      fed.forEach(c => { const campos = PIA_PDF.cuadro6[c.cargo === 'Suplente' ? 'suplente' : 'titular']; if (campos) { setTx(campos.nombre, c.apellido_nombre); setTx(campos.dni, c.documento); } });

      // Cuadro 7
      setTx(PIA_PDF.cuadro7.nro_foja_tesoreria, ej.nro_foja_tesoreria);

      // Cuadro 8: recursos y gastos del ejercicio completo (todos los movimientos del rango de años del ejercicio)
      const movsEjercicio = this.movimientos.filter(m => {
        const anio = Number(String(m.fecha || '').slice(0, 4));
        return anio >= ej.ciclo_desde && anio <= ej.ciclo_hasta;
      });
      const bal = this.balanceDe(movsEjercicio);
      Object.entries(PIA_PDF.entradaMonto).forEach(([clave, campo]) => { const r = bal.entradas[clave]; setTx(campo, r && r.monto ? montoStr(r.monto) : ''); });
      Object.entries(PIA_PDF.entradaLibre).forEach(([clave, campo]) => { const r = bal.entradas[clave]; if (r && r.nombre) setTx(campo, r.nombre.replace(/^Otro ingreso.*$/, r.nombre)); });
      Object.entries(PIA_PDF.salidaMonto).forEach(([clave, campo]) => { const r = bal.salidas[clave]; setTx(campo, r && r.monto ? montoStr(r.monto) : ''); });
      Object.entries(PIA_PDF.salidaLibre).forEach(([clave, campo]) => { const r = bal.salidas[clave]; if (r && r.nombre) setTx(campo, r.nombre); });
      setTx(PIA_PDF.totalEntradasTop, montoStr(bal.totalEntradas));
      setTx(PIA_PDF.totalSalidasTop, montoStr(bal.totalSalidas));
      const saldoAnterior = Number(ej.saldo_inicial_banco_cc || 0) + Number(ej.saldo_inicial_plazo_fijo || 0) + Number(ej.saldo_inicial_caja_chica || 0);
      const totalGeneral = bal.totalEntradas + saldoAnterior;
      const saldoProximo = totalGeneral - bal.totalSalidas;
      setTx(PIA_PDF.resumen.totalEntradas, montoStr(bal.totalEntradas));
      setTx(PIA_PDF.resumen.saldoAnterior, montoStr(saldoAnterior));
      setTx(PIA_PDF.resumen.totalGeneral, montoStr(totalGeneral));
      setTx(PIA_PDF.resumen.totalSalidas, montoStr(bal.totalSalidas));
      setTx(PIA_PDF.resumen.saldoProximo, montoStr(saldoProximo));
      setTx(PIA_PDF.resumen.banco_cc, montoStr(ej.saldo_inicial_banco_cc));
      setTx(PIA_PDF.resumen.plazo_fijo, montoStr(ej.saldo_inicial_plazo_fijo));
      setTx(PIA_PDF.resumen.caja_chica_efectivo, montoStr(ej.saldo_inicial_caja_chica));

      // Observaciones (en 2 renglones)
      const obs = String(ej.observaciones || '');
      setTx(PIA_PDF.observaciones[0], obs.slice(0, 95));
      setTx(PIA_PDF.observaciones[1], obs.slice(95, 190));

      // Banco
      setTx(PIA_PDF.banco.banco_nombre, ej.banco_nombre); setTx(PIA_PDF.banco.banco_sucursal, ej.banco_sucursal);
      setTx(PIA_PDF.banco.banco_cuenta, ej.banco_cuenta); setTx(PIA_PDF.banco.banco_cbu, ej.banco_cbu);

      // Kiosco
      setChk(PIA_PDF.kiosco.chkSi, !!ej.kiosco_posee); setChk(PIA_PDF.kiosco.chkNo, !ej.kiosco_posee);
      setChk(PIA_PDF.kiosco.chkPropio, ej.kiosco_tipo === 'propio'); setChk(PIA_PDF.kiosco.chkLicitado, ej.kiosco_tipo === 'licitado');
      if (ej.kiosco_desde) { const [a, m, d] = String(ej.kiosco_desde).split('-'); setTx(PIA_PDF.kiosco.desdeDia, d); setTx(PIA_PDF.kiosco.desdeMes, m); setTx(PIA_PDF.kiosco.desdeAnio, a); }
      if (ej.kiosco_hasta) { const [a, m, d] = String(ej.kiosco_hasta).split('-'); setTx(PIA_PDF.kiosco.hastaDia, d); setTx(PIA_PDF.kiosco.hastaMes, m); setTx(PIA_PDF.kiosco.hastaAnio, a); }

      try { form.flatten(); } catch (e) { /* si no se puede aplanar, se descarga igual con el formulario completo */ }
      const out = await doc.save();
      const blob = new Blob([out], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `PIA_Cooperadora_${ej.ciclo_desde}-${ej.ciclo_hasta}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      Swal.close();
    } catch (err) {
      console.error('Generar PIA:', err);
      Swal.fire('No se pudo generar la PIA', err.message || '', 'error');
    }
  },

  /* ============================ CONSTANCIAS ============================ */
  vistaConstancias() {
    const socioId = this.socioConstancia || null;
    const socio = socioId ? this.socios.find(s => s.id === socioId) : null;
    const historial = socio ? this.movimientos.filter(m => m.socio_id === socio.id && m.tipo === 'entrada').sort((a, b) => (a.fecha < b.fecha ? 1 : -1)) : [];
    const total = historial.reduce((a, m) => a + Number(m.monto || 0), 0);
    return `
      <div style="margin-bottom:0.8rem;">
        <select class="form-control" style="max-width:20rem;" onchange="CooperadoraModulo.socioConstancia=Number(this.value)||null; CooperadoraModulo.render();">
          <option value="">(elegir socio)</option>
          ${this.socios.map(s => `<option value="${s.id}" ${s.id === socioId ? 'selected' : ''}>${this.esc(s.apellido)}, ${this.esc(s.nombre)} — DNI ${this.esc(s.dni)}</option>`).join('')}
        </select>
      </div>
      ${!socio ? '<div class="prog-vacio">Elegí un socio para ver su historial y emitir la constancia.</div>' : `
        <div class="sec-tabla-wrap"><table class="sec-tabla">
          <thead><tr><th>Período</th><th>Fecha</th><th>Rubro</th><th>Monto</th></tr></thead>
          <tbody>${historial.map(m => `<tr><td>${this.esc(m.periodo || '–')}</td><td>${this.fecha(m.fecha)}</td><td>${this.esc(m.rubro_nombre)}</td><td>${this.money(m.monto)}</td></tr>`).join('') || '<tr><td colspan="4">Sin pagos registrados.</td></tr>'}</tbody>
        </table></div>
        <p class="plan-meta">Total pagado registrado: ${this.money(total)}</p>
        <button class="act-btn" onclick="CooperadoraModulo.imprimirConstancia(${socio.id})">🖨️ Imprimir constancia de pago</button>
      `}
    `;
  },

  imprimirConstancia(socioId) {
    const socio = this.socios.find(s => s.id === socioId);
    if (!socio) return;
    const historial = this.movimientos.filter(m => m.socio_id === socio.id && m.tipo === 'entrada').sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const total = historial.reduce((a, m) => a + Number(m.monto || 0), 0);
    const ultimo = historial[0];
    const hoy = new Date().toLocaleDateString('es-AR');
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Constancia de pago — ${this.esc(socio.apellido)}, ${this.esc(socio.nombre)}</title>
      <style>
        body{font-family:Arial,sans-serif; padding:2rem; color:#111;}
        h1{font-size:1.2rem; margin-bottom:0;} h2{font-size:1rem; color:#555; margin-top:0.2rem;}
        table{width:100%; border-collapse:collapse; margin-top:1rem;}
        th,td{border:1px solid #999; padding:0.4rem 0.6rem; text-align:left; font-size:0.9rem;}
        .tot{font-weight:bold; margin-top:0.8rem;}
        .pie{margin-top:3rem; font-size:0.8rem; color:#555;}
      </style></head><body>
      <h1>Cooperadora Escolar — CFP N.º 403 "Oscar Smith"</h1>
      <h2>Constancia de pago de cuota social</h2>
      <p><b>Socio:</b> ${this.esc(socio.apellido)}, ${this.esc(socio.nombre)} &nbsp; <b>DNI:</b> ${this.esc(socio.dni)}</p>
      ${ultimo ? `<p><b>Último pago:</b> período ${this.esc(ultimo.periodo || '–')}, por ${this.money(ultimo.monto)} el ${this.fecha(ultimo.fecha)}.</p>` : ''}
      <table><thead><tr><th>Período</th><th>Fecha de pago</th><th>Monto pagado</th></tr></thead>
        <tbody>${historial.map(m => `<tr><td>${this.esc(m.periodo || '–')}</td><td>${this.fecha(m.fecha)}</td><td>${this.money(m.monto)}</td></tr>`).join('') || '<tr><td colspan="3">Sin pagos registrados.</td></tr>'}</tbody>
      </table>
      <p class="tot">Total histórico pagado: ${this.money(total)}</p>
      <p class="pie">Constancia emitida el ${hoy}. Cooperadora Escolar CFP N.º 403, Luján.</p>
      <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    win.document.close();
  }
};

window.CooperadoraModulo = CooperadoraModulo;
