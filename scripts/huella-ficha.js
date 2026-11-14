#!/usr/bin/env node
// La función «subir-preinscripcion-drive» solo ejecuta js/ficha_inscripcion.js si su huella SHA-256 coincide con la
// constante FICHA_SHA256 de funciones_supabase/subir-preinscripcion-drive/index.ts (así, aunque alguien alterara el
// sitio publicado, la función no correría código ajeno con sus claves).
// Uso:  node scripts/huella-ficha.js           → muestra la huella actual
//       node scripts/huella-ficha.js --check   → falla si index.ts tiene otra huella (hay que actualizarla y volver a desplegar)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const raiz = path.join(__dirname, '..');
const huella = crypto.createHash('sha256').update(fs.readFileSync(path.join(raiz, 'js', 'ficha_inscripcion.js'))).digest('hex');
if (process.argv.includes('--check')) {
  const fn = fs.readFileSync(path.join(raiz, 'funciones_supabase', 'subir-preinscripcion-drive', 'index.ts'), 'utf8');
  const m = fn.match(/FICHA_SHA256\s*=\s*'([0-9a-f]{64})'/);
  if (!m || m[1] !== huella) { console.error('La huella de js/ficha_inscripcion.js cambió (' + huella + '). Actualizá FICHA_SHA256 en la función y volvé a desplegarla.'); process.exit(1); }
  console.log('Huella de la ficha al día'); process.exit(0);
}
console.log(huella);
