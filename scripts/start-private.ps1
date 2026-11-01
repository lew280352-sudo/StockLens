param([ValidateRange(1,65535)][int]$Port = 4173)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$tailscale = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
if (-not (Test-Path -LiteralPath $tailscale)) {
  $command = Get-Command tailscale -ErrorAction SilentlyContinue
  if (-not $command) { throw 'ยังไม่ได้ติดตั้ง Tailscale บนคอมเครื่องนี้ ดู docs/PRIVATE_ACCESS.md' }
  $tailscale = $command.Source
}

$statusText = & $tailscale status --json | Out-String
if ($LASTEXITCODE -ne 0) { throw 'Tailscale ยังไม่พร้อม กรุณา Login บนคอมก่อน' }
$status = $statusText | ConvertFrom-Json
if ($status.BackendState -ne 'Running') { throw 'Tailscale ยังไม่เชื่อมต่อ กรุณาเปิดและ Login ก่อน' }
$dnsName = ([string]$status.Self.DNSName).TrimEnd('.').ToLowerInvariant()
if ($dnsName -notmatch '^[a-z0-9][a-z0-9.-]*\.ts\.net$') { throw 'ไม่พบชื่อ HTTPS ของเครื่องใน Tailscale' }
$origin = "https://$dnsName"

$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) { throw "พอร์ต $Port มีโปรแกรมใช้อยู่แล้ว กรุณาหยุด StockLens ตัวเดิมก่อน" }

$serveConfig = & $tailscale serve status --json | Out-String
if ($LASTEXITCODE -ne 0) { throw 'ตรวจสถานะ Tailscale Serve ไม่สำเร็จ' }
if ($serveConfig.Trim() -notin @('', '{}', 'null')) {
  throw 'เครื่องนี้มี Tailscale Serve ตั้งค่าอยู่แล้ว ตรวจ tailscale serve status ก่อน เพื่อไม่ให้ทับบริการอื่น'
}

$dataDir = Join-Path $projectRoot '.data'
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
$env:HOST = '127.0.0.1'
$env:PORT = [string]$Port
$env:APP_ORIGIN = $origin
$node = (Get-Command node -ErrorAction Stop).Source
$server = Start-Process -FilePath $node -ArgumentList @('--env-file-if-exists=.env', 'server.mjs') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dataDir 'private-server.stdout.log') -RedirectStandardError (Join-Path $dataDir 'private-server.stderr.log') -PassThru

try {
  $healthy = $false
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    Start-Sleep -Seconds 1
    try { $healthy = (Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2).ok } catch { }
    if ($healthy) { break }
  }
  if (-not $healthy) { throw 'StockLens ไม่เริ่มทำงาน ตรวจ .data/private-server.stderr.log' }

  & $tailscale serve --bg $Port
  if ($LASTEXITCODE -ne 0) { throw 'เปิด Tailscale Serve ไม่สำเร็จ' }
  $privateReady = $false
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    Start-Sleep -Seconds 2
    try { $privateReady = (Invoke-RestMethod -Uri "$origin/api/health" -TimeoutSec 3).ok } catch { }
    if ($privateReady) { break }
  }
  if (-not $privateReady) {
    & $tailscale serve --https=443 off | Out-Null
    throw 'HTTPS ใน tailnet ยังเข้า StockLens ไม่ได้ ตรวจ Tailscale Serve และ DNS'
  }
  @{ origin = $origin; serverPid = $server.Id; port = $Port } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dataDir 'private-preview.json') -Encoding utf8
  Write-Output "StockLens ส่วนตัวพร้อมใช้: $origin"
  Write-Output 'เปิด Tailscale บนมือถือด้วยบัญชีเดียวกัน แล้วเปิดลิงก์นี้ในเบราว์เซอร์'
} catch {
  Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
  throw
}
