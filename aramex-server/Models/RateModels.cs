using System.Collections.Generic;

namespace aramex_nexsq_api_server.Models
{
    public class RateParcelModel
    {
        public decimal ParcelValue { get; set; }
        public int Quantity { get; set; }
        public decimal Length { get; set; }
        public decimal Width { get; set; }
        public decimal Height { get; set; }
        public decimal Weight { get; set; }
    }

    public class RateRequest
    {
        public string EmailAddress { get; set; }
        public string Password { get; set; }
        public string AccountNumber { get; set; }
        public string SenderCountryCode { get; set; }
        public string SenderCountryName { get; set; }
        public string SenderSuburb { get; set; }
        public string SenderPostalCode { get; set; }
        public string ReceiverCountryCode { get; set; }
        public string ReceiverCountryName { get; set; }
        public string ReceiverSuburb { get; set; }
        public string ReceiverPostalCode { get; set; }
        public string PaymentType { get; set; }
        public string ServiceType { get; set; }
        public bool IsDocuments { get; set; }
        public bool RequireInsurance { get; set; }
        public List<RateParcelModel> Parcels { get; set; }
    }

    public class RateResponse
    {
        public int StatusCode { get; set; }
        public string StatusDescription { get; set; }
        public decimal Rate { get; set; }
        public string ChangeDescription { get; set; }
        public string ExpectedDeliveryDate { get; set; }
    }
}
