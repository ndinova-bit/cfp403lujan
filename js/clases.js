const ClasesModulo = {
  trayectoActualId: null,
  claseEditandoId: null,

  // Convierte URLs de la actividad en un botón amarillo interactivo
  convertirLinks(texto) {
    if (!texto) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return texto.replace(urlRegex, (url) => {
      return `<div style="margin-top:0.4rem;"><a href="${url}" target="_blank" rel="noopener" style="display:inline-block; padding:0.35rem 0.75rem; background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.3); color:#facc15; border-radius:6px; font-size:0.82rem; text-decoration:none; font-weight:600;">📝 Abrir Enlace de Actividad / TP</a></div>`;
    });
  },

  async abrirGestor(trayectoId, nombreTrayecto) {
    this.trayectoActualId = trayectoId
    this.claseEditandoId = null

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
            <details id="details-form-clase" open style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:1rem; margin-bottom:1.5rem;">
              <summary id="summary-clase-titulo" style="cursor:pointer; font-weight:600; color:#38bdf8;">➕ Cargar Nueva Clase y/o Actividad</summary>
              
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

      window.clasesGuardadasCache = clases;

      contenedor.innerHTML = clases.map((c) => {
        const descHTML = this.convertirLinks(c.descripcion || 'Sin descripción');

        return `
          <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:1rem; margin-bottom:0.8rem; display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="flex:1; padding-right:1rem;">
              <h4 style="margin:0 0 0.4rem 0; color:#f8fafc; font-size:0.95rem;">📌 ${c.titulo}</h4>
              
              <!-- 1. PRIMERO MATERIAL TEÓRICO -->
              ${c.url_recurso ? `<div style="margin-bottom:0.5rem;"><a href="${c.url_recurso}" target="_blank" rel="noopener" style="display:inline-block; padding:0.35rem 0.75rem; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; border-radius:6px; font-size:0.82rem; text-decoration:none; font-weight:600;">📚 Abrir Material Teórico de Clase</a></div>` : ''}

              <!-- 2. DEBAJO ACTIVIDAD / DESCRIPCIÓN Y FECHA -->
              <div style="margin:0; color:#cbd5e1; font-size:0.85rem; white-space:pre-line;">${descHTML}</div>
            </div>

            ${!esEstudiante ? `
              <div style="display:flex; gap:0.4rem;">
                <button onclick="ClasesModulo.editarClase(${c.id})" title="Editar" style="background:rgba(56,189,248,0.2); border:1px solid rgba(56,189,248,0.4); color:#38bdf8; border-radius:6px; padding:0.3rem 0.6rem; cursor:pointer; font-size:0.8rem;">✏️</button>
                <button onclick="ClasesModulo.eliminarClase(${c.id})" title="Eliminar" style="background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#f87171; border-radius:6px; padding:0.3rem 0.6rem; cursor:pointer; font-size:0.8rem;">🗑️</button>
              </div>
            ` : ''}
          </div>
        `
      }).join('')

    } catch (err) {
      console.error('Error al cargar clases:', err)
      contenedor.innerHTML = '<p style="color:#f87171; text-align:center;">Error al cargar las clases.</p>'
    }
  },

  editarClase(idClase) {
    const clase = (window.clasesGuardadasCache || []).find(c => c.id === idClase);
    if (!clase) return;

    this.claseEditandoId = idClase;

    document.getElementById('clase-titulo').value = clase.titulo || '';
    document.getElementById('clase-url-teoria').value = clase.url_recurso || '';

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

    // Limpiar lineas que agregamos dinamicamente
    let descLimpia = rawDesc
      .replace(/📅 Fecha de Publicación: \d{2}\/\d{2}\/\d{4}\n?/, '')
      .replace(/📝 Enlace a Actividad \/ TP: https?:\/\/[^\s]+\n?/, '')
      .trim();

    document.getElementById('clase-descripcion').value = descLimpia;

    const summary = document.getElementById('summary-clase-titulo');
    if (summary) summary.innerText = '✏️ Editando Clase / Actividad';

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

    const summary = document.getElementById('summary-clase-titulo');
    if (summary) summary.innerText = '➕ Cargar Nueva Clase y/o Actividad';

    const btnGuardar = document.getElementById('btn-guardar-clase');
    if (btnGuardar) btnGuardar.innerText = '💾 Publicar Contenido';

    const btnCancelar = document.getElementById('btn-cancelar-edicion');
    if (btnCancelar) btnCancelar.style.display = 'none';
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
      extras.push(`📅 Fecha de Publicación: ${fechaFmt}`)
    }
    if (urlActividad) {
      extras.push(`📝 Enlace a Actividad / TP: ${urlActividad}`)
    }

    if (extras.length > 0) {
      descripcion = `${descripcion ? descripcion + '\n\n' : ''}${extras.join('\n')}`
    }

    try {
      const objetoDatos = {
        trayecto_id: Number(this.trayectoActualId),
        titulo: titulo,
        descripcion: descripcion || null,
        url_recurso: urlTeoria || null
      }

      if (this.claseEditandoId) {
        const { error } = await supabase
          .from('clases')
          .update(objetoDatos)
          .eq('id', this.claseEditandoId)

        if (error) throw error
        alert('✅ Publicación actualizada correctamente.')
      } else {
        const { error } = await supabase
          .from('clases')
          .insert([objetoDatos])

        if (error) throw error
        alert('✅ Publicación guardada con éxito.')
      }

      this.limpiarFormulario()
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
