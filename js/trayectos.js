/* ==========================================================================
   MÓDULO DE TRAYECTOS FORMATIVOS POR CICLO LECTIVO
   Archivo: js/trayectos.js
   ========================================================================== */

const Trayectos = {
  listaTrayectos: [],

  // Evita que texto cargado en la base se interprete como HTML
  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },

  // Ciclo lectivo vigente = año calendario actual
  cicloVigente() {
    return new Date().getFullYear();
  },

  poblarDesplegableCiclos() {
    const selectFiltro = document.getElementById('filtro-ciclo-lectivo');
    if (!selectFiltro) return;

    const anioActual = new Date().getFullYear();
    const anioInicio = 2024;
    const anioFin = anioActual + 10;

    const seleccionPrevia = selectFiltro.value;
    let opcionesHTML = `<option value="TODOS">Todos los Ciclos</option>`;

    for (let anio = anioFin; anio >= anioInicio; anio--) {
      const esAnioActual = (anio === anioActual) ? 'selected' : '';
      opcionesHTML += `<option value="${anio}" ${esAnioActual}>Ciclo Lectivo ${anio}</option>`;
    }

    selectFiltro.innerHTML = opcionesHTML;
    if (seleccionPrevia) selectFiltro.value = seleccionPrevia;
  },

  async poblarComboDocentes() {
    const selectDocente = document.getElementById('trayecto-docente');
    if (!selectDocente) return;

    try {
      const { data: docentes, error } = await supabase
        .from('profiles')
        .select('dni, nombre, apellido')
        .eq('rol', 'docente')
        .order('apellido', { ascending: true });

      if (error) throw error;

      this.docentesLista = docentes || [];
      selectDocente.innerHTML = '<option value="">Sin docente asignado</option>';
      (docentes || []).forEach(doc => {
        const idDocente = String(doc.dni || '').trim();
        if (!idDocente) return;

        const nombreCompleto = `${doc.apellido || ''} ${doc.nombre || ''}`.trim() || idDocente;
        const opt = document.createElement('option');
        opt.value = idDocente;
        opt.textContent = `${nombreCompleto} (${idDocente})`;
        selectDocente.appendChild(opt);
      });
    } catch (err) {
      console.error('Error al cargar la lista de docentes:', err);
    }
  },

  async obtenerPerfilActual() {
    if (typeof Auth !== 'undefined' && Auth.usuarioActual) {
      return Auth.usuarioActual;
    }
    if (window.usuarioActual) {
      return window.usuarioActual;
    }
    if (typeof Auth !== 'undefined' && typeof Auth.obtenerPerfilSesion === 'function') {
      const p = await Auth.obtenerPerfilSesion();
      if (p) return p;
    }
    return null;
  },

  // Quién ve qué (además, la base de datos lo hace cumplir con RLS):
  //  - Sin sesión:   solo los trayectos del ciclo lectivo vigente (web pública)
  //  - Estudiante:   solo los trayectos en los que está inscripto
  //  - Docente:      solo los trayectos que tiene asignados
  //  - Administrador: todos (con filtro opcional por ciclo)
  async cargarTrayectos() {
    try {
      const perfil = await this.obtenerPerfilActual();
      const rolNorm = String(perfil?.rol || '').toLowerCase().trim();
      const isAdmin = Auth.esDireccion(rolNorm);
      const esDocente = rolNorm === 'docente';
      const esEstudiante = rolNorm === 'estudiante';
      const esPreceptor = rolNorm === 'preceptor';

      const selectFiltro = document.getElementById('filtro-ciclo-lectivo');
      const cicloSeleccionado = selectFiltro ? selectFiltro.value : 'TODOS';
      const hayFiltroCiclo = cicloSeleccionado && cicloSeleccionado !== 'TODOS';

      let query = supabase.from('trayectos').select('*').order('nombre', { ascending: true });

      if (isAdmin || esPreceptor) {
        if (hayFiltroCiclo) query = query.eq('ciclo_lectivo', Number(cicloSeleccionado));
      } else if (esDocente) {
        const sup = await this.misSuplencias(perfil.dni);
        this.suplencias = sup;
        const ids = Object.keys(sup).map(Number).filter(Boolean);
        const dniD = String(perfil.dni || '').replace(/[^0-9A-Za-z_-]/g, '');
        query = ids.length ? query.or(`docente_user.eq.${dniD},id.in.(${ids.join(',')})`) : query.eq('docente_user', dniD);
        if (hayFiltroCiclo) query = query.eq('ciclo_lectivo', Number(cicloSeleccionado));
      } else if (esEstudiante) {
        const { data: insc, error: errInsc } = await supabase
          .from('inscripciones')
          .select('trayecto_id')
          .eq('estudiante_user', String(perfil.dni || ''));
        if (errInsc) throw errInsc;

        const ids = [...new Set((insc || []).map(i => i.trayecto_id))].filter(Boolean);
        if (ids.length === 0) {
          this.listaTrayectos = [];
          this.renderizarTrayectos();
          return;
        }
        query = query.in('id', ids);
      } else {
        // Web pública: solo el ciclo vigente
        query = query.eq('ciclo_lectivo', this.cicloVigente());
      }

      const { data, error } = await query;
      if (error) throw error;
      const trayectos = data || [];

      // Módulos de cada trayecto
      if (trayectos.length > 0) {
        const { data: mods } = await supabase
          .from('modulos')
          .select('*')
          .in('trayecto_id', trayectos.map(t => t.id))
          .order('id', { ascending: true });   // mismo orden que el acta y el certificado
        trayectos.forEach(t => {
          t.modulos = (mods || []).filter(m => String(m.trayecto_id) === String(t.id));
        });
      }

      this.listaTrayectos = trayectos;
      this.renderizarTrayectos();
      // Copia para abrir la lista sin señal (solo personal: docentes, preceptores, dirección)
      if (perfil && ['docente', 'preceptor', 'regente', 'admin', 'administrador'].includes(String(perfil.rol || '').toLowerCase())) {
        try { localStorage.setItem('cfp_cache_trayectos', JSON.stringify({ dni: String(perfil.dni || ''), fecha: Date.now(), lista: trayectos.map(t => ({ ...t, modulos: t.modulos || [] })) })); } catch (e) { /* sin espacio */ }
      }

    } catch (err) {
      console.error('Error al cargar trayectos:', err);
      // Sin señal: la última lista guardada en este dispositivo
      try {
        const perfil = await this.obtenerPerfilActual();
        const c = JSON.parse(localStorage.getItem('cfp_cache_trayectos') || 'null');
        if (c && perfil && String(c.dni) === String(perfil.dni || '')) {
          this.listaTrayectos = c.lista || [];
          this.renderizarTrayectos();
        }
      } catch (e) { /* nada */ }
    }
  },

  LIMITE_PUBLICO: 6,

  async renderizarTrayectos() {
    const contenedores = [
      document.getElementById('lista-trayectos-cards'),
      document.getElementById('lista-trayectos-admin'),
      document.getElementById('contenedor-trayectos-estudiante'),
      document.getElementById('contenedor-trayectos')
    ].filter(el => el !== null);

    if (contenedores.length === 0) return;

    const perfil = await this.obtenerPerfilActual();
    const rolNorm = String(perfil?.rol || '').toLowerCase().trim();
    const isAdmin = Auth.esDireccion(rolNorm);
    const esDocente = rolNorm === 'docente';
    const esEstudiante = rolNorm === 'estudiante';
    const esPreceptor = rolNorm === 'preceptor';

    contenedores.forEach(contenedor => {
      contenedor.innerHTML = '';

      const esVistaPublica = contenedor.id === 'lista-trayectos-cards' || contenedor.id === 'contenedor-trayectos';

      if (this.listaTrayectos.length === 0) {
        contenedor.innerHTML = `
          <div class="empty-state-card fade-in" style="text-align: center; padding: 3rem; background: rgba(30,41,59,0.5); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); grid-column: 1 / -1;">
            <div class="empty-state-icon" style="font-size: 2rem; margin-bottom: 0.5rem;">📚</div>
            <h3 class="empty-state-title" style="color: #f8fafc; margin-bottom: 0.5rem;">${(esEstudiante && !esVistaPublica) ? 'Todavía no estás inscripto/a en ningún trayecto' : 'No hay trayectos disponibles para este ciclo lectivo'}</h3>
            <p class="empty-state-text" style="color: #94a3b8;">Ponate en contacto con la administración del CFP para más información.</p>
          </div>
        `;
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'trayectos-grid';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
      grid.style.gap = '1.5rem';
      grid.style.width = '100%';

      this.listaTrayectos.forEach(trayecto => {
        const card = document.createElement('div');
        card.className = 'course-card fade-in';
        card.style.background = '#1e293b';
        card.style.borderRadius = '12px';
        card.style.padding = '1.5rem';
        card.style.border = '1px solid rgba(255,255,255,0.1)';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';

        if (!esVistaPublica && (esDocente || esEstudiante || isAdmin || esPreceptor)) {
          card.style.cursor = 'pointer';
          card.onclick = () => {
            if (window.ClasesModulo && typeof ClasesModulo.abrirGestor === 'function') {
              ClasesModulo.abrirGestor(trayecto.id, trayecto.nombre);
            }
          };
        }

        const cicloBadge = `
          <span style="font-size: 0.75rem; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 600;">
            Ciclo Lectivo ${trayecto.ciclo_lectivo || new Date().getFullYear()}
          </span>
        `;

        const sup = !esVistaPublica && esDocente && this.suplencias ? this.suplencias[trayecto.id] : null;
        const supBadge = sup ? `<span class="sup-badge">Suplencia${sup.hasta ? ' hasta el ' + String(sup.hasta).slice(0, 10).split('-').reverse().join('/') : ''}</span>` : '';

        let accionGestionHTML = '';
        if (!esVistaPublica && (isAdmin || esDocente || esPreceptor)) {
          accionGestionHTML = `
            <button class="btn btn-gold" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; background: #0284c7; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;" onclick="event.stopPropagation(); ClasesModulo.abrirGestor(${Number(trayecto.id)}, Trayectos.nombreDe(${Number(trayecto.id)}))">
              ⚙️ Gestor / CSV
            </button>
          `;
        }

        const accionesAdmin = (isAdmin && !esVistaPublica) ? `
          <div style="margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: 0.5rem; justify-content: space-between; align-items: center;">
            ${accionGestionHTML}
            <div style="display:flex; gap:0.4rem;">
              <button class="btn btn-outline" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; color: #38bdf8; border-color: rgba(56,189,248,0.4);" onclick="event.stopPropagation(); Trayectos.editarTrayecto('${trayecto.id}')">
                ✏️ Editar
              </button>
              <button class="btn btn-outline" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; color: #f87171; border-color: rgba(248,113,113,0.4);" onclick="event.stopPropagation(); Trayectos.eliminarTrayecto('${trayecto.id}')">
                🗑️
              </button>
            </div>
          </div>
        ` : '';

        const accionEstudiante = (!esVistaPublica && esEstudiante) ? `
          <div style="margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.08);">
            <button class="btn btn-gold" style="width: 100%; padding: 0.5rem; font-size: 0.85rem; background: #0284c7; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;" onclick="event.stopPropagation(); ClasesModulo.abrirGestor(${Number(trayecto.id)}, Trayectos.nombreDe(${Number(trayecto.id)}))">
              📖 Ver Clases y Actividades
            </button>
          </div>
        ` : '';

        if (esVistaPublica) {
          card.classList.add('pub-card');
          card.dataset.busca = `${trayecto.nombre || ''} ${trayecto.descripcion || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          card.innerHTML = `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <h3 style="color: #f8fafc; margin: 0; font-size: 1.2rem; font-weight: 600;">${Trayectos.esc(trayecto.nombre)}</h3>
                ${cicloBadge}${supBadge}
              </div>
              <p class="pub-desc" style="color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.75rem; line-height: 1.4;">
                ${Trayectos.esc(trayecto.descripcion || 'Sin descripción disponible.')}
              </p>
            </div>
            ${accionesAdmin}
          `;
        } else {
          let modulosHTML = '';
          if (trayecto.modulos && trayecto.modulos.length > 0) {
            modulosHTML = trayecto.modulos.map(m => `
              <div class="modulo-card" style="margin-top: 0.5rem; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.6rem 0.8rem;">
                <strong style="color: #f8fafc; font-size: 0.85rem;">${Trayectos.esc(m.nombre)}</strong> 
                <span style="color: #fbbf24; font-size: 0.75rem;">(${Trayectos.esc(m.codigo || 'S/C')})</span>
              </div>
            `).join('');
          } else {
            modulosHTML = '<small style="color: #94a3b8;">Sin módulos asignados</small>';
          }

          const numCursoMostrado = trayecto.certificacion_oficial || trayecto.certificacion || 'S/D';

          card.innerHTML = `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <div>
                  <h3 style="color: #f8fafc; margin: 0; font-size: 1.2rem; font-weight: 600;">${Trayectos.esc(trayecto.nombre)}</h3>
                </div>
                ${cicloBadge}${supBadge}
              </div>

              <div class="trayecto-ficha">
                <span><strong>N° de curso:</strong> ${Trayectos.esc(numCursoMostrado)}</span>
                <span><strong>Resolución:</strong> ${Trayectos.esc(trayecto.resolucion || 'S/D')}</span>
              </div>

              <p style="color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.75rem; line-height: 1.4;">
                ${Trayectos.esc(trayecto.descripcion || 'Sin descripción disponible.')}
              </p>

              <div style="margin-top: 0.5rem;">${modulosHTML}</div>
            </div>
            ${accionEstudiante}
            ${accionesAdmin}
          `;
        }

        grid.appendChild(card);
      });

      contenedor.appendChild(grid);

      // Vista pública en celular: limitar a LIMITE_PUBLICO con botón "Ver todos"
      // En desktop se muestran todos (CSS oculta .pub-oculta solo en ≤900px)
      if (esVistaPublica && this.listaTrayectos.length > this.LIMITE_PUBLICO) {
        const mas = document.createElement('button');
        mas.type = 'button'; mas.className = 'btn btn-outline pub-mas';
        grid.after(mas);
        let abierto = false;
        const aplicar = () => {
          const cards = [...grid.querySelectorAll('.pub-card')];
          cards.forEach((c, i) => { c.classList.toggle('pub-oculta', !abierto && i >= this.LIMITE_PUBLICO); });
          mas.textContent = abierto ? 'Ver menos' : `Ver los ${cards.length} cursos`;
        };
        mas.addEventListener('click', () => { abierto = !abierto; aplicar(); if (!abierto) grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        aplicar();
      }
    });
  },

  async editarTrayecto(id) {
    let trayecto = (this.listaTrayectos || []).find(t => String(t.id) === String(id));
    if (!trayecto) {
      // Puede venir desde otra pantalla (por ejemplo, Certificados) sin la lista cargada
      const { data } = await supabase.from('trayectos').select('*').eq('id', Number(id)).maybeSingle();
      if (!data) return;
      trayecto = data;
    }
    const { data: modsEditar } = await supabase.from('modulos').select('*').eq('trayecto_id', Number(trayecto.id)).order('id', { ascending: true });

    if (typeof UI !== 'undefined' && UI.showTab) {
      UI.showTab('nuevo-trayecto');
    }

    await this.poblarComboDocentes();

    const tituloForm = document.getElementById('titulo-form-trayecto');
    if (tituloForm) tituloForm.innerText = 'Editar Trayecto Formativo';

    const elId = document.getElementById('trayecto-id');
    const elNombre = document.getElementById('trayecto-nombre');
    const elCiclo = document.getElementById('trayecto-ciclo');
    const elSector = document.getElementById('trayecto-sector');
    const elCert = document.getElementById('trayecto-certificacion');
    const elRes = document.getElementById('trayecto-resolucion');
    const elDesc = document.getElementById('trayecto-descripcion');
    const elReq = document.getElementById('trayecto-requisitos');
    const elDocente = document.getElementById('trayecto-docente');

    if (elId) elId.value = trayecto.id;
    if (elNombre) elNombre.value = trayecto.nombre || '';
    if (elCiclo) elCiclo.value = trayecto.ciclo_lectivo || new Date().getFullYear();
    if (elSector) elSector.value = trayecto.sector || '';
    if (elCert) elCert.value = trayecto.certificacion_oficial || trayecto.certificacion || '';
    if (elRes) elRes.value = trayecto.resolucion || '';
    if (elDesc) elDesc.value = trayecto.descripcion || '';
    if (elReq) elReq.value = trayecto.requisitos || '';
    if (elDocente) elDocente.value = trayecto.docente_user || '';
    const elComputa = document.getElementById('trayecto-computa-asistencia');
    if (elComputa) elComputa.checked = trayecto.computa_asistencia !== false;
    const elHoras = document.getElementById('trayecto-horas');
    if (elHoras) elHoras.value = trayecto.horas || '';
    // Datos de la planilla de matrícula (sql/15)
    const dias = trayecto.horario_dias || {};
    this.DIAS_PLANILLA.forEach(k => { const el = document.getElementById('trayecto-dia-' + k); if (el) el.value = dias[k] || ''; });
    const elCat = document.getElementById('trayecto-horas-catedra');
    if (elCat) elCat.value = trayecto.horas_catedra || '';
    const elObsP = document.getElementById('trayecto-obs-planilla');
    if (elObsP) elObsP.value = trayecto.obs_planilla || '';
    this.CAMPOS_FICHA.forEach(([idEl, col]) => {
      const el = document.getElementById(idEl);
      if (!el) return;
      const v = trayecto[col];
      el.value = el.type === 'date' ? String(v || '').slice(0, 10) : (v || (col === 'sede' ? 'sede' : (col === 'localidad' ? 'Luján' : '')));
    });
    const grupoLugar = document.getElementById('grupo-lugar-dictado');
    if (grupoLugar) grupoLugar.style.display = trayecto.sede === 'fuera' ? '' : 'none';
    if (window.SedesModulo) { await SedesModulo.poblar(); SedesModulo.alCargar(trayecto); }
    this.cargarFilasModulos(modsEditar || []);
    this.cargarSuplentes(trayecto.id);
  },

  async guardarTrayecto() {
    const elId = document.getElementById('trayecto-id');
    const elNombre = document.getElementById('trayecto-nombre');
    const elCiclo = document.getElementById('trayecto-ciclo');
    const elSector = document.getElementById('trayecto-sector');
    const elCert = document.getElementById('trayecto-certificacion');
    const elRes = document.getElementById('trayecto-resolucion');
    const elDesc = document.getElementById('trayecto-descripcion');
    const elReq = document.getElementById('trayecto-requisitos');
    const elDocente = document.getElementById('trayecto-docente');

    const idRaw = elId ? elId.value.trim() : '';
    const nombre = elNombre ? elNombre.value.trim() : '';
    const cicloVal = elCiclo ? elCiclo.value : '';
    const sector = elSector ? elSector.value.trim() : '';
    const certificacionVal = elCert ? elCert.value.trim() : '';
    const resolucion = elRes ? elRes.value.trim() : '';
    const descripcion = elDesc ? elDesc.value.trim() : '';
    const requisitos = elReq ? elReq.value.trim() : '';
    const docenteUser = elDocente ? elDocente.value.trim() : '';

    if (!nombre) {
      alert('El nombre del trayecto es obligatorio.');
      return;
    }

    try {
      const datosTrayecto = {
        nombre: nombre,
        ciclo_lectivo: Number(cicloVal) || new Date().getFullYear(),
        sector: sector || null,
        certificacion: certificacionVal || null,
        resolucion: resolucion || null,
        descripcion: descripcion || null,
        requisitos: requisitos || null,
        docente_user: docenteUser || null
      };
      const elComputa = document.getElementById('trayecto-computa-asistencia');
      if (elComputa) datosTrayecto.computa_asistencia = elComputa.checked;
      const elHoras = document.getElementById('trayecto-horas');
      if (elHoras) datosTrayecto.horas = elHoras.value ? Number(elHoras.value) : null;
      // Datos de la Ficha de Curso (sql/09)
      const camposFicha = {};
      this.CAMPOS_FICHA.forEach(([idEl, col]) => {
        const el = document.getElementById(idEl);
        if (el) camposFicha[col] = el.value.trim() || null;
      });
      camposFicha.sede_id = /^\d+$/.test(String(camposFicha.sede_id || '')) ? Number(camposFicha.sede_id) : null;
      if (!window.SedesModulo || !SedesModulo.disponible) delete camposFicha.sede_id;   // todavía sin sql/20
      if (camposFicha.sede !== 'fuera') camposFicha.lugar_dictado = null;
      Object.assign(datosTrayecto, camposFicha);
      // Datos de la planilla de matrícula (sql/15)
      const horarioDias = {};
      this.DIAS_PLANILLA.forEach(k => { const v = (document.getElementById('trayecto-dia-' + k)?.value || '').trim().toUpperCase(); if (v) horarioDias[k] = v; });
      const elCat = document.getElementById('trayecto-horas-catedra');
      const elObsP = document.getElementById('trayecto-obs-planilla');
      const camposPlanilla = {
        horario_dias: Object.keys(horarioDias).length ? horarioDias : null,
        horas_catedra: elCat && elCat.value ? Number(elCat.value) : null,
        obs_planilla: elObsP && elObsP.value.trim() ? elObsP.value.trim() : null
      };
      Object.assign(datosTrayecto, camposPlanilla);
      const quitarPlanilla = () => Object.keys(camposPlanilla).forEach(k => delete datosTrayecto[k]);
      const quitarFicha = () => Object.keys(camposFicha).forEach(k => delete datosTrayecto[k]);

      if (idRaw && idRaw !== '') {
        const idQuery = !isNaN(idRaw) ? parseInt(idRaw, 10) : idRaw;

        let { error } = await supabase
          .from('trayectos')
          .update(datosTrayecto)
          .eq('id', idQuery);
        if (error && /sede|lugar_dictado|localidad|horario(?!_dias)|fecha_inicio|fecha_cierre|tipo_certificacion|codigo_catalogo|acto_administrativo/.test(error.message || '')) {
          quitarFicha();   // todavía no se ejecutó sql/09
          ({ error } = await supabase.from('trayectos').update(datosTrayecto).eq('id', idQuery));
        }
        if (error && /horario_dias|horas_catedra|obs_planilla/.test(error.message || '')) {
          quitarPlanilla();   // todavía no se ejecutó sql/15
          ({ error } = await supabase.from('trayectos').update(datosTrayecto).eq('id', idQuery));
        }
        if (error && /computa_asistencia|horas/.test(error.message || '')) {
          // Todavía no se ejecutó sql/07 u 08: se guarda sin esos datos
          delete datosTrayecto.computa_asistencia;
          delete datosTrayecto.horas;
          ({ error } = await supabase.from('trayectos').update(datosTrayecto).eq('id', idQuery));
        }

        if (error) throw error;
        const avisoMods = await this.guardarModulos(idQuery);
        alert('Trayecto actualizado con éxito.' + avisoMods);
      } else {
        let { data: nuevo, error } = await supabase
          .from('trayectos')
          .insert([datosTrayecto]).select('id').single();
        if (error && /sede|lugar_dictado|localidad|horario(?!_dias)|fecha_inicio|fecha_cierre|tipo_certificacion|codigo_catalogo|acto_administrativo/.test(error.message || '')) {
          quitarFicha();
          ({ data: nuevo, error } = await supabase.from('trayectos').insert([datosTrayecto]).select('id').single());
        }
        if (error && /horario_dias|horas_catedra|obs_planilla/.test(error.message || '')) {
          quitarPlanilla();
          ({ data: nuevo, error } = await supabase.from('trayectos').insert([datosTrayecto]).select('id').single());
        }
        if (error && /computa_asistencia|horas/.test(error.message || '')) {
          delete datosTrayecto.computa_asistencia;
          delete datosTrayecto.horas;
          ({ data: nuevo, error } = await supabase.from('trayectos').insert([datosTrayecto]).select('id').single());
        }

        if (error) throw error;
        const avisoMods = nuevo && nuevo.id ? await this.guardarModulos(nuevo.id) : '';
        alert('Trayecto guardado con éxito.' + avisoMods);
      }

      const form = document.getElementById('form-trayecto');
      if (form) form.reset();
      if (elId) elId.value = '';
      this.cargarFilasModulos([]);

      const tituloForm = document.getElementById('titulo-form-trayecto');
      if (tituloForm) tituloForm.innerText = 'Nuevo Trayecto Formativo';

      await this.cargarTrayectos();

      if (typeof UI !== 'undefined' && UI.showTab) {
        UI.showTab('trayectos');
      }

    } catch (err) {
      console.error('Error al guardar trayecto:', err);
      alert('Error al guardar: ' + (err.message || 'Error de conexión'));
    }
  },

  // "Cargar Trayecto" desde el menú: formulario limpio (para no editar sin querer el último trayecto abierto)
  nuevo() {
    const form = document.getElementById('form-trayecto');
    if (form) form.reset();
    const elId = document.getElementById('trayecto-id');
    if (elId) elId.value = '';
    const t = document.getElementById('titulo-form-trayecto');
    if (t) t.innerText = 'Nuevo Trayecto Formativo';
    this.cargarFilasModulos([]);
    this.cargarSuplentes(null);
    const grupoLugar = document.getElementById('grupo-lugar-dictado');
    if (grupoLugar) grupoLugar.style.display = 'none';
    const selSede = document.getElementById('trayecto-sede-id');
    if (selSede) selSede.value = '';
    if (window.SedesModulo) SedesModulo.poblar();
    if (typeof UI !== 'undefined') UI.showTab('nuevo-trayecto');
    this.poblarComboDocentes();
  },

  /* ---------- Suplentes del trayecto ----------
     Además del instructor titular, la dirección puede cargar suplentes con fecha de inicio
     y de fin (opcionales). Mientras dura la suplencia tienen el mismo acceso que el titular. */
  // Nombre del trayecto por id (evita meter texto libre dentro de los onclick)
  nombreDe(id) { const t = (this.listaTrayectos || []).find(x => Number(x.id) === Number(id)); return t ? t.nombre : ''; },

  async misSuplencias(dni) {
    try {
      const { data, error } = await supabase.from('trayecto_docentes').select('*').eq('docente_user', String(dni || ''));
      if (error) return {};
      const hoy = window.ReglasFP ? ReglasFP.hoyISO() : new Date().toISOString().slice(0, 10);
      const out = {};
      (data || []).filter(s => (!s.desde || String(s.desde).slice(0, 10) <= hoy) && (!s.hasta || String(s.hasta).slice(0, 10) >= hoy))
        .forEach(s => { out[s.trayecto_id] = s; });
      return out;
    } catch (e) { return {}; }
  },

  async cargarSuplentes(tid) {
    const cont = document.getElementById('suplentes-lista');
    if (!cont) return;
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    if (!tid) {
      cont.innerHTML = '<p class="sup-ayuda">Guardá el trayecto y después, al editarlo, vas a poder agregar suplentes.</p>';
      return;
    }
    cont.innerHTML = '<p class="sup-ayuda">Cargando…</p>';
    if (!this.docentesLista) await this.poblarComboDocentes();
    const { data, error } = await supabase.from('trayecto_docentes').select('*').eq('trayecto_id', Number(tid)).order('id', { ascending: true });
    if (error) {
      cont.innerHTML = '<p class="sup-ayuda">Para cargar suplentes, ejecutá <b>sql/12_suplentes_y_auditoria.sql</b> en Supabase.</p>';
      return;
    }
    const docs = this.docentesLista || [];
    const nombre = (dni) => { const d = docs.find(x => String(x.dni) === String(dni)); return d ? `${String(d.apellido || '').toUpperCase()}, ${d.nombre || ''}` : `DNI ${dni}`; };
    const f = (v) => v ? String(v).slice(0, 10).split('-').reverse().join('/') : '';
    const hoy = window.ReglasFP ? ReglasFP.hoyISO() : new Date().toISOString().slice(0, 10);
    const estado = (s) => (s.hasta && String(s.hasta).slice(0, 10) < hoy) ? ['terminada', 'Terminó'] : (s.desde && String(s.desde).slice(0, 10) > hoy) ? ['futura', 'Empieza el ' + f(s.desde)] : ['vigente', 'Vigente'];
    cont.innerHTML = `
      ${(data || []).length ? `<ul class="sup-lista">${data.map(s => { const [cls, txt] = estado(s); return `<li>
          <div><strong>${esc(nombre(s.docente_user))}</strong>
            <span class="sup-periodo">${s.desde || s.hasta ? `${s.desde ? 'desde el ' + f(s.desde) : ''} ${s.hasta ? 'hasta el ' + f(s.hasta) : '(sin fecha de fin)'}` : 'Sin fechas: tiene acceso hasta que lo quites'}</span>
            ${s.motivo ? `<span class="sup-periodo">· ${esc(s.motivo)}</span>` : ''}</div>
          <span class="sup-estado ${cls}">${txt}</span>
          <button type="button" class="sup-quitar" onclick="Trayectos.quitarSuplente(${Number(s.id)}, ${Number(tid)})">Quitar</button></li>`; }).join('')}</ul>` : '<p class="sup-ayuda">No hay suplentes cargados.</p>'}
      <div class="sup-form">
        <select id="sup-docente" class="form-control"><option value="">Elegí un instructor/a…</option>${docs.map(d => `<option value="${esc(d.dni)}">${esc(String(d.apellido || '').toUpperCase())}, ${esc(d.nombre || '')}</option>`).join('')}</select>
        <label>Desde <input type="date" id="sup-desde" class="form-control"></label>
        <label>Hasta <input type="date" id="sup-hasta" class="form-control"></label>
        <input id="sup-motivo" class="form-control" maxlength="200" placeholder="Motivo (opcional): licencia, carpeta médica…">
        <button type="button" class="act-btn-sec" onclick="Trayectos.agregarSuplente(${Number(tid)})">➕ Agregar suplente</button>
      </div>
      <p class="sup-ayuda">El suplente tiene que tener cuenta con rol Docente. Mientras dura la suplencia ve el trayecto, carga clases, toma asistencia y corrige, igual que el titular (que no pierde el acceso).</p>`;
  },

  async agregarSuplente(tid) {
    const v = (id) => (document.getElementById(id)?.value || '').trim();
    const dni = v('sup-docente');
    if (!dni) return alert('Elegí el instructor/a suplente.');
    const elTit = document.getElementById('trayecto-docente');
    if (elTit && elTit.value === dni) return alert('Esa persona ya es la instructora titular del trayecto.');
    const desde = v('sup-desde') || null, hasta = v('sup-hasta') || null;
    if (desde && hasta && hasta < desde) return alert('La fecha "hasta" es anterior a "desde".');
    const { error } = await supabase.from('trayecto_docentes').insert([{ trayecto_id: Number(tid), docente_user: dni, desde, hasta, motivo: v('sup-motivo') || null }]);
    if (error) return alert(/duplicate|unique/i.test(error.message || '') ? 'Esa persona ya está cargada como suplente en este trayecto (quitala y volvé a cargarla para cambiar las fechas).' : 'No se pudo agregar: ' + error.message);
    if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Suplente agregado', showConfirmButton: false, timer: 2000 });
    this.cargarSuplentes(tid);
  },

  async quitarSuplente(id, tid) {
    if (!confirm('¿Quitar este suplente? Deja de tener acceso al trayecto (lo que cargó queda guardado).')) return;
    const { error } = await supabase.from('trayecto_docentes').delete().eq('id', Number(id));
    if (error) return alert('No se pudo quitar: ' + error.message);
    this.cargarSuplentes(tid);
  },

  DIAS_PLANILLA: ['L', 'M', 'X', 'J', 'V', 'S'],
  CAMPOS_FICHA: [['trayecto-sede-id', 'sede_id'], ['trayecto-sede', 'sede'], ['trayecto-lugar', 'lugar_dictado'], ['trayecto-localidad', 'localidad'], ['trayecto-horario', 'horario'], ['trayecto-fecha-inicio', 'fecha_inicio'], ['trayecto-fecha-cierre', 'fecha_cierre'], ['trayecto-tipo', 'tipo_certificacion'], ['trayecto-codigo', 'codigo_catalogo'], ['trayecto-acto', 'acto_administrativo']],

  /* ---------- Módulos del formulario ---------- */
  filaModuloHTML(m = {}) {
    const e = v => (window.escHtml ? window.escHtml(v) : String(v ?? ''));
    return `
      <div class="form-grid-2">
        <input type="text" class="mod-nombre form-control" placeholder="Denominación del módulo (tal cual el Catálogo)" value="${e(m.nombre || '')}">
        <input type="text" class="mod-codigo form-control" placeholder="Código (Ej: EE0016.1)" value="${e(m.codigo || '')}">
      </div>
      <div class="form-grid-2" style="margin-top: 0.75rem;">
        <div><label style="font-size: 0.75rem;">Fecha inicio</label><input type="date" class="mod-inicio form-control" value="${e(String(m.fecha_inicio || '').slice(0, 10))}"></div>
        <div><label style="font-size: 0.75rem;">Fecha fin</label><input type="date" class="mod-fin form-control" value="${e(String(m.fecha_fin || '').slice(0, 10))}"></div>
      </div>
      <button type="button" class="mod-quitar" onclick="this.closest('.modulo-item-card').remove(); Trayectos.numerarModulos();">Quitar módulo</button>`;
  },

  agregarFilaModulo(m = {}) {
    const cont = document.getElementById('contenedor-modulos');
    if (!cont) return;
    const div = document.createElement('div');
    div.className = 'modulo-item-card';
    if (m.id) div.dataset.id = m.id;
    div.innerHTML = this.filaModuloHTML(m);
    cont.appendChild(div);
    this.numerarModulos();
  },

  cargarFilasModulos(mods) {
    const cont = document.getElementById('contenedor-modulos');
    if (!cont) return;
    cont.innerHTML = '';
    (mods.length ? mods : [{}]).forEach(m => this.agregarFilaModulo(m));
  },

  numerarModulos() {
    document.querySelectorAll('#contenedor-modulos .modulo-item-card').forEach((c, i) => c.setAttribute('data-numero', `Módulo ${i + 1}`));
  },

  // Guarda los módulos del formulario: actualiza los existentes, agrega los nuevos (en orden)
  // y quita los que se sacaron. Devuelve un texto con avisos para mostrar al usuario.
  async guardarModulos(trayectoId) {
    const tid = Number(trayectoId);
    const filas = [...document.querySelectorAll('#contenedor-modulos .modulo-item-card')].map(c => ({
      id: c.dataset.id ? Number(c.dataset.id) : null,
      nombre: (c.querySelector('.mod-nombre')?.value || '').trim(),
      codigo: (c.querySelector('.mod-codigo')?.value || '').trim(),
      fecha_inicio: c.querySelector('.mod-inicio')?.value || null,
      fecha_fin: c.querySelector('.mod-fin')?.value || null
    })).filter(f => f.nombre);
    const avisos = [];
    if (filas.length > 10) avisos.push(`El trayecto tiene ${filas.length} módulos: el acta y el certificado tienen lugar para 10.`);

    const { data: existentes } = await supabase.from('modulos').select('id, nombre').eq('trayecto_id', tid);
    const idsForm = filas.filter(f => f.id).map(f => f.id);

    const guardar = async (fila) => {
      const datos = { trayecto_id: tid, nombre: fila.nombre, codigo: fila.codigo || null, fecha_inicio: fila.fecha_inicio, fecha_fin: fila.fecha_fin };
      const ejecutar = d => fila.id
        ? supabase.from('modulos').update(d).eq('id', fila.id)
        : supabase.from('modulos').insert([d]);
      let { error } = await ejecutar(datos);
      if (error && /fecha_fin|fecha_inicio/.test(error.message || '')) {
        delete datos.fecha_fin;
        if (/fecha_inicio/.test(error.message || '')) delete datos.fecha_inicio;
        ({ error } = await ejecutar(datos));
      }
      if (error) avisos.push(`No se pudo guardar el módulo "${fila.nombre}": ${error.message}`);
    };
    // De a uno y en orden: así el orden de los módulos queda igual al del formulario
    for (const f of filas) await guardar(f);

    for (const ex of (existentes || []).filter(x => !idsForm.includes(Number(x.id)))) {
      const { error } = await supabase.from('modulos').delete().eq('id', ex.id);
      if (error) avisos.push(`No se quitó el módulo "${ex.nombre}" porque ya tiene clases o notas cargadas.`);
    }
    return avisos.length ? '\n\n' + avisos.join('\n') : (filas.length ? `\n${filas.length} módulo(s) guardado(s).` : '');
  },

  async eliminarTrayecto(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este trayecto? Esta acción borra también sus módulos asociados.')) {
      return;
    }
    try {
      const { error } = await supabase
        .from('trayectos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await this.cargarTrayectos();
    } catch (err) {
      console.error('Error al eliminar trayecto:', err);
      alert('Error al eliminar trayecto.');
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof Trayectos !== 'undefined') {
    Trayectos.poblarDesplegableCiclos();
    await Trayectos.poblarComboDocentes();
    await Trayectos.cargarTrayectos();
  }
});

window.Trayectos = Trayectos;
window.TrayectosAdmin = Trayectos;
