// config.js - Handles loading, saving, and initializing the global app configuration (config.json).
const { app, fs, path } = require('./constants');

let configData;
let configPath;

function getConfigPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', 'config.json');
  } else {
    return path.join(__dirname, '..', '..', '..', 'app', 'config.json');
  }
}

function saveConfig() {
  if (configData && configPath) {
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
  }
}

function initializeConfig() {
  const jsonTemplate = {
    autoInstallPogscript: true,
    ui: {
      controlsVisible: false,
      terminalVisible: true
    }
  };
  
  configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    const dirPath = path.dirname(configPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(jsonTemplate));
    configData = jsonTemplate;
  } else {
    configData = JSON.parse(fs.readFileSync(configPath));
  }
  return { configData, configPath };
}

module.exports = {
  initializeConfig,
  saveConfig,
  getConfigData: () => configData,
  setConfigData: (data) => { configData = data; },
  updateUIState: (key, value) => {
    if (configData && configData.ui) {
      configData.ui[key] = value;
      saveConfig();
    }
  },
  getUIState: (key) => {
    return configData && configData.ui ? configData.ui[key] : null;
  }
};
