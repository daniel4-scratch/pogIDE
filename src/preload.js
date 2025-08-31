// Bridge APIs to the renderer

const { contextBridge, ipcRenderer } = require("electron");

// Lazy-load xterm modules
let Terminal, FitAddon;
try {
  const xterm = require('@xterm/xterm');
  Terminal = xterm.Terminal;
  
  const fitAddon = require('@xterm/addon-fit');
  FitAddon = fitAddon.FitAddon;
} catch (error) {
  console.error('Failed to load xterm modules in preload:', error);
}

// xterm instances
let terminal = null;
let fitAddon = null;

contextBridge.exposeInMainWorld("pogIDE", {
  runCode: (code) => ipcRenderer.invoke("run-code", code),
  buildCode: (code) => ipcRenderer.invoke("build-code", code),
  startRun: (code) => ipcRenderer.invoke('start-run', code),
  stopRun: () => ipcRenderer.invoke('stop-run'),
  sendInput: (data) => ipcRenderer.send('run-input', data),
  onRunOutput: (cb) => {
    const listener = (_, data) => cb(data);
    ipcRenderer.on('run-output', listener);
    return () => ipcRenderer.removeListener('run-output', listener);
  },
  onRunError: (cb) => {
    const listener = (_, data) => cb(data);
    ipcRenderer.on('run-error', listener);
    return () => ipcRenderer.removeListener('run-error', listener);
  },
  onRunExit: (cb) => {
    const listener = (_, code) => cb(code);
    ipcRenderer.on('run-exit', listener);
    return () => ipcRenderer.removeListener('run-exit', listener);
  },
  onRunShortcut: (callback) => ipcRenderer.on('run-shortcut-pressed', callback),
  removeRunShortcutListener: () => ipcRenderer.removeAllListeners('run-shortcut-pressed'),
  onBuildShortcut: (callback) => ipcRenderer.on('build-shortcut-pressed', callback),
  removeBuildShortcutListener: () => ipcRenderer.removeAllListeners('build-shortcut-pressed'),
  onEditAction: (callback) => ipcRenderer.on('edit-action', callback),
  removeEditActionListener: () => ipcRenderer.removeAllListeners('edit-action'),
  // Listen for toggle events from main process
  onToggleControlsBar: (callback) => ipcRenderer.on('toggle-controls-bar', callback),
  removeToggleControlsBarListener: () => ipcRenderer.removeAllListeners('toggle-controls-bar'),
  onToggleTerminal: (callback) => ipcRenderer.on('toggle-terminal', callback),
  removeToggleTerminalListener: () => ipcRenderer.removeAllListeners('toggle-terminal'),
  // UI state management
  saveUIState: (key, value) => ipcRenderer.invoke('save-ui-state', key, value),
  getUIState: (key) => ipcRenderer.invoke('get-ui-state', key),
});

// Expose xterm helpers
contextBridge.exposeInMainWorld("xterm", {
  initialize: (elementId, options) => {
    try {
      if (!Terminal || !FitAddon) {
        console.error('xterm modules not available');
        return false;
      }
      
      terminal = new Terminal(options);
      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
          terminal.open(element);
          fitAddon.fit();
        } else {
          console.error('Terminal element not found:', elementId);
        }
      }, 100);
      
  return true;
    } catch (error) {
      console.error('Error initializing terminal:', error);
      return false;
    }
  },
  writeln: (text) => {
    if (terminal) {
      terminal.writeln(text);
    }
  },
  write: (text) => {
    if (terminal) {
      terminal.write(text);
    }
  },
  clear: () => {
    if (terminal) {
      terminal.clear();
    }
  },
  fit: () => {
    if (fitAddon) {
      fitAddon.fit();
    }
  },
  isReady: () => {
    return terminal !== null && fitAddon !== null;
  },
  hasSelection: () => {
    try { return terminal ? terminal.hasSelection() : false; } catch { return false; }
  },
  getSelection: () => {
    try { return terminal ? terminal.getSelection() : ''; } catch { return ''; }
  },
  clearSelection: () => {
    try { if (terminal) terminal.clearSelection(); } catch {}
  },
  selectAll: () => {
    try { if (terminal) terminal.selectAll(); } catch {}
  },
  onData: (cb) => {
    if (terminal) {
      const disp = terminal.onData(cb);
      return () => { try { disp.dispose(); } catch (e) {} };
    }
    return () => {};
  },
  focus: () => {
    if (terminal) terminal.focus();
  }
});
