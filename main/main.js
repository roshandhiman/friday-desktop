const { app, BrowserWindow, systemPreferences, session } = require("electron");
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
    // Filter out INFO lines from uvicorn that go to stderr
    const text = data.toString().trim();
    if (text.includes("INFO:")) {
      console.log(text);
    } else {
      console.error(`[Python] ${text}`);
    }
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

async function requestMicrophonePermission() {
  // On macOS, explicitly ask the OS for microphone permission
  if (process.platform === "darwin") {
    const status = systemPreferences.getMediaAccessStatus("microphone");
    console.log(`[Permissions] Microphone status: ${status}`);

    if (status !== "granted") {
      const granted = await systemPreferences.askForMediaAccess("microphone");
      console.log(`[Permissions] Microphone access granted: ${granted}`);
      return granted;
    }
    return true;
  }
  return true;
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

  // ── Permission handler: auto-grant microphone to our app ──
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const allowedPermissions = ["media", "mediaKeySystem", "microphone"];
      if (allowedPermissions.includes(permission)) {
        console.log(`[Permissions] Granting '${permission}' to renderer`);
        callback(true);
      } else {
        console.log(`[Permissions] Denying '${permission}' to renderer`);
        callback(false);
      }
    }
  );

  // Also handle permission check requests (Electron 20+)
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) => {
      const allowedPermissions = ["media", "mediaKeySystem", "microphone"];
      if (allowedPermissions.includes(permission)) {
        return true;
      }
      return false;
    }
  );

  mainWindow.loadURL("http://127.0.0.1:5173");

  // ── Crash recovery ──
  mainWindow.webContents.on("crashed", (event, killed) => {
    console.error(`[Electron] Renderer crashed (killed: ${killed}). Reloading...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
      }
    }, 1500);
  });

  mainWindow.webContents.on("render-process-gone", (event, details) => {
    console.error(`[Electron] Render process gone: ${details.reason}`);
    if (details.reason !== "clean-exit") {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      }, 1500);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Request mic permission BEFORE creating the window
  await requestMicrophonePermission();

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
