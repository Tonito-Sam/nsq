using Microsoft.AspNetCore.Mvc;
using aramex_nexsq_api_server.Models;
using System.Threading.Tasks;

namespace aramex_nexsq_api_server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CollectionController : ControllerBase
    {
        private readonly Services.AramexApiService _aramexApiService;

        public CollectionController(Services.AramexApiService aramexApiService)
        {
            _aramexApiService = aramexApiService;
        }

        [HttpPost("submit")]
        public async Task<ActionResult<SubmitCollectionResponse>> SubmitCollection([FromBody] SubmitCollectionRequest request)
        {
            var response = await _aramexApiService.PostToAramexAsync<SubmitCollectionRequest, SubmitCollectionResponse>("SubmitCollection", request);
            return Ok(response);
        }
    }
}
