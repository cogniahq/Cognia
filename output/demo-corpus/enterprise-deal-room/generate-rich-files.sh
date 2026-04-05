#!/usr/bin/env bash
set -euo pipefail

CORPUS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v textutil >/dev/null 2>&1; then
  echo "textutil is required to generate DOCX files" >&2
  exit 1
fi

if ! command -v cupsfilter >/dev/null 2>&1; then
  echo "cupsfilter is required to generate PDF files" >&2
  exit 1
fi

DOCX_BASES=(
  "06_implementation_plan"
  "10_sso_setup_guide"
)

PDF_BASES=(
  "02_data_processing_addendum"
  "03_security_overview"
  "05_order_form_and_pricing"
)

for base in "${DOCX_BASES[@]}"; do
  source_file="$CORPUS_DIR/${base}.txt"
  target_file="$CORPUS_DIR/${base}.docx"

  textutil -convert docx "$source_file" -output "$target_file"
  echo "Generated $(basename "$target_file")"
done

for base in "${PDF_BASES[@]}"; do
  source_file="$CORPUS_DIR/${base}.txt"
  target_file="$CORPUS_DIR/${base}.pdf"
  temp_file="$(mktemp "${target_file}.XXXXXX")"

  cupsfilter -m application/pdf "$source_file" >"$temp_file" 2>/dev/null
  mv "$temp_file" "$target_file"
  echo "Generated $(basename "$target_file")"
done
