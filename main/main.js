const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#080808",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
    },
  });

  win.loadURL("http://127.0.0.1:5173");
}

app.whenReady().then(createWindow);
