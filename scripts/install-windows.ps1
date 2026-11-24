# Instala oficialmente o AYVU Brain em %LOCALAPPDATA%\AYVU Brain (Menu Iniciar + Area de Trabalho)
param(
  [string]$VaultPath = "",
  [int]$Port = 4190
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $VaultPath) {
  $candidate = Split-Path -Parent (Split-Path -Parent $projectRoot)
  if ((Test-Path (Join-Path $candidate "_sync")) -or (Test-Path (Join-Path $candidate "_memory"))) {
    $VaultPath = $candidate
  } else {
    $VaultPath = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Brain"
  }
}

$installDir = Join-Path $env:LOCALAPPDATA "AYVU Brain"
$appDir = Join-Path $installDir "app"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
New-Item -ItemType Directory -Force -Path $appDir | Out-Null

# Encerra instancia anterior do AYVU Brain na porta configurada para atualizar arquivos com seguranca
$conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)" -ErrorAction SilentlyContinue
  if ($proc -and ($proc.CommandLine -match 'ayvu-brain' -or $proc.CommandLine -match 'AYVU Brain')) {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Milliseconds 400

# Copia runtime oficial para %LOCALAPPDATA%\AYVU Brain\app
foreach ($folder in @("src", "public", "assets", "scripts")) {
  $srcFolder = Join-Path $projectRoot $folder
  $destFolder = Join-Path $appDir $folder
  if (Test-Path $srcFolder) {
    if (Test-Path $destFolder) { Remove-Item $destFolder -Recurse -Force }
    Copy-Item $srcFolder $destFolder -Recurse -Force
  }
}
Copy-Item (Join-Path $projectRoot "package.json") (Join-Path $appDir "package.json") -Force

$iconSrc = Join-Path $appDir "assets\ayvu-brain.ico"
$iconDest = Join-Path $installDir "ayvu-brain.ico"
if (Test-Path $iconSrc) { Copy-Item $iconSrc $iconDest -Force }

# Salva configuracao persistente da instalacao oficial
$configPath = Join-Path $installDir "config.json"
$configObj = @{
  vaultPath = $VaultPath
  port = $Port
  installedFrom = $projectRoot
  installedAt = (Get-Date).ToString("o")
} | ConvertTo-Json -Depth 3
Set-Content -Path $configPath -Value $configObj -Encoding UTF8

$launcherPs1 = Join-Path $appDir "scripts\launch-ayvu-brain.ps1"
$vbsPath = Join-Path $installDir "AYVU-Brain.vbs"
$vbsContent = @"
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$launcherPs1"" -VaultPath ""$VaultPath"" -Port $Port", 0, False
"@
Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII

$wsh = New-Object -ComObject WScript.Shell

$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$startShortcut = $wsh.CreateShortcut((Join-Path $startMenuDir "AYVU Brain.lnk"))
$startShortcut.TargetPath = "wscript.exe"
$startShortcut.Arguments = "`"$vbsPath`""
$startShortcut.WorkingDirectory = $appDir
$startShortcut.Description = "AYVU Brain - Local-first Second Brain Workspace"
if (Test-Path $iconDest) { $startShortcut.IconLocation = $iconDest }
$startShortcut.Save()

$desktopDir = [Environment]::GetFolderPath("Desktop")
$deskShortcut = $wsh.CreateShortcut((Join-Path $desktopDir "AYVU Brain.lnk"))
$deskShortcut.TargetPath = "wscript.exe"
$deskShortcut.Arguments = "`"$vbsPath`""
$deskShortcut.WorkingDirectory = $appDir
$deskShortcut.Description = "AYVU Brain - Local-first Second Brain Workspace"
if (Test-Path $iconDest) { $deskShortcut.IconLocation = $iconDest }
$deskShortcut.Save()

Write-Output "AYVU Brain instalado oficialmente no Windows:"
Write-Output "  Instalacao:   $appDir"
Write-Output "  Config:       $configPath"
Write-Output "  Menu Iniciar: $(Join-Path $startMenuDir 'AYVU Brain.lnk')"
Write-Output "  Desktop:      $(Join-Path $desktopDir 'AYVU Brain.lnk')"
Write-Output "  Vault:        $VaultPath"
