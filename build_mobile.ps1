#!/usr/bin/env pwsh
# Локальная сборка Flutter APK с автоинкрементом версии
# Версия 1.0.{BUILD_NUMBER} синхронизируется между pubspec.yaml и отображением в приложении
#
# Использование:
#   .\build_mobile.ps1            # инкрементирует билд-номер и собирает
#   .\build_mobile.ps1 -NoIncrement  # пересборка без инкремента
param(
    [switch]$NoIncrement
)

$ErrorActionPreference = 'Stop'

$repoRoot = $PSScriptRoot
$pubspecPath     = Join-Path $repoRoot 'MobileFlutter\pubspec.yaml'
$buildNumberPath = Join-Path $repoRoot 'MobileFlutter\mobile_build_number.txt'

# Читаем и (при необходимости) инкрементируем билд-номер
$buildNumber = [int](Get-Content $buildNumberPath -Raw).Trim()
if (-not $NoIncrement) {
    $buildNumber++
    Set-Content $buildNumberPath $buildNumber -NoNewline -Encoding UTF8
}

$buildDate   = (Get-Date).ToString('yyyy-MM-dd')
$versionName = "1.0.$buildNumber"   # отображается в настройках Android
$versionCode = $buildNumber         # целое число для Google Play

Write-Host "Версия: $versionName (code $versionCode) от $buildDate"

# Обновляем pubspec.yaml: строка вида  version: 1.0.X+X
$pubspecContent = [System.IO.File]::ReadAllText($pubspecPath, [System.Text.UTF8Encoding]::new($false))
$pubspecUpdated = $pubspecContent -replace '(?m)^version:.*$', "version: $versionName+$versionCode"
[System.IO.File]::WriteAllText($pubspecPath, $pubspecUpdated, [System.Text.UTF8Encoding]::new($false))

# Сборка — версия передаётся через --dart-define (version.dart использует String.fromEnvironment)
Push-Location (Join-Path $repoRoot 'MobileFlutter')
try {
    & D:\flutter\flutter\bin\flutter.bat build apk `
        --dart-define=BUILD_NUMBER=$buildNumber `
        --dart-define=BUILD_DATE=$buildDate
    if ($LASTEXITCODE -ne 0) { throw "flutter build apk завершился с ошибкой" }
    Write-Host "`nAPK: MobileFlutter\build\app\outputs\flutter-apk\app-release.apk"
} finally {
    Pop-Location
}
