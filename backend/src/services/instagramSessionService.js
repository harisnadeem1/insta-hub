const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const SESSION_DIR = path.join(process.cwd(), ".pw-instagram-session");
const TMP_DIR = path.join(process.cwd(), "tmp");
const META_FILE = path.join(TMP_DIR, "instagram-session-meta.json");
const SCRIPT_PATH = path.join(process.cwd(), "src", "scripts", "setupInstagramSession.js");

const DISPLAY = process.env.INSTAGRAM_X_DISPLAY || ":99";
const VNC_PORT = Number(process.env.INSTAGRAM_VNC_PORT || 5901);
const NOVNC_PORT = Number(process.env.INSTAGRAM_NOVNC_PORT || 6080);
const VIEWER_PATH = process.env.INSTAGRAM_VIEWER_PATH || "/instagram-browser/vnc.html";

let sessionSetupProcess = null;
let xvfbProcess = null;
let x11vncProcess = null;
let websockifyProcess = null;

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readMeta() {
  ensureTmpDir();

  if (!fs.existsSync(META_FILE)) {
    return {
      inProgress: false,
      startedAt: null,
      completedAt: null,
      message: null,
      pid: null,
      lastExitCode: null,
      lastError: null,
      browserRunning: false,
      displayRunning: false,
      viewerUrl: null,
      log: [],
    };
  }

  try {
    return JSON.parse(fs.readFileSync(META_FILE, "utf8"));
  } catch {
    return {
      inProgress: false,
      startedAt: null,
      completedAt: null,
      message: "Failed to parse session meta file",
      pid: null,
      lastExitCode: null,
      lastError: "Failed to parse session meta file",
      browserRunning: false,
      displayRunning: false,
      viewerUrl: null,
      log: [],
    };
  }
}

function writeMeta(meta) {
  ensureTmpDir();
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), "utf8");
}

function appendLogLine(line) {
  const meta = readMeta();
  const nextLog = [...(meta.log || []), `[${new Date().toISOString()}] ${line}`].slice(-300);
  writeMeta({ ...meta, log: nextLog });
}

function getViewerUrl() {
  return `${VIEWER_PATH}?autoconnect=true&resize=scale&reconnect=true&path=instagram-browser/websockify`;
}

function isRunning(proc) {
  return !!proc && !proc.killed;
}

function getSessionInfo() {
  if (!fs.existsSync(SESSION_DIR)) {
    return {
      exists: false,
      path: SESSION_DIR,
      lastModified: null,
      sizeBytes: 0,
    };
  }

  const stat = fs.statSync(SESSION_DIR);

  return {
    exists: true,
    path: SESSION_DIR,
    lastModified: stat.mtime.toISOString(),
    sizeBytes: 0,
  };
}

function spawnManagedProcess(name, command, args, extraOptions = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    windowsHide: false,
    ...extraOptions,
  });

  child.stdout.on("data", (data) => {
    const text = data.toString().trim();
    if (!text) return;
    for (const line of text.split(/\r?\n/)) {
      console.log(`[instagram-session][${name}][stdout]`, line);
      appendLogLine(`${name} stdout: ${line}`);
    }
  });

  child.stderr.on("data", (data) => {
    const text = data.toString().trim();
    if (!text) return;
    for (const line of text.split(/\r?\n/)) {
      console.error(`[instagram-session][${name}][stderr]`, line);
      appendLogLine(`${name} stderr: ${line}`);
    }
  });

  child.on("close", (code, signal) => {
    appendLogLine(`${name} closed with code ${code} signal ${signal || "none"}`);
  });

  child.on("error", (error) => {
    appendLogLine(`${name} error: ${error.message}`);
  });

  return child;
}

async function ensureDisplayStack() {
  if (process.platform !== "linux") {
    return {
      displayRunning: false,
      viewerUrl: null,
    };
  }

  if (!isRunning(xvfbProcess)) {
    xvfbProcess = spawnManagedProcess("xvfb", "Xvfb", [
      DISPLAY,
      "-screen", "0", "1280x1024x24",
      "-ac",
    ]);
    await sleep(1500);
  }

  if (!isRunning(x11vncProcess)) {
    x11vncProcess = spawnManagedProcess(
      "x11vnc",
      "x11vnc",
      [
        "-display", DISPLAY,
        "-rfbport", String(VNC_PORT),
        "-forever",
        "-shared",
        "-nopw",
        "-noxdamage",
      ],
      {
        env: {
          ...process.env,
          DISPLAY,
        },
      }
    );
    await sleep(1500);
  }

  if (!isRunning(websockifyProcess)) {
    websockifyProcess = spawnManagedProcess("websockify", "websockify", [
      "--web=/usr/share/novnc/",
      String(NOVNC_PORT),
      `localhost:${VNC_PORT}`,
    ]);
    await sleep(1500);
  }

  return {
    displayRunning: true,
    viewerUrl: getViewerUrl(),
  };
}

function getStatus() {
  const meta = readMeta();
  return {
    success: true,
    session: getSessionInfo(),
    setup: {
      ...meta,
    },
  };
}
async function cleanupViewerStack() {
  for (const port of [5901, 6080]) {
    try {
      spawn("fuser", ["-k", `${port}/tcp`], { stdio: "ignore" });
    } catch {}
  }

  for (const proc of [websockifyProcess, x11vncProcess, xvfbProcess]) {
    if (proc && !proc.killed) {
      try {
        proc.kill("SIGTERM");
      } catch {}
    }
  }

  websockifyProcess = null;
  x11vncProcess = null;
  xvfbProcess = null;

  await sleep(1500);
}

