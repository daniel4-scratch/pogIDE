# Pogscript IDE
An integrated development environment for Pogscript. Made using electron
<p align="center"><img width="600" alt="image" src="https://github.com/user-attachments/assets/a314378d-204d-4961-96c9-81099c8bcbff" /></p>

Current Features:
-   Syntax highlighting
-   Running and building support
-   Windows and MacOS support

## Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm (comes with Node.js)
- Git

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/daniel4-scratch/pogIDE
   cd pogIDE
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application in development mode**
   ```bash
   npm start
   ```

### Development Workflow

#### Running in VS Code
The project includes VS Code launch configurations:
- Open the project in VS Code
- Go to Run and Debug (Ctrl+Shift+D)
- Select "Launch Electron App" and press F5

#### Building the Application
- **Development build**: `npm run build`
- **Platform-specific builds**:
  - Windows: `npm run build:win`
  - macOS: `npm run build:mac`
  - Linux: `npm run build:linux`
- **Package without installer**: `npm run pack`

#### Project Structure
```
src/
├── main.js          # Main Electron process
├── renderer.js      # Renderer process logic
├── preload.js       # Preload script for secure IPC
├── index.html       # Main window HTML
├── style.css        # Main window styles
├── splash/          # Splash screen components
└── utils/           # Utility modules
```

#### Debugging
- Main process: Use VS Code's "Launch Electron App (Debug)" configuration
- Renderer process: Open Developer Tools (Ctrl+Shift+I) in the running app
