#!/usr/bin/env bash
# Thin wrapper so the reaper can be wired into .claude/settings.json the same
# way sync-main-checkout.sh is (bash hook, JSON systemMessage on stdout).
#
# The real work is in reap-dev-servers.ps1 -- reaping needs Win32 process and
# TCP-listener introspection, which is PowerShell's job, not bash's. Read the
# header of the .ps1 for what it kills and the guards that keep it from killing
# anything else.
#
# Usage: reap-dev-servers.sh <Own|Orphans>
#
# Never fails a session: no PowerShell, wrong OS, or any error at all just
# exits 0 quietly.

set -u

mode="${1:-Orphans}"

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd) || exit 0
ps1="$script_dir/reap-dev-servers.ps1"
[ -f "$ps1" ] || exit 0

# Windows only. On anything else there is nothing to reap.
case "$(uname -s 2>/dev/null)" in
  MINGW* | MSYS* | CYGWIN*) ;;
  *) exit 0 ;;
esac

pwsh_exe=$(command -v powershell.exe || command -v pwsh.exe) || exit 0

# Hooks receive JSON on stdin; the reaper does not read it, but leaving stdin
# connected can make PowerShell wait on it. </dev/null keeps that from hanging.
"$pwsh_exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass \
  -File "$(cygpath -w "$ps1" 2>/dev/null || echo "$ps1")" \
  -Mode "$mode" -HookOutput </dev/null 2>/dev/null || exit 0

exit 0
