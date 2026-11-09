using System;
using System.Text;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;

public class ForegroundProbe {
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
 [DllImport("kernel32.dll")] static extern uint GetTickCount();
 [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, uint flags, StringBuilder s, ref uint size);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 [DllImport("user32.dll")] static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
 [DllImport("user32.dll")] static extern bool CloseDesktop(IntPtr h);
 [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO {public uint cbSize; public uint dwTime;}
 public static void Main(string[] args) {
  Console.OutputEncoding=new UTF8Encoding(false);
  var serializer=new JavaScriptSerializer();
  uint previousPid=0;string previousPath="", previousName="";
  while(true) {
   try {
    var input=new LASTINPUTINFO();input.cbSize=(uint)Marshal.SizeOf(input);
    bool hasInput=GetLastInputInfo(ref input);
    long idle=hasInput?(long)unchecked(GetTickCount()-input.dwTime):Int32.MaxValue;
    IntPtr desk=OpenInputDesktop(0,false,0x0100);bool locked=desk==IntPtr.Zero;if(desk!=IntPtr.Zero)CloseDesktop(desk);
    IntPtr window=GetForegroundWindow();uint pid=0;GetWindowThreadProcessId(window,out pid);
    var cls=new StringBuilder(256);GetClassName(window,cls,cls.Capacity);
    string path="",name="";
    if(pid!=0&&!locked&&cls.ToString()!="Progman"&&cls.ToString()!="WorkerW"&&cls.ToString()!="Shell_TrayWnd"&&cls.ToString()!="Shell_SecondaryTrayWnd") {
     if(pid==previousPid) {path=previousPath;name=previousName;}
     else {
      IntPtr handle=OpenProcess(0x1000,false,pid);
      if(handle!=IntPtr.Zero) {try {var buffer=new StringBuilder(32768);uint size=(uint)buffer.Capacity;if(QueryFullProcessImageName(handle,0,buffer,ref size))path=buffer.ToString();}finally{CloseHandle(handle);}}
      if(path.Length>0) {try{name=FileVersionInfo.GetVersionInfo(path).FileDescription;}catch{} if(String.IsNullOrWhiteSpace(name))name=System.IO.Path.GetFileNameWithoutExtension(path);}
      else {try{name=Process.GetProcessById((int)pid).ProcessName;path=name+".exe";}catch{}}
      previousPid=pid;previousPath=path;previousName=name;
     }
    }
    Console.WriteLine(serializer.Serialize(new {pid=pid,window=window.ToInt64(),exe=path.Length>0?System.IO.Path.GetFileName(path):"",path=path,name=name,idleMs=idle,locked=locked}));
    Console.Out.Flush();
   } catch(Exception) {try{Console.WriteLine("{\"exe\":\"\",\"locked\":true,\"idleMs\":2147483647}");}catch{return;}}
   if(args.Length>0&&args[0]=="--once")return;
   Thread.Sleep(1000);
  }
 }
}
