// Text updates from main
window.pogIDE.onTextUpdate((event, text) => {
  console.log("Received text from main:", text);
  
  const textElement = document.getElementById('loading-context');
  if (textElement) {
    textElement.textContent = text;
  }
});