#!/usr/bin/env bash
set -euo pipefail

target="frontend/assets/js/admin-logs.js"
api_path="frontend/assets/js/api.js"

if [ ! -f "$target" ]; then
  echo "No existe frontend/assets/js/admin-logs.js. Ejecuta desde la raiz del repo."
  exit 1
fi

if [ ! -f "$api_path" ]; then
  echo "No existe frontend/assets/js/api.js. Ejecuta desde la raiz del repo."
  exit 1
fi

if ! grep -q "AppUtils.showError" "$api_path"; then
  echo "api.js no contiene AppUtils.showError. Ejecuta primero add-shared-message-utils."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import re
p = Path('frontend/assets/js/admin-logs.js')
text = p.read_text(encoding='utf-8')
orig = text
alias = "  const showError = window.AppUtils?.showError || (error => { console.error(error); alert(error?.message || error || 'Se ha producido un error'); });\n"
if not re.search(r"const\s+showError\s*=\s*window\.AppUtils\?\.showError", text):
    if re.search(r"(?m)^\s*const\s+esc\s*=.*?;\s*$", text):
        text = re.sub(r"(?m)^(\s*const\s+esc\s*=.*?;\s*)$", r"\1\n" + alias.rstrip('\n'), text, count=1)
    elif re.search(r"(?m)^\s*function\s+esc\s*\(", text):
        text = re.sub(r"(?s)(function\s+esc\s*\([^)]*\)\s*\{.*?\n\s*\})", r"\1\n\n" + alias.rstrip('\n'), text, count=1)
    else:
        text = re.sub(r"('use strict';\s*)", r"\1\n" + alias, text, count=1)

text = re.sub(r"console\.error\((err|error)\);\s*alert\([^;]+?\);", r"showError(\1);", text)
text = re.sub(r"alert\((err|error)\.message\s*\|\|\s*\1\);", r"showError(\1);", text)
text = re.sub(r"alert\((err|error)\?\.message\s*\|\|\s*\1\);", r"showError(\1);", text)
text = re.sub(r"alert\((err|error)\);", r"showError(\1);", text)
text = re.sub(r"catch\s*\(err\)\s*\{\s*console\.error\(err\);\s*showError\(err\);\s*\}", "catch (err) { showError(err); }", text)
text = re.sub(r"catch\s*\(error\)\s*\{\s*console\.error\(error\);\s*showError\(error\);\s*\}", "catch (error) { showError(error); }", text)

p.write_text(text, encoding='utf-8')
print('admin-logs.js migrado a AppUtils.showError' if text != orig else 'No se encontraron cambios aplicables en admin-logs.js')
PY

if command -v node >/dev/null 2>&1; then
  node --check "$target" >/dev/null
  echo "node --check OK para admin-logs.js"
else
  echo "Node no encontrado. Omitida validacion syntax check."
fi
