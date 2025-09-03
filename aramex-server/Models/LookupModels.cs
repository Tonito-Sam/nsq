namespace aramex_nexsq_api_server.Models
{
    public class CountryLookupRequest
    {
        public string EmailAddress { get; set; }
        public string AccountNumber { get; set; }
        public string CountryCode { get; set; }
        public string CountryName { get; set; }
    }

    public class CountryDetail
    {
        public string CountryName { get; set; }
        public string CountryCode { get; set; }
        public string CountryDialingCode { get; set; }
    }

    public class CountryLookupResponse
    {
        public int StatusCode { get; set; }
        public string StatusDescription { get; set; }
        public List<CountryDetail> CountryDetails { get; set; }
    }

    public class PostalCodeLookupRequest
    {
        public string EmailAddress { get; set; }
        public string AccountNumber { get; set; }
        public string CountryCode { get; set; }
        public string Suburb { get; set; }
        public string PostalCode { get; set; }
    }

    public class PostalCodeDetail
    {
        public string CountryCode { get; set; }
        public string ServiceEntity { get; set; }
        public string Entity { get; set; }
        public string SuburbName { get; set; }
        public string City { get; set; }
        public string StateName { get; set; }
        public string PostalPrefix { get; set; }
        public string PostalCode { get; set; }
        public string PostalSuffix { get; set; }
        public string LocationCode { get; set; }
        public bool Mon { get; set; }
        public bool Tue { get; set; }
        public bool Wed { get; set; }
        public bool Thu { get; set; }
        public bool Fri { get; set; }
        public bool Sat { get; set; }
        public bool Sun { get; set; }
    }

    public class PostalCodeLookupResponse
    {
        public int StatusCode { get; set; }
        public string StatusDescription { get; set; }
        public List<PostalCodeDetail> PostalCodes { get; set; }
    }
}
