namespace aramex_nexsq_api_server.Models
{
    public class WaybillTrackingRequest
    {
        public string EmailAddress { get; set; }
        public string Password { get; set; }
        public string AccountNumber { get; set; }
        public string WaybillNumber { get; set; }
    }

    public class TrackingEvent
    {
        public string ActionDate { get; set; }
        public string TrackingCode { get; set; }
        public string Description { get; set; }
        public string Location { get; set; }
        public string UpdateCountry { get; set; }
        public string CustomerDescription { get; set; }
    }

    public class WaybillTrackingResponse
    {
        public int StatusCode { get; set; }
        public string StatusDescription { get; set; }
        public List<TrackingEvent> TrackingInformation { get; set; }
    }

    public class CollectionTrackingRequest
    {
        public string EmailAddress { get; set; }
        public string Password { get; set; }
        public string AccountNumber { get; set; }
        public string CollectionNumber { get; set; }
    }

    public class CollectionTrackingResponse
    {
        public int StatusCode { get; set; }
        public string StatusDescription { get; set; }
        public string CollectionDate { get; set; }
        public string Entity { get; set; }
        public string LastStatus { get; set; }
        public string LastStatusDescription { get; set; }
        public string PickupDate { get; set; }
        public string Reference { get; set; }
    }
}
