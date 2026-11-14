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
6. **Desplegar** la función `subir-preinscripcion-drive` pegando `index.ts`, con **Verify JWT desactivado** (la función se autentica sola).
7. Ejecutar `sql/47_preinscripciones_drive.sql` y después `sql/64_secreto_interno_funciones.sql` (crea la clave interna con la que la base llama a la función).

Seguridad: la URL del puente es «pública», pero sin la clave `SECRETO` no hace nada.
Si se cambia el código del script, hay que crear una **nueva implementación** (o editar la existente → Versión nueva).

## Autenticación y huella del generador de PDF
- La función solo acepta: (a) el encabezado `x-internal-secret` que manda la base (clave guardada en Vault, función `public.secreto_interno()`), o (b) la sesión de una persona de admin, regencia o preceptoría activa. Todo lo demás recibe 401.
- El generador de PDF (`js/ficha_inscripcion.js`) se baja del sitio, pero **solo se ejecuta si su huella SHA-256 coincide** con la constante `FICHA_SHA256` de `index.ts`. Si cambiás ese archivo: `node scripts/huella-ficha.js`, pegá la huella nueva en `index.ts` y volvé a desplegar la función (`scripts/verificar.sh` te avisa si te olvidás).
