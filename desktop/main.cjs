// Vitamin B для Windows: окно с вашим сайтом (админка, касса). Сам сайт обновляется на сервере,
// поэтому приложение переустанавливать после обновлений не нужно.
const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_URL = "https://detox-booth-production.up.railway.app";
const START_PATH = "/admin";

// Адрес сайта: аргумент --url=..., переменная VITAMINB_URL или config.json в папке данных приложения.
function readConfig() {
  const file = path.join(app.getPath("userData"), "config.json");
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; }
}
function siteUrl() {
  const arg = process.argv.find((a) => a.startsWith("--url="));
  const raw = (arg && arg.slice(6)) || process.env.VITAMINB_URL || readConfig().url || DEFAULT_URL;
  try { const u = new URL(raw); return u.origin; } catch { return DEFAULT_URL; }
}

const BASE = siteUrl();
const stateFile = () => path.join(app.getPath("userData"), "window.json");
function loadState() { try { return JSON.parse(fs.readFileSync(stateFile(), "utf8")); } catch { return {}; } }
function saveState(win) {
  if (win.isDestroyed()) return;
  const b = win.getNormalBounds();
  try { fs.writeFileSync(stateFile(), JSON.stringify({ ...b, max: win.isMaximized(), full: win.isFullScreen() })); } catch { /* не критично */ }
}

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

// Тихая печать чека: прячем отдельное окно с чеком, печатаем на принтер по умолчанию (или на «printer» из config.json) и закрываем.
// Разрешены только адреса чеков своего сайта: /print/order/<id> и /print/bill/<id>.
const PRINT_PATH = /^\/print\/(order|bill)\/[A-Za-z0-9%_-]+$/;
let printing = Promise.resolve();
function printReceipt(pathname) {
  return new Promise((resolve) => {
    if (!PRINT_PATH.test(pathname)) return resolve({ ok: false, error: "Недопустимый адрес чека" });
    const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    let done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); if (!w.isDestroyed()) w.close(); resolve(r); };
    const timer = setTimeout(() => finish({ ok: false, error: "Чек не успел напечататься, проверьте принтер" }), 30000);
    w.webContents.on("did-fail-load", () => finish({ ok: false, error: "Нет связи с сервером" }));
    w.webContents.on("did-finish-load", () => {
      // даём странице дорисоваться (шрифты, штрихкод), потом печатаем
      setTimeout(() => {
        const deviceName = readConfig().printer || undefined;
        w.webContents.print({ silent: true, printBackground: false, deviceName, margins: { marginType: "none" } }, (success, reason) => {
          finish(success ? { ok: true } : { ok: false, error: reason === "cancelled" ? "Печать отменена" : "Принтер не ответил" });
        });
      }, 700);
    });
    void w.loadURL(BASE + pathname);
  });
}
ipcMain.handle("print-url", (e, p) => {
  // только из нашего окна с нашего сайта
  try { if (new URL(e.senderFrame.url).origin !== BASE) return { ok: false, error: "Запрещено" }; } catch { return { ok: false, error: "Запрещено" }; }
  // принимаем только путь своего сайта вида /print/order/<id>; ссылки на другие сайты не пускаем
  if (typeof p !== "string" || !p.startsWith("/") || p.startsWith("//")) return { ok: false, error: "Недопустимый адрес чека" };
  let pathname = "";
  try { pathname = new URL(p, BASE).pathname; } catch { return { ok: false, error: "Недопустимый адрес чека" }; }
  // чеки печатаем по очереди, чтобы они не перемешались
  const job = printing.then(() => printReceipt(pathname));
  printing = job.then(() => undefined, () => undefined);
  return job;
});

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    width: st.width || 1366, height: st.height || 820, x: st.x, y: st.y, minWidth: 900, minHeight: 600,
    title: "Vitamin B", icon: path.join(__dirname, "icon.png"), backgroundColor: "#17110d", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, "preload.cjs"), spellcheck: false },
  });
  if (st.max) win.maximize();
  if (st.full) win.setFullScreen(true);

  // Ссылки на чужие сайты открываем в обычном браузере, свой сайт остаётся в окне.
  const inside = (url) => { try { return new URL(url).origin === BASE; } catch { return false; } };
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (inside(url)) return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: path.join(__dirname, "icon.png") } };
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (inside(url) || url.startsWith("file:")) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) void shell.openExternal(url);
  });

  // Нет связи или сервер недоступен: показываем понятную страницу с кнопкой «Повторить».
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    void win.loadFile(path.join(__dirname, "offline.html"), { query: { u: url || BASE + START_PATH } });
  });

  win.on("close", () => saveState(win));
  void win.loadURL(BASE + START_PATH);
}

function buildMenu() {
  const go = (p) => () => win && win.loadURL(BASE + p);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Окно",
      submenu: [
        { label: "Админка", accelerator: "CmdOrCtrl+1", click: go("/admin") },
        { label: "Касса и заказы", accelerator: "CmdOrCtrl+2", click: go("/admin/orders") },
        { label: "Сайт для клиентов", accelerator: "CmdOrCtrl+3", click: go("/") },
        { type: "separator" },
        { label: "Назад", accelerator: "Alt+Left", click: () => win && win.webContents.navigationHistory.canGoBack() && win.webContents.navigationHistory.goBack() },
        { label: "Обновить страницу", accelerator: "F5", click: () => win && win.webContents.reload() },
        { label: "Во весь экран", accelerator: "F11", click: () => win && win.setFullScreen(!win.isFullScreen()) },
        { label: "Печать", accelerator: "CmdOrCtrl+P", click: () => win && win.webContents.print() },
        { type: "separator" },
        { label: "О приложении", click: () => dialog.showMessageBox(win, { type: "info", title: "Vitamin B", message: "Vitamin B для Windows", detail: `Версия ${app.getVersion()}\nСайт: ${BASE}` }) },
        { label: "Выход", accelerator: "Alt+F4", role: "quit" },
      ],
    },
  ]));
}

app.whenReady().then(() => { buildMenu(); createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => app.quit());
