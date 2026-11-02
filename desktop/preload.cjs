// Мост для кассы: страница просит приложение напечатать чек тихо, на принтер по умолчанию.
// Из Node сайту ничего не доступно, только эта одна функция.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vitaminbDesktop", {
  version: 1,
  printUrl: (path) => ipcRenderer.invoke("print-url", String(path)),
});
