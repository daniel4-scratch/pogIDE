//renderer.js - index.html script

// Initialize terminal using wrapper functions from preload script
const terminalInitialized = window.xterm.initialize("terminal", {
  cursorBlink: true,
  cursorStyle: 'block',
  fontFamily: 'monospace',
  fontSize: 14,
  theme: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#ffffff',
    selection: '#264f78',
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  window.xterm.fit();
});

// Write welcome message
window.xterm.writeln('\x1b[36mPogscript IDE Terminal\x1b[0m');
window.xterm.writeln('\x1b[90mReady to execute pogscript code...\x1b[0m');
window.xterm.writeln('');

// Configure Monaco Editor to use local assets
self.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    if (label === 'json') {
      return './vs/language/json/json.worker.js';
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return './vs/language/css/css.worker.js';
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return './vs/language/html/html.worker.js';
    }
    if (label === 'typescript' || label === 'javascript') {
      return './vs/language/typescript/ts.worker.js';
    }
    return './vs/editor/editor.worker.js';
  }
};

// Use the AMD loader approach with local monaco
require.config({ paths: { 'vs': '../node_modules/monaco-editor/min/vs' } });

require(['vs/editor/editor.main'], function () {
  const editor = monaco.editor.create(document.getElementById("editor"), {
    value: `str:txt:Hello World!
yap:(txt)`,
    language: "text",
    theme: "vs-dark",
    automaticLayout: true
  });

  // Ensure the editor resizes properly
  window.addEventListener('resize', () => {
    editor.layout();
  });

  const runBtn = document.getElementById("run");

  // Function to run Pogscript code
  const runPythonCode = async () => {
    // Clear terminal and show "Running..." message
    window.xterm.clear();
    window.xterm.writeln('\x1b[33mRunning Pogscript code...\x1b[0m'); // Yellow text
    
    const code = editor.getValue();
    const result = await window.pogIDE.runCode(code);
    
    // Write the result to the terminal
    if (result.includes("Error:")) {
      // Display errors in red
      const lines = result.split('\n');
      lines.forEach(line => {
        if (line.startsWith("Error:") || line.trim().startsWith("Traceback") || line.trim().startsWith("File ")) {
          window.xterm.writeln(`\x1b[31m${line}\x1b[0m`); // Red text for errors
        } else {
          window.xterm.writeln(line);
        }
      });
    } else {
      // Display normal output
      const lines = result.split('\n');
      lines.forEach(line => {
        if (line.startsWith("Output:")) {
          window.xterm.writeln(`\x1b[32m${line}\x1b[0m`); // Green text for "Output:" header
        } else {
          window.xterm.writeln(line);
        }
      });
    }
    
    // Add a separator line
    window.xterm.writeln('\x1b[36m' + '─'.repeat(50) + '\x1b[0m'); // Cyan separator
  };

  // Button click handlers
  runBtn.addEventListener("click", runPythonCode);

  const buildBtn = document.getElementById("build");
  buildBtn.addEventListener("click", () => {
    window.xterm.clear();
    window.xterm.writeln('\x1b[33mBuild functionality not yet implemented\x1b[0m');
    window.xterm.writeln('\x1b[90mThis will be used for project compilation/building in the future\x1b[0m');
    window.xterm.writeln('');
  });

  // Keyboard shortcut handlers
  window.pogIDE.onRunShortcut(() => {
    runPythonCode();
  });

  window.pogIDE.onBuildShortcut(() => {
    window.xterm.clear();
    window.xterm.writeln('\x1b[33mBuild functionality not yet implemented\x1b[0m');
    window.xterm.writeln('\x1b[90mThis will be used for project compilation/building in the future\x1b[0m');
    window.xterm.writeln('');
  });
});
