using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace UpdateHelper
{
    internal static class Program
    {
        /// <summary>
        ///  The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            
            // 解析命令行参数
            string zipFilePath = null;
            string appDirectory = null;
            
            if (args.Length >= 2)
            {
                zipFilePath = args[0];
                appDirectory = args[1];
            }
            
            // 启动更新窗口
            Application.Run(new UpdateForm(zipFilePath, appDirectory));
        }
    }
}