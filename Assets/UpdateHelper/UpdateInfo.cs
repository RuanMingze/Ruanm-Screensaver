using System.Text.Json.Serialization;

namespace UpdateHelper
{
    public class UpdateInfo
    {
        [JsonPropertyName("version")]
        public string Version { get; set; }

        [JsonPropertyName("updateContent")]
        public string[] UpdateContent { get; set; }

        [JsonPropertyName("download")]
        public DownloadInfo Download { get; set; }
    }

    public class DownloadInfo
    {
        [JsonPropertyName("installer")]
        public string Installer { get; set; }

        [JsonPropertyName("zip")]
        public string Zip { get; set; }
    }
}