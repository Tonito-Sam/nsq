using Microsoft.AspNetCore.Mvc;
using aramex_nexsq_api_server.Models;
using System.Threading.Tasks;

namespace aramex_nexsq_api_server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WaybillController : ControllerBase
    {
        private readonly Services.AramexApiService _aramexApiService;

        public WaybillController(Services.AramexApiService aramexApiService)
        {
            _aramexApiService = aramexApiService;
        }

        [HttpPost("submit")]
        public async Task<ActionResult<SubmitWaybillResponse>> SubmitWaybill([FromBody] SubmitWaybillRequest request)
        {
            // Call Aramex JSON API endpoint
            var response = await _aramexApiService.PostToAramexAsync<SubmitWaybillRequest, SubmitWaybillResponse>("SubmitWaybill", request);
            return Ok(response);
        }
    }
}
