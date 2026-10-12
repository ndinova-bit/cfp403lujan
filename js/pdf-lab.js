/* ==========================================================================
   js/pdf-lab.js - Generación e Impresión de Certificados PDF
   ========================================================================== */

async function generarCertificadoPDF_v3(trayectoJson, alumnoNombre, usuarioDni, inscripcionId) {
  try {
    const trayecto = typeof trayectoJson === 'object' ? trayectoJson : JSON.parse(decodeURIComponent(trayectoJson));
    const alumno = decodeURIComponent(alumnoNombre);

    const inputNumEg = document.getElementById(`num-eg-${inscripcionId}`);
    let numEgresadoDef = inputNumEg ? inputNumEg.value.trim() : '';

    if (!numEgresadoDef) {
      const { value: egVal } = await Swal.fire({
        title: 'N° de Egresado',
        input: 'text',
        inputValue: '01',
        inputLabel: 'Ingrese N° de Egresado asignado:',
        showCancelButton: true
      });
      if (!egVal) return;
      numEgresadoDef = egVal;
    }

    const { value: fEgreso } = await Swal.fire({
      title: 'Fecha de Egreso',
      input: 'text',
      inputValue: '27 de Noviembre de 2026',
      inputLabel: 'Ingrese Fecha de Egreso para el acta:',
      showCancelButton: true
    });
    if (!fEgreso) return;

    let dniFormateado = String(usuarioDni).replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    if (!dniFormateado) {
      const { value: dniManual } = await Swal.fire({
        title: 'DNI / D.U.',
        input: 'text',
        inputValue: '12345678',
        inputLabel: 'Ingrese el DNI/D.U. del alumno:',
        showCancelButton: true
      });
      if (!dniManual) return;
      dniFormateado = dniManual.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    let cfpVal = '403';
    let distritoVal = 'Luján';
    if (trayecto.descripcion) {
      const matchCfp = trayecto.descripcion.match(/CFP N° (.*?) -/);
      const matchDist = trayecto.descripcion.match(/Distrito: (.*?) \|/);
      if (matchCfp) cfpVal = matchCfp[1];
      if (matchDist) distritoVal = matchDist[1];
    }

    let hsReloj = trayecto.horas || '60';
    let fechaEmision = trayecto.fecha_entrega || '23 de Septiembre de 2026';

    const resBytes = await fetch('./plantilla.pdf');
    if (!resBytes.ok) throw new Error('No se encontró plantilla.pdf en el servidor.');
    const plantillaBytes = await resBytes.arrayBuffer();

    const pdfDoc = await PDFLib.PDFDocument.load(plantillaBytes);
    const fuenteBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const fuenteRegular = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const colorNegro = PDFLib.rgb(0, 0, 0);

    const paginas = pdfDoc.getPages();
    const frente = paginas[0];
    const reverso = paginas.length > 1 ? paginas[1] : frente;

    function dibujaRenglonPunteado(pagina, texto, xStart, yPos, xMax, font, size) {
      pagina.drawText(texto, { x: xStart, y: yPos, size: size, font: font, color: colorNegro });
      const textWidth = font.widthOfTextAtSize(texto, size);
      let puntoX = xStart + textWidth + 5;
      while (puntoX < xMax) {
        pagina.drawText('.', { x: puntoX, y: yPos, size: size, font: font, color: colorNegro });
        puntoX += 4;
      }
    }

    let diaE = '23', mesE = 'Septiembre', anioE = '26';
    if (fechaEmision) {
      const partesF = fechaEmision.split('de');
      if (partesF.length === 3) {
        diaE = partesF[0].trim();
        mesE = partesF[1].trim();
        anioE = partesF[2].trim().slice(-2);
      }
    }

    const tamanoNombre = 14;
    const xInicioLineaNombre = 130;
    const xFinLineaNombre = 532;
    const centroLineaNombre = xInicioLineaNombre + (xFinLineaNombre - xInicioLineaNombre) / 2;
    
    const textoAlumno = alumno.toUpperCase();
    const anchoTextoAlumno = fuenteBold.widthOfTextAtSize(textoAlumno, tamanoNombre);
    const xNombreCentrado = centroLineaNombre - (anchoTextoAlumno / 2);

    frente.drawText(textoAlumno, { x: xNombreCentrado, y: 232, size: tamanoNombre, font: fuenteBold, color: colorNegro });
    frente.drawText(dniFormateado, { x: 115, y: 207, size: 12, font: fuenteRegular, color: colorNegro });
    dibujaRenglonPunteado(frente, (trayecto.nombre || '').toUpperCase(), 91, 182, 400, fuenteRegular, 12);
    frente.drawText(String(hsReloj), { x: 425, y: 182, size: 12, font: fuenteRegular, color: colorNegro });

    let baseNombreCert = (trayecto.certificacion || trayecto.nombre || '').toUpperCase().trim();
    let resTextoLimpio = (trayecto.resolucion || '').toUpperCase().trim();

    baseNombreCert = baseNombreCert.split(/SEGÚN\s+RESOLUCIÓN|SEGUN\s+RESOLUCION/i)[0].trim();

    if (resTextoLimpio) {
      if (baseNombreCert) resTextoLimpio = resTextoLimpio.replaceAll(baseNombreCert, '').trim();
      if (resTextoLimpio.includes('RESFC')) {
        resTextoLimpio = 'RESFC' + resTextoLimpio.split('RESFC').pop().trim();
      } else {
        resTextoLimpio = resTextoLimpio.replace(/^(RESOLUCIÓN|RESOLUCION)\s*/i, '').replace(/^(NRO\.|NRO|N°|NO\.)\s*/i, '').trim();
      }
    }

    let textoCert = baseNombreCert;
    if (resTextoLimpio) {
      textoCert += resTextoLimpio.startsWith('RESFC') || resTextoLimpio.startsWith('NRO') ? ` SEGÚN RESOLUCIÓN ${resTextoLimpio}` : ` SEGÚN RESOLUCIÓN NRO. ${resTextoLimpio}`;
    }

    const tamanoCert = 10.5;
    const xMaxGeneral = 520;
    const configRenglones = [{ x: 320, y: 159 }, { x: 68, y: 135 }, { x: 68, y: 117 }];

    const palabras = textoCert.split(' ').filter(Boolean);
    const lineas = ['', '', ''];
    let lineaActual = 0;

    for (const palabra of palabras) {
      let xInicio = configRenglones[lineaActual].x;
      let anchoDisponible = xMaxGeneral - xInicio;
      let prueba = lineas[lineaActual] ? `${lineas[lineaActual]} ${palabra}` : palabra;
      if (fuenteRegular.widthOfTextAtSize(prueba, tamanoCert) <= anchoDisponible) {
        lineas[lineaActual] = prueba;
      } else {
        lineaActual++;
        if (lineaActual > 2) break;
        lineas[lineaActual] = palabra;
      }
    }

    let ultimaLineaIndice = -1;
    for (let i = 2; i >= 0; i--) {
      if (lineas[i].trim() !== '') { ultimaLineaIndice = i; break; }
    }

    configRenglones.forEach((r, idx) => {
      let textoRenglon = lineas[idx];
      if (textoRenglon && textoRenglon.trim() !== '') {
        if (idx === ultimaLineaIndice) {
          dibujaRenglonPunteado(frente, textoRenglon, r.x, r.y, xMaxGeneral, fuenteRegular, tamanoCert);
        } else {
          frente.drawText(textoRenglon, { x: r.x, y: r.y, size: tamanoCert, font: fuenteRegular, color: colorNegro });
        }
      }
    });

    frente.drawText(String(diaE),  { x: 250, y: 98, size: 12, font: fuenteRegular, color: colorNegro });
    frente.drawText(String(mesE),  { x: 320, y: 98, size: 12, font: fuenteRegular, color: colorNegro });
    frente.drawText(String(anioE), { x: 495, y: 98, size: 12, font: fuenteRegular, color: colorNegro });

    // --- MÓDULOS REVERSO CON LÍNEA PUNTEADA COMPLETA ---
    let modulosArr = [];
    try { modulosArr = typeof trayecto.modulos === 'string' ? JSON.parse(trayecto.modulos) : (trayecto.modulos || []); } catch (e) {}

    const yInicial = 370;
    const pasoEntreItems = 30.5; 
    const altoRenglonSecundario = 12;
    const tamanoFuenteMod = 9.0;
    const maxAnchoCol = 235;

    function dividirEnDosLineas(texto, font, size, maxAncho) {
      const palabras = texto.split(' ').filter(Boolean);
      let l1 = '', l2 = '';
      for (let p of palabras) {
        let prueba = l1 ? l1 + ' ' + p : p;
        if (font.widthOfTextAtSize(prueba, size) <= maxAncho) { l1 = prueba; } else { l2 = l2 ? l2 + ' ' + p : p; }
      }
      return [l1, l2];
    }

    modulosArr.slice(0, 10).forEach((mod, index) => {
      const nombreMod = typeof mod === 'string' ? mod : (mod.nombre || mod.titulo || mod.modulo || '');
      const codigoMod = mod.codigo ? ` (${mod.codigo})` : '';
      const modTextoCompleto = `${nombreMod}${codigoMod}`.toUpperCase();
      const [linea1, linea2] = dividirEnDosLineas(modTextoCompleto, fuenteRegular, tamanoFuenteMod, maxAnchoCol);

      const esColumnaDerecha = index >= 5;
      const idxFila = esColumnaDerecha ? (index - 5) : index;
      const xPos = esColumnaDerecha ? 318 : 42; 
      const yBase = yInicial - (idxFila * pasoEntreItems);          
      const xMaxCol = xPos + maxAnchoCol;

      if (linea1 && !linea2) {
        dibujaRenglonPunteado(reverso, linea1, xPos, yBase, xMaxCol, fuenteRegular, tamanoFuenteMod);
      } else {
        if (linea1) reverso.drawText(linea1, { x: xPos, y: yBase, size: tamanoFuenteMod, font: fuenteRegular, color: colorNegro });
        if (linea2) dibujaRenglonPunteado(reverso, linea2, xPos, yBase - altoRenglonSecundario, xMaxCol, fuenteRegular, tamanoFuenteMod);
      }
    });

    if (fEgreso) reverso.drawText(fEgreso, { x: 140, y: 202, size: 12, font: fuenteRegular, color: colorNegro });
    if (numEgresadoDef) reverso.drawText(String(numEgresadoDef), { x: 420, y: 202, size: 12, font: fuenteRegular, color: colorNegro });
    if (cfpVal) reverso.drawText(String(cfpVal), { x: 150, y: 72, size: 12, font: fuenteRegular, color: colorNegro });
    if (distritoVal) reverso.drawText(String(distritoVal), { x: 390, y: 72, size: 12, font: fuenteRegular, color: colorNegro });

    const pdfBytesFinal = await pdfDoc.save();
    const blob = new Blob([pdfBytesFinal], { type: 'application/pdf' });
    const pdfUrl = URL.createObjectURL(blob);
    window.open(pdfUrl, '_blank');

    if (typeof Toast !== 'undefined') {
      Toast.fire({ icon: 'success', title: 'Certificado PDF generado' });
    }

  } catch (err) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'error', title: 'Error al generar PDF', text: err.message });
    } else {
      console.error(err);
    }
  }
}

