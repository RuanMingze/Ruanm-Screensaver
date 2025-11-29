const { app, BrowserWindow, ipcMain, screen, shell, powerMonitor, Menu, Tray, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const fontList = require('font-list');

// 处理Windows程序的启动
if (require('electron-squirrel-startup')) {
  app.quit();
  return;
}

// 检查启动参数，如果是开机启动则最小化到托盘
const gotTheLock = app.requestSingleInstanceLock();
const isStartup = process.argv.includes('--process-startup-channel="ruanm-screensaver-startup"');

if (!gotTheLock) {
  // 如果已经有一个实例在运行，直接退出
  app.quit();
  return;
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // 当尝试启动第二个实例时，显示主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// 添加未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  // 不要退出应用，只是记录错误
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason, promise);
  // 不要退出应用，只是记录错误
});

// 托盘对象
let tray = null;

// 日志文件路径
const logDir = path.join(app.getPath('userData'), 'logs');
let logFile = null;

// 初始化日志系统
function initLogging() {
  try {
    // 检查是否启用了日志功能
    if (!settings.enableLogging) {
      logFile = null;
      console.log('日志功能已禁用');
      return;
    }
    
    // 创建日志目录（如果不存在）
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // 创建日志文件
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    logFile = path.join(logDir, `log_${date}.txt`);
    
    // 写入日志文件头
    const header = `==================== Ruanm 屏保应用日志 ====================
` +
                  `启动时间: ${new Date().toLocaleString()}
` +
                  `版本: 1.0.2
` +
                  `调试模式: ${settings && settings.debugMode ? '开启' : '关闭'}
` +
                  `========================================================

`;
    fs.appendFileSync(logFile, header);
    
    console.log('日志系统初始化完成，日志文件:', logFile);
  } catch (error) {
    console.error('初始化日志系统失败:', error);
  }
}

// 写入日志
function writeLog(message, data = null) {
  try {
    // 检查是否启用了日志功能
    if (!settings.enableLogging) return;
    
    // 如果不是调试模式，过滤掉调试日志
    if (!settings.debugMode && message.startsWith('[DEBUG]')) return;
    
    if (!logFile) return;
    
    const timestamp = new Date().toLocaleString();
    let logEntry = `[${timestamp}] ${message}\n`;
    
    if (data !== null) {
      logEntry += `  数据: ${JSON.stringify(data, null, 2)}\n`;
    }
    
    logEntry += '\n';
    
    fs.appendFileSync(logFile, logEntry);
  } catch (error) {
    console.error('写入日志失败:', error);
  }
}

// 获取壁纸URL，带重试机制
async function getWallpaperUrl(keyword = '4k') {
  const maxRetries = 3;
  
  // 记录壁纸请求日志
  writeLog('请求壁纸', { keyword, maxRetries });
  
  // 如果是随机壁纸，随机选择一个类型
  if (keyword === 'random') {
    const categories = ['4k', 'landscape', 'belle', 'game', 'photo', 'cool', 'star', 'car', 'cartoon'];
    keyword = categories[Math.floor(Math.random() * categories.length)];
    console.log('随机选择壁纸类型:', keyword);
    writeLog('随机选择壁纸类型', { selectedCategory: keyword });
  }
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 使用新的API
      // 首先获取JSON数据以获取图片URL
      const jsonUrl = 'https://api.mmp.cc/api/pcwallpaper?' + 
        (keyword ? 'category=' + encodeURIComponent(keyword) + '&' : '') + 
        'type=json';
      
      console.log('请求JSON数据:', jsonUrl);
      writeLog('发送壁纸API请求', { url: jsonUrl });
      
      const response = await axios.get(jsonUrl, { timeout: 5000 }); // 5秒超时
      console.log('壁纸API响应:', response.data);
      writeLog('收到壁纸API响应', { status: response.status, data: response.data });
      
      // 解析JSON响应以获取图片URL
      if (response.data && response.data.url) {
        writeLog('成功获取壁纸URL', { url: response.data.url });
        return response.data.url;
      }
      
      console.log('API响应中没有图片URL，重试...');
      writeLog('API响应中没有图片URL，准备重试');
    } catch (error) {
      console.error(`获取壁纸失败 (尝试 ${i + 1}/${maxRetries}):`, error.message);
      writeLog(`获取壁纸失败 (尝试 ${i + 1}/${maxRetries})`, { error: error.message });
      
      // 如果是最后一次尝试，抛出错误
      if (i === maxRetries - 1) {
        writeLog('获取壁纸最终失败', { error: error.message });
        throw error;
      }
      
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  writeLog('无法获取壁纸URL，返回空字符串');
  return '';
}

// 设置文件路径
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
console.log('Settings file path:', settingsPath); // 添加调试信息

// 默认设置
const defaultSettings = {
  enableLockScreen: false, // 默认不启用屏保功能
  lockTime: 5,
  lockTimeUnit: 'minute', // 默认时间单位为分钟
  wallpaperChangeTime: 10,
  wallpaperChangeTimeUnit: 'minute', // 默认时间单位为分钟
  wallpaperKeyword: 'random',
  timeFontSize: 80,
  dateFontSize: 30,
  timePosition: 'bottom-left',
  datePosition: 'bottom-left',
  timeColor: '#FFFFFF',
  timeFontFamily: 'Arial', // 默认时间字体
  dateFontFamily: 'Arial', // 默认日期字体
  showAdvertisement: false,
  enableLogging: true, // 默认启用日志
  theme: 'light', // 默认主题为浅色
  weatherCity: 'Guangzhou', // 默认天气城市为广州
  weatherPosition: 'bottom-right', // 默认天气位置为右下角
  // 添加密码保护设置
  enablePasswordProtection: false, // 默认不启用密码保护
  password: '', // 默认密码为空
  // 添加本地壁纸设置
  localWallpapers: '', // 默认没有本地壁纸
  // 添加调试模式设置
  debugMode: false, // 默认关闭调试模式
  // 添加记住退出选择设置
  rememberExitChoice: false, // 默认不记住退出选择
  lastExitChoice: '' // 默认没有上次退出选择
};

