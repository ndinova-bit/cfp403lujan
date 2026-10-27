/**
 * Puente de Apps Script: recibe archivos de la función de Supabase y los guarda en Drive.
 * Se crea con la cuenta DUEÑA del Drive (el Drive de ndinova@abc.gob.ar). No usa Google Cloud ni cuesta nada.
 *  - Fichas de preinscripción (PDF)  →  Preinscripciones / <ciclo> / <trayecto>
 *  - Resguardo semanal de auditoría (CSV)  →  Auditoria / <año>
 */
var CARPETA_RAIZ_ID = '1JiGovgGse8pw9Px3QAmpCjWh_zwqu8bP';       // Preinscripciones
var CARPETA_AUDITORIA_ID = '1mCKIJ0C1v5iNViIrdJaScmeiQ6Te3nIc';   // Auditoria

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var secreto = PropertiesService.getScriptProperties().getProperty('SECRETO');
    if (!secreto || d.secreto !== secreto) return salida({ error: 'No autorizado' });

    var nombre = String(d.nombre);

    if (d.destino === 'auditoria') {
      var dirAnio = subcarpeta(DriveApp.getFolderById(CARPETA_AUDITORIA_ID), String(d.ciclo));
      var blobA = Utilities.newBlob(Utilities.base64Decode(d.contenido), d.mime || 'text/csv', nombre);
      // si ya existe un archivo con el mismo nombre (se repitió el envío), se reemplaza
      var previos = dirAnio.getFilesByName(nombre);
      while (previos.hasNext()) { previos.next().setTrashed(true); }
      var fa = dirAnio.createFile(blobA);
      return salida({ ok: true, archivo_id: fa.getId() });
    }

    var dirCiclo = subcarpeta(DriveApp.getFolderById(CARPETA_RAIZ_ID), String(d.ciclo));
    var dirTray = subcarpeta(dirCiclo, String(d.trayecto));
    var blob = Utilities.newBlob(Utilities.base64Decode(d.pdf), 'application/pdf', nombre);

    // si ya había una versión, se manda a la papelera y se guarda la nueva
    if (d.archivo_id) { try { DriveApp.getFileById(d.archivo_id).setTrashed(true); } catch (err) { /* ya no estaba */ } }
    var archivo = dirTray.createFile(blob);
    return salida({ ok: true, archivo_id: archivo.getId() });
  } catch (err) {
    return salida({ error: String(err) });
  }
}

function subcarpeta(padre, nombre) {
  nombre = nombre.replace(/[\\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 120) || 'Sin nombre';
  var it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function salida(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
