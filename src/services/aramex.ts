import axios from 'axios';

export interface RateRequest {
  OriginCountryCode: string;
  OriginCity: string;
  DestinationCountryCode: string;
  DestinationCity: string;
  Weight: number;
  NumberOfPieces: number;
  PaymentType: string;
  ProductGroup: string;
  ProductType: string;
}

export interface RateDetail {
  ServiceType: string;
  CurrencyCode: string;
  Amount: number;
  Description: string;
}

export interface RateResponse {
  StatusCode: number;
  StatusDescription: string;
  RateDetails: RateDetail[];
}

export async function getAramexRate(request: RateRequest): Promise<RateResponse> {
  const { data } = await axios.post('/api/rate/calculate', request);
  return data;
}
