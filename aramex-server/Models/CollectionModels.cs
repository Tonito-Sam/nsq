using System.Collections.Generic;

namespace aramex_nexsq_api_server.Models
{
    public class CollectionParcelModel
    {
        public int Quantity { get; set; }
        public decimal Length { get; set; }
        public decimal Width { get; set; }
        public decimal Height { get; set; }
        public decimal Weight { get; set; }
    }

    public class SubmitCollectionRequest
    {
        public string EmailAddress { get; set; }
        public string Password { get; set; }
        public string AccountNumber { get; set; }
        public string SenderStreetAddress { get; set; }
        public string SenderBusinessPark { get; set; }
        public string SenderCountryCode { get; set; }
        public string SenderCountryName { get; set; }
        public string SenderState { get; set; }
        public string SenderSuburb { get; set; }
        public string SenderPostalCode { get; set; }
        public string SenderName { get; set; }
        public string SenderContactPerson { get; set; }
        public string SenderContactNumber { get; set; }
        public string ReceiverStreetAddress { get; set; }
        public string ReceiverBusinessPark { get; set; }
        public string ReceiverCountryCode { get; set; }
        public string ReceiverState { get; set; }
        public string ReceiverSuburb { get; set; }
        public string ReceiverPostalCode { get; set; }
        public string ReceiverName { get; set; }
        public string ReceiverContactPerson { get; set; }
        public string ReceiverContactNumber { get; set; }
        public string PaymentType { get; set; }
        public string ServiceType { get; set; }
        public string Reference1 { get; set; }
        public string Reference2 { get; set; }
        public string Comments { get; set; }
        public string PickupDate { get; set; }
        public string ReadyTime { get; set; }
        public string ClosingTime { get; set; }
        public List<CollectionParcelModel> Parcels { get; set; }
    }

    public class SubmitCollectionResponse
    {
        public int StatusCode { get; set; }
        public string StatusDescription { get; set; }
        public string CollectionReference { get; set; }
        public string ChangeDescription { get; set; }
    }
}
