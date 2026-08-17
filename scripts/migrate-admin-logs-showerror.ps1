$ErrorActionPreference = "Stop"

$repoRoot = Get-Location
$target = Join-Path $repoRoot "frontend\assets\js\admin-logs.js"
$apiPath = Join-Path $repoRoot "frontend\assets\js\api.js"

if (!(Test-Path $target)) {
  Write-Host "No existe frontend\assets\js\admin-logs.js. Ejecuta desde la raiz del repo." -ForegroundColor Red
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

# 1) Add local alias once, near existing esc helper if possible.
if ($text -notmatch "const\s+showError\s*=\s*window\.AppUtils\?\.showError") {
  $alias = "  const showError = window.AppUtils?.showError || (error => { console.error(error); alert(error?.message || error || 'Se ha producido un error'); });`r`n"

  if ($text -match "(?m)^\s*const\s+esc\s*=.*?;\s*$") {
    $text = [regex]::Replace($text, "(?m)^(\s*const\s+esc\s*=.*?;\s*)$", "`$1`r`n$alias", 1)
  } elseif ($text -match "(?m)^\s*function\s+esc\s*\(") {
    # Insert after the first function esc block if present.
    $text = [regex]::Replace($text, "(?s)(function\s+esc\s*\([^)]*\)\s*\{.*?\n\s*\})", "`$1`r`n`r`n$alias", 1)
  } else {
    $text = $text -replace "('use strict';\s*)", "`$1`r`n$alias"
  }
}

# 2) Replace common alert based error handling with showError.
$text = [regex]::Replace($text, "console\.error\((?<v>err|error)\);\s*alert\((?<body>[^;]+?)\);", "showError(`${v});")
$text = [regex]::Replace($text, "alert\((?<v>err|error)\.message\s*\|\|\s*\k<v>\);", "showError(`${v});")
$text = [regex]::Replace($text, "alert\((?<v>err|error)\?\.message\s*\|\|\s*\k<v>\);", "showError(`${v});")
$text = [regex]::Replace($text, "alert\((?<v>err|error)\);", "showError(`${v});")

# 3) Replace very common catch block variants exactly enough to avoid broad rewrites.
$text = [regex]::Replace($text, "catch\s*\(err\)\s*\{\s*console\.error\(err\);\s*showError\(err\);\s*\}", "catch (err) { showError(err); }")
$text = [regex]::Replace($text, "catch\s*\(error\)\s*\{\s*console\.error\(error\);\s*showError\(error\);\s*\}", "catch (error) { showError(error); }")

if ($text -ne $original) {
  Set-Content -Path $target -Value $text -NoNewline
  Write-Host "admin-logs.js migrado a AppUtils.showError" -ForegroundColor Green
} else {
  Write-Host "No se encontraron cambios aplicables en admin-logs.js" -ForegroundColor Yellow
}

if (Get-Command node -ErrorAction SilentlyContinue) {
  node --check $target | Out-Null
  Write-Host "node --check OK para admin-logs.js" -ForegroundColor Green
} else {
  Write-Host "Node no encontrado. Omitida validacion syntax check." -ForegroundColor Yellow
}
