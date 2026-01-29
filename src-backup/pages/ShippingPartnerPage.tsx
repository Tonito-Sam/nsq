import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { shippingPartners } from '@/utils/shippingPartners';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const ShippingPartnerPage = () => {
  const { partnerCode } = useParams<{ partnerCode: string }>();
  const partner = shippingPartners.find(p => p.code === partnerCode);
  const [apiKey, setApiKey] = useState('');
  const [costType, setCostType] = useState('flat'); // 'flat' or 'api'
  const [flatRate, setFlatRate] = useState(20);
  const [liveRateResult, setLiveRateResult] = useState<number|null>(null);
  const [liveRateLoading, setLiveRateLoading] = useState(false);
  const [liveRateError, setLiveRateError] = useState('');
  // Save API key for this partner (per user)
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const { user } = useAuth();

  // Editable shipment data state
  const [collection, setCollection] = useState({
    country: 'ZA', postal_code: '2196', suburb: 'Sandton', city: 'Johannesburg', street: '123 Test St', province: 'Gauteng'
  });
  const [delivery, setDelivery] = useState({
    country: 'ZA', postal_code: '8001', suburb: 'Cape Town City Centre', city: 'Cape Town', street: '456 Demo Ave', province: 'Western Cape'
  });
  const [parcel, setParcel] = useState({ weight: 2.5, length: 30, width: 20, height: 10 });

  // Validation helper
  function validateShipment() {
    const requiredFields = [
      collection.country, collection.postal_code, collection.city, collection.street, collection.province,
      delivery.country, delivery.postal_code, delivery.city, delivery.street, delivery.province,
      parcel.weight, parcel.length, parcel.width, parcel.height
    ];
    if (requiredFields.some(f => !f || (typeof f === 'number' && f <= 0))) {
      setLiveRateError('Please fill in all shipment fields with valid values.');
      return false;
    }
    return true;
  }

  // Example: Simulate live rate fetch
  const fetchLiveRate = async () => {
    setLiveRateLoading(true);
    setLiveRateError('');
    setLiveRateResult(null);
    if (!validateShipment()) {
      setLiveRateLoading(false);
      return;
    }
    try {
      if (partner.code === 'courierguy' || partner.code === 'shiplogic') {
        // Real Ship Logic API call for The Courier Guy
        const response = await fetch('https://api.shiplogic.com/v2/rates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            collection: { address: collection },
            delivery: { address: delivery },
            parcels: [parcel]
          })
        });
        if (!response.ok) {
          throw new Error('API error: ' + response.status);
        }
        const data = await response.json();
        // Ship Logic returns an array of rate options
        if (Array.isArray(data) && data.length > 0 && data[0].total) {
          setLiveRateResult(Number(data[0].total));
        } else if (data.rates && Array.isArray(data.rates) && data.rates.length > 0 && data.rates[0].total) {
          setLiveRateResult(Number(data.rates[0].total));
        } else {
          setLiveRateError('No rates found.');
        }
      } else if (partner.code === 'fedex') {
        // FedEx sandbox API integration
        // Step 1: Get OAuth token
        const fedexAuth = btoa('l7a5966ad47ff9496688bf25021f88acab:39aef17e89044c76b20077e71c48edaa');
        const tokenRes = await fetch('https://apis-sandbox.fedex.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${fedexAuth}`
          },
          body: 'grant_type=client_credentials&scope=oob'
        });
        if (!tokenRes.ok) throw new Error('FedEx auth failed: ' + tokenRes.status);
        const tokenData = await tokenRes.json();
        const fedexToken = tokenData.access_token;
        // Step 2: Call FedEx rates API
        const fedexRateRes = await fetch('https://apis-sandbox.fedex.com/rate/v1/rates/quotes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fedexToken}`
          },
          body: JSON.stringify({
            accountNumber: { value: '510087000' }, // FedEx test account
            requestedShipment: {
              shipper: {
                address: {
                  countryCode: collection.country,
                  postalCode: collection.postal_code,
                  city: collection.city,
                  stateOrProvinceCode: collection.province
                }
              },
              recipient: {
                address: {
                  countryCode: delivery.country,
                  postalCode: delivery.postal_code,
                  city: delivery.city,
                  stateOrProvinceCode: delivery.province
                }
              },
              pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
              rateRequestType: ['ACCOUNT'],
              requestedPackageLineItems: [
                {
                  weight: { units: 'KG', value: parcel.weight },
                  dimensions: { length: parcel.length, width: parcel.width, height: parcel.height, units: 'CM' }
                }
              ]
            }
          })
        });
        if (!fedexRateRes.ok) throw new Error('FedEx rate error: ' + fedexRateRes.status);
        const fedexRateData = await fedexRateRes.json();
        // Parse FedEx rate response
        const amount = fedexRateData?.output?.rateReplyDetails?.[0]?.ratedShipmentDetails?.[0]?.totalNetCharge?.amount;
        if (amount) {
          setLiveRateResult(Number(amount));
        } else {
          setLiveRateError('No FedEx rates found.');
        }
      } else {
        // Simulate API call (for other partners)
        await new Promise(res => setTimeout(res, 1200));
        setLiveRateResult(32.5); // Example: fetched rate
      }
    } catch (e: any) {
      setLiveRateError('Failed to fetch live rate.' + (e?.message ? ' ' + e.message : ''));
    } finally {
      setLiveRateLoading(false);
    }
  };

  // Save API key for this partner (per user)
  const saveApiKey = async () => {
    setSaveStatus('saving');
    try {
      // Use 'as any' to bypass type error until Supabase types are fully synced
      await (supabase.from('user_shipping_partner_keys' as any) as any).upsert({
        partner_code: partner.code,
        api_key: apiKey,
        user_id: user?.id
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      setSaveStatus('error');
    }
  };

  if (!partner) {
    return <div className="p-8 text-center">Shipping partner not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] transition-colors">
      <Header />
      <div className="flex items-center justify-center py-20">
        <Card className="p-8 max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold mb-4">{partner.name}</h1>
          <p className="mb-4 text-gray-600 dark:text-gray-300">API Integration: {partner.supportsApi ? 'Yes' : 'No'}</p>
          {partner.docs && (
            <a href={partner.docs} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">API Docs</a>
          )}

          {/* API Key Setup */}
          {partner.supportsApi && (
            <div className="mb-6">
              <label className="block mb-2 font-semibold">API Key</label>
              <input
                type="text"
                className="border rounded px-3 py-2 w-full mb-2"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <button
                className="bg-green-600 text-white px-4 py-2 rounded mb-2"
                onClick={saveApiKey}
                disabled={saveStatus==='saving'}
              >
                {saveStatus==='saving' ? 'Saving...' : 'Save API Key'}
              </button>
              {saveStatus==='saved' && <span className="text-green-600 ml-2">Saved!</span>}
              {saveStatus==='error' && <span className="text-red-600 ml-2">Error saving key</span>}
              <p className="text-xs text-gray-500 mb-2">Store your API key securely. Required for live shipping rates.</p>
            </div>
          )}

          {/* Shipping Cost Rules */}
          <div className="mb-6">
            <label className="block mb-2 font-semibold">Shipping Cost Calculation</label>
            <select
              className="border rounded px-3 py-2 w-full mb-2"
              value={costType}
              onChange={e => setCostType(e.target.value)}
            >
              <option value="flat">Flat Rate</option>
              {partner.supportsApi && <option value="api">Live Rate (API)</option>}
            </select>
            {costType === 'flat' ? (
              <div>
                <input
                  type="number"
                  className="border rounded px-3 py-2 w-full mb-2"
                  value={flatRate}
                  min={0}
                  onChange={e => setFlatRate(Number(e.target.value))}
                />
                <p className="text-xs text-gray-500">Flat shipping rate (e.g., $20 per order).</p>
              </div>
            ) : (
              <div>
                {/* Editable shipment data form */}
                <div className="mb-4 text-left">
                  <div className="font-semibold mb-1">Collection Address</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input className="border rounded px-2 py-1" placeholder="Country" value={collection.country} onChange={e => setCollection(c => ({...c, country: e.target.value}))} />
                    <input className="border rounded px-2 py-1" placeholder="Postal Code" value={collection.postal_code} onChange={e => setCollection(c => ({...c, postal_code: e.target.value}))} />
                    <input className="border rounded px-2 py-1" placeholder="Suburb" value={collection.suburb} onChange={e => setCollection(c => ({...c, suburb: e.target.value}))} />
                    <input className="border rounded px-2 py-1" placeholder="City" value={collection.city} onChange={e => setCollection(c => ({...c, city: e.target.value}))} />
                    <input className="border rounded px-2 py-1 col-span-2" placeholder="Street" value={collection.street} onChange={e => setCollection(c => ({...c, street: e.target.value}))} />
                    <input className="border rounded px-2 py-1 col-span-2" placeholder="Province" value={collection.province} onChange={e => setCollection(c => ({...c, province: e.target.value}))} />
                  </div>
                  <div className="font-semibold mb-1 mt-2">Delivery Address</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input className="border rounded px-2 py-1" placeholder="Country" value={delivery.country} onChange={e => setDelivery(d => ({...d, country: e.target.value}))} />
                    <input className="border rounded px-2 py-1" placeholder="Postal Code" value={delivery.postal_code} onChange={e => setDelivery(d => ({...d, postal_code: e.target.value}))} />
                    <input className="border rounded px-2 py-1" placeholder="Suburb" value={delivery.suburb} onChange={e => setDelivery(d => ({...d, suburb: e.target.value}))} />
                    <input className="border rounded px-2 py-1" placeholder="City" value={delivery.city} onChange={e => setDelivery(d => ({...d, city: e.target.value}))} />
                    <input className="border rounded px-2 py-1 col-span-2" placeholder="Street" value={delivery.street} onChange={e => setDelivery(d => ({...d, street: e.target.value}))} />
                    <input className="border rounded px-2 py-1 col-span-2" placeholder="Province" value={delivery.province} onChange={e => setDelivery(d => ({...d, province: e.target.value}))} />
                  </div>
                  <div className="font-semibold mb-1 mt-2">Parcel</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input className="border rounded px-2 py-1" type="number" min="0.1" step="0.1" placeholder="Weight (kg)" value={parcel.weight} onChange={e => setParcel(p => ({...p, weight: Number(e.target.value)}))} />
                    <input className="border rounded px-2 py-1" type="number" min="1" step="1" placeholder="Length (cm)" value={parcel.length} onChange={e => setParcel(p => ({...p, length: Number(e.target.value)}))} />
                    <input className="border rounded px-2 py-1" type="number" min="1" step="1" placeholder="Width (cm)" value={parcel.width} onChange={e => setParcel(p => ({...p, width: Number(e.target.value)}))} />
                    <input className="border rounded px-2 py-1" type="number" min="1" step="1" placeholder="Height (cm)" value={parcel.height} onChange={e => setParcel(p => ({...p, height: Number(e.target.value)}))} />
                  </div>
                </div>
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded mb-2"
                  onClick={fetchLiveRate}
                  disabled={liveRateLoading}
                >
                  {liveRateLoading ? 'Fetching...' : 'Fetch Live Rate'}
                </button>
                {liveRateResult !== null && (
                  <div className="text-green-600 font-semibold mb-2">Live Rate: ${liveRateResult.toFixed(2)}</div>
                )}
                {liveRateError && (
                  <div className="text-red-500 text-xs mb-2">{liveRateError}</div>
                )}
                <p className="text-xs text-gray-500">This will use the shipping partner's API to calculate the cost based on destination, weight, etc.</p>
              </div>
            )}
          </div>

          <div className="text-xs text-gray-400 mt-6">
            <p>Customize your shipping cost logic or integrate real APIs for live rates. <br />
            Need advanced rules or multi-store support? Contact support for integration help.</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ShippingPartnerPage;
