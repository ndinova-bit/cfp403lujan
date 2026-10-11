const ClasesModulo = {
  trayectoActualId: null,

  // Convierte URLs de texto plano en botones o links cliqueables automáticamente
  convertirLinks(texto) {
    if (!texto) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return texto.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-block; margin-top:0.3rem; color:#facc15; font-weight:600; text-decoration:underline; word-break:break-all;">📝 Abrir Enlace de Actividad / TP</a>`;
    });
  },

  async abrirGestor(trayectoId, nombreTrayecto) {
    this.trayectoActualId = trayectoId

    // Detectar rol actual desde la sesión
    const sesionRaw = localStorage.getItem('usuario_actual') || localStorage.getItem('usuario_logueado') || sessionStorage.getItem('usuario_logueado')
    const perfil = sesionRaw ? JSON.parse(sesionRaw) : {}
    const esEstudiante = String(perfil.rol || '').toLowerCase().trim() === 'estudiante'

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
          <h3 style="margin:0; font-size:1.15rem;">📚 Clases y Actividades: <span style="color:#38bdf8;">${nombreTrayecto}</span></h3>
          <button onclick="ClasesModulo.cerrarGestor()" style="background:none; border:none; color:#94a3b8; font-size:1.5rem; cursor:pointer;">&times;</button>
        </div>

        <div style="padding:1.5rem; overflow-y:auto; flex:1;">
          
          <!-- Formulario exclusivo para Docentes y Admins -->
          ${!esEstudiante ? `
            <details open style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:1rem; margin-bottom:1.5rem;">
              <summary style="cursor:pointer; font-weight:600; color:#38bdf8;">➕ Cargar Nueva Clase y/o Actividad</summary>
              
              <form onsubmit="ClasesModulo.guardarClase(event)" style="margin-top:1rem; display:flex; flex-direction:column; gap:0.8rem;">
                
                <div>
                  <label style="display:block; font-size:0.82rem; color:#cbd5e1; margin-bottom:0.3rem;">Título de la Clase / Actividad *</label>
                  <input type="text" id="clase-titulo" placeholder="Ej: Clase 1: HTML Básico y TP N° 1" required class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;">
                </div>

                <div>
                  <label style="display:block; font-size:0.82rem; color:#cbd5e1; margin-bottom:0.3rem;">Descripción / Consigna general</label>
                  <textarea id="clase-descripcion" placeholder="Resumen de la clase o pautas del trabajo..." rows="2" class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;"></textarea>
                </div>

                <div>
                  <label style="display:block; font-size:0.82rem; color:#38bdf8; font-weight:600; margin-bottom:0.3rem;">📚 Enlace a la Clase Teórica (Google Drive, YouTube, PDF)</label>
                  <input type="url" id="clase-url-teoria" placeholder="https://drive.google.com/..." class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;">
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.8rem;">
                  <div>
                    <label style="display:block; font-size:0.82rem; color:#facc15; font-weight:600; margin-bottom:0.3rem;">📝 Enlace a la Actividad / TP</label>
                    <input type="url" id="clase-url-actividad" placeholder="https://drive.google.com/..." class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;">
                  </div>

                  <div>
                    <label style="display:block; font-size:0.82rem; color:#facc15; font-weight:600; margin-bottom:0.3rem;">📅 Fecha Límite de Entrega</label>
                    <input type="date" id="clase-fecha" class="form-control" style="width:100%; padding:0.6rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px;">
                  </div>
                </div>

                <button type="submit" class="btn btn-gold" style="align-self:flex-end; padding:0.6rem 1.4rem; background:#0284c7; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600; margin-top:0.4rem;">
                  💾 Publicar Contenido
                </button>
              </form>
            </details>
          ` : ''}

          <!-- Listado de Publicaciones -->
          <div id="lista-clases-cargadas">
            <p style="color:#94a3b8; text-align:center;">Cargando contenidos...</p>
          </div>
        </div>
      </div>
    `

    modal.style.display = 'flex'
    await this.cargarListaClases(esEstudiante)
  },

  cerrarGestor() {
    const modal = document.getElementById('modal-gestor-clases')
    if (modal) modal.style.display = 'none'
  },

  async cargarListaClases(esEstudiante = false) {
    const contenedor = document.getElementById('lista-clases-cargadas')
    if (!contenedor) return

    try {
      const { data: clases, error } = await supabase
        .from('clases')
        .select('*')
        .eq('trayecto_id', Number(this.trayectoActualId))
        .order('id', { ascending: false })

      if (error) throw error

      if (!clases || clases.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:1rem;">Aún no se han publicado contenidos para este trayecto.</p>'
        return
      }

      contenedor.innerHTML = clases.map((c) => {
        const descHTML = this.convertirLinks(c.descripcion || 'Sin descripción');

        return `
          <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:1rem; margin-bottom:0.8rem; display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="flex:1; padding-right:1rem;">
              <h4 style="margin:0 0 0.4rem 0; color:#f8fafc; font-size:0.95rem;">📌 ${c.titulo}</h4>
              <div style="margin:0 0 0.5rem 0; color:#cbd5e1; font-size:0.85rem; white-space:pre-line;">${descHTML}</div>
              ${c.url_recurso ? `<div style="margin-top:0.5rem;"><a href="${c.url_recurso}" target="_blank" rel="noopener" style="display:inline-block; padding:0.35rem 0.75rem; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; border-radius:6px; font-size:0.82rem; text-decoration:none; font-weight:600;">📚 Abrir Material Teórico de Clase</a></div>` : ''}
            </div>
            ${!esEstudiante ? `
              <button onclick="ClasesModulo.eliminarClase(${c.id})" title="Eliminar" style="background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#f87171; border-radius:6px; padding:0.3rem 0.6rem; cursor:pointer; font-size:0.8rem;">🗑️</button>
            ` : ''}
          </div>
        `
      }).join('')

    } catch (err) {
      console.error('Error al cargar clases:', err)
      contenedor.innerHTML = '<p style="color:#f87171; text-align:center;">Error al cargar las clases.</p>'
    }
  },

  async guardarClase(e) {
    if (e) e.preventDefault()

    const titulo = document.getElementById('clase-titulo')?.value.trim()
    let descripcion = document.getElementById('clase-descripcion')?.value.trim()
    const urlTeoria = document.getElementById('clase-url-teoria')?.value.trim()
    const urlActividad = document.getElementById('clase-url-actividad')?.value.trim()
    const fecha = document.getElementById('clase-fecha')?.value

    if (!titulo) {
      alert('Por favor ingresá un título.')
      return
    }

    let extras = []
    if (fecha) {
      const fechaFmt = fecha.split('-').reverse().join('/')
      extras.push(`📅 Fecha Límite de Entrega: ${fechaFmt}`)
    }
    if (urlActividad) {
      extras.push(`📝 Enlace a Actividad / TP: ${urlActividad}`)
    }

    if (extras.length > 0) {
      descripcion = `${descripcion ? descripcion + '\n\n' : ''}${extras.join('\n')}`
    }

    try {
      const { error } = await supabase
        .from('clases')
        .insert([{
          trayecto_id: Number(this.trayectoActualId),
          titulo: titulo,
          descripcion: descripcion || null,
          url_recurso: urlTeoria || null
        }])

      if (error) throw error

      alert('✅ Publicación guardada con éxito.')

      document.getElementById('clase-titulo').value = ''
      document.getElementById('clase-descripcion').value = ''
      document.getElementById('clase-url-teoria').value = ''
      document.getElementById('clase-url-actividad').value = ''
      if (document.getElementById('clase-fecha')) document.getElementById('clase-fecha').value = ''
      
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
