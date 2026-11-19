# Gera as tabelas de resumo (CSV) a partir dos logs.
# Uso:  .\scripts\resumo.ps1
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Falta instalar o Node.js (veja o README).' -ForegroundColor Red
  exit 1
}
& node (Join-Path $root 'tools\resumo.js')
Write-Host 'Os arquivos estão na pasta data (abre direto no Excel).' -ForegroundColor Cyan
