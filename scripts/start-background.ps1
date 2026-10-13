param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot '.runtime'
$serverScript = Join-Path $PSScriptRoot 'background-server.mjs'
$appUrl = 'http://127.0.0.1:4173'
function Test-FoundMyJob {
    try {
        $health = Invoke-RestMethod "$appUrl/api/health" -TimeoutSec 2
        return $health.app -eq 'foundmyjob' -and $health.mode -eq 'local'
    } catch { return $false }
}
try {
    if (-not (Test-FoundMyJob)) {
        $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
        $nodeVersion = & $nodePath -p 'process.versions.node'
        if ([version]$nodeVersion -lt [version]'22.13.0') { throw 'Please install Node.js 24 LTS.' }
        New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
        # WMI creates a separate hidden process; no shell interpolates user data.
        # Break away from the launching job and detach from its console.
        $startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{
            ShowWindow = [uint16]0
            CreateFlags = [uint32]16777224
        }
        $commandLine = '"' + $nodePath + '" --env-file-if-exists=.env.local "' + $serverScript + '"'
        $result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
            CommandLine = $commandLine
            CurrentDirectory = $projectRoot
            ProcessStartupInformation = $startup
        }
        if ($result.ReturnValue -ne 0) { throw "Background start failed (Windows code $($result.ReturnValue)). Run npm start in a terminal instead." }
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if (Test-FoundMyJob) { $ready = $true; break }
            Start-Sleep -Milliseconds 250
        }
        if (-not $ready) { throw 'Server did not become ready. Check .runtime/background-server.log or whether port 4173 is occupied.' }
    }
    Write-Host "FoundMyJob is running at $appUrl. It will keep running after this window closes."
    if (-not $NoBrowser) { Start-Process explorer.exe -ArgumentList $appUrl -WindowStyle Hidden }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
