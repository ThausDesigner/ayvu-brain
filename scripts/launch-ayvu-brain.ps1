# Inicia o servidor local do AYVU Brain em 127.0.0.1:4190 (sem janela preta)
# e abre como aplicativo Desktop dedicado no Windows.
param(
  [string]$VaultPath = "",
  [int]$Port = 4190
)

$ErrorActionPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $VaultPath) {
  $VaultPath = Split-Path -Parent (Split-Path -Parent $projectRoot)
}
$url = "http://127.0.0.1:$Port/app"

$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  $serverScript = Join-Path $projectRoot "src\server.mjs"
  Start-Process node -WindowStyle Hidden -WorkingDirectory $projectRoot -ArgumentList "`"$serverScript`"", "--vault", "`"$VaultPath`"", "--port", "$Port"
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 300
    $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($listening) { break }
  }
}

$profileDir = Join-Path $env:LOCALAPPDATA "AYVU Brain\browser-profile"
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

$chrome = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
$chromeX86 = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$edge64 = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe"

$browser = @($chrome, $chromeX86, $edge64, $edge) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($browser) {
  Start-Process $browser "--app=$url --user-data-dir=`"$profileDir`" --window-size=1440,900"
} else {
  Start-Process $url
}