// 读取设置
function readSettings() {
  try {
    // 先检查日志功能是否启用
    let tempSettings = defaultSettings;
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      tempSettings = { ...defaultSettings, ...JSON.parse(data) };
    }
    
    // 检查是否启用了日志功能
    if (tempSettings.enableLogging) {
      writeLog('读取设置文件', { path: settingsPath });
    }
    
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const settings = { ...defaultSettings, ...JSON.parse(data) };
      if (settings.enableLogging) {
        writeLog('成功读取设置', settings);
      }
      return settings;
    } else {
      if (tempSettings.enableLogging) {
        writeLog('设置文件不存在，使用默认设置');
      }
      // 如果文件不存在，创建默认设置文件
      saveSettings(defaultSettings);
    }
  } catch (error) {
    console.error('读取设置失败:', error);
    // 检查是否启用了日志功能
    let tempSettings = defaultSettings;
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      tempSettings = { ...defaultSettings, ...JSON.parse(data) };
    }
    
    if (tempSettings.enableLogging) {
      writeLog('读取设置失败', { error: error.message });
    }
  }
  return defaultSettings;
}

// 保存设置
function saveSettings(settings) {
  try {
    writeLog('保存设置到文件', { path: settingsPath, settings });
    // 确保目录存在
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    writeLog('设置保存成功');
    return true;
  } catch (error) {
    console.error('保存设置失败:', error);
    writeLog('保存设置失败', { error: error.message });
    return false;
  }
}

// 添加一个函数来清理本地壁纸设置
function cleanLocalWallpapersSettings(settings) {
  // 如果localWallpapers为空字符串或只包含分号，则设置为null
  if (!settings.localWallpapers || settings.localWallpapers.trim() === '' || settings.localWallpapers.split(';').filter(path => path.trim() !== '').length === 0) {
    settings.localWallpapers = null;
  }
  return settings;
}

let settings = readSettings();
let screenSaverWindow = null;
let mainWindow = null;
let wallpaperInterval = null;
let idleTimer = null;

// 创建系统托盘
function createTray() {
  // 创建托盘图标
  tray = new Tray(path.join(__dirname, 'Assets', 'Icons', 'tray-icon.png'));
  
  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主界面',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    {
      label: '测试锁屏',
      click: () => {
        createScreenSaver();
      }
    },
    {
      label: '退出应用',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Ruanm 锁屏应用');
  
  // 点击托盘图标显示主界面
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
}

// 创建主窗口
function createWindow() {
  console.log('开始创建主窗口');
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'Assets', 'Icons', 'app-icon.ico'), // 设置应用程序图标
    frame: false, // 隐藏默认窗口边框
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true // 启用开发者工具
    }
  });
  
  // 隐藏菜单栏
  mainWindow.setMenuBarVisibility(false);

  console.log('准备加载index.html');
  mainWindow.loadFile('index.html');
  console.log('index.html加载命令已发送');
  
  // 当窗口加载完成时，发送当前主题设置
  mainWindow.webContents.once('dom-ready', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('apply-theme', settings.theme || 'light');
      // 启用开发者工具
      // mainWindow.webContents.openDevTools();
    }
  });
  
  // 监听窗口关闭事件，通过IPC通知渲染进程显示确认对话框
  mainWindow.on('close', async (event) => {
    console.log('窗口关闭事件被触发');
    if (!app.quitting) {
      console.log('应用未退出状态，阻止默认关闭行为');
      event.preventDefault();
      
      // 通过IPC通知渲染进程显示确认对话框
      // 记住退出选择的逻辑应该在渲染进程处理，而不是在主进程
      if (mainWindow) {
        console.log('发送显示退出对话框消息');
        mainWindow.webContents.send('show-exit-dialog');
      }
    } else {
      console.log('应用正在退出状态，允许关闭');
    }
    console.log('窗口关闭事件处理完成');
    return false;
  });
}

// 创建屏保窗口
function createScreenSaver() {
  if (screenSaverWindow) {
    screenSaverWindow.show();
    screenSaverWindow.focus();
    return;
  }

  // 获取主屏幕尺寸
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  screenSaverWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    fullscreen: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    frame: false,
    transparent: false,
    hasShadow: false,
    kiosk: false, // 禁用kiosk模式，改用其他方法
    show: false, // 先隐藏窗口
    icon: path.join(__dirname, 'Assets', 'Icons', 'app-icon.ico'), // 设置应用程序图标
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true // 启用开发者工具
    }
  });
  
  // 隐藏菜单栏
  screenSaverWindow.setMenuBarVisibility(false);
  
  // 确保窗口在最前面
  screenSaverWindow.setAlwaysOnTop(true, 'screen-saver');
  
  // 启用焦点捕获
  screenSaverWindow.setFocusable(true);

  screenSaverWindow.loadFile('screensaver.html');
  
  // 窗口就绪后确保全屏并显示
  screenSaverWindow.once('ready-to-show', () => {
    // 设置窗口位置和大小
    screenSaverWindow.setBounds({
      x: 0,
      y: 0,
      width: width,
      height: height
    });
    
    // 设置全屏
    screenSaverWindow.setFullScreen(true);
    
    // 显示窗口
    screenSaverWindow.show();
    screenSaverWindow.focus();
    
    // 启用开发者工具
    // screenSaverWindow.webContents.openDevTools();
    
    // 再次确保全屏（延迟执行）
    setTimeout(() => {
      if (screenSaverWindow) {
        screenSaverWindow.setFullScreen(true);
        screenSaverWindow.focus();
      }
    }, 100);
  });
  
  // 防止屏保窗口被关闭
  screenSaverWindow.on('close', (e) => {
    if (screenSaverWindow) {
      e.preventDefault();
    }
  });
  
  // 监听窗口焦点变化，确保屏保始终在最前面
  screenSaverWindow.on('blur', () => {
    if (screenSaverWindow) {
      setTimeout(() => {
        screenSaverWindow.focus();
      }, 100);
    }
  });
  
  // 监听全屏状态变化
  screenSaverWindow.on('enter-full-screen', () => {
    console.log('进入全屏模式');
  });
  
  screenSaverWindow.on('leave-full-screen', () => {
    console.log('离开全屏模式，重新设置');
    if (screenSaverWindow) {
      setTimeout(() => {
        if (screenSaverWindow) {
          screenSaverWindow.setFullScreen(true);
        }
      }, 50);
    }
  });
}

