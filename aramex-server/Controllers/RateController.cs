using Microsoft.AspNetCore.Mvc;
using aramex_nexsq_api_server.Models;
using System.Threading.Tasks;

namespace aramex_nexsq_api_server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RateController : ControllerBase
    {
        private readonly Services.AramexApiService _aramexApiService;

        public RateController(Services.AramexApiService aramexApiService)
        {
            _aramexApiService = aramexApiService;
        }

        [HttpPost("calculate")]
        public async Task<ActionResult<RateResponse>> CalculateRate([FromBody] RateRequest request)
        {
            var response = await _aramexApiService.PostToAramexAsync<RateRequest, RateResponse>("GetRate", request);
            return Ok(response);
        }
    }
}