async function startSessionSetup() {
  const meta = readMeta();

  if (sessionSetupProcess && !sessionSetupProcess.killed) {
    return {
      success: false,
      message: "Instagram session setup is already running.",
      setup: meta,
    };
  }

  if (!fs.existsSync(SCRIPT_PATH)) {
    return {
      success: false,
      message: `Session setup script not found at ${SCRIPT_PATH}`,
    };
  }
  await cleanupViewerStack();

  const stack = await ensureDisplayStack();

  const nextMeta = {
    ...meta,
    inProgress: true,
    startedAt: new Date().toISOString(),
    completedAt: null,
    message: "Instagram session setup started. Open the browser viewer to log in.",
    pid: null,
    lastExitCode: null,
    lastError: null,
    browserRunning: false,
    displayRunning: stack.displayRunning,
    viewerUrl: stack.viewerUrl,
    log: [],
  };

  writeMeta(nextMeta);

  const child = spawn(process.execPath, [SCRIPT_PATH], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      DISPLAY,
      INSTAGRAM_SESSION_DISPLAY: DISPLAY,
    },
    windowsHide: false,
  });

  sessionSetupProcess = child;

  writeMeta({
    ...readMeta(),
    pid: child.pid,
    browserRunning: true,
    displayRunning: true,
    viewerUrl: stack.viewerUrl,
  });

  appendLogLine(`Started setup script with PID ${child.pid}`);

  child.stdout.on("data", (data) => {
    const text = data.toString().trim();
    if (!text) return;
    for (const line of text.split(/\r?\n/)) {
      console.log("[instagram-session][stdout]", line);
      appendLogLine(`stdout: ${line}`);
    }
  });

  child.stderr.on("data", (data) => {
    const text = data.toString().trim();
    if (!text) return;
    for (const line of text.split(/\r?\n/)) {
      console.error("[instagram-session][stderr]", line);
      appendLogLine(`stderr: ${line}`);
    }
  });

  child.on("error", (error) => {
    writeMeta({
      ...readMeta(),
      inProgress: false,
      pid: null,
      browserRunning: false,
      lastError: error.message,
      message: "Failed to start Instagram session setup.",
    });
    appendLogLine(`process error: ${error.message}`);
    sessionSetupProcess = null;
  });

  child.on("close", (code, signal) => {
    const sessionExists = fs.existsSync(SESSION_DIR);

    writeMeta({
      ...readMeta(),
      inProgress: false,
      pid: null,
      browserRunning: false,
      completedAt: new Date().toISOString(),
      lastExitCode: code,
      lastError: signal ? `Process ended with signal ${signal}` : null,
      message:
        code === 0
          ? sessionExists
            ? "Instagram session setup finished and session folder was found."
            : "Instagram session setup finished, but no session folder was found."
          : signal
            ? `Instagram session setup was stopped with signal ${signal}.`
            : `Instagram session setup exited with code ${code}.`,
    });

    appendLogLine(`process closed with code ${code} signal ${signal || "none"}`);
    sessionSetupProcess = null;
  });

  return {
    success: true,
    message: "Instagram session setup started.",
    setup: {
      ...readMeta(),
      inProgress: true,
    },
  };
}

function completeSessionSetup() {
  if (!fs.existsSync(SESSION_DIR)) {
    return {
      success: false,
      message: "Session folder not found. Complete the Instagram login flow first.",
    };
  }

  const meta = readMeta();
  const nextMeta = {
    ...meta,
    inProgress: false,
    completedAt: new Date().toISOString(),
    message: "Instagram session marked as ready.",
  };

  writeMeta(nextMeta);
  appendLogLine("session marked complete");

  return {
    success: true,
    message: nextMeta.message,
    setup: nextMeta,
  };
}

async function resetSession() {
  if (sessionSetupProcess && !sessionSetupProcess.killed) {
    try {
      sessionSetupProcess.kill("SIGTERM");
      appendLogLine(`stopping running setup process PID ${sessionSetupProcess.pid}`);
    } catch (error) {
      appendLogLine(`failed to stop running process: ${error.message}`);
    }
  }

  await sleep(1500);

  try {
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
  } catch (error) {
    const meta = {
      ...readMeta(),
      inProgress: false,
      browserRunning: false,
      message: "Could not delete .pw-instagram-session.",
      lastError: error.message,
    };

    writeMeta(meta);

    return {
      success: false,
      message: meta.message,
      setup: meta,
    };
  }

  const nextMeta = {
    inProgress: false,
    startedAt: null,
    completedAt: null,
    message: "Instagram session reset.",
    pid: null,
    lastExitCode: null,
    lastError: null,
    browserRunning: false,
    displayRunning: process.platform === "linux",
    viewerUrl: process.platform === "linux" ? getViewerUrl() : null,
    log: [],
  };

  writeMeta(nextMeta);

  return {
    success: true,
    message: nextMeta.message,
    setup: nextMeta,
  };
}

module.exports = {
  getStatus,
  startSessionSetup,
  completeSessionSetup,
  resetSession,
};