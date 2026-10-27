# Subida automática de preinscripciones a Drive (sin Google Cloud)

Cada preinscripción nueva se guarda como PDF en
`<Preinscripciones> / <ciclo> / <trayecto> / Ficha_inscripcion_<N.º>_<APELLIDO>.pdf`.

Cómo funciona: la base avisa a la función de Supabase `subir-preinscripcion-drive`, que arma el PDF y se lo manda
a un «puente» de Google Apps Script (gratis, sin tarjeta, sin Google Cloud). El puente corre con la cuenta dueña
del Drive y guarda el archivo en la carpeta.

Archivos: `index.ts` (función de Supabase) y `puente-drive.gs` (script de Google).

## Puesta en marcha (una sola vez)
1. Entrá a **script.google.com** con la cuenta dueña del Drive (ndinova@abc.gob.ar) → **Nuevo proyecto**.
2. Pegá el contenido de `puente-drive.gs`. En `CARPETA_RAIZ_ID` poné el id de la carpeta «Preinscripciones»
   (lo que va después de `/folders/` en su link).
3. Engranaje **Configuración del proyecto → Propiedades del script → Agregar propiedad**:
   nombre `SECRETO`, valor = una clave larga inventada (guardala, la vas a necesitar abajo).
4. **Implementar → Nueva implementación → Aplicación web**: *Ejecutar como: yo*; *Quién tiene acceso: cualquier persona*.
   Autorizá los permisos (aparece un aviso «app no verificada»: Configuración avanzada → Ir a… → Permitir).
   Copiá la **URL de la aplicación web**.
5. **Supabase → Edge Functions → Secrets**: `APPS_SCRIPT_URL` (la URL del paso 4), `APPS_SCRIPT_SECRET` (la clave del paso 3),
   y opcional `SITE_URL`.
6. **Desplegar** la función `subir-preinscripcion-drive` pegando `index.ts`, con **Verify JWT desactivado**.
7. Ejecutar `sql/47_preinscripciones_drive.sql`.

Seguridad: la URL del puente es «pública», pero sin la clave `SECRETO` no hace nada.
Si se cambia el código del script, hay que crear una **nueva implementación** (o editar la existente → Versión nueva).
