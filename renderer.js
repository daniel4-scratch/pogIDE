require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

require(["vs/editor/editor.main"], function () {
  const editor = monaco.editor.create(document.getElementById("editor"), {
    value: `#include <iostream>\nusing namespace std;\n\nint main(){\n    cout << "Hello, World!\\n";\n    return 0;\n}`,
    language: "cpp",
    theme: "vs-dark"
  });

  const runBtn = document.getElementById("run");
  const outputDiv = document.getElementById("output");

  runBtn.addEventListener("click", async () => {
    outputDiv.textContent = "Compiling...";
    const code = editor.getValue();
    const result = await window.cppIDE.compileRun(code);
    outputDiv.textContent = result;
  });
});
