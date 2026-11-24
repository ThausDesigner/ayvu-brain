# Instala o AYVU Brain no Windows (Menu Iniciar + Area de Trabalho)
param(
  [string]$VaultPath = ""
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $VaultPath) {
  $VaultPath = Split-Path -Parent (Split-Path -Parent $projectRoot)
}

$installDir = Join-Path $env:LOCALAPPDATA "AYVU Brain"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$iconSrc = Join-Path $projectRoot "assets\ayvu-brain.ico"
$iconDest = Join-Path $installDir "ayvu-brain.ico"
if (Test-Path $iconSrc) { Copy-Item $iconSrc $iconDest -Force }

$launcherPs1 = Join-Path $projectRoot "scripts\launch-ayvu-brain.ps1"
$vbsPath = Join-Path $installDir "AYVU-Brain.vbs"
$vbsContent = @"
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$launcherPs1"" -VaultPath ""$VaultPath""", 0, False
"@
Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII

$wsh = New-Object -ComObject WScript.Shell

$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$startShortcut = $wsh.CreateShortcut((Join-Path $startMenuDir "AYVU Brain.lnk"))
$startShortcut.TargetPath = "wscript.exe"
$startShortcut.Arguments = "`"$vbsPath`""
$startShortcut.WorkingDirectory = $projectRoot
$startShortcut.Description = "AYVU Brain - Local-first Second Brain Workspace"
if (Test-Path $iconDest) { $startShortcut.IconLocation = $iconDest }
$startShortcut.Save()

$desktopDir = [Environment]::GetFolderPath("Desktop")
$deskShortcut = $wsh.CreateShortcut((Join-Path $desktopDir "AYVU Brain.lnk"))
$deskShortcut.TargetPath = "wscript.exe"
$deskShortcut.Arguments = "`"$vbsPath`""
$deskShortcut.WorkingDirectory = $projectRoot
$deskShortcut.Description = "AYVU Brain - Local-first Second Brain Workspace"
if (Test-Path $iconDest) { $deskShortcut.IconLocation = $iconDest }
$deskShortcut.Save()

Write-Output "AYVU Brain instalado no Windows:"
Write-Output "  Menu Iniciar: $(Join-Path $startMenuDir 'AYVU Brain.lnk')"
Write-Output "  Desktop:      $(Join-Path $desktopDir 'AYVU Brain.lnk')"
Write-Output "  Vault:        $VaultPath"
