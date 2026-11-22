$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceFile = Join-Path $projectRoot 'native\ForegroundProbe.cs'
$outputFile = Join-Path $projectRoot 'native\ForegroundProbe.exe'
if (!(Test-Path -LiteralPath $outputFile) -or (Get-Item -LiteralPath $outputFile).LastWriteTime -lt (Get-Item -LiteralPath $sourceFile).LastWriteTime) {
 if (Test-Path -LiteralPath $outputFile) { Remove-Item -LiteralPath $outputFile }
 Add-Type -TypeDefinition ([IO.File]::ReadAllText($sourceFile)) -ReferencedAssemblies 'System.dll','System.Web.Extensions.dll' -OutputAssembly $outputFile -OutputType ConsoleApplication
}
$browserSource = Join-Path $projectRoot 'native\BrowserProbe.cs'
$browserOutput = Join-Path $projectRoot 'native\BrowserProbe.exe'
if (!(Test-Path -LiteralPath $browserOutput) -or (Get-Item -LiteralPath $browserOutput).LastWriteTime -lt (Get-Item -LiteralPath $browserSource).LastWriteTime) {
 if (Test-Path -LiteralPath $browserOutput) { Remove-Item -LiteralPath $browserOutput }
 $frameworkDir = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\WPF'
 Add-Type -TypeDefinition ([IO.File]::ReadAllText($browserSource)) -ReferencedAssemblies 'System.dll','System.Web.Extensions.dll','Accessibility.dll',(Join-Path $frameworkDir 'UIAutomationClient.dll'),(Join-Path $frameworkDir 'UIAutomationTypes.dll'),(Join-Path $frameworkDir 'WindowsBase.dll') -OutputAssembly $browserOutput -OutputType ConsoleApplication
}
Write-Output 'Native foreground and browser trackers compiled'
