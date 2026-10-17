# Bureau entreprise - retire les hooks Claude Code et l'outil installe.
# Equivalent de "make hooks-uninstall" (hooks/uninstall.sh) pour Windows.

$root = Split-Path -Parent $PSScriptRoot
$claudeDir = Join-Path $env:USERPROFILE ".claude"

Write-Host "Cela va :"
Write-Host "  - arreter le serveur Bureau entreprise"
Write-Host "  - retirer de $claudeDir\settings.json les hooks contenant 'claude-office-hook'"
Write-Host "  - desinstaller l'outil uv 'claude-office-hooks'"
Write-Host "  - supprimer claude-office-config.env et claude-office-hooks.log"
Write-Host ""
$ok = Read-Host "Continuer ? (o/n)"
if ($ok -ne "o") { Write-Host "Annule."; exit 0 }

# 1. Serveur
Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)"
    if ($p.CommandLine -match "uvicorn app\.main:app") { Stop-Process -Id $p.ProcessId -Force }
}

# 2. Hooks dans settings.json (le script du projet ne retire que ses propres entrees)
$py = Join-Path $root "app\backend\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = (Get-Command python -ErrorAction SilentlyContinue).Source }
if (-not $py) { Write-Host "Python introuvable : restaure settings.json.avant-claude-office-2026-10-04 a la main."; Read-Host "Entree pour fermer"; exit 1 }
& $py (Join-Path $root "app\hooks\manage_hooks.py") uninstall --hook-cmd claude-office-hook

# 3. Outil uv
$uv = (Get-Command uv -ErrorAction SilentlyContinue).Source
if (-not $uv) {
    $uv = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\astral-sh.uv_*\uv.exe" -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}
if ($uv) { & $uv tool uninstall claude-office-hooks }

# 4. Fichiers de config / log
Remove-Item (Join-Path $claudeDir "claude-office-config.env") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $claudeDir "claude-office-hooks.log") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Termine. Redemarre Claude Code pour que ce soit pris en compte."
Write-Host "Tu peux ensuite supprimer le dossier : $root"
Write-Host "Sauvegarde d'origine conservee : $claudeDir\settings.json.avant-claude-office-2026-10-04"
Read-Host "Entree pour fermer"
