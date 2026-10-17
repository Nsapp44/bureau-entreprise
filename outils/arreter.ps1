# Bureau entreprise - arrete le serveur local lance par demarrer.ps1.
# Ne touche qu'au Python de ce dossier qui ecoute sur le port 8000.

$root   = Split-Path -Parent $PSScriptRoot
$python = (Join-Path $root "app\backend\.venv\Scripts\python.exe").ToLower()

$stopped = 0

# 1. Arret propre (le serveur fait sa sauvegarde d'arret). L'en-tete Origin
#    est exige par le serveur pour accepter l'arret.
try {
    Invoke-WebRequest "http://127.0.0.1:8000/api/v1/shutdown" -Method Post -UseBasicParsing `
        -Headers @{ Origin = "http://localhost:8000" } -TimeoutSec 3 | Out-Null
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 300
        if (-not (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue)) { $stopped = 1; break }
    }
} catch { }

# 2. Repli : arret force si le serveur ecoute encore.
Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)"
    # Le venv Windows lance un python.exe "relais" : on accepte le parent ou l'enfant.
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.ParentProcessId)" -ErrorAction SilentlyContinue
    if (($proc.ExecutablePath -and $proc.ExecutablePath.ToLower() -eq $python) -or
        ($parent -and $parent.ExecutablePath -and $parent.ExecutablePath.ToLower() -eq $python) -or
        ($proc.CommandLine -match "uvicorn app\.main:app")) {
        if ($parent -and $parent.ExecutablePath -and $parent.ExecutablePath.ToLower() -eq $python) {
            Stop-Process -Id $parent.ProcessId -Force -ErrorAction SilentlyContinue
        }
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        $stopped++
    }
}

Add-Type -AssemblyName System.Windows.Forms
$msg = if ($stopped) { "Bureau entreprise est arrete." } else { "Bureau entreprise ne tournait pas." }
[System.Windows.Forms.MessageBox]::Show($msg, "Bureau entreprise") | Out-Null