// 关闭屏保
function closeScreenSaver() {
  if (screenSaverWindow) {
    screenSaverWindow.destroy();
    screenSaverWindow = null;
  }
  
  // 重置空闲计时器
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  
  // 重新启动空闲检测
  startIdleDetection();
}

// 启动壁纸切换定时器
function startWallpaperTimer() {
  if (wallpaperInterval) {
    clearInterval(wallpaperInterval);
  }
  
  if (settings.wallpaperChangeTime > 0) {
    // 根据时间单位计算壁纸切换时间（转换为毫秒）
    let wallpaperChangeTimeMs = settings.wallpaperChangeTime * 1000; // 默认为秒
    if (settings.wallpaperChangeTimeUnit === 'minute') {
      wallpaperChangeTimeMs = settings.wallpaperChangeTime * 60 * 1000;
    }
    
    wallpaperInterval = setInterval(async () => {
      if (screenSaverWindow) {
        try {
          // 检查是否有本地壁纸设置
          if (settings.localWallpapers) {
            const localWallpaperPaths = settings.localWallpapers.split(';').filter(path => path.trim() !== '');
            if (localWallpaperPaths.length > 0) {
              // 随机选择一张本地图片
              const randomIndex = Math.floor(Math.random() * localWallpaperPaths.length);
              const randomImagePath = localWallpaperPaths[randomIndex];
              screenSaverWindow.webContents.send('update-wallpaper', randomImagePath);
              return;
            }
          }
          
          // 使用网络壁纸
          const wallpaperUrl = await getWallpaperUrl(settings.wallpaperKeyword);
          if (wallpaperUrl) {
            screenSaverWindow.webContents.send('update-wallpaper', wallpaperUrl);
          }
        } catch (error) {
          console.error('定时切换壁纸失败:', error);
        }
      }
    }, wallpaperChangeTimeMs);
  }
}

// 启动空闲检测
function startIdleDetection() {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  
  // 只有在启用屏保功能且设置了屏保时间时才启动空闲检测
  if (settings.enableLockScreen && settings.lockTime > 0) {
    // 使用Electron的powerMonitor检测系统空闲状态
    const checkIdle = () => {
      const idleTime = powerMonitor.getSystemIdleTime();
      // 根据时间单位计算屏保时间（转换为秒）
      let lockTimeSeconds = settings.lockTime;
      if (settings.lockTimeUnit === 'minute') {
        lockTimeSeconds = settings.lockTime * 60;
      }
      
      console.log(`系统空闲时间: ${idleTime}秒, 屏保时间: ${lockTimeSeconds}秒`);
      
      if (idleTime >= lockTimeSeconds) {
        createScreenSaver();
      }
      
      // 每秒检查一次
      idleTimer = setTimeout(checkIdle, 1000);
    };
    
    checkIdle();
  }
}

// 应用设置
function applySettings(newSettings) {
  writeLog('应用新设置', { newSettings });
  
  const oldLockTime = settings.lockTime;
  const oldEnableLockScreen = settings.enableLockScreen;
  const oldEnableLogging = settings.enableLogging;
  const oldSettings = { ...settings };
  
  // 清理本地壁纸设置
  newSettings = cleanLocalWallpapersSettings(newSettings);
  settings = cleanLocalWallpapersSettings({ ...settings, ...newSettings });
  
  // 保存设置并检查结果
  const saveResult = saveSettings(settings);
  console.log('保存设置结果:', saveResult); // 添加调试信息
  writeLog('保存设置结果', { result: saveResult });
  
  if (!saveResult) {
    console.error('保存设置到文件失败');
    writeLog('保存设置到文件失败');
    throw new Error('保存设置到文件失败');
  }
  
  // 如果日志设置改变，重新初始化日志系统
  if (oldEnableLogging !== settings.enableLogging) {
    if (settings.enableLogging) {
      initLogging();
    } else {
      logFile = null; // 禁用日志文件
    }
  }
  
  // 如果调试模式设置改变，且日志功能已启用，重新初始化日志系统
  if (oldSettings.debugMode !== settings.debugMode && settings.enableLogging) {
    writeLog('[DEBUG] 调试模式设置已改变，重新初始化日志系统', { 
      oldDebugMode: oldSettings.debugMode, 
      newDebugMode: settings.debugMode 
    });
    initLogging();
  }
  
  // 重启壁纸切换定时器
  startWallpaperTimer();
  
  // 如果屏保时间设置改变，或启用屏保功能状态改变，重启空闲检测
  if (oldLockTime !== settings.lockTime || oldEnableLockScreen !== settings.enableLockScreen) {
    startIdleDetection();
  }
  
  // 通知屏保窗口更新设置
  if (screenSaverWindow) {
    screenSaverWindow.webContents.send('update-settings', settings);
  }
  
  writeLog('设置应用完成', { oldSettings, newSettings: settings });
}

