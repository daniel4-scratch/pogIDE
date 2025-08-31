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
    autoInstallPogscript: true
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
};
