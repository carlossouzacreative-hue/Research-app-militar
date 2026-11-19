# Define a ordem dos cenários de um participante (AB = começa pelo A, BA = começa pelo B).
# Se o participante não existir, ele é criado.
# Uso:  .\scripts\definir.ps1 P3 BA
param(
  [Parameter(Mandatory = $true)][string]$P,
  [Parameter(Mandatory = $true)][ValidateSet('AB', 'BA')][string]$Ordem
)
$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root 'data\participantes.json'
if (-not (Test-Path $file)) {
  Write-Host 'Ainda não existe data\participantes.json. Rode iniciar.ps1 uma vez primeiro.' -ForegroundColor Yellow
  exit 1
}
if ($P -notmatch '^[A-Za-z0-9_-]{1,20}$') {
  Write-Host 'Use só letras, números, - e _ no nome (ex.: P5).' -ForegroundColor Red
  exit 1
}
$data = Get-Content $file -Raw | ConvertFrom-Json
if ($data.PSObject.Properties.Name -contains $P) {
  $data.$P.ordem = $Ordem
} else {
  $data | Add-Member -NotePropertyName $P -NotePropertyValue ([pscustomobject]@{ ordem = $Ordem; A = 'Pendente'; B = 'Pendente' })
}
$json = $data | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($file, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "$P agora começa na ordem $Ordem." -ForegroundColor Green
