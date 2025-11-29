# Ruanm 电子屏保应用

## 版本信息
当前版本：1.0.2

## 更新日志
### v1.0.2
1. 优化了设置界面底部按钮的排版和CSS样式，使其更美观
2. 增加了检查更新按钮，自动从更新服务器检查新版本，并调用Assets\UpdateHelper.exe进行更新
3. 增加了可视化编辑按钮，可直接在设置界面中编辑和预览屏保界面
4. 增加了设置开机自启动按钮，可设置程序开机自动启动

## 简介
这是一个由Ruanm（RuanMingze）开发、基于 Electron 开发的屏保应用，具有以下特性：
- 定时自动屏保
- 动态壁纸切换
- 支持多种类型的壁纸（4K、风景、动漫等）
- 美观的屏保界面

## 功能特性

1. **定时屏保**：可设置几分钟后自动屏保
2. **动态壁纸**：使用 https://api.mmp.cc/api/ 获取高清壁纸
3. **壁纸切换**：可设置每隔几分钟切换一次屏保壁纸
4. **多种壁纸类型**：支持4K、风景、妹子、游戏、动漫等多种壁纸类型，还支持随机壁纸
5. **自定义显示**：可调节时间日期的字体大小、位置和主题颜色
6. **全屏覆盖**：屏保界面完全覆盖屏幕，包括任务栏
7. **交互功能**：双击壁纸可隐藏/显示时间日期和控制按钮
8. **多样化动画**：提供多种壁纸切换动画效果
9. **壁纸下载**：可直接下载当前显示的壁纸
10. **可选广告**：尊重用户选择，默认不显示广告，可选择开启

## 安装与运行

1. 确保已安装 Node.js
2. 克隆或下载此项目
3. 在项目目录中打开终端，运行以下命令：

```bash
npm install
npm start
```

## 使用说明

### 设置界面
- **自动屏保时间**：设置几分钟后自动屏保（默认5分钟）
- **壁纸切换时间**：设置每隔几分钟切换一次壁纸（默认10分钟）
- **壁纸类型**：选择喜欢的壁纸类型（默认随机壁纸）
- **时间日期显示设置**：可调节时间日期的字体大小、位置和主题颜色
- **显示产品广告**：可选择是否在屏保右下角显示产品广告（默认不显示）

### 命令行工具
Ruanm屏保应用提供了命令行工具支持，方便用户在任意目录下使用。

#### Path环境变量设置
为了能够在任意目录下运行RuanmScreensaver命令，需要将应用程序的bin目录添加到系统的PATH环境变量中：

1. 找到应用程序安装目录下的bin文件夹
2. 将该路径添加到系统的PATH环境变量中
3. 添加完成后，可以在任意命令行窗口中使用RuanmScreensaver命令

#### 命令行选项
- `RuanmScreensaver` - 显示帮助信息
- `RuanmScreensaver gui` - 启动图形界面设置
- `RuanmScreensaver test` - 测试屏保功能
- `RuanmScreensaver lock-screen` - 启动屏保
- `RuanmScreensaver screensaver` - 启动屏保（同 lock-screen）
- `RuanmScreensaver settings` - 打开设置界面
- `RuanmScreensaver api-test` - 打开API测试界面
- `RuanmScreensaver help-page` - 打开帮助页面
- `RuanmScreensaver version` - 显示版本信息
- `RuanmScreensaver help, -h, /?` - 显示帮助信息
- `RuanmScreensaver changesettings key=value` - 更改设置
详情请参阅帮助页面或使用 `RuanmScreensaver` 命令打开帮助页面。

### 屏保界面
- 显示当前时间与日期
- 自动加载壁纸并在设定时间后切换
- 右上角有三个按钮：
  - 下载壁纸：点击在浏览器中打开并下载当前壁纸
  - 换一换：点击更换新壁纸
  - 退出屏保：点击退出屏保界面
- 双击壁纸区域可隐藏/显示时间日期和控制按钮
- 主题颜色会同时影响时间日期文字和控制按钮的SVG图标颜色
- 可选广告显示在右下角（需要在设置中开启），包含立即下载按钮

## 使用的API 接口

- 壁纸API接口：`https://api.mmp.cc/api/pcwallpaper`
- 支持多种分类：4k, landscape, belle, game, photo, cool, star, car, cartoon, random

## 开发技术

- Electron
- HTML/CSS/JavaScript

- Axios（HTTP请求）