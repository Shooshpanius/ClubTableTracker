#!/usr/bin/env pwsh
# Локальная сборка Flutter APK с подстановкой версии
$ErrorActionPreference = 'Stop'

$repoRoot = $PSScriptRoot
$versionDartPath = Join-Path $repoRoot 'MobileFlutter\lib\version.dart'
$mobileBuildNumberPath = Join-Path $repoRoot 'MobileFlutter\mobile_build_number.txt'
$webVersionTsPath = Join-Path $repoRoot 'clubtabletracker.client\src\version.ts'

# Читаем значения
$buildNumber = (Get-Content $mobileBuildNumberPath -Raw).Trim()
$webVersionTs = Get-Content $webVersionTsPath -Raw
$webVersion = [regex]::Match($webVersionTs, 'LAST_PR_NUMBER\s*=\s*(\d+)').Groups[1].Value
$buildDate = (Get-Date).ToString('yyyy-MM-dd')

Write-Host "Версия: $webVersion.$buildNumber от $buildDate"

# Бэкап и замена
$originalContent = Get-Content $versionDartPath -Raw
$updatedContent = $originalContent `
    -replace "= 'WEB_VERSION'", "= '$webVersion'" `
    -replace "= 'BUILD_NUMBER'", "= '$buildNumber'" `
    -replace "= 'BUILD_DATE'", "= '$buildDate'"

Set-Content $versionDartPath $updatedContent -NoNewline -Encoding UTF8

try {
    Push-Location (Join-Path $repoRoot 'MobileFlutter')
    & D:\flutter\flutter\bin\flutter.bat build apk
    if ($LASTEXITCODE -ne 0) { throw "flutter build apk failed" }
    Write-Host "`nAPK: MobileFlutter\build\app\outputs\flutter-apk\app-release.apk"
} finally {
    # Восстанавливаем version.dart
    Set-Content $versionDartPath $originalContent -NoNewline -Encoding UTF8
    Pop-Location
}
