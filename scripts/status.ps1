# Mostra a ordem e o status de cada participante.
# Uso:  .\scripts\status.ps1
$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root 'data\participantes.json'
if (-not (Test-Path $file)) {
  Write-Host 'Ainda não existe data\participantes.json. Rode iniciar.ps1 uma vez primeiro.' -ForegroundColor Yellow
  exit 1
}
$data = Get-Content $file -Raw | ConvertFrom-Json
$data.PSObject.Properties | ForEach-Object {
  [pscustomobject]@{
    Participante = $_.Name
    Ordem        = $_.Value.ordem
    'Cenário A'  = $_.Value.A
    'Cenário B'  = $_.Value.B
  }
} | Format-Table -AutoSize
