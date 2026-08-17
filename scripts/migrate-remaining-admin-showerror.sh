#!/usr/bin/env bash
set -euo pipefail

js_root="frontend/assets/js"
api_path="$js_root/api.js"
targets=("admin-roles.js" "general-admin.js" "admin-lovs.js")

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
js_root = Path('frontend/assets/js')
targets = ['admin-roles.js', 'general-admin.js', 'admin-lovs.js']
alias = "  const showError = window.AppUtils?.showError || (error => { console.error(error); alert(error?.message || error || 'Se ha producido un error'); });\n"
changed = []

def add_alias(text):
    if re.search(r"const\s+showError\s*=\s*window\.AppUtils\?\.showError", text):
        return text
    for name in ('esc', 'escapeHtml'):
        if re.search(rf"(?m)^\s*const\s+{name}\s*=.*?;\s*$", text):
            return re.sub(rf"(?m)^(\s*const\s+{name}\s*=.*?;\s*)$", r"\1\n" + alias.rstrip('\n'), text, count=1)
        if re.search(rf"(?m)^\s*function\s+{name}\s*\(", text):
            return re.sub(rf"(?s)(function\s+{name}\s*\([^)]*\)\s*\{{.*?\n\s*\}})", r"\1\n\n" + alias.rstrip('\n'), text, count=1)
    return re.sub(r"('use strict';\s*)", r"\1\n" + alias, text, count=1)

def convert(text):
    text = re.sub(r"console\.error\(err\);\s*alert\([^;]*err[^;]*\);", "showError(err);", text)
    text = re.sub(r"console\.error\(error\);\s*alert\([^;]*error[^;]*\);", "showError(error);", text)
    text = re.sub(r"alert\(err\.message\s*\|\|\s*err\);", "showError(err);", text)
    text = re.sub(r"alert\(err\?\.message\s*\|\|\s*err\);", "showError(err);", text)
    text = re.sub(r"alert\(error\.message\s*\|\|\s*error\);", "showError(error);", text)
    text = re.sub(r"alert\(error\?\.message\s*\|\|\s*error\);", "showError(error);", text)
    text = re.sub(r"alert\(err\);", "showError(err);", text)
    text = re.sub(r"alert\(error\);", "showError(error);", text)
    text = re.sub(r"catch\s*\(err\)\s*\{\s*console\.error\(err\);\s*showError\(err\);\s*\}", "catch (err) { showError(err); }", text)
    text = re.sub(r"catch\s*\(error\)\s*\{\s*console\.error\(error\);\s*showError\(error\);\s*\}", "catch (error) { showError(error); }", text)
    return text

for file in targets:
    p = js_root / file
    if not p.exists():
        print(f'No encontrado, omitido: {file}')
        continue
    text = p.read_text(encoding='utf-8')
    orig = text
    text = convert(add_alias(text))
    if text != orig:
        p.write_text(text, encoding='utf-8')
        changed.append(file)
        print(f'Migrado a AppUtils.showError: {file}')
    else:
        print(f'Sin cambios aplicables: {file}')

Path('showerror-remaining-admin-changed-files.txt').write_text('\n'.join(sorted(changed)) + '\n', encoding='utf-8')
PY

if command -v node >/dev/null 2>&1; then
  for file in "${targets[@]}"; do
    if [ -f "$js_root/$file" ]; then
      node --check "$js_root/$file" >/dev/null
      echo "node --check OK para $file"
    fi
  done
else
  echo "Node no encontrado. Omitida validacion syntax check."
fi
