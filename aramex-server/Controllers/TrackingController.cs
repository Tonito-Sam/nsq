using Microsoft.AspNetCore.Mvc;
using aramex_nexsq_api_server.Models;
using System.Threading.Tasks;

namespace aramex_nexsq_api_server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TrackingController : ControllerBase
    {
        private readonly Services.AramexApiService _aramexApiService;

        public TrackingController(Services.AramexApiService aramexApiService)
        {
            _aramexApiService = aramexApiService;
        }

        [HttpPost("waybill")]
        public async Task<ActionResult<WaybillTrackingResponse>> TrackWaybill([FromBody] WaybillTrackingRequest request)
        {
            var response = await _aramexApiService.PostToAramexAsync<WaybillTrackingRequest, WaybillTrackingResponse>("GetWaybillTracking", request);
            return Ok(response);
        }

        [HttpPost("collection")]
        public async Task<ActionResult<CollectionTrackingResponse>> TrackCollection([FromBody] CollectionTrackingRequest request)
        {
            var response = await _aramexApiService.PostToAramexAsync<CollectionTrackingRequest, CollectionTrackingResponse>("GetCollectionTracking", request);
            return Ok(response);
        }
    }
}
