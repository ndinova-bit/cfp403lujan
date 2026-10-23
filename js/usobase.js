/* Indicador de espacio usado en la base (sección "Base de Datos", solo administración).
   El plan gratuito de Supabase permite 500 MB de base de datos. */
const UsoBase = {
  LIMITE_MB: 500,

  formato(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  },

  NOMBRES: {
    auditoria: 'Registro de cambios (auditoría)', asistencias: 'Asistencias', entregas_actividades: 'Entregas y notas',
    inscripciones: 'Inscripciones', profiles: 'Usuarios', clases: 'Clases', notificaciones: 'Notificaciones',
    observaciones_estudiante: 'Observaciones', datos_estudiante: 'Datos personales', trayectos: 'Trayectos',
    modulos: 'Módulos', novedades: 'Novedades', padron_estudiantes: 'Padrón', certificados_emitidos: 'Certificados emitidos',
    claves_actividad: 'Respuestas correctas de actividades', banco_preguntas: 'Banco de preguntas'
  },

  async cargar() {
    if (window.CierreCiclo) CierreCiclo.cargar();
    const cont = document.getElementById('uso-base');
    if (!cont) return;
    cont.innerHTML = '<p class="asis-cargando">Midiendo el espacio usado…</p>';
    const { data, error } = await supabase.rpc('uso_base');
    if (error || !data) {
      cont.innerHTML = '<div class="prog-vacio">Para ver el espacio usado, ejecutá <b>sql/10_uso_de_la_base.sql</b> en Supabase.</div>';
      return;
    }
    const total = Number(data.total_bytes) || 0;
    const limite = this.LIMITE_MB * 1024 * 1024;
    const pct = Math.min(100, Math.round(total / limite * 1000) / 10);
    const nivel = pct >= 85 ? 'bad' : (pct >= 70 ? 'mid' : 'ok');
    const mensaje = nivel === 'bad'
      ? 'Queda poco espacio: descargá un respaldo y limpiá el registro de cambios más viejo (te ayudo a hacerlo).'
      : nivel === 'mid'
        ? 'Pasó el 70%: conviene planificar una limpieza del registro de cambios antiguo.'
        : 'Hay espacio de sobra. Los certificados, actas y planillas no ocupan lugar: se generan en el momento.';
    const tablas = (data.tablas || []).filter(t => Number(t.bytes) > 0).slice(0, 8);
    const maxT = Math.max(1, ...tablas.map(t => Number(t.bytes)));
    cont.innerHTML = `
      <div class="uso-cab">
        <div><span class="uso-num">${this.formato(total)}</span><span class="uso-de"> de ${this.LIMITE_MB} MB · ${String(pct).replace('.', ',')}%</span></div>
        <span class="uso-estado ${nivel}">${nivel === 'ok' ? 'Todo bien' : nivel === 'mid' ? 'Atención' : 'Casi lleno'}</span>
      </div>
      <div class="uso-barra" role="img" aria-label="Espacio usado: ${pct}%"><div class="uso-fill ${nivel}" style="width:${Math.max(pct, 1)}%"></div><div class="uso-marca" style="left:70%"></div></div>
      <p class="uso-msg">${mensaje}</p>
      <details class="uso-detalle"><summary>Qué ocupa más</summary>
        <div class="uso-tablas">${tablas.map(t => `
          <div class="uso-fila"><span>${this.NOMBRES[t.tabla] || t.tabla}</span>
            <div class="uso-mini"><div style="width:${Math.max(2, Math.round(Number(t.bytes) / maxT * 100))}%"></div></div>
            <b>${this.formato(Number(t.bytes))}</b></div>`).join('')}</div>
      </details>`;
  }
};
window.UsoBase = UsoBase;

/* Cierre de ciclo: descarga en Excel y archiva el detalle de las respuestas de los
   ciclos de hace 2 años o más. Se conservan las notas, la asistencia, las actas y los
   egresos: solo se vacía el detalle (qué contestó cada alumno en cada pregunta). */
