const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const SESSION_DIR = path.join(process.cwd(), ".pw-instagram-session");
const TMP_DIR = path.join(process.cwd(), "tmp");
const META_FILE = path.join(TMP_DIR, "instagram-session-meta.json");
const SCRIPT_PATH = path.join(process.cwd(), "src", "scripts", "setupInstagramSession.js");

let sessionSetupProcess = null;

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
      log: [],
    };
  }

  try {
    const raw = fs.readFileSync(META_FILE, "utf8");
    const parsed = JSON.parse(raw);

    return {
      inProgress: false,
      startedAt: null,
      completedAt: null,
      message: null,
      pid: null,
      lastExitCode: null,
      lastError: null,
      log: [],
      ...parsed,
    };
  } catch {
    return {
      inProgress: false,
      startedAt: null,
      completedAt: null,
      message: "Failed to read session meta file",
      pid: null,
      lastExitCode: null,
      lastError: "Failed to parse session meta file",
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
  const nextLog = [...(meta.log || []), `[${new Date().toISOString()}] ${line}`].slice(-100);

  writeMeta({
    ...meta,
    log: nextLog,
  });
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function getDirectorySizeBytes(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;

  let total = 0;
  let entries = [];

  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return 0;
    }
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    try {
      if (entry.isDirectory()) {
        total += getDirectorySizeBytes(fullPath);
      } else {
        const stats = safeStat(fullPath);
        if (stats) {
          total += stats.size;
        }
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  return total;
}

function getSessionFolderStats() {
  const stats = safeStat(SESSION_DIR);

  if (!stats) {
    return {
      exists: false,
      path: SESSION_DIR,
      lastModified: null,
      sizeBytes: 0,
    };
  }

  return {
    exists: true,
    path: SESSION_DIR,
    lastModified: stats.mtime.toISOString(),
    sizeBytes: getDirectorySizeBytes(SESSION_DIR),
  };
}
function getStatus() {
  const meta = readMeta();
  const folder = getSessionFolderStats();

  return {
    success: true,
    session: {
      exists: folder.exists,
      path: folder.path,
      lastModified: folder.lastModified,
      sizeBytes: folder.sizeBytes,
    },
    setup: {
      inProgress: meta.inProgress,
      startedAt: meta.startedAt,
      completedAt: meta.completedAt,
      message: meta.message,
      pid: meta.pid,
      lastExitCode: meta.lastExitCode,
      lastError: meta.lastError,
      log: meta.log || [],
    },
  };
}

function startSessionSetup() {
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

  const nextMeta = {
    ...meta,
    inProgress: true,
    startedAt: new Date().toISOString(),
    completedAt: null,
    message: "Instagram session setup started. A local Playwright browser should open for manual login.",
    pid: null,
    lastExitCode: null,
    lastError: null,
    log: [],
  };

  writeMeta(nextMeta);

  const child = spawn(process.execPath, [SCRIPT_PATH], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    windowsHide: false,
  });

  sessionSetupProcess = child;

  const startedMeta = {
    ...readMeta(),
    pid: child.pid,
  };
  writeMeta(startedMeta);

  appendLogLine(`Started setup script with PID ${child.pid}`);
  console.log("[instagram-session] spawned setup script", { pid: child.pid, script: SCRIPT_PATH });

  child.stdout.on("data", (data) => {
    const text = data.toString().trim();
    if (!text) return;

    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) {
        console.log("[instagram-session][stdout]", line);
        appendLogLine(`stdout: ${line}`);
      }
    }
  });

  child.stderr.on("data", (data) => {
    const text = data.toString().trim();
    if (!text) return;

    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) {
        console.error("[instagram-session][stderr]", line);
        appendLogLine(`stderr: ${line}`);
      }
    }
  });

  child.on("error", (error) => {
    console.error("[instagram-session] failed to start setup script", error);

    const failedMeta = {
      ...readMeta(),
      inProgress: false,
      pid: null,
      lastError: error.message,
      message: "Failed to start Instagram session setup.",
    };

    writeMeta(failedMeta);
    appendLogLine(`process error: ${error.message}`);
    sessionSetupProcess = null;
  });

  child.on("close", (code, signal) => {
    const sessionExists = fs.existsSync(SESSION_DIR);
    const finalMeta = {
      ...readMeta(),
      inProgress: false,
      pid: null,
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
    };

    writeMeta(finalMeta);
    appendLogLine(`process closed with code ${code} signal ${signal || "none"}`);
    console.log("[instagram-session] setup script closed", { code, signal, sessionExists });
    sessionSetupProcess = null;
  });

  return {
    success: true,
    message: "Instagram session setup started.",
    setup: {
      ...startedMeta,
      inProgress: true,
    },
  };
}

function completeSessionSetup() {
  const sessionExists = fs.existsSync(SESSION_DIR);

  if (!sessionExists) {
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

async function removeSessionDirWithRetry() {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (!fs.existsSync(SESSION_DIR)) {
        return { success: true };
      }

      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      appendLogLine(`delete attempt ${attempt} failed: ${error.message}`);

      if (attempt === maxAttempts) {
        return {
          success: false,
          error,
        };
      }

      await sleep(700);
    }
  }

  return { success: true };
}

async function resetSession() {
  if (sessionSetupProcess && !sessionSetupProcess.killed) {
    try {
      appendLogLine(`stopping running setup process PID ${sessionSetupProcess.pid}`);
      sessionSetupProcess.kill("SIGTERM");
    } catch (error) {
      appendLogLine(`failed to stop running process: ${error.message}`);
    }
  }

  await sleep(1500);

  const removeResult = await removeSessionDirWithRetry();

  if (!removeResult.success) {
    const message =
      "Could not delete .pw-instagram-session because it is still being used by another process. Close the Playwright/Chromium window and try again.";

    const nextMeta = {
      ...readMeta(),
      inProgress: false,
      message,
      lastError: removeResult.error.message,
    };

    writeMeta(nextMeta);

    return {
      success: false,
      message,
      setup: nextMeta,
    };
  }

  sessionSetupProcess = null;

  const nextMeta = {
    inProgress: false,
    startedAt: null,
    completedAt: null,
    message: "Instagram session reset.",
    pid: null,
    lastExitCode: null,
    lastError: null,
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