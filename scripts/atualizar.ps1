# Baixa a versão mais recente do protótipo do GitHub.
# Se o servidor estiver rodando, pare (Ctrl+C) e rode iniciar.ps1 de novo.
# Uso:  .\scripts\atualizar.ps1
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host 'Falta instalar o Git (veja o README).' -ForegroundColor Red
  exit 1
}
& git pull --ff-only 2>&1 | Out-Host
Write-Host 'Pronto. Telas novas já valem ao recarregar a página; mudanças no servidor pedem reiniciar o iniciar.ps1.' -ForegroundColor Cyan
