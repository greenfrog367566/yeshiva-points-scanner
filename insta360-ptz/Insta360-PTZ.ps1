<#
  Insta360-PTZ.ps1 — control the Insta360 Link 2 Pro gimbal directly on Windows.

  Uses the camera's STANDARD DirectShow controls (IAMCameraControl). No Insta360
  Link Controller app, no pairing QR, no token, no network — the camera is aimed
  over USB, with absolute pan/tilt/zoom angles. Works whether or not the app runs.

  Measured ranges on this Link 2 Pro:
      Pan  -145 .. +145      Tilt  -90 .. +100      Zoom  100 .. 400

  USAGE
    .\Insta360-PTZ.ps1 status
    .\Insta360-PTZ.ps1 set -Pan 60 -Tilt -10 -Zoom 150
    .\Insta360-PTZ.ps1 center
    .\Insta360-PTZ.ps1 sweep -Stops 5 -Span 160 -Dwell 1500 -Zoom 200
        Step across the room: `Stops` pan positions over `Span` degrees, centred
        ahead, dwelling `Dwell` ms each. Run a QR scanner on the same feed and one
        pass is a roll-call of the room. Ctrl+C stops it; it recenters on exit.

  Notes
    - "set" is absolute, so a sweep is exactly repeatable — no drift.
    - If nothing moves, the Link's AI tracking is fighting you: turn tracking
      off in Link Controller (or close the app) and try again.
    - The Insta360 *Virtual* Camera is skipped automatically.
