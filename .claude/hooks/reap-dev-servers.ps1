<#
Reap the throwaway localhost preview servers that Claude Code sessions leave behind.

WHY THIS EXISTS
  Sessions in this repo spin up a little node http server to look at app.html in
  a real browser ("npx http-server -p 8231", or an inline `node -e` one-liner).
  When the session ends, nothing kills it. It just keeps listening.

  On 2026-08-03 there were thirteen of them running at once. Five dated back to
  the previous day and had stopped responding to HTTP entirely. Only one of the
  thirteen belonged to a session that still existed. That is the whole problem:
  the process outlives the session that had a reason for it.

HOW IT DECIDES WHAT TO KILL
  Being aggressive here would be genuinely bad -- node.exe is also how the MCP
  servers run, and killing one of those mid-session breaks a live session. So a
  process has to clear every one of these bars before it is touched:

    1. It is node.exe.
    2. It is LISTENING on a TCP port. This is the guard that protects MCP
       servers: they talk over stdio and never listen, so they can never match.
       It also spares build steps, test runners, and npx wrappers.
    3. Its command line looks like a dev server (http-server / createServer /
       vite / live-server / serve).
    4. It is plausibly ours: either listening inside the dev port range, or its
       command line references this repo or a .claude working directory. This
       stops us from reaping some unrelated node service on the machine.
    5. Mode-specific ownership -- see below.

  Only when all of those hold does it die. Anything ambiguous is left running:
  a leaked server costs a few MB, a wrongly-killed one costs someone's work.

THE TWO MODES
  -Mode Own       Kill servers spawned by THIS session. Ownership is proven by
                  process ancestry, so this is exact. Wired to SessionEnd.

  -Mode Orphans   Kill servers with no live claude.exe anywhere up their parent
                  chain -- their session is gone. Wired to SessionStart, and it
                  is the layer that actually matters, because SessionEnd never
                  fires when a session is force-quit or crashes, which is how
                  all thirteen accumulated in the first place. Honours a grace
                  period so a preview you are still looking at is not yanked.

  Neither mode ever touches a server belonging to another LIVE session.

EVERY KILL IS LOGGED to .claude/reap-dev-servers.log with the port, PID, age and
command line, so a surprise is always explainable after the fact.

RUN IT BY HAND ANY TIME:
  powershell -ExecutionPolicy Bypass -File .claude/hooks/reap-dev-servers.ps1 -Mode Orphans -DryRun
#>

