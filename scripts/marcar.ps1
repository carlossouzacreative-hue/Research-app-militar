# Ajusta à mão o status de um cenário (Pendente, Em andamento, Ok, Com ajuda, Abandonou).
# Uso:  .\scripts\marcar.ps1 P2 B "Com ajuda"
param(
  [Parameter(Mandatory = $true)][string]$P,
  [Parameter(Mandatory = $true)][ValidateSet('A', 'B')][string]$Cenario,
  [Parameter(Mandatory = $true)][string]$Status
)
$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root 'data\participantes.json'
if (-not (Test-Path $file)) {
  Write-Host 'Ainda não existe data\participantes.json. Rode iniciar.ps1 uma vez primeiro.' -ForegroundColor Yellow
  exit 1
}
$data = Get-Content $file -Raw | ConvertFrom-Json
if (-not ($data.PSObject.Properties.Name -contains $P)) {
  Write-Host "Participante $P não encontrado." -ForegroundColor Red
  exit 1
}
$data.$P.$Cenario = $Status
$json = $data | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($file, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "$P, cenário ${Cenario}: $Status" -ForegroundColor Green
