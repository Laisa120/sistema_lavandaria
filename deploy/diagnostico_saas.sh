#!/usr/bin/env bash
set -euo pipefail

API_URL="${1:-https://api.genomni.com}"
APP_ORIGIN="${2:-https://app.genomni.com}"
ADMIN_ORIGIN="${3:-https://admin.genomni.com}"

echo "== Diagnóstico SaaS GenOmni =="
echo "API_URL:      $API_URL"
echo "APP_ORIGIN:   $APP_ORIGIN"
echo "ADMIN_ORIGIN: $ADMIN_ORIGIN"
echo

failures=0

check_http_code() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local code

  code="$(curl -sS -o /tmp/genomni_diag_body.txt -w "%{http_code}" "$url" || true)"
  if [[ "$code" == "$expected" ]]; then
    echo "[OK]  $label ($code)"
  else
    echo "[ERRO] $label (esperado $expected, recebido $code)"
    failures=$((failures + 1))
  fi
}

check_cors() {
  local origin="$1"
  local code
  local allow_origin

  code="$(
    curl -sS -o /tmp/genomni_diag_cors.txt -D /tmp/genomni_diag_headers.txt -w "%{http_code}" \
      -X OPTIONS "${API_URL}/api/settings/register" \
      -H "Origin: ${origin}" \
      -H "Access-Control-Request-Method: POST" \
      -H "Access-Control-Request-Headers: content-type" || true
  )"

  allow_origin="$(grep -i '^access-control-allow-origin:' /tmp/genomni_diag_headers.txt | tr -d '\r' | awk -F': ' '{print $2}' | tail -n1)"

  if [[ "$code" =~ ^(200|204)$ ]] && [[ -n "$allow_origin" ]]; then
    echo "[OK]  CORS preflight para ${origin} (status ${code}, allow-origin ${allow_origin})"
  else
    echo "[ERRO] CORS preflight para ${origin} (status ${code}, allow-origin '${allow_origin:-vazio}')"
    failures=$((failures + 1))
  fi
}

check_register_reachable() {
  local origin="$1"
  local code

  code="$(
    curl -sS -o /tmp/genomni_diag_register.txt -w "%{http_code}" \
      -X POST "${API_URL}/api/settings/register" \
      -H "Origin: ${origin}" \
      -H "Content-Type: application/json" \
      --data '{}' || true
  )"

  if [[ "$code" =~ ^(201|422)$ ]]; then
    echo "[OK]  POST /api/settings/register acessível para ${origin} (status ${code})"
  else
    echo "[ERRO] POST /api/settings/register falhou para ${origin} (status ${code})"
    failures=$((failures + 1))
  fi
}

check_http_code "Healthcheck /up" "${API_URL}/up" "200"
check_http_code "Bootstrap /api/bootstrap" "${API_URL}/api/bootstrap" "200"
echo
check_cors "$APP_ORIGIN"
check_cors "$ADMIN_ORIGIN"
echo
check_register_reachable "$APP_ORIGIN"
check_register_reachable "$ADMIN_ORIGIN"
echo

if [[ "$failures" -eq 0 ]]; then
  echo "Resultado: OK - ambiente SaaS pronto para cadastro em desktop e telemóvel."
else
  echo "Resultado: FALHA - ${failures} verificação(ões) com erro."
  exit 1
fi