param(
  [ValidateSet('Own', 'Orphans')]
  [string]$Mode = 'Orphans',

  # Report what would die, kill nothing. Always safe to run.
  [switch]$DryRun,

  # Orphans mode only: leave a just-abandoned server alone this long, so a
  # browser tab you still have open survives the next session starting up.
  [int]$GraceMinutes = 30,

  [int]$PortMin = 8000,
  [int]$PortMax = 9999,

  # Ports that are never reaped, whatever else is true of them. A server you
  # started yourself from your own terminal has no Claude session above it, so
  # to this script it is indistinguishable from an abandoned one -- pin its port
  # here and it is left alone permanently. Also settable, without editing this
  # file, via the MENCHMARK_REAP_SKIP_PORTS environment variable ("8080,9000").
  [int[]]$SkipPorts = @(),

  # Emit a Claude Code hook JSON line instead of human-readable text.
  [switch]$HookOutput
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# A hook must never take a session down with it. Anything unexpected in here is
# a non-event: log nothing, kill nothing, exit clean.
trap { exit 0 }

# Not Windows? Nothing to do -- this whole thing is Win32 process introspection.
if ($env:OS -ne 'Windows_NT') { exit 0 }

$DEV_SERVER_SIGNATURE = 'http-server|createServer|live-server|\bvite\b|webpack[- ]dev|\bserve(\.js)?\b|https?-server'

# Env var tops up whatever was passed on the command line.
if ($env:MENCHMARK_REAP_SKIP_PORTS) {
  foreach ($tok in ($env:MENCHMARK_REAP_SKIP_PORTS -split '[,;\s]+')) {
    $n = 0
    if ([int]::TryParse($tok, [ref]$n) -and $n -gt 0) { $SkipPorts += $n }
  }
}

# ---------------------------------------------------------------- process table

# One snapshot, reused for every ancestry walk below. CreationDate comes along
# because Windows recycles PIDs: a "parent" that is younger than its child is a
# recycled number, not a real parent, and walking through it invents ancestry
# that does not exist.
$procs = @{}
foreach ($p in Get-CimInstance Win32_Process -ErrorAction SilentlyContinue) {
  $procs[[int]$p.ProcessId] = [pscustomobject]@{
    Pid         = [int]$p.ProcessId
    ParentPid   = [int]$p.ParentProcessId
    Name        = $p.Name
    CommandLine = $p.CommandLine
    Created     = $p.CreationDate
  }
}

function Get-Ancestors {
  param([int]$FromPid)

  $chain = @()
  $seen = @{}
  $cur = $FromPid

  for ($hop = 0; $hop -lt 24; $hop++) {
    if (-not $procs.ContainsKey($cur)) { break }
    if ($seen.ContainsKey($cur)) { break }   # cycle guard
    $seen[$cur] = $true

    $node = $procs[$cur]
    if ($hop -gt 0) { $chain += $node }

    $parentPid = $node.ParentPid
    if ($parentPid -le 0 -or $parentPid -eq $cur) { break }
    if (-not $procs.ContainsKey($parentPid)) { break }   # parent exited: chain ends

    # PID reuse check: a genuine parent always predates its child.
    $parent = $procs[$parentPid]
    if ($null -ne $parent.Created -and $null -ne $node.Created -and $parent.Created -gt $node.Created) { break }

    $cur = $parentPid
  }

  return $chain
}

function Test-HasLiveClaudeAncestor {
  param([int]$FromPid)
  foreach ($a in Get-Ancestors -FromPid $FromPid) {
    if ($a.Name -eq 'claude.exe') { return $true }
  }
  return $false
}

# ---------------------------------------------------------------- listening map

$portsByPid = @{}
foreach ($c in Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue) {
  $owner = [int]$c.OwningProcess
  if (-not $portsByPid.ContainsKey($owner)) { $portsByPid[$owner] = @() }
  if ($portsByPid[$owner] -notcontains $c.LocalPort) { $portsByPid[$owner] += [int]$c.LocalPort }
}

# ---------------------------------------------------------------- candidates

$repoMarker = 'yeshiva-points-scanner|[\\/]\.claude[\\/]'
$candidates = @()

foreach ($pidKey in $portsByPid.Keys) {
  if (-not $procs.ContainsKey($pidKey)) { continue }
  $proc = $procs[$pidKey]

  # Bar 1: node.exe only.
  if ($proc.Name -ne 'node.exe') { continue }

  $cmd = if ($null -eq $proc.CommandLine) { '' } else { $proc.CommandLine }

  # Bar 3: has to look like a dev server.
  if ($cmd -notmatch $DEV_SERVER_SIGNATURE) { continue }

  $ports = @($portsByPid[$pidKey])

  # Pinned by hand: never reaped, in either mode, at any age.
  if (@($ports | Where-Object { $SkipPorts -contains $_ }).Count -gt 0) { continue }

  # Bar 4: has to plausibly be ours -- dev port range, or a path we recognise.
  $inDevRange = @($ports | Where-Object { $_ -ge $PortMin -and $_ -le $PortMax }).Count -gt 0
  if (-not ($inDevRange -or $cmd -match $repoMarker)) { continue }

  $candidates += [pscustomobject]@{
    Pid     = $proc.Pid
    Ports   = $ports
    Cmd     = $cmd
    Created = $proc.Created
  }
}

# ---------------------------------------------------------------- ownership

$doomed = @()

if ($Mode -eq 'Own') {
  # Find the claude.exe this hook is running under, then keep only servers that
  # descend from that exact session. Ancestry is proof of ownership here.
  $ownSession = $null
  foreach ($a in Get-Ancestors -FromPid $PID) {
    if ($a.Name -eq 'claude.exe') { $ownSession = $a.Pid; break }
  }
  if ($null -eq $ownSession) { exit 0 }   # not under a session; claim nothing

  foreach ($c in $candidates) {
    $ancestorPids = (Get-Ancestors -FromPid $c.Pid | ForEach-Object { $_.Pid })
    if ($ancestorPids -contains $ownSession) { $doomed += $c }
  }
}
else {
  $now = Get-Date
  foreach ($c in $candidates) {
    # Still owned by a living session -- never ours to kill.
    if (Test-HasLiveClaudeAncestor -FromPid $c.Pid) { continue }

    # Grace period: don't yank a preview somebody may still have on screen.
    if ($null -ne $c.Created) {
      if (($now - $c.Created).TotalMinutes -lt $GraceMinutes) { continue }
    }

    $doomed += $c
  }
}

if ($doomed.Count -eq 0) { exit 0 }

# ---------------------------------------------------------------- act

$logPath = Join-Path $PSScriptRoot '..\reap-dev-servers.log'
$killed = @()

foreach ($d in $doomed) {
  $ageMin = if ($null -ne $d.Created) { [math]::Round(((Get-Date) - $d.Created).TotalMinutes) } else { -1 }
  $portList = ($d.Ports -join ',')
  $flatCmd = ($d.Cmd -replace '\s+', ' ')
  if ($flatCmd.Length -gt 200) { $flatCmd = $flatCmd.Substring(0, 200) + '...' }

  if ($DryRun) {
    $killed += "port $portList (PID $($d.Pid), ${ageMin}m old)"
    continue
  }

  try {
    Stop-Process -Id $d.Pid -Force -ErrorAction Stop
    $killed += "port $portList (PID $($d.Pid), ${ageMin}m old)"
    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    "$stamp  mode=$Mode  killed PID $($d.Pid)  port(s) $portList  age ${ageMin}m  :: $flatCmd" |
      Add-Content -Path $logPath -Encoding utf8 -ErrorAction SilentlyContinue
  }
  catch {
    # Already gone, or not ours to kill. Either way: not a problem.
  }
}

if ($killed.Count -eq 0) { exit 0 }

$verb = if ($DryRun) { 'Would reap' } else { 'Reaped' }
$what = if ($Mode -eq 'Own') { "this session's" } else { 'orphaned' }
$summary = "$verb $($killed.Count) $what dev server(s): " + ($killed -join '; ')

if ($HookOutput) {
  $json = @{ systemMessage = $summary; suppressOutput = $true } | ConvertTo-Json -Compress
  Write-Output $json
}
else {
  Write-Output $summary
}

exit 0
