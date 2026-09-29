# Cai dat NotiAgent tren may MOI (Windows 10/11) va nap lai du lieu tu may cu.
# Can: ket noi mang, quyen dang nhap GitHub (repo private khaitam90/notiagent).
# Chay: powershell -ExecutionPolicy Bypass -File setup-new-pc.ps1 -TransferDir <thu muc chua zip + secrets>
#   (file nay nam san trong repo: scripts\setup-new-pc.ps1; neu chua co repo, tai rieng file nay ve chay)
param(
    [string]$TransferDir = '',
    [string]$ProjectDir = '',
    [string]$DataRoot = '',
    [string]$RepoUrl = 'https://github.com/khaitam90/notiagent.git',
    # Chi de kiem thu song song voi ban dang chay (mac dinh khong can dung toi):
    [int]$WebPort = 8080,
    [int]$ApiPort = 8780,
    [int]$N8nPort = 5678,
    [string]$ComposeProject = ''
)
$ErrorActionPreference = 'Stop'

$hasD = Test-Path 'D:\'
if (-not $ProjectDir) { $ProjectDir = if ($hasD) { 'D:\Projects\NotiAgent' } else { 'C:\Projects\NotiAgent' } }
if (-not $DataRoot)   { $DataRoot   = if ($hasD) { 'D:\NotiAgentData' }      else { 'C:\NotiAgentData' } }

function Have($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function DockerReady { cmd /c 'docker info >nul 2>&1'; return ($LASTEXITCODE -eq 0) }

# 1. Git + Docker Desktop
if (-not (Have 'winget')) { throw 'Khong co winget - cai "App Installer" tu Microsoft Store roi chay lai.' }
if (-not (Have 'git')) {
    Write-Host 'Cai Git...'; winget install -e --id Git.Git --accept-package-agreements --accept-source-agreements
    $env:Path += ';C:\Program Files\Git\cmd'
}
if (-not (Have 'docker')) {
    Write-Host 'Cai Docker Desktop (co the can khoi dong lai may)...'
    winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
    Write-Host 'Da cai Docker Desktop. HAY KHOI DONG LAI MAY (neu duoc hoi), mo Docker Desktop mot lan, chap nhan dieu khoan, roi chay lai script nay.'
    exit 2
}
if (-not (DockerReady)) {
    $dd = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    Write-Host 'Bat Docker Desktop...'
    explorer.exe $dd   # bat qua explorer de chay ngoai vung ao hoa cua app Claude (xem fix-docker-stale-sockets.ps1)
    for ($i = 0; $i -lt 60 -and -not (DockerReady); $i++) { Start-Sleep -Seconds 5 }
    if (-not (DockerReady)) { throw 'Docker chua san sang - mo Docker Desktop, cho no bao "Engine running" roi chay lai.' }
}

# 2. Ma nguon
if (Test-Path (Join-Path $ProjectDir '.git')) {
    git -C $ProjectDir pull --ff-only
} else {
    New-Item -ItemType Directory -Force (Split-Path $ProjectDir) | Out-Null
    git clone $RepoUrl $ProjectDir
}

# 3. Du lieu
New-Item -ItemType Directory -Force $DataRoot | Out-Null
if ($TransferDir -and (Test-Path $TransferDir)) {
    $zip = Get-ChildItem $TransferDir -Filter 'NotiAgentData-*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($zip) {
        if ((Get-ChildItem $DataRoot -Force | Measure-Object).Count -gt 0) {
            Write-Host "Thu muc du lieu $DataRoot da co noi dung - KHONG ghi de. Xoa/doi ten no neu muon nap lai tu $($zip.Name)."
        } else {
            Write-Host "Nap du lieu tu $($zip.Name)..."
            Expand-Archive -Path $zip.FullName -DestinationPath $DataRoot -Force
        }
    }
}
foreach ($sub in 'db', 'media', 'n8n') { New-Item -ItemType Directory -Force (Join-Path $DataRoot $sub) | Out-Null }

# 4. .env (khoa API) - chinh lai duong dan du lieu cho may nay
$envPath = Join-Path $ProjectDir '.env'
$secrets = if ($TransferDir) { Join-Path $TransferDir 'NotiAgent-secrets.env' } else { '' }
if (-not (Test-Path $envPath)) {
    if ($secrets -and (Test-Path $secrets)) { Copy-Item $secrets $envPath }
    else { Copy-Item (Join-Path $ProjectDir '.env.example') $envPath; Write-Host 'Chua co khoa API: mo .env va dien khoa (TOGETHER_API_KEY, ATLASCLOUD_API_KEY...).' }
}
$dataRootFwd = $DataRoot.Replace([string][char]92, '/')
$lines = @(Get-Content $envPath)
if ($lines -match '^NOTIAGENT_DATA_ROOT=') { $lines = $lines -replace '^NOTIAGENT_DATA_ROOT=.*$', "NOTIAGENT_DATA_ROOT=$dataRootFwd" }
else { $lines = @("NOTIAGENT_DATA_ROOT=$dataRootFwd") + $lines }
foreach ($kv in @{ NOTIAGENT_WEB_PORT = $WebPort; NOTIAGENT_API_PORT = $ApiPort; N8N_PORT = $N8nPort }.GetEnumerator()) {
    $line = "$($kv.Key)=$($kv.Value)"
    if ($lines -match "^$($kv.Key)=") { $lines = $lines -replace "^$($kv.Key)=.*$", $line } else { $lines += $line }
}
Set-Content -Path $envPath -Value $lines -Encoding ascii

# 5. Chay
Push-Location $ProjectDir
try {
    if ($ComposeProject) { docker compose -p $ComposeProject up -d --build } else { docker compose up -d --build }
} finally { Pop-Location }

$checks = @(
    @{ Name = 'API'; Url = "http://127.0.0.1:$ApiPort/health" },
    @{ Name = 'Web'; Url = "http://127.0.0.1:$WebPort/app/" },
    @{ Name = 'n8n'; Url = "http://127.0.0.1:$N8nPort/healthz" }
)
$ok = $true
foreach ($c in $checks) {
    $up = $false
    for ($i = 0; $i -lt 30 -and -not $up; $i++) {
        try { $up = ((Invoke-WebRequest $c.Url -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) } catch { Start-Sleep -Seconds 4 }
    }
    Write-Host ("{0,-4} {1}" -f $c.Name, $(if ($up) { 'OK' } else { 'LOI' }))
    if (-not $up) { $ok = $false }
}
if ($ok) { Write-Host "Xong. Mo http://127.0.0.1:$WebPort/app/" } else { exit 1 }
