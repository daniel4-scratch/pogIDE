//preload.js - allows renderer.js to talk to main.js instance

const { contextBridge, ipcRenderer } = require("electron");

// Try to require xterm modules with error handling
let Terminal, FitAddon;
try {
  const xterm = require('@xterm/xterm');
  Terminal = xterm.Terminal;
  
  const fitAddon = require('@xterm/addon-fit');
  FitAddon = fitAddon.FitAddon;
} catch (error) {
  console.error('Failed to load xterm modules in preload:', error);
}

// Create terminal and fitAddon instances here
let terminal = null;
let fitAddon = null;

contextBridge.exposeInMainWorld("pogIDE", {
  runCode: (code) => ipcRenderer.invoke("run-code", code),
  buildCode: (code) => ipcRenderer.invoke("build-code", code),
  onRunShortcut: (callback) => ipcRenderer.on('run-shortcut-pressed', callback),
  removeRunShortcutListener: () => ipcRenderer.removeAllListeners('run-shortcut-pressed'),
  onBuildShortcut: (callback) => ipcRenderer.on('build-shortcut-pressed', callback),
  removeBuildShortcutListener: () => ipcRenderer.removeAllListeners('build-shortcut-pressed'),
  onEditAction: (callback) => ipcRenderer.on('edit-action', callback),
  removeEditActionListener: () => ipcRenderer.removeAllListeners('edit-action'),
});

// Expose xterm functions without passing objects across the bridge
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
  }
});
