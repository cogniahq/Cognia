#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000/api}"
CORPUS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RICH_FILES_SCRIPT="${CORPUS_DIR}/generate-rich-files.sh"
STAMP="${STAMP:-$(date +%s)}"
EMAIL="${EMAIL:-competition-demo-${STAMP}@cognia.local}"
PASSWORD="${PASSWORD:-DemoPass2026!}"
ORG_NAME="${ORG_NAME:-Northstar Bank Deal Room Demo}"
ORG_SLUG="${ORG_SLUG:-northstar-bank-demo-${STAMP}}"

UPLOAD_FILES=(
  "01_master_services_agreement.txt"
  "02_data_processing_addendum.pdf"
  "03_security_overview.pdf"
  "04_service_level_agreement.txt"
  "05_order_form_and_pricing.pdf"
  "06_implementation_plan.docx"
  "07_security_questionnaire_response.txt"
  "08_customer_success_email_thread.txt"
  "09_executive_steering_committee_notes.txt"
  "10_sso_setup_guide.docx"
)

json_get() {
  node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const path = process.argv[1].split(".");
    let cur = data;
    for (const key of path) {
      cur = cur?.[key];
    }
    if (cur === undefined || cur === null) process.exit(2);
    process.stdout.write(typeof cur === "string" ? cur : JSON.stringify(cur));
  ' "$1"
}

mime_type_for_file() {
  case "$1" in
    *.txt) echo "text/plain" ;;
    *.md) echo "text/markdown" ;;
    *.pdf) echo "application/pdf" ;;
    *.docx) echo "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ;;
    *)
      echo "Unsupported file type for $1" >&2
      exit 1
      ;;
  esac
}

document_exists() {
  local document_name="$1"

  DOCS_RESPONSE="$(curl -sS -X GET "$BASE_URL/organizations/$ORG_SLUG/documents" \
    -H "Authorization: Bearer $TOKEN")"

  printf '%s' "$DOCS_RESPONSE" | DOCUMENT_NAME="$document_name" node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const docs = data?.data?.documents || [];
    const exists = docs.some(doc => doc.original_name === process.env.DOCUMENT_NAME);
    process.stdout.write(exists ? "1" : "0");
  '
}

if [ -f "$RICH_FILES_SCRIPT" ]; then
  bash "$RICH_FILES_SCRIPT"
fi

echo "Registering demo user: $EMAIL"
REGISTER_RESPONSE="$(curl -sS -X POST "$BASE_URL/auth/register" \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"account_type\":\"ORGANIZATION\"}")"

if echo "$REGISTER_RESPONSE" | grep -q '"message":"User already exists"'; then
  echo "User exists, logging in instead"
  AUTH_RESPONSE="$(curl -sS -X POST "$BASE_URL/auth/login" \
    -H 'Content-Type: application/json' \
    --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
  TOKEN="$(printf '%s' "$AUTH_RESPONSE" | json_get 'data.token')"
else
  TOKEN="$(printf '%s' "$REGISTER_RESPONSE" | json_get 'token')"
fi

echo "Creating organization: $ORG_NAME ($ORG_SLUG)"
CREATE_ORG_RESPONSE="$(curl -sS -X POST "$BASE_URL/organizations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data "{\"name\":\"$ORG_NAME\",\"slug\":\"$ORG_SLUG\",\"description\":\"Competition demo corpus for source-backed enterprise retrieval.\",\"industry\":\"Financial Services\",\"teamSize\":\"201-500\"}")"

if echo "$CREATE_ORG_RESPONSE" | grep -q 'already exists'; then
  echo "Organization exists, continuing with existing slug"
else
  printf '%s' "$CREATE_ORG_RESPONSE" | json_get 'data.organization.id' >/dev/null
fi

echo "Uploading corpus files"
for name in "${UPLOAD_FILES[@]}"; do
  file="$CORPUS_DIR/$name"

  if [ ! -f "$file" ]; then
    echo "  - missing $name" >&2
    exit 1
  fi

  if [ "$(document_exists "$name")" = "1" ]; then
    echo "  - $name (already uploaded)"
    continue
  fi

  mime_type="$(mime_type_for_file "$name")"
  echo "  - $name"
  curl -sS -X POST "$BASE_URL/organizations/$ORG_SLUG/documents" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@$file;type=$mime_type" >/dev/null
done

echo "Waiting for processing"
for _ in $(seq 1 120); do
  DOCS_RESPONSE="$(curl -sS -X GET "$BASE_URL/organizations/$ORG_SLUG/documents" \
    -H "Authorization: Bearer $TOKEN")"
  COMPLETED_COUNT="$(printf '%s' "$DOCS_RESPONSE" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const docs = data?.data?.documents || [];
    const uploaded = docs.filter(doc => doc.type !== "integration");
    const completed = uploaded.filter(doc => doc.status === "COMPLETED").length;
    const failed = uploaded.filter(doc => doc.status === "FAILED").length;
    process.stdout.write(JSON.stringify({total: uploaded.length, completed, failed}));
  ')"
  TOTAL="$(printf '%s' "$COMPLETED_COUNT" | json_get 'total')"
  COMPLETED="$(printf '%s' "$COMPLETED_COUNT" | json_get 'completed')"
  FAILED="$(printf '%s' "$COMPLETED_COUNT" | json_get 'failed')"
  echo "  status: $COMPLETED/$TOTAL completed, $FAILED failed"
  if [ "$TOTAL" -gt 0 ] && [ "$COMPLETED" -eq "$TOTAL" ]; then
    break
  fi
  sleep 2
done

echo
echo "Demo environment ready"
echo "Email: $EMAIL"
echo "Password: $PASSWORD"
echo "Organization slug: $ORG_SLUG"
echo "Search endpoint: $BASE_URL/search/organization/$ORG_SLUG"
