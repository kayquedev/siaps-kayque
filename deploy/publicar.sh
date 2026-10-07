#!/usr/bin/env bash
# Publica o SIAPS (site estático) em https://siaps.kayque.site
#
# Uso (a partir da raiz do projeto):
#   bash deploy/publicar.sh
#
# Só publica o que já está commitado e enviado ao GitHub (HEAD == origin/main).
# Variáveis opcionais: SIAPS_HOST, SIAPS_CHAVE, SIAPS_DESTINO
set -euo pipefail

HOST="${SIAPS_HOST:-kayquedev@137.131.232.39}"
CHAVE="${SIAPS_CHAVE:-C:/Users/kayqu/.ssh/siaps_deploy}"
DESTINO="${SIAPS_DESTINO:-/var/www/siaps.kayque.site/html}"
URL="https://siaps.kayque.site"

cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "Há mudanças não commitadas. Faça commit e push antes de publicar." >&2
  exit 1
fi
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "HEAD difere de origin/main. Faça push antes de publicar." >&2
  exit 1
fi

echo "Enviando $(git rev-parse --short HEAD) para $HOST:$DESTINO ..."
git archive HEAD index.html css js \
  | ssh -o IdentitiesOnly=yes -i "$CHAVE" "$HOST" "sudo rm -rf '$DESTINO'/index.html '$DESTINO'/css '$DESTINO'/js && sudo tar -x -C '$DESTINO' && sudo chown -R kayquedev:kayquedev '$DESTINO'"

# confere se o servidor já serve o arquivo publicado
if [ "$(curl -s "$URL/js/app.js?x=$RANDOM" | tr -d '[:cntrl:]' | md5sum)" = "$(git show HEAD:js/app.js | tr -d '[:cntrl:]' | md5sum)" ]; then
  echo "OK: $URL está com a versão $(git rev-parse --short HEAD)."
else
  echo "Aviso: o app.js servido difere do local; confira no navegador com Ctrl+F5." >&2
fi
