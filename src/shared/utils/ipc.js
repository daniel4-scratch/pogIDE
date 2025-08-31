// ipc.js - Registers and implements all Electron IPC handlers for running/building code and interactive sessions.
const {
    ipcMain,
    os,
    fs,
    path,
    spawn,
    dialog
} = require('./constants');
const { checkExePath } = require("./installer.js");
const { isWin, isMacARM, isCodeRunning, setCodeRunning, runSessions } = require('./window');
const { updateUIState, getUIState } = require('./config');

function setupIpcHandlers() {
    ipcMain.handle("build-code", handleBuildCode);
    ipcMain.handle("run-code", handleRunCode);
    ipcMain.handle('start-run', handleStartRun);
    ipcMain.on('run-input', handleRunInput);
    ipcMain.handle('stop-run', handleStopRun);
    ipcMain.handle("is-code-running", () => isCodeRunning);
    ipcMain.handle('save-ui-state', handleSaveUIState);
    ipcMain.handle('get-ui-state', handleGetUIState);
}

async function handleBuildCode(event, code) {
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, `main.pog`);

    const { canceled, filePath: outputPath } = await dialog.showSaveDialog({
        title: 'Save Build Archive',
        defaultPath: 'build.pogx',
        filters: [{ name: 'Pogscript Archive', extensions: ['pogx'] }]
    });

    if (canceled) return "Build canceled by user";

    fs.writeFileSync(filePath, code);

    return new Promise((resolve) => {
        if (!isWin && !isMacARM) {
            return resolve("Error: Unsupported platform for build");
        }

        const exePath = checkExePath();
        if (!fs.existsSync(exePath)) {
            try { fs.unlinkSync(filePath); } catch (err) { }
            return resolve(`Error: pogscript.exe not found at: ${exePath}`);
        }

        const customProcess = spawn(exePath, ['--archive', outputPath, filePath]);
        let output = "", errorOutput = "";

        customProcess.stdout.on("data", (data) => output += data.toString());
        customProcess.stderr.on("data", (data) => errorOutput += data.toString());

        customProcess.on("close", () => {
            try { fs.unlinkSync(filePath); } catch (err) { }
            let result = errorOutput ? `Build Error:\n${errorOutput}` : `Build completed successfully!\nArchive saved to: ${outputPath}`;
            if (output) result += `\nBuild Output:\n${output}`;
            resolve(result);
        });

        customProcess.on("error", (error) => {
            try { fs.unlinkSync(filePath); } catch (err) { }
            resolve("Build Error: " + error.message);
        });
    });
}

async function handleRunCode(event, code) {
    if (isCodeRunning) return;
    setCodeRunning(true);

    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, `temp_code_${Date.now()}.txt`);
    fs.writeFileSync(filePath, code);

    return new Promise((resolve) => {
        const finishExecution = (result) => {
            setCodeRunning(false);
            resolve(result);
        };

        if (!isWin && !isMacARM) {
            return finishExecution("Error: Unsupported platform");
        }

        const exePath = checkExePath();
        if (!fs.existsSync(exePath)) {
            try { fs.unlinkSync(filePath); } catch (err) { }
            return finishExecution(`Error: pogscript.exe not found at: ${exePath}`);
        }

        const customProcess = spawn(exePath, [filePath]);
        let output = "", errorOutput = "";

        customProcess.stdout.on("data", (data) => output += data.toString());
        customProcess.stderr.on("data", (data) => errorOutput += data.toString());

        customProcess.on("close", () => {
            try { fs.unlinkSync(filePath); } catch (err) { }
            let result = errorOutput ? `Error:\n${errorOutput}` : (output ? `Output:\n${output}` : "No output");
            finishExecution(result);
        });

        customProcess.on("error", (error) => {
            try { fs.unlinkSync(filePath); } catch (err) { }
            finishExecution("Error: " + error.message);
        });
    });
}

async function handleStartRun(event, code) {
    if (isCodeRunning) {
        return { started: false, reason: 'A program is already running' };
    }

    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, `temp_code_${Date.now()}.txt`);
    fs.writeFileSync(filePath, code);

    if (!isWin && !isMacARM) {
        try { fs.unlinkSync(filePath); } catch (_) { }
        return { started: false, reason: 'Unsupported platform' };
    }

    const exePath = checkExePath();
    if (!fs.existsSync(exePath)) {
        try { fs.unlinkSync(filePath); } catch (_) { }
        return { started: false, reason: `pogscript.exe not found at: ${exePath}` };
    }

    try {
        const child = spawn(exePath, [filePath]);
        setCodeRunning(true);
        const sender = event.sender;
        runSessions.set(sender.id, { proc: child, filePath });

        child.stdout.on('data', (data) => sender.send('run-output', data.toString()));
        child.stderr.on('data', (data) => sender.send('run-error', data.toString()));
        child.on('close', (code) => {
            try { fs.unlinkSync(filePath); } catch (_) { }
            setCodeRunning(false);
            runSessions.delete(sender.id);
            sender.send('run-exit', code);
        });
        child.on('error', (err) => {
            try { fs.unlinkSync(filePath); } catch (_) { }
            setCodeRunning(false);
            runSessions.delete(sender.id);
            sender.send('run-error', String(err?.message || err));
            sender.send('run-exit', -1);
        });

        return { started: true };
    } catch (err) {
        try { fs.unlinkSync(filePath); } catch (_) { }
        setCodeRunning(false);
        return { started: false, reason: String(err?.message || err) };
    }
}

function handleRunInput(event, data) {
    const session = runSessions.get(event.sender.id);
    if (session && session.proc && !session.proc.killed) {
        try { session.proc.stdin.write(data); } catch (_) { }
    }
}

async function handleStopRun(event) {
    const session = runSessions.get(event.sender.id);
    if (session && session.proc && !session.proc.killed) {
        try { session.proc.kill(); } catch (_) { }
        return { stopped: true };
    }
    return { stopped: false };
}

async function handleSaveUIState(event, key, value) {
    try {
        updateUIState(key, value);
        return { success: true };
    } catch (error) {
        console.error('Error saving UI state:', error);
        return { success: false, error: error.message };
    }
}

async function handleGetUIState(event, key) {
    try {
        const value = getUIState(key);
        return { success: true, value };
    } catch (error) {
        console.error('Error getting UI state:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { setupIpcHandlers };
