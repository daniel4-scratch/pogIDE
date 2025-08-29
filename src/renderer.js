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
    value: `print("Hello, World!")

def greet(name):
    return f"Hello, {name}!"

if __name__ == "__main__":
    name = "Python Developer"
    message = greet(name)
    print(message)`,
    language: "python",
    theme: "vs-dark",
    automaticLayout: true
  });

  // Ensure the editor resizes properly
  window.addEventListener('resize', () => {
    editor.layout();
  });

  const runBtn = document.getElementById("run");
  const outputDiv = document.getElementById("output");

  // Function to run Python code
  const runPythonCode = async () => {
    outputDiv.textContent = "Running Python code...";
    const code = editor.getValue();
    const result = await window.pythonIDE.runCode(code);
    outputDiv.textContent = result;
  };

  // Button click handler
  runBtn.addEventListener("click", runPythonCode);

  // Keyboard shortcut handler
  window.pythonIDE.onRunShortcut(() => {
    runPythonCode();
  });
});
