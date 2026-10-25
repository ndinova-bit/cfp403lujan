/* ==========================================================================
   MÓDULO DE CLASES, ACTIVIDADES, NOTAS Y ASISTENCIA
   Archivo: js/clases.js
   ========================================================================== */

const ClasesModulo = {
  trayectoActualId: null,
  claseEditandoId: null,

  // Escapa texto para insertarlo de forma segura en HTML (evita que un título o comentario ejecute código)
  esc(t) {
    return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // Devuelve el enlace normalizado solo si empieza con http:// o https://; si no, devuelve ''
  urlSegura(u) {
    try {
      const x = new URL(String(u || '').trim());
      return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : '';
    } catch (e) {
      return '';
    }
  },

  convertirLinks(texto) {
    if (!texto) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    // Primero se escapa todo el texto; recién después se convierten los enlaces en botones
    return this.esc(texto).replace(urlRegex, (url) => {
      return `
        <div style="margin-top:0.4rem; display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
          <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:0.35rem 0.75rem; background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.3); color:#facc15; border-radius:6px; font-size:0.82rem; text-decoration:none; font-weight:600;">📝 Abrir Enlace de Actividad / TP</a>
          <button type="button" data-url="${url}" onclick="ClasesModulo.verEnPantalla(this.dataset.url, 'Actividad / TP')" style="padding:0.35rem 0.75rem; background:rgba(234,179,8,0.25); border:1px solid rgba(234,179,8,0.5); color:#fef08a; border-radius:6px; font-size:0.82rem; cursor:pointer; font-weight:600;">👁️ Visualizar en Pantalla</button>
        </div>
      `;
    });
  },

  verEnPantalla(url, titulo) {
    url = this.urlSegura(url);
    if (!url) {
      alert('El enlace no es válido: tiene que empezar con http:// o https://');
      return;
    }
    titulo = this.esc(titulo);
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
            <a href="${this.esc(url)}" target="_blank" rel="noopener noreferrer" style="padding:0.25rem 0.6rem; background:#0284c7; color:#fff; border-radius:4px; font-size:0.8rem; text-decoration:none; font-weight:600;">🔗 Abrir pestaña aparte</a>
            <button type="button" onclick="document.getElementById('modal-visor-recurso').style.display='none'" style="background:none; border:none; color:#f87171; font-size:1.4rem; cursor:pointer; font-weight:bold; margin-left:0.5rem;">✕</button>
          </div>
        </div>
        <div style="flex:1; background:#000; position:relative;">
          <iframe src="${this.esc(embedUrl)}" style="width:100%; height:100%; border:none;" allow="autoplay"></iframe>
        </div>
      </div>
    `;

    visor.style.display = 'flex';
  },

  async abrirGestor(trayectoId, nombreTrayecto) {
    this.trayectoActualId = trayectoId;
    this.claseEditandoId = null;
    this.nombreTrayectoActual = nombreTrayecto || '';

    const perfil = (window.Auth && Auth.usuarioActual)
      ? Auth.usuarioActual
      : (() => {
          const sesionRaw = localStorage.getItem('usuario_actual') || localStorage.getItem('usuario_logueado') || sessionStorage.getItem('usuario_logueado');
          return sesionRaw ? JSON.parse(sesionRaw) : {};
        })();

    const rolNorm = String(perfil.rol || '').toLowerCase().trim();
    const esEstudiante = rolNorm === 'estudiante';
    const esPreceptor = rolNorm === 'preceptor';
    const esAdminG = Auth.esDireccion(rolNorm);
    const puedeImportar = esAdminG || esPreceptor;     // la función del servidor acepta administración, regencia y preceptoría
    this.rolGestor = rolNorm;

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
          <h3 style="margin:0; font-size:1.15rem;">📚 Trayecto: <span style="color:#38bdf8;">${this.esc(nombreTrayecto)}</span></h3>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            ${Auth.esAdmin(rolNorm) ? `
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
          ${esPreceptor ? '' : `<button type="button" id="btn-tab-entregas" onclick="ClasesModulo.cambiarVistaPestana('entregas')" style="padding:0.4rem 1rem; border:none; border-radius:6px; background:rgba(255,255,255,0.05); color:#94a3b8; font-weight:600; cursor:pointer;">
            📝 Entregas y Calificaciones
          </button>`}
          ${esPreceptor ? '' : `<button type="button" id="btn-tab-libro" onclick="ClasesModulo.cambiarVistaPestana('libro')" style="padding:0.4rem 1rem; border:none; border-radius:6px; background:rgba(255,255,255,0.05); color:#94a3b8; font-weight:600; cursor:pointer;">
            📖 Libro de Temas
          </button>
          <button type="button" id="btn-tab-planificacion" onclick="ClasesModulo.cambiarVistaPestana('planificacion')" style="padding:0.4rem 1rem; border:none; border-radius:6px; background:rgba(255,255,255,0.05); color:#94a3b8; font-weight:600; cursor:pointer;">
            🗂️ Planificación
          </button>`}
        </div>
      `;
    }

    htmlModal += `
      <div style="padding:1.5rem; overflow-y:auto; flex:1;">
        <div id="vista-tab-clases">
    `;

    if (!esEstudiante && !esPreceptor) {
      const T = window.Actividades ? Actividades.TIPOS : {};
      htmlModal += `
        <details id="details-form-clase" class="act-form-wrap">
          <summary id="summary-clase-titulo">➕ Nueva publicación: clase, trabajo, cuestionario…</summary>
          <form id="form-clase" class="act-form" onsubmit="ClasesModulo.guardarClase(event)" novalidate>
            <div class="act-tipos" id="act-tipos" role="radiogroup" aria-label="Tipo de publicación">
              ${Object.entries(T).map(([k, v]) => `<button type="button" class="act-tipo" data-tipo="${k}" role="radio" aria-checked="false" onclick="ClasesModulo.elegirTipo('${k}')"><span class="act-tipo-ico">${v.ico}</span><span>${v.nombre}</span></button>`).join('')}
            </div>
            <input type="hidden" id="clase-tipo" value="material">
            <p class="act-tipo-desc" id="act-tipo-desc"></p>
            <div class="act-grid3">
              <label>Título *<input type="text" id="clase-titulo" class="act-in" maxlength="150" placeholder="Ej.: Clase 3 · Protecciones eléctricas"></label>
              <label>Módulo<select id="clase-modulo-id" class="act-in"><option value="">Cargando módulos…</option></select></label>
              <label>Para<select id="clase-estudiante-user" class="act-in"><option value="">Todo el grupo</option></select></label>
            </div>
            <label>Consigna / descripción<textarea id="clase-descripcion" rows="3" class="act-in" maxlength="4000" placeholder="Qué tienen que hacer, materiales, pautas…"></textarea></label>
            <div class="act-grid2">
              <label>📚 Material de lectura o video (link)<input type="url" id="clase-url-teoria" class="act-in" placeholder="https://drive.google.com/…  ·  https://youtube.com/…"></label>
              <label data-solo="tp practica">📝 Link a la consigna o guía (opcional)<input type="url" id="clase-url-actividad" class="act-in" placeholder="https://…"></label>
            </div>
            <div class="act-grid3">
              <label>📅 Se publica el<input type="date" id="clase-fecha" class="act-in"><small>Si lo dejás vacío, se publica ahora.</small></label>
              <label data-ocultar="material practica">⏰ Fecha y hora límite<input type="datetime-local" id="clase-limite" class="act-in"><small>Vacío: sin límite. Al alumno le avisa 2 días antes.</small></label>
              <label class="act-check act-check-alto" data-ocultar="material encuesta"><input type="checkbox" id="clase-evaluacion"> 🎓 Es una evaluación</label>
            </div>
            <div id="act-editor"></div>
            <div class="act-form-pie">
              <button type="button" id="btn-cancelar-edicion" class="act-btn-sec" style="display:none;" onclick="ClasesModulo.limpiarFormulario()">Cancelar edición</button>
              <button type="button" id="btn-probar-act" class="act-btn-sec" style="display:none;" onclick="ClasesModulo.probarActividad()">👁️ Vista previa</button>
              <button type="submit" id="btn-guardar-clase" class="act-btn">💾 Publicar</button>
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
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              ${puedeImportar ? `<label for="input-importar-csv" style="padding:0.4rem 0.8rem; background:#0284c7; color:#fff; border-radius:6px; font-weight:600; font-size:0.8rem; cursor:pointer; display:inline-block;">
                📥 Importar Nómina de Alumnos (Excel o CSV)
              </label>
              <input type="file" id="input-importar-csv" accept=".csv,.xlsx" style="display:none;" onchange="ClasesModulo.importarEstudiantesCSV(this.files[0])">
              <button type="button" class="btn btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="FichaCurso.descargar(ClasesModulo.trayectoActualId)">📄 Ficha de Curso (Excel)</button>` : ''}
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

        <div id="vista-tab-libro" style="display:none;">
          <div id="contenedor-libro-temas">
            <p style="color:#94a3b8; text-align:center;">Cargando libro de temas...</p>
          </div>
        </div>

        <div id="vista-tab-planificacion" style="display:none;">
          <div id="contenedor-planificacion">
            <p style="color:#94a3b8; text-align:center;">Cargando planificación...</p>
          </div>
        </div>
      </div>
    </div>
    `;

    modal.innerHTML = htmlModal;
    modal.style.display = 'flex';

    if (!esEstudiante && !esPreceptor) {
      this.elegirTipo('material');
      await this.poblarComboModulos();
      await this.poblarComboEstudiantes();
    }
    await this.cargarListaClases(esEstudiante);
    // El preceptor entra directo a la toma de asistencia; sin señal, también el docente
    if (esPreceptor || (!esEstudiante && !navigator.onLine)) this.cambiarVistaPestana('asistencias');
  },

  async poblarComboModulos() {
    const select = document.getElementById('clase-modulo-id');
    if (!select) return;

    try {
      const { data: modulos, error } = await supabase
        .from('modulos')
        .select('id, nombre, codigo')
        .eq('trayecto_id', Number(this.trayectoActualId))
        .order('id', { ascending: true });

      if (error) throw error;

      this.modulosTrayecto = (modulos || []).slice().sort((a, b) => Number(a.id) - Number(b.id));
      if (!modulos || modulos.length === 0) {
        select.innerHTML = '<option value="">Sin módulos (general del trayecto)</option>';
        return;
      }

      select.innerHTML = '<option value="">General del trayecto (sin módulo)</option>' + 
        modulos.map(m => `<option value="${Number(m.id)}">${this.esc(m.nombre)} (${this.esc(m.codigo || 'S/C')})</option>`).join('');

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

      select.innerHTML = '<option value="">Todo el grupo</option>' +
        (alumnos || []).map(u => {
          const userKey = String(u.usuario || u.dni || u.id);
          const apStr = (u.apellido || '').toUpperCase().trim();
          const nomStr = u.nombre ? (u.nombre.charAt(0).toUpperCase() + u.nombre.slice(1).toLowerCase()) : '';
          const nombreCompleto = apStr && nomStr ? `${apStr}, ${nomStr}` : (apStr || nomStr || userKey);
          return `<option value="${this.esc(userKey)}">Solo ${this.esc(nombreCompleto)} (recuperatorio / tarea personal)</option>`;
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
    const vLibro = document.getElementById('vista-tab-libro');
    const vPlan = document.getElementById('vista-tab-planificacion');
    const bLibro = document.getElementById('btn-tab-libro');
    const bPlan = document.getElementById('btn-tab-planificacion');

    [bClases, bAlumnos, bAsistencias, bEntregas, bLibro, bPlan].forEach(b => {
      if (b) { b.style.background = 'rgba(255,255,255,0.05)'; b.style.color = '#94a3b8'; }
    });
    [vClases, vAlumnos, vAsistencias, vEntregas, vLibro, vPlan].forEach(v => {
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
    } else if (pestana === 'libro') {
      if (vLibro) vLibro.style.display = 'block';
      if (bLibro) { bLibro.style.background = '#0284c7'; bLibro.style.color = '#fff'; }
      if (window.LibroTemasModulo) LibroTemasModulo.cargar(this.trayectoActualId, this.nombreTrayectoActual);
    } else if (pestana === 'planificacion') {
      if (vPlan) vPlan.style.display = 'block';
      if (bPlan) { bPlan.style.background = '#0284c7'; bPlan.style.color = '#fff'; }
      if (window.PlanificacionModulo) PlanificacionModulo.cargar(this.trayectoActualId);
    } else {
      if (vClases) vClases.style.display = 'block';
      if (bClases) { bClases.style.background = '#0284c7'; bClases.style.color = '#fff'; }
    }
  },

  /* ---------- Lista de clases y actividades, agrupadas por módulo ---------- */
  async cargarListaClases(esEstudiante = false) {
    const contenedor = document.getElementById('lista-clases-cargadas');
    if (!contenedor) return;
    if (this.rolGestor) esEstudiante = this.rolGestor === 'estudiante';
    const tid = Number(this.trayectoActualId);

    try {
      const dni = Actividades.miDni();
      const { data: clasesRaw, error } = await supabase.from('clases').select('*').eq('trayecto_id', tid).order('id', { ascending: true });
      if (error) throw error;
      const hoy = Actividades.hoyISO();

      const clases = (clasesRaw || []).map(c => this.normalizarClase(c));
      window.clasesGuardadasCache = clases;

      const { data: modulos } = await supabase.from('modulos').select('*').eq('trayecto_id', tid).order('id', { ascending: true });
      const listaMod = modulos || [];

      let entregas = [];
      if (clases.length) {
        const { data: ent } = await supabase.from('entregas_actividades').select('*').in('clase_id', clases.map(c => c.id));
        entregas = ent || [];
      }
      this.entregasCache = entregas;

      // Alumno: módulos habilitados según la regla única (correlatividad)
      let tieneExcepcion = false;
      let evalEstudiante = null;
      if (esEstudiante && dni) {
        const { data: exc } = await supabase.from('excepciones_estudiantes').select('*').eq('trayecto_id', tid).eq('estudiante_user', dni).eq('habilitado', true);
        tieneExcepcion = !!(exc && exc.length);
        if (listaMod.length > 1) {
          const [rAs, rAc, rTr] = await Promise.all([
            supabase.from('asistencias').select('estudiante_user, modulo_id, estado').eq('trayecto_id', tid).eq('estudiante_user', dni),
            supabase.from('modulos_acreditados').select('*').eq('trayecto_id', tid).eq('estudiante_user', dni),
            supabase.from('trayectos').select('*').eq('id', tid).maybeSingle()
          ]);
          evalEstudiante = ReglasFP.evaluar({
            key: dni, modulos: listaMod, clases, entregas, asistencias: rAs.data || [],
            acreditados: (!rAc.error && rAc.data) || [], computaAsistencia: ReglasFP.computaAsistencia(rTr.data), excepcion: tieneExcepcion
          });
        }
      }

      // Docente: inscriptos activos (para "entregaron X de Y")
      let activos = new Set();
      if (!esEstudiante) {
        const { data: insc } = await supabase.from('inscripciones').select('estudiante_user, estado').eq('trayecto_id', tid);
        activos = new Set((insc || []).filter(i => String(i.estado || '').toUpperCase() !== 'BAJA').map(i => String(i.estudiante_user)));
      }

      const visibles = clases.filter(c => {
        if (!esEstudiante) return true;
        if (c.estudiante_user && String(c.estudiante_user) !== dni) return false;
        return !c.fecha_publicacion || String(c.fecha_publicacion).slice(0, 10) <= hoy;
      });

      if (!visibles.length) {
        contenedor.innerHTML = `<p class="act-vacio">${esEstudiante ? 'Todavía no hay contenidos publicados en este trayecto.' : 'Todavía no publicaste contenidos. Usá “Nueva publicación” para cargar la primera clase.'}</p>`;
        return;
      }

      const ctx = { esEstudiante, dni, entregas, activos, hoy };
      const grupos = [];
      const sinMod = visibles.filter(c => !c.modulo_id || !listaMod.some(m => Number(m.id) === Number(c.modulo_id)));
      if (sinMod.length) grupos.push({ titulo: listaMod.length ? 'General del trayecto' : 'Clases y actividades', clases: sinMod, bloqueado: false });
      listaMod.forEach((m, i) => {
        const cs = visibles.filter(c => Number(c.modulo_id) === Number(m.id));
        if (!cs.length) return;
        const ev = evalEstudiante && evalEstudiante.modulos[i];
        grupos.push({ titulo: `Módulo ${i + 1} · ${m.nombre}`, clases: cs, bloqueado: !!(esEstudiante && !tieneExcepcion && ev && ev.bloqueado), nota: ev ? ev.nota : null, aprobado: ev ? ev.aprobado : false });
      });

      let html = esEstudiante ? this.resumenAlumno(visibles, ctx, grupos) : '';
      html += grupos.map(g => {
        const ordenadas = g.clases.slice().sort((a, b) => String(a.fecha_publicacion || '').localeCompare(String(b.fecha_publicacion || '')) || Number(a.id) - Number(b.id));
        return `<details class="act-grupo" ${g.bloqueado ? '' : 'open'}>
          <summary><span class="act-grupo-tit">${this.esc(g.titulo)}</span><span class="act-grupo-meta">${g.clases.length} publicación${g.clases.length === 1 ? '' : 'es'}${g.bloqueado ? ' · 🔒 Se habilita al aprobar el módulo anterior' : ''}${esEstudiante && g.nota !== null && g.nota !== undefined ? ` · Nota parcial: <strong class="${g.aprobado ? 'ok' : 'bad'}">${g.nota}</strong>` : ''}</span></summary>
          <div class="act-grupo-cuerpo">${ordenadas.map(c => this.tarjetaClase(c, { ...ctx, bloqueado: g.bloqueado })).join('')}</div>
        </details>`;
      }).join('');
      contenedor.innerHTML = html;
      this.celebrarNotas(visibles, ctx);
    } catch (err) {
      console.error('Error al cargar clases:', err);
      contenedor.innerHTML = '<p style="color:#f87171; text-align:center;">Error al cargar las clases.</p>';
    }
  },

  // Compatibilidad: clases cargadas antes de sql/11 (fecha y link escritos dentro de la descripción)
  normalizarClase(c) {
    const x = { ...c };
    const d = String(x.descripcion || '');
    if (!x.tipo) {
      const mF = d.match(/📅 Fecha de Publicación: (\d{2})\/(\d{2})\/(\d{4})/);
      const mU = d.match(/📝 Enlace a Actividad \/ TP: (https?:\/\/\S+)/);
      if (mF && !x.fecha_publicacion) x.fecha_publicacion = `${mF[3]}-${mF[2]}-${mF[1]}`;
      if (mU && !x.url_actividad) x.url_actividad = mU[1];
      x.descripcion = d.replace(/📅 Fecha de Publicación: \d{2}\/\d{2}\/\d{4}\n?/, '').replace(/📝 Enlace a Actividad \/ TP: https?:\/\/\S+\n?/, '').trim();
      x.tipo = x.url_actividad ? 'tp' : 'material';
      x.calificable = x.tipo !== 'material';
    }
    return x;
  },

  resumenAlumno(visibles, ctx, grupos) {
    const bloqueadas = new Set();
    grupos.filter(g => g.bloqueado).forEach(g => g.clases.forEach(c => bloqueadas.add(c.id)));
    let pronto = 0, vencidas = 0, pendientes = 0;
    visibles.forEach(c => {
      if (!Actividades.RESPONDE_ALUMNO.includes(c.tipo) || bloqueadas.has(c.id)) return;
      const ent = ctx.entregas.find(e => Number(e.clase_id) === Number(c.id) && String(e.estudiante_user) === ctx.dni);
      if (ent) return;
      const pl = Actividades.plazo(c);
      if (pl && pl.vencida) vencidas++;
      else if (pl && pl.dias <= 2) pronto++;
      else pendientes++;
    });
    if (!pronto && !vencidas && !pendientes) return '';
    return `<div class="act-aviso-alumno">
      ${pronto ? `<span class="act-chip pronto">⏰ ${pronto} actividad${pronto > 1 ? 'es vencen' : ' vence'} en los próximos 2 días</span>` : ''}
      ${pendientes ? `<span class="act-chip">📝 ${pendientes} pendiente${pendientes > 1 ? 's' : ''}</span>` : ''}
      ${vencidas ? `<span class="act-chip vencida">⚠️ ${vencidas} vencida${vencidas > 1 ? 's' : ''} sin entregar</span>` : ''}
    </div>`;
  },

  celebrarNotas(visibles, ctx) {
    if (!ctx.esEstudiante || !window.confetti) return;
    const nueva = visibles.find(c => {
      const e = ctx.entregas.find(x => Number(x.clase_id) === Number(c.id) && String(x.estudiante_user) === ctx.dni);
      const clave = `confetti_visto_${c.id}_${ctx.dni}`;
      if (!e || !(parseFloat(e.nota) >= 70) || sessionStorage.getItem(clave)) return false;
      sessionStorage.setItem(clave, 'true');
      return true;
    });
    if (nueva) setTimeout(() => confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }), 300);
  },

  tarjetaClase(c, ctx) {
    const A = Actividades;
    const T = A.TIPOS[c.tipo] || A.TIPOS.material;
    const ent = ctx.esEstudiante ? ctx.entregas.find(e => Number(e.clase_id) === Number(c.id) && String(e.estudiante_user) === ctx.dni) : null;
    const pl = A.plazo(c);
    const chips = [`<span class="act-chip tipo t-${this.esc(c.tipo)}">${T.ico} ${T.nombre}</span>`];
    if (c.es_evaluacion) chips.push('<span class="act-chip eval">🎓 Evaluación</span>');
    if (c.estudiante_user) chips.push(`<span class="act-chip personal">🎯 ${ctx.esEstudiante ? 'Solo para vos' : 'Solo DNI ' + this.esc(c.estudiante_user)}</span>`);
    if (!ctx.esEstudiante && c.fecha_publicacion && String(c.fecha_publicacion).slice(0, 10) > ctx.hoy) chips.push(`<span class="act-chip prog">🗓️ Se publica el ${A.fechaDMY(c.fecha_publicacion)}</span>`);
    if (pl && (!ctx.esEstudiante || !ent)) chips.push(`<span class="act-chip ${pl.cls}">⏰ ${this.esc(pl.txt)}</span>`);
    if (ctx.esEstudiante && ent && A.tieneNota(ent)) chips.push(`<span class="act-chip ${parseFloat(ent.nota) >= 70 ? 'ok' : 'bad'}">Nota ${this.esc(ent.nota)}</span>`);
    else if (ctx.esEstudiante && ent && c.tipo !== 'encuesta') chips.push('<span class="act-chip mid">✔ Entregada</span>');
    else if (ctx.esEstudiante && ent) chips.push('<span class="act-chip ok">✔ Respondida</span>');

    const urlT = this.urlSegura(c.url_recurso);
    const urlA = this.urlSegura(c.url_actividad);
    const enlaces = [
      urlT ? `<a class="act-enlace" href="${this.esc(urlT)}" target="_blank" rel="noopener noreferrer">📚 Material de la clase</a><button type="button" class="act-enlace sec" data-url="${this.esc(urlT)}" data-titulo="${this.esc(c.titulo)}" onclick="ClasesModulo.verEnPantalla(this.dataset.url, this.dataset.titulo)">👁️ Ver en pantalla</button>` : '',
      urlA ? `<a class="act-enlace amarillo" href="${this.esc(urlA)}" target="_blank" rel="noopener noreferrer">📝 Consigna / guía</a><button type="button" class="act-enlace sec" data-url="${this.esc(urlA)}" onclick="ClasesModulo.verEnPantalla(this.dataset.url, 'Consigna')">👁️ Ver en pantalla</button>` : ''
    ].join('');

    const accion = ctx.esEstudiante ? this.accionAlumno(c, ent, ctx) : this.accionDocente(c, ctx);
    return `<article class="act-tarjeta t-${this.esc(c.tipo)}">
      <div class="act-tarjeta-cab">
        <div><div class="act-chips">${chips.join('')}</div><h4>${this.esc(c.titulo)}</h4></div>
        ${!ctx.esEstudiante && this.rolGestor !== 'preceptor' ? `<div class="act-tarjeta-btns"><button type="button" class="act-mini" onclick="ClasesModulo.editarClase(${Number(c.id)})" title="Editar">✏️</button><button type="button" class="act-mini act-quitar" onclick="ClasesModulo.eliminarClase(${Number(c.id)})" title="Eliminar">🗑️</button></div>` : ''}
      </div>
      ${c.descripcion ? `<div class="act-desc">${this.convertirLinks(c.descripcion)}</div>` : ''}
      ${enlaces ? `<div class="act-enlaces">${enlaces}</div>` : ''}
      ${accion}
    </article>`;
  },

  accionAlumno(c, ent, ctx) {
    const A = Actividades;
    if (c.tipo === 'material') return '';
    if (ctx.bloqueado) return '<div class="act-bloq">🔒 Se habilita al aprobar el módulo anterior con 70 o más (actividades y asistencia), por equivalencia o con habilitación excepcional del docente.</div>';
    const pl = A.plazo(c);
    const vencida = !!(pl && pl.vencida);
    const nota = ent && A.tieneNota(ent);
    const id = Number(c.id);
    if (c.tipo === 'tp') {
      const link = ent ? this.urlSegura(ent.url_entrega) : '';
      let h = '<div class="act-accion">';
      if (nota) {
        h += `<div class="act-res-linea"><span>Calificación: <strong>${this.esc(ent.nota)}</strong> ${parseFloat(ent.nota) >= 70 ? '✅' : '— no alcanza 70'}</span>${link ? `<a href="${this.esc(link)}" target="_blank" rel="noopener noreferrer">Ver mi trabajo</a>` : ''}<button type="button" class="act-mini" onclick="Actividades.verResultado(${id})">Ver devolución</button></div>`;
      } else if (vencida) {
        h += link ? `<div class="act-res-linea">⏳ Entregado: falta la corrección. <a href="${this.esc(link)}" target="_blank" rel="noopener noreferrer">Ver mi trabajo</a></div>` : '<div class="act-res-linea bad">Venció el plazo de entrega: cuenta como 10.</div>';
      } else {
        h += `${ent ? `<div class="act-res-linea">⏳ Entregado: falta la corrección. Podés reemplazar el link hasta que te califiquen.</div>` : ''}
          <div class="act-entrega-link"><input type="url" id="input-entrega-${id}" class="act-in" placeholder="Pegá el link a tu trabajo (Google Drive, PDF, fotos)" value="${ent ? this.esc(ent.url_entrega || '') : ''}">
          <button type="button" class="act-btn" onclick="ClasesModulo.enviarEntregaEstudiante(${id})">${ent ? 'Actualizar link' : 'Entregar'}</button></div>`;
      }
      return h + '</div>';
    }
    if (c.tipo === 'practica') {
      return `<div class="act-accion">${nota ? `<div class="act-res-linea"><span>Calificación: <strong>${this.esc(ent.nota)}</strong></span><button type="button" class="act-mini" onclick="Actividades.verResultado(${id})">Ver lista de cotejo y devolución</button></div>` : '<div class="act-res-linea">🛠️ Esta práctica se califica en el taller.</div>'}</div>`;
    }
    let botones = '';
    if (A.AUTO.includes(c.tipo)) {
      const inf = A.intentosInfo(c, ent);
      const puede = !vencida && inf.quedan > 0 && !(ent && nota && !inf.usados);
      if (ent) botones += `<button type="button" class="act-btn-sec" onclick="Actividades.verResultado(${id})">Ver resultado</button>`;
      if (puede) botones += `<button type="button" class="act-btn" onclick="Actividades.abrir(${id})">${ent ? `Intentar de nuevo${inf.maximo ? ` (te queda${inf.quedan > 1 ? 'n' : ''} ${inf.quedan})` : ''}` : (c.tipo === 'diagnostico' ? 'Empezar el caso' : 'Comenzar')}</button>`;
      if (!ent && vencida) botones += '<span class="act-res-linea bad">Venció el plazo: cuenta como 10.</span>';
    } else {
      const editable = !nota && !vencida;
      if (c.tipo === 'bitacora') {
        const n = ent && ent.respuestas && ent.respuestas.r && (ent.respuestas.r.entradas || []).length;
        botones += editable ? `<button type="button" class="act-btn" onclick="Actividades.abrir(${id})">📓 Abrir mi bitácora${n ? ` (${n} entrada${n > 1 ? 's' : ''})` : ''}</button>` : `<button type="button" class="act-btn-sec" onclick="Actividades.verResultado(${id})">Ver mi bitácora</button>`;
      } else if (editable) {
        botones += `<button type="button" class="act-btn" onclick="Actividades.abrir(${id})">${ent ? 'Ver o modificar mi respuesta' : 'Responder'}</button>`;
      } else if (ent) {
        botones += `<button type="button" class="act-btn-sec" onclick="Actividades.verResultado(${id})">Ver ${nota ? 'resultado' : 'mi respuesta'}</button>`;
      } else {
        botones += `<span class="act-res-linea bad">Venció el plazo${c.calificable !== false && c.tipo !== 'encuesta' ? ': cuenta como 10' : ''}.</span>`;
      }
    }
    return `<div class="act-accion act-accion-fila">${botones}</div>`;
  },

  accionDocente(c, ctx) {
    if (c.tipo === 'material') return '';
    const A = Actividades;
    const id = Number(c.id);
    const ents = ctx.entregas.filter(e => Number(e.clase_id) === id);
    const total = c.estudiante_user ? 1 : ctx.activos.size;
    const hechas = ents.filter(e => !c.estudiante_user ? ctx.activos.has(String(e.estudiante_user)) : String(e.estudiante_user) === String(c.estudiante_user)).length;
    const porCorregir = c.tipo === 'encuesta' ? 0 : ents.filter(e => !A.tieneNota(e)).length;
    const verbo = c.tipo === 'practica' ? 'calificados' : c.tipo === 'encuesta' ? 'respondieron' : 'entregaron';
    const esPrec = this.rolGestor === 'preceptor';
    return `<div class="act-accion act-accion-fila act-docente">
      <span class="act-stat"><strong>${hechas}</strong> de ${total} ${verbo}${porCorregir ? ` · <strong class="mid">${porCorregir}</strong> para corregir` : ''}</span>
      ${esPrec ? '' : `<button type="button" class="act-btn-sec" onclick="Actividades.verRespuestas(${id})">📋 Respuestas${total - hechas > 0 ? ' y quién falta' : ''}</button>
      ${c.tipo === 'practica' ? `<button type="button" class="act-btn" onclick="Actividades.planillaTaller(${id})">🛠️ Planilla de taller</button>` : ''}
      ${c.tipo === 'encuesta' ? `<button type="button" class="act-btn-sec" onclick="Actividades.resultadosEncuesta(${id})">📊 Resultados</button>` : ''}
      ${A.AUTO.includes(c.tipo) ? `<button type="button" class="act-btn-sec" onclick="Actividades.probar(${id})">👁️ Probar</button>` : ''}`}
    </div>`;
  },

  async enviarEntregaEstudiante(claseId) {
    const inputUrl = document.getElementById(`input-entrega-${claseId}`);
    const url = inputUrl ? inputUrl.value.trim() : '';

    if (!url) {
      alert('Por favor pegá el enlace a tu trabajo práctico resuelto.');
      return;
    }
    const urlValida = this.urlSegura(url);
    if (!urlValida) {
      alert('El enlace no es válido. Tiene que empezar con http:// o https:// (por ejemplo, un link de Google Drive).');
      return;
    }

    const perfil = (window.Auth && Auth.usuarioActual)
      ? Auth.usuarioActual
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
        .maybeSingle();

      if (existe) {
        if (existe.nota !== null && existe.nota !== undefined && existe.nota !== '') {
          alert('🔒 Esta entrega ya ha sido calificada por el docente y no puede modificarse.');
          return;
        }

        const { error } = await supabase
          .from('entregas_actividades')
          .update({ url_entrega: urlValida, created_at: new Date(), updated_at: new Date() })
          .eq('id', existe.id);
        if (error) throw error;
        alert('✅ Enlace actualizado correctamente.');
      } else {
        const { error } = await supabase
          .from('entregas_actividades')
          .insert([{
            clase_id: claseId,
            estudiante_user: String(idEstudiante),
            url_entrega: urlValida
          }]);
        if (error) throw error;
        alert('✅ Trabajo entregado.');
      }

      await this.cargarListaClases(true);

    } catch (err) {
      console.error('Error al enviar entrega:', err);
      alert(/row-level security|violates/i.test(err.message || '') ? 'No se pudo entregar: venció el plazo o el trabajo ya fue calificado.' : 'Error al registrar la entrega: ' + err.message);
    }
  },

  /* ---------- Formulario de publicación ---------- */
  elegirTipo(tipo, datos = null) {
    if (!window.Actividades || !Actividades.TIPOS[tipo]) return;
    const form = document.getElementById('form-clase');
    if (!form) return;
    document.getElementById('clase-tipo').value = tipo;
    form.querySelectorAll('.act-tipo').forEach(b => {
      const sel = b.dataset.tipo === tipo;
      b.classList.toggle('sel', sel);
      b.setAttribute('aria-checked', sel ? 'true' : 'false');
    });
    const T = Actividades.TIPOS[tipo];
    document.getElementById('act-tipo-desc').innerHTML = `<strong>${T.ico} ${T.nombre}:</strong> ${T.desc}`;
    form.querySelectorAll('[data-solo]').forEach(el => { el.style.display = el.dataset.solo.split(' ').includes(tipo) ? '' : 'none'; });
    form.querySelectorAll('[data-ocultar]').forEach(el => { el.style.display = el.dataset.ocultar.split(' ').includes(tipo) ? 'none' : ''; });
    const probar = document.getElementById('btn-probar-act');
    if (probar) probar.style.display = Actividades.AUTO.includes(tipo) ? '' : 'none';
    Actividades.iniciarEditor(tipo, datos ? datos.clase : null, datos ? datos.clave : null);
  },

  nombreModuloElegido() {
    const v = document.getElementById('clase-modulo-id')?.value;
    const m = (this.modulosTrayecto || []).find(x => String(x.id) === String(v));
    return m ? m.nombre : '';
  },

  probarActividad() {
    Actividades.probarEditor({
      titulo: document.getElementById('clase-titulo')?.value.trim() || 'Vista previa',
      descripcion: document.getElementById('clase-descripcion')?.value.trim() || '',
      fecha_limite: Actividades.limiteISO(document.getElementById('clase-limite')?.value || ''),
      es_evaluacion: !!document.getElementById('clase-evaluacion')?.checked
    });
  },

  async editarClase(idClase) {
    const clase = (window.clasesGuardadasCache || []).find(c => Number(c.id) === Number(idClase));
    if (!clase) return;
    this.claseEditandoId = Number(idClase);

    let clave = null;
    if (Actividades.AUTO.includes(clase.tipo)) {
      const { data } = await supabase.from('claves_actividad').select('clave').eq('clase_id', Number(idClase)).maybeSingle();
      clave = data ? data.clave : null;
    }
    document.getElementById('clase-titulo').value = clase.titulo || '';
    document.getElementById('clase-descripcion').value = clase.descripcion || '';
    document.getElementById('clase-url-teoria').value = clase.url_recurso || '';
    document.getElementById('clase-url-actividad').value = clase.url_actividad || '';
    document.getElementById('clase-fecha').value = clase.fecha_publicacion ? String(clase.fecha_publicacion).slice(0, 10) : '';
    document.getElementById('clase-limite').value = Actividades.limiteLocal(clase.fecha_limite);
    document.getElementById('clase-evaluacion').checked = !!clase.es_evaluacion;
    if (document.getElementById('clase-modulo-id')) document.getElementById('clase-modulo-id').value = clase.modulo_id || '';
    if (document.getElementById('clase-estudiante-user')) document.getElementById('clase-estudiante-user').value = clase.estudiante_user || '';

    this.elegirTipo(clase.tipo || 'material', { clase, clave });
    // Con entregas recibidas no se cambia el tipo (las respuestas dejarían de corresponder)
    const conEntregas = (this.entregasCache || []).some(e => Number(e.clase_id) === Number(idClase));
    document.querySelectorAll('#act-tipos .act-tipo').forEach(b => { b.disabled = conEntregas && b.dataset.tipo !== clase.tipo; });
    this.edicionConEntregas = conEntregas;

    const summary = document.getElementById('summary-clase-titulo');
    if (summary) summary.innerText = `✏️ Editando: ${clase.titulo}`;
    const btnGuardar = document.getElementById('btn-guardar-clase');
    if (btnGuardar) btnGuardar.innerText = '💾 Guardar cambios';
    const btnCancelar = document.getElementById('btn-cancelar-edicion');
    if (btnCancelar) btnCancelar.style.display = 'inline-block';
    const details = document.getElementById('details-form-clase');
    if (details) { details.open = true; details.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  },

  limpiarFormulario() {
    this.claseEditandoId = null;
    this.edicionConEntregas = false;
    ['clase-titulo', 'clase-descripcion', 'clase-url-teoria', 'clase-url-actividad', 'clase-fecha', 'clase-limite', 'clase-modulo-id', 'clase-estudiante-user'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const ev = document.getElementById('clase-evaluacion');
    if (ev) ev.checked = false;
    document.querySelectorAll('#act-tipos .act-tipo').forEach(b => { b.disabled = false; });
    this.elegirTipo('material');

    const summary = document.getElementById('summary-clase-titulo');
    if (summary) summary.innerText = '➕ Nueva publicación: clase, trabajo, cuestionario…';
    const btnGuardar = document.getElementById('btn-guardar-clase');
    if (btnGuardar) btnGuardar.innerText = '💾 Publicar';
    const btnCancelar = document.getElementById('btn-cancelar-edicion');
    if (btnCancelar) btnCancelar.style.display = 'none';
  },

  async guardarClase(e) {
    if (e) e.preventDefault();
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const tipo = val('clase-tipo') || 'material';
    const titulo = val('clase-titulo');
    const urlTeoria = val('clase-url-teoria');
    const urlActividad = val('clase-url-actividad');
    const fecha = val('clase-fecha');
    const limiteLocal = val('clase-limite');

    if (!titulo) return alert('Escribí un título.');
    if (urlTeoria && !this.urlSegura(urlTeoria)) return alert('El enlace del material no es válido. Tiene que empezar con http:// o https://');
    if (urlActividad && !this.urlSegura(urlActividad)) return alert('El enlace de la consigna no es válido. Tiene que empezar con http:// o https://');
    const problema = Actividades.validar(Actividades.ed);
    if (problema) return alert('Falta completar: ' + problema);

    const conLimite = !['material', 'practica'].includes(tipo);
    const limite = conLimite ? Actividades.limiteISO(limiteLocal) : null;
    if (limite && fecha && limiteLocal.slice(0, 10) < fecha) return alert('La fecha límite es anterior a la fecha de publicación.');
    if (limite && !this.claseEditandoId && new Date(limite).getTime() < Date.now() && !confirm('La fecha límite ya pasó: los alumnos no van a poder responder. ¿Guardar igual?')) return;

    const sep = Actividades.separar(Actividades.ed);
    const objetoDatos = {
      trayecto_id: Number(this.trayectoActualId),
      titulo,
      descripcion: val('clase-descripcion') || null,
      url_recurso: urlTeoria || null,
      url_actividad: ['tp', 'practica'].includes(tipo) && urlActividad ? this.urlSegura(urlActividad) : null,
      modulo_id: val('clase-modulo-id') ? Number(val('clase-modulo-id')) : null,
      estudiante_user: val('clase-estudiante-user') || null,
      tipo,
      contenido: sep.contenido,
      fecha_publicacion: fecha || null,
      fecha_limite: limite,
      es_evaluacion: !['material', 'encuesta'].includes(tipo) && !!document.getElementById('clase-evaluacion')?.checked,
      calificable: sep.calificable
    };

    const btn = document.getElementById('btn-guardar-clase');
    if (btn) btn.disabled = true;
    try {
      let id = this.claseEditandoId;
      if (id) {
        const { error } = await supabase.from('clases').update(objetoDatos).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('clases').insert([objetoDatos]).select('id').single();
        if (error) throw error;
        id = data && data.id;
      }
      if (Actividades.AUTO.includes(tipo) && id) {
        const { error: eK } = await supabase.from('claves_actividad').upsert({ clase_id: Number(id), clave: sep.clave || {}, updated_at: new Date().toISOString() }, { onConflict: 'clase_id' });
        if (eK) throw new Error('La actividad se guardó, pero no las respuestas correctas: ' + eK.message);
      }
      const avisoNotas = this.claseEditandoId && this.edicionConEntregas && Actividades.AUTO.includes(tipo)
        ? ' Las notas que ya tenían los alumnos no se recalculan.' : '';
      if (typeof Swal !== 'undefined') Swal.fire({ icon: 'success', title: this.claseEditandoId ? 'Publicación actualizada' : 'Publicación guardada', text: (fecha && fecha > Actividades.hoyISO() ? `Los alumnos la van a ver desde el ${Actividades.fechaDMY(fecha)}.` : '') + avisoNotas, timer: avisoNotas ? undefined : 2200, showConfirmButton: !!avisoNotas });
      this.limpiarFormulario();
      const det = document.getElementById('details-form-clase');
      if (det) det.open = false;
      await this.cargarListaClases(false);
    } catch (err) {
      console.error('Error al guardar:', err);
      const falta = /tipo|contenido|fecha_limite|url_actividad|calificable|claves_actividad|schema cache/i.test(err.message || '');
      alert('Error al guardar: ' + (err.message || err) + (falta ? '\n\nFalta ejecutar sql/11_clases_y_actividades.sql en Supabase.' : ''));
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async eliminarClase(idClase) {
    const n = (this.entregasCache || []).filter(e => Number(e.clase_id) === Number(idClase)).length;
    const msg = n
      ? `Esta publicación tiene ${n} entrega(s) o nota(s) de alumnos que también se van a borrar y dejarán de contar en el promedio. ¿Eliminar igual?`
      : '¿Querés eliminar esta publicación?';
    if (!confirm(msg)) return;
    try {
      const { error } = await supabase.from('clases').delete().eq('id', idClase);
      if (error) throw error;
      await this.cargarListaClases(false);
    } catch (err) {
      console.error('Error al eliminar:', err);
      alert('Error al eliminar: ' + err.message + (/foreign key|violates/i.test(err.message || '') ? '\n\nTiene entregas asociadas: borralas primero desde Entregas y Calificaciones.' : ''));
    }
  },

  async cargarSabanaEstudiantes() {
    const contenedor = document.getElementById('contenedor-lista-alumnos');
    if (!contenedor) return;

    try {
      const { data: inscripciones, error: errIns } = await supabase
        .from('inscripciones')
        .select('*')
        .eq('trayecto_id', Number(this.trayectoActualId));

      if (errIns) throw errIns;

      if (!inscripciones || inscripciones.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:1.5rem;">No hay estudiantes inscriptos en este trayecto.</p>';
        return;
      }

      const listaUsers = inscripciones.map(i => i.estudiante_user);

      let { data: alumnos } = await supabase
        .from('usuarios')
        .select('*')
        .in('usuario', listaUsers)
        .order('apellido', { ascending: true });

      if (alumnos && alumnos.length > 0) {
        alumnos.sort((a, b) => {
          const apA = (a.apellido || '').toUpperCase().trim();
          const apB = (b.apellido || '').toUpperCase().trim();
          if (apA !== apB) return apA.localeCompare(apB);
          return (a.nombre || '').toUpperCase().trim().localeCompare((b.nombre || '').toUpperCase().trim());
        });
      }

      const { data: modulos } = await supabase
        .from('modulos')
        .select('*')
        .eq('trayecto_id', Number(this.trayectoActualId))
        .order('id', { ascending: true });

      const { data: clases } = await ReglasFP.selectClases('id, modulo_id', q => q.eq('trayecto_id', Number(this.trayectoActualId)));

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

      const [rAcred, rTray] = await Promise.all([
        supabase.from('modulos_acreditados').select('*').eq('trayecto_id', Number(this.trayectoActualId)),
        supabase.from('trayectos').select('*').eq('id', Number(this.trayectoActualId)).maybeSingle()
      ]);
      const acreditados = (!rAcred.error && rAcred.data) || [];
      const computa = ReglasFP.computaAsistencia(rTray.data);
      this.sabanaModulos = modulos || [];   // para el modal de Equivalencias

      const tieneModulos = modulos && modulos.length > 0;

      let thModulosHTML = '';
      if (tieneModulos) {
        thModulosHTML = modulos.map(m => `<th style="padding:0.75rem; text-align:center;">${this.esc(m.nombre)}</th>`).join('');
      } else {
        thModulosHTML = `<th style="padding:0.75rem; text-align:center;">Promedio General</th>`;
      }

      let filasHTML = '';
      (alumnos || []).forEach((u, i) => {
        const apStr = (u.apellido || '').toUpperCase().trim();
        const nomStr = u.nombre ? (u.nombre.charAt(0).toUpperCase() + u.nombre.slice(1).toLowerCase()) : '';
        const nombreCompleto = apStr && nomStr ? `${apStr}, ${nomStr}` : (apStr || nomStr || 'Sin Nombre');
        
        const userKey = String(u.usuario || u.dni || u.id);

        // Regla única de FP (js/reglas.js): actividades + asistencia, equivalencias, 70 para aprobar
        const ev = ReglasFP.evaluar({
          key: userKey, modulos: modulos || [], clases: clases || [], entregas, asistencias: asistencias || [],
          acreditados, computaAsistencia: computa,
          excepcion: (excepciones || []).some(x => String(x.estudiante_user) === userKey && x.habilitado)
        });
        let celdasNotasHTML = '';
        ev.modulos.forEach(m => {
          if (m.equivalencia) {
            celdasNotasHTML += `<td style="padding:0.75rem; text-align:center;"><span class="sabana-nota eq" title="${this.esc(m.motivoEquivalencia)}">EQ</span><span class="sabana-det">Equivalencia</span></td>`;
            return;
          }
          if (m.bloqueado) {
            celdasNotasHTML += `<td style="padding:0.75rem; text-align:center;"><span class="sabana-nota bloq" title="El módulo anterior no está aprobado">🔒</span><span class="sabana-det">No habilitado</span></td>`;
            return;
          }
          if (m.nota === null) {
            celdasNotasHTML += `<td style="padding:0.75rem; text-align:center; color:#64748b; font-size:0.8rem;">S/D</td>`;
            return;
          }
          const det = [m.promAct !== null ? `Act: ${m.promAct}` : 'Sin act.', computa ? (m.pctAsis !== null ? `Asis: ${m.pctAsis}%` : 'Sin asis.') : null, m.sinEntregar ? `${m.sinEntregar} sin entregar (10)` : null].filter(Boolean).join(' | ');
          celdasNotasHTML += `<td style="padding:0.75rem; text-align:center;"><span class="sabana-nota ${m.aprobado ? 'ok' : 'bad'}">${m.nota}</span><span class="sabana-det">${det}</span></td>`;
        });

        const exEspecial = (excepciones || []).find(x => String(x.estudiante_user) === userKey && x.habilitado);
        const insRow = (inscripciones || []).find(x => String(x.estudiante_user) === userKey) || {};
        const cursada = ReglasFP.estadoCursada(ev, modulos || [], insRow, { excepcion: !!exEspecial });
        const dniSeguro = String(userKey).replace(/[^0-9A-Za-z_-]/g, '');
        const rolG = this.rolGestor || '';
        const esAdminG = Auth.esDireccion(rolG);
        // Baja manual: la dirección en cualquier trayecto; docente y preceptor en trayectos sin módulos
        const puedeBaja = esAdminG || (!tieneModulos && (rolG === 'docente' || rolG === 'preceptor'));
        // Reincorporar: administración, regencia y preceptoría (en cualquier trayecto)
        const puedeReinc = esAdminG || rolG === 'preceptor';
        // Fecha de inscripción (cuenta para la planilla de matrícula) y equivalencias por módulos previos aprobados
        const puedeGestionInsc = esAdminG || rolG === 'preceptor';
        let situacionHTML = '<span class="sit sit-ok">Cursando</span>';
        if (cursada.baja && cursada.guardada) {
          situacionHTML = `<span class="sit sit-baja">${cursada.tipo === 'automatica' ? 'Baja automática' : 'Baja'}${cursada.fecha ? ' · ' + this.esc(String(cursada.fecha).split('-').reverse().join('/')) : ''}</span><span class="sabana-det">${this.esc(cursada.motivo)}</span>
            ${puedeReinc ? `<button type="button" class="sit-btn" onclick="ClasesModulo.reincorporar('${dniSeguro}')">Reincorporar</button>` : ''}`;
        } else if (cursada.baja) {
          situacionHTML = `<span class="sit sit-baja">Baja automática</span><span class="sabana-det">${this.esc(cursada.motivo)}</span>`;
        } else if (puedeBaja) {
          situacionHTML += `<button type="button" class="sit-btn" onclick="ClasesModulo.darBaja('${dniSeguro}')">Dar de baja</button>`;
        }

        filasHTML += `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05);" class="${cursada.baja ? 'fila-baja' : ''}">
            <td style="padding:0.75rem 1rem; color:#94a3b8;">${i + 1}</td>
            <td style="padding:0.75rem 1rem; font-weight:600; color:#f8fafc;">
              <button type="button" class="seg-nombre" title="Ver ficha del alumno" onclick="FichaAlumno.abrir('${dniSeguro}')">${this.esc(nombreCompleto)}</button>
              <span style="display:block; font-size:0.75rem; color:#94a3b8;">DNI: ${this.esc(userKey)}</span>
              ${puedeGestionInsc ? `<span style="display:block; font-size:0.72rem; color:#94a3b8; margin-top:0.15rem;">Insc.: ${insRow.fecha_inscripcion ? this.esc(String(insRow.fecha_inscripcion).split('-').reverse().join('/')) : 's/d'}
                <button type="button" class="sit-btn" style="margin-left:0.3rem;" onclick="ClasesModulo.editarFechaInscripcion('${dniSeguro}', '${this.esc(insRow.fecha_inscripcion || '')}')">Corregir</button></span>
                ${tieneModulos ? `<button type="button" class="sit-btn" style="margin-top:0.2rem;" onclick="ClasesModulo.editarEquivalencias('${dniSeguro}')">Módulos previos aprobados</button>` : ''}` : ''}
            </td>
            ${celdasNotasHTML}
            <td style="padding:0.75rem 1rem; text-align:center;">${situacionHTML}</td>
            <td style="padding:0.75rem 1rem; text-align:center;">
              ${rolG === 'preceptor'
                ? `<span class="sabana-det">${exEspecial ? '🔓 Activa' : '🔒 Inactiva'}</span>`
                : `<button type="button" onclick="ClasesModulo.toggleExcepcionEstudiante('${dniSeguro}', ${exEspecial ? 'false' : 'true'})" style="padding:0.3rem 0.6rem; border-radius:6px; border:none; font-size:0.75rem; font-weight:600; cursor:pointer; ${exEspecial ? 'background:#eab308; color:#000;' : 'background:rgba(255,255,255,0.08); color:#cbd5e1;'}">
                ${exEspecial ? '🔓 Excepción Activa' : '🔒 Excepción Inactiva'}
              </button>`}
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
                <th style="padding:0.75rem 1rem; text-align:center;">Situación</th>
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

  /* ---------- Bajas manuales ---------- */
  async darBaja(dni) {
    if (typeof Swal === 'undefined') return;
    const hoy = ReglasFP.hoyISO();
    const r = await Swal.fire({
      title: 'Dar de baja en este trayecto',
      html: `<p style="margin:0 0 .75rem">DNI ${this.esc(dni)} — deja de figurar en la toma de asistencia. Se puede reincorporar después.</p>
        <label class="eq-label" for="baja-motivo">Motivo</label>
        <select id="baja-motivo" class="swal2-select" style="width:100%;margin:.35rem 0 0">
          <option>Abandono / dejó de asistir</option><option>Superó el límite de inasistencias</option>
          <option>Cambio de trayecto o de turno</option><option>Razones de salud</option><option>Razones laborales</option><option>Otro</option>
        </select>
        <input id="baja-detalle" class="swal2-input eq-motivo" maxlength="200" placeholder="Detalle (opcional)">
        <label class="eq-label" for="baja-fecha">Fecha de la baja</label>
        <input id="baja-fecha" type="date" class="swal2-input eq-motivo" value="${hoy}" max="${hoy}">`,
      showCancelButton: true, confirmButtonText: 'Dar de baja', cancelButtonText: 'Cancelar', focusConfirm: false,
      preConfirm: () => ({
        motivo: [document.getElementById('baja-motivo').value, document.getElementById('baja-detalle').value.trim()].filter(Boolean).join(': '),
        fecha: document.getElementById('baja-fecha').value || hoy
      })
    });
    if (!r.isConfirmed) return;
    await this.actualizarInscripcion(dni, { estado: 'BAJA', motivo_baja: r.value.motivo, fecha_baja: r.value.fecha, baja_tipo: 'manual', reincorporado: false });
  },

  async reincorporar(dni) {
    // Pide la fundamentación escrita (queda registrada con fecha y autor)
    const ok = window.SeguimientoModulo ? await SeguimientoModulo.reincorporar(this.trayectoActualId, dni, '') : false;
    if (ok) await this.cargarSabanaEstudiantes();
  },

  ROMANOS: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'],

  /* Corrige la fecha de inscripción (la usa la planilla de matrícula por mes).
     Útil después de una carga masiva por CSV, que pone siempre la fecha del día de la carga. */
  async editarFechaInscripcion(dni, fechaActual) {
    if (typeof Swal === 'undefined') return;
    const r = await Swal.fire({
      title: 'Fecha de inscripción', icon: 'question', width: 460,
      html: `<p style="font-size:.85rem;text-align:left">DNI ${this.esc(dni)}. Es la fecha desde la que cuenta como inscripto en la planilla de matrícula por mes (no afecta los módulos ya acreditados).</p>`,
      input: 'date', inputValue: fechaActual || '', showCancelButton: true,
      confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar',
      inputValidator: (v) => !v ? 'Elegí una fecha.' : null
    });
    if (!r.isConfirmed) return;
    try {
      const { error } = await supabase.from('inscripciones').update({ fecha_inscripcion: r.value })
        .eq('trayecto_id', Number(this.trayectoActualId)).eq('estudiante_user', String(dni));
      if (error) throw error;
      if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Fecha corregida', showConfirmButton: false, timer: 2000 });
      await this.cargarSabanaEstudiantes();
    } catch (err) {
      alert('No se pudo corregir la fecha: ' + (err.message || ''));
    }
  },

  /* Módulos previos aprobados (acreditados por equivalencia): administración, regencia y preceptoría */
  async editarEquivalencias(dni) {
    if (typeof Swal === 'undefined') return;
    const tid = Number(this.trayectoActualId);
    const modulos = this.sabanaModulos || [];
    if (!modulos.length) return;
    const { data: actualesData, error: errAc } = await supabase.from('modulos_acreditados')
      .select('*').eq('trayecto_id', tid).eq('estudiante_user', dni);
    if (errAc) { alert('No se pudieron leer las equivalencias: ' + errAc.message); return; }
    const actuales = actualesData || [];
    const motivo = (actuales[0] && actuales[0].motivo) || '';
    const r = await Swal.fire({
      title: 'Módulos previos aprobados (equivalencia)',
      html: `<p class="eq-alumno">DNI ${this.esc(dni)}</p>
        <div class="eq-lista">${modulos.map((m, i) => `<label class="eq-item"><input type="checkbox" class="eq-chk" value="${Number(m.id)}" ${actuales.some(x => Number(x.modulo_id) === Number(m.id)) ? 'checked' : ''}> Módulo ${this.ROMANOS[i] || i + 1} · ${this.esc(m.nombre)}</label>`).join('')}</div>
        <label for="eq-motivo" class="eq-label">Motivo / respaldo</label>
        <input id="eq-motivo" class="swal2-input eq-motivo" maxlength="300" placeholder="Ej: ya cursó y aprobó este módulo en el ciclo anterior" value="${this.esc(motivo)}">`,
      showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', focusConfirm: false,
      preConfirm: () => ({
        ids: [...document.querySelectorAll('.eq-chk:checked')].map(c => Number(c.value)),
        motivo: document.getElementById('eq-motivo').value.trim()
      })
    });
    if (!r.isConfirmed) return;
    const { ids, motivo: mot } = r.value;
    if (ids.length && !mot) { alert('⚠️ Indicá el motivo (queda registrado).'); return; }
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
      if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Equivalencias actualizadas', showConfirmButton: false, timer: 2000 });
      await this.cargarSabanaEstudiantes();
    } catch (err) {
      alert('No se pudieron guardar las equivalencias: ' + (err.message || '') + (/modulos_acreditados/.test(err.message || '') ? '\n\nFalta ejecutar sql/31_equivalencias_y_fecha_insc_preceptor.sql en Supabase.' : ''));
    }
  },

  async actualizarInscripcion(dni, cambios) {
    try {
      const perfil = window.Auth && Auth.usuarioActual;
      const datos = { ...cambios, baja_por: cambios.estado === 'BAJA' && perfil ? perfil.id : null };
      const { error } = await supabase.from('inscripciones').update(datos)
        .eq('trayecto_id', Number(this.trayectoActualId)).eq('estudiante_user', String(dni));
      if (error) throw error;
      if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: cambios.estado === 'BAJA' ? 'Baja registrada' : 'Estudiante reincorporado', showConfirmButton: false, timer: 2000 });
      await this.cargarSabanaEstudiantes();
    } catch (err) {
      alert('No se pudo actualizar la inscripción: ' + (err.message || '') + (/estado|motivo_baja|fecha_baja/.test(err.message || '') ? '\n\nFalta ejecutar sql/09_preceptores_ficha_observaciones.sql en Supabase.' : /baja_tipo|reincorporado/.test(err.message || '') ? '\n\nFalta ejecutar sql/19_bajas_guardadas.sql en Supabase.' : ''));
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

  async cargarPanelGeneralEntregas(filtro) {
    const contenedor = document.getElementById('contenedor-todas-entregas');
    if (!contenedor) return;
    if (filtro) this.filtroEntregas = filtro;
    const f = this.filtroEntregas || 'corregir';

    try {
      const { data: clasesRaw } = await supabase.from('clases').select('*').eq('trayecto_id', Number(this.trayectoActualId));
      const clases = (clasesRaw || []).map(c => this.normalizarClase(c)).filter(c => c.calificable !== false && !['material', 'encuesta'].includes(c.tipo));
      if (!clases.length) {
        contenedor.innerHTML = '<p class="act-vacio">No hay actividades con nota publicadas todavía.</p>';
        return;
      }
      const { data: modulos } = await supabase.from('modulos').select('id, nombre').eq('trayecto_id', Number(this.trayectoActualId));
      const { data: entregas, error } = await supabase.from('entregas_actividades').select('*').in('clase_id', clases.map(c => c.id)).order('id', { ascending: false });
      if (error) throw error;
      const todas = entregas || [];
      const pendientes = todas.filter(e => !Actividades.tieneNota(e));
      const lista = f === 'corregir' ? pendientes : todas;

      let alumnos = [];
      if (lista.length) {
        const { data } = await supabase.from('usuarios').select('usuario, nombre, apellido').in('usuario', [...new Set(lista.map(e => e.estudiante_user))]);
        alumnos = data || [];
      }

      let html = `<div class="act-filtro">
        <button type="button" class="${f === 'corregir' ? 'sel' : ''}" onclick="ClasesModulo.cargarPanelGeneralEntregas('corregir')">Para corregir (${pendientes.length})</button>
        <button type="button" class="${f === 'todas' ? 'sel' : ''}" onclick="ClasesModulo.cargarPanelGeneralEntregas('todas')">Todas (${todas.length})</button>
        <span class="act-ayuda">Las prácticas de taller se califican desde su tarjeta, con la planilla del grupo.</span>
      </div>`;
      if (!lista.length) {
        contenedor.innerHTML = html + `<p class="act-vacio">${f === 'corregir' ? '¡Nada para corregir! 🎉' : 'Todavía no hay entregas.'}</p>`;
        return;
      }

      html += lista.map(ent => {
        const c = clases.find(x => Number(x.id) === Number(ent.clase_id)) || {};
        const T = Actividades.TIPOS[c.tipo] || {};
        const mod = (modulos || []).find(m => Number(m.id) === Number(c.modulo_id));
        const alu = alumnos.find(a => String(a.usuario) === String(ent.estudiante_user));
        const nombre = Actividades.nombreAlumno(alu, ent.estudiante_user);
        const tiene = Actividades.tieneNota(ent);
        const n = parseFloat(ent.nota);
        const estado = tiene ? `<span class="act-chip ${n >= 70 ? 'ok' : 'bad'}">Nota ${this.esc(ent.nota)}</span>` : '<span class="act-chip mid">Para corregir</span>';
        const dniSeg = String(ent.estudiante_user).replace(/[^0-9A-Za-z_-]/g, '');
        const rapido = c.tipo === 'tp' && !(c.contenido && (c.contenido.cotejo || []).length);
        const link = this.urlSegura(ent.url_entrega);
        return `<div class="act-ent">
          <div class="act-ent-cab">
            <div><div class="act-chips"><span class="act-chip tipo">${T.ico || ''} ${this.esc(T.nombre || c.tipo || '')}</span>${mod ? `<span class="act-chip">📘 ${this.esc(mod.nombre)}</span>` : ''}${estado}</div>
              <strong>${this.esc(c.titulo || 'Actividad ' + ent.clase_id)}</strong> · ${this.esc(nombre)}</div>
            <div class="act-accion-fila">
              ${link ? `<a class="act-btn-sec" href="${this.esc(link)}" target="_blank" rel="noopener noreferrer">🔗 Ver trabajo</a>` : ''}
              ${rapido ? '' : `<button type="button" class="act-btn" onclick="Actividades.verEntrega(${Number(c.id)}, '${dniSeg}')">${tiene ? 'Ver' : 'Ver y corregir'}</button>`}
            </div>
          </div>
          ${rapido ? `<div class="act-ent-rapido">
            <label>Nota (0-100)<input type="number" min="0" max="100" class="act-in act-num" id="nota-panel-${ent.id}" value="${this.esc(ent.nota || '')}"></label>
            <label class="act-crece">Devolución<input type="text" class="act-in" id="coment-panel-${ent.id}" maxlength="1000" value="${this.esc(ent.comentario_docente || '')}" placeholder="Comentario para el alumno"></label>
            <button type="button" class="act-btn" onclick="ClasesModulo.guardarCalificacionDesdePanel(${ent.id})">💾 Guardar</button>
          </div>` : ''}
        </div>`;
      }).join('');
      contenedor.innerHTML = html;
    } catch (err) {
      console.error('Error al cargar panel de entregas:', err);
      contenedor.innerHTML = '<p style="color:#f87171; text-align:center;">Error al cargar el listado de entregas.</p>';
    }
  },

  async guardarCalificacionDesdePanel(entregaId) {
    const notaVal = document.getElementById(`nota-panel-${entregaId}`)?.value.trim();
    const comentVal = document.getElementById(`coment-panel-${entregaId}`)?.value.trim();
    if (notaVal && (isNaN(Number(notaVal)) || Number(notaVal) < 0 || Number(notaVal) > 100)) {
      alert('La nota tiene que ser un número de 0 a 100.');
      return;
    }

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
          nota: notaVal ? String(Math.round(Number(notaVal))) : null,
          comentario_docente: comentVal || null
        })
        .eq('id', entregaId);

      if (error) throw error;

      const tituloClase = entrega.clases ? entrega.clases.titulo : 'una actividad';
      const numNota = parseFloat(notaVal);
      let estadoTxt = 'evaluado';
      
      if (!isNaN(numNota)) {
        estadoTxt = numNota >= 70 ? `calificado con ${Math.round(numNota)} (aprobado) ✅` : `calificado con ${Math.round(numNota)} (no alcanza 70) ⚠️`;
      }

      await supabase.from('notificaciones').insert([{
        estudiante_user: String(entrega.estudiante_user),
        trayecto_id: Number(this.trayectoActualId),
        clase_id: Number(entrega.clase_id),
        titulo: `Novedad en ${tituloClase}`,
        mensaje: `Tu trabajo fue ${estadoTxt}.${comentVal ? ` Observación: "${comentVal}"` : ''}`
      }]);

      if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Calificación guardada', showConfirmButton: false, timer: 2000 });
      await this.cargarPanelGeneralEntregas();

    } catch (err) {
      console.error('Error al calificar:', err);
      alert('Error al guardar la calificación: ' + err.message);
    }
  },

  // LLAMADA DIRECTA Y CORRECTA AL IMPORTADOR DEDICADO
  async importarEstudiantesCSV(archivoCSV) {
    if (!archivoCSV) return;

    if (window.ImportadorModulo && typeof window.ImportadorModulo.procesarCSV === 'function') {
      window.ImportadorModulo.trayectoIdActual = this.trayectoActualId;
      await window.ImportadorModulo.procesarCSV(archivoCSV);
    } else {
      alert('⚠️ Error: El módulo importador.js no está cargado correctamente.');
    }
  },

  cerrarGestor() {
    const modal = document.getElementById('modal-gestor-clases');
    if (modal) modal.style.display = 'none';
  }
};

window.ClasesModulo = ClasesModulo;
