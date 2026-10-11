const ClasesModulo = {
  trayectoActualId: null,
  tipoActual: 'clase', // 'clase' o 'actividad'

  async abrirGestor(trayectoId, nombreTrayecto) {
    this.trayectoActualId = trayectoId
    this.tipoActual = 'clase'
    
    // Crear el modal dinámicamente si no existe en el DOM
    let modal = document.getElementById('modal-gestor-clases')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'modal-gestor-clases'
      modal.className = 'modal'
      modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center; padding:1rem;'
      document.body.appendChild(modal)
    }

    modal.innerHTML = `
      <div style="background:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:12px; width:100%; max-width:800px; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; color:#f8fafc;">
        <div style="padding:1.2rem 1.5rem; background:#0f172a; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:1.2rem;">📚 Clases y Actividades: <span style="color:#38bdf8;">${nombreTrayecto}</span></h3>
          <button onclick="ClasesModulo.cerrarGestor()" style="background:none; border:none; color:#94a3b8; font-size:1.5rem; cursor:pointer;">&times;</button>
        </div>

        <div style="padding:1.5rem; overflow-y:auto; flex:1;">
          
          <!-- Pestañas de Selección: Clase Teórica vs Actividad / TP -->
          <div style="display:flex; gap:0.5rem; margin-bottom:1rem; background:rgba(0,0,0,0.3); padding:0.3rem; border-radius:8px;">
            <button id="btn-tab-clase" type="button" onclick="ClasesModulo.cambiarPestana('clase')" style="flex:1; padding:0.6rem; border:none; border-radius:6px; background:#0284c7; color:#fff; font-weight:600; cursor:pointer;">
              📚 Clase Teórica / Recurso
            </button>
            <button id="btn-tab-actividad" type="button" onclick="ClasesModulo.cambiarPestana('actividad')" style="flex:1; padding:0.6rem; border:none; border-radius:6px; background:transparent; color:#94a3b8; font-weight:600; cursor:pointer;">
              📝 Actividad / Trabajo Práctico
            </button>
          </div>

          <!-- Formulario para Nueva Publicación -->
          <details open style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:1rem; margin-bottom:1.5rem;">
            <summary id="summary-form-titulo" style="cursor:pointer; font-weight:600; color:#38bdf8;">➕ Cargar Nueva Clase Teórica</summary>
            
            <form onsubmit="ClasesModulo.guardarClase(event)" style="margin-top:1rem; display:flex; flex-direction:column; gap:0.8rem;">
              <div>
                <label id="lbl-clase-titulo" style="display:block; font-size:0.82rem; color:#cbd5e1; margin-bottom:0.3rem;">Título de la Clase *</label>
                <input type="text" id="clase-titulo" placeholder="Ej: Clase 1: HTML Básico" required class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;">
              </div>

              <div>
                <label id="lbl-clase-desc" style="display:block; font-size:0.82rem; color:#cbd5e1; margin-bottom:0.3rem;">Descripción breve o resumen</label>
                <textarea id="clase-descripcion" placeholder="Descripción de la clase o instrucciones..." rows="2" class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;"></textarea>
              </div>

              <div>
                <label style="display:block; font-size:0.82rem; color:#cbd5e1; margin-bottom:0.3rem;">Link al recurso (Google Drive, YouTube, etc.)</label>
                <input type="url" id="clase-url" placeholder="https://drive.google.com/..." class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;">
              </div>

              <!-- Campo exclusivo para Actividades -->
              <div id="contenedor-fecha-limite" style="display:none;">
                <label style="display:block; font-size:0.82rem; color:#facc15; margin-bottom:0.3rem;">📅 Fecha Límite de Entrega</label>
                <input type="date" id="clase-fecha-limite" class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;">
              </div>

              <button type="submit" id="btn-submit-clase" class="btn btn-gold" style="align-self:flex-end; padding:0.5rem 1.2rem; background:#0284c7; color:#fff; border:none; border-radius:6px; cursor:pointer;">
                Guardar Clase
              </button>
            </form>
          </details>

          <!-- Listado de Clases y Actividades Cargadas -->
          <div id="lista-clases-cargadas">
            <p style="color:#94a3b8; text-align:center;">Cargando contenidos...</p>
          </div>
        </div>
      </div>
    `

    modal.style.display = 'flex'
    await this.cargarListaClases()
  },

  cambiarPestana(tipo) {
    this.tipoActual = tipo
    const btnClase = document.getElementById('btn-tab-clase')
    const btnActidad = document.getElementById('btn-tab-actividad')
    const summaryTitulo = document.getElementById('summary-form-titulo')
    const lblTitulo = document.getElementById('lbl-clase-titulo')
    const lblDesc = document.getElementById('lbl-clase-desc')
    const inputTitulo = document.getElementById('clase-titulo')
    const inputDesc = document.getElementById('clase-descripcion')
    const contenedorFecha = document.getElementById('contenedor-fecha-limite')
    const btnSubmit = document.getElementById('btn-submit-clase')

    if (tipo === 'actividad') {
      btnActidad.style.background = '#eab308'
      btnActidad.style.color = '#000'
      btnClase.style.background = 'transparent'
      btnClase.style.color = '#94a3b8'

      if (summaryTitulo) summaryTitulo.innerText = '➕ Cargar Nueva Actividad / TP'
      if (lblTitulo) lblTitulo.innerText = 'Título de la Actividad / TP *'
      if (lblDesc) lblDesc.innerText = 'Consigna o pautas de trabajo'
      if (inputTitulo) inputTitulo.placeholder = 'Ej: TP N° 1: Elaboración de masa'
      if (inputDesc) inputDesc.placeholder = 'Escribí detalladamente la consigna...'
      if (contenedorFecha) contenedorFecha.style.display = 'block'
      if (btnSubmit) {
        btnSubmit.innerText = 'Guardar Actividad'
        btnSubmit.style.background = '#eab308'
        btnSubmit.style.color = '#000'
      }
    } else {
      btnClase.style.background = '#0284c7'
      btnClase.style.color = '#fff'
      btnActidad.style.background = 'transparent'
      btnActidad.style.color = '#94a3b8'

      if (summaryTitulo) summaryTitulo.innerText = '➕ Cargar Nueva Clase Teórica'
      if (lblTitulo) lblTitulo.innerText = 'Título de la Clase *'
      if (lblDesc) lblDesc.innerText = 'Descripción breve o resumen'
      if (inputTitulo) inputTitulo.placeholder = 'Ej: Clase 1: HTML Básico'
      if (inputDesc) inputDesc.placeholder = 'Descripción breve o consigna...'
      if (contenedorFecha) contenedorFecha.style.display = 'none'
      if (btnSubmit) {
        btnSubmit.innerText = 'Guardar Clase'
        btnSubmit.style.background = '#0284c7'
        btnSubmit.style.color = '#fff'
      }
    }
  },

  cerrarGestor() {
    const modal = document.getElementById('modal-gestor-clases')
    if (modal) modal.style.display = 'none'
  },

  async cargarListaClases() {
    const contenedor = document.getElementById('lista-clases-cargadas')
    if (!contenedor) return

    try {
      const { data: clases, error } = await supabase
        .from('clases')
        .select('*')
        .eq('trayecto_id', this.trayectoActualId)
        .order('id', { ascending: false })

      if (error) throw error

      if (!clases || clases.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:1rem;">Aún no se han publicado contenidos para este trayecto.</p>'
        return
      }

      contenedor.innerHTML = clases.map((c) => {
        const esActividad = c.tipo === 'actividad'
        const badge = esActividad 
          ? '<span style="background:rgba(234,179,8,0.2); color:#facc15; border:1px solid rgba(234,179,8,0.4); padding:0.15rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600;">📝 Actividad / TP</span>'
          : '<span style="background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); padding:0.15rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600;">📚 Clase Teórica</span>'

        return `
          <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:1rem; margin-bottom:0.8rem; display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
                ${badge}
                <h4 style="margin:0; color:#f8fafc; font-size:0.95rem;">${c.titulo}</h4>
              </div>
              <p style="margin:0 0 0.4rem 0; color:#cbd5e1; font-size:0.85rem;">${c.descripcion || 'Sin descripción'}</p>
              ${c.fecha_limite ? `<p style="margin:0 0 0.4rem 0; color:#facc15; font-size:0.8rem;">📅 Fecha Límite: <strong>${c.fecha_limite}</strong></p>` : ''}
              ${c.url_recurso ? `<a href="${c.url_recurso}" target="_blank" style="color:#38bdf8; font-size:0.82rem; text-decoration:none;">🔗 Ver Recurso Adjunto</a>` : ''}
            </div>
            <button onclick="ClasesModulo.eliminarClase(${c.id})" style="background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#f87171; border-radius:6px; padding:0.3rem 0.6rem; cursor:pointer; font-size:0.8rem;">🗑️</button>
          </div>
        `
      }).join('')

    } catch (err) {
      console.error('Error al cargar clases:', err)
      contenedor.innerHTML = '<p style="color:#f87171; text-align:center;">Error al cargar los contenidos.</p>'
    }
  },

  async guardarClase(e) {
    if (e) e.preventDefault()

    const titulo = document.getElementById('clase-titulo')?.value.trim()
    const descripcion = document.getElementById('clase-descripcion')?.value.trim()
    const url = document.getElementById('clase-url')?.value.trim()
    const fechaLimite = document.getElementById('clase-fecha-limite')?.value

    if (!titulo) {
      alert('Por favor ingresá al menos el título.')
      return
    }

    try {
      const datosGuardar = {
        trayecto_id: Number(this.trayectoActualId),
        titulo: titulo,
        descripcion: descripcion || null,
        url_recurso: url || null,
        tipo: this.tipoActual
      }

      if (this.tipoActual === 'actividad' && fechaLimite) {
        datosGuardar.fecha_limite = fechaLimite
      }

      const { error } = await supabase
        .from('clases')
        .insert([datosGuardar])

      if (error) throw error

      alert(`✅ ${this.tipoActual === 'actividad' ? 'Actividad' : 'Clase'} publicada correctamente.`)
      document.getElementById('clase-titulo').value = ''
      document.getElementById('clase-descripcion').value = ''
      document.getElementById('clase-url').value = ''
      if (document.getElementById('clase-fecha-limite')) {
        document.getElementById('clase-fecha-limite').value = ''
      }
      
      await this.cargarListaClases()

    } catch (err) {
      console.error('Error al guardar:', err)
      alert('Error al guardar: ' + err.message)
    }
  },

  async eliminarClase(idClase) {
    if (!confirm('¿Querés eliminar esta publicación?')) return

    try {
      const { error } = await supabase
        .from('clases')
        .delete()
        .eq('id', idClase)

      if (error) throw error
      await this.cargarListaClases()
    } catch (err) {
      console.error('Error al eliminar:', err)
      alert('Error al eliminar: ' + err.message)
    }
  }
}

window.ClasesModulo = ClasesModulo
