using Microsoft.AspNetCore.Mvc;
using aramex_nexsq_api_server.Models;
using System.Threading.Tasks;

namespace aramex_nexsq_api_server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LookupController : ControllerBase
    {
        private readonly Services.AramexApiService _aramexApiService;

        public LookupController(Services.AramexApiService aramexApiService)
        {
            _aramexApiService = aramexApiService;
        }

        [HttpPost("country")]
        public async Task<ActionResult<CountryLookupResponse>> CountryLookup([FromBody] CountryLookupRequest request)
        {
            var response = await _aramexApiService.PostToAramexAsync<CountryLookupRequest, CountryLookupResponse>("GetCountry", request);
            return Ok(response);
        }

        [HttpPost("postalcode")]
        public async Task<ActionResult<PostalCodeLookupResponse>> PostalCodeLookup([FromBody] PostalCodeLookupRequest request)
        {
            var response = await _aramexApiService.PostToAramexAsync<PostalCodeLookupRequest, PostalCodeLookupResponse>("GetPostalCodes", request);
            return Ok(response);
        }
    }
}
