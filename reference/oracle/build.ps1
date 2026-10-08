# Builds the oracle harness with a local JDK and optionally runs one trace.
#
#   .\build.ps1                                   compile only
#   .\build.ps1 <level> <missionType> <script.txt> <out.jsonl>
#
# JDK lookup: $env:JAVA_HOME\bin, then the default Adoptium 17 install, then PATH.
# For the cross-platform entry point (and Docker fallback) use run.mjs instead.
param(
    [Parameter(Position = 0)] [string] $Level,
    [Parameter(Position = 1)] [string] $MissionType,
    [Parameter(Position = 2)] [string] $Script,
    [Parameter(Position = 3)] [string] $Out
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here '..\..')
$jar = Join-Path $root 'packages\content\playman\original\Playman_Extreme_Running_240x320.jar'
$build = Join-Path $here 'build'
$classes = Join-Path $build 'classes'
$stubs = Join-Path $build 'stubs'
$oracle = Join-Path $build 'oracle'

$jdkBin = $null
$candidates = @()
if ($env:JAVA_HOME) { $candidates += (Join-Path $env:JAVA_HOME 'bin') }
$candidates += 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot\bin'
foreach ($c in $candidates) {
    if (Test-Path (Join-Path $c 'javac.exe')) { $jdkBin = $c; break }
}
if ($jdkBin) {
    $javac = Join-Path $jdkBin 'javac.exe'; $java = Join-Path $jdkBin 'java.exe'; $jartool = Join-Path $jdkBin 'jar.exe'
} else {
    $javac = 'javac'; $java = 'java'; $jartool = 'jar'
}

New-Item -ItemType Directory -Force $classes, $stubs, $oracle | Out-Null

if (-not (Test-Path (Join-Path $classes 'd.class'))) {
    Write-Host 'extracting jar -> build\classes'
    Push-Location $classes
    try { & $jartool xf $jar; if ($LASTEXITCODE -ne 0) { throw 'jar xf failed' } } finally { Pop-Location }
}

Write-Host 'compiling stubs'
$list = Join-Path $build 'stubs.list'
Get-ChildItem -Recurse -Filter '*.java' (Join-Path $here 'stubs') | ForEach-Object { $_.FullName } | Set-Content -Encoding ascii $list
& $javac -nowarn -d $stubs "@$list"
if ($LASTEXITCODE -ne 0) { throw 'stub compilation failed' }

Write-Host 'compiling Oracle.java'
& $javac -nowarn -d $oracle (Join-Path $here 'src\Oracle.java')
if ($LASTEXITCODE -ne 0) { throw 'driver compilation failed' }

if ($Level -and $MissionType -and $Script -and $Out) {
    $cp = "$classes;$stubs;$oracle"
    & $java -cp $cp Oracle $Level $MissionType (Resolve-Path $Script) $Out
    if ($LASTEXITCODE -ne 0) { throw 'oracle run failed' }
} else {
    Write-Host 'build ok'
}