const CierreCiclo = {
  descargado: false,

  corte() {
    const anio = new Date().getFullYear();
    return { fecha: `${anio - 1}-01-01`, hasta: anio - 2 };
  },

  async cargar() {
    const cont = document.getElementById('cierre-ciclo');
    if (!cont) return;
    const { fecha, hasta } = this.corte();
    const { data, error } = await supabase.rpc('resumen_respuestas', { p_antes: fecha });
    if (error) {
      cont.innerHTML = '<div class="prog-vacio">Para usar el cierre de ciclo, ejecutá <b>sql/11_clases_y_actividades.sql</b> en Supabase.</div>';
      return;
    }
    const fila = Array.isArray(data) ? data[0] : data;
    const cant = Number(fila && fila.cantidad) || 0;
    const bytes = Number(fila && fila.bytes) || 0;
    cont.innerHTML = `
      <p class="uso-msg">Guarda en Excel y después borra de la base el <b>detalle</b> de las respuestas de los ciclos <b>${hasta} y anteriores</b>.
        Las notas, la asistencia, las actas, los certificados y los egresos <b>no se tocan</b>.</p>
      ${cant
        ? `<p class="uso-msg">Hay <b>${cant}</b> respuesta(s) para archivar (${UsoBase.formato(bytes)}).</p>
           <div class="cierre-botones">
             <button type="button" class="act-btn-sec" id="cierre-descargar">1 · Descargar Excel</button>
             <button type="button" class="act-btn" id="cierre-archivar" ${this.descargado ? '' : 'disabled title="Primero descargá el Excel"'}>2 · Archivar en la base</button>
           </div>`
        : `<p class="uso-msg">✔ No hay respuestas de ciclos ${hasta} o anteriores para archivar.</p>`}`;
    const bD = cont.querySelector('#cierre-descargar');
    if (bD) bD.onclick = () => this.descargar();
    const bA = cont.querySelector('#cierre-archivar');
    if (bA) bA.onclick = () => this.archivar();
  },

  async leerTodo(fecha) {
    const filas = [];
    for (let desde = 0; desde < 50000; desde += 1000) {
      const { data, error } = await supabase.from('entregas_actividades').select('*')
        .not('respuestas', 'is', null).lt('created_at', fecha).order('id', { ascending: true }).range(desde, desde + 999);
      if (error) throw error;
      filas.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return filas.filter(e => e.respuestas && !e.respuestas.archivado && String(e.updated_at || e.created_at) < fecha);
  },

  resumenRespuestas(clase, r) {
    if (!r) return '';
    const c = (clase && clase.contenido) || {};
    try {
      if (clase && ['escrita', 'encuesta'].includes(clase.tipo)) {
        return (c.preguntas || []).map((p, i) => `${i + 1}) ${p.enunciado}: ${r[p.id] ?? '—'}`).join('\n');
      }
      if (clase && clase.tipo === 'bitacora') return (r.entradas || []).map(e => `${e.f}: ${e.t}${e.l ? ' (' + e.l + ')' : ''}`).join('\n');
      if (clase && clase.tipo === 'presupuesto') return (r.filas || []).map(f => `${f.descripcion || f.id}: ${f.cantidad} x ${f.precio ?? ''}`).join('\n');
    } catch (e) { /* formato libre */ }
    return JSON.stringify(r);
  },

  async descargar() {
    const { fecha, hasta } = this.corte();
    const btn = document.getElementById('cierre-descargar');
    if (btn) { btn.disabled = true; btn.textContent = 'Preparando…'; }
    try {
      if (typeof ExcelJS === 'undefined') throw new Error('No se cargó la librería de Excel. Recargá la página.');
      const ents = await this.leerTodo(fecha);
      const cids = [...new Set(ents.map(e => e.clase_id))];
      let clases = [], trayectos = [], usuarios = [];
      if (cids.length) ({ data: clases } = await supabase.from('clases').select('id, titulo, tipo, trayecto_id, contenido').in('id', cids));
      const tids = [...new Set((clases || []).map(c => c.trayecto_id))];
      if (tids.length) ({ data: trayectos } = await supabase.from('trayectos').select('id, nombre, ciclo_lectivo').in('id', tids));
      const dnis = [...new Set(ents.map(e => String(e.estudiante_user)))];
      if (dnis.length) ({ data: usuarios } = await supabase.from('usuarios').select('usuario, nombre, apellido').in('usuario', dnis));

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Respuestas');
      ws.columns = [
        { header: 'Ciclo', key: 'ciclo', width: 8 }, { header: 'Trayecto', key: 'tray', width: 30 },
        { header: 'Actividad', key: 'act', width: 30 }, { header: 'Tipo', key: 'tipo', width: 16 },
        { header: 'DNI', key: 'dni', width: 12 }, { header: 'Estudiante', key: 'nom', width: 28 },
        { header: 'Nota', key: 'nota', width: 7 }, { header: 'Intentos', key: 'int', width: 9 },
        { header: 'Fecha', key: 'fecha', width: 12 }, { header: 'Devolución docente', key: 'com', width: 30 },
        { header: 'Respuestas', key: 'resp', width: 80 }
      ];
      ws.getRow(1).font = { bold: true };
      ents.forEach(e => {
        const c = (clases || []).find(x => Number(x.id) === Number(e.clase_id)) || {};
        const t = (trayectos || []).find(x => Number(x.id) === Number(c.trayecto_id)) || {};
        const u = (usuarios || []).find(x => String(x.usuario) === String(e.estudiante_user));
        const tipo = (window.Actividades && Actividades.TIPOS[c.tipo]) ? Actividades.TIPOS[c.tipo].nombre : (c.tipo || '');
        ws.addRow({
          ciclo: t.ciclo_lectivo || '', tray: t.nombre || '', act: c.titulo || `Actividad ${e.clase_id}`, tipo,
          dni: String(e.estudiante_user), nom: u ? `${String(u.apellido || '').toUpperCase()}, ${u.nombre || ''}` : '',
          nota: e.nota ?? '', int: e.intentos ?? '', fecha: String(e.updated_at || e.created_at || '').slice(0, 10),
          com: e.comentario_docente || '', resp: this.resumenRespuestas(c, e.respuestas.r).slice(0, 32000)
        });
      });
      ws.getColumn('resp').alignment = { wrapText: true, vertical: 'top' };
      const buf = await wb.xlsx.writeBuffer();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = `Respuestas_ciclos_hasta_${hasta}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      this.descargado = true;
      if (typeof Swal !== 'undefined') Swal.fire({ icon: 'success', title: 'Excel descargado', text: 'Guardalo en un lugar seguro (por ejemplo, el Drive institucional). Después podés archivar.' });
    } catch (e) {
      alert('No se pudo preparar el Excel: ' + (e.message || e));
    }
    this.cargar();
  },

  async archivar() {
    const { fecha, hasta } = this.corte();
    if (!this.descargado) return alert('Primero descargá el Excel.');
    if (!confirm(`Se va a borrar de la base el detalle de las respuestas de los ciclos ${hasta} y anteriores.\nLas notas no se tocan. Esto no se puede deshacer.\n\n¿Continuar?`)) return;
    const { data, error } = await supabase.rpc('archivar_respuestas', { p_antes: fecha });
    if (error) return alert('No se pudo archivar: ' + error.message);
    if (typeof Swal !== 'undefined') Swal.fire({ icon: 'success', title: 'Listo', text: `Se archivaron ${Number(data) || 0} respuesta(s).` });
    this.descargado = false;
    UsoBase.cargar();
  }
};
window.CierreCiclo = CierreCiclo;
