# Bureau entreprise - demarre le serveur local (127.0.0.1:8000) et ouvre la page.
# Le frontend est servi en statique par le backend : pas besoin de Node ni du port 3000.

$root    = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "app\backend"
$python  = Join-Path $backend ".venv\Scripts\python.exe"
$logs    = Join-Path $root "logs"
$url     = "http://localhost:8000"

function Test-Up {
    try { (Invoke-WebRequest "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 }
    catch { $false }
}

# Reconstruit l'interface si les sources sont plus recentes que la copie servie
# (petite modif ponctuelle : un arreter/relancer suffit). Necessite Node ; sinon on garde l'ancienne.
$front  = Join-Path $root "app\frontend"
$static = Join-Path $backend "static"
$index  = Join-Path $static "index.html"
$node   = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { foreach ($p in "C:\Program Files\nodejs\node.exe") { if (Test-Path $p) { $node = $p; break } } }
if ($node -and -not (Test-Up)) {
    $builtAt = if (Test-Path $index) { (Get-Item $index).LastWriteTime } else { [datetime]::MinValue }
    $newer = Get-ChildItem (Join-Path $front "src"), (Join-Path $front "public") -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -gt $builtAt } | Select-Object -First 1
    if ($newer -or -not (Test-Path $index)) {
        New-Item -ItemType Directory -Force $logs | Out-Null
        $env:Path = (Split-Path $node) + ";" + $env:Path
        Push-Location $front
        & $node (Join-Path $front "node_modules\next\dist\bin\next") build 2>&1 | Out-File (Join-Path $root "logs\build.log") -Encoding utf8
        $ok = $LASTEXITCODE -eq 0
        Pop-Location
        if ($ok -and (Test-Path (Join-Path $front "out\index.html"))) {
            Remove-Item $static -Recurse -Force -ErrorAction SilentlyContinue
            Copy-Item (Join-Path $front "out") $static -Recurse
        }
    }
}

if (-not (Test-Up)) {
    New-Item -ItemType Directory -Force $logs | Out-Null
    $env:SERVE_STATIC = "1"
    Start-Process -FilePath $python `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
        -WorkingDirectory $backend -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logs "serveur.log") `
        -RedirectStandardError (Join-Path $logs "serveur-erreurs.log")

    for ($i = 0; $i -lt 40 -and -not (Test-Up); $i++) { Start-Sleep -Milliseconds 500 }
    if (-not (Test-Up)) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show(
            "Le serveur n'a pas demarre. Voir le dossier logs.", "Bureau entreprise") | Out-Null
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
