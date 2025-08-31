// Renderer script

document.addEventListener('DOMContentLoaded', () => {
  // --- View Menu Toggle Handlers ---
  const controlsBar = document.getElementById('controls');
  const terminal = document.getElementById('terminal');

  // Toggle utility
  function toggleDisplay(element) {
    if (!element) return;
    element.style.display = (element.style.display === 'none') ? '' : 'none';
  }

  // View menu events
  window.pogIDE.onToggleControlsBar(() => {
    toggleDisplay(controlsBar);
    // Optionally, trigger layout updates if needed
    if (window.monacoEditor) setTimeout(() => window.monacoEditor.layout(), 0);
  });
  window.pogIDE.onToggleTerminal(() => {
    toggleDisplay(terminal);
    // Optionally, trigger layout updates if needed
    if (window.xterm && window.xterm.isReady()) setTimeout(() => window.xterm.fit(), 0);
    if (window.monacoEditor) setTimeout(() => window.monacoEditor.layout(), 0);
  });
  // Init terminal
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

  // Init terminal resizer
  initializeTerminalResizer();

  // Window resize
  window.addEventListener('resize', () => {
    if (window.xterm.isReady()) {
      window.xterm.fit();
    }
  });

  // Welcome
  setTimeout(() => {
    if (window.xterm.isReady()) {
      window.xterm.writeln('\x1b[36mPogscript IDE Terminal\x1b[0m');
      window.xterm.writeln('\x1b[90mReady to execute pogscript code...\x1b[0m');
      window.xterm.writeln('');
    }
  }, 200);
});

