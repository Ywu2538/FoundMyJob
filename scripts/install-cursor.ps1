$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot '.runtime'
$installDir = Join-Path $runtimeDir 'cursor-cli'
if (Test-Path -LiteralPath (Join-Path $installDir 'dist-package\index.js')) {
    Write-Host 'Cursor CLI already installed in this project. Use Login-Cursor.cmd.'
    exit 0
}
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
# Read official installer metadata without executing downloaded PowerShell.
$metadata = (Invoke-WebRequest -UseBasicParsing 'https://cursor.com/install?win32=true').Content
$match = [regex]::Match($metadata, "https://downloads\.cursor\.com/lab/[a-zA-Z0-9.\-]+/")
if (-not $match.Success) { throw 'Official download metadata changed; use the official Cursor installation instructions.' }
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$packageUrl = $match.Value + "windows/$arch/agent-cli-package.zip"
$zipFile = Join-Path $runtimeDir 'cursor-cli.zip'
Invoke-WebRequest -UseBasicParsing $packageUrl -OutFile $zipFile
Expand-Archive -LiteralPath $zipFile -DestinationPath $installDir -Force
Write-Host 'Installed official Cursor CLI locally. Next: Login-Cursor.cmd and enable FMJ_ALLOW_CURSOR in .env.local.'