// 当Electron准备就绪时创建窗口
app.whenReady().then(() => {
  console.log('Electron应用准备就绪');
  // 隐藏默认菜单栏
  Menu.setApplicationMenu(null);
  
  // 先读取设置
  settings = readSettings();
  console.log('读取到的设置:', settings);
  
  // 检查是否启用了记住退出选择
  if (settings.rememberExitChoice && settings.lastExitChoice) {
    console.log('检测到记住退出选择功能已启用，上次选择为:', settings.lastExitChoice);
    // 重要：不要在这里执行任何自动操作，这应该只在用户明确点击关闭按钮时处理
    // 为了调试，我们记录这个信息，但不执行任何操作
    
    // 添加额外的调试信息
    console.log('记住退出选择调试信息:', {
      rememberExitChoice: settings.rememberExitChoice,
      lastExitChoice: settings.lastExitChoice,
      typeofLastExitChoice: typeof settings.lastExitChoice
    });
    
    // 重要：不要在这里自动隐藏窗口或退出应用，这应该只在用户明确点击关闭按钮时处理
    console.log('警告：检测到记住退出选择功能，但不会自动执行任何操作');
    
    // 添加额外的检查，确保不会自动执行任何操作
    console.log('再次确认：不会根据记住的退出选择自动退出应用');
  } else {
    console.log('记住退出选择功能未启用或没有上次选择记录');
  }
  // 初始化日志系统
  initLogging();
  writeLog('应用启动');
  writeLog('[DEBUG] 调试模式状态', { debugMode: settings.debugMode });
  
  // 检查命令行参数
  const args = process.argv.slice(2); // 从索引2开始，因为Electron会在索引0和1添加自己的参数
  console.log('启动参数:', args);
  
  // 添加调试信息，检查程序是否正常执行到此处
  console.log('程序正常执行到创建窗口前');
  
  // 检查是否有任何意外的参数可能导致程序行为异常
  if (args.length > 1) {
    console.log('检测到多个启动参数，可能影响程序行为');
  }
  
  // 检查是否包含.Rwapr文件参数
  const rwaprFileArg = args.find(arg => arg.endsWith('.rwapr'));
  if (rwaprFileArg) {
    console.log('检测到.Rwapr文件参数:', rwaprFileArg);
    // 如果有.Rwapr文件参数，先导入文件，然后打开可视化编辑器
    handleRwaprFileImport(rwaprFileArg);
    return;
  }
  
  // 检查是否包含API测试参数（优先检查）
  const isApiTestMode = args.some(arg => 
    arg.includes('api-test') || arg.includes('testapi')
  );
  
  // 检查是否包含屏保参数（排除API测试参数）
  const isScreensaverMode = !isApiTestMode && args.some(arg => 
    arg.includes('screensaver') || 
    arg.includes('/s') || 
    arg.includes('lock-screen') ||
    arg === 'test' // 精确匹配test参数，避免误判testapi为test
  );
  
  // 检查是否包含帮助参数
  const isHelpMode = args.some(arg => 
    arg.includes('help')
  );
  
  if (isScreensaverMode) {
    // 如果有屏保参数，直接创建锁屏窗口
    console.log('以屏保模式启动');
    createScreenSaver();
  } else if (isApiTestMode) {
    // 如果有API测试参数，打开API测试窗口
    console.log('以API测试模式启动');
    const { BrowserWindow } = require('electron');
    const apiTestWindow = new BrowserWindow({
      width: 800,
      height: 600,
      icon: path.join(__dirname, 'Assets', 'Icons', 'app-icon.ico'), // 设置应用程序图标
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
      });
    apiTestWindow.loadFile('test-api.html');
  } else if (isHelpMode) {
    // 如果有帮助参数，打开帮助窗口
    console.log('以帮助模式启动');
    const { BrowserWindow } = require('electron');
    const helpWindow = new BrowserWindow({
      width: 800,
      height: 600,
      icon: path.join(__dirname, 'Assets', 'Icons', 'app-icon.ico'), // 设置应用程序图标
      frame: false, // 隐藏默认窗口边框
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
  
    // 隐藏菜单栏
    helpWindow.setMenuBarVisibility(false);
  
    helpWindow.loadFile('help.html');
  
    // 当窗口加载完成时，发送当前主题设置
    helpWindow.webContents.once('dom-ready', () => {
      if (helpWindow && !helpWindow.isDestroyed()) {
        helpWindow.webContents.send('apply-theme', settings.theme || 'light');
      }
    });
  } else {
    // 否则创建主窗口并显示
    console.log('以普通模式启动');
    createWindow();
    console.log('createWindow函数执行完成');
    if (mainWindow) {
      console.log('准备显示主窗口');
      mainWindow.show();
      console.log('主窗口显示完成');
    } else {
      console.log('mainWindow未创建成功');
    }
  }
  
  // 创建系统托盘
  createTray();
  console.log('系统托盘创建完成');
  
  // 启动壁纸切换定时器
  startWallpaperTimer();
  console.log('壁纸切换定时器启动完成');
  
  // 启动空闲检测
  startIdleDetection();
  console.log('空闲检测启动完成');
  
  // 添加最终调试信息，确认程序启动完成
  console.log('程序启动完成，所有初始化操作已完成');
  
  // 检查启动时的设置状态
  console.log('启动时的设置状态检查:', {
    rememberExitChoice: settings.rememberExitChoice,
    lastExitChoice: settings.lastExitChoice
  });
  
  // 添加定时器检查程序状态
  setInterval(() => {
    console.log('程序运行状态检查:', {
      appReady: app.isReady(),
      mainWindowExists: !!mainWindow,
      mainWindowVisible: mainWindow ? !mainWindow.isDestroyed() : false,
      trayExists: !!tray
    });
    
    // 添加更详细的窗口状态检查
    if (mainWindow) {
      try {
        console.log('主窗口详细状态:', {
          isVisible: mainWindow.isVisible(),
          isDestroyed: mainWindow.isDestroyed(),
          isMinimized: mainWindow.isMinimized(),
          bounds: mainWindow.getBounds()
        });
      } catch (error) {
        console.log('获取主窗口状态时出错:', error.message);
      }
    }
    
    // 检查是否有意外的退出调用
    console.log('定时检查: 程序仍在运行中');
  }, 10000); // 每10秒检查一次
  
  // 添加更频繁的检查，以便更好地追踪问题
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('快速检查: 主窗口状态正常');
    }
  }, 1000); // 每秒检查一次
});

