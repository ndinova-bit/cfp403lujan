/* ==========================================================================
   MÓDULO DE TRAYECTOS FORMATIVOS POR CICLO LECTIVO (OFICIAL Y DIRECTO)
   Archivo: js/trayectos.js
   ========================================================================== */

const Trayectos = {
  listaTrayectos: [],

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
        .from('usuarios')
        .select('usuario, nombre, apellido')
        .eq('rol', 'docente');

      if (error) throw error;

      selectDocente.innerHTML = '<option value="">Sin docente asignado</option>';
      (docentes || []).forEach(doc => {
        const idDocente = String(doc.usuario || '').trim();
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

  obtenerPerfilActual() {
    if (typeof Auth !== 'undefined' && Auth.usuarioActual) {
      return Auth.usuarioActual;
    }
    const perfilRaw = localStorage.getItem('usuario_actual') || 
                      localStorage.getItem('usuario_logueado') || 
                      sessionStorage.getItem('usuario_logueado');
    return perfilRaw ? JSON.parse(perfilRaw) : {};
  },

  async cargarTrayectos() {
    try {
      const perfil = this.obtenerPerfilActual();
      const rolNorm = String(perfil?.rol || '').toLowerCase().trim();
      const isAdmin = rolNorm === 'admin' || rolNorm === 'administrador';
      const esDocente = rolNorm === 'docente';

      const anioVigente = new Date().getFullYear();
      let trayectosData = [];

      // 1. Administrador: ve todos los trayectos
      if (isAdmin) {
        const { data, error } = await supabase.from('trayectos').select('*');
        if (error) throw error;
        trayectosData = data || [];
      } 
      // 2. Vista pública inicial / Docente: muestra los cursos del ciclo lectivo vigente
      else if (!perfil || !perfil.rol || esDocente) {
        const { data, error } = await supabase
          .from('trayectos')
          .select('*')
          .eq('ciclo_lectivo', anioVigente);
        if (error) throw error;
        trayectosData = data || [];
      } 
      // 3. Estudiante: consulta sus inscripciones por DNI, usuario o email
      else {
        const dniRaw = String(perfil.dni || perfil.usuario || '').trim();
        const emailRaw = String(perfil.email || '').trim().toLowerCase();

        let queryOr = [];
        if (dniRaw) queryOr.push(`estudiante_user.eq.${dniRaw}`);
        if (emailRaw) queryOr.push(`estudiante_user.eq.${emailRaw}`);

        let inscripciones = [];
        if (queryOr.length > 0) {
          const { data: resInsc } = await supabase
            .from('inscripciones')
            .select('trayecto_id')
            .or(queryOr.join(','));
          inscripciones = resInsc || [];
        }

        if (inscripciones.length > 0) {
          const idsTrayectos = inscripciones.map(i => i.trayecto_id);

          const { data: trayectos, error: errTray } = await supabase
            .from('trayectos')
            .select('*')
            .in('id', idsTrayectos);

          if (errTray) throw errTray;
          trayectosData = trayectos || [];
        }
      }

      this.listaTrayectos = trayectosData;
      this.renderizarTrayectos();

    } catch (err) {
      console.error('Error al cargar trayectos:', err);
    }
  },

  renderizarTrayectos() {
    const contenedores = [
      document.getElementById('lista-trayectos-cards'),
      document.getElementById('lista-trayectos-admin'),
      document.getElementById('contenedor-trayectos-estudiante'),
      document.getElementById('contenedor-trayectos')
    ].filter(el => el !== null);

    if (contenedores.length === 0) return;

    const perfil = this.obtenerPerfilActual();
    const rolNorm = String(perfil.rol || '').toLowerCase().trim();
    const isAdmin = rolNorm === 'admin' || rolNorm === 'administrador';
    const esDocente = rolNorm === 'docente';
    const esEstudiante = rolNorm === 'estudiante';

    contenedores.forEach(contenedor => {
      contenedor.innerHTML = '';

      const esVistaPublica = contenedor.id === 'lista-trayectos-cards' || contenedor.id === 'contenedor-trayectos';

      if (this.listaTrayectos.length === 0) {
        contenedor.innerHTML = `
          <div class="empty-state-card fade-in" style="text-align: center; padding: 3rem; background: rgba(30,41,59,0.5); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); grid-column: 1 / -1;">
            <div class="empty-state-icon" style="font-size: 2rem; margin-bottom: 0.5rem;">📚</div>
            <h3 class="empty-state-title" style="color: #f8fafc; margin-bottom: 0.5rem;">No hay trayectos disponibles para este ciclo lectivo</h3>
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

        if (!esVistaPublica && (esDocente || esEstudiante || isAdmin)) {
          card.style.cursor = 'pointer';
          card.onclick = () => {
            if (window.ClasesModulo && typeof ClasesModulo.abrirGestor === 'function') {
              ClasesModulo.abrirGestor(trayecto.id, trayecto.nombre.replace(/'/g, "\\'"));
            }
          };
        }

        const cicloBadge = `
          <span style="font-size: 0.75rem; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 600;">
            Ciclo Lectivo ${trayecto.ciclo_lectivo || new Date().getFullYear()}
          </span>
        `;

        let accionGestionHTML = '';
        if (!esVistaPublica && (isAdmin || esDocente)) {
          accionGestionHTML = `
            <button class="btn btn-gold" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; background: #0284c7; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;" onclick="event.stopPropagation(); ClasesModulo.abrirGestor(${trayecto.id}, '${trayecto.nombre.replace(/'/g, "\\'")}')">
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
            <button class="btn btn-gold" style="width: 100%; padding: 0.5rem; font-size: 0.85rem; background: #0284c7; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;" onclick="event.stopPropagation(); ClasesModulo.abrirGestor(${trayecto.id}, '${trayecto.nombre.replace(/'/g, "\\'")}')">
              📖 Ver Clases y Actividades
            </button>
          </div>
        ` : '';

        if (esVistaPublica) {
          card.innerHTML = `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <h3 style="color: #f8fafc; margin: 0; font-size: 1.2rem; font-weight: 600;">${trayecto.nombre}</h3>
                ${cicloBadge}
              </div>
              <p style="color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.75rem; line-height: 1.4;">
                ${trayecto.descripcion || 'Sin descripción disponible.'}
              </p>
            </div>
            ${accionesAdmin}
          `;
        } else {
          let modulosHTML = '';
          if (trayecto.modulos && trayecto.modulos.length > 0) {
            modulosHTML = trayecto.modulos.map(m => `
              <div class="modulo-card" style="margin-top: 0.5rem; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.6rem 0.8rem;">
                <strong style="color: #f8fafc; font-size: 0.85rem;">${m.nombre}</strong> 
                <span style="color: #fbbf24; font-size: 0.75rem;">(${m.codigo || 'S/C'})</span>
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
                  <h3 style="color: #f8fafc; margin: 0; font-size: 1.2rem; font-weight: 600;">${trayecto.nombre}</h3>
                </div>
                ${cicloBadge}
              </div>

              <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.75rem; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 6px;">
                📜 <strong>N° de Curso:</strong> ${numCursoMostrado}<br>
                📑 <strong>Resolución:</strong> ${trayecto.resolucion || 'S/D'}
              </div>

              <p style="color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.75rem; line-height: 1.4;">
                ${trayecto.descripcion || 'Sin descripción disponible.'}
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
    });
  },

  async editarTrayecto(id) {
    const trayecto = this.listaTrayectos.find(t => String(t.id) === String(id));
    if (!trayecto) return;

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
        certificacion_oficial: certificacionVal || null,
        certificacion: certificacionVal || null,
        resolucion: resolucion || null,
        descripcion: descripcion || null,
        requisitos: requisitos || null,
        docente_user: docenteUser || null
      };

      if (idRaw && idRaw !== '') {
        const idQuery = !isNaN(idRaw) ? parseInt(idRaw, 10) : idRaw;

        const { error } = await supabase
          .from('trayectos')
          .update(datosTrayecto)
          .eq('id', idQuery);

        if (error) throw error;
        alert('Trayecto actualizado con éxito.');
      } else {
        const { error } = await supabase
          .from('trayectos')
          .insert([datosTrayecto]);

        if (error) throw error;
        alert('Trayecto guardado con éxito.');
      }

      const form = document.getElementById('form-trayecto');
      if (form) form.reset();
      if (elId) elId.value = '';

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
