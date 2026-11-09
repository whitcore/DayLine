Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$ffWindow = Get-Process firefox -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (!$ffWindow) { 'No Firefox window'; exit }
$ffRoot = [Windows.Automation.AutomationElement]::FromHandle($ffWindow.MainWindowHandle)
$ffEdits = $ffRoot.FindAll([Windows.Automation.TreeScope]::Descendants, [Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::Edit))
$ffResults = @()
foreach($ffEdit in $ffEdits) {
 $ffPattern = $null
 $ffValueAvailable = $ffEdit.TryGetCurrentPattern([Windows.Automation.ValuePattern]::Pattern,[ref]$ffPattern)
 $ffResults += [pscustomobject]@{ Id=$ffEdit.Current.AutomationId; IsAddress=($ffEdit.Current.Name -match 'адрес|Search with|Enter address|Поиск в'); HasValue=$ffValueAvailable; Focused=$ffEdit.Current.HasKeyboardFocus }
}
$ffResults | ConvertTo-Json -Compress
