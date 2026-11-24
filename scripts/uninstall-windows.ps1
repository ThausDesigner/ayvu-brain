# Remove atalhos e launcher do AYVU Brain no Windows (nunca apaga suas notas do vault)
$ErrorActionPreference = 'SilentlyContinue'
$startShortcut = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\AYVU Brain.lnk"
$deskShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "AYVU Brain.lnk"
$installDir = Join-Path $env:LOCALAPPDATA "AYVU Brain"

Remove-Item $startShortcut -Force
Remove-Item $deskShortcut -Force
Remove-Item $installDir -Recurse -Force
Write-Output "AYVU Brain removido dos atalhos do Windows. Seu vault de notas permanece intacto."