// Terminal resizer
function initializeTerminalResizer() {
  const resizer = document.getElementById('terminal-resizer');
  const terminal = document.getElementById('terminal');
  const editor = document.getElementById('editor');
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const windowHeight = window.innerHeight;
    const controlsHeight = document.getElementById('controls').offsetHeight;
    
    // Calculate the new terminal height based on mouse position
    const adjustedMouseY = e.clientY + 20;
    const newTerminalHeight = Math.max(100, Math.min(windowHeight - controlsHeight - 100, windowHeight - adjustedMouseY));
    const newEditorHeight = windowHeight - controlsHeight - newTerminalHeight;
    
    // Update heights as percentages
    const terminalPercentage = (newTerminalHeight / windowHeight) * 100;
    const editorPercentage = (newEditorHeight / windowHeight) * 100;
    
    terminal.style.height = `${terminalPercentage}%`;
    editor.style.height = `${editorPercentage}%`;
    
    // Trigger layout updates
    if (window.xterm && window.xterm.isReady()) {
      setTimeout(() => window.xterm.fit(), 0);
    }
    
    // Trigger Monaco editor layout update
    if (window.monacoEditor) {
      setTimeout(() => window.monacoEditor.layout(), 0);
    }
    
    e.preventDefault();
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

// Monaco worker URLs
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

// AMD loader path
require.config({ paths: { 'vs': '../node_modules/monaco-editor/min/vs' } });

require(['vs/editor/editor.main'], function () {
  // Register language
  monaco.languages.register({ id: 'pogscript' });

  // Syntax highlighting
  monaco.languages.setMonarchTokensProvider('pogscript', {
    tokenizer: {
      root: [
        // Variable declarations: TYPE:NAME:VALUE
        [/(int|str|bool):/, 'keyword.type'],
        [/:[a-zA-Z_][a-zA-Z0-9_]*:/, 'variable.name'],
        
        // Basic commands
        [/\b(yap|mew|brb|bai|help|cat|mem|memClear)\b/, 'keyword.command'],
        
        // Memory operations
        [/\b(del|cpy|inp|rnd|cnv|memType|memSave|memLoad):/, 'keyword.memory'],
        
        // Math operations
        [/\bmath:/, 'keyword.math'],
        [/\b(add|sub|mul|div|mod)\b/, 'keyword.operation'],
        
        // Conditional operations
        [/\bif:/, 'keyword.conditional'],
        [/\b(==|!=|<=|>=|<|>)\b/, 'operator.comparison'],
        
        // Variable references: (variableName)
        [/\([a-zA-Z_][a-zA-Z0-9_]*\)/, 'variable.call'],
        
        // File references (.pog files)
        [/[a-zA-Z_][a-zA-Z0-9_]*\.pog/, 'string.filename'],
        
        // Numbers
        [/\d+/, 'number'],
        
        // String content (anything after the last colon on a line)
        [/:([^:\r\n]*)$/, 'string'],
        
        // Variable names (when not in other contexts)
        [/[a-zA-Z_][a-zA-Z0-9_]*/, 'variable.name'],
        
        // Operators and punctuation
        [/[{}()\[\]]/, 'delimiter.bracket'],
        [/[;,.]/, 'delimiter'],
        [/:/, 'operator'],
        
        // Whitespace
        [/\s+/, 'white'],
        
        // Comments (if you add them later)
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
      ],
      
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\/\*/, 'comment', '@push'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ],
    }
  });

  // Theme
  monaco.editor.defineTheme('pogscript-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword.type', foreground: '#569CD6' },              // Blue for data types (int, str, bool)
      { token: 'keyword.command', foreground: '#C586C0' },           // Purple for basic commands (yap, mew, brb, etc.)
      { token: 'keyword.memory', foreground: '#4EC9B0' },            // Teal for memory operations (del, cpy, inp, etc.)
      { token: 'keyword.math', foreground: '#DCDCAA' },              // Yellow for math operations
      { token: 'keyword.conditional', foreground: '#C586C0' },       // Purple for conditionals (if)
      { token: 'keyword.operation', foreground: '#D7BA7D' },         // Light brown for math operations (add, sub, etc.)
      { token: 'operator.comparison', foreground: '#D4D4D4' },       // White for comparison operators
      { token: 'string', foreground: '#CE9178' },                    // Orange for string values
      { token: 'string.filename', foreground: '#CE9178' },           // Orange for .pog filenames
      { token: 'variable.name', foreground: '#9CDCFE' },             // Light blue for variable names
      { token: 'variable.call', foreground: '#C586C0' },             // Purple/pink for variable calls like (txt)
      { token: 'number', foreground: '#B5CEA8' },                    // Green for numbers
      { token: 'operator', foreground: '#D4D4D4' },                  // White for operators
      { token: 'delimiter', foreground: '#D4D4D4' },                 // White for delimiters
      { token: 'comment', foreground: '#6A9955' },                   // Green for comments
    ],
    colors: {
      'editor.background': '#1e1e1e'
    }
  });
  const editor = monaco.editor.create(document.getElementById("editor"), {
    value: `str:txt:Hello World!
yap:(txt)`,
    language: "pogscript",
    theme: "pogscript-dark",
    automaticLayout: true
  });

  // Keep editor reference for layout
  window.monacoEditor = editor;

  // Editor resize
  window.addEventListener('resize', () => {
    editor.layout();
  });

  const runBtn = document.getElementById("run");

  // Run code
  const runPythonCode = async () => {
    // Interactive run mode: stream output and allow input
    if (window.xterm.isReady()) {
      window.xterm.clear();
      window.xterm.writeln('\x1b[33mRunning Pogscript code...\x1b[0m');
      window.xterm.focus();
    }

    const code = editor.getValue();

  // One-run listeners
    const removeListeners = () => {
      if (outputDispose) outputDispose();
      if (errorDispose) errorDispose();
      if (exitDispose) exitDispose();
      outputDispose = errorDispose = exitDispose = null;
    };

    let inputBuffer = '';
    const write = (text) => window.xterm.write(text);
    const writeln = (text) => window.xterm.writeln(text);

  // Stream output
  let outputDispose = window.pogIDE.onRunOutput((data) => {
      if (!window.xterm.isReady()) return;
      write(data.replace(/\r\n/g, '\n'));
    });
  let errorDispose = window.pogIDE.onRunError((data) => {
      if (!window.xterm.isReady()) return;
      const lines = String(data).split('\n');
      for (const line of lines) {
        if (line) writeln(`\x1b[31m${line}\x1b[0m`);
      }
    });
  let exitDispose = window.pogIDE.onRunExit((code) => {
      if (!window.xterm.isReady()) return;
      writeln('');
      writeln(`\x1b[36mProcess exited with code ${code}\x1b[0m`);
      writeln('\x1b[36m' + '─'.repeat(50) + '\x1b[0m');
      // Stop capturing input
      if (detachInput) detachInput();
      removeListeners();
    });

  // Capture stdin
    let detachInput = null;
    if (window.xterm.onData) {
      const handler = (data) => {
        // Basic line editing: handle Enter, Backspace; pass through others
        const code = data.charCodeAt(0);
        if (data === '\r') { // Enter
          write('\r\n');
          window.pogIDE.sendInput(inputBuffer + '\n');
          inputBuffer = '';
        } else if (data === '\u0003') { // Ctrl+C
          writeln('^C');
          window.pogIDE.stopRun();
        } else if (data === '\u007F' || code === 127) { // Backspace
          if (inputBuffer.length > 0) {
            // Move cursor back, erase char, move back again
            write('\b \b');
            inputBuffer = inputBuffer.slice(0, -1);
          }
        } else if (data >= ' ' && data <= '~') { // Printable
          inputBuffer += data;
          write(data);
        } else {
          // Forward any other control sequences as-is (e.g., arrows)
          window.pogIDE.sendInput(data);
        }
      };
      const dispose = window.xterm.onData(handler);
      detachInput = () => { try { dispose && dispose(); } catch (e) {} };
    }

    const { started, reason } = await window.pogIDE.startRun(code);
  if (!started) {
      if (window.xterm.isReady()) {
        writeln(`\x1b[31mFailed to start: ${reason}\x1b[0m`);
        writeln('\x1b[36m' + '─'.repeat(50) + '\x1b[0m');
      }
      if (detachInput) detachInput();
      removeListeners();
    }
  };

  // Buttons
  runBtn.addEventListener("click", runPythonCode);

  const buildBtn = document.getElementById("build");
  buildBtn.addEventListener("click", async () => {
    if (window.xterm.isReady()) {
      window.xterm.clear();
      window.xterm.writeln('\x1b[33mBuilding Pogscript project...\x1b[0m'); // Yellow text
    }
    
    const code = editor.getValue();
    const result = await window.pogIDE.buildCode(code);
    
  // Build result
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

  // Shortcuts
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
    
  // Build result
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

  // Edit actions
  window.pogIDE.onEditAction((event, action) => {
    const editorHasFocus = !!document.activeElement && document.getElementById('editor')?.contains(document.activeElement);
    const terminalHasFocus = !!document.activeElement && document.getElementById('terminal')?.contains(document.activeElement);

    // Prefer target with focus; fall back to editor when applicable
    if (terminalHasFocus && window.xterm && window.xterm.isReady()) {
      switch (action) {
        case 'copy':
          if (window.xterm.hasSelection()) {
            navigator.clipboard.writeText(window.xterm.getSelection());
            window.xterm.clearSelection();
          }
          return;
        case 'paste':
          navigator.clipboard.readText().then(text => {
            if (!text) return;
            if (window.pogIDE && typeof window.pogIDE.sendInput === 'function') {
              window.pogIDE.sendInput(text);
            }
            if (typeof window.xterm.write === 'function') {
              window.xterm.write(text.replace(/\r?\n/g, '\r\n'));
            }
          });
          return;
        case 'selectAll':
          window.xterm.selectAll();
          return;
        // cut/undo/redo/paste don't apply to read-only terminal content
      }
    }

    if (window.monacoEditor) {
      switch (action) {
        case 'undo':
          window.monacoEditor.trigger('keyboard', 'undo');
          break;
        case 'redo':
          window.monacoEditor.trigger('keyboard', 'redo');
          break;
        case 'cut':
          const selectedText = window.monacoEditor.getModel().getValueInRange(window.monacoEditor.getSelection());
          if (selectedText) {
            navigator.clipboard.writeText(selectedText);
            window.monacoEditor.executeEdits('', [{
              range: window.monacoEditor.getSelection(),
              text: ''
            }]);
          }
          break;
        case 'copy':
          const textToCopy = window.monacoEditor.getModel().getValueInRange(window.monacoEditor.getSelection());
          if (textToCopy) {
            navigator.clipboard.writeText(textToCopy);
          }
          break;
        case 'paste':
          navigator.clipboard.readText().then(clipText => {
            if (clipText) {
              const selection = window.monacoEditor.getSelection();
              window.monacoEditor.executeEdits('', [{
                range: selection,
                text: clipText
              }]);
              const lines = clipText.split('\n');
              const lastLineLength = lines[lines.length - 1].length;
              const endPosition = {
                lineNumber: selection.startLineNumber + lines.length - 1,
                column: lines.length > 1 ? lastLineLength + 1 : selection.startColumn + lastLineLength
              };
              window.monacoEditor.setPosition(endPosition);
            }
          });
          break;
        case 'selectAll':
          const model = window.monacoEditor.getModel();
          const fullRange = model.getFullModelRange();
          window.monacoEditor.setSelection(fullRange);
          break;
      }
    }
  });


  // Editor shortcut listeners
  document.addEventListener('keydown', (event) => {
    const editorElement = document.getElementById('editor');
    const terminalElement = document.getElementById('terminal');
    const editorFocused = editorElement && editorElement.contains(document.activeElement);
    const terminalFocused = terminalElement && terminalElement.contains(document.activeElement);
    if (editorFocused) {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      
      if (isCtrlOrCmd && !event.altKey && !event.shiftKey) {
        switch (event.key.toLowerCase()) {
          case 'z':
            event.preventDefault();
            window.monacoEditor.trigger('keyboard', 'undo');
            break;
          case 'x':
            event.preventDefault();
            handleCut();
            break;
          case 'c':
            event.preventDefault();
            handleCopy();
            break;
          case 'v':
            event.preventDefault();
            handlePaste();
            break;
          case 'a':
            event.preventDefault();
            handleSelectAll();
            break;
        }
      } else if (isCtrlOrCmd && event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        window.monacoEditor.trigger('keyboard', 'redo');
      }
    } else if (terminalFocused && window.xterm && window.xterm.isReady()) {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      // Copy selection from terminal
      if (isCtrlOrCmd && event.key.toLowerCase() === 'c' && window.xterm.hasSelection()) {
        event.preventDefault();
        navigator.clipboard.writeText(window.xterm.getSelection());
        window.xterm.clearSelection();
      }
      // Paste into running process stdin
      if (isCtrlOrCmd && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        navigator.clipboard.readText().then(text => {
          if (!text) return;
          if (window.pogIDE && typeof window.pogIDE.sendInput === 'function') {
            window.pogIDE.sendInput(text);
          }
          if (window.xterm && typeof window.xterm.write === 'function') {
            window.xterm.write(text.replace(/\r?\n/g, '\r\n'));
          }
        });
      }
      // Select all in terminal
      if (isCtrlOrCmd && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        window.xterm.selectAll();
      }
    }
  });

  // Edit helpers
  function handleCut() {
    const selectedText = window.monacoEditor.getModel().getValueInRange(window.monacoEditor.getSelection());
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
      window.monacoEditor.executeEdits('', [{
        range: window.monacoEditor.getSelection(),
        text: ''
      }]);
    }
  }

  function handleCopy() {
    const textToCopy = window.monacoEditor.getModel().getValueInRange(window.monacoEditor.getSelection());
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
    }
  }

  function handlePaste() {
    navigator.clipboard.readText().then(clipText => {
      if (clipText) {
        const selection = window.monacoEditor.getSelection();
        window.monacoEditor.executeEdits('', [{
          range: selection,
          text: clipText
        }]);
        // Move cursor to the end of the pasted text
        const lines = clipText.split('\n');
        const lastLineLength = lines[lines.length - 1].length;
        const endPosition = {
          lineNumber: selection.startLineNumber + lines.length - 1,
          column: lines.length > 1 ? lastLineLength + 1 : selection.startColumn + lastLineLength
        };
        window.monacoEditor.setPosition(endPosition);
      }
    });
  }

  function handleSelectAll() {
    const model = window.monacoEditor.getModel();
    const fullRange = model.getFullModelRange();
    window.monacoEditor.setSelection(fullRange);
  }
});
