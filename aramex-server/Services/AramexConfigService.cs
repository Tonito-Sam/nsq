using Microsoft.Extensions.Configuration;

namespace aramex_nexsq_api_server.Services
{
    public class AramexConfig
    {
        public string ApiBaseUrl { get; set; }
        public string EmailAddress { get; set; }
        public string Password { get; set; }
        public string AccountNumber { get; set; }
    }

    public class AramexConfigService
    {
        public AramexConfig Config { get; }

        public AramexConfigService(IConfiguration configuration)
        {
            Config = new AramexConfig();
            configuration.GetSection("Aramex").Bind(Config);
            // Optionally, override with environment variables
            Config.EmailAddress = Environment.GetEnvironmentVariable("ARAMEX_EMAIL") ?? Config.EmailAddress;
            Config.Password = Environment.GetEnvironmentVariable("ARAMEX_PASSWORD") ?? Config.Password;
            Config.AccountNumber = Environment.GetEnvironmentVariable("ARAMEX_ACCOUNT") ?? Config.AccountNumber;
        }
    }
}
