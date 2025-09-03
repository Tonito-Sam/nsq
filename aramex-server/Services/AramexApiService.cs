using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using aramex_nexsq_api_server.Models;

namespace aramex_nexsq_api_server.Services
{
    public class AramexApiService
    {
        private readonly HttpClient _httpClient;
        private readonly AramexConfig _config;
        private readonly ILogger<AramexApiService> _logger;

        public AramexApiService(AramexConfigService configService, ILogger<AramexApiService> logger)
        {
            _httpClient = new HttpClient();
            _config = configService.Config;
            _logger = logger;
        }

        public async Task<TResponse> PostToAramexAsync<TRequest, TResponse>(string endpoint, TRequest request)
        {
            var url = _config.ApiBaseUrl.TrimEnd('/') + "/" + endpoint.TrimStart('/');
            var json = JsonSerializer.Serialize(request);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            try
            {
                var response = await _httpClient.PostAsync(url, content);
                var responseString = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Aramex API error: {response.StatusCode} {response.ReasonPhrase} - {responseString}");
                    throw new HttpRequestException($"Aramex API error: {response.StatusCode} {response.ReasonPhrase}");
                }
                return JsonSerializer.Deserialize<TResponse>(responseString, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error calling Aramex endpoint {endpoint}");
                throw;
            }
        }
    }
}
