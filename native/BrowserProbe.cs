using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using Accessibility;

// Keep accessibility calls off the time tracker so a stuck browser cannot stall it.
public class BrowserProbe {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr window, StringBuilder text, int size);
    [DllImport("oleacc.dll")] static extern int AccessibleObjectFromWindow(IntPtr window, uint objectId, ref Guid id, [In, Out, MarshalAs(UnmanagedType.IUnknown)] ref object result);
    [DllImport("oleacc.dll")] static extern int AccessibleChildren(IAccessible parent, int start, int count, [Out, MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 2)] object[] children, out int obtained);

    const int DocumentRole = 0x0f;
    const int TextRole = 0x2a;
    const int ComboBoxRole = 0x2e;
    const int UnreadableState = 0x00010000 | 0x00008000 | 0x00000004; // Offscreen, invisible or focused.

    static string Host(string address) {
        if (String.IsNullOrEmpty(address) || address.IndexOf(' ') >= 0) return "";
        Uri uri;
        if (!Uri.TryCreate(address.Contains("://") ? address : "https://" + address, UriKind.Absolute, out uri)) return "";
        return (uri.Scheme == "http" || uri.Scheme == "https") &&
               uri.HostNameType == UriHostNameType.Dns && uri.Host.Contains(".") && uri.UserInfo.Length == 0
            ? uri.IdnHost.ToLowerInvariant()
            : "";
    }

    static Condition ControlId(string id, ControlType type) {
        return new AndCondition(
            new PropertyCondition(AutomationElement.AutomationIdProperty, id),
            new PropertyCondition(AutomationElement.ControlTypeProperty, type));
    }

    static bool InBrowserInterface(AutomationElement root, AutomationElement element) {
        var walker = TreeWalker.RawViewWalker;
        for (int depth = 0; element != null && depth < 32; depth++) {
            if (Automation.Compare(root, element)) return true;
            if (element.Current.ControlType == ControlType.Document) return false;
            element = walker.GetParent(element);
        }
        return false;
    }

    static string ReadHost(AutomationElement address) {
        if (address == null || address.Current.HasKeyboardFocus || address.Current.IsOffscreen) return "";
        object pattern;
        return address.TryGetCurrentPattern(ValuePattern.Pattern, out pattern)
            ? Host(((ValuePattern)pattern).Current.Value)
            : "";
    }

    static string ChromeHost(AutomationElement root, out bool privateWindow) {
        privateWindow = false;
        // Chromium's native toolbar IDs. Web content is outside this toolbar.
        var toolbar = root.FindFirst(TreeScope.Descendants, ControlId("view_1000", ControlType.ToolBar));
        if (!InBrowserInterface(root, toolbar) || toolbar.Current.IsOffscreen) return "";
        var profile = toolbar.FindFirst(TreeScope.Descendants, ControlId("view_1018", ControlType.Button));
        var address = toolbar.FindFirst(TreeScope.Descendants, ControlId("view_1012", ControlType.Edit));
        if (profile == null || profile.Current.IsOffscreen || address == null) return "";

        // Profile indicators are localized. Limit this scan to supported toolbar languages.
        string label = address.Current.Name.ToLowerInvariant();
        if (label != "address and search bar" && label != "адресная строка и строка поиска") return "";
        string name = profile.Current.Name.ToLowerInvariant();
        if (String.IsNullOrWhiteSpace(name)) return "";
        privateWindow = name.Contains("incognito") || name.Contains("инкогнито") ||
                        name.Contains("guest") || name.Contains("гост");
        return privateWindow ? "" : ReadHost(address);
    }

    static bool FirefoxAddressLabel(string name) {
        string label = (name ?? "").ToLowerInvariant();
        return label.Contains("search with") || label.Contains("enter address") ||
               label.Contains("введите адрес") || label.Contains("поиск в google") ||
               label.Contains("поиск в яндекс");
    }

    static string FirefoxMsaaHost(IntPtr window) {
        var iid = typeof(IAccessible).GUID;
        object root = null;
        if (AccessibleObjectFromWindow(window, 0xfffffffc, ref iid, ref root) != 0 || !(root is IAccessible)) return "";
        var queue = new Queue<IAccessible>();
        queue.Enqueue((IAccessible)root);
        int visited = 0;
        while (queue.Count > 0 && visited++ < 600) {
            var item = queue.Dequeue();
            try {
                int role = Convert.ToInt32(item.get_accRole(0));
                if (role == DocumentRole) continue;
                string host = FirefoxMsaaValue(item, 0, role);
                if (host.Length != 0) return host;

                int count = Math.Min(item.accChildCount, 150);
                if (count == 0) continue;
                var children = new object[count];
                int obtained;
                if (AccessibleChildren(item, 0, count, children, out obtained) < 0) continue;
                for (int i = 0; i < obtained; i++) {
                    var child = children[i] as IAccessible;
                    if (child != null) queue.Enqueue(child);
                    else if (children[i] is int) {
                        int id = (int)children[i];
                        host = FirefoxMsaaValue(item, id, Convert.ToInt32(item.get_accRole(id)));
                        if (host.Length != 0) return host;
                    }
                }
            } catch (COMException) {
                // Accessibility elements can disappear while the browser navigates.
            }
        }
        return "";
    }

    static string FirefoxMsaaValue(IAccessible item, int id, int role) {
        if (role != TextRole && role != ComboBoxRole) return "";
        if ((Convert.ToInt32(item.get_accState(id)) & UnreadableState) != 0) return "";
        return Host(item.get_accValue(id));
    }

    static string FirefoxHost(IntPtr window, out bool privateWindow) {
        var title = new StringBuilder(2048);
        GetWindowText(window, title, title.Capacity);
        string caption = title.ToString().ToLowerInvariant();
        privateWindow = caption.Contains("private browsing") || caption.Contains("приватн");
        if (privateWindow) return "";

        string host = FirefoxMsaaHost(window);
        if (host.Length != 0) return host;
        var root = AutomationElement.FromHandle(window);
        var address = root.FindFirst(TreeScope.Descendants, ControlId("urlbar-input", ControlType.Edit));
        if (InBrowserInterface(root, address)) return ReadHost(address);
        var edits = root.FindAll(TreeScope.Descendants,
            new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit));
        for (int i = 0; i < edits.Count && i < 40; i++) {
            var edit = edits[i];
            if (!FirefoxAddressLabel(edit.Current.Name) || !InBrowserInterface(root, edit)) continue;
            host = ReadHost(edit);
            if (host.Length != 0) return host;
        }
        return "";
    }

    [MTAThread]
    public static void Main(string[] args) {
        Console.OutputEncoding = new UTF8Encoding(false);
        var json = new JavaScriptSerializer();
        bool inspect = args.Length > 0 && args[0] == "--inspect";
        while (true) {
            string domain = "", status = "inactive", exe = "";
            IntPtr window = GetForegroundWindow();
            try {
                if (inspect) {
                    string name = args.Length > 1 && args[1] == "chrome" ? "chrome" : "firefox";
                    foreach (var candidate in Process.GetProcessesByName(name)) {
                        using (candidate) {
                            if (candidate.MainWindowHandle == IntPtr.Zero) continue;
                            window = candidate.MainWindowHandle;
                            break;
                        }
                    }
                }
                uint pid;
                GetWindowThreadProcessId(window, out pid);
                using (var process = Process.GetProcessById((int)pid))
                    exe = process.ProcessName.ToLowerInvariant() + ".exe";
                if (exe == "chrome.exe" || exe == "firefox.exe") {
                    status = "unavailable";
                    bool privateWindow;
                    domain = exe == "chrome.exe"
                        ? ChromeHost(AutomationElement.FromHandle(window), out privateWindow)
                        : FirefoxHost(window, out privateWindow);
                    if (!inspect && window != GetForegroundWindow()) domain = "";
                    status = privateWindow ? "private" : domain.Length > 0 ? "available" : "unavailable";
                }
            } catch {
                // A browser can close or rebuild its accessibility tree between samples.
                domain = "";
            }
            if (inspect) {
                Console.WriteLine(json.Serialize(new { status = status, hasDomain = domain.Length > 0 }));
                return;
            }
            Console.WriteLine(json.Serialize(new { domain = domain, status = status, window = window.ToInt64(), exe = exe }));
            Console.Out.Flush();
            if (args.Length > 0 && args[0] == "--once") return;
            Thread.Sleep(1000);
        }
    }
}
