@echo off
REM Ruanm Screensaver Command Line Interface
REM 用法: RuanmScreensaver [options]

setlocal

REM 获取脚本的完整路径
set "SCRIPT_PATH=%~f0"
REM 获取脚本所在目录
for %%i in ("%SCRIPT_PATH%") do set "BIN_DIR=%%~dpi"
REM 移除末尾的反斜杠
set "BIN_DIR=%BIN_DIR:~0,-1%"
REM 获取应用程序根目录（bin目录的上级目录）
set "APP_ROOT=%BIN_DIR%\.."

REM 解析命令行参数
if /i "%1"=="help" goto :show_help
if /i "%1"=="-h" goto :show_help
if /i "%1"=="/?" goto :show_help
if /i "%1"=="version" goto :show_version
if /i "%1"=="-v" goto :show_version
if /i "%1"=="gui" goto :run_gui
if /i "%1"=="test" goto :test_screensaver
if /i "%1"=="lock-screen" goto :lock_screen
if /i "%1"=="screensaver" goto :lock_screen
if /i "%1"=="settings" goto :open_settings
if /i "%1"=="api-test" goto :api_test
if /i "%1"=="help-page" goto :help_page
if /i "%1"=="changesettings" goto :change_settings

REM 默认运行GUI
goto :run_gui

:test_screensaver
REM 测试屏保
cd /d "%APP_ROOT%" 2>nul
npx electron . test 2>nul
if errorlevel 1 (
    echo 无法启动屏保测试，请确保已安装Electron并正确配置环境。
)
goto :eof

:lock_screen
REM 启动屏保
cd /d "%APP_ROOT%" 2>nul
npx electron . screensaver 2>nul
if errorlevel 1 (
    echo 无法启动屏保，请确保已安装Electron并正确配置环境。
)
goto :eof

:open_settings
REM 打开设置界面
cd /d "%APP_ROOT%" 2>nul
npx electron . 2>nul
if errorlevel 1 (
    echo 无法打开设置界面，请确保已安装Electron并正确配置环境。
)
goto :eof

:api_test
REM 打开API测试界面
cd /d "%APP_ROOT%" 2>nul
npx electron . api-test 2>nul
if errorlevel 1 (
    echo 无法打开API测试界面，请确保已安装Electron并正确配置环境。
)
goto :eof

:help_page
REM 打开帮助页面
cd /d "%APP_ROOT%" 2>nul
npx electron . help 2>nul
if errorlevel 1 (
    echo 无法打开帮助页面，请确保已安装Electron并正确配置环境。
)
goto :eof

:change_settings
REM 更改设置
shift
set "setting_value=%1=%2"
REM 切换到应用程序根目录
cd /d "%APP_ROOT%" 2>nul
node -e "const fs=require('fs');const path=require('path');const settingsPath=path.join(process.cwd(), 'settings.json');let settings={enableLockScreen:false,lockTime:5,lockTimeUnit:'minute',wallpaperChangeTime:10,wallpaperChangeTimeUnit:'minute',wallpaperKeyword:'random',timeFontSize:80,dateFontSize:30,timePosition:'bottom-left',datePosition:'bottom-left',timeColor:'#FFFFFF',timeFontFamily:'Arial',dateFontFamily:'Arial',showAdvertisement:false,enableLogging:true,theme:'light'};if(fs.existsSync(settingsPath)){const existing=fs.readFileSync(settingsPath,'utf8');if(existing.trim()){settings=Object.assign(settings,JSON.parse(existing));}}const setting=process.argv[1].split('=');if(setting.length===2){const key=setting[0].trim();const value=setting[1].trim();if(value==='true'||value==='false'){settings[key]=value==='true';}else if(!isNaN(value)&&value!==''){settings[key]=Number(value);}else{settings[key]=value;}fs.writeFileSync(settingsPath,JSON.stringify(settings,null,2));console.log('设置已更新: '+key+' = '+settings[key]);}else{console.log('用法: RuanmScreensaver changesettings key=value');}" "%setting_value%" 2>nul
if errorlevel 1 (
    echo 设置更新失败，请确保应用程序已正确安装。
)
goto :eof

:show_version
echo Ruanm Screensaver 版本 1.0.0
goto :eof

:show_help
echo Ruanm Screensaver 命令行工具
echo.
echo 用法: RuanmScreensaver [选项]
echo.
echo 选项:
echo   help, -h, /?       显示此帮助信息
echo   version, -v        显示版本信息
echo   gui                启动图形界面设置 (默认)
echo   test               测试屏保功能
echo   lock-screen        启动屏保
echo   screensaver        启动屏保 (同 lock-screen)
echo   settings           打开设置界面
echo   api-test           打开API测试界面
echo   help-page          打开帮助页面
echo   changesettings     更改设置 (语法: RuanmScreensaver changesettings key=value)
echo.
echo 示例:
echo   RuanmScreensaver              启动图形界面设置
echo   RuanmScreensaver test         测试屏保功能
echo   RuanmScreensaver lock-screen  启动屏保
echo   RuanmScreensaver version      显示版本信息
echo   RuanmScreensaver changesettings lockTime=10  设置锁屏时间为10分钟
echo   RuanmScreensaver changesettings enableLockScreen=true  启用锁屏功能
goto :eof

:run_gui
REM 启动图形界面
cd /d "%APP_ROOT%" 2>nul
npx electron . 2>nul
if errorlevel 1 (
    echo 无法启动图形界面，请确保已安装Electron并正确配置环境。
    echo 尝试使用 npm start 命令启动应用。
)
goto :eof