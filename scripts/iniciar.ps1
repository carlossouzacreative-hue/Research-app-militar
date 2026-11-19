# Sobe o servidor do protótipo e o túnel do Cloudflare, e mostra os links de cada participante.
# Uso (PowerShell, na pasta do projeto):  .\scripts\iniciar.ps1
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$porta = 3000
try {
  $cfg = Get-Content (Join-Path $root 'config.json') -Raw | ConvertFrom-Json
  if ($cfg.porta) { $porta = [int]$cfg.porta }
} catch {}

# 1) Atualiza do GitHub, se for um repositório git
if ((Test-Path (Join-Path $root '.git')) -and (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host 'Baixando a versão mais recente (git pull)...' -ForegroundColor Cyan
  & git pull --ff-only 2>&1 | Out-Host
}

# 2) Confere programas necessários
foreach ($cmd in 'node', 'cloudflared') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "Falta instalar: $cmd (veja o README)." -ForegroundColor Red
    exit 1
  }
}

New-Item -ItemType Directory -Force -Path (Join-Path $root 'data') | Out-Null
$tunnelLog = Join-Path $root 'data\tunnel.log'
$tunnelOut = Join-Path $root 'data\tunnel.out.log'
Remove-Item $tunnelLog, $tunnelOut -ErrorAction SilentlyContinue

# 3) Servidor
$env:PORT = "$porta"
$srv = Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $root -PassThru -NoNewWindow
$ok = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    Invoke-WebRequest -Uri "http://localhost:$porta/" -UseBasicParsing -TimeoutSec 2 | Out-Null
    $ok = $true
    break
  } catch {}
}
if (-not $ok) {
  Write-Host 'O servidor não respondeu. Veja a mensagem de erro acima.' -ForegroundColor Red
  if (-not $srv.HasExited) { Stop-Process -Id $srv.Id -Force }
  exit 1
}

# 4) Túnel
$tun = Start-Process -FilePath 'cloudflared' -ArgumentList "tunnel --url http://localhost:$porta" -PassThru -WindowStyle Hidden -RedirectStandardError $tunnelLog -RedirectStandardOutput $tunnelOut
$url = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 700
  if (Test-Path $tunnelLog) {
    $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value; break }
  }
}

try {
  if (-not $url) {
    Write-Host 'Não consegui obter o endereço do túnel. Veja data\tunnel.log.' -ForegroundColor Red
  } else {
    Set-Content -Path (Join-Path $root 'data\url.txt') -Value $url
    Write-Host ''
    Write-Host 'Túnel no ar:' $url -ForegroundColor Green
    Write-Host ''
    Write-Host 'Links dos participantes (mande o link da pessoa na hora do teste):' -ForegroundColor Cyan
    $parts = Get-Content (Join-Path $root 'data\participantes.json') -Raw | ConvertFrom-Json
    foreach ($prop in $parts.PSObject.Properties) {
      Write-Host ("  {0} (ordem {1}): {2}/?p={0}" -f $prop.Name, $prop.Value.ordem, $url)
    }
    $token = (Get-Content (Join-Path $root 'data\token.txt') -Raw).Trim()
    Write-Host ''
    Write-Host 'Painel do moderador (só para você):' -ForegroundColor Cyan
    Write-Host "  http://localhost:$porta/mod.html?t=$token"
    Write-Host ''
    Write-Host 'Para encerrar, pressione Ctrl+C.' -ForegroundColor DarkGray
  }
  while (-not $srv.HasExited) { Start-Sleep -Seconds 2 }
} finally {
  if ($tun -and -not $tun.HasExited) { Stop-Process -Id $tun.Id -Force -ErrorAction SilentlyContinue }
  if ($srv -and -not $srv.HasExited) { Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue }
}
