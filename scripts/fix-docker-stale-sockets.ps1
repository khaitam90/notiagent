# Sửa Docker Desktop không khởi động sau khi máy tắt đột ngột.
#
# Nguyên nhân (xác minh 2026-09-30):
# 1. Tắt máy đột ngột để lại file socket rỗng (sailor-ingest.sock, engine.sock...). Windows báo lỗi
#    1920 khi xóa/đổi tên chúng (del, Remove-Item, robocopy, .NET đều thất bại) nên Docker dừng với
#    lỗi "rename ...sock.stale: The file cannot be accessed by the system". `rm` trong WSL xóa được.
# 2. Nếu Docker được bật TỪ BÊN TRONG app Claude/Codex (Start-Process), nó chạy trong vùng ảo hóa của
#    app (MSIX) và ghi %LOCALAPPDATA%\docker-secrets-engine vào
#    %LOCALAPPDATA%\Packages\Claude_*\LocalCache\Local\... thay vì thư mục thật -> đổi tên/xóa ở
#    thư mục thật không có tác dụng. Vì vậy script bật Docker qua explorer.exe (chạy ngoài vùng ảo).
#
# Chạy: powershell -ExecutionPolicy Bypass -File scripts\fix-docker-stale-sockets.ps1

$ErrorActionPreference = 'Stop'

Get-Process | Where-Object { $_.Name -match '^(Docker Desktop|com\.docker\..*|docker)$' } |
    Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 4

$dirs = @("$env:LOCALAPPDATA\Docker\run", "$env:LOCALAPPDATA\docker-secrets-engine")
$dirs += Get-ChildItem "$env:LOCALAPPDATA\Packages" -Directory -Filter 'Claude_*' -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName 'LocalCache\Local\docker-secrets-engine' }

foreach ($dir in $dirs) {
    # C:\a\b -> /mnt/c/a/b (wslpath làm mất dấu \ khi truyền qua wsl.exe).
    $wslDir = '/mnt/' + $dir.Substring(0, 1).ToLower() + $dir.Substring(2).Replace([string][char]92, '/')
    # Chỉ xóa file (socket rỗng) trực tiếp trong thư mục runtime, không đụng thư mục con.
    wsl -e sh -c "[ -d '$wslDir' ] && find '$wslDir' -mindepth 1 -maxdepth 1 -not -type d -exec rm -f {} + ; true"
}

explorer.exe "C:\Program Files\Docker\Docker\Docker Desktop.exe"
for ($i = 0; $i -lt 60; $i++) {
    cmd /c 'docker info >nul 2>&1'
    if ($LASTEXITCODE -eq 0) { Write-Host 'Docker sẵn sàng'; exit 0 }
    Start-Sleep -Seconds 5
}
Write-Host 'Docker chưa sẵn sàng sau 5 phút - xem hộp thoại lỗi trên màn hình'
exit 1
