#!/usr/bin/env bash
# Controles automáticos antes de publicar la plataforma (y después, en GitHub Actions).
#   bash scripts/verificar.sh            → compara el árbol de trabajo contra HEAD (antes de commitear)
#   BASE=HEAD~1 bash scripts/verificar.sh → compara contra el commit anterior (lo usa GitHub Actions)
# Controla: sintaxis de los .js, que se hayan subido los ?v= de index.html y VERSION de sw.js cuando cambia un
# js/css, que existan los archivos que referencia index.html, que la huella de la ficha PDF esté al día y que no
# haya claves secretas en el repositorio.
set -u
cd "$(dirname "$0")/.."
BASE="${BASE:-HEAD}"
fallos=0
fallo() { echo "✗ $1"; fallos=$((fallos+1)); }
ok() { echo "✓ $1"; }

# 1. Sintaxis
malos=0
for f in js/*.js sw.js scripts/*.js; do
  [ -f "$f" ] || continue
  node --check "$f" 2>/tmp/err.txt || { fallo "Error de sintaxis en $f: $(head -3 /tmp/err.txt | tr '\n' ' ')"; malos=1; }
done
[ $malos -eq 0 ] && ok "Sintaxis de los .js"

# 2. Versionado de cache (?v= y VERSION)
cambiados=$(git diff --name-only "$BASE" -- js css index.html sw.js 2>/dev/null)
if git rev-parse --verify -q "$BASE" >/dev/null && [ -n "$cambiados" ]; then
  base_index=$(git show "$BASE:index.html" 2>/dev/null || true)
  sin=0
  for f in $(echo "$cambiados" | grep -E '^(js|css)/'); do
    [ -f "$f" ] || continue
    nuevo=$(grep -oE "${f//./\\.}\?v=[^\"']+" index.html | head -1)
    viejo=$(printf '%s' "$base_index" | grep -oE "${f//./\\.}\?v=[^\"']+" | head -1)
    if [ -n "$nuevo" ] && [ "$nuevo" = "$viejo" ]; then fallo "Se modificó $f pero no se subió su ?v= en index.html ($nuevo)"; sin=1; fi
  done
  [ $sin -eq 0 ] && ok "Parámetros ?v= al día"
  if echo "$cambiados" | grep -qE '^(js|css)/|^index.html$'; then
    vn=$(grep -oE "VERSION *= *'[^']+'" sw.js | head -1)
    vv=$(git show "$BASE:sw.js" 2>/dev/null | grep -oE "VERSION *= *'[^']+'" | head -1)
    if [ -n "$vn" ] && [ "$vn" = "$vv" ]; then fallo "Cambiaron archivos de la app pero no se subió VERSION en sw.js ($vn)"; else ok "VERSION de sw.js subida"; fi
  fi
else
  ok "Sin cambios de js/css para controlar versiones"
fi

# 3. Archivos referenciados por index.html
faltan=0
for ruta in $(grep -oE '(src|href)="(js|css|img)/[^"?]+' index.html | sed -E 's/^(src|href)="//' | sort -u); do
  [ -f "$ruta" ] || { fallo "index.html referencia $ruta y no existe"; faltan=1; }
done
[ $faltan -eq 0 ] && ok "Archivos referenciados por index.html"

# 4. Huella del generador de PDF de la función de Drive
node scripts/huella-ficha.js --check >/dev/null 2>&1 && ok "Huella de la ficha al día" || fallo "js/ficha_inscripcion.js cambió: actualizar FICHA_SHA256 (node scripts/huella-ficha.js) y volver a desplegar subir-preinscripcion-drive"

# 5. Claves secretas en el repositorio
secretos=$(node -e '
const fs=require("fs"),cp=require("child_process");
const archivos=cp.execSync("git ls-files",{encoding:"utf8"}).split("\n").filter(f=>f&&!/\.(png|jpe?g|pdf|ico|webp|woff2?)$/i.test(f)&&fs.existsSync(f));
const out=[];
for(const f of archivos){
  let t="";try{t=fs.readFileSync(f,"utf8")}catch(e){continue}
  if(/sb_secret_[A-Za-z0-9_-]{10,}/.test(t)||/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t)) out.push(f+" (clave secreta)");
  for(const m of t.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)){
    try{const p=JSON.parse(Buffer.from(m[1],"base64").toString());if(p.role==="service_role")out.push(f+" (JWT service_role)")}catch(e){}
  }
}
console.log(out.join("\n"));')
if [ -n "$secretos" ]; then fallo "Posibles claves secretas en el repositorio:\n$secretos"; else ok "Sin claves secretas en el repositorio"; fi

echo
if [ $fallos -gt 0 ]; then echo "✗ $fallos control(es) fallaron"; exit 1; fi
echo "✓ Todos los controles pasaron"
