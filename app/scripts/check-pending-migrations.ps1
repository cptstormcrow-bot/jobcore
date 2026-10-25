# check-pending-migrations.ps1
# WARN-ONLY session-start check. Runs the READ-ONLY `supabase migration list`, then prints
# short warnings about local migrations not applied live and ledger drift
# (docs\supabase-push-ledger.md). Never pushes, repairs, resets, or writes anything.
# ALWAYS exits 0; 20s soft timeout (child process is killed). Prints nothing when clean.
# Windows PowerShell 5.1 compatible.
# CLI output formats: v2 (2.x) prints a stderr 'Warning' line then ONE JSON line on stdout
# ({"migrations":[{"local":..,"remote":..}]}), used with --linked; v1 (1.x) prints a
# box/pipe table, parsed as a fallback when no JSON line is found.

$ErrorActionPreference = 'Continue'
$app = Split-Path -Parent $PSScriptRoot
$repo = Split-Path -Parent $app
$cli = Join-Path $app 'node_modules\.bin\supabase.cmd'
$ledger = Join-Path $repo 'docs\supabase-push-ledger.md'
$out = @()

function Finish {
    $out | Select-Object -First 8 | ForEach-Object { Write-Output $_ }
    exit 0
}

if (-not (Test-Path -LiteralPath $cli)) {
    $out += 'migration check skipped: supabase CLI not installed'
    Finish
}

$tmpOut = [IO.Path]::GetTempFileName()
$tmpErr = [IO.Path]::GetTempFileName()
$proc = $null
try {
    $argLine = '/c ""' + $cli + '" migration list --linked --workdir "' + $app + '""'
    $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList $argLine -NoNewWindow -PassThru `
        -RedirectStandardOutput $tmpOut -RedirectStandardError $tmpErr
    if (-not $proc.WaitForExit(20000)) {
        try { & taskkill.exe /PID $proc.Id /T /F *> $null } catch { }
        $out += 'migration check skipped: timed out after 20s'
        Finish
    }
    $raw = ''
    if (Test-Path -LiteralPath $tmpOut) { $raw = [IO.File]::ReadAllText($tmpOut) }
    $errTxt = ''
    if (Test-Path -LiteralPath $tmpErr) { $errTxt = [IO.File]::ReadAllText($tmpErr) }
} catch {
    $out += 'migration check skipped: ' + $_.Exception.Message
    Finish
} finally {
    Remove-Item -LiteralPath $tmpOut, $tmpErr -Force -ErrorAction SilentlyContinue
}

$esc = [char]27
$ansi = $esc + '\[[0-9;]*[A-Za-z]'
$raw = [regex]::Replace($raw, $ansi, '')
$errTxt = [regex]::Replace($errTxt, $ansi, '')

$local = @(); $remote = @(); $rows = 0
$lines = @($raw -split "`r?`n")
$jsonLine = $lines | Where-Object { $_.TrimStart().StartsWith('{') } | Select-Object -First 1
if ($jsonLine) {
    try {
        $obj = $jsonLine | ConvertFrom-Json
        foreach ($it in @($obj.migrations)) {
            if ($null -eq $it) { continue }
            $l = [string]$it.local; $r = [string]$it.remote
            $rows++
            if ($l.Trim()) { $local += $l.Trim() }
            if ($r.Trim()) { $remote += $r.Trim() }
        }
    } catch { $rows = 0; $local = @(); $remote = @() }
}
if ($rows -eq 0) {
foreach ($line in $lines) {
    $bar = '[|' + [char]0x2502 + ']'
    $m = [regex]::Match($line, '^\s*(\d*)\s*' + $bar + '\s*(\d*)\s*' + $bar)
    if ($m.Success -and ($m.Groups[1].Value -or $m.Groups[2].Value)) {
        $rows++
        if ($m.Groups[1].Value) { $local += $m.Groups[1].Value }
        if ($m.Groups[2].Value) { $remote += $m.Groups[2].Value }
    }
}
}

if ($rows -eq 0) {
    $reason = ($errTxt.Trim() -split "`r?`n" | Where-Object { $_.Trim() -and $_ -notmatch '^\s*Warning' } | Select-Object -First 1)
    if (-not $reason) { $reason = 'no migration rows returned' }
    if ($reason.Length -gt 120) { $reason = $reason.Substring(0, 120) }
    $out += 'migration check skipped: ' + $reason
    Finish
}

$pending = @($local | Where-Object { $remote -notcontains $_ } | Sort-Object -Unique)

$future = @()
if (Test-Path -LiteralPath $ledger) {
    $inFuture = $false
    foreach ($line in [IO.File]::ReadAllLines($ledger)) {
        if ($line -match '^##\s') { $inFuture = ($line -match '^##\s+Future') ; continue }
        if ($inFuture) {
            $m = [regex]::Match($line, '^\s*\|\s*[^0-9|]*?(\d{4})(?!\d)')
            if ($m.Success) { $future += $m.Groups[1].Value }
        }
    }
    $future = @($future | Sort-Object -Unique)
}

if ($pending.Count -gt 0) {
    $out += 'PENDING (local only, not live): ' + ($pending -join ', ')
    if (Test-Path -LiteralPath $ledger) {
        $missing = @($pending | Where-Object { $future -notcontains $_ })
        if ($missing.Count -gt 0) { $out += 'NOT IN LEDGER: ' + ($missing -join ', ') }
    }
}
$stale = @($future | Where-Object { $remote -contains $_ })
if ($stale.Count -gt 0) {
    $out += 'LEDGER STALE: ' + ($stale -join ', ') + ' is in Future but already live - move to Past'
}
Finish
