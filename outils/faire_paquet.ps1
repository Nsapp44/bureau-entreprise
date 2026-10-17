# Fabrique le dossier portable "Bureau entreprise - paquet" (a cote du dossier source).
# Ne modifie rien dans le dossier source. Si le paquet existe, il est vide puis recree.

$ErrorActionPreference = "Stop"
$src = Split-Path -Parent $PSScriptRoot
$dst = Join-Path (Split-Path -Parent $src) "Bureau entreprise - paquet"
$utf8bom = New-Object System.Text.UTF8Encoding($true)
$ascii = New-Object System.Text.UTF8Encoding($false)

function Write-Bom($rel, $text) {
    $p = Join-Path $dst $rel
    New-Item -ItemType Directory -Force (Split-Path $p) | Out-Null
    [System.IO.File]::WriteAllText($p, ($text -replace "`r?`n", "`r`n"), $utf8bom)
}

# --- 0. Dossier paquet propre
if ($dst -eq $src -or $dst.TrimEnd('\') -eq $src.TrimEnd('\')) { throw "Chemin paquet invalide" }
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Force $dst | Out-Null

# --- 1. Copies robocopy
$xd = @(".venv", "__pycache__", ".pytest_cache", ".ruff_cache", "node_modules", ".next", "tests", ".git")
$xf = @("*.db", "*.db-shm", "*.db-wal", "*.pyc")
function Copy-Tree($from, $to) {
    robocopy $from $to /E /XD @xd /XF @xf /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy a echoue ($from)" }
}
$b = Join-Path $src "app\backend"
$h = Join-Path $src "app\hooks"
Copy-Tree (Join-Path $b "app")    (Join-Path $dst "app\backend\app")
Copy-Tree (Join-Path $b "static") (Join-Path $dst "app\backend\static")
foreach ($f in "floors.toml", "pyproject.toml", "README.md") {
    New-Item -ItemType Directory -Force (Join-Path $dst "app\backend") | Out-Null
    Copy-Item (Join-Path $b $f) (Join-Path $dst "app\backend\$f")
}
Copy-Tree (Join-Path $h "src") (Join-Path $dst "app\hooks\src")
foreach ($f in "pyproject.toml", "README.md", "manage_hooks.py") {
    Copy-Item (Join-Path $h $f) (Join-Path $dst "app\hooks\$f")
}
New-Item -ItemType Directory -Force (Join-Path $dst "assets") | Out-Null
Copy-Item (Join-Path $src "assets\logo.ico") (Join-Path $dst "assets\logo.ico")
Copy-Item (Join-Path $src "assets\logo.png") (Join-Path $dst "assets\logo.png")

# --- 2. requirements.txt (dependencies seulement, pas les optional)
$toml = Get-Content (Join-Path $b "pyproject.toml") -Raw
$m = [regex]::Match($toml, '(?ms)^dependencies\s*=\s*\[(.*?)^\]')
if (-not $m.Success) { throw "dependencies introuvables dans pyproject.toml" }
$reqs = [regex]::Matches($m.Groups[1].Value, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
[System.IO.File]::WriteAllText((Join-Path $dst "app\backend\requirements.txt"), (($reqs -join "`r`n") + "`r`n"), $ascii)

# --- 3. outils\demarrer.ps1
Write-Bom "outils\demarrer.ps1" @'
# Bureau entreprise - demarre le serveur local (127.0.0.1:8000) et ouvre la page.
# Premier lancement : cree l'environnement Python (app\backend\.venv) et installe les dependances.

$root    = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "app\backend"
$venv    = Join-Path $backend ".venv"
$python  = Join-Path $venv "Scripts\python.exe"
$logs    = Join-Path $root "logs"
$url     = "http://localhost:8000"
Add-Type -AssemblyName System.Windows.Forms

function Show-Msg($text) { [System.Windows.Forms.MessageBox]::Show($text, "Bureau entreprise") | Out-Null }

function Test-Up {
    try { (Invoke-WebRequest "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 }
    catch { $false }
}

# Raccourcis a la racine (rafraichis a chaque lancement : le logo suit le dossier s'il est deplace)
function Update-Shortcuts {
    try {
        $ws = New-Object -ComObject WScript.Shell
        $ps = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
        $ico = Join-Path $root "assets\logo.ico"
        foreach ($pair in @(@("Bureau entreprise", "demarrer.ps1"), @("Arreter Bureau entreprise", "arreter.ps1"))) {
            $lnk = $ws.CreateShortcut((Join-Path $root ($pair[0] + ".lnk")))
            $lnk.TargetPath = $ps
            $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"" + (Join-Path $root ("outils\" + $pair[1])) + "`""
            $lnk.WorkingDirectory = $root
            $lnk.IconLocation = $ico
            $lnk.WindowStyle = 7
            $lnk.Save()
        }
    } catch { }
}
Update-Shortcuts

# --- Python >= 3.13
function Find-Python {
    foreach ($cand in @(@("py", "-3"), @("python"))) {
        $exe = $cand[0]
        if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { continue }
        $extra = @(); if ($cand.Count -gt 1) { $extra = $cand[1..($cand.Count - 1)] }
        try {
            $out = & $exe @extra -c "import sys; print(sys.version_info >= (3, 13)); print(sys.executable)" 2>$null
            if ($out -and $out[0] -eq "True" -and (Test-Path $out[1])) { return $out[1] }
        } catch { }
    }
    return $null
}

New-Item -ItemType Directory -Force $logs | Out-Null

if (-not (Test-Path $python)) {
    $sys = Find-Python
    if (-not $sys) { Show-Msg "Python 3.13 ou plus recent est necessaire."; exit 1 }
    $log = Join-Path $logs "install.log"
    "Premier lancement : creation de l'environnement Python ($sys)" | Out-File $log -Encoding utf8
    $ok = $false
    $e1 = Join-Path $logs "install-err1.tmp"; $e2 = Join-Path $logs "install-err2.tmp"
    $o1 = Join-Path $logs "install-out1.tmp"; $o2 = Join-Path $logs "install-out2.tmp"
    $p1 = Start-Process $sys -ArgumentList "-m", "venv", "`"$venv`"" -WorkingDirectory $backend -Wait -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $o1 -RedirectStandardError $e1
    if ($p1.ExitCode -eq 0 -and (Test-Path $python)) {
        $p2 = Start-Process $python -ArgumentList "-m", "pip", "install", "-r", "requirements.txt" -WorkingDirectory $backend -Wait -PassThru -WindowStyle Hidden `
            -RedirectStandardOutput $o2 -RedirectStandardError $e2
        $ok = ($p2.ExitCode -eq 0)
    }
    foreach ($t in $o1, $e1, $o2, $e2) {
        if (Test-Path $t) { Get-Content $t | Out-File $log -Append -Encoding utf8; Remove-Item $t -ErrorAction SilentlyContinue }
    }
    if (-not $ok) {
        Remove-Item $venv -Recurse -Force -ErrorAction SilentlyContinue
        Show-Msg "L'installation a echoue (internet necessaire au premier lancement). Voir le journal :`n$log"
        exit 1
    }
}

if (-not (Test-Up)) {
    $sauv = Join-Path $root "sauvegardes"
    New-Item -ItemType Directory -Force $sauv | Out-Null
    $env:SERVE_STATIC = "1"
    $env:BACKUP_DIR = $sauv
    Start-Process -FilePath $python `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
        -WorkingDirectory $backend -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logs "serveur.log") `
        -RedirectStandardError (Join-Path $logs "serveur-erreurs.log")

    for ($i = 0; $i -lt 40 -and -not (Test-Up); $i++) { Start-Sleep -Milliseconds 500 }
    if (-not (Test-Up)) {
        Show-Msg "Le serveur n'a pas demarre. Voir le dossier logs."
        exit 1
    }
}

# Le serveur genere a chaque demarrage une cle pour les actions protegees
# (ex. "focus terminal"). Il l'ecrit dans son journal : on la passe a la page
# via ?token= (la page la retire ensuite de l'adresse).
$log = Join-Path $logs "serveur.log"
for ($i = 0; $i -lt 20; $i++) {
    if (Test-Path $log) {
        $text = (Get-Content $log -Raw -ErrorAction SilentlyContinue) -replace '\s', ''
        $m = [regex]::Matches($text, 'localhost:8000/\?token=([0-9a-f]{64})')
        if ($m.Count -gt 0) { $url = "$url/?token=" + $m[$m.Count - 1].Groups[1].Value; break }
    }
    Start-Sleep -Milliseconds 250
}

Start-Process $url
'@

# --- 4. outils\arreter.ps1 (identique a l'original : le venv est celui du paquet)
Write-Bom "outils\arreter.ps1" (Get-Content (Join-Path $src "outils\arreter.ps1") -Raw)

# --- 5. outils\installer_hooks.ps1
Write-Bom "outils\installer_hooks.ps1" @'
# Bureau entreprise - installe les hooks Claude Code (modifie ~/.claude/settings.json).

$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root "app\backend\.venv"
$py   = Join-Path $venv "Scripts\python.exe"
$claudeDir = Join-Path $env:USERPROFILE ".claude"
$settings  = Join-Path $claudeDir "settings.json"

Write-Host "Cela va :"
Write-Host "  - installer les hooks dans l'environnement Python de ce dossier"
Write-Host "  - sauvegarder puis modifier $settings"
Write-Host ""
$ok = Read-Host "Continuer ? (o/n)"
if ($ok -ne "o") { Write-Host "Annule."; exit 0 }

if (-not (Test-Path $py)) {
    Write-Host "Lance d'abord Bureau entreprise (premier lancement = installation), puis recommence."
    Read-Host "Entree pour fermer"; exit 1
}

& $py -m pip install (Join-Path $root "app\hooks")
if ($LASTEXITCODE -ne 0) { Write-Host "Echec de pip install."; Read-Host "Entree pour fermer"; exit 1 }

New-Item -ItemType Directory -Force $claudeDir | Out-Null
$backup = Join-Path $claudeDir "settings.json.avant-bureau-entreprise"
if ((Test-Path $settings) -and -not (Test-Path $backup)) { Copy-Item $settings $backup }

$hookExe = (Join-Path $venv "Scripts\claude-office-hook.exe") -replace '\\', '/'
& $py (Join-Path $root "app\hooks\manage_hooks.py") install --hook-cmd $hookExe
if ($LASTEXITCODE -ne 0) { Write-Host "Echec de l'installation des hooks."; Read-Host "Entree pour fermer"; exit 1 }

$cfg = Join-Path $claudeDir "claude-office-config.env"
if (-not (Test-Path $cfg)) { [System.IO.File]::WriteAllText($cfg, "CLAUDE_OFFICE_DEBUG=0`r`n") }

Write-Host ""
Write-Host "Termine. Redemarre Claude Code pour que ce soit pris en compte."
Write-Host "Sauvegarde de tes reglages : $backup"
Read-Host "Entree pour fermer"
'@

# --- 6. outils\retirer_hooks.ps1
Write-Bom "outils\retirer_hooks.ps1" @'
# Bureau entreprise - retire les hooks Claude Code de ~/.claude/settings.json.

$root = Split-Path -Parent $PSScriptRoot
$py   = Join-Path $root "app\backend\.venv\Scripts\python.exe"
$claudeDir = Join-Path $env:USERPROFILE ".claude"

Write-Host "Cela va retirer de $claudeDir\settings.json les hooks 'claude-office-hook'"
Write-Host "et supprimer claude-office-config.env."
Write-Host ""
$ok = Read-Host "Continuer ? (o/n)"
if ($ok -ne "o") { Write-Host "Annule."; exit 0 }

if (-not (Test-Path $py)) { $py = (Get-Command python -ErrorAction SilentlyContinue).Source }
if (-not $py) { Write-Host "Python introuvable : restaure settings.json.avant-bureau-entreprise a la main."; Read-Host "Entree pour fermer"; exit 1 }

& $py (Join-Path $root "app\hooks\manage_hooks.py") uninstall --hook-cmd claude-office-hook

Remove-Item (Join-Path $claudeDir "claude-office-config.env") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Termine. Redemarre Claude Code pour que ce soit pris en compte."
Read-Host "Entree pour fermer"
'@

# --- 7. .bat a la racine
function Write-Bat($name, $line) {
    [System.IO.File]::WriteAllText((Join-Path $dst $name), "@echo off`r`n$line`r`n", $ascii)
}
Write-Bat "Bureau entreprise.bat" 'start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0outils\demarrer.ps1"'
Write-Bat "Arreter Bureau entreprise.bat" 'powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0outils\arreter.ps1"'
Write-Bat "Installer les hooks.bat" 'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0outils\installer_hooks.ps1"'
Write-Bat "Retirer les hooks.bat" 'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0outils\retirer_hooks.ps1"'

# --- 8. LISEZ-MOI.txt
Write-Bom "LISEZ-MOI.txt" @'
BUREAU ENTREPRISE - version portable
====================================

Pour utiliser :
  1. Il faut Python 3.13 ou plus recent installe sur l'ordinateur (python.org).
  2. Double-clique sur "Bureau entreprise.bat".
     Au tout premier lancement, l'installation prend quelques minutes
     (internet necessaire). Ensuite c'est rapide.
  3. La page s'ouvre dans le navigateur.

Fermeture :
  Le serveur s'arrete tout seul environ 30 secondes apres la fermeture de la page.
  Sinon : "Arreter Bureau entreprise.bat".

Hooks Claude Code (pour que les personnages reagissent) :
  - "Installer les hooks.bat" (apres un premier lancement), puis redemarre Claude Code.
  - "Retirer les hooks.bat" pour les enlever.

Dossiers :
  logs\         journaux (install.log en cas de probleme)
  sauvegardes\  sauvegardes des donnees

Les raccourcis "Bureau entreprise" (avec le logo) sont crees au premier lancement.
Le dossier peut etre deplace ou copie ailleurs ; au premier lancement a l'emplacement
suivant, l'environnement Python est recree si besoin (supprime app\backend\.venv).
'@

Write-Host "Paquet cree : $dst"
