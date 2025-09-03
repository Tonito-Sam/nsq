const express = require('express');
const axios = require('axios');
const router = express.Router();

// TODO: Replace with your real Aramex credentials
const ARAMEX_CLIENT_INFO = {
  UserName: process.env.ARAMEX_USERNAME || 'your_username',
  Password: process.env.ARAMEX_PASSWORD || 'your_password',
  Version: 'v1',
  AccountNumber: process.env.ARAMEX_ACCOUNT_NUMBER || 'your_account_number',
  AccountPin: process.env.ARAMEX_ACCOUNT_PIN || 'your_pin',
  AccountEntity: process.env.ARAMEX_ACCOUNT_ENTITY || 'DXB',
  AccountCountryCode: process.env.ARAMEX_ACCOUNT_COUNTRY_CODE || 'AE',
};

const BASE_URL = 'https://ws.aramex.net/ShippingAPI.V2';

// POST /api/aramex/rate
router.post('/rate', async (req, res) => {
  const { originCountry, destinationCountry, weight } = req.body;
  const body = {
    ClientInfo: ARAMEX_CLIENT_INFO,
    OriginAddress: { CountryCode: originCountry },
    DestinationAddress: { CountryCode: destinationCountry },
    ShipmentDetails: {
      PaymentType: 'P',
      ProductGroup: 'EXP',
      ProductType: 'PPX',
      ActualWeight: { Unit: 'KG', Value: weight },
      ChargeableWeight: { Unit: 'KG', Value: weight },
      Dimensions: { Length: 10, Width: 10, Height: 10, Unit: 'CM' },
    },
  };
  try {
    const result = await axios.post(`${BASE_URL}/RateCalculator/Service_1_0.svc/json/CalculateRate`, body);
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/aramex/track
router.post('/track', async (req, res) => {
  const { trackingNumber } = req.body;
  const body = {
    ClientInfo: ARAMEX_CLIENT_INFO,
    Shipments: [trackingNumber],
  };
  try {
    const result = await axios.post(`${BASE_URL}/Tracking/Service_1_0.svc/json/TrackShipments`, body);
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/aramex/shipping
router.post('/shipping', async (req, res) => {
  const { origin, destination, weight, receiver } = req.body;
  const body = {
    ClientInfo: ARAMEX_CLIENT_INFO,
    LabelInfo: { ReportID: 9201, ReportType: 'URL' },
    Shipments: [{
      Shipper: {
        Reference1: '',
        AccountNumber: ARAMEX_CLIENT_INFO.AccountNumber,
        Address: { City: origin.city, CountryCode: origin.country, Line1: 'Warehouse Street' },
        Contact: { PersonName: '1VS Vendor', PhoneNumber1: '971500000000' }
      },
      Consignee: {
        Reference1: '',
        Address: { City: destination.city, CountryCode: destination.country, Line1: receiver.address },
        Contact: { PersonName: receiver.name, PhoneNumber1: receiver.phone }
      },
      Details: {
        Dimensions: { Length: 10, Width: 10, Height: 10, Unit: 'CM' },
        ActualWeight: { Unit: 'KG', Value: weight },
        ProductGroup: 'EXP',
        ProductType: 'PPX',
        PaymentType: 'P',
        NumberOfPieces: 1,
        DescriptionOfGoods: 'General merchandise'
      }
    }]
  };
  try {
    const result = await axios.post(`${BASE_URL}/Shipping/Service_1_0.svc/json/CreateShipments`, body);
    const shipment = result.data.Shipments[0];
    res.json({ awb: shipment.ID, labelUrl: shipment.LabelURL });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
