using System.Collections.Generic;

namespace aramex_nexsq_api_server.Models
{
    public class ParcelModel
    {
        public string ParcelNumber { get; set; }
        public string ParcelDescription { get; set; }
        public decimal ParcelValue { get; set; }
        public int Quantity { get; set; }
        public decimal Length { get; set; }
        public decimal Width { get; set; }
        public decimal Height { get; set; }
        public decimal Weight { get; set; }
    }

    public class SubmitWaybillRequest
    {
        public string EmailAddress { get; set; }
        public string Password { get; set; }
        public string AccountNumber { get; set; }
        public string SenderStreetAddress { get; set; }
        public string SenderBusinessPark { get; set; }
        public string SenderOtherAddress { get; set; }
        public string SenderCountryCode { get; set; }
        public string SenderCountryName { get; set; }
        public string SenderState { get; set; }
        public string SenderSuburb { get; set; }
        public string SenderPostalCode { get; set; }
        public string SenderName { get; set; }
        public string SenderReference1 { get; set; }
        public string SenderReference2 { get; set; }
        public string SenderContactPerson { get; set; }
        public string SenderContactNumber { get; set; }
        public string ReceiverStreetAddress { get; set; }
        public string ReceiverBusinessPark { get; set; }
        public string ReceiverOtherAddress { get; set; }
        public string ReceiverState { get; set; }
        public string ReceiverCountryCode { get; set; }
        public string ReceiverCountryName { get; set; }
        public string ReceiverSuburb { get; set; }
        public string ReceiverPostalCode { get; set; }
        public string ReceiverName { get; set; }
        public string ReceiverReference1 { get; set; }
        public string ReceiverReference2 { get; set; }
        public string ReceiverContactPerson { get; set; }
        public string ReceiverContactNumber { get; set; }
        public string ReceiverEmailAddress { get; set; }
        public string PaymentType { get; set; }
        public string ServiceType { get; set; }
        public int WaybillPrintTemplate { get; set; }
        public string WaybillPdfFetchType { get; set; }
        public string SpecialInstructions { get; set; }
        public string WaybillNumber { get; set; }
        public bool RequireInsurance { get; set; }
        public decimal InsuranceValue { get; set; }
        public bool IsImport { get; set; }
        public bool IsDocument { get; set; }
        public List<ParcelModel> Parcels { get; set; }
    }

    public class SubmitWaybillResponse
    {
        public int StatusCode { get; set; }
        public string StatusDescription { get; set; }
        public string WaybillNumber { get; set; }
        public string LabelPrint { get; set; }
        public string ChangeDescription { get; set; }
        public string CommercialInvoice { get; set; }
    }
}
