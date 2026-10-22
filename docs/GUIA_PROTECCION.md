# Guía de protección de la plataforma (CFP 403)

Cinco cosas para proteger lo que ya funciona. Cada sección dice **qué hacer una sola vez**.

## 0. Antes que nada: subir los archivos a GitHub
Subí **toda la carpeta**. Los dos archivos de `workflows_para_github` tienen que quedar en GitHub dentro de `.github/workflows/`: en GitHub usá *Add file → Create new file*, escribí `.github/workflows/backup-semanal.yml` como nombre, pegá el contenido y *Commit*; repetí con `mantener-activo.yml`. Después recargá la plataforma con **Ctrl + F5**.

## 1. Backups automáticos (cada domingo)
El archivo `.github/workflows/backup-semanal.yml` copia la base de datos y la guarda **cifrada** durante 90 días.

1. En Supabase: botón **Connect** (arriba) → pestaña **Session pooler** → copiá la cadena `postgresql://postgres.xxxx:[YOUR-PASSWORD]@...:5432/postgres` y reemplazá `[YOUR-PASSWORD]` por la contraseña de la base (*Project Settings → Database → Reset database password* si no la recordás).
2. En GitHub: repositorio → **Settings → Secrets and variables → Actions → New repository secret**. Creá dos:
   - `SUPABASE_DB_URL` → la cadena del paso 1.
   - `BACKUP_PASSPHRASE` → una frase larga inventada por vos. **Guardala en un lugar seguro: sin ella no se puede abrir ningún backup.**
3. Pestaña **Actions → Backup semanal de la base de datos → Run workflow** para probar. Tiene que quedar en verde.
4. Para bajar un backup: Actions → la ejecución → *Artifacts* → `respaldo-cifrado`. Para abrirlo (en una PC con GnuPG): `gpg -o respaldo.tar.gz -d respaldo-AAAA-MM-DD.tar.gz.gpg`.

Importante: el repositorio es público, por eso el backup va cifrado. Nunca subas un backup sin cifrar.

## 2. Entorno de pruebas (para probar sin tocar datos reales)
1. Supabase → **New project** (gratis). Nombre sugerido: `cfp403-pruebas`.
2. En el SQL Editor del proyecto nuevo, ejecutá en orden `sql/01…`, `02…`, `03…` y `04…`.
3. Desplegá las dos funciones (`importar-estudiantes`, `eliminar-usuario`) igual que en el proyecto real.
4. Abrí `js/entorno-prueba.js` y completá `url` y `anonKey` con los del proyecto nuevo (*Project Settings → API*).
5. Para usarlo, abrí la plataforma con `?entorno=prueba` al final de la dirección (aparece un cartel naranja). Para volver al real: `?entorno=produccion`.

Regla de oro: cualquier cambio nuevo se prueba primero ahí.

## 3. Evitar que Supabase pause el proyecto
`.github/workflows/mantener-activo.yml` hace una consulta mínima cada 3 días. No requiere configuración. Comprobá en **Actions** que figure y esté en verde. Aviso: GitHub desactiva las tareas programadas si el repositorio pasa 60 días sin ningún cambio; si pasa, entrá a Actions y presioná *Enable*.

## 4. Auditoría de cambios
1. Ejecutá `sql/04_auditoria_y_bajas.sql` en el SQL Editor. Al final tiene que listar las tablas con su disparador.
2. En la plataforma, como administrador: menú **🕵️ Auditoría**. Muestra quién cambió notas, roles, inscripciones, asistencias, clases, trayectos y módulos, con el valor anterior y el nuevo.

## 5. Contraseñas iniciales, bajas y eliminación
- Las cuentas nuevas (importación CSV o alta manual) ya **no** usan `CFP403_DNI`: tienen una contraseña aleatoria. Al terminar la importación aparece el botón **Descargar contraseñas (CSV)**; la planilla no se puede volver a generar (si alguien la pierde: 🔑 en Usuarios y Roles).
- **Inhabilitar** (recomendado): la persona no puede ingresar y conserva su historial; se puede **Reactivar**.
- **Eliminar definitivamente**: requiere desplegar la función `eliminar-usuario` (Supabase → Edge Functions → Deploy a new function → pegar `funciones_supabase/eliminar-usuario/index.ts`). Si la persona tiene historial pide confirmación extra, y lo borrado queda copiado en la Auditoría.
- Las cuentas ya creadas con `CFP403_DNI` conviene cambiarlas: pedile a cada estudiante que use **Cambiar mi contraseña**, o restablecelas con 🔑.

## 6. Seguridad del texto
Los títulos, comentarios y nombres que se escriben en la plataforma ahora se muestran como texto (no pueden ejecutar código), y los links de entrega solo se aceptan si empiezan con `http://` o `https://`.
