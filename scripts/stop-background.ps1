$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot '.runtime\background-server.pid'
$serverScript = Join-Path $PSScriptRoot 'background-server.mjs'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'No background server recorded. A foreground npm start can be stopped with Ctrl+C.'; exit 0 }
$serverProcessId = 0
if (-not [int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(),[ref]$serverProcessId)) { throw 'Invalid server PID record.' }
$serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $serverProcessId"
if (-not $serverProcess) { Write-Host 'FoundMyJob is already stopped.'; exit 0 }
if ($serverProcess.Name -ne 'node.exe' -or -not $serverProcess.CommandLine.Contains('"' + $serverScript + '"')) { throw 'PID belongs to another process. Nothing was stopped.' }
try {
    $state = Invoke-RestMethod 'http://127.0.0.1:4173/api/state' -TimeoutSec 2
    if (@($state.tasks | Where-Object { $_.status -eq 'running' }).Count -gt 0) { Write-Host 'A resume is generating. Wait for it to finish before stopping.'; exit 1 }
} catch { Write-Host 'Server is not responding; stopping the verified background process.' }
Stop-Process -Id $serverProcessId
Write-Host 'FoundMyJob stopped. Your SQLite database is preserved.'
