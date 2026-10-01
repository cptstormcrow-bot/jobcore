<#
.SYNOPSIS
Builds a standalone, locally-signed release APK of the JobCore Expo SDK 52 app with Gradle (no EAS cloud).

.DESCRIPTION
Stage 1 PREFLIGHT checks app.json vs. android/ native project, .env names, JDK, Android SDK, node_modules
and the substitute drive letter. Stage 2 BUILD maps the monorepo root to a short drive letter (subst) to dodge
Windows 260-char path limits, runs gradlew assembleRelease, and copies the APK to the mobile root as
jobcore-<version>-vc<versionCode>.apk. Stage 3 VERIFY checks the signature (apksigner) and the badging (aapt)
against app.json and prints the SHA-256.

Run from a checkout that has apps/mobile/android/ and apps/mobile/.env. Paths resolve relative to this script.
The release build is signed with the debug keystore per the prebuild template (sideload-only, not Play-ready).

.PARAMETER PreflightOnly
Run Stage 1 only, then exit 0 if everything passes.

.PARAMETER Abi
Optional ABI filter, e.g. 'arm64-v8a'. Empty builds all ABIs.

.PARAMETER JavaHome
Optional JDK home override.

.PARAMETER Drive
Drive letter used for subst (default 'Z:').

.EXAMPLE
npm run build:apk
(from apps/mobile)

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1 -PreflightOnly

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1 -Abi arm64-v8a
#>
[CmdletBinding()]
param(
    [switch]$PreflightOnly,
    [string]$Abi = '',
    [string]$JavaHome = '',
    [string]$Drive = 'Z:'
)

$ErrorActionPreference = 'Stop'

$MobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$MonoRoot = (Resolve-Path (Join-Path $MobileRoot '..\..')).Path
$RequiredEnv = @('EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY')
$PrebuildHint = 'run `npx expo prebuild --platform android` (never --clean)'

$script:Fails = 0
function Write-Check {
    param([bool]$Ok, [string]$Name, [string]$Detail = '')
    if ($Ok) {
        Write-Host ("PASS  {0}" -f $Name)
    } else {
        $script:Fails++
        Write-Host ("FAIL  {0}: {1}" -f $Name, $Detail)
    }
}

function ConvertTo-JdkMajor {
    param([string]$Ver)
    $m = [regex]::Match($Ver, '^(\d+)(?:\.(\d+))?')
    if (-not $m.Success) { return 0 }
    $first = [int]$m.Groups[1].Value
    if ($first -eq 1 -and $m.Groups[2].Success) { return [int]$m.Groups[2].Value }
    return $first
}

function Get-JdkMajor {
    param([string]$JdkPath)
    try {
        $rel = Join-Path $JdkPath 'release'
        if (Test-Path $rel) {
            foreach ($l in [IO.File]::ReadAllLines($rel)) {
                $m = [regex]::Match($l, '^\s*JAVA_VERSION\s*=\s*"([^"]+)"')
                if ($m.Success) { return (ConvertTo-JdkMajor $m.Groups[1].Value) }
            }
        }
        $out = (& (Join-Path $JdkPath 'bin\java.exe') -version 2>&1) | Out-String
        $m = [regex]::Match($out, '"([^"]+)"')
        if ($m.Success) { return (ConvertTo-JdkMajor $m.Groups[1].Value) }
    } catch { }
    return 0
}

# ---------------- Stage 1 PREFLIGHT ----------------
Write-Host '== Stage 1: PREFLIGHT =='

$version = ''
$versionCode = ''
$package = ''
$appJsonPath = Join-Path $MobileRoot 'app.json'
$appOk = $false
if (Test-Path $appJsonPath) {
    try {
        $app = [IO.File]::ReadAllText($appJsonPath) | ConvertFrom-Json
        $version = [string]$app.expo.version
        $versionCode = [string]$app.expo.android.versionCode
        $package = [string]$app.expo.android.package
        if ($version -and $versionCode -and $package) { $appOk = $true }
    } catch {
        $appOk = $false
    }
}
Write-Check $appOk 'app.json (version, versionCode, package)' 'missing or unreadable expo.version / expo.android.versionCode / expo.android.package'

$androidDir = Join-Path $MobileRoot 'android'
$hasAndroid = Test-Path $androidDir
Write-Check $hasAndroid 'android/ directory' $PrebuildHint

