<#
  ptz-bridge.ps1 — a tiny local HTTP bridge so a browser page can aim the
  Insta360 Link gimbal. Loads the DirectShow control once and serves it on
  http://localhost:8787/ with permissive CORS, so the multi-QR test page's
  sweep mode can move the real camera with a fetch() per stop.

  Run it, leave it open:
      powershell -ExecutionPolicy Bypass -File .\ptz-bridge.ps1
  Then the test page auto-detects it. Ctrl+C to stop (recenters on exit).

  Endpoints (all GET, all return JSON, all CORS *):
      /status                      -> {device, pan, tilt, zoom, ranges}
      /set?pan=..&tilt=..&zoom=..   -> sets absolute angles (omit any axis)
      /center                      -> pan 0, tilt 0, zoom 100
#>
param([int]$Port = 8787, [string]$Device = 'Insta360 Link')

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
      object bo=null; Guid pb=typeof(IPropertyBag).GUID; m[0].BindToStorage(null, null, ref pb, out bo);
      object no=null; ((IPropertyBag)bo).Read("FriendlyName", ref no, IntPtr.Zero);
      string fn = no as string ?? "";
      if (fn.IndexOf(match, StringComparison.OrdinalIgnoreCase) < 0) continue;
      if (fn.IndexOf("Virtual", StringComparison.OrdinalIgnoreCase) >= 0) continue;
      object filt=null; Guid ibf=IBF; m[0].BindToObject(null, null, ref ibf, out filt);
      var cc = filt as IAMCameraControl;
      if (cc != null) { _cc = cc; DeviceName = fn; return true; }
    }
    return false;
  }
  public static bool SetProp(int prop, int val) { int mn,mx,st,df,fl; if (_cc==null || _cc.GetRange(prop, out mn,out mx,out st,out df,out fl)!=0) return false; int v = Math.Max(mn, Math.Min(mx, val)); return _cc.Set(prop, v, MANUAL)==0; }
  public static int GetProp(int prop) { int v,f; return (_cc!=null && _cc.Get(prop, out v, out f)==0) ? v : int.MinValue; }
  public static int RangeMin(int prop){ int mn,mx,st,df,fl; return _cc.GetRange(prop, out mn,out mx,out st,out df,out fl)==0?mn:0; }
  public static int RangeMax(int prop){ int mn,mx,st,df,fl; return _cc.GetRange(prop, out mn,out mx,out st,out df,out fl)==0?mx:0; }
}
'@

if (-not [Insta360PTZ]::Open($Device)) { Write-Error "No camera found matching '$Device'."; exit 1 }
$name = [Insta360PTZ]::DeviceName

function Json {
  $p=[Insta360PTZ]::GetProp(0); $t=[Insta360PTZ]::GetProp(1); $z=[Insta360PTZ]::GetProp(3)
  '{"device":"'+$name+'","pan":'+$p+',"tilt":'+$t+',"zoom":'+$z+
    ',"panRange":['+[Insta360PTZ]::RangeMin(0)+','+[Insta360PTZ]::RangeMax(0)+']'+
    ',"tiltRange":['+[Insta360PTZ]::RangeMin(1)+','+[Insta360PTZ]::RangeMax(1)+']'+
    ',"zoomRange":['+[Insta360PTZ]::RangeMin(3)+','+[Insta360PTZ]::RangeMax(3)+']}'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "PTZ bridge on http://localhost:$Port/  ->  $name"
Write-Host "Endpoints: /status  /set?pan=..&tilt=..&zoom=..  /center   (Ctrl+C to stop)"
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    $res.AddHeader("Access-Control-Allow-Origin","*")
    $res.ContentType = "application/json"
    $path = $req.Url.AbsolutePath.ToLower()
    $q = $req.QueryString
    try {
      switch ($path) {
        '/set' {
          if ($q['pan']  -ne $null) { [void][Insta360PTZ]::SetProp(0,[int]$q['pan']) }
          if ($q['tilt'] -ne $null) { [void][Insta360PTZ]::SetProp(1,[int]$q['tilt']) }
          if ($q['zoom'] -ne $null) { [void][Insta360PTZ]::SetProp(3,[int]$q['zoom']) }
          $body = Json
        }
        '/center' {
          [void][Insta360PTZ]::SetProp(0,0); [void][Insta360PTZ]::SetProp(1,0); [void][Insta360PTZ]::SetProp(3,100)
          $body = Json
        }
        default { $body = Json }   # /status and anything else
      }
    } catch { $body = '{"error":"' + ($_.Exception.Message -replace '"',"'") + '"}' }
    $buf = [System.Text.Encoding]::UTF8.GetBytes($body)
    $res.ContentLength64 = $buf.Length
    $res.OutputStream.Write($buf, 0, $buf.Length)
    $res.OutputStream.Close()
  }
} finally {
  [void][Insta360PTZ]::SetProp(0,0); [void][Insta360PTZ]::SetProp(1,0); [void][Insta360PTZ]::SetProp(3,100)
  $listener.Stop()
  Write-Host "Bridge stopped; recentered."
}
