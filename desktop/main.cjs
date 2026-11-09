const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  nativeTheme,
  powerMonitor,
  dialog,
  shell,
  Notification,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline");
const { pathToFileURL } = require("node:url");
const { Tracker } = require("./tracker.cjs");
const { Storage } = require("./storage.cjs");
const { SummaryCache } = require("./summary-cache.cjs");
const { focusSettings } = require("./focus-settings.cjs");
const { FocusTimer } = require("./focus.cjs");
const {
  localDate,
  addInterval,
  summary,
  categoryFor,
  validateState,
  CATEGORIES,
  setAllocation,
  saveType,
  removeType,
  validDomain,
  setSiteCategory,
} = require("./model.cjs");
const { IconCache } = require("./icons.cjs");
app.setName("Dayline");
nativeTheme.themeSource = "dark";
if (process.platform === "win32") app.setAppUserModelId("app.dayline.desktop");
app.setPath(
  "userData",
  process.env.DAYLINE_DATA_DIR || path.join(app.getPath("appData"), "Dayline"),
);
const testMode = process.argv.includes("--test-mode");
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win,
    tray,
    probe,
    storage,
    tracker,
    summaries,
    focus,
    quitting = false,
    locked = false,
    suspended = false,
    helperError = "",
    saveError = "",
    lastSample = null,
    lastReceived = 0,
    restartTimer;
  let icons,
    browserProbe,
    browserTimer,
    browserSample = { status: "waiting", domain: "" },
    browserReceived = 0;
  const index = path.resolve(__dirname, "../dist/index.html");
  const iconFile = app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.resolve(__dirname, "../assets/icon.png");
  const notify = () => {
    if (win && !win.isDestroyed()) win.webContents.send("dayline:changed");
  };
  function persist() {
    try {
      storage.save();
      saveError = "";
    } catch {
      saveError =
        "Не удалось сохранить данные. Проверь свободное место на диске.";
    }
  }
  function status() {
    if (testMode)
      return {
        kind: "paused",
        label: "Учёт на паузе",
        detail: "Изолированная проверка интерфейса.",
      };
    if (saveError)
      return { kind: "error", label: "Ошибка сохранения", detail: saveError };
    if (tracker.paused)
      return {
        kind: "paused",
        label: "Учёт на паузе",
        detail: "Продолжи, когда будешь готов.",
      };
    if (helperError || Date.now() - lastReceived > 6000)
      return {
        kind: "error",
        label: "Учёт недоступен",
        detail: helperError || "Нет ответа от Windows. Перезапусти приложение.",
      };
    if (locked || suspended || lastSample?.locked)
      return {
        kind: "idle",
        label: "ПК заблокирован",
        detail: "Это время не учитывается.",
      };
    if (
      storage.data.settings.idleMinutes > 0 &&
      lastSample?.idleMs >= storage.data.settings.idleMinutes * 60000
    )
      return {
        kind: "idle",
        label: "Перерыв",
        detail: "Время бездействия не учитывается.",
      };
    return {
      kind: "active",
      label: "Учёт идёт",
      detail: lastSample?.name || "Ожидаю активное окно",
    };
  }
  function snapshot(date = localDate(Date.now()), iconRevision = -1) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error("Invalid date");
    const d = new Date(date + "T12:00:00");
    const week = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(d);
      day.setDate(day.getDate() - 6 + i);
      return summaries.get(localDate(day));
    });
    const result = summaries.get(date);
    const weekTotals = {},
      weekSites = {};
    for (const day of week)
      for (const a of day.apps) {
        weekTotals[a.id] = (weekTotals[a.id] || 0) + a.ms;
        for (const site of a.sites) {
          weekSites[a.id] ??= {};
          weekSites[a.id][site.domain] =
            (weekSites[a.id][site.domain] || 0) + site.ms;
        }
      }
    const weekApps = Object.entries(weekTotals)
      .map(([id, ms]) => ({
        id,
        ms,
        ...storage.data.apps[id],
        sites: Object.entries(weekSites[id] || {})
          .map(([domain, ms]) => ({ domain, ms }))
          .sort((a, b) => b.ms - a.ms),
      }))
      .sort((a, b) => b.ms - a.ms);
    return {
      ...result,
      today: localDate(Date.now()),
      week: week.map(({ sessions, apps, entry, ...s }) => s),
      weekApps,
      catalog: storage.data.apps,
      types: storage.data.types,
      siteCategories: storage.data.siteCategories,
      iconRevision: icons.revision,
      ...(iconRevision !== icons.revision ? { icons: icons.values } : {}),
      browserStatus: storage.data.settings.trackSites
        ? browserSample.status
        : "disabled",
      entries: storage.data.entries,
      settings: storage.data.settings,
      status: status(),
      current: lastSample?.exe
        ? {
            id: lastSample.exe.toLowerCase(),
            name:
              storage.data.apps[lastSample.exe.toLowerCase()]?.name ||
              lastSample.name,
          }
        : null,
      firstStarted: storage.data.createdAt,
      storageWarning: storage.warning,
      packaged: app.isPackaged,
      version: app.getVersion(),
    };
  }
  function remember(sample) {
    if (!sample.exe) return;
    const id = sample.exe.toLowerCase();
    if (!storage.data.apps[id]) {
      storage.data.apps[id] = {
        exe: sample.exe,
        name: /^(electron|dayline)\.exe$/i.test(sample.exe)
          ? "Dayline"
          : sample.name || sample.exe.replace(/\.exe$/i, ""),
        category: categoryFor(sample.exe, sample.path),
        path: sample.path,
      };
      storage.dirty = true;
    }
    if (sample.path && sample.path !== storage.data.apps[id].path) {
      storage.data.apps[id].path = sample.path;
      storage.dirty = true;
    }
    icons.load(id, storage.data.apps[id]);
  }
  function startBrowserProbe() {
    if (quitting || testMode || !storage.data.settings.trackSites) return;
    const executable = app.isPackaged
      ? path.join(process.resourcesPath, "BrowserProbe.exe")
      : path.resolve(__dirname, "../native/BrowserProbe.exe");
    browserReceived = Date.now();
    browserSample = { status: "waiting", domain: "" };
    browserProbe = spawn(executable, [], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const lines = createInterface({ input: browserProbe.stdout });
    lines.on("line", (line) => {
      try {
        const sample = JSON.parse(line.replace(/^\uFEFF/, ""));
        browserReceived = Date.now();
        browserSample = {
          status: sample.status,
          domain: validDomain(sample.domain) ? sample.domain : "",
          window: sample.window,
        };
      } catch {}
    });
    browserProbe.on("error", () => {
      browserSample = { status: "unavailable", domain: "" };
    });
    browserProbe.on("exit", () => {
      browserProbe = null;
      if (!quitting && storage.data.settings.trackSites)
        browserTimer = setTimeout(startBrowserProbe, 5000);
    });
  }
  function startProbe() {
    if (quitting || testMode) return;
    helperError = "";
    tracker.reset();
    const executable = app.isPackaged
      ? path.join(process.resourcesPath, "ForegroundProbe.exe")
      : path.resolve(__dirname, "../native/ForegroundProbe.exe");
    probe = spawn(executable, [], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const lines = createInterface({ input: probe.stdout });
    lines.on("line", (line) => {
      try {
        const s = JSON.parse(line.replace(/^\uFEFF/, ""));
        if (typeof s.exe !== "string" || !Number.isFinite(s.idleMs)) return;
        lastReceived = Date.now();
        lastSample = s;
        remember(s);
        const domain =
          storage.data.settings.trackSites &&
          s.exe.toLowerCase() === "firefox.exe" &&
          Date.now() - browserReceived < 2200 &&
          browserSample.window === s.window
            ? browserSample.domain
            : "";
        tracker.sample(
          { ...s, domain, locked: s.locked || locked || suspended },
          Date.now(),
          performance.now(),
        );
      } catch {
        tracker.reset();
        helperError = "Не удалось прочитать активное окно Windows.";
      }
    });
    probe.on("error", () => {
      helperError = "Не удалось запустить учёт Windows. Перезапусти Dayline.";
      tracker.reset();
      notify();
    });
    probe.on("exit", () => {
      if (!quitting) {
        helperError = "Перезапускаю учёт Windows…";
        tracker.reset();
        restartTimer = setTimeout(startProbe, 5000);
        notify();
      }
    });
  }
  function show() {
    if (win) {
      win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  }
  function updateTray() {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Открыть Dayline", click: show },
        {
          label: tracker.paused ? "Продолжить учёт" : "Приостановить учёт",
          click: () => {
            tracker.paused = !tracker.paused;
            tracker.reset();
            updateTray();
            notify();
          },
        },
        { type: "separator" },
        { label: "Выход из Dayline", click: () => app.quit() },
      ]),
    );
    tray.setToolTip(
      tracker.paused ? "Dayline · учёт на паузе" : "Dayline · экранное время",
    );
  }
  function allowed(event) {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url !== pathToFileURL(index).href
    )
      throw Error("Forbidden IPC");
  }
  function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
      allowed(event);
      const result = await fn(...args);
      if (
        summaries &&
        ![
          "dayline:snapshot",
          "dayline:window-visible",
          "dayline:focus-snapshot",
          "dayline:focus-action",
          "dayline:theme",
        ].includes(channel)
      ) {
        if (summaries.state !== storage.data) summaries.reset(storage.data);
        else summaries.invalidate();
      }
      return result;
    });
  }
  app
    .whenReady()
    .then(() => {
      try {
        storage = new Storage(app.getPath("userData"));
      } catch (error) {
        dialog.showErrorBox("Dayline: данные не загружены", error.message);
        app.quit();
        return;
      }
      icons = new IconCache({
        app,
        nativeImage,
        directory: app.getPath("userData"),
        onChange: notify,
      });
      summaries = new SummaryCache(storage.data);
      focus = new FocusTimer({
        settings: storage.data.settings,
        onComplete: ({ phase }) => {
          if (!testMode && Notification.isSupported())
            try {
              new Notification({
                title: phase === "work" ? "Фокус завершён" : "Перерыв завершён",
                body:
                  phase === "work"
                    ? "Хорошая работа. Можно сделать перерыв."
                    : "Можно начать следующий рабочий отрезок.",
                icon: iconFile,
              }).show();
            } catch {}
          notify();
        },
      });
      for (const [id, metadata] of Object.entries(storage.data.apps))
        icons.load(id, metadata);
      tracker = new Tracker({
        idleMinutes: storage.data.settings.idleMinutes,
        onInterval: (interval) => {
          addInterval(storage.data, interval);
          storage.dirty = true;
        },
      });
      const workArea =
        require("electron").screen.getPrimaryDisplay().workAreaSize;
      win = new BrowserWindow({
        width: Math.min(1380, workArea.width - 60),
        height: Math.min(920, workArea.height - 55),
        minWidth: 880,
        minHeight: 680,
        show: false,
        backgroundColor: "#070707",
        title: "Dayline",
        titleBarStyle: "hidden",
        titleBarOverlay: {
          color: "#070707",
          symbolColor: "#999999",
          height: 40,
        },
        icon: iconFile,
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", (event, url) => {
        if (url !== pathToFileURL(index).href) event.preventDefault();
      });
      win.webContents.session.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      win.on("close", (event) => {
        if (!quitting) {
          event.preventDefault();
          win.hide();
        }
      });
      win.on("ready-to-show", () => {
        if (!process.argv.includes("--hidden")) show();
      });
      const windowVisible = () => win.isVisible() && !win.isMinimized();
      const sendVisibility = () => {
        if (!win.isDestroyed()) {
          const visible = windowVisible();
          win.webContents.setBackgroundThrottling(!visible);
          win.webContents.send("dayline:window-visibility", visible);
        }
      };
      for (const event of ["show", "hide", "minimize", "restore"])
        win.on(event, sendVisibility);
      win.webContents.on("did-finish-load", sendVisibility);
      tray = new Tray(
        nativeImage.createFromPath(iconFile).resize({ width: 20, height: 20 }),
      );
      tray.on("double-click", show);
      tray.on("click", show);
      updateTray();
      handle("dayline:snapshot", snapshot);
      handle("dayline:window-visible", windowVisible);
      handle("dayline:focus-snapshot", () => focus.snapshot());
      handle("dayline:focus-action", (action, options) => {
        const allowed = [
          "start",
          "pause",
          "resume",
          "stop",
          "startBreak",
          "skipBreak",
          "configure",
        ];
        if (!allowed.includes(action))
          throw Error("Неизвестное действие таймера.");
        if (action === "configure") {
          const merged = focusSettings({
            ...storage.data.settings,
            focusWorkMinutes: options?.workMinutes,
            focusBreakMinutes: options?.breakMinutes,
          });
          focus.configure({
            workMinutes: merged.focusWorkMinutes,
            breakMinutes: merged.focusBreakMinutes,
          });
          storage.data.settings = merged;
          storage.dirty = true;
          persist();
        } else focus[action]();
        notify();
        return focus.snapshot();
      });
      handle("dayline:theme", (id) => {
        const palette = {
          dark: ["#070707", "#969696"],
          light: ["#f5f5f7", "#666670"],
          "soft-dark": ["#070707", "#969696"],
          "soft-light": ["#f5f5f7", "#666670"],
        };
        if (!Object.hasOwn(palette, id)) throw Error("Invalid theme");
        nativeTheme.themeSource = id.includes("light") ? "light" : "dark";
        win.setBackgroundColor(palette[id][0]);
        win.setTitleBarOverlay({
          color: palette[id][0],
          symbolColor: palette[id][1],
          height: 40,
        });
        return true;
      });
      handle("dayline:pause", (value) => {
        if (typeof value !== "boolean") throw Error("Invalid pause");
        tracker.paused = value;
        tracker.reset();
        updateTray();
        notify();
        return true;
      });
      handle("dayline:category", (id, category) => {
        setAllocation(storage.data, id, { [category]: 100 });
        storage.dirty = true;
        persist();
        notify();
        return true;
      });
      handle("dayline:allocation", (id, values) => {
        setAllocation(storage.data, id, values);
        storage.dirty = true;
        persist();
        notify();
        return true;
      });
      handle("dayline:type", (definition) => {
        saveType(storage.data, definition);
        storage.dirty = true;
        persist();
        notify();
        return true;
      });
      handle("dayline:site-category", (domain, type) => {
        setSiteCategory(storage.data, domain, type);
        storage.dirty = true;
        persist();
        notify();
        return true;
      });
      handle("dayline:remove-type", (id) => {
        removeType(storage.data, id);
        storage.dirty = true;
        persist();
        notify();
        return true;
      });
      handle("dayline:hide-app", (id, hidden) => {
        if (
          !Object.hasOwn(storage.data.apps, id) ||
          typeof hidden !== "boolean"
        )
          throw Error("Invalid app");
        storage.data.apps[id].hidden = hidden;
        storage.dirty = true;
        persist();
        notify();
        return true;
      });
      handle("dayline:icon", async (id, reset = false) => {
        if (!Object.hasOwn(storage.data.apps, id) || typeof reset !== "boolean")
          throw Error("Invalid app");
        if (reset) await icons.reset(id, storage.data.apps[id]);
        else {
          const result = await dialog.showOpenDialog(win, {
            title: "Иконка программы",
            properties: ["openFile"],
            filters: [
              {
                name: "Иконки и программы",
                extensions: ["png", "jpg", "jpeg", "ico", "webp", "exe"],
              },
            ],
          });
          if (result.canceled) return false;
          await icons.choose(id, result.filePaths[0]);
          storage.data.apps[id].customIcon = true;
        }
        storage.dirty = true;
        persist();
        notify();
        return true;
      });
      handle("dayline:entry", (date, entry) => {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !entry ||
          !(
            entry.mood === null ||
            (Number.isInteger(entry.mood) && entry.mood >= 1 && entry.mood <= 5)
          ) ||
          typeof entry.note !== "string" ||
          entry.note.length > 20000 ||
          typeof entry.done !== "string" ||
          entry.done.length > 20000
        )
          throw Error("Invalid entry");
        storage.data.entries[date] = {
          mood: entry.mood,
          note: entry.note,
          done: entry.done,
          updatedAt: Date.now(),
        };
        storage.dirty = true;
        persist();
        if (saveError) throw Error(saveError);
        notify();
        return true;
      });
      handle("dayline:settings", (settings) => {
        const merged = focusSettings({ ...storage.data.settings, ...settings });
        if (
          ![0, 1, 3, 5, 10, 15, 30].includes(merged.idleMinutes) ||
          typeof merged.launchAtLogin !== "boolean" ||
          typeof merged.hideShort !== "boolean" ||
          typeof merged.trackSites !== "boolean"
        )
          throw Error("Invalid settings");
        if (app.isPackaged)
          app.setLoginItemSettings({
            openAtLogin: merged.launchAtLogin,
            path: process.execPath,
            args: ["--hidden"],
          });
        const sitesChanged =
          merged.trackSites !== storage.data.settings.trackSites;
        storage.data.settings = {
          ...merged,
          launchAtLogin: app.isPackaged ? merged.launchAtLogin : false,
        };
        focus.configure({
          workMinutes: storage.data.settings.focusWorkMinutes,
          breakMinutes: storage.data.settings.focusBreakMinutes,
        });
        if (sitesChanged) {
          clearTimeout(browserTimer);
          if (browserProbe) browserProbe.kill();
          else if (merged.trackSites) startBrowserProbe();
          browserSample = { status: "waiting", domain: "" };
        }
        tracker.idleMinutes = merged.idleMinutes;
        tracker.reset();
        storage.dirty = true;
        persist();
        notify();
        return true;
      });
      handle("dayline:folder", () => shell.openPath(app.getPath("userData")));
      handle("dayline:export", async () => {
        const result = await dialog.showSaveDialog(win, {
          defaultPath: `Dayline-${localDate(Date.now())}.json`,
          filters: [{ name: "Резервная копия Dayline", extensions: ["json"] }],
        });
        if (result.canceled) return false;
        persist();
        fs.writeFileSync(
          result.filePath,
          JSON.stringify(
            { ...storage.data, iconBundle: icons.export(storage.data.apps) },
            null,
            2,
          ),
          "utf8",
        );
        return true;
      });
      handle("dayline:import", async () => {
        const result = await dialog.showOpenDialog(win, {
          properties: ["openFile"],
          filters: [{ name: "Резервная копия Dayline", extensions: ["json"] }],
        });
        if (result.canceled) return false;
        const file = result.filePaths[0];
        if (fs.statSync(file).size > 200000000)
          throw Error("Слишком большой файл.");
        const incoming = validateState(
          JSON.parse(fs.readFileSync(file, "utf8")),
        );
        const incomingIcons = icons.validateIncoming(
          incoming.iconBundle,
          incoming.apps,
        );
        delete incoming.iconBundle;
        const confirmation = await dialog.showMessageBox(win, {
          type: "question",
          buttons: ["Отмена", "Восстановить"],
          defaultId: 0,
          cancelId: 0,
          message: "Заменить текущие данные резервной копией?",
          detail: "Текущий файл останется в dayline.json.bak.",
        });
        if (confirmation.response !== 1) return false;
        tracker.reset();
        incoming.settings.launchAtLogin = storage.data.settings.launchAtLogin;
        storage.data = incoming;
        focus.configure({
          workMinutes: incoming.settings.focusWorkMinutes,
          breakMinutes: incoming.settings.focusBreakMinutes,
        });
        icons.restore(incomingIcons, incoming.apps);
        clearTimeout(browserTimer);
        if (browserProbe) browserProbe.kill();
        else startBrowserProbe();
        tracker.idleMinutes = incoming.settings.idleMinutes;
        storage.dirty = true;
        persist();
        notify();
        return true;
      });
      win.loadFile(index);
      setInterval(() => focus.tick(), 1000).unref();
      startProbe();
      startBrowserProbe();
      setInterval(() => {
        if (!quitting) {
          persist();
          notify();
        }
      }, 5000).unref();
      setInterval(() => {
        if (Date.now() - lastReceived > 6000) tracker.reset();
        if (browserProbe && Date.now() - browserReceived > 8000) {
          browserSample = { status: "unavailable", domain: "" };
          browserProbe.kill();
        }
        notify();
      }, 2000).unref();
      powerMonitor.on("lock-screen", () => {
        focus.pause();
        locked = true;
        tracker.reset();
        persist();
        notify();
      });
      powerMonitor.on("unlock-screen", () => {
        locked = false;
        tracker.reset();
        notify();
      });
      powerMonitor.on("suspend", () => {
        focus.pause();
        suspended = true;
        tracker.reset();
        persist();
      });
      powerMonitor.on("resume", () => {
        suspended = false;
        tracker.reset();
        notify();
      });
      powerMonitor.on("shutdown", () => {
        persist();
      });
    })
    .catch((error) => {
      dialog.showErrorBox("Dayline", String(error.message));
      app.quit();
    });
  app.on("second-instance", show);
  app.on("activate", show);
  app.on("window-all-closed", () => {});
  app.on("before-quit", () => {
    quitting = true;
    clearTimeout(restartTimer);
    clearTimeout(browserTimer);
    if (storage) persist();
    if (probe) probe.kill();
    if (browserProbe) browserProbe.kill();
    if (tray) tray.destroy();
  });
}