const emitirCertificadoPDF = (opts) => {
  return generarCertificadoPDF_v3(
    opts.trayecto || opts,
    opts.estudianteNombre || opts.alumnoNombre,
    opts.estudianteDNI || opts.usuarioDni,
    opts.inscripcionId
  );
};

/* ==========================================================================
   Gestión de Nómina y Emisión Masiva de Certificados por Trayecto
   ========================================================================== */

const CertificadosAdmin = {
  // Guardar persistentemente el N° de Egresado en Supabase al editar la casilla
  async guardarNumEgresado(inscripcionId, valor) {
    try {
      const { error } = await supabase
        .from('inscripciones')
        .update({ num_egresado: valor.trim() })
        .eq('id', inscripcionId);

      if (error) throw error;

      if (typeof Toast !== 'undefined') {
        Toast.fire({ icon: 'success', title: 'N° de egresado guardado' });
      }
    } catch (err) {
      console.error('Error al guardar N° de egresado:', err);
      alert('Error al guardar N° de egresado: ' + err.message);
    }
  },

  async cargarNominaCertificados() {
    const contenedor = document.getElementById('contenedor-certificados-trayectos');
    if (!contenedor) return;

    contenedor.innerHTML = '<p style="color:#94a3b8; padding: 1rem;">Cargando nómina de egresados...</p>';

    try {
      const [rTrayectos, rInscripciones, rUsuarios, rModulos] = await Promise.all([
        supabase.from('trayectos').select('*'),
        supabase.from('inscripciones').select('*'),
        supabase.from('usuarios').select('*'),
        supabase.from('modulos').select('*')
      ]);

      const trayectos = rTrayectos.data || [];
      const inscripciones = rInscripciones.data || [];
      const usuarios = rUsuarios.data || [];
      const modulos = rModulos.data || [];

      if (trayectos.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; padding: 1rem;">No hay trayectos registrados en el sistema.</p>';
        return;
      }

      let htmlCompleto = '';

      trayectos.forEach(trayecto => {
        const inscritosTrayecto = inscripciones.filter(i => String(i.trayecto_id) === String(trayecto.id));
        if (inscritosTrayecto.length === 0) return;

        const modsTrayecto = modulos.filter(m => String(m.trayecto_id) === String(trayecto.id));
        trayecto.modulos = modsTrayecto;

        let filasHtml = '';
        let egresadosCount = 0;

        inscritosTrayecto.forEach(ins => {
          const usr = usuarios.find(u => String(u.usuario) === String(ins.estudiante_user)) || {};
          const nombreCompleto = `${usr.nombre || ''} ${usr.apellido || ''}`.trim() || ins.estudiante_user;
          const dni = usr.usuario || ins.estudiante_user;

          egresadosCount++;

          const jsonTrayectoEnc = encodeURIComponent(JSON.stringify(trayecto));
          const nombreEnc = encodeURIComponent(nombreCompleto);

          filasHtml += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 0.75rem;">
                <strong>${nombreCompleto.toUpperCase()}</strong><br>
                <span style="font-size: 0.78rem; color: #94a3b8;">DNI: ${dni}</span>
              </td>
              <td style="padding: 0.75rem;"><span style="color: #4ade80; font-weight: 700;">100% Acreditado</span></td>
              <td style="padding: 0.75rem;"><span class="badge" style="background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">APROBADO</span></td>
              <td style="padding: 0.75rem;">
                <input type="text" id="num-eg-${ins.id}" class="form-control" placeholder="Ej: 01" value="${ins.num_egresado || ''}" style="width: 100px; padding: 0.35rem 0.5rem; font-size: 0.85rem;" onchange="CertificadosAdmin.guardarNumEgresado('${ins.id}', this.value)">
              </td>
              <td style="padding: 0.75rem; text-align: right;">
                <button class="btn btn-gold" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" 
                  onclick="generarCertificadoPDF_v3('${jsonTrayectoEnc}', '${nombreEnc}', '${dni}', '${ins.id}')">
                  📜 Emitir PDF
                </button>
              </td>
            </tr>
          `;
        });

        if (egresadosCount > 0) {
          htmlCompleto += `
            <div class="card-panel" style="margin-bottom: 2rem; background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.75rem;">
                <div>
                  <h4 style="margin: 0; color: #38bdf8; font-size: 1.1rem;">📚 ${trayecto.nombre.toUpperCase()}</h4>
                  <span style="font-size: 0.8rem; color: #94a3b8;">Ciclo Lectivo: ${trayecto.ciclo_lectivo || '2026'} | Egresados Aptos: ${egresadosCount}</span>
                </div>
                <button class="btn btn-primary" style="font-size: 0.85rem; padding: 0.45rem 0.9rem;" 
                  onclick="CertificadosAdmin.emitirTodosPorTrayecto(${trayecto.id})">
                  🖨️ Emitir Todos los PDF del Trayecto
                </button>
              </div>

              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem;">
                  <thead>
                    <tr style="border-bottom: 2px solid rgba(255,255,255,0.1); color: #94a3b8;">
                      <th style="padding: 0.6rem;">Estudiante / DNI</th>
                      <th style="padding: 0.6rem;">Acreditación</th>
                      <th style="padding: 0.6rem;">Estado</th>
                      <th style="padding: 0.6rem;">N° Egresado</th>
                      <th style="padding: 0.6rem; text-align: right;">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filasHtml}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }
      });

      contenedor.innerHTML = htmlCompleto || '<p style="color:#94a3b8; padding: 1rem;">No se encontraron estudiantes con cursadas acreditadas para emitir certificados.</p>';

    } catch (err) {
      console.error('Error al cargar nómina de certificados:', err);
      contenedor.innerHTML = '<p style="color:#f87171; padding: 1rem;">Error al cargar la nómina de estudiantes.</p>';
    }
  },

  // Generación en lote dividida en 2 archivos PDF independientes: Frentes y Reversos
  async emitirTodosPorTrayecto(trayectoId) {
    try {
      const [rTrayectos, rInscripciones, rUsuarios, rModulos] = await Promise.all([
        supabase.from('trayectos').select('*').eq('id', trayectoId).single(),
        supabase.from('inscripciones').select('*').eq('trayecto_id', trayectoId),
        supabase.from('usuarios').select('*'),
        supabase.from('modulos').select('*').eq('trayecto_id', trayectoId)
      ]);

      const trayecto = rTrayectos.data;
      const inscripciones = rInscripciones.data || [];
      const usuarios = rUsuarios.data || [];
      trayecto.modulos = rModulos.data || [];

      if (!trayecto || inscripciones.length === 0) {
        alert('No hay egresados para emitir en este trayecto.');
        return;
      }

      // Pregunta la fecha una única vez
      const { value: fEgreso } = await Swal.fire({
        title: 'Fecha de Egreso en Lote',
        input: 'text',
        inputValue: '27 de Noviembre de 2026',
        inputLabel: `Ingrese la Fecha de Egreso para los ${inscripciones.length} certificados de ${trayecto.nombre}:`,
        showCancelButton: true
      });
      if (!fEgreso) return;

      const resBytes = await fetch('./plantilla.pdf');
      if (!resBytes.ok) throw new Error('No se encontró plantilla.pdf en el servidor.');
      const plantillaBytes = await resBytes.arrayBuffer();

      // Creamos dos documentos PDF separados
      const pdfFrentes = await PDFLib.PDFDocument.create();
      const pdfReversos = await PDFLib.PDFDocument.create();

      for (const ins of inscripciones) {
        const usr = usuarios.find(u => String(u.usuario) === String(ins.estudiante_user)) || {};
        const alumnoNombre = `${usr.nombre || ''} ${usr.apellido || ''}`.trim() || ins.estudiante_user;
        const usuarioDni = usr.usuario || ins.estudiante_user;

        const inputNumEg = document.getElementById(`num-eg-${ins.id}`);
        const numEgresadoDef = inputNumEg ? inputNumEg.value.trim() : (ins.num_egresado || '01');

        const docTemp = await PDFLib.PDFDocument.load(plantillaBytes);
        const fuenteBold = await docTemp.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const fuenteRegular = await docTemp.embedFont(PDFLib.StandardFonts.Helvetica);
        const colorNegro = PDFLib.rgb(0, 0, 0);

        const paginas = docTemp.getPages();
        const frente = paginas[0];
        const reverso = paginas.length > 1 ? paginas[1] : frente;

        function dibujaRenglonPunteado(pagina, texto, xStart, yPos, xMax, font, size) {
          pagina.drawText(texto, { x: xStart, y: yPos, size: size, font: font, color: colorNegro });
          const textWidth = font.widthOfTextAtSize(texto, size);
          let puntoX = xStart + textWidth + 5;
          while (puntoX < xMax) {
            pagina.drawText('.', { x: puntoX, y: yPos, size: size, font: font, color: colorNegro });
            puntoX += 4;
          }
        }

        let dniFormateado = String(usuarioDni).replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        let cfpVal = '403', distritoVal = 'Luján';
        if (trayecto.descripcion) {
          const matchCfp = trayecto.descripcion.match(/CFP N° (.*?) -/);
          const matchDist = trayecto.descripcion.match(/Distrito: (.*?) \|/);
          if (matchCfp) cfpVal = matchCfp[1];
          if (matchDist) distritoVal = matchDist[1];
        }

        let hsReloj = trayecto.horas || '60';
        let fechaEmision = trayecto.fecha_entrega || '23 de Septiembre de 2026';
        let diaE = '23', mesE = 'Septiembre', anioE = '26';
        if (fechaEmision) {
          const partesF = fechaEmision.split('de');
          if (partesF.length === 3) {
            diaE = partesF[0].trim();
            mesE = partesF[1].trim();
            anioE = partesF[2].trim().slice(-2);
          }
        }

        // --- CONSTRUIR FRENTE ---
        const tamanoNombre = 14;
        const centroLineaNombre = 130 + (532 - 130) / 2;
        const textoAlumno = alumnoNombre.toUpperCase();
        const anchoTextoAlumno = fuenteBold.widthOfTextAtSize(textoAlumno, tamanoNombre);
        
        frente.drawText(textoAlumno, { x: centroLineaNombre - (anchoTextoAlumno / 2), y: 232, size: tamanoNombre, font: fuenteBold, color: colorNegro });
        frente.drawText(dniFormateado, { x: 115, y: 207, size: 12, font: fuenteRegular, color: colorNegro });
        dibujaRenglonPunteado(frente, (trayecto.nombre || '').toUpperCase(), 91, 182, 400, fuenteRegular, 12);
        frente.drawText(String(hsReloj), { x: 425, y: 182, size: 12, font: fuenteRegular, color: colorNegro });

        let baseNombreCert = (trayecto.certificacion || trayecto.nombre || '').toUpperCase().trim();
        let resTextoLimpio = (trayecto.resolucion || '').toUpperCase().trim();
        baseNombreCert = baseNombreCert.split(/SEGÚN\s+RESOLUCIÓN|SEGUN\s+RESOLUCION/i)[0].trim();

        if (resTextoLimpio) {
          if (baseNombreCert) resTextoLimpio = resTextoLimpio.replaceAll(baseNombreCert, '').trim();
          if (resTextoLimpio.includes('RESFC')) {
            resTextoLimpio = 'RESFC' + resTextoLimpio.split('RESFC').pop().trim();
          } else {
            resTextoLimpio = resTextoLimpio.replace(/^(RESOLUCIÓN|RESOLUCION)\s*/i, '').replace(/^(NRO\.|NRO|N°|NO\.)\s*/i, '').trim();
          }
        }

        let textoCert = baseNombreCert;
        if (resTextoLimpio) {
          textoCert += resTextoLimpio.startsWith('RESFC') || resTextoLimpio.startsWith('NRO') ? ` SEGÚN RESOLUCIÓN ${resTextoLimpio}` : ` SEGÚN RESOLUCIÓN NRO. ${resTextoLimpio}`;
        }

        const tamanoCert = 10.5, xMaxGeneral = 520;
        const configRenglones = [{ x: 320, y: 159 }, { x: 68, y: 135 }, { x: 68, y: 117 }];
        const palabras = textoCert.split(' ').filter(Boolean);
        const lineas = ['', '', ''];
        let lineaActual = 0;

        for (const palabra of palabras) {
          let xInicio = configRenglones[lineaActual].x;
          let anchoDisponible = xMaxGeneral - xInicio;
          let prueba = lineas[lineaActual] ? `${lineas[lineaActual]} ${palabra}` : palabra;
          if (fuenteRegular.widthOfTextAtSize(prueba, tamanoCert) <= anchoDisponible) {
            lineas[lineaActual] = prueba;
          } else {
            lineaActual++;
            if (lineaActual > 2) break;
            lineas[lineaActual] = palabra;
          }
        }

        let ultimaLineaIndice = -1;
        for (let i = 2; i >= 0; i--) {
          if (lineas[i].trim() !== '') { ultimaLineaIndice = i; break; }
        }

        configRenglones.forEach((r, idx) => {
          let textoRenglon = lineas[idx];
          if (textoRenglon && textoRenglon.trim() !== '') {
            if (idx === ultimaLineaIndice) {
              dibujaRenglonPunteado(frente, textoRenglon, r.x, r.y, xMaxGeneral, fuenteRegular, tamanoCert);
            } else {
              frente.drawText(textoRenglon, { x: r.x, y: r.y, size: tamanoCert, font: fuenteRegular, color: colorNegro });
            }
          }
        });

        frente.drawText(String(diaE),  { x: 250, y: 98, size: 12, font: fuenteRegular, color: colorNegro });
        frente.drawText(String(mesE),  { x: 320, y: 98, size: 12, font: fuenteRegular, color: colorNegro });
        frente.drawText(String(anioE), { x: 495, y: 98, size: 12, font: fuenteRegular, color: colorNegro });

        // --- CONSTRUIR REVERSO ---
        let modulosArr = trayecto.modulos || [];
        const yInicial = 370, pasoEntreItems = 30.5, altoRenglonSecundario = 12, tamanoFuenteMod = 9.0, maxAnchoCol = 235;

        function dividirEnDosLineas(texto, font, size, maxAncho) {
          const palabras = texto.split(' ').filter(Boolean);
          let l1 = '', l2 = '';
          for (let p of palabras) {
            let prueba = l1 ? l1 + ' ' + p : p;
            if (font.widthOfTextAtSize(prueba, size) <= maxAncho) { l1 = prueba; } else { l2 = l2 ? l2 + ' ' + p : p; }
          }
          return [l1, l2];
        }

        modulosArr.slice(0, 10).forEach((mod, index) => {
          const nombreMod = typeof mod === 'string' ? mod : (mod.nombre || mod.titulo || mod.modulo || '');
          const codigoMod = mod.codigo ? ` (${mod.codigo})` : '';
          const modTextoCompleto = `${nombreMod}${codigoMod}`.toUpperCase();
          const [linea1, linea2] = dividirEnDosLineas(modTextoCompleto, fuenteRegular, tamanoFuenteMod, maxAnchoCol);

          const esColumnaDerecha = index >= 5;
          const idxFila = esColumnaDerecha ? (index - 5) : index;
          const xPos = esColumnaDerecha ? 318 : 42; 
          const yBase = yInicial - (idxFila * pasoEntreItems);          
          const xMaxCol = xPos + maxAnchoCol;

          if (linea1 && !linea2) {
            dibujaRenglonPunteado(reverso, linea1, xPos, yBase, xMaxCol, fuenteRegular, tamanoFuenteMod);
          } else {
            if (linea1) reverso.drawText(linea1, { x: xPos, y: yBase, size: tamanoFuenteMod, font: fuenteRegular, color: colorNegro });
            if (linea2) dibujaRenglonPunteado(reverso, linea2, xPos, yBase - altoRenglonSecundario, xMaxCol, fuenteRegular, tamanoFuenteMod);
          }
        });

        if (fEgreso) reverso.drawText(fEgreso, { x: 140, y: 202, size: 12, font: fuenteRegular, color: colorNegro });
        if (numEgresadoDef) reverso.drawText(String(numEgresadoDef), { x: 420, y: 202, size: 12, font: fuenteRegular, color: colorNegro });
        if (cfpVal) reverso.drawText(String(cfpVal), { x: 150, y: 72, size: 12, font: fuenteRegular, color: colorNegro });
        if (distritoVal) reverso.drawText(String(distritoVal), { x: 390, y: 72, size: 12, font: fuenteRegular, color: colorNegro });

        // Añadir Pág 0 (Frente) al documento Frentes
        const [pagFrente] = await pdfFrentes.copyPages(docTemp, [0]);
        pdfFrentes.addPage(pagFrente);

        // Añadir Pág 1 (Reverso) al documento Reversos
        if (docTemp.getPageCount() > 1) {
          const [pagReverso] = await pdfReversos.copyPages(docTemp, [1]);
          pdfReversos.addPage(pagReverso);
        }
      }

      // 1. Abrir/Descargar PDF Lote de Frentes
      const pdfFrentesBytes = await pdfFrentes.save();
      const blobFrentes = new Blob([pdfFrentesBytes], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blobFrentes), '_blank');

      // 2. Abrir/Descargar PDF Lote de Reversos
      const pdfReversosBytes = await pdfReversos.save();
      const blobReversos = new Blob([pdfReversosBytes], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blobReversos), '_blank');

      if (typeof Toast !== 'undefined') {
        Toast.fire({ icon: 'success', title: `Lotes Frentes y Reversos emitidos (${inscripciones.length} alumnos)` });
      }

    } catch (err) {
      console.error('Error al emitir en lote:', err);
      alert('Error en emisión en lote: ' + err.message);
    }
  }
};

window.CertificadosAdmin = CertificadosAdmin;

document.addEventListener('DOMContentLoaded', () => {
  const btnCertificados = document.getElementById('btn-certificados');
  if (btnCertificados) {
    btnCertificados.addEventListener('click', () => {
      CertificadosAdmin.cargarNominaCertificados();
    });
  }
});
