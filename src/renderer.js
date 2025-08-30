//renderer.js - index.html script

// Wait for DOM to be ready and then initialize terminal
document.addEventListener('DOMContentLoaded', () => {
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
    if (window.xterm.isReady()) {
      window.xterm.fit();
    }
  });

  // Write welcome message after a short delay to ensure terminal is ready
  setTimeout(() => {
    if (window.xterm.isReady()) {
      window.xterm.writeln('\x1b[36mPogscript IDE Terminal\x1b[0m');
      window.xterm.writeln('\x1b[90mReady to execute pogscript code...\x1b[0m');
      window.xterm.writeln('');
    }
  }, 200);
});

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
    if (window.xterm.isReady()) {
      window.xterm.clear();
      window.xterm.writeln('\x1b[33mRunning Pogscript code...\x1b[0m'); // Yellow text
    }
    
    const code = editor.getValue();
    const result = await window.pogIDE.runCode(code);
    
    // Write the result to the terminal
    if (window.xterm.isReady()) {
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
    }
  };

  // Button click handlers
  runBtn.addEventListener("click", runPythonCode);

  const buildBtn = document.getElementById("build");
  buildBtn.addEventListener("click", async () => {
    if (window.xterm.isReady()) {
      window.xterm.clear();
      window.xterm.writeln('\x1b[33mBuilding Pogscript project...\x1b[0m'); // Yellow text
    }
    
    const code = editor.getValue();
    const result = await window.pogIDE.buildCode(code);
    
    // Display build result in terminal
    if (window.xterm.isReady()) {
      if (result.includes("Build Error:")) {
        // Display errors in red
        const lines = result.split('\n');
        lines.forEach(line => {
          if (line.startsWith("Build Error:") || line.trim().startsWith("Error:")) {
            window.xterm.writeln(`\x1b[31m${line}\x1b[0m`); // Red text for errors
          } else {
            window.xterm.writeln(line);
          }
        });
      } else if (result === "Build canceled by user") {
        window.xterm.writeln(`\x1b[90m${result}\x1b[0m`); // Gray text for canceled
      } else {
        // Display successful build output
        const lines = result.split('\n');
        lines.forEach(line => {
          if (line.startsWith("Build completed successfully!")) {
            window.xterm.writeln(`\x1b[32m${line}\x1b[0m`); // Green text for success
          } else if (line.startsWith("Archive saved to:")) {
            window.xterm.writeln(`\x1b[36m${line}\x1b[0m`); // Cyan text for file path
          } else {
            window.xterm.writeln(line);
          }
        });
      }
      
      // Add a separator line
      window.xterm.writeln('\x1b[36m' + '─'.repeat(50) + '\x1b[0m'); // Cyan separator
    }
  });

  // Keyboard shortcut handlers
  window.pogIDE.onRunShortcut(() => {
    runPythonCode();
  });

  window.pogIDE.onBuildShortcut(async () => {
    if (window.xterm.isReady()) {
      window.xterm.clear();
      window.xterm.writeln('\x1b[33mBuilding Pogscript project...\x1b[0m'); // Yellow text
    }
    
    const code = editor.getValue();
    const result = await window.pogIDE.buildCode(code);
    
    // Display build result in terminal
    if (window.xterm.isReady()) {
      if (result.includes("Build Error:")) {
        // Display errors in red
        const lines = result.split('\n');
        lines.forEach(line => {
          if (line.startsWith("Build Error:") || line.trim().startsWith("Error:")) {
            window.xterm.writeln(`\x1b[31m${line}\x1b[0m`); // Red text for errors
          } else {
            window.xterm.writeln(line);
          }
        });
      } else if (result === "Build canceled by user") {
        window.xterm.writeln(`\x1b[90m${result}\x1b[0m`); // Gray text for canceled
      } else {
        // Display successful build output
        const lines = result.split('\n');
        lines.forEach(line => {
          if (line.startsWith("Build completed successfully!")) {
            window.xterm.writeln(`\x1b[32m${line}\x1b[0m`); // Green text for success
          } else if (line.startsWith("Archive saved to:")) {
            window.xterm.writeln(`\x1b[36m${line}\x1b[0m`); // Cyan text for file path
          } else {
            window.xterm.writeln(line);
          }
        });
      }
      
      // Add a separator line
      window.xterm.writeln('\x1b[36m' + '─'.repeat(50) + '\x1b[0m'); // Cyan separator
    }
  });
});