// 添加处理.Rwapr文件导入的函数
async function handleRwaprFileImport(filePath) {
  try {
    writeLog('处理.Rwapr文件导入', { filePath });
    
    // 读取文件内容
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const rwaprData = JSON.parse(fileContent);
    
    // 验证文件格式
    if (!rwaprData.version || !rwaprData.settings) {
      throw new Error('无效的.Rwapr文件格式');
    }
    
    // 读取当前设置
    const currentSettings = readSettings();
    
    // 合并设置（使用导入的设置覆盖当前设置）
    const mergedSettings = {
      ...currentSettings,
      ...rwaprData.settings
    };
    
    // 保存设置
    const saveResult = saveSettings(mergedSettings);
    
    if (saveResult) {
      // 更新全局设置变量
      settings = mergedSettings;
      writeLog('.Rwapr文件导入成功', { filePath: filePath });
      
      // 打开主窗口
      if (!mainWindow) {
        createWindow();
      }
      if (mainWindow) {
        mainWindow.show();
      }
    } else {
      throw new Error('保存设置失败');
    }
  } catch (error) {
    console.error('处理.Rwapr文件导入失败:', error);
    writeLog('处理.Rwapr文件导入失败', { error: error.message });
    
    // 即使导入失败，也打开主窗口
    if (!mainWindow) {
      createWindow();
    }
    if (mainWindow) {
      mainWindow.show();
    }
  }
}

// 添加打开外部链接的处理程序
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('打开外部链接失败:', error);
    return { success: false, error: error.message };
  }
});

// 监听应用退出
app.on('before-quit', () => {
  console.log('应用退出事件被触发');
  app.quitting = true;
  console.log('应用退出状态已设置');
});

// 当所有窗口关闭时，最小化到托盘而不是退出应用
app.on('window-all-closed', () => {
  console.log('所有窗口关闭事件被触发');
  // 不退出应用，保持在系统托盘中运行
  console.log('应用将继续运行在系统托盘中');
});

// 添加Windows消息处理，支持系统屏保启动
if (process.platform === 'win32') {
  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    // 如果已经有一个实例在运行，退出当前实例
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // 当尝试启动第二个实例时，显示主窗口
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      } else {
        createWindow();
      }
    });
  }
}

// 添加一个防抖函数，避免频繁保存
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 防抖保存设置函数，500ms内只保存一次
const debouncedSaveSettings = debounce((newSettings) => {
  console.log('防抖保存设置:', newSettings);
  applySettings(newSettings);
}, 500);

// 修改保存设置的函数，使其返回Promise以支持异步操作
function saveSettingsAsync(newSettings) {
  return new Promise((resolve) => {
    try {
      console.log('接收到保存设置请求:', newSettings);
      writeLog('IPC: 保存设置请求', { newSettings });
      
      // 直接应用设置而不使用防抖，确保立即保存并返回结果
      applySettings(newSettings);
      console.log('设置保存成功');
      writeLog('IPC: 设置保存成功');
      resolve({ success: true });
    } catch (error) {
      console.error('保存设置失败:', error);
      writeLog('IPC: 保存设置失败', { error: error.message });
      resolve({ success: false, error: error.message });
    }
  });
}

// IPC 处理程序
ipcMain.handle('get-settings', () => {
  writeLog('IPC: 获取设置');
  return settings;
});

ipcMain.handle('save-settings', async (event, newSettings) => {
  try {
    // 直接调用同步保存函数并等待结果
    const result = await saveSettingsAsync(newSettings);
    return result;
  } catch (error) {
    console.error('保存设置失败:', error);
    writeLog('IPC: 保存设置失败', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-wallpaper', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, filePath: result.filePaths[0] };
  }
  
  return { success: false };
});

// 添加选择多张图片的处理程序
ipcMain.handle('select-multiple-wallpapers', async () => {
  console.log('打开多张图片选择对话框');
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
    ],
    title: '选择多张图片作为本地壁纸',
    buttonLabel: '选择图片',
    // 确保允许多选
    multiSelections: true
  });
  console.log('选择图片对话框结果:', result);
  
  // 添加更多调试信息
  console.log('结果类型:', typeof result);
  console.log('结果属性:', Object.keys(result));
  console.log('是否取消:', result.canceled);
  console.log('文件路径数量:', result.filePaths ? result.filePaths.length : 0);
  if (result.filePaths) {
    console.log('文件路径列表:', result.filePaths);
  }
  
  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    console.log('返回成功结果');
    return { success: true, filePaths: result.filePaths };
  }
  
  console.log('返回失败结果');
  return { success: false };
});

// 添加将本地文件路径转换为URL的处理程序
ipcMain.handle('convert-file-path-to-url', (event, filePath) => {
  try {
    // 使用Electron的协议将文件路径转换为file:// URL
    const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
    return { success: true, url: fileUrl };
  } catch (error) {
    console.error('转换文件路径失败:', error);
    return { success: false, error: error.message };
  }
});

