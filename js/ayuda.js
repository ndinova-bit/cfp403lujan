/* ==========================================================================
   AYUDA Y GUÍA DE USO
   Archivo: js/ayuda.js
   Tres cosas, todas según el rol de quien entra:
     1) Sección «Ayuda y guía»: temas por rol (desplegables) + guía en PDF.
     2) Botón «?» del encabezado: explica la pantalla en la que estás.
     3) Recorrido guiado: señala el menú que ve esa persona (la primera vez que entra
        y cuando lo pida desde la sección Ayuda).
   Para cambiar un texto basta con editar el bloque TEMAS de abajo.
   ========================================================================== */
const AyudaModulo = {
  // ▼ Lo único institucional: cambiar estas dos líneas al copiar el módulo a otra escuela.
  NOMBRE_CORTO: 'CFP N.º 403',
  NOMBRE_PDF: 'CFP N.º 403 "Oscar Smith" - Luján',
  tabActual: 'trayectos',

  ROLES: {
    estudiante: 'Estudiante', docente: 'Docente', preceptor: 'Preceptor/a',
    regente: 'Regente', admin: 'Director/a', secretaria: 'Secretaría'
  },
  PERSONAL: ['docente', 'preceptor', 'regente', 'admin', 'secretaria'],
  DIRECCION: ['regente', 'admin'],

  /* Cada tema:  t = título · roles = quiénes lo ven · corto = frase para el recorrido
     que = qué es · pasos = cómo se usa · ojo = tené en cuenta
     porRol = textos que reemplazan a los generales para un rol puntual                */
  TEMAS: {
    inicio: {
      t: 'Primeros pasos', roles: ['estudiante', 'docente', 'preceptor', 'regente', 'admin', 'secretaria'],
      corto: 'Tu cuenta, el menú y la ayuda.',
      que: 'Cómo moverte por la plataforma y cuidar tu cuenta.',
      pasos: [
        'Ingresás con tu correo o tu DNI y tu contraseña.',
        'El menú de la izquierda muestra solo lo que corresponde a tu rol. En el celular se abre con el botón ☰.',
        'Con «Cambiar mi contraseña» (abajo del menú) ponés una clave propia. Conviene hacerlo la primera vez que entrás.',
        'Con «Instalar la app» la plataforma queda como un ícono en tu celular o computadora.',
        'El botón «?» de arriba explica la pantalla en la que estás.',
        'Al terminar, usá «Cerrar sesión», sobre todo en computadoras compartidas.'
      ],
      ojo: ['Si no recordás tu contraseña, pedí en el CFP que la restablezcan (Regencia o Preceptoría).']
    },

    progreso: {
      t: 'Mi progreso', roles: ['estudiante'], corto: 'Tus notas, asistencia y módulos aprobados.',
      que: 'Muestra cómo venís en cada trayecto: módulos, notas y asistencia.',
      pasos: [
        'Entrá en «Mi progreso» para ver tus trayectos y el estado de cada módulo.',
        'Un módulo se aprueba con 70 puntos o más.',
        'La nota de cada módulo combina el promedio de tus actividades y tu asistencia (si el trayecto la computa).',
        'Los módulos se habilitan de a uno: para rendir el siguiente tenés que tener aprobado el anterior.'
      ],
      ojo: [
        'Una actividad que no entregás a tiempo cuenta con la nota mínima (10) cuando vence el plazo.',
        'Si un módulo cierra con nota menor a 70 podés quedar dado de baja del trayecto: consultá a tu docente o al CFP.'
      ]
    },

    trayectos: {
      t: 'Trayectos formativos', roles: ['estudiante', 'docente', 'preceptor', 'regente', 'admin'],
      corto: 'Tus cursos: clases, actividades y asistencia.',
      que: 'Lista de trayectos (cursos). Cada uno se abre con «Ver Clases y Actividades».',
      pasos: [
        'Entrá al trayecto con «📖 Ver Clases y Actividades».',
        'Ahí están las clases, el material y las actividades, ordenados por módulo.',
        'Entregá cada actividad dentro del plazo que figura en la consigna.'
      ],
      ojo: ['Si un módulo aparece bloqueado (con un candado), hay que aprobar primero el anterior.'],
      porRol: {
        docente: {
          que: 'Tus trayectos asignados (o suplencias) del ciclo.',
          pasos: [
            'Abrí un trayecto con «📖 Ver Clases y Actividades».',
            'Dentro del trayecto cargás clases, material y actividades, tomás asistencia, calificás y completás el libro de temas y la planificación.',
            'En los trayectos sin módulos podés registrar bajas manuales; en los que tienen módulos la baja es automática. Reincorporar lo hacen Dirección, Regencia y Preceptoría.'
          ],
          ojo: ['Dirección y Regencia ven el libro de temas y la planificación; no los editan.']
        },
        preceptor: {
          que: 'Todos los trayectos del CFP.',
          pasos: [
            'Entrá a un trayecto con «📖 Ver Clases y Actividades» para ver estudiantes, asistencia y notas.',
            'Registrá bajas manuales y reincorporaciones.',
            'Podés importar estudiantes a un trayecto desde un archivo CSV o Excel (carga masiva).'
          ],
          ojo: ['Cargar un trayecto nuevo y emitir certificados es tarea de Dirección y Regencia.']
        },
        regente: {
          que: 'Todos los trayectos del CFP, con edición de sus datos.',
          pasos: [
            'Con «✏️ Editar» cambiás los datos del trayecto (horarios, docente, sede, fechas).',
            '«📖 Ver Clases y Actividades» muestra clases, asistencia, notas, libro de temas y planificación.',
            'Podés importar estudiantes de un archivo CSV o Excel y registrar bajas o reincorporaciones.'
          ]
        },
        admin: {
          que: 'Todos los trayectos del CFP, con edición de sus datos.',
          pasos: [
            'Con «✏️ Editar» cambiás los datos del trayecto (horarios, docente, sede, fechas).',
            '«📖 Ver Clases y Actividades» muestra clases, asistencia, notas, libro de temas y planificación.',
            'Podés importar estudiantes de un archivo CSV o Excel y registrar bajas o reincorporaciones.'
          ]
        }
      }
    },

    seguimiento: {
      t: 'Seguimiento', roles: ['docente', 'preceptor', 'regente', 'admin'],
      corto: 'Estudiantes en riesgo y bajas automáticas.',
      que: 'Panel para detectar a tiempo a los estudiantes que están en riesgo de baja.',
      pasos: [
        'Muestra tus trayectos del ciclo actual (todos, si sos Director, Regente o Preceptor) con el estado de cada estudiante.',
        'Un estudiante queda «en riesgo» cuando un módulo ya cerró y todavía no tiene nota. Pasa a baja automática cuando el módulo cerró con nota menor a 70.',
        'Si tu rol lo permite, «Registrar bajas automáticas» guarda esas bajas en las inscripciones.'
      ],
      ojo: [
        'Una habilitación excepcional del docente evita la baja automática.',
        'Si a alguien se lo reincorpora, no vuelve a darse de baja solo. Reincorporar solo pueden Dirección, Regencia y Preceptoría.'
      ],
      porRol: {
        docente: { pasos: [
          'Muestra tus trayectos del ciclo actual con el estado de cada estudiante.',
          'Un estudiante queda «en riesgo» cuando un módulo ya cerró y todavía no tiene nota; pasa a baja automática cuando cerró con menos de 70.',
          'Las bajas automáticas las registra Dirección, Regencia o Preceptoría; vos podés avisarles y dar la habilitación excepcional cuando corresponda.'
        ] }
      }
    },

    secretaria: {
      t: 'Cifras por trayecto', roles: ['secretaria', 'preceptor', 'regente', 'admin'],
      corto: 'Totales por trayecto y matrícula escolar.',
      que: 'Resumen de inscriptos y datos por trayecto para completar planillas y relevamientos.',
      pasos: [
        'Elegí el ciclo lectivo y revisá los totales por trayecto.',
        '«📊 Descargar Excel» o «📋 Copiar tabla» sacan los datos para pegarlos donde los necesites.',
        '«🏫 Matrícula escolar» arma los cuadros del Relevamiento Anual (alumnos por certificado, sexo y edad).',
        '«📑 Planilla de matrícula (POF/POFA)» abre la planilla mensual lista para imprimir.'
      ]
    },

    preinscripciones: {
      t: 'Preinscripciones', roles: ['docente', 'preceptor', 'regente', 'admin'],
      corto: 'Solicitudes de inscripción online.',
      que: 'Bandeja de las preinscripciones que llegan por el formulario público de la web.',
      pasos: [
        'Cada preinscripción trae la ficha completa. Si hace falta, se corrige antes de confirmar.',
        'Cuando el CFP contacta a la persona y se confirma, «Confirmar» crea su cuenta (si no tenía) y la inscribe en el trayecto.',
        'La ficha en PDF se guarda sola en Drive, ordenada por ciclo y trayecto.',
        'Desde el panel se abre o se cierra la inscripción online y se descarga el QR para imprimir.'
      ],
      ojo: ['Quien tiene la cuenta inactiva por cierre de año se reactiva sola al confirmarle una inscripción.'],
      porRol: {
        docente: {
          que: 'Podés consultar las preinscripciones de tus trayectos (solo lectura).',
          pasos: ['Revisá quiénes se anotaron en tus trayectos.', 'Confirmar o rechazar lo hacen Dirección, Regencia y Preceptoría.'],
          ojo: []
        }
      }
    },

    cuentas: {
      t: 'Cuentas y claves', roles: ['preceptor', 'regente'],
      corto: 'Restablecer claves y aprobar registros.',
      que: 'Ayuda a estudiantes y docentes que no pueden entrar.',
      pasos: [
        'Buscá a la persona por DNI o apellido.',
        '«🔑 Restablecer clave» deja la contraseña en CFP403_ seguida del DNI y cierra las sesiones abiertas. Avisale a la persona para que la cambie.',
        '«✓ Aprobar» habilita a los estudiantes que se registraron por su cuenta.'
      ],
      ojo: ['Los roles y las cuentas del personal los gestiona el Director.']
    },

    observaciones: {
      t: 'Observaciones', roles: ['docente', 'preceptor', 'regente', 'admin', 'secretaria'],
      corto: 'Registro institucional de observaciones.',
      que: 'Registro compartido por el personal de situaciones y seguimientos de estudiantes.',
      pasos: [
        '«➕ Nueva observación» registra una situación; «➕ Agregar seguimiento» suma novedades a una ya abierta.',
        'Se puede adjuntar un acta o correo y verlo con «📎 Ver acta o correo».',
        '«✏️ Corregir» y «🗑️ Eliminar» ajustan lo cargado.'
      ],
      ojo: ['Es información interna: no la ven los estudiantes.']
    },

    cooperadora: {
      t: 'Cooperadora', roles: ['docente', 'preceptor', 'regente', 'admin', 'secretaria'],
      corto: 'Socios, caja, balance, PIA y nómina de la comisión.',
      que: 'Gestión de la Cooperadora Escolar.',
      pasos: [
        'Socios: padrón con categoría, contacto y cobro de cuota social.',
        'Ingresos y Egresos: cada movimiento lleva fecha, rubro, monto y comprobante.',
        'Balance: mensual y anual, igual al cuadro 8 del PIA.',
        'Ejercicio / PIA: cada ejercicio va del 01/05 al 30/04. Ahí se cargan sus datos, la comisión (cuadros 4, 5 y 6) y se genera el PIA en PDF.',
        'Nómina de autoridades: se arma sola con la comisión del ejercicio y se imprime con firmas.',
        'Constancias: comprobantes de la cooperadora.'
      ],
      ojo: ['No se pueden cargar movimientos con fecha fuera de un ejercicio creado: primero se crea el ejercicio siguiente.'],
      porRol: {
        docente: {
          que: 'Podés ver e imprimir la nómina de autoridades de la comisión directiva.',
          pasos: ['Elegí el ejercicio y descargá el PDF para imprimir y firmar.'], ojo: []
        },
        secretaria: {
          que: 'Podés ver el balance del mes y del año en curso, y la nómina de la comisión directiva.',
          pasos: ['Balance: totales por rubro del mes y año actuales.', 'Nómina de autoridades: elegí el ejercicio y descargá el PDF para imprimir y firmar.'],
          ojo: ['La carga la hacen Dirección, Regencia y Preceptoría.']
        }
      }
    },

    planilla: {
      t: 'Planilla de matrícula', roles: ['docente', 'preceptor', 'regente', 'admin', 'secretaria'],
      corto: 'Planilla mensual POF/POFA.',
      que: 'Planilla de información básica de matrícula mensual (POF/POFA).',
      pasos: [
        'Elegí el ciclo lectivo: se arma sola con los datos de los trayectos (fechas, horarios, horas y docente).',
        'Revisá los datos y descargala o imprimila.'
      ]
    },

    constancias: {
      t: 'Constancias', roles: ['preceptor', 'regente', 'admin', 'secretaria'],
      corto: 'Constancias de alumno regular y de examen.',
      que: 'Emisión de constancias en PDF.',
      pasos: ['Buscá al estudiante y elegí el tipo de constancia.', 'Se genera el PDF listo para imprimir y firmar.']
    },

    actas: {
      t: 'Fichas, actas y certificados', roles: ['secretaria', 'preceptor', 'regente', 'admin'],
      corto: 'Fichas de curso, actas de examen y certificados.',
      que: 'Documentos de cierre de cada trayecto, en tres botones dentro de la misma pantalla.',
      pasos: [
        'Fichas de curso: nómina de estudiantes con su situación (cursando o baja). «Ficha de Curso (Excel)» descarga la planilla.',
        'Actas de examen: la nota de cada módulo sale de las actividades y la asistencia. Podés escribir otra nota en la casilla (queda en amarillo); borrala para volver a la calculada. «Descargar acta (Excel)» saca el acta oficial; EQ indica equivalencia.',
        'Certificados: lista de aprobados con su N.º de egresado. Revisá la «Vista previa» y descargá los frentes; después, los reversos (mismo orden alfabético, con las hojas vueltas a poner en la bandeja).'
      ],
      ojo: ['El N.º de egresado lo asignan solo Director, Regente y Secretaría; lo ven ellos y Preceptoría.'],
      porRol: {
        secretaria: { pasos: [
          'Fichas de curso y Actas de examen: podés ver e imprimir; la carga y los ajustes los hacen Dirección y Regencia.',
          'Certificados: asignás el N.º de egresado de cada aprobado. Escribilo y se guarda al salir de la casilla; si el número ya existe, te avisa. La impresión de certificados la hacen Dirección y Regencia.'
        ] },
        preceptor: {
          que: 'Podés ver los N.º de egresado de los estudiantes aprobados de cada trayecto.',
          pasos: ['Elegí el ciclo y el trayecto en «Certificados» para ver la lista de aprobados con su N.º de egresado.'],
          ojo: ['Los N.º de egresado los asignan Director, Regente y Secretaría.']
        }
      }
    },

    dashboard: {
      t: 'Dashboard', roles: ['regente', 'admin'], corto: 'Panorama general del CFP.',
      que: 'Resumen de trayectos activos, matrícula, aprobados y certificados.',
      pasos: ['Mirá los indicadores principales y el rendimiento por trayecto.', 'Las acciones rápidas llevan a las tareas más usadas.']
    },

    'nuevo-trayecto': {
      t: 'Cargar trayecto', roles: ['regente', 'admin'], corto: 'Dar de alta un trayecto formativo.',
      que: 'Alta de un trayecto nuevo.',
      pasos: ['Completá nombre, ciclo lectivo, sede, docente, fechas y horario.', 'Si tiene módulos, definilos con sus fechas: de eso dependen las bajas automáticas.']
    },

    novedades: {
      t: 'Novedades y calendario', roles: ['docente', 'preceptor', 'regente', 'admin'], corto: 'Avisos y fechas importantes.',
      que: 'Avisos que se muestran a los usuarios y calendario.',
      pasos: ['«Publicar» crea un aviso; podés editarlo, ocultarlo o borrarlo.'],
      porRol: {
        docente: { pasos: ['Publicás avisos internos para tus trayectos.'] },
        preceptor: { pasos: ['Publicás avisos internos para los trayectos.'] },
        regente: { pasos: ['Publicás avisos generales para todos y avisos para trayectos puntuales.'] },
        admin: { pasos: ['Publicás avisos generales para todos y avisos para trayectos puntuales.'] }
      }
    },

    usuarios: {
      t: 'Usuarios y roles', roles: ['admin'], corto: 'Altas, roles, correos y cierre de año.',
      que: 'Gestión de todas las cuentas de la plataforma (solo Director).',
      pasos: [
        '«+ Crear nuevo usuario» da de alta personal o estudiantes y asigna el rol.',
        'Con ✏️ corregís apellido, nombre o correo. En el personal, el correo también cambia el de acceso.',
        '«Inhabilitar» bloquea una cuenta a mano; «Reactivar» la vuelve a habilitar.',
        '«🗓️ Cierre de año» pasa a INACTIVO a los estudiantes sin inscripción vigente en el ciclo siguiente: ves la lista y elegís a quién. No se borra nada, y se reactivan solos al volver a inscribirse.'
      ],
      ojo: ['INACTIVO es el estado del cierre de año; INHABILITADO es el bloqueo manual y nunca se reactiva solo.']
    },

    backups: {
      t: 'Base de datos', roles: ['admin'], corto: 'Espacio usado y respaldos.',
      que: 'Indicador de espacio de la base y respaldos (solo Director).',
      pasos: ['Revisá el espacio usado respecto del límite del plan gratuito.', 'Los respaldos de auditoría se guardan solos cada semana en Drive.']
    },

    estadisticas: {
      t: 'Estadísticas', roles: ['regente', 'admin'], corto: 'Egreso, deserción y estudiantes en varios trayectos.',
      que: 'Datos para fundamentar decisiones de planificación.',
      pasos: ['Agrupá por especialidad o por sector.', 'El % de egreso se calcula sobre trayectos ya finalizados; el % de deserción cuenta todas las bajas.']
    },

    auditoria: {
      t: 'Auditoría', roles: ['regente', 'admin'], corto: 'Quién cambió qué y cuándo.',
      que: 'Registro de cambios hechos en la plataforma.',
      pasos: ['Filtrá por persona, fecha o tipo de dato; «Limpiar filtros» vuelve a la lista completa.', '«Ver cambios anteriores» muestra el valor previo de un dato modificado.']
    }
  },

  // Botón del menú -> tema
  BOTON_TEMA: {
    'btn-dashboard': 'dashboard', 'btn-progreso': 'progreso', 'btn-seguimiento': 'seguimiento',
    'btn-secretaria': 'secretaria', 'btn-preinscripciones': 'preinscripciones', 'btn-cuentas': 'cuentas',
    'btn-observaciones': 'observaciones', 'btn-cooperadora': 'cooperadora', 'btn-planilla': 'planilla',
    'btn-constancias': 'constancias', 'btn-trayectos': 'trayectos', 'btn-actas': 'actas',
    'btn-nuevo-trayecto': 'nuevo-trayecto', 'btn-novedades': 'novedades',
    'btn-usuarios': 'usuarios', 'btn-backups': 'backups', 'btn-estadisticas': 'estadisticas', 'btn-auditoria': 'auditoria'
  },

  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  /* ---------- rol y contenido ---------- */
  rol() {
    const p = (window.Auth && Auth.usuarioActual) || {};
    let r = String(p.rol || '').toLowerCase().trim();
    if (r === 'administrador') r = 'admin';
    return this.ROLES[r] ? r : 'estudiante';
  },

  tema(id, rol) {
    const t = this.TEMAS[id];
    if (!t || !t.roles.includes(rol)) return null;
    const o = (t.porRol && t.porRol[rol]) || {};
    return { id, t: t.t, corto: t.corto, que: o.que || t.que, pasos: o.pasos || t.pasos || [], ojo: o.ojo !== undefined ? o.ojo : (t.ojo || []) };
  },

  temasDelRol(rol) {
    return Object.keys(this.TEMAS).map(id => this.tema(id, rol)).filter(Boolean);
  },

  /* ---------- 1) sección «Ayuda y guía» ---------- */
  cargar() {
    const cont = document.getElementById('ayuda-contenido');
    if (!cont) return;
    const rol = this.rol();
    const temas = this.temasDelRol(rol);
    cont.innerHTML = `
      <div class="ayuda-wrap">
        <div class="ayuda-cab">
          <div>
            <h3>Ayuda y guía de uso</h3>
            <p>Esta guía muestra solo lo que corresponde a tu rol: <strong>${this.esc(this.ROLES[rol])}</strong>.</p>
          </div>
          <div class="ayuda-acciones">
            <button type="button" class="btn btn-gold" onclick="AyudaModulo.iniciarRecorrido()">▶ Ver recorrido guiado</button>
            <button type="button" class="btn btn-outline" onclick="AyudaModulo.descargarPDF()">📄 Descargar guía en PDF</button>
          </div>
        </div>
        ${temas.map((t, i) => `
          <details class="ayuda-tema"${i === 0 ? ' open' : ''}>
            <summary>${this.esc(t.t)}</summary>
            ${this.htmlTema(t)}
          </details>`).join('')}
        <p class="ayuda-pie">¿No encontrás lo que buscás? Consultá con la administración del CFP.</p>
      </div>`;
  },

  htmlTema(t) {
    return `
      <p class="ayuda-que">${this.esc(t.que)}</p>
      ${t.pasos.length ? `<ol>${t.pasos.map(p => `<li>${this.esc(p)}</li>`).join('')}</ol>` : ''}
      ${t.ojo && t.ojo.length ? `<div class="ayuda-ojo"><strong>Tené en cuenta</strong><ul>${t.ojo.map(o => `<li>${this.esc(o)}</li>`).join('')}</ul></div>` : ''}`;
  },

  /* ---------- 2) «?» de la pantalla actual ---------- */
  deEstaPantalla() {
    const rol = this.rol();
    let t = this.tema(this.tabActual, rol);
    if (!t && this.tabActual === 'ayuda') t = { t: 'Ayuda y guía', que: 'Acá está toda la guía de tu rol, con el recorrido guiado y el PDF para descargar.', pasos: [], ojo: [] };
    if (!t) t = { t: 'Ayuda', que: 'Para esta pantalla no hay una explicación particular. En «Ayuda y guía» (menú) tenés la guía completa de tu rol.', pasos: [], ojo: [] };
    const html = `<div class="ayuda-popup">${this.htmlTema(t)}</div>`;
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: t.t, html, width: 620, showCancelButton: true, confirmButtonText: 'Entendido',
        cancelButtonText: 'Ver guía completa', reverseButtons: true, focusConfirm: true
      }).then(r => { if (r.dismiss === Swal.DismissReason.cancel && window.UI) UI.showTab('ayuda'); });
    } else {
      alert(t.t + '\n\n' + t.que + '\n\n' + t.pasos.map((p, i) => (i + 1) + '. ' + p).join('\n'));
    }
  },

  /* ---------- 3) recorrido guiado ---------- */
  claveRecorrido() {
    const p = (window.Auth && Auth.usuarioActual) || {};
    return 'cfp403_recorrido_v1_' + String(p.id || p.dni || 'u');
  },

  yaVioRecorrido() {
    try { return localStorage.getItem(this.claveRecorrido()) === '1'; } catch (e) { return !!this._visto; }
  },
  marcarVisto() {
    this._visto = true;
    try { localStorage.setItem(this.claveRecorrido(), '1'); } catch (e) { /* sin almacenamiento */ }
  },

  iniciarSiPrimeraVez() {
    if (this._corriendo || this.yaVioRecorrido()) return;
    if (!window.Auth || !Auth.usuarioActual) return;
    const app = document.getElementById('app-screen');
    if (!app || app.style.display === 'none') return;
    this.iniciarRecorrido();
  },

  esCelular() {
    const b = document.getElementById('btn-menu-movil');
    return !!(b && getComputedStyle(b).display !== 'none');
  },

  visible(el) {
    return !!(el && getComputedStyle(el).display !== 'none' && el.getClientRects().length);
  },

  armarPasos() {
    const rol = this.rol();
    const pasos = [{
      titulo: '¡Bienvenido/a a la plataforma del ' + this.NOMBRE_CORTO + '!',
      texto: `Te mostramos rápido lo que podés hacer como <strong>${this.esc(this.ROLES[rol])}</strong>. Podés salir cuando quieras y volver a verlo desde «Ayuda y guía».`
    }];
    document.querySelectorAll('.sidebar-nav .nav-item-btn').forEach(b => {
      if (!this.visible(b)) return;
      const tema = this.tema(this.BOTON_TEMA[b.id], rol);
      if (b.id === 'btn-ayuda') {
        pasos.push({ el: b, lateral: true, titulo: 'Ayuda y guía', texto: 'Acá está la guía completa de tu rol, este recorrido y la guía en PDF para descargar.' });
      } else if (tema) {
        pasos.push({ el: b, lateral: true, titulo: tema.t, texto: tema.corto || tema.que });
      }
    });
    const clave = [...document.querySelectorAll('.sidebar button')].find(b => /Cambiar mi contraseña/.test(b.textContent));
    if (this.visible(clave)) pasos.push({ el: clave, lateral: true, titulo: 'Tu contraseña', texto: 'Cambiala por una propia la primera vez que entres.' });
    const inst = document.querySelector('.sidebar .app-boton-instalar');
    if (this.visible(inst)) pasos.push({ el: inst, lateral: true, titulo: 'Instalar la app', texto: 'Dejá la plataforma como un ícono en tu celular o computadora.' });
    const q = document.getElementById('btn-ayuda-pantalla');
    if (this.visible(q)) pasos.push({ el: q, lateral: false, titulo: 'El botón «?»', texto: 'En cualquier pantalla, tocá este botón y te explica para qué sirve y cómo se usa.' });
    pasos.push({ titulo: '¡Listo!', texto: 'Cualquier duda, entrá en «Ayuda y guía». ¡Que te sea de mucha utilidad!' });
    return pasos;
  },

  iniciarRecorrido() {
    this.cerrarRecorrido(false);
    this._pasos = this.armarPasos();
    this._i = 0;
    this._corriendo = true;
    this._celular = this.esCelular();
    const v = document.createElement('div');
    v.id = 'ayuda-tour';
    v.innerHTML = '<div class="ayuda-tour-foco"></div><div class="ayuda-tour-card" role="dialog" aria-live="polite"></div>';
    document.body.appendChild(v);
    this._teclas = e => { if (e.key === 'Escape') this.cerrarRecorrido(true); else if (e.key === 'ArrowRight') this.siguiente(); else if (e.key === 'ArrowLeft') this.anterior(); };
    this._resize = () => this.mostrarPaso();
    document.addEventListener('keydown', this._teclas);
    window.addEventListener('resize', this._resize);
    this.mostrarPaso();
  },

  siguiente() { if (this._i >= this._pasos.length - 1) return this.cerrarRecorrido(true); this._i++; this.mostrarPaso(); },
  anterior() { if (this._i > 0) { this._i--; this.mostrarPaso(); } },

  cerrarRecorrido(marcar) {
    const v = document.getElementById('ayuda-tour');
    if (v) v.remove();
    if (this._teclas) document.removeEventListener('keydown', this._teclas);
    if (this._resize) window.removeEventListener('resize', this._resize);
    if (this._celular && window.UI && UI.toggleMenu) UI.toggleMenu(false);
    this._corriendo = false;
    if (marcar) this.marcarVisto();
  },

  mostrarPaso() {
    const v = document.getElementById('ayuda-tour');
    if (!v) return;
    const p = this._pasos[this._i], total = this._pasos.length;
    const foco = v.querySelector('.ayuda-tour-foco'), card = v.querySelector('.ayuda-tour-card');
    if (this._celular && window.UI && UI.toggleMenu) UI.toggleMenu(!!(p.el && p.lateral));
    card.innerHTML = `
      <button type="button" class="ayuda-tour-x" aria-label="Cerrar recorrido">×</button>
      <h4>${p.titulo}</h4>
      <p>${p.texto}</p>
      <div class="ayuda-tour-pie">
        <span>${this._i + 1} / ${total}</span>
        <span>
          ${this._i > 0 ? '<button type="button" class="ayuda-tour-ant">Anterior</button>' : ''}
          <button type="button" class="ayuda-tour-sig">${this._i === total - 1 ? 'Finalizar' : 'Siguiente'}</button>
        </span>
      </div>`;
    card.querySelector('.ayuda-tour-x').onclick = () => this.cerrarRecorrido(true);
    card.querySelector('.ayuda-tour-sig').onclick = () => this.siguiente();
    const ant = card.querySelector('.ayuda-tour-ant');
    if (ant) ant.onclick = () => this.anterior();

    const colocar = () => {
      const m = 12, cw = Math.min(340, window.innerWidth - 2 * m);
      card.style.width = cw + 'px';
      if (!p.el) {
        foco.style.cssText = 'left:50%;top:50%;width:0;height:0;';
        card.style.left = Math.max(m, (window.innerWidth - cw) / 2) + 'px';
        card.style.top = Math.max(m, window.innerHeight / 2 - card.offsetHeight / 2) + 'px';
        return;
      }
      const r = p.el.getBoundingClientRect(), pad = 5;
      foco.style.left = (r.left - pad) + 'px'; foco.style.top = (r.top - pad) + 'px';
      foco.style.width = (r.width + 2 * pad) + 'px'; foco.style.height = (r.height + 2 * pad) + 'px';
      const ch = card.offsetHeight;
      let left = r.right + 16, top = r.top + r.height / 2 - ch / 2;
      if (left + cw > window.innerWidth - m) {            // no entra a la derecha: debajo del elemento
        left = Math.min(Math.max(m, r.left), window.innerWidth - cw - m);
        top = r.bottom + 14;
      }
      if (top + ch > window.innerHeight - m) top = window.innerHeight - ch - m;
      card.style.left = left + 'px'; card.style.top = Math.max(m, top) + 'px';
    };
    if (p.el && p.el.scrollIntoView) p.el.scrollIntoView({ block: 'center', inline: 'nearest' });
    colocar();
    setTimeout(colocar, 260);   // espera a que termine de abrirse el menú en celulares
    setTimeout(colocar, 650);
  },

  /* ---------- PDF de la guía (según el rol) ---------- */
  limpio(t) {
    return String(t ?? '').replace(/☰/g, 'de tres rayas').replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu, '')
      .replace(/«\s+/g, '«').replace(/\s+»/g, '»').replace(/[‘’]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, '-').replace(/[•●]/g, '-')
      .replace(/\r?\n/g, ' ').replace(/[^\x20-\x7E -ÿ]/g, '').replace(/\s{2,}/g, ' ').trim();
  },

  async descargarPDF() {
    try {
      if (typeof PDFLib === 'undefined') throw new Error('No se pudo cargar el generador de PDF');
      const { PDFDocument, StandardFonts, rgb } = PDFLib;
      const rol = this.rol(), temas = this.temasDelRol(rol);
      const doc = await PDFDocument.create();
      const fN = await doc.embedFont(StandardFonts.Helvetica), fB = await doc.embedFont(StandardFonts.HelveticaBold);
      const W = 595, H = 842, M = 54, ancho = W - 2 * M, INK = rgb(0.06, 0.09, 0.16), GRIS = rgb(0.33, 0.38, 0.47), AZUL = rgb(0.06, 0.2, 0.45);
      let logo = null;
      try { const r = await fetch('img/logo-cfp-ficha.png'); if (r.ok) logo = await doc.embedPng(new Uint8Array(await r.arrayBuffer())); } catch (e) { /* sin logo */ }
      let pag, y;
      const nueva = () => { pag = doc.addPage([W, H]); y = H - M; };
      const lineas = (txt, font, size, w) => {
        const pal = this.limpio(txt).split(' '), out = []; let l = '';
        pal.forEach(p => { const t = l ? l + ' ' + p : p; if (font.widthOfTextAtSize(t, size) > w && l) { out.push(l); l = p; } else l = t; });
        if (l) out.push(l); return out;
      };
      const escribir = (txt, { font = fN, size = 10, color = INK, sangria = 0, gap = 3, pre = '' } = {}) => {
        const ls = lineas(txt, font, size, ancho - sangria - (pre ? 12 : 0));
        ls.forEach((l, k) => {
          if (y < M + 30) nueva();
          if (pre && k === 0) pag.drawText(pre, { x: M + sangria, y, size, font, color });
          pag.drawText(l, { x: M + sangria + (pre ? 12 : 0), y, size, font, color });
          y -= size + gap;
        });
      };
      nueva();
      if (logo) { const s = logo.scaleToFit(48, 48); pag.drawImage(logo, { x: W - M - s.width, y: H - M - s.height + 6, width: s.width, height: s.height }); }
      pag.drawText('Guía de uso de la plataforma', { x: M, y: y - 10, size: 20, font: fB, color: AZUL }); y -= 32;
      escribir(this.NOMBRE_PDF, { size: 11, color: GRIS });
      escribir('Rol: ' + this.ROLES[rol], { font: fB, size: 11 });
      y -= 8;
      temas.forEach(t => {
        if (y < M + 90) nueva();
        y -= 6;
        escribir(t.t, { font: fB, size: 13, color: AZUL, gap: 5 });
        escribir(t.que, { size: 10, color: GRIS, gap: 4 });
        t.pasos.forEach((p, i) => escribir(p, { sangria: 8, pre: (i + 1) + '.', gap: 3 }));
        if (t.ojo && t.ojo.length) {
          escribir('Tené en cuenta:', { font: fB, size: 10, sangria: 8, gap: 3 });
          t.ojo.forEach(o => escribir(o, { sangria: 14, pre: '-', gap: 3 }));
        }
        y -= 6;
      });
      doc.getPages().forEach((p, i, a) => p.drawText(`Página ${i + 1} de ${a.length}`, { x: W / 2 - 28, y: 28, size: 8, font: fN, color: GRIS }));
      const bytes = await doc.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `Guia_de_uso_${rol}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      alert('No se pudo generar la guía: ' + (err.message || ''));
    }
  }
};
window.AyudaModulo = AyudaModulo;