$gradlePath = Join-Path $androidDir 'app\build.gradle'
if ($hasAndroid -and $appOk) {
    if (Test-Path $gradlePath) {
        $g = [IO.File]::ReadAllText($gradlePath)
        $mVc = [regex]::Match($g, 'versionCode\s+(\d+)')
        $mVn = [regex]::Match($g, 'versionName\s+"([^"]+)"')
        $mId = [regex]::Match($g, 'applicationId\s+[''"]([^''"]+)[''"]')
        $gVc = ''
        $gVn = ''
        $gId = ''
        if ($mVc.Success) { $gVc = $mVc.Groups[1].Value }
        if ($mVn.Success) { $gVn = $mVn.Groups[1].Value }
        if ($mId.Success) { $gId = $mId.Groups[1].Value }
        Write-Check ($gVc -eq $versionCode) 'build.gradle versionCode matches app.json' ("gradle='{0}' app.json='{1}'; {2}" -f $gVc, $versionCode, $PrebuildHint)
        Write-Check ($gVn -eq $version) 'build.gradle versionName matches app.json' ("gradle='{0}' app.json='{1}'; {2}" -f $gVn, $version, $PrebuildHint)
        Write-Check ($gId -eq $package) 'build.gradle applicationId matches package' ("gradle='{0}' app.json='{1}'; {2}" -f $gId, $package, $PrebuildHint)
    } else {
        Write-Check $false 'android/app/build.gradle' $PrebuildHint
    }
}

$envPath = Join-Path $MobileRoot '.env'
if (Test-Path $envPath) {
    $envLines = [IO.File]::ReadAllLines($envPath)
    foreach ($name in $RequiredEnv) {
        $found = $false
        foreach ($line in $envLines) {
            if ($line -match ('^\s*' + [regex]::Escape($name) + '=\s*\S')) { $found = $true; break }
        }
        Write-Check $found (".env has $name (non-empty)") 'missing or empty'
    }
} else {
    Write-Check $false '.env in mobile root' 'file not found'
}

