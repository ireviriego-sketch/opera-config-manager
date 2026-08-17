$ErrorActionPreference = "Stop"

$repoRoot = Get-Location
$target = Join-Path $repoRoot "frontend\assets\js\admin-audit.js"
$apiPath = Join-Path $repoRoot "frontend\assets\js\api.js"

if (!(Test-Path $target)) {
  Write-Host "No existe frontend\assets\js\admin-audit.js. Ejecuta desde la raiz del repo." -ForegroundColor Red
  exit 1
}

if (!(Test-Path $apiPath)) {
  Write-Host "No existe frontend\assets\js\api.js. Ejecuta desde la raiz del repo." -ForegroundColor Red
  exit 1
}

$api = Get-Content $apiPath -Raw
if ($api -notmatch "AppUtils\.showError") {
  Write-Host "api.js no contiene AppUtils.showError. Ejecuta primero add-shared-message-utils.ps1." -ForegroundColor Red
  exit 1
}

$text = Get-Content $target -Raw
$original = $text

# Add local alias once. It keeps a safe fallback if api.js is not loaded.
if ($text -notmatch "const\s+showError\s*=\s*window\.AppUtils\?\.showError") {
  $alias = "  const showError = window.AppUtils?.showError || (error => { console.error(error); alert(error?.message || error || 'Se ha producido un error'); });`r`n"

  if ($text -match "(?m)^\s*const\s+esc\s*=.*?;\s*$") {
    $text = [regex]::Replace($text, "(?m)^(\s*const\s+esc\s*=.*?;\s*)$", "`$1`r`n$alias", 1)
  } elseif ($text -match "(?m)^\s*function\s+esc\s*\(") {
    $text = [regex]::Replace($text, "(?s)(function\s+esc\s*\([^)]*\)\s*\{.*?\n\s*\})", "`$1`r`n`r`n$alias", 1)
  } else {
    $text = $text -replace "('use strict';\s*)", "`$1`r`n$alias"
  }
}

# Conservative replacements only. Do not touch requestJson or modal logic.
$text = [regex]::Replace($text, "console\.error\(err\);\s*alert\([^;]*err[^;]*\);", "showError(err);")
$text = [regex]::Replace($text, "console\.error\(error\);\s*alert\([^;]*error[^;]*\);", "showError(error);")
$text = [regex]::Replace($text, "alert\(err\.message\s*\|\|\s*err\);", "showError(err);")
$text = [regex]::Replace($text, "alert\(err\?\.message\s*\|\|\s*err\);", "showError(err);")
$text = [regex]::Replace($text, "alert\(error\.message\s*\|\|\s*error\);", "showError(error);")
$text = [regex]::Replace($text, "alert\(error\?\.message\s*\|\|\s*error\);", "showError(error);")
$text = [regex]::Replace($text, "alert\(err\);", "showError(err);")
$text = [regex]::Replace($text, "alert\(error\);", "showError(error);")
$text = [regex]::Replace($text, "catch\s*\(err\)\s*\{\s*console\.error\(err\);\s*showError\(err\);\s*\}", "catch (err) { showError(err); }")
$text = [regex]::Replace($text, "catch\s*\(error\)\s*\{\s*console\.error\(error\);\s*showError\(error\);\s*\}", "catch (error) { showError(error); }")

if ($text -ne $original) {
  Set-Content -Path $target -Value $text -NoNewline
  Write-Host "admin-audit.js migrado a AppUtils.showError" -ForegroundColor Green
} else {
  Write-Host "No se encontraron cambios aplicables en admin-audit.js" -ForegroundColor Yellow
}

if (Get-Command node -ErrorAction SilentlyContinue) {
  node --check $target | Out-Null
  Write-Host "node --check OK para admin-audit.js" -ForegroundColor Green
} else {
  Write-Host "Node no encontrado. Omitida validacion syntax check." -ForegroundColor Yellow
}
