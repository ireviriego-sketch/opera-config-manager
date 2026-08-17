$ErrorActionPreference = "Stop"

$repoRoot = Get-Location
$jsRoot = Join-Path $repoRoot "frontend\assets\js"
$apiPath = Join-Path $jsRoot "api.js"
$targets = @("admin-roles.js", "general-admin.js", "admin-lovs.js")

if (!(Test-Path $apiPath)) {
  Write-Host "No existe frontend\assets\js\api.js. Ejecuta desde la raiz del repo." -ForegroundColor Red
  exit 1
}

$api = Get-Content $apiPath -Raw
if ($api -notmatch "AppUtils\.showError") {
  Write-Host "api.js no contiene AppUtils.showError. Ejecuta primero add-shared-message-utils.ps1." -ForegroundColor Red
  exit 1
}

function Add-ShowErrorAlias {
  param([string]$Text)

  if ($Text -match "const\s+showError\s*=\s*window\.AppUtils\?\.showError") {
    return $Text
  }

  $alias = "  const showError = window.AppUtils?.showError || (error => { console.error(error); alert(error?.message || error || 'Se ha producido un error'); });`r`n"

  if ($Text -match "(?m)^\s*const\s+esc\s*=.*?;\s*$") {
    return [regex]::Replace($Text, "(?m)^(\s*const\s+esc\s*=.*?;\s*)$", "`$1`r`n$alias", 1)
  }

  if ($Text -match "(?m)^\s*function\s+esc\s*\(") {
    return [regex]::Replace($Text, "(?s)(function\s+esc\s*\([^)]*\)\s*\{.*?\n\s*\})", "`$1`r`n`r`n$alias", 1)
  }

  if ($Text -match "(?m)^\s*const\s+escapeHtml\s*=.*?;\s*$") {
    return [regex]::Replace($Text, "(?m)^(\s*const\s+escapeHtml\s*=.*?;\s*)$", "`$1`r`n$alias", 1)
  }

  if ($Text -match "(?m)^\s*function\s+escapeHtml\s*\(") {
    return [regex]::Replace($Text, "(?s)(function\s+escapeHtml\s*\([^)]*\)\s*\{.*?\n\s*\})", "`$1`r`n`r`n$alias", 1)
  }

  return ($Text -replace "('use strict';\s*)", "`$1`r`n$alias")
}

function Convert-ErrorHandling {
  param([string]$Text)

  # Conservative replacements only. Do not touch requestJson, modal logic, form logic, roles/LOVs semantics or render logic.
  $Text = [regex]::Replace($Text, "console\.error\(err\);\s*alert\([^;]*err[^;]*\);", "showError(err);")
  $Text = [regex]::Replace($Text, "console\.error\(error\);\s*alert\([^;]*error[^;]*\);", "showError(error);")
  $Text = [regex]::Replace($Text, "alert\(err\.message\s*\|\|\s*err\);", "showError(err);")
  $Text = [regex]::Replace($Text, "alert\(err\?\.message\s*\|\|\s*err\);", "showError(err);")
  $Text = [regex]::Replace($Text, "alert\(error\.message\s*\|\|\s*error\);", "showError(error);")
  $Text = [regex]::Replace($Text, "alert\(error\?\.message\s*\|\|\s*error\);", "showError(error);")
  $Text = [regex]::Replace($Text, "alert\(err\);", "showError(err);")
  $Text = [regex]::Replace($Text, "alert\(error\);", "showError(error);")

  # Collapse duplicate console.error + showError blocks if produced by previous replacements.
  $Text = [regex]::Replace($Text, "catch\s*\(err\)\s*\{\s*console\.error\(err\);\s*showError\(err\);\s*\}", "catch (err) { showError(err); }")
  $Text = [regex]::Replace($Text, "catch\s*\(error\)\s*\{\s*console\.error\(error\);\s*showError\(error\);\s*\}", "catch (error) { showError(error); }")

  return $Text
}

$changed = @()
foreach ($file in $targets) {
  $path = Join-Path $jsRoot $file
  if (!(Test-Path $path)) {
    Write-Host "No encontrado, omitido: $file" -ForegroundColor Yellow
    continue
  }

  $text = Get-Content $path -Raw
  $original = $text
  $text = Add-ShowErrorAlias -Text $text
  $text = Convert-ErrorHandling -Text $text

  if ($text -ne $original) {
    Set-Content -Path $path -Value $text -NoNewline
    $changed += $file
    Write-Host "Migrado a AppUtils.showError: $file" -ForegroundColor Green
  } else {
    Write-Host "Sin cambios aplicables: $file" -ForegroundColor DarkGray
  }
}

$changed | Sort-Object | Set-Content (Join-Path $repoRoot "showerror-remaining-admin-changed-files.txt")

if (Get-Command node -ErrorAction SilentlyContinue) {
  foreach ($file in $targets) {
    $path = Join-Path $jsRoot $file
    if (Test-Path $path) {
      node --check $path | Out-Null
      Write-Host "node --check OK para $file" -ForegroundColor Green
    }
  }
} else {
  Write-Host "Node no encontrado. Omitida validacion syntax check." -ForegroundColor Yellow
}