# JDK
$jdk = ''
$jdkCandidates = @()
if ($JavaHome) { $jdkCandidates += $JavaHome }
elseif ($env:JAVA_HOME) { $jdkCandidates += $env:JAVA_HOME }
$jdkCandidates += 'C:\Program Files\Android\Android Studio\jbr'
$jdkCandidates += (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr')
foreach ($c in $jdkCandidates) {
    if ($c -and (Test-Path (Join-Path $c 'bin\java.exe'))) {
        $major = Get-JdkMajor $c
        if ($major -ge 17) { $jdk = $c; $jdkMajor = $major; break }
        Write-Host ("WARN  skipping JDK {0} (major {1}; need 17+)" -f $c, $major)
    }
}
Write-Check ($jdk -ne '') 'JDK 17+ (bin\java.exe)' 'JDK 17+ is required; none found. Use Android Studio jbr or pass -JavaHome'
if ($jdk) { Write-Host ("      JDK: {0} (major {1})" -f $jdk, $jdkMajor) }

# Android SDK
$sdk = ''
if ($env:ANDROID_HOME) { $sdk = $env:ANDROID_HOME }
elseif ($env:ANDROID_SDK_ROOT) { $sdk = $env:ANDROID_SDK_ROOT }
else { $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$apksigner = ''
$aapt = ''
$btDir = Join-Path $sdk 'build-tools'
if (Test-Path $btDir) {
    $dirs = Get-ChildItem -Path $btDir -Directory | Sort-Object { try { [version]($_.Name -replace '[^\d\.].*$', '') } catch { [version]'0.0' } } -Descending
    foreach ($d in $dirs) {
        $s = Join-Path $d.FullName 'apksigner.bat'
        $a = Join-Path $d.FullName 'aapt.exe'
        if ((Test-Path $s) -and (Test-Path $a)) { $apksigner = $s; $aapt = $a; break }
    }
}
Write-Check ($apksigner -ne '') 'Android SDK build-tools (apksigner.bat + aapt.exe)' ("none found under '{0}'" -f $btDir)
if ($apksigner) { Write-Host ("      build-tools: {0}" -f (Split-Path $apksigner -Parent)) }

Write-Check (Test-Path (Join-Path $MonoRoot 'node_modules')) 'node_modules at monorepo root' 'run npm install at the monorepo root'

Write-Check (-not (Test-Path "$Drive\")) "drive $Drive free" "drive $Drive is in use; free it or pass -Drive"

if ($script:Fails -gt 0) {
    throw ("Preflight failed: {0} check(s) FAILED" -f $script:Fails)
}
if ($PreflightOnly) {
    Write-Host 'Preflight passed'
    exit 0
}

# ---------------- Stage 2 BUILD ----------------
Write-Host '== Stage 2: BUILD =='
$outApk = Join-Path $MobileRoot ("jobcore-{0}-vc{1}.apk" -f $version, $versionCode)
$substDone = $false
try {
    & subst $Drive $MonoRoot
    if ($LASTEXITCODE -ne 0) { throw "subst $Drive failed" }
    $substDone = $true

    $env:JAVA_HOME = $jdk
    $env:PATH = (Join-Path $jdk 'bin') + ';' + $env:PATH

    Push-Location "$Drive\apps\mobile\android"
    try {
        $gargs = @('assembleRelease')
        if ($Abi) { $gargs += "-PreactNativeArchitectures=$Abi" }
        & .\gradlew.bat @gargs
        if ($LASTEXITCODE -ne 0) { throw "gradlew assembleRelease failed (exit $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }

    $srcApk = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'
    if (-not (Test-Path $srcApk)) { throw "APK not found: $srcApk" }
    Copy-Item -Path $srcApk -Destination $outApk -Force
    Write-Host ("Copied APK to {0}" -f $outApk)
} finally {
    if ($substDone) {
        & subst $Drive /D
        if (Test-Path "$Drive\") {
            Write-Host "WARNING: drive $Drive still mapped after subst /D"
        } else {
            Write-Host "Drive $Drive released"
        }
    }
}

# ---------------- Stage 3 VERIFY ----------------
Write-Host '== Stage 3: VERIFY =='
$bad = 0

# NOTE: release is signed with the debug keystore per the prebuild template (sideload-only, not Play-ready).
$sigOut = & $apksigner verify --print-certs $outApk 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host 'FAIL  apksigner verify'
    $bad++
} else {
    Write-Host 'PASS  apksigner verify'
    foreach ($l in $sigOut) {
        $t = [string]$l
        if ($t -match 'Signer #1 certificate DN' -or $t -match 'Signer #1 certificate SHA-256 digest') { Write-Host ("      {0}" -f $t.Trim()) }
    }
}

$badging = & $aapt dump badging $outApk 2>&1
$pkgLine = ''
foreach ($l in $badging) {
    if (([string]$l) -like 'package:*') { $pkgLine = [string]$l; break }
}
$bName = ''
$bVc = ''
$bVn = ''
$m = [regex]::Match($pkgLine, "name='([^']*)'")
if ($m.Success) { $bName = $m.Groups[1].Value }
$m = [regex]::Match($pkgLine, "versionCode='([^']*)'")
if ($m.Success) { $bVc = $m.Groups[1].Value }
$m = [regex]::Match($pkgLine, "versionName='([^']*)'")
if ($m.Success) { $bVn = $m.Groups[1].Value }
if ($bName -eq $package -and $bVc -eq $versionCode -and $bVn -eq $version) {
    Write-Host ("PASS  badging: {0} {1} (vc {2})" -f $bName, $bVn, $bVc)
} else {
    Write-Host ("FAIL  badging mismatch: apk name='{0}' vc='{1}' vn='{2}' vs app.json name='{3}' vc='{4}' vn='{5}'" -f $bName, $bVc, $bVn, $package, $versionCode, $version)
    $bad++
}

$hash = (Get-FileHash -Algorithm SHA256 -Path $outApk).Hash
$mb = [math]::Round((Get-Item $outApk).Length / 1MB, 2)
Write-Host ("SHA-256: {0}" -f $hash)
Write-Host ("Size: {0} MB" -f $mb)
Write-Host ("Path: {0}" -f $outApk)

if ($bad -gt 0) {
    Write-Host ("VERIFY FAILED: {0} problem(s)" -f $bad)
    exit 1
}
Write-Host ("APK ready: {0}" -f $outApk)
exit 0