#>
[CmdletBinding()]
param(
  [Parameter(Position=0)][ValidateSet('status','set','center','sweep')][string]$Command = 'status',
  [int]$Pan  = [int]::MinValue,
  [int]$Tilt = [int]::MinValue,
  [int]$Zoom = [int]::MinValue,
  [int]$Stops = 5,
  [int]$Span  = 160,
  [int]$Dwell = 1500,
  [string]$Device = 'Insta360 Link'
)

Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
public static class Insta360PTZ {
  [ComImport, Guid("29840822-5B84-11D0-BD3B-00A0C911CE86"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface ICreateDevEnum { [PreserveSig] int CreateClassEnumerator([In] ref Guid t, out IEnumMoniker e, int f); }
  [ComImport, Guid("55272A00-42CB-11CE-8135-00AA004BB851"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPropertyBag { [PreserveSig] int Read([MarshalAs(UnmanagedType.LPWStr)] string n, [In,Out] ref object v, IntPtr e); [PreserveSig] int Write([MarshalAs(UnmanagedType.LPWStr)] string n, [In] ref object v); }
  [ComImport, Guid("C6E13370-30AC-11d0-A18C-00A0C9118956"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAMCameraControl { [PreserveSig] int GetRange(int p, out int mn, out int mx, out int st, out int df, out int fl); [PreserveSig] int Set(int p, int v, int f); [PreserveSig] int Get(int p, out int v, out int f); }

  const int MANUAL=2;
  static Guid SysEnum = new Guid("62BE5D10-60EB-11d0-BD3B-00A0C911CE86");
  static Guid VidCat  = new Guid("860BB310-5D01-11d0-BD3B-00A0C911CE86");
  static Guid IBF     = new Guid("56a86895-0ad4-11ce-b03a-0020af0ba770");

  static IAMCameraControl _cc;
  public static string DeviceName;

  public static bool Open(string match) {
    var de = (ICreateDevEnum)Activator.CreateInstance(Type.GetTypeFromCLSID(SysEnum));
    IEnumMoniker en; Guid c = VidCat;
    if (de.CreateClassEnumerator(ref c, out en, 0) != 0 || en == null) return false;
    IMoniker[] m = new IMoniker[1];
    while (en.Next(1, m, IntPtr.Zero) == 0) {
      object bo=null; Guid pb=typeof(IPropertyBag).GUID;
      m[0].BindToStorage(null, null, ref pb, out bo);
      object no=null; ((IPropertyBag)bo).Read("FriendlyName", ref no, IntPtr.Zero);
      string fn = no as string ?? "";
      if (fn.IndexOf(match, StringComparison.OrdinalIgnoreCase) < 0) continue;
      if (fn.IndexOf("Virtual", StringComparison.OrdinalIgnoreCase) >= 0) continue;
      object filt=null; Guid ibf=IBF;
      m[0].BindToObject(null, null, ref ibf, out filt);
      var cc = filt as IAMCameraControl;
      if (cc != null) { _cc = cc; DeviceName = fn; return true; }
    }
    return false;
  }
  public static bool SetProp(int prop, int val) {
    int mn,mx,st,df,fl; if (_cc==null || _cc.GetRange(prop, out mn,out mx,out st,out df,out fl)!=0) return false;
    int v = Math.Max(mn, Math.Min(mx, val));
    return _cc.Set(prop, v, MANUAL)==0;
  }
  public static int GetProp(int prop) { int v,f; return (_cc!=null && _cc.Get(prop, out v, out f)==0) ? v : int.MinValue; }
  public static string RangeOf(int prop) { int mn,mx,st,df,fl; return (_cc!=null && _cc.GetRange(prop, out mn,out mx,out st,out df,out fl)==0) ? (mn+".."+mx) : "n/a"; }
}
'@

if (-not [Insta360PTZ]::Open($Device)) { Write-Error "No camera found matching '$Device'. Is it plugged in?"; exit 1 }

function Show-Status {
  Write-Host ("Device: {0}" -f [Insta360PTZ]::DeviceName)
  Write-Host ("  Pan  range {0,-10} now {1}" -f [Insta360PTZ]::RangeOf(0), [Insta360PTZ]::GetProp(0))
  Write-Host ("  Tilt range {0,-10} now {1}" -f [Insta360PTZ]::RangeOf(1), [Insta360PTZ]::GetProp(1))
  Write-Host ("  Zoom range {0,-10} now {1}" -f [Insta360PTZ]::RangeOf(3), [Insta360PTZ]::GetProp(3))
}

switch ($Command) {
  'status' { Show-Status }
  'set' {
    if ($Pan  -ne [int]::MinValue) { [void][Insta360PTZ]::SetProp(0,$Pan) }
    if ($Tilt -ne [int]::MinValue) { [void][Insta360PTZ]::SetProp(1,$Tilt) }
    if ($Zoom -ne [int]::MinValue) { [void][Insta360PTZ]::SetProp(3,$Zoom) }
    Show-Status
  }
  'center' {
    [void][Insta360PTZ]::SetProp(0,0); [void][Insta360PTZ]::SetProp(1,0); [void][Insta360PTZ]::SetProp(3,100)
    Show-Status
  }
  'sweep' {
    if ($Zoom -eq [int]::MinValue) { $Zoom = 200 }
    [void][Insta360PTZ]::SetProp(3,$Zoom)
    [void][Insta360PTZ]::SetProp(1,0)
    if ($Stops -lt 2) { $Stops = 2 }
    $half = [Math]::Max(1, [Math]::Floor($Span/2))
    $positions = @()
    for ($i=0; $i -lt $Stops; $i++) { $positions += [int](-$half + ($Span * $i / ($Stops-1))) }
    Write-Host "Sweeping $Stops stops across $Span deg at zoom $Zoom. Ctrl+C to stop."
    try {
      while ($true) {
        foreach ($p in $positions) {
          [void][Insta360PTZ]::SetProp(0,$p)
          Write-Host ("  pan {0,4}   (now {1})" -f $p, [Insta360PTZ]::GetProp(0))
          Start-Sleep -Milliseconds $Dwell
        }
      }
    } finally {
      [void][Insta360PTZ]::SetProp(0,0); [void][Insta360PTZ]::SetProp(1,0); [void][Insta360PTZ]::SetProp(3,100)
      Write-Host "Recentered."
    }
  }
}