// 添加获取本地壁纸设置的处理程序
ipcMain.handle('get-local-wallpapers', async () => {
  try {
    const settings = readSettings();
    if (settings.localWallpapers) {
      const localWallpaperPaths = settings.localWallpapers.split(';').filter(path => path.trim() !== '');
      return { success: true, localWallpapers: localWallpaperPaths };
    }
    return { success: true, localWallpapers: [] };
  } catch (error) {
    console.error('获取本地壁纸设置失败:', error);
    return { success: false, error: error.message };
  }
});

// 添加打开日志文件夹的处理程序
ipcMain.handle('open-logs-folder', async () => {
  try {
    writeLog('IPC: 打开日志文件夹请求');
    // 确保日志目录存在
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    // 打开日志文件夹
    shell.openPath(logDir);
    writeLog('IPC: 日志文件夹已打开');
    return { success: true };
  } catch (error) {
    console.error('打开日志文件夹失败:', error);
    writeLog('IPC: 打开日志文件夹失败', { error: error.message });
    return { success: false, error: error.message };
  }
});

// 添加启动空闲检测的处理程序
ipcMain.handle('start-idle-detection', () => {
  writeLog('IPC: 启动空闲检测请求');
  startIdleDetection();
  writeLog('IPC: 空闲检测已启动');
  return { success: true };
});

ipcMain.handle('lock-screen', () => {
  createScreenSaver();
});

ipcMain.handle('unlock-screen', () => {
  closeScreenSaver();
});

ipcMain.handle('get-wallpaper', async () => {
  try {
    const wallpaperUrl = await getWallpaperUrl(settings.wallpaperKeyword);
    return wallpaperUrl;
  } catch (error) {
    console.error('获取壁纸失败:', error);
    return '';
  }
});

ipcMain.handle('open-api-test', () => {
  const apiTestWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'Assets', 'Icons', 'app-icon.ico'), // 设置应用程序图标
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  apiTestWindow.loadFile('test-api.html');
});

// 添加帮助窗口处理程序
ipcMain.handle('open-help', () => {
  const helpWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'Assets', 'Icons', 'app-icon.ico'), // 设置应用程序图标
    frame: false, // 隐藏默认窗口边框
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  // 隐藏菜单栏
  helpWindow.setMenuBarVisibility(false);
  
  helpWindow.loadFile('help.html');
  
  // 当窗口加载完成时，发送当前主题设置
  helpWindow.webContents.once('dom-ready', () => {
    if (helpWindow && !helpWindow.isDestroyed()) {
      helpWindow.webContents.send('apply-theme', settings.theme || 'light');
    }
  });
});

// 添加关于窗口处理程序
ipcMain.handle('open-about', () => {
  const aboutWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: true,
    fullscreenable: true,
    icon: path.join(__dirname, 'Assets', 'Icons', 'app-icon.ico'), // 设置应用程序图标
    frame: false, // 隐藏默认窗口边框
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  // 隐藏菜单栏
  aboutWindow.setMenuBarVisibility(false);
  
  aboutWindow.loadFile('about.html');
});

// 添加可视化编辑窗口处理程序
ipcMain.handle('open-visual-editor', () => {
  // 创建一个小窗模式的屏保窗口
  const visualEditorWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: true,
    fullscreenable: false,
    icon: path.join(__dirname, 'Assets', 'Icons', 'app-icon.ico'), // 设置应用程序图标
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  // 隐藏菜单栏
  visualEditorWindow.setMenuBarVisibility(false);
  
  // 加载屏保界面
  visualEditorWindow.loadFile('screensaver.html');
  
  // 监听窗口关闭事件
  visualEditorWindow.on('closed', () => {
    // 清理引用
    // 注意：这里不能直接设置visualEditorWindow = null，因为它是局部变量
  });
  
  // 添加刷新功能
  visualEditorWindow.webContents.on('did-finish-load', () => {
    // 注入刷新功能的JavaScript代码
    visualEditorWindow.webContents.executeJavaScript(`
      // 添加刷新按钮
      const refreshButton = document.createElement('div');
      refreshButton.innerHTML = '<button id="refreshButton" style="position: fixed; top: 10px; right: 10px; z-index: 9999; background: rgba(0,0,0,0.5); color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">刷新</button>';
      document.body.appendChild(refreshButton);
      
      // 绑定刷新事件
      document.getElementById('refreshButton').addEventListener('click', () => {
        location.reload();
      });
    `);
  });
  
  // 返回窗口对象以便后续操作
  return visualEditorWindow;
});

