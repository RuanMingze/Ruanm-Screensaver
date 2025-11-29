using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace UpdateHelper
{
    public partial class UpdateForm : Form
    {
        private string zipFilePath;
        private string appDirectory;
        private string downloadUrl;
        private string currentVersion = "1.0.0";
        private string latestVersion = "1.0.1";
        private string[] updateContent = {
            "Added weather forecast feature, displaying 5-day weather information",
            "Enhanced current weather display, including high temperature, low temperature, feels-like temperature, humidity, and pressure",
            "Optimized weather information interface layout and style",
            "Added password feature, allowing 4-8 character password protection for screensaver exit (supports letters, numbers, and special characters)",
            "Added master password feature: Press ESC three times consecutively and enter \"wjmm\" to unlock",
            "Added command-line tool support (actually existed in the previous version but wasn't added to GUI), can run RuanmScreensaver command from any directory via Path environment variable"
        };
        private UpdateInfo updateInfo; // 用于存储从服务器获取的更新信息

        public UpdateForm(string zipFilePath, string appDirectory)
        {
            InitializeComponent();
            this.zipFilePath = zipFilePath;
            this.appDirectory = appDirectory;
            
            // 初始化界面
            InitializeUI();
            
            // 如果有ZIP文件路径，说明是执行更新模式
            if (!string.IsNullOrEmpty(zipFilePath) && File.Exists(zipFilePath))
            {
                ShowUpdateProgress();
                Task.Run(() => PerformUpdate());
            }
            else
            {
                // 检查更新模式
                CheckForUpdates();
            }
        }

        private void InitializeUI()
        {
            this.Text = "Ruanm Screensaver 更新";
            this.Size = new System.Drawing.Size(500, 400);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.MinimizeBox = false;

            // 创建控件
            Label titleLabel = new Label();
            titleLabel.Text = "Ruanm Screensaver 更新";
            titleLabel.Font = new System.Drawing.Font("微软雅黑", 16, System.Drawing.FontStyle.Bold);
            titleLabel.AutoSize = true;
            titleLabel.Location = new System.Drawing.Point(20, 20);
            titleLabel.Name = "titleLabel";

            Label currentVersionLabel = new Label();
            currentVersionLabel.Text = $"当前版本: {currentVersion}";
            currentVersionLabel.Font = new System.Drawing.Font("微软雅黑", 10);
            currentVersionLabel.AutoSize = true;
            currentVersionLabel.Location = new System.Drawing.Point(20, 60);
            currentVersionLabel.Name = "currentVersionLabel";

            Label latestVersionLabel = new Label();
            latestVersionLabel.Text = $"最新版本: {latestVersion}";
            latestVersionLabel.Font = new System.Drawing.Font("微软雅黑", 10);
            latestVersionLabel.AutoSize = true;
            latestVersionLabel.Location = new System.Drawing.Point(20, 90);
            latestVersionLabel.Name = "latestVersionLabel";

            Label updateContentLabel = new Label();
            updateContentLabel.Text = "更新内容:";
            updateContentLabel.Font = new System.Drawing.Font("微软雅黑", 10, System.Drawing.FontStyle.Bold);
            updateContentLabel.AutoSize = true;
            updateContentLabel.Location = new System.Drawing.Point(20, 130);
            updateContentLabel.Name = "updateContentLabel";

            TextBox updateContentBox = new TextBox();
            updateContentBox.Multiline = true;
            updateContentBox.ReadOnly = true;
            updateContentBox.ScrollBars = ScrollBars.Vertical;
            updateContentBox.Location = new System.Drawing.Point(20, 160);
            updateContentBox.Size = new System.Drawing.Size(450, 120);
            updateContentBox.Text = string.Join("\r\n", updateContent);
            updateContentBox.Name = "updateContentBox";

            ProgressBar progressBar = new ProgressBar();
            progressBar.Name = "progressBar";
            progressBar.Location = new System.Drawing.Point(20, 290);
            progressBar.Size = new System.Drawing.Size(450, 23);
            progressBar.Visible = false;

            Label progressLabel = new Label();
            progressLabel.Name = "progressLabel";
            progressLabel.Font = new System.Drawing.Font("微软雅黑", 9);
            progressLabel.AutoSize = true;
            progressLabel.Location = new System.Drawing.Point(20, 320);
            progressLabel.Visible = false;

            Button updateButton = new Button();
            updateButton.Name = "updateButton";
            updateButton.Text = "更新";
            updateButton.Size = new System.Drawing.Size(100, 30);
            updateButton.Location = new System.Drawing.Point(200, 340);
            updateButton.Click += UpdateButton_Click;

            Button cancelButton = new Button();
            cancelButton.Name = "cancelButton";
            cancelButton.Text = "取消";
            cancelButton.Size = new System.Drawing.Size(100, 30);
            cancelButton.Location = new System.Drawing.Point(370, 340);
            cancelButton.Click += CancelButton_Click;

            // 添加控件到窗体
            this.Controls.Add(titleLabel);
            this.Controls.Add(currentVersionLabel);
            this.Controls.Add(latestVersionLabel);
            this.Controls.Add(updateContentLabel);
            this.Controls.Add(updateContentBox);
            this.Controls.Add(progressBar);
            this.Controls.Add(progressLabel);
            this.Controls.Add(updateButton);
            this.Controls.Add(cancelButton);
        }

        private async void CheckForUpdates()
        {
            try
            {
                // 从服务器获取更新信息
                using (HttpClient client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(10);
                    string updateUrl = "https://ruanmingze.github.io/Ruanm-Product-Update/RuanmScreensaver-Update.json";
                    
                    // 获取更新信息
                    var response = await client.GetAsync(updateUrl);
                    if (response.IsSuccessStatusCode)
                    {
                        string jsonContent = await response.Content.ReadAsStringAsync();
                        updateInfo = JsonSerializer.Deserialize<UpdateInfo>(jsonContent);
                        
                        // 更新版本信息
                        latestVersion = updateInfo.Version;
                        updateContent = updateInfo.UpdateContent;
                        
                        // 更新界面显示
                        UpdateUIWithServerData();
                    }
                    else
                    {
                        MessageBox.Show($"无法获取更新信息，服务器返回状态码: {response.StatusCode}", "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        this.Close();
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"检查更新失败: {ex.Message}", "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                this.Close();
            }
        }

        private void UpdateUIWithServerData()
        {
            // 更新界面上的版本信息
            foreach (Control control in this.Controls)
            {
                if (control is Label label)
                {
                    if (label.Text.StartsWith("当前版本:"))
                    {
                        label.Text = $"当前版本: {currentVersion}";
                    }
                    else if (label.Text.StartsWith("最新版本:"))
                    {
                        label.Text = $"最新版本: {latestVersion}";
                    }
                }
                else if (control is TextBox textBox)
                {
                    // 更新内容文本框
                    if (textBox.Multiline && updateContent != null)
                    {
                        textBox.Text = string.Join("\r\n", updateContent);
                    }
                }
            }
        }

        private void UpdateUIForUpdateAvailable()
        {
            // 界面已经初始化为显示更新信息的状态
        }

        private async void UpdateButton_Click(object sender, EventArgs e)
        {
            // 禁用更新按钮
            Button updateButton = (Button)this.Controls["updateButton"];
            updateButton.Enabled = false;
            
            // 显示进度条
            ProgressBar progressBar = (ProgressBar)this.Controls["progressBar"];
            Label progressLabel = (Label)this.Controls["progressLabel"];
            progressBar.Visible = true;
            progressLabel.Visible = true;
            
            // 开始下载更新
            await DownloadAndUpdate();
        }

        private async Task DownloadAndUpdate()
        {
            try
            {
                // 使用从服务器获取的下载链接
                if (updateInfo != null && updateInfo.Download != null)
                {
                    downloadUrl = updateInfo.Download.Zip;
                }
                else
                {
                    // 如果没有从服务器获取到下载链接，使用默认链接
                    downloadUrl = "https://github.com/RuanMingze/Ruanm-RuanmScreensaver/releases/download/v1.0.1/RuanmScreensaver.zip";
                }
                
                // 创建临时目录用于下载更新文件
                string tempDir = Path.Combine(Path.GetTempPath(), "RuanmScreensaver_Update");
                if (!Directory.Exists(tempDir))
                {
                    Directory.CreateDirectory(tempDir);
                }

                zipFilePath = Path.Combine(tempDir, "RuanmScreensaver.zip");

                // 下载文件
                using (HttpClient client = new HttpClient())
                {
                    // 获取文件大小
                    var response = await client.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead);
                    var totalBytes = response.Content.Headers.ContentLength ?? -1L;
                    
                    // 下载文件
                    using (var downloadStream = await client.GetStreamAsync(downloadUrl))
                    using (var fileStream = new FileStream(zipFilePath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true))
                    {
                        var buffer = new byte[8192];
                        var totalBytesRead = 0L;
                        int bytesRead;
                        
                        while ((bytesRead = await downloadStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                        {
                            await fileStream.WriteAsync(buffer, 0, bytesRead);
                            totalBytesRead += bytesRead;
                            
                            // 更新进度条
                            if (totalBytes > 0)
                            {
                                var progressPercentage = (int)((totalBytesRead * 100) / totalBytes);
                                UpdateProgress(progressPercentage, $"正在下载... {progressPercentage}%");
                            }
                        }
                    }
                }

                // 下载完成，开始更新
                UpdateProgress(100, "下载完成，正在安装更新...");
                await Task.Delay(1000); // 模拟安装时间
                
                // 启动更新过程
                PerformUpdate();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"下载更新失败: {ex.Message}", "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                this.Close();
            }
        }

        private void UpdateProgress(int percentage, string message)
        {
            if (this.InvokeRequired)
            {
                this.Invoke(new Action<int, string>(UpdateProgress), percentage, message);
                return;
            }

            ProgressBar progressBar = (ProgressBar)this.Controls["progressBar"];
            Label progressLabel = (Label)this.Controls["progressLabel"];
            
            progressBar.Value = Math.Min(percentage, 100);
            progressLabel.Text = message;
        }

        private void ShowUpdateProgress()
        {
            // 隐藏不需要的控件
            foreach (Control control in this.Controls)
            {
                if (control.Name == "updateButton" || control.Name == "cancelButton")
                {
                    control.Visible = false;
                }
            }

            // 显示进度条
            ProgressBar progressBar = (ProgressBar)this.Controls["progressBar"];
            Label progressLabel = (Label)this.Controls["progressLabel"];
            progressBar.Visible = true;
            progressLabel.Visible = true;
            UpdateProgress(0, "正在安装更新...");
        }

        private void PerformUpdate()
        {
            try
            {
                UpdateProgress(30, "正在准备更新...");
                System.Threading.Thread.Sleep(1000);

                // 等待主程序完全关闭
                UpdateProgress(40, "正在关闭主程序...");
                System.Threading.Thread.Sleep(2000);

                // 解压ZIP文件到临时目录
                UpdateProgress(50, "正在解压更新文件...");
                string tempExtractDir = Path.Combine(Path.GetDirectoryName(appDirectory), "TempUpdate");
                if (Directory.Exists(tempExtractDir))
                {
                    Directory.Delete(tempExtractDir, true);
                }

                ZipFile.ExtractToDirectory(zipFilePath, tempExtractDir);

                // 替换文件
                UpdateProgress(70, "正在更新文件...");
                CopyDirectory(tempExtractDir, appDirectory);

                // 清理临时文件
                UpdateProgress(90, "正在清理临时文件...");
                File.Delete(zipFilePath);
                Directory.Delete(tempExtractDir, true);

                UpdateProgress(100, "更新完成！");

                // 重新启动应用程序
                string appExe = Path.Combine(appDirectory, "RuanmScreensaver.exe");
                if (File.Exists(appExe))
                {
                    UpdateProgress(100, "正在重启应用程序...");
                    Process.Start(appExe);
                }

                MessageBox.Show("更新完成！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"更新过程中出现错误: {ex.Message}", "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                this.Close();
            }
        }

        private void CopyDirectory(string sourceDir, string targetDir)
        {
            Directory.CreateDirectory(targetDir);

            foreach (var file in Directory.GetFiles(sourceDir))
            {
                string destFile = Path.Combine(targetDir, Path.GetFileName(file));
                File.Copy(file, destFile, true);
            }

            foreach (var directory in Directory.GetDirectories(sourceDir))
            {
                string destDirectory = Path.Combine(targetDir, Path.GetFileName(directory));
                CopyDirectory(directory, destDirectory);
            }
        }

        private void CancelButton_Click(object sender, EventArgs e)
        {
            this.Close();
        }
    }
}