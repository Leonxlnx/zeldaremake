$c = (Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'headless' } | Measure-Object).Count
$l = (Get-CimInstance Win32_Processor).LoadPercentage
$n = (Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count
"{0} headlessChrome={1} cpuLoad={2} node={3}" -f (Get-Date -Format 'HH:mm:ss'), $c, $l, $n
