// Listen for text updates from main process
window.pogIDE.onTextUpdate((event, text) => {
  console.log("Received text from main:", text);
  
  // You can update DOM elements here
  const textElement = document.getElementById('loading-context');
  if (textElement) {
    textElement.textContent = text;
  }
});

// Example usage
console.log("Script.js loaded and ready to receive text updates");
