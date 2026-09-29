# Dong goi du lieu NotiAgent de chuyen sang may khac.
# Tao trong $OutDir: NotiAgentData-<ngay>.zip (anh/video, database, n8n) + NotiAgent-secrets.env (khoa API).
# Chay: powershell -ExecutionPolicy Bypass -File scripts\export-data.ps1 [-OutDir D:\NotiAgentTransfer]
# LUU Y: NotiAgent-secrets.env chua khoa API that - chi chuyen qua USB/mang noi bo, dung day len GitHub/cloud,
# va xoa di sau khi da dung.
param([string]$OutDir = 'D:\NotiAgentTransfer')
$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $proj '.env'

$dataRoot = 'D:\NotiAgentData'
if (Test-Path $envFile) {
    $m = Select-String -Path $envFile -Pattern '^NOTIAGENT_DATA_ROOT=(.+)$' | Select-Object -First 1
    if ($m) { $dataRoot = $m.Matches[0].Groups[1].Value.Trim().Replace('/', [string][char]92) }
}
if (-not (Test-Path $dataRoot)) { throw "Khong thay thu muc du lieu: $dataRoot" }

New-Item -ItemType Directory -Force $OutDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$zip = Join-Path $OutDir "NotiAgentData-$stamp.zip"

Push-Location $proj
try {
    Write-Host 'Tam dung dich vu de database khong bi ghi giua chung...'
    cmd /c 'docker compose stop >nul 2>&1'
    Compress-Archive -Path (Join-Path $dataRoot '*') -DestinationPath $zip -Force
} finally {
    cmd /c 'docker compose start >nul 2>&1'
    Pop-Location
}

if (Test-Path $envFile) { Copy-Item $envFile (Join-Path $OutDir 'NotiAgent-secrets.env') -Force }
# Kem script cai dat de may moi chay duoc ngay ca khi chua clone repo (repo private, can dang nhap GitHub).
Copy-Item (Join-Path $PSScriptRoot 'setup-new-pc.ps1') (Join-Path $OutDir 'setup-new-pc.ps1') -Force
$size = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "Xong: $zip ($size MB)"
Write-Host "Khoa API: $(Join-Path $OutDir 'NotiAgent-secrets.env') (bi mat - xoa sau khi dung)"
