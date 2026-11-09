param([string]$TargetVersion = '1.4.0')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\Dayline'
$installedExe = Join-Path $installRoot 'Dayline.exe'
$profileRoot = Join-Path $env:APPDATA 'Dayline'
$installer = Join-Path $taskRoot ('release\'+$TargetVersion+'\Dayline-Setup-'+$TargetVersion+'.exe')
if (!(Test-Path -LiteralPath $installer)) { throw 'Installer missing' }
if (!(Test-Path -LiteralPath (Join-Path $profileRoot 'dayline.json'))) { throw 'Existing profile missing; refusing an unexpected migration' }
$backupRoot = Join-Path $taskRoot ('archive\dayline-before-'+$TargetVersion+'-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupRoot | Out-Null
# A copy before stopping protects the complete persisted profile and the Chromium journal cache.
Copy-Item -LiteralPath (Join-Path $profileRoot 'dayline.json') -Destination (Join-Path $backupRoot 'dayline.before-stop.json')
if (Test-Path -LiteralPath (Join-Path $profileRoot 'dayline.json.bak')) { Copy-Item -LiteralPath (Join-Path $profileRoot 'dayline.json.bak') -Destination $backupRoot }
foreach ($folder in @('icons')) { if (Test-Path -LiteralPath (Join-Path $profileRoot $folder)) { Copy-Item -LiteralPath (Join-Path $profileRoot $folder) -Destination $backupRoot -Recurse } }
$targets = @(Get-CimInstance Win32_Process -Filter "Name = 'Dayline.exe'" | Where-Object { $_.ExecutablePath -eq $installedExe })
foreach ($target in $targets) { Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 800
$remaining = @(Get-CimInstance Win32_Process -Filter "Name = 'Dayline.exe'" | Where-Object { $_.ExecutablePath -eq $installedExe })
if ($remaining.Count) { throw 'Previous installed process is still running' }
if (Test-Path -LiteralPath (Join-Path $profileRoot 'Local Storage')) { Copy-Item -LiteralPath (Join-Path $profileRoot 'Local Storage') -Destination $backupRoot -Recurse }
# Freeze the exact last persisted JSON after shutdown, then compare it after installation.
Copy-Item -LiteralPath (Join-Path $profileRoot 'dayline.json') -Destination (Join-Path $backupRoot 'dayline.json')
$beforeHash = (Get-FileHash -LiteralPath (Join-Path $profileRoot 'dayline.json') -Algorithm SHA256).Hash
$before = Get-Content -LiteralPath (Join-Path $profileRoot 'dayline.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$installProcess = Start-Process -FilePath $installer -ArgumentList '/S' -WindowStyle Hidden -PassThru -Wait
if ($installProcess.ExitCode -ne 0) { throw ('Installer exit code: ' + $installProcess.ExitCode) }
$afterHash = (Get-FileHash -LiteralPath (Join-Path $profileRoot 'dayline.json') -Algorithm SHA256).Hash
if ($beforeHash -ne $afterHash) { throw 'The installer changed the data file; backup retained. Do not launch yet.' }
$version = (Get-Item -LiteralPath $installedExe).VersionInfo.ProductVersion
if ($version -notlike ($TargetVersion+'*')) { throw ('Wrong installed version: ' + $version) }
& node (Join-Path $taskRoot 'scripts\prepare-profile.cjs') $profileRoot
if ($LASTEXITCODE -ne 0) { throw 'Profile preparation failed; original backup retained' }
# The user requested the desktop application to be opened after updating.
Remove-Item Env:DAYLINE_DATA_DIR -ErrorAction SilentlyContinue
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Start-Process -FilePath $installedExe -WindowStyle Normal | Out-Null
[pscustomobject]@{ InstalledVersion=$version; InstallerKeptDataHash=$true; SessionsBefore=$before.sessions.Count; JournalDaysBefore=@($before.entries.PSObject.Properties).Count; Backup=$backupRoot; Exe=$installedExe } | ConvertTo-Json -Compress