// 添加导出.Rwapr文件的处理程序
ipcMain.handle('export-rwapr-file', async () => {
  try {
    writeLog('IPC: 导出.Rwapr文件请求');
    
    // 读取当前设置
    const currentSettings = readSettings();
    
    // 创建.Rwapr文件内容
    const rwaprContent = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      settings: currentSettings
    };
    
    // 打开保存对话框
    const result = await dialog.showSaveDialog({
      title: '导出.Rwapr文件',
      defaultPath: 'screen-settings.rwapr',
      filters: [
        { name: 'Ruanm屏保配置文件', extensions: ['rwapr'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      // 写入文件
      fs.writeFileSync(result.filePath, JSON.stringify(rwaprContent, null, 2));
      writeLog('IPC: .Rwapr文件导出成功', { filePath: result.filePath });
      return { success: true, filePath: result.filePath };
    } else {
      writeLog('IPC: .Rwapr文件导出被取消');
      return { success: false, error: '用户取消了导出操作' };
    }
  } catch (error) {
    console.error('导出.Rwapr文件失败:', error);
    writeLog('IPC: 导出.Rwapr文件失败', { error: error.message });
    return { success: false, error: error.message };
  }
});

// 添加导入.Rwapr文件的处理程序
ipcMain.handle('import-rwapr-file', async () => {
  try {
    writeLog('IPC: 导入.Rwapr文件请求');
    
    // 打开文件选择对话框
    const result = await dialog.showOpenDialog({
      title: '导入.Rwapr文件',
      filters: [
        { name: 'Ruanm屏保配置文件', extensions: ['rwapr'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      
      // 读取文件内容
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const rwaprData = JSON.parse(fileContent);
      
      // 验证文件格式
      if (!rwaprData.version || !rwaprData.settings) {
        throw new Error('无效的.Rwapr文件格式');
      }
      
      // 读取当前设置
      const currentSettings = readSettings();
      
      // 合并设置（使用导入的设置覆盖当前设置）
      const mergedSettings = {
        ...currentSettings,
        ...rwaprData.settings
      };
      
      // 保存设置
      const saveResult = saveSettings(mergedSettings);
      
      if (saveResult) {
        // 更新全局设置变量
        settings = mergedSettings;
        writeLog('IPC: .Rwapr文件导入成功', { filePath: filePath });
        return { success: true, settings: mergedSettings };
      } else {
        throw new Error('保存设置失败');
      }
    } else {
      writeLog('IPC: .Rwapr文件导入被取消');
      return { success: false, error: '用户取消了导入操作' };
    }
  } catch (error) {
    console.error('导入.Rwapr文件失败:', error);
    writeLog('IPC: 导入.Rwapr文件失败', { error: error.message });
    return { success: false, error: error.message };
  }
});

// 添加获取任务计划设置说明的处理程序
ipcMain.handle('get-task-schedule-info', () => {
  const exePath = process.execPath;
  const taskName = "RuanmScreensaver";
  
  return {
    taskName: taskName,
    command: `schtasks /create /tn "${taskName}" /tr "\"${exePath}\" \"--screensaver\"" /sc minute /mo [分钟数] /f`,
    description: `请以管理员身份打开命令提示符(CMD)，然后执行以下命令来设置自动屏保：\n\n${exePath} --screensaver`
  };
});

// 添加获取系统字体的处理程序
ipcMain.handle('get-system-fonts', async () => {
  try {
    const fonts = await fontList.getFonts();
    // font-list 返回的字体名称带有引号，需要去掉
    const cleanFonts = fonts.map(font => font.replace(/^['"]|['"]$/g, ''));
    return { success: true, fonts: cleanFonts };
  } catch (error) {
    console.error('获取系统字体失败:', error);
    return { success: false, error: error.message };
  }
});

// 添加开机自启动设置的处理程序
ipcMain.handle('toggle-auto-start', async () => {
  try {
    // 检查当前是否已设置开机自启动
    const loginItemSettings = app.getLoginItemSettings();
    const isOpenAtLogin = loginItemSettings.openAtLogin;
    
    // 获取正确的应用程序路径
    let appPath = app.getPath('exe');
    
    // 检查是否是开发环境（Electron开发服务器路径）
    if (appPath.includes('node_modules') && appPath.includes('electron')) {
      // 在开发环境中，使用打包后的应用程序路径
      const appName = 'Ruanm Screensaver.exe';
      const distPath = path.join(process.cwd(), 'dist', 'win-unpacked', appName);
      
      // 检查打包后的应用程序是否存在
      if (fs.existsSync(distPath)) {
        appPath = distPath;
        console.log('使用打包后的应用程序路径:', appPath);
        writeLog('使用打包后的应用程序路径', { path: appPath });
      } else {
        // 如果打包后的应用程序不存在，给出警告
        console.warn('警告：未找到打包后的应用程序，将使用开发环境路径');
        writeLog('警告：未找到打包后的应用程序，将使用开发环境路径', { devPath: appPath });
      }
    } else {
      // 在生产环境中，直接使用当前exe路径
      console.log('使用生产环境应用程序路径:', appPath);
      writeLog('使用生产环境应用程序路径', { path: appPath });
    }
    
    // 根据当前状态切换开机自启动设置
    if (isOpenAtLogin) {
      // 当前已设置开机自启动，需要取消
      console.log('正在取消开机自启动设置');
      app.setLoginItemSettings({
        openAtLogin: false,
        path: appPath,
        args: [
          '--process-startup-channel=ruanm-screensaver-startup'
        ]
      });
    } else {
      // 当前未设置开机自启动，需要设置
      console.log('正在设置开机自启动');
      app.setLoginItemSettings({
        openAtLogin: true,
        path: appPath,
        args: [
          '--process-startup-channel=ruanm-screensaver-startup'
        ]
      });
    }
    
    // 添加一个小延时确保设置生效
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 返回操作结果
    const newLoginItemSettings = app.getLoginItemSettings();
    const newIsOpenAtLogin = newLoginItemSettings.openAtLogin;
    
    // 根据操作后的状态返回相应的消息
    if (newIsOpenAtLogin) {
      return { success: true, message: '已成功设置为开机自启动！', isOpenAtLogin: newIsOpenAtLogin };
    } else {
      return { success: true, message: '已成功取消开机自启动！', isOpenAtLogin: newIsOpenAtLogin };
    }
  } catch (error) {
    console.error('设置开机自启动失败:', error);
    writeLog('设置开机自启动失败', { error: error.message });
    return { success: false, error: error.message };
  }
});

// 添加获取开机自启动状态的处理程序
ipcMain.handle('get-auto-start-status', () => {
  try {
    const loginItemSettings = app.getLoginItemSettings();
    return { 
      success: true, 
      isOpenAtLogin: loginItemSettings.openAtLogin,
      status: loginItemSettings
    };
  } catch (error) {
    console.error('获取开机自启动状态失败:', error);
    return { success: false, error: error.message };
  }
});

// 添加窗口控制的IPC处理程序
ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// 添加处理关闭对话框的IPC处理程序
let closeDialogWindow = null;

ipcMain.handle('exit-app', () => {
  // 关闭对话框窗口
  if (closeDialogWindow) {
    closeDialogWindow.destroy();
    closeDialogWindow = null;
  }
  // 退出应用
  app.quit();
});

ipcMain.handle('minimize-to-tray', () => {
  // 关闭对话框窗口
  if (closeDialogWindow) {
    closeDialogWindow.destroy();
    closeDialogWindow = null;
  }
  // 隐藏主窗口
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.handle('close-dialog', () => {
  // 关闭对话框窗口
  if (closeDialogWindow) {
    closeDialogWindow.destroy();
    closeDialogWindow = null;
  }
});

// 监听主题变更消息并广播到所有窗口
ipcMain.on('theme-changed', (event, theme) => {
  // 保存主题设置到配置文件
  if (settings) {
    settings.theme = theme;
    saveSettings(settings);
  }
  
  // 广播主题变更到所有打开的窗口
  if (mainWindow) {
    mainWindow.webContents.send('apply-theme', theme);
  }
  
  if (screenSaverWindow) {
    screenSaverWindow.webContents.send('apply-theme', theme);
  }
  
  // 注意：帮助窗口和关于窗口是独立的窗口，需要在它们的代码中处理主题变更
});

// 添加检查更新的处理程序
ipcMain.handle('check-for-updates', async () => {
  try {
    writeLog('IPC: 检查更新请求');
    
    // 向更新服务器发送请求
    const updateUrl = 'https://ruanmingze.github.io/Ruanm-Product-Update/RuanmScreensaver-Update.json';
    const response = await axios.get(updateUrl, { timeout: 10000 });
    
    if (response.status === 200 && response.data) {
      const updateInfo = response.data;
      const currentVersion = '1.0.2'; // 当前版本号
      
      // 比较版本号
      const hasUpdate = updateInfo.version > currentVersion;
      
      writeLog('IPC: 检查更新完成', { 
        currentVersion, 
        latestVersion: updateInfo.version, 
        hasUpdate 
      });
      
      return {
        success: true,
        hasUpdate,
        latestVersion: updateInfo.version,
        updateContent: updateInfo.updateContent || [],
        downloadUrl: updateInfo.download ? updateInfo.download.zip : ''
      };
    } else {
      throw new Error('Invalid response from update server');
    }
  } catch (error) {
    console.error('检查更新失败:', error);
    writeLog('IPC: 检查更新失败', { error: error.message });
    return { success: false, error: error.message };
  }
});

// 添加执行更新的处理程序
ipcMain.handle('perform-update', async (event, downloadUrl) => {
  try {
    writeLog('IPC: 执行更新请求', { downloadUrl });
    
    if (!downloadUrl) {
      throw new Error('下载链接无效');
    }
    
    // 创建临时目录用于下载更新文件
    const tempDir = path.join(app.getPath('temp'), 'RuanmScreensaver_Update');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // 下载ZIP文件
    const zipFilePath = path.join(tempDir, 'RuanmScreensaver.zip');
    const writer = fs.createWriteStream(zipFilePath);
    
    const downloadResponse = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 30000
    });
    
    downloadResponse.data.pipe(writer);
    
    // 等待下载完成
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    writeLog('IPC: 更新文件下载完成', { zipFilePath });
    
    // 启动C#更新程序
    const updateExePath = path.join(__dirname, 'Assets', 'UpdateHelper.exe');
    
    if (fs.existsSync(updateExePath)) {
      // 启动更新程序，传入ZIP文件路径和当前应用路径
      const currentAppPath = app.getAppPath();
      const child = require('child_process').execFile;
      child(updateExePath, [zipFilePath, currentAppPath], (error, stdout, stderr) => {
        if (error) {
          console.error('更新程序执行失败:', error);
          writeLog('IPC: 更新程序执行失败', { error: error.message });
        } else {
          writeLog('IPC: 更新程序执行成功', { stdout, stderr });
        }
      });
      
      return { success: true, message: '正在下载并安装更新...' };
    } else {
      // 如果没有C#更新程序，提示用户手动下载
      shell.openExternal(downloadUrl);
      return { success: true, message: '正在打开下载链接，请手动下载并安装更新。' };
    }
  } catch (error) {
    console.error('执行更新失败:', error);
    writeLog('IPC: 执行更新失败', { error: error.message });
    return { success: false, error: error.message };
  }
});

// 添加启动GUI更新程序的处理程序
ipcMain.handle('launch-update-gui', async () => {
  try {
    writeLog('IPC: 启动GUI更新程序');
    
    // 启动C# GUI更新程序
    const updateExePath = path.join(__dirname, 'Assets', 'UpdateHelper.exe');
    
    if (fs.existsSync(updateExePath)) {
      // 启动更新程序，不传递参数（让它自己检查更新）
      const child = require('child_process').execFile;
      child(updateExePath, [], (error, stdout, stderr) => {
        if (error) {
          console.error('GUI更新程序启动失败:', error);
          writeLog('IPC: GUI更新程序启动失败', { error: error.message });
        } else {
          writeLog('IPC: GUI更新程序启动成功', { stdout, stderr });
        }
      });
      
      return { success: true, message: '正在启动更新程序...' };
    } else {
      return { success: false, error: '更新程序未找到' };
    }
  } catch (error) {
    console.error('启动GUI更新程序失败:', error);
    writeLog('IPC: 启动GUI更新程序失败', { error: error.message });
    return { success: false, error: error.message };
  }
});
