# デスクトップに「お問い合わせ受信箱」のショートカットを置く。
#
#   npm run inbox:shortcut
#
# 何度流しても同じ場所を上書きするだけ（増えない）。消したいときはデスクトップから削除する。
#
# ⚠️ このファイルは **UTF-8 (BOM付き)** で保存すること。
#    Windows PowerShell 5.1 は BOM が無い .ps1 を ANSI として読むので、日本語が壊れる。
#
# ⚠️ ショートカットは**最小化**で開くようにしてある（WindowStyle = 7）。
#    黒い窓は「閉じる＝アプリを止める」スイッチとして要るが、顔の前に出す必要は無い。

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$target  = Join-Path $root 'tools\inbox-app.cmd'
$icon    = Join-Path $root 'tools\inbox.ico'

if (-not (Test-Path $target)) { throw "起動用の .cmd が見つからない: $target" }
if (-not (Test-Path $icon))   { throw "アイコンが見つからない。先に npm run inbox:icon" }

$desktop = [Environment]::GetFolderPath('Desktop')
$link    = Join-Path $desktop 'お問い合わせ受信箱.lnk'

$shell    = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($link)
$shortcut.TargetPath       = $target
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation     = "$icon,0"
$shortcut.WindowStyle      = 7
$shortcut.Description      = 'お問い合わせ受信箱（手元だけで動きます。黒い窓を閉じると終了）'
$shortcut.Save()

Write-Output "置いた: $link"
Write-Output "  起動するもの: $target"
Write-Output "  アイコン    : $icon"
