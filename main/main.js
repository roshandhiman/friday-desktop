const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow = null;
let pythonProcess = null;

function startPythonBackend() {
  const backendDir = path.join(__dirname, "..", "backend");
  const serverPath = path.join(backendDir, "server.py");

  // Try python3 first, then python
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  pythonProcess = spawn(pythonCmd, [serverPath], {
    cwd: backendDir,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  pythonProcess.stdout.on("data", (data) => {
    console.log(`[Python] ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error(`[Python] ${data.toString().trim()}`);
  });

  pythonProcess.on("error", (err) => {
    console.error(`[Python] Failed to start backend: ${err.message}`);
  });

  pythonProcess.on("close", (code) => {
    console.log(`[Python] Backend exited with code ${code}`);
    pythonProcess = null;
  });

  console.log("[Python] Backend starting on http://127.0.0.1:8765");
}

function stopPythonBackend() {
  if (pythonProcess) {
    pythonProcess.kill("SIGTERM");
    pythonProcess = null;
    console.log("[Python] Backend stopped");
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#080808",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL("http://127.0.0.1:5173");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startPythonBackend();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopPythonBackend();
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  stopPythonBackend();
});
