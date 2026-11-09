using System;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Windows.Automation;
using System.Web.Script.Serialization;
using Accessibility;
using System.Collections.Generic;

// Separate process: an unresponsive accessibility provider cannot stall time tracking.
public class BrowserProbe {
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder s,int count);
 [DllImport("oleacc.dll")] static extern int AccessibleObjectFromWindow(IntPtr h,uint objectId,ref Guid id,[In,Out,MarshalAs(UnmanagedType.IUnknown)] ref object result);
 [DllImport("oleacc.dll")] static extern int AccessibleChildren(IAccessible container,int start,int count,[Out,MarshalAs(UnmanagedType.LPArray,SizeParamIndex=2)] object[] children,out int obtained);
 static string Host(string address){Uri uri;if(!String.IsNullOrEmpty(address)&&address.IndexOf(' ')<0&&Uri.TryCreate(address.Contains("://")?address:"https://"+address,UriKind.Absolute,out uri)&&(uri.Scheme=="http"||uri.Scheme=="https")&&uri.Host.Contains("."))return uri.IdnHost.ToLowerInvariant();return "";}
 static string MsaaAddress(IntPtr h){
  Guid iid=typeof(IAccessible).GUID;object root=null;if(AccessibleObjectFromWindow(h,0xFFFFFFFC,ref iid,ref root)!=0)return "";
  var queue=new Queue<IAccessible>();if(root is IAccessible)queue.Enqueue((IAccessible)root);int visited=0;
  while(queue.Count>0&&visited++<600){var item=queue.Dequeue();try{
   int role=Convert.ToInt32(item.get_accRole(0));if(role==40)continue; // Never traverse page documents.
   if(role==42||role==46){int state=Convert.ToInt32(item.get_accState(0));if((state&4)==0&&(state&0x8000)==0){string found=Host(item.get_accValue(0));if(found.Length>0)return found;}}
   int count=Math.Min(item.accChildCount,150);if(count<=0)continue;var children=new object[count];int obtained;
   if(AccessibleChildren(item,0,count,children,out obtained)>=0)for(int i=0;i<obtained;i++){var child=children[i] as IAccessible;if(child!=null)queue.Enqueue(child);else if(children[i] is int){int id=(int)children[i];int cr=Convert.ToInt32(item.get_accRole(id));if((cr==42||cr==46)&&(Convert.ToInt32(item.get_accState(id))&4)==0){string found=Host(item.get_accValue(id));if(found.Length>0)return found;}}}
  }catch{}}
  return "";
 }
 [MTAThread] public static void Main(string[] args) {
  Console.OutputEncoding=new UTF8Encoding(false);var json=new JavaScriptSerializer();
  while(true){string domain="",status="inactive";long window=0;
   try{
    IntPtr h=GetForegroundWindow();if(args.Length>0&&args[0]=="--inspect")foreach(var p in Process.GetProcessesByName("firefox"))if(p.MainWindowHandle!=IntPtr.Zero){h=p.MainWindowHandle;break;}window=h.ToInt64();uint pid;GetWindowThreadProcessId(h,out pid);
    if(Process.GetProcessById((int)pid).ProcessName.Equals("firefox",StringComparison.OrdinalIgnoreCase)){
     status="unavailable";
     var title=new StringBuilder(2048);GetWindowText(h,title,title.Capacity);
     string caption=title.ToString().ToLowerInvariant();
     if(caption.Contains("private browsing")||caption.Contains("приватн"))status="private";
     else {
      domain=MsaaAddress(h);if(domain.Length>0)status="available";
      if(domain.Length==0){var root=AutomationElement.FromHandle(h);
      var condition=new OrCondition(new PropertyCondition(AutomationElement.AutomationIdProperty,"urlbar-input"),new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Edit));
      var edits=root.FindAll(TreeScope.Descendants,condition);
      for(int i=0;i<edits.Count&&i<40;i++){
       var e=edits[i];var current=e.Current;
       string label=current.Name.ToLowerInvariant(),id=current.AutomationId;
       // Never inspect form fields in page content, nor text being entered into the address bar.
       if(id!="urlbar-input"&&!label.Contains("search with")&&!label.Contains("enter address")&&!label.Contains("введите адрес")&&!label.Contains("поиск в google")&&!label.Contains("поиск в яндекс"))continue;
       if(current.HasKeyboardFocus||current.IsOffscreen)continue;
       object pattern;
       if(e.TryGetCurrentPattern(ValuePattern.Pattern,out pattern)){
        string address=((ValuePattern)pattern).Current.Value;Uri uri;
        if(address.IndexOf(' ')<0&&Uri.TryCreate(address.Contains("://")?address:"https://"+address,UriKind.Absolute,out uri)&&(uri.Scheme=="http"||uri.Scheme=="https")&&uri.Host.Contains(".")){
         domain=uri.IdnHost.ToLowerInvariant();status="available";break;
        }
       }
      }}
     }
    }
   }catch{}
   if(args.Length>0&&args[0]=="--inspect"){Console.WriteLine(json.Serialize(new {status=status,hasDomain=domain.Length>0}));return;}
   Console.WriteLine(json.Serialize(new {domain=domain,status=status,window=window}));Console.Out.Flush();
   if(args.Length>0&&args[0]=="--once")return;
   Thread.Sleep(1000);
  }
 }
}
