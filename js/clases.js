const ClasesModulo = {
  trayectoActualId: null,
  claseEditandoId: null,

  convertirLinks(texto) {
    if (!texto) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return texto.replace(urlRegex, (url) => {
      const urlEscapada = url.replace(/'/g, "\\'");
      return `
        <div style="margin-top:0.4rem; display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
          <a href="${url}" target="_blank" rel="noopener" style="display:inline-block; padding:0.35rem 0.75rem; background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.3); color:#facc15; border-radius:6px; font-size:0.82rem; text-decoration:none; font-weight:600;">📝 Abrir Enlace de Actividad / TP</a>
          <button type="button" onclick="ClasesModulo.verEnPantalla('${urlEscapada}', 'Actividad / TP')" style="padding:0.35rem 0.75rem; background:rgba(234,179,8,0.25); border:1px solid rgba(234,179,8,0.5); color:#fef08a; border-radius:6px; font-size:0.82rem; cursor:pointer; font-weight:600;">👁️ Visualizar en Pantalla</button>
        </div>
      `;
    });
  },

  verEnPantalla(url, titulo) {
    if (url.includes('drive.google.com/drive/folders') || url.includes('drive.google.com/folderview')) {
      alert('📁 Las carpetas de Google Drive no se pueden previsualizar en pantalla por restricciones de seguridad. Se abrirá en una pestaña nueva.');
      window.open(url, '_blank');
      return;
    }

    let visor = document.getElementById('modal-visor-recurso');
    if (!visor) {
      visor = document.createElement('div');
      visor.id = 'modal-visor-recurso';
      visor.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; justify-content:center; align-items:center; padding:1rem;';
      document.body.appendChild(visor);
    }

    let embedUrl = url;

    if (url.includes('docs.google.com/spreadsheets')) {
      embedUrl = url.replace(/\/edit.*$/, '/htmlview').replace(/\/view.*$/, '/htmlview');
    } else if (url.includes('docs.google.com/document') || url.includes('docs.google.com/presentation')) {
      embedUrl = url.replace(/\/edit.*$/, '/preview').replace(/\/view.*$/, '/preview');
    } else if (url.includes('drive.google.com')) {
      embedUrl = url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
    } else if (url.includes('youtube.com/watch?v=')) {
      embedUrl = url.replace('watch?v=', 'embed/');
    }

    visor.innerHTML = `
      <div style="background:#0f172a; border:1px solid rgba(255,255,255,0.15); border-radius:12px; width:100%; max-width:950px; height:85vh; display:flex; flex-direction:column; overflow:hidden; color:#f8fafc; box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
        <div style="padding:0.8rem 1.2rem; background:#1e293b; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#38bdf8; font-size:0.95rem;">📄 Vista Previa: ${titulo}</strong>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <a href="${url}" target="_blank" rel="noopener" style="padding:0.25rem 0.6rem; background:#0284c7; color:#fff; border-radius:4px; font-size:0.8rem; text-decoration:none; font-weight:600;">🔗 Abrir pestaña aparte</a>
            <button type="button" onclick="document.getElementById('modal-visor-recurso').style.display='none'" style="background:none; border:none; color:#f87171; font-size:1.4rem; cursor:pointer; font-weight:bold; margin-left:0.5rem;">✕</button>
          </div>
        </div>
        <div style="flex:1; background:#000; position:relative;">
          <iframe src="${embedUrl}" style="width:100%; height:100%; border:none;" allow="autoplay"></iframe>
        </div>
      </div>
    `;

    visor.style.display = 'flex';
  },

  async abrirGestor(trayectoId, nombreTrayecto) {
    this.trayectoActualId = trayectoId;
    this.claseEditandoId = null;

    // Detección precisa de perfil utilizando el helper unificado de Trayectos
    const perfil = (typeof Trayectos !== 'undefined' && Trayectos.obtenerPerfilActual)
      ? Trayectos.obtenerPerfilActual()
      : (() => {
          const sesionRaw = localStorage.getItem('usuario_actual') || localStorage.getItem('usuario_logueado') || sessionStorage.getItem('usuario_logueado');
          return sesionRaw ? JSON.parse(sesionRaw) : {};
        })();

    const rolNorm = String(perfil.rol || '').toLowerCase().trim();
    const esEstudiante = rolNorm === 'estudiante';

    let modal = document.getElementById('modal-gestor-clases');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-gestor-clases';
      modal.className = 'modal';
      modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center; padding:1rem;';
      document.body.appendChild(modal);
    }

    let htmlModal = `
      <div style="background:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:12px; width:100%; max-width:980px; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; color:#f8fafc;">
        <div style="padding:1.2rem 1.5rem; background:#0f172a; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:1.15rem;">📚 Trayecto: <span style="color:#38bdf8;">${nombreTrayecto}</span></h3>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            ${!esEstudiante ? `
              <button type="button" onclick="ReportesModulo.descargarBackupCompletoJSON()" style="padding:0.35rem 0.7rem; background:rgba(34,197,94,0.2); border:1px solid rgba(34,197,94,0.4); color:#4ade80; border-radius:6px; font-size:0.78rem; font-weight:600; cursor:pointer;">
                💾 Backup DB
              </button>
            ` : ''}
            <button type="button" onclick="ClasesModulo.cerrarGestor()" style="background:none; border:none; color:#94a3b8; font-size:1.5rem; cursor:pointer;">&times;</button>
          </div>
        </div>
    `;

    if (!esEstudiante) {
      htmlModal += `
        <div style="display:flex; gap:0.5rem; padding:0.6rem 1.5rem; background:#1e293b; border-bottom:1px solid rgba(255,255,255,0.08); flex-wrap:wrap;">
          <button type="button" id="btn-tab-clases" onclick="ClasesModulo.cambiarVistaPestana('clases')" style="padding:0.4rem 1rem; border:none; border-radius:6px; background:#0284c7; color:#fff; font-weight:600; cursor:pointer;">
            📚 Clases y Actividades
          </button>
          <button type="button" id="btn-tab-alumnos" onclick="ClasesModulo.cambiarVistaPestana('alumnos')" style="padding:0.4rem 1rem; border:none; border-radius:6px; background:rgba(255,255,255,0.05); color:#94a3b8; font-weight:600; cursor:pointer;">
            👥 Estudiantes y Sábana de Notas
          </button>
          <button type="button" id="btn-tab-asistencias" onclick="ClasesModulo.cambiarVistaPestana('asistencias')" style="padding:0.4rem 1rem; border:none; border-radius:6px; background:rgba(255,255,255,0.05); color:#94a3b8; font-weight:600; cursor:pointer;">
            📅 Tomar Asistencia
          </button>
          <button type="button" id="btn-tab-entregas" onclick="ClasesModulo.cambiarVistaPestana('entregas')" style="padding:0.4rem 1rem; border:none; border-radius:6px; background:rgba(255,255,255,0.05); color:#94a3b8; font-weight:600; cursor:pointer;">
            📝 Entregas y Calificaciones
          </button>
        </div>
      `;
    }

    htmlModal += `
      <div style="padding:1.5rem; overflow-y:auto; flex:1;">
        <div id="vista-tab-clases">
    `;

    if (!esEstudiante) {
      htmlModal += `
        <details id="details-form-clase" open style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:1rem; margin-bottom:1.5rem;">
          <summary id="summary-clase-titulo" style="cursor:pointer; font-weight:600; color:#38bdf8;">➕ Cargar Nueva Clase, Actividad o Recuperatorio</summary>
          
          <form onsubmit="ClasesModulo.guardarClase(event)" style="margin-top:1rem; display:flex; flex-direction:column; gap:0.8rem;">
            <div>
              <label style="display:block; font-size:0.82rem; color:#cbd5e1; margin-bottom:0.3rem;">Título de la Clase / Actividad / Recuperatorio *</label>
              <input type="text" id="clase-titulo" placeholder="Ej: TP Recuperatorio Módulo 1 - Exclusivo" required class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;">
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.8rem;">
              <div>
                <label style="display:block; font-size:0.82rem; color:#fbbf24; font-weight:600; margin-bottom:0.3rem;">📌 Módulo Asociado (Opcional)</label>
                <select id="clase-modulo-id" class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;">
                  <option value="">Cargando módulos...</option>
                </select>
              </div>

              <div>
                <label style="display:block; font-size:0.82rem; color:#eab308; font-weight:600; margin-bottom:0.3rem;">👤 Destinatario Específico (Opcional / Recuperatorio)</label>
                <select id="clase-estudiante-user" class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #eab308; color:#fff; border-radius:6px;">
                  <option value="">🌐 Todos los Estudiantes (Público general)</option>
                </select>
              </div>
            </div>

            <div>
              <label style="display:block; font-size:0.82rem; color:#cbd5e1; margin-bottom:0.3rem;">Descripción / Consigna general</label>
              <textarea id="clase-descripcion" placeholder="Resumen de la clase o pautas del trabajo..." rows="2" class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;"></textarea>
            </div>

            <div>
              <label style="display:block; font-size:0.82rem; color:#38bdf8; font-weight:600; margin-bottom:0.3rem;">📚 Enlace a Material / Teórico (Google Drive, YouTube, PDF)</label>
              <input type="url" id="clase-url-teoria" placeholder="https://drive.google.com/..." class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;">
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.8rem;">
              <div>
                <label style="display:block; font-size:0.82rem; color:#facc15; font-weight:600; margin-bottom:0.3rem;">📝 Enlace a la Actividad / TP / Recuperatorio</label>
                <input type="url" id="clase-url-actividad" placeholder="https://drive.google.com/..." class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;">
              </div>

              <div>
                <label style="display:block; font-size:0.82rem; color:#facc15; font-weight:600; margin-bottom:0.3rem;">📅 Fecha de Publicación (Programar)</label>
                <input type="date" id="clase-fecha" class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;">
              </div>
            </div>

            <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.4rem;">
              <button type="button" id="btn-cancelar-edicion" style="display:none; padding:0.6rem 1rem; background:rgba(255,255,255,0.1); color:#cbd5e1; border:none; border-radius:6px; cursor:pointer;" onclick="ClasesModulo.limpiarFormulario()">
                Cancelar Edición
              </button>
              <button type="submit" id="btn-guardar-clase" class="btn btn-gold" style="padding:0.6rem 1.4rem; background:#0284c7; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;">
                💾 Publicar Contenido
              </button>
            </div>
          </form>
        </details>
      `;
    }

    htmlModal += `
          <div id="lista-clases-cargadas">
            <p style="color:#94a3b8; text-align:center;">Cargando contenidos...</p>
          </div>
        </div>

      <div id="vista-tab-alumnos" style="display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <label for="input-importar-csv" style="padding:0.4rem 0.8rem; background:#0284c7; color:#fff; border-radius:6px; font-weight:600; font-size:0.8rem; cursor:pointer; display:inline-block;">
                📥 Importar Nómina de Alumnos (CSV)
              </label>
              <input type="file" id="input-importar-csv" accept=".csv" style="display:none;" onchange="ClasesModulo.importarEstudiantesCSV(this.files[0])">
            </div>
            <button type="button" onclick="ReportesModulo.exportarExcelTabla('tabla-sabana-notas', 'Sabana_Notas.csv')" style="padding:0.4rem 0.8rem; background:#10b981; color:#fff; border:none; border-radius:6px; font-weight:600; font-size:0.8rem; cursor:pointer;">
              📊 Exportar Sábana a Excel
            </button>
          </div>
          <div id="contenedor-lista-alumnos">
            <p style="color:#94a3b8; text-align:center;">Cargando sábana de estudiantes...</p>
          </div>
        </div>

        <div id="vista-tab-asistencias" style="display:none;">
          <div id="contenedor-vista-asistencias">
            <p style="color:#94a3b8; text-align:center;">Cargando panel de asistencia...</p>
          </div>
        </div>

        <div id="vista-tab-entregas" style="display:none;">
          <div id="contenedor-todas-entregas">
            <p style="color:#94a3b8; text-align:center;">Cargando trabajos entregados...</p>
          </div>
        </div>
      </div>
    </div>
    `;

    modal.innerHTML = htmlModal;
    modal.style.display = 'flex';

    if (!esEstudiante) {
      await this.poblarComboModulos();
      await this.poblarComboEstudiantes();
    }
    await this.cargarListaClases(esEstudiante);
  },

  async poblarComboModulos() {
    const select = document.getElementById('clase-modulo-id');
    if (!select) return;

    try {
      const { data: modulos, error } = await supabase
        .from('modulos')
        .select('id, nombre, codigo')
        .eq('trayecto_id', Number(this.trayectoActualId));

      if (error) throw error;

      if (!modulos || modulos.length === 0) {
        select.innerHTML = '<option value="">Sin módulos asignados (General)</option>';
        return;
      }

      select.innerHTML = '<option value="">-- Seleccionar Módulo (Opcional) --</option>' + 
        modulos.map(m => `<option value="${m.id}">${m.nombre} (${m.codigo || 'S/C'})</option>`).join('');

    } catch (err) {
      console.error('Error al poblar combo de módulos:', err);
      select.innerHTML = '<option value="">General (Sin módulo específico)</option>';
    }
  },

  async poblarComboEstudiantes() {
    const select = document.getElementById('clase-estudiante-user');
    if (!select) return;

    try {
      const { data: inscripciones } = await supabase
        .from('inscripciones')
        .select('estudiante_user')
        .eq('trayecto_id', Number(this.trayectoActualId));

      if (!inscripciones || inscripciones.length === 0) return;

      const listaUsers = inscripciones.map(i => i.estudiante_user);
      const { data: alumnos } = await supabase
        .from('usuarios')
        .select('*')
        .in('usuario', listaUsers);

      select.innerHTML = '<option value="">🌐 Todos los Estudiantes (Público general)</option>' +
        (alumnos || []).map(u => {
          const userKey = String(u.usuario || u.dni || u.id);
          const nombreCompleto = `${u.apellido || ''} ${u.nombre || ''}`.trim() || userKey;
          return `<option value="${userKey}">👤 ${nombreCompleto} (DNI: ${userKey})</option>`;
        }).join('');

    } catch (err) {
      console.error('Error al poblar combo estudiantes:', err);
    }
  },

  cambiarVistaPestana(pestana) {
    const vClases = document.getElementById('vista-tab-clases');
    const vAlumnos = document.getElementById('vista-tab-alumnos');
    const vAsistencias = document.getElementById('vista-tab-asistencias');
    const vEntregas = document.getElementById('vista-tab-entregas');

    const bClases = document.getElementById('btn-tab-clases');
    const bAlumnos = document.getElementById('btn-tab-alumnos');
    const bAsistencias = document.getElementById('btn-tab-asistencias');
    const bEntregas = document.getElementById('btn-tab-entregas');

    [bClases, bAlumnos, bAsistencias, bEntregas].forEach(b => {
      if (b) { b.style.background = 'rgba(255,255,255,0.05)'; b.style.color = '#94a3b8'; }
    });
    [vClases, vAlumnos, vAsistencias, vEntregas].forEach(v => {
      if (v) v.style.display = 'none';
    });

    if (pestana === 'alumnos') {
      if (vAlumnos) vAlumnos.style.display = 'block';
      if (bAlumnos) { bAlumnos.style.background = '#0284c7'; bAlumnos.style.color = '#fff'; }
      this.cargarSabanaEstudiantes();
    } else if (pestana === 'asistencias') {
      if (vAsistencias) vAsistencias.style.display = 'block';
      if (bAsistencias) { bAsistencias.style.background = '#0284c7'; bAsistencias.style.color = '#fff'; }
      if (window.AsistenciasModulo) {
        AsistenciasModulo.renderizarVista(this.trayectoActualId, 'contenedor-vista-asistencias');
      }
    } else if (pestana === 'entregas') {
      if (vEntregas) vEntregas.style.display = 'block';
      if (bEntregas) { bEntregas.style.background = '#0284c7'; bEntregas.style.color = '#fff'; }
      this.cargarPanelGeneralEntregas();
    } else {
      if (vClases) vClases.style.display = 'block';
      if (bClases) { bClases.style.background = '#0284c7'; bClases.style.color = '#fff'; }
    }
  },

  async cargarListaClases(esEstudiante = false) {
    const contenedor = document.getElementById('lista-clases-cargadas');
    if (!contenedor) return;

    try {
      const perfil = (typeof Trayectos !== 'undefined' && Trayectos.obtenerPerfilActual)
        ? Trayectos.obtenerPerfilActual()
        : (() => {
            const sesionRaw = localStorage.getItem('usuario_actual') || localStorage.getItem('usuario_logueado') || sessionStorage.getItem('usuario_logueado');
            return sesionRaw ? JSON.parse(sesionRaw) : {};
          })();

      const userEstudiante = String(perfil.usuario || perfil.dni || perfil.id);

      const { data: clases, error } = await supabase
        .from('clases')
        .select('*')
        .eq('trayecto_id', Number(this.trayectoActualId))
        .order('id', { ascending: false });

      if (error) throw error;

      if (!clases || clases.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:1rem;">Aún no se han publicado contenidos para este trayecto.</p>';
        return;
      }

      window.clasesGuardadasCache = clases;

      const { data: modulos } = await supabase
        .from('modulos')
        .select('*')
        .eq('trayecto_id', Number(this.trayectoActualId))
        .order('id', { ascending: true });

      const idsClases = clases.map(c => c.id);
      let entregasGlobales = [];
      if (idsClases.length > 0) {
        const { data: ent } = await supabase
          .from('entregas_actividades')
          .select('*')
          .in('clase_id', idsClases);
        entregasGlobales = ent || [];
      }

      let tieneExcepcion = false;
      if (esEstudiante && userEstudiante) {
        const { data: exc } = await supabase
          .from('excepciones_estudiantes')
          .select('*')
          .eq('trayecto_id', Number(this.trayectoActualId))
          .eq('estudiante_user', userEstudiante)
          .eq('habilitado', true);
        tieneExcepcion = exc && exc.length > 0;
      }

      const hoy = new Date();
      hoy.setHours(0,0,0,0);

      const publicacionesMostrar = clases.filter(c => {
        if (esEstudiante && c.estudiante_user && String(c.estudiante_user) !== userEstudiante) {
          return false;
        }

        if (!esEstudiante) return true;

        const matchFecha = (c.descripcion || '').match(/📅 Fecha de Publicación: (\d{2}\/\d{2}\/\d{4})/);
        if (matchFecha) {
          const partes = matchFecha[1].split('/');
          const fechaPub = new Date(partes[2], partes[1] - 1, partes[0]);
          if (fechaPub > hoy) return false;
        }
        return true;
      });

      if (publicacionesMostrar.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:1rem;">No hay contenidos disponibles para visualizar.</p>';
        return;
      }

      contenedor.innerHTML = publicacionesMostrar.map((c) => {
        const descHTML = this.convertirLinks(c.descripcion || 'Sin descripción');
        const urlTeoriaEscapada = (c.url_recurso || '').replace(/'/g, "\\'");
        const tieneActividad = (c.descripcion || '').includes('📝 Enlace a Actividad / TP:');

        let badgeExclusivo = '';
        if (c.estudiante_user) {
          badgeExclusivo = `<span style="font-size:0.75rem; background:rgba(234,179,8,0.2); color:#facc15; border:1px solid rgba(234,179,8,0.4); padding:0.15rem 0.5rem; border-radius:4px; margin-left:0.4rem; font-weight:600;">🎯 Tarea Exclusiva Personalizada</span>`;
        }

        let bloqueEntregaEstudiante = '';
        if (esEstudiante && tieneActividad) {
          let estaBloqueado = false;
          if (!tieneExcepcion && c.modulo_id && modulos && modulos.length > 1) {
            const idxModActual = modulos.findIndex(m => Number(m.id) === Number(c.modulo_id));
            if (idxModActual > 0) {
              const modAnterior = modulos[idxModActual - 1];
              const clasesModAnt = clases.filter(cl => Number(cl.modulo_id) === Number(modAnterior.id)).map(cl => cl.id);
              const entregasAnt = entregasGlobales.filter(e => clasesModAnt.includes(Number(e.clase_id)) && String(e.estudiante_user) === userEstudiante);

              let suma = 0, cant = 0;
              entregasAnt.forEach(e => {
                const val = parseFloat(e.nota);
                if (!isNaN(val)) { suma += val; cant++; }
              });

              const promAnt = cant > 0 ? (suma / cant) : 0;
              if (promAnt < 70) {
                estaBloqueado = true;
              }
            }
          }

          const miEntrega = entregasGlobales.find(e => Number(e.clase_id) === Number(c.id) && String(e.estudiante_user) === userEstudiante);
          
          let estadoEntregaHTML = '';
          let bloqueadoPorNota = false;

          if (miEntrega) {
            const numNota = parseFloat(miEntrega.nota);
            const tieneNota = miEntrega.nota !== null && miEntrega.nota !== undefined && miEntrega.nota !== '';

            if (tieneNota) {
              bloqueadoPorNota = true;
              
              if (!isNaN(numNota) && numNota >= 70) {
                const claveVisto = `confetti_visto_${c.id}_${userEstudiante}`;
                if (window.confetti && !sessionStorage.getItem(claveVisto)) {
                  sessionStorage.setItem(claveVisto, 'true');
                  setTimeout(() => {
                    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                  }, 300);
                }

                let medalla = '🥇';
                let tituloMedalla = '¡Desempeño Sobresaliente!';
                let colorGlow = '#facc15';

                if (numNota < 80) {
                  medalla = '🥉';
                  tituloMedalla = '¡Objetivo Logrado!';
                  colorGlow = '#cd7f32';
                } else if (numNota < 90) {
                  medalla = '🥈';
                  tituloMedalla = '¡Gran Trabajo!';
                  colorGlow = '#c0c0c0';
                }

                estadoEntregaHTML = `
                  <div style="font-size:0.85rem; color:#4ade80; margin-bottom:0.4rem; background:linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.05) 100%); padding:0.8rem 1rem; border-radius:8px; border:1px solid rgba(34,197,94,0.4); box-shadow:0 4px 12px rgba(34,197,94,0.1); position:relative; overflow:hidden;">
                    <div style="display:flex; align-items:center; gap:0.8rem; margin-bottom:0.4rem;">
                      <span style="font-size:2rem; filter:drop-shadow(0 0 8px ${colorGlow}); flex-shrink:0;">${medalla}</span>
                      <div>
                        <strong style="color:#f8fafc; font-size:0.95rem; display:block;">${tituloMedalla}</strong>
                        <span style="color:#4ade80; font-weight:700; font-size:1rem;">Calificación: ${numNota}% — ✅ MÓDULO ACREDITADO</span>
                      </div>
                    </div>
                    <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:0.4rem; margin-top:0.4rem;">
                      <a href="${miEntrega.url_entrega}" target="_blank" style="color:#38bdf8; text-decoration:underline; font-weight:600;">🔗 Ver Trabajo Enviado</a>
                      ${miEntrega.comentario_docente ? `<br><span style="color:#cbd5e1; display:inline-block; margin-top:0.3rem;">💬 <strong>Devolución Docente:</strong> <em>"${miEntrega.comentario_docente}"</em></span>` : ''}
                    </div>
                  </div>
                `;
              } else {
                estadoEntregaHTML = `
                  <div style="font-size:0.82rem; color:#f87171; margin-bottom:0.4rem; background:rgba(239,68,68,0.15); padding:0.6rem; border-radius:6px; border:1px solid rgba(239,68,68,0.4);">
                    ⚠️ <strong>Calificación:</strong> ${miEntrega.nota}% — <strong style="color:#f87171;">MÓDULO NO ACREDITADO (&lt;70%)</strong>
                    <br><em>Esta entrega ha sido evaluada y cerrada. Si el docente asigna un trabajo recuperatorio, te aparecerá como una tarea nueva.</em>
                    <br><a href="${miEntrega.url_entrega}" target="_blank" style="color:#38bdf8; text-decoration:underline; display:inline-block; margin-top:0.2rem;">Ver Entrega Evaluada</a>
                    ${miEntrega.comentario_docente ? `<br>💬 <strong>Devolución Docente:</strong> ${miEntrega.comentario_docente}` : ''}
                  </div>
                `;
              }
            } else {
              estadoEntregaHTML = `
                <div style="font-size:0.82rem; color:#facc15; margin-bottom:0.4rem; background:rgba(250,204,21,0.1); padding:0.5rem; border-radius:6px; border:1px solid rgba(250,204,21,0.3);">
                  ⏳ <strong>Trabajo Enviado:</strong> Pendiente de corrección por el docente. <em>(Podés corregir o reemplazar tu enlace antes de que sea calificado).</em>
                  <br><a href="${miEntrega.url_entrega}" target="_blank" style="color:#38bdf8; text-decoration:underline; display:inline-block; margin-top:0.2rem;">Ver Archivo Enviado</a>
                </div>
              `;
            }
          }

          if (estaBloqueado) {
            bloqueEntregaEstudiante = `
              <div style="margin-top:0.8rem; padding:0.8rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:6px; color:#f87171; font-size:0.82rem;">
                🔒 <strong>Módulo Bloqueado:</strong> Requiere acreditar el módulo anterior con una nota mayor o igual a 70 o contar con habilitación excepcional del docente.
              </div>
            `;
          } else {
            bloqueEntregaEstudiante = `
              <div style="margin-top:0.8rem; padding:0.8rem; background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:6px;">
                <strong style="display:block; font-size:0.82rem; color:#facc15; margin-bottom:0.4rem;">📤 Estado de Entrega:</strong>
                ${estadoEntregaHTML}
                ${!bloqueadoPorNota ? `
                  <div style="display:flex; gap:0.5rem; margin-top:0.3rem;">
                    <input type="url" id="input-entrega-${c.id}" placeholder="Pegá el link a tu trabajo (Google Drive, PDF)" value="${miEntrega ? miEntrega.url_entrega : ''}" style="flex:1; padding:0.4rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px; font-size:0.82rem;">
                    <button type="button" onclick="ClasesModulo.enviarEntregaEstudiante(${c.id})" style="padding:0.4rem 0.8rem; background:#0284c7; color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.8rem;">
                      ${miEntrega ? 'Actualizar Enlace' : 'Enviar Entrega'}
                    </button>
                  </div>
                ` : `
                  <div style="margin-top:0.3rem; font-size:0.75rem; color:#94a3b8; font-style:italic;">
                    🔒 Formulario cerrado por evaluación docente completada.
                  </div>
                `}
              </div>
            `;
          }
        }

        return `
          <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:1rem; margin-bottom:0.8rem; display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="flex:1; padding-right:1rem;">
              <h4 style="margin:0 0 0.4rem 0; color:#f8fafc; font-size:0.95rem;">📌 ${c.titulo} ${badgeExclusivo}</h4>
              
              ${c.url_recurso ? `
                <div style="margin-bottom:0.5rem; display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
                  <a href="${c.url_recurso}" target="_blank" rel="noopener" style="display:inline-block; padding:0.35rem 0.75rem; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; border-radius:6px; font-size:0.82rem; text-decoration:none; font-weight:600;">📚 Abrir Material Teórico de Clase</a>
                  <button type="button" onclick="ClasesModulo.verEnPantalla('${urlTeoriaEscapada}', '${c.titulo.replace(/'/g, "\\'")}')" style="padding:0.35rem 0.75rem; background:rgba(56,189,248,0.25); border:1px solid rgba(56,189,248,0.5); color:#7dd3fc; border-radius:6px; font-size:0.82rem; cursor:pointer; font-weight:600;">👁️ Visualizar en Pantalla</button>
                </div>
              ` : ''}

              <div style="margin:0; color:#cbd5e1; font-size:0.85rem; white-space:pre-line;">${descHTML}</div>

              ${bloqueEntregaEstudiante}
            </div>

            ${!esEstudiante ? `
              <div style="display:flex; gap:0.4rem;">
                <button type="button" onclick="ClasesModulo.editarClase(${c.id})" title="Editar" style="background:rgba(56,189,248,0.2); border:1px solid rgba(56,189,248,0.4); color:#38bdf8; border-radius:6px; padding:0.3rem 0.6rem; cursor:pointer; font-size:0.8rem;">✏️</button>
                <button type="button" onclick="ClasesModulo.eliminarClase(${c.id})" title="Eliminar" style="background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#f87171; border-radius:6px; padding:0.3rem 0.6rem; cursor:pointer; font-size:0.8rem;">🗑️</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Error al cargar clases:', err);
      contenedor.innerHTML = '<p style="color:#f87171; text-align:center;">Error al cargar las clases.</p>';
    }
  },

  async enviarEntregaEstudiante(claseId) {
    const inputUrl = document.getElementById(`input-entrega-${claseId}`);
    const url = inputUrl ? inputUrl.value.trim() : '';

    if (!url) {
      alert('Por favor pegá el enlace a tu trabajo práctico resuelto.');
      return;
    }

    const perfil = (typeof Trayectos !== 'undefined' && Trayectos.obtenerPerfilActual)
      ? Trayectos.obtenerPerfilActual()
      : (() => {
          const sesionRaw = localStorage.getItem('usuario_actual') || localStorage.getItem('usuario_logueado') || sessionStorage.getItem('usuario_logueado');
          return sesionRaw ? JSON.parse(sesionRaw) : {};
        })();

    const idEstudiante = perfil.usuario || perfil.dni || perfil.id;

    if (!idEstudiante) {
      alert('Error: no se pudo verificar el usuario estudiante.');
      return;
    }

    try {
      const { data: existe } = await supabase
        .from('entregas_actividades')
        .select('id, nota')
        .eq('clase_id', claseId)
        .eq('estudiante_user', String(idEstudiante))
        .single();

      if (existe) {
        if (existe.nota !== null && existe.nota !== undefined && existe.nota !== '') {
          alert('🔒 Esta entrega ya ha sido calificada por el docente y no puede modificarse.');
          return;
        }

        const { error } = await supabase
          .from('entregas_actividades')
          .update({ url_entrega: url, created_at: new Date() })
          .eq('id', existe.id);
        if (error) throw error;
        alert('✅ Enlace actualizado correctamente.');
      } else {
        const { error } = await supabase
          .from('entregas_actividades')
          .insert([{
            clase_id: claseId,
            estudiante_user: String(idEstudiante),
            url_entrega: url
          }]);
        if (error) throw error;
        alert('✅ Trabajo Práctico entregado con éxito.');
      }

      await this.cargarListaClases(true);

    } catch (err) {
      console.error('Error al enviar entrega:', err);
      alert('Error al registrar la entrega: ' + err.message);
    }
  },

  editarClase(idClase) {
    const clase = (window.clasesGuardadasCache || []).find(c => c.id === idClase);
    if (!clase) return;

    this.claseEditandoId = idClase;

    document.getElementById('clase-titulo').value = clase.titulo || '';
    document.getElementById('clase-url-teoria').value = clase.url_recurso || '';
    if (document.getElementById('clase-modulo-id')) {
      document.getElementById('clase-modulo-id').value = clase.modulo_id || '';
    }
    if (document.getElementById('clase-estudiante-user')) {
      document.getElementById('clase-estudiante-user').value = clase.estudiante_user || '';
    }

    let rawDesc = clase.descripcion || '';
    let matchUrlAct = rawDesc.match(/https?:\/\/[^\s]+/);
    let matchFecha = rawDesc.match(/📅 Fecha de Publicación: (\d{2}\/\d{2}\/\d{4})/);

    if (matchUrlAct) {
      document.getElementById('clase-url-actividad').value = matchUrlAct[0];
    } else {
      document.getElementById('clase-url-actividad').value = '';
    }

    if (matchFecha) {
      const partes = matchFecha[1].split('/');
      document.getElementById('clase-fecha').value = `${partes[2]}-${partes[1]}-${partes[0]}`;
    } else {
      document.getElementById('clase-fecha').value = '';
    }

    let descLimpia = rawDesc
      .replace(/📅 Fecha de Publicación: \d{2}\/\d{2}\/\d{4}\n?/, '')
      .replace(/📝 Enlace a Actividad \/ TP: https?:\/\/[^\s]+\n?/, '')
      .trim();

    document.getElementById('clase-descripcion').value = descLimpia;

    const summary = document.getElementById('summary-clase-titulo');
    if (summary) summary.innerText = '✏️ Editando Clase / Recuperatorio';

    const btnGuardar = document.getElementById('btn-guardar-clase');
    if (btnGuardar) btnGuardar.innerText = '💾 Actualizar Publicación';

    const btnCancelar = document.getElementById('btn-cancelar-edicion');
    if (btnCancelar) btnCancelar.style.display = 'inline-block';

    const details = document.getElementById('details-form-clase');
    if (details) details.open = true;
  },

  limpiarFormulario() {
    this.claseEditandoId = null;
    document.getElementById('clase-titulo').value = '';
    document.getElementById('clase-descripcion').value = '';
    document.getElementById('clase-url-teoria').value = '';
    document.getElementById('clase-url-actividad').value = '';
    if (document.getElementById('clase-fecha')) document.getElementById('clase-fecha').value = '';
    if (document.getElementById('clase-modulo-id')) document.getElementById('clase-modulo-id').value = '';
    if (document.getElementById('clase-estudiante-user')) document.getElementById('clase-estudiante-user').value = '';

    const summary = document.getElementById('summary-clase-titulo');
    if (summary) summary.innerText = '➕ Cargar Nueva Clase, Actividad o Recuperatorio';

    const btnGuardar = document.getElementById('btn-guardar-clase');
    if (btnGuardar) btnGuardar.innerText = '💾 Publicar Contenido';

    const btnCancelar = document.getElementById('btn-cancelar-edicion');
    if (btnCancelar) btnCancelar.style.display = 'none';
  },

  async guardarClase(e) {
    if (e) e.preventDefault();

    const titulo = document.getElementById('clase-titulo')?.value.trim();
    let descripcion = document.getElementById('clase-descripcion')?.value.trim();
    const urlTeoria = document.getElementById('clase-url-teoria')?.value.trim();
    const urlActividad = document.getElementById('clase-url-actividad')?.value.trim();
    const fecha = document.getElementById('clase-fecha')?.value;
    const moduloIdVal = document.getElementById('clase-modulo-id')?.value;
    const estudianteUserVal = document.getElementById('clase-estudiante-user')?.value;

    if (!titulo) {
      alert('Por favor ingresá un título.');
      return;
    }

    let extras = [];
    if (fecha) {
      const fechaFmt = fecha.split('-').reverse().join('/');
      extras.push(`📅 Fecha de Publicación: ${fechaFmt}`);
    }
    if (urlActividad) {
      extras.push(`📝 Enlace a Actividad / TP: ${urlActividad}`);
    }

    if (extras.length > 0) {
      descripcion = `${descripcion ? descripcion + '\n\n' : ''}${extras.join('\n')}`;
    }

    try {
      const objetoDatos = {
        trayecto_id: Number(this.trayectoActualId),
        titulo: titulo,
        descripcion: descripcion || null,
        url_recurso: urlTeoria || null,
        modulo_id: moduloIdVal ? Number(moduloIdVal) : null,
        estudiante_user: estudianteUserVal ? String(estudianteUserVal) : null
      };

      if (this.claseEditandoId) {
        const { error } = await supabase
          .from('clases')
          .update(objetoDatos)
          .eq('id', this.claseEditandoId);

        if (error) throw error;
        alert('✅ Publicación actualizada correctamente.');
      } else {
        const { error } = await supabase
          .from('clases')
          .insert([objetoDatos]);

        if (error) throw error;
        alert('✅ Publicación guardada con éxito.');
      }

      this.limpiarFormulario();
      await this.cargarListaClases();

    } catch (err) {
      console.error('Error al guardar:', err);
      alert('Error al guardar: ' + err.message);
    }
  },

  async eliminarClase(idClase) {
    if (!confirm('¿Querés eliminar esta publicación?')) return;

    try {
      const { error } = await supabase
        .from('clases')
        .delete()
        .eq('id', idClase);

      if (error) throw error;
      await this.cargarListaClases();
    } catch (err) {
      console.error('Error al eliminar:', err);
      alert('Error al eliminar: ' + err.message);
    }
  },

  async cargarSabanaEstudiantes() {
    const contenedor = document.getElementById('contenedor-lista-alumnos');
    if (!contenedor) return;

    try {
      const { data: inscripciones, error: errIns } = await supabase
        .from('inscripciones')
        .select('estudiante_user')
        .eq('trayecto_id', Number(this.trayectoActualId));

      if (errIns) throw errIns;

      if (!inscripciones || inscripciones.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:1.5rem;">No hay estudiantes inscriptos en este trayecto.</p>';
        return;
      }

      const listaUsers = inscripciones.map(i => i.estudiante_user);

      const { data: alumnos } = await supabase
        .from('usuarios')
        .select('*')
        .in('usuario', listaUsers);

      const { data: modulos } = await supabase
        .from('modulos')
        .select('id, nombre, codigo')
        .eq('trayecto_id', Number(this.trayectoActualId))
        .order('id', { ascending: true });

      const { data: clases } = await supabase
        .from('clases')
        .select('id, modulo_id')
        .eq('trayecto_id', Number(this.trayectoActualId));

      const idsClases = (clases || []).map(c => c.id);
      let entregas = [];
      if (idsClases.length > 0) {
        const { data: ent } = await supabase
          .from('entregas_actividades')
          .select('*')
          .in('clase_id', idsClases);
        entregas = ent || [];
      }

      const { data: asistencias } = await supabase
        .from('asistencias')
        .select('*')
        .eq('trayecto_id', Number(this.trayectoActualId));

      const { data: excepciones } = await supabase
        .from('excepciones_estudiantes')
        .select('*')
        .eq('trayecto_id', Number(this.trayectoActualId));

      const tieneModulos = modulos && modulos.length > 0;

      let thModulosHTML = '';
      if (tieneModulos) {
        thModulosHTML = modulos.map(m => `<th style="padding:0.75rem; text-align:center;">${m.nombre}</th>`).join('');
      } else {
        thModulosHTML = `<th style="padding:0.75rem; text-align:center;">Promedio General</th>`;
      }

      let filasHTML = '';
      (alumnos || []).forEach((u, i) => {
        const nombreCompleto = `${u.apellido || ''} ${u.nombre || ''}`.trim();
        const userKey = String(u.usuario || u.dni || u.id);

        let celdasNotasHTML = '';

        if (tieneModulos) {
          modulos.forEach(mod => {
            const clasesDelModulo = (clases || []).filter(c => Number(c.modulo_id) === Number(mod.id)).map(c => c.id);
            const entregasAlumnoMod = entregas.filter(e => clasesDelModulo.includes(Number(e.clase_id)) && String(e.estudiante_user) === userKey);

            let sumaAct = 0, cantAct = 0;
            entregasAlumnoMod.forEach(e => {
              const val = parseFloat(e.nota);
              if (!isNaN(val)) { sumaAct += val; cantAct++; }
            });
            const promAct = cantAct > 0 ? (sumaAct / cantAct) : null;

            const asisModUser = (asistencias || []).filter(a => (Number(a.modulo_id) === Number(mod.id) || a.modulo_id === null) && String(a.estudiante_user) === userKey);
            const totalClasesMod = asisModUser.length;
            const presentesMod = asisModUser.filter(a => a.estado === 'presente').length;
            const pctAsisMod = totalClasesMod > 0 ? ((presentesMod / totalClasesMod) * 100) : null;

            let notaFinalModulo = null;
            let desgloseTexto = '';

            if (promAct !== null && pctAsisMod !== null) {
              notaFinalModulo = Math.round((promAct + pctAsisMod) / 2);
              desgloseTexto = `TPs: ${Math.round(promAct)}% | Asis: ${Math.round(pctAsisMod)}%`;
            } else if (promAct !== null) {
              notaFinalModulo = Math.round(promAct);
              desgloseTexto = `TPs: ${Math.round(promAct)}% (Sin Asis)`;
            } else if (pctAsisMod !== null) {
              notaFinalModulo = Math.round(pctAsisMod);
              desgloseTexto = `Asis: ${Math.round(pctAsisMod)}% (Sin TPs)`;
            }

            if (notaFinalModulo !== null) {
              const acreditado = notaFinalModulo >= 70;
              celdasNotasHTML += `
                <td style="padding:0.75rem; text-align:center;">
                  <span style="display:inline-block; padding:0.2rem 0.5rem; border-radius:4px; font-weight:600; font-size:0.8rem; ${acreditado ? 'background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.4);' : 'background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.4);'}">
                    ${notaFinalModulo}% ${acreditado ? '✅' : '⚠️'}
                  </span>
                  <span style="display:block; font-size:0.7rem; color:#94a3b8; margin-top:0.2rem;">${desgloseTexto}</span>
                </td>
              `;
            } else {
              celdasNotasHTML += `<td style="padding:0.75rem; text-align:center; color:#64748b; font-size:0.8rem;">S/D</td>`;
            }
          });
        } else {
          const entregasAlumno = entregas.filter(e => String(e.estudiante_user) === userKey);
          let sumaAct = 0, cantAct = 0;
          entregasAlumno.forEach(e => {
            const val = parseFloat(e.nota);
            if (!isNaN(val)) { sumaAct += val; cantAct++; }
          });
          const promAct = cantAct > 0 ? (sumaAct / cantAct) : null;

          const asisUser = (asistencias || []).filter(a => String(a.estudiante_user) === userKey);
          const totalClases = asisUser.length;
          const presentes = asisUser.filter(a => a.estado === 'presente').length;
          const pctAsis = totalClases > 0 ? ((presentes / totalClases) * 100) : null;

          let notaFinalGeneral = null;
          let desgloseTexto = '';

          if (promAct !== null && pctAsis !== null) {
            notaFinalGeneral = Math.round((promAct + pctAsis) / 2);
            desgloseTexto = `TPs: ${Math.round(promAct)}% | Asis: ${Math.round(pctAsis)}%`;
          } else if (promAct !== null) {
            notaFinalGeneral = Math.round(promAct);
          } else if (pctAsis !== null) {
            notaFinalGeneral = Math.round(pctAsis);
          }

          if (notaFinalGeneral !== null) {
            const acreditado = notaFinalGeneral >= 70;
            celdasNotasHTML += `
              <td style="padding:0.75rem; text-align:center;">
                <span style="display:inline-block; padding:0.2rem 0.5rem; border-radius:4px; font-weight:600; font-size:0.8rem; ${acreditado ? 'background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.4);' : 'background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.4);'}">
                  ${notaFinalGeneral}% ${acreditado ? '✅' : '⚠️'}
                </span>
                ${desgloseTexto ? `<span style="display:block; font-size:0.7rem; color:#94a3b8; margin-top:0.2rem;">${desgloseTexto}</span>` : ''}
              </td>
            `;
          } else {
            celdasNotasHTML += `<td style="padding:0.75rem; text-align:center; color:#64748b; font-size:0.8rem;">S/D</td>`;
          }
        }

        const exEspecial = (excepciones || []).find(x => String(x.estudiante_user) === userKey && x.habilitado);

        filasHTML += `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
            <td style="padding:0.75rem 1rem; color:#94a3b8;">${i + 1}</td>
            <td style="padding:0.75rem 1rem; font-weight:600; color:#f8fafc;">
              ${nombreCompleto}
              <span style="display:block; font-size:0.75rem; color:#94a3b8;">DNI: ${userKey}</span>
            </td>
            ${celdasNotasHTML}
            <td style="padding:0.75rem 1rem; text-align:center;">
              <button type="button" onclick="ClasesModulo.toggleExcepcionEstudiante('${userKey}', ${exEspecial ? 'false' : 'true'})" style="padding:0.3rem 0.6rem; border-radius:6px; border:none; font-size:0.75rem; font-weight:600; cursor:pointer; ${exEspecial ? 'background:#eab308; color:#000;' : 'background:rgba(255,255,255,0.08); color:#cbd5e1;'}">
                ${exEspecial ? '🔓 Excepción Activa' : '🔒 Excepción Inactiva'}
              </button>
            </td>
          </tr>
        `;
      });

      contenedor.innerHTML = `
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; overflow-x:auto;">
          <table id="tabla-sabana-notas" style="width:100%; border-collapse:collapse; text-align:left; font-size:0.88rem;">
            <thead>
              <tr style="background:#0f172a; color:#94a3b8; border-bottom:1px solid rgba(255,255,255,0.1);">
                <th style="padding:0.75rem 1rem;">N°</th>
                <th style="padding:0.75rem 1rem;">Estudiante</th>
                ${thModulosHTML}
                <th style="padding:0.75rem 1rem; text-align:center;">Permiso Excepcional</th>
              </tr>
            </thead>
            <tbody>
              ${filasHTML}
            </tbody>
          </table>
        </div>
      `;

    } catch (err) {
      console.error('Error al cargar sábana de estudiantes:', err);
      contenedor.innerHTML = '<p style="color:#f87171; text-align:center;">Error al cargar la información.</p>';
    }
  },

  async toggleExcepcionEstudiante(userEstudiante, activar) {
    try {
      if (activar) {
        const { error } = await supabase
          .from('excepciones_estudiantes')
          .insert([{
            trayecto_id: Number(this.trayectoActualId),
            estudiante_user: String(userEstudiante),
            habilitado: true
          }]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('excepciones_estudiantes')
          .delete()
          .eq('trayecto_id', Number(this.trayectoActualId))
          .eq('estudiante_user', String(userEstudiante));
        if (error) throw error;
      }

      alert(activar ? '✅ Excepción activada: El alumno podrá avanzar libremente.' : '🔒 Excepción desactivada.');
      await this.cargarSabanaEstudiantes();

    } catch (err) {
      console.error('Error al toggle excepción:', err);
      alert('Error al cambiar estado de excepción: ' + err.message);
    }
  },

  async cargarPanelGeneralEntregas() {
    const contenedor = document.getElementById('contenedor-todas-entregas');
    if (!contenedor) return;

    try {
      const { data: clases } = await supabase
        .from('clases')
        .select('id, titulo, modulo_id')
        .eq('trayecto_id', Number(this.trayectoActualId));

      if (!clases || clases.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:1.5rem;">No hay clases publicadas aún.</p>';
        return;
      }

      const { data: modulos } = await supabase
        .from('modulos')
        .select('id, nombre')
        .eq('trayecto_id', Number(this.trayectoActualId));

      const idsClases = clases.map(c => c.id);

      const { data: entregas, error } = await supabase
        .from('entregas_actividades')
        .select('*')
        .in('clase_id', idsClases)
        .order('id', { ascending: false });

      if (error) throw error;

      if (!entregas || entregas.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:1.5rem;">Aún no se han recibido entregas de trabajos prácticos.</p>';
        return;
      }

      const listaUsers = entregas.map(e => e.estudiante_user);
      const { data: alumnos } = await supabase
        .from('usuarios')
        .select('usuario, nombre, apellido')
        .in('usuario', listaUsers);

      let cardsHTML = '';
      entregas.forEach(ent => {
        const claseObj = clases.find(c => Number(c.id) === Number(ent.clase_id));
        const tituloClase = claseObj ? claseObj.titulo : `Clase N° ${ent.clase_id}`;
        
        let moduloBadge = '';
        if (claseObj && claseObj.modulo_id) {
          const modObj = (modulos || []).find(m => Number(m.id) === Number(claseObj.modulo_id));
          if (modObj) {
            moduloBadge = `<span style="font-size:0.75rem; background:rgba(250,204,21,0.15); color:#facc15; border:1px solid rgba(250,204,21,0.3); padding:0.15rem 0.4rem; border-radius:4px; margin-left:0.4rem;">📘 Módulo: ${modObj.nombre}</span>`;
          }
        }

        const alu = (alumnos || []).find(a => String(a.usuario) === String(ent.estudiante_user));
        const nombreAlumno = alu ? `${alu.apellido || ''} ${alu.nombre || ''}`.trim() : ent.estudiante_user;

        let estadoAcreditacionHTML = '';
        const numNota = parseFloat(ent.nota);
        if (!isNaN(numNota)) {
          if (numNota >= 70) {
            estadoAcreditacionHTML = `<span style="font-size:0.75rem; background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.4); padding:0.2rem 0.5rem; border-radius:4px; font-weight:600;">✅ ACREDITADO (>=70)</span>`;
          } else {
            estadoAcreditacionHTML = `<span style="font-size:0.75rem; background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.4); padding:0.2rem 0.5rem; border-radius:4px; font-weight:600;">⚠️ NO ACREDITADO (<70)</span>`;
          }
        }

        cardsHTML += `
          <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:1rem; margin-bottom:0.8rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.5rem;">
              <div>
                <strong style="color:#38bdf8; font-size:0.9rem; display:inline-block;">📌 ${tituloClase}</strong> ${moduloBadge}
                <div style="color:#f8fafc; font-size:0.85rem; font-weight:600; margin-top:0.2rem;">👤 Estudiante: ${nombreAlumno} ${estadoAcreditacionHTML}</div>
              </div>
              <a href="${ent.url_entrega}" target="_blank" rel="noopener" style="padding:0.3rem 0.6rem; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; border-radius:6px; font-size:0.8rem; text-decoration:none; font-weight:600;">🔗 Ver Trabajo Entregado</a>
            </div>

            <div style="display:grid; grid-template-columns: 160px 1fr 100px; gap:0.6rem; margin-top:0.8rem; align-items:center;">
              <div>
                <label style="display:block; font-size:0.75rem; color:#facc15; font-weight:600; margin-bottom:0.2rem;">Nota (0-100):</label>
                <input type="text" id="nota-panel-${ent.id}" placeholder="Ej: 85" value="${ent.nota || ''}" style="width:100%; padding:0.4rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px; font-size:0.82rem;">
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; color:#cbd5e1; font-weight:600; margin-bottom:0.2rem;">Comentario / Devolución:</label>
                <input type="text" id="coment-panel-${ent.id}" placeholder="Observaciones pedagógicas..." value="${ent.comentario_docente || ''}" style="width:100%; padding:0.4rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px; font-size:0.82rem;">
              </div>

              <button type="button" onclick="ClasesModulo.guardarCalificacionDesdePanel(${ent.id})" style="padding:0.45rem 0.6rem; background:#22c55e; color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.8rem; margin-top:1rem;">
                💾 Guardar
              </button>
            </div>
          </div>
        `;
      });

      contenedor.innerHTML = cardsHTML;

    } catch (err) {
      console.error('Error al cargar panel de entregas:', err);
      contenedor.innerHTML = '<p style="color:#f87171; text-align:center;">Error al cargar el listado de entregas.</p>';
    }
  },

  async guardarCalificacionDesdePanel(entregaId) {
    const notaVal = document.getElementById(`nota-panel-${entregaId}`)?.value.trim();
    const comentVal = document.getElementById(`coment-panel-${entregaId}`)?.value.trim();

    try {
      const { data: entrega, error: errEnt } = await supabase
        .from('entregas_actividades')
        .select('*, clases(titulo)')
        .eq('id', entregaId)
        .single();

      if (errEnt) throw errEnt;

      const { error } = await supabase
        .from('entregas_actividades')
        .update({
          nota: notaVal || null,
          comentario_docente: comentVal || null
        })
        .eq('id', entregaId);

      if (error) throw error;

      const tituloClase = entrega.clases ? entrega.clases.titulo : 'una actividad';
      const numNota = parseFloat(notaVal);
      let estadoTxt = 'evaluado';
      
      if (!isNaN(numNota)) {
        estadoTxt = numNota >= 70 ? `calificado con ${numNota}% (Acreditado) ✅` : `calificado con ${numNota}% (No Acreditado) ⚠️`;
      }

      await supabase.from('notificaciones').insert([{
        estudiante_user: String(entrega.estudiante_user),
        trayecto_id: Number(this.trayectoActualId),
        clase_id: Number(entrega.clase_id),
        titulo: `Novedad en ${tituloClase}`,
        mensaje: `Tu trabajo fue ${estadoTxt}.${comentVal ? ` Observación: "${comentVal}"` : ''}`
      }]);

      alert('✅ Calificación guardada y estudiante notificado.');
      await this.cargarPanelGeneralEntregas();

    } catch (err) {
      console.error('Error al calificar:', err);
      alert('Error al guardar la calificación: ' + err.message);
    }
  },

async importarEstudiantesCSV(archivoCSV) {
    if (!archivoCSV) return;

    const trayectoId = this.trayectoActualId;
    if (!trayectoId) {
      alert('⚠️ Seleccioná un trayecto para vincular la nómina de estudiantes.');
      return;
    }

    const lector = new FileReader();
    lector.readAsText(archivoCSV);

    lector.onload = async (e) => {
      const contenido = e.target.result;
      const filas = contenido.split('\n').map(f => f.trim()).filter(f => f.length > 0);

      if (filas.length <= 1) {
        alert('El archivo CSV está vacío o solo contiene encabezados.');
        return;
      }

      const encabezados = filas[0].toLowerCase().split(',').map(h => h.trim());
      const idxDni = encabezados.indexOf('dni');
      const idxNombre = encabezados.indexOf('nombre');
      const idxApellido = encabezados.indexOf('apellido');
      const idxEmail = encabezados.indexOf('email');

      if (idxDni === -1) {
        alert('❌ Error: El archivo CSV debe incluir obligatoriamente la columna "dni".');
        return;
      }

      let procesados = 0;
      let errores = 0;

      for (let i = 1; i < filas.length; i++) {
        const cols = filas[i].split(',').map(c => c.trim());
        const dni = cols[idxDni];
        const nombre = idxNombre !== -1 ? cols[idxNombre] : '';
        const apellido = idxApellido !== -1 ? cols[idxApellido] : '';
        
        let email = idxEmail !== -1 ? cols[idxEmail] : '';
        if (!email && dni) {
          email = `${dni}@gmail.com`;
        }

        if (!dni) continue;

        try {
          const passHasheada = (typeof CryptoJS !== 'undefined' && CryptoJS.SHA256)
            ? CryptoJS.SHA256(String(dni)).toString()
            : String(dni);

          // 1. Registrar o actualizar usuario en la tabla 'usuarios'
          const { error: errUser } = await supabase
            .from('usuarios')
            .upsert({
              usuario: String(dni),
              pass: passHasheada,
              nombre: String(nombre),
              apellido: String(apellido),
              email: String(email),
              rol: 'estudiante'
            }, { onConflict: 'usuario' });

          if (errUser) {
            console.error(`❌ Error Supabase Usuario [${dni}]:`, errUser.message, errUser.details);
            throw errUser;
          }

          // 2. Verificar e inscribir alumno al trayecto sin forzar onConflict
          const { data: inscExistente } = await supabase
            .from('inscripciones')
            .select('id')
            .eq('trayecto_id', Number(trayectoId))
            .eq('estudiante_user', String(dni))
            .maybeSingle();

          if (!inscExistente) {
            const { error: errInsc } = await supabase
              .from('inscripciones')
              .insert([{
                trayecto_id: Number(trayectoId),
                estudiante_user: String(dni)
              }]);

            if (errInsc) {
              console.error(`❌ Error Supabase Inscripción [${dni}]:`, errInsc.message, errInsc.details);
              throw errInsc;
            }
          }

          procesados++;
        } catch (err) {
          console.error(`Error al procesar DNI ${dni}:`, err);
          errores++;
        }
      }

      alert(`✅ Proceso finalizado: ${procesados} estudiantes inscriptos correctamente al trayecto.${errores > 0 ? ` (${errores} errores)` : ''}`);
      await this.cargarSabanaEstudiantes();
    };
  },  
  cerrarGestor() {
    const modal = document.getElementById('modal-gestor-clases');
    if (modal) modal.style.display = 'none';
  }
};

window.ClasesModulo = ClasesModulo;
