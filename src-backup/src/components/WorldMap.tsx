import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../integrations/supabase/client';
import { useTheme } from './ThemeProvider';

// Map currency codes to country names and coordinates
const currencyCountryCoords: Record<string, { country: string; coords: [number, number] }> = {
  USD: { country: 'United States', coords: [37.0902, -95.7129] },
  ZAR: { country: 'South Africa', coords: [-30.5595, 22.9375] },
  // Add more currency-country mappings as needed
};

const darkTile = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const lightTile = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const WorldMap: React.FC = () => {
  const [currencyCounts, setCurrencyCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    const fetchUserCurrencies = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('users').select('currency');
      if (error) return setLoading(false);
      const counts: Record<string, number> = {};
      (data || []).forEach((u: any) => {
        if (u.currency) counts[u.currency] = (counts[u.currency] || 0) + 1;
      });
      setCurrencyCounts(counts);
      setLoading(false);
      console.log('Currency counts:', counts); // Debug
    };
    fetchUserCurrencies();
  }, []);

  // Helper to get country flag emoji or image
  const getFlagUrl = (country: string) => {
    // Use country name to ISO code mapping for more countries as needed
    const countryCodeMap: Record<string, string> = {
      'United States': 'us',
      'South Africa': 'za',
      // Add more mappings as needed
    };
    const code = countryCodeMap[country];
    return code ? `https://flagcdn.com/24x18/${code}.png` : '';
  };

  return (
    <div style={{ width: '100%', minHeight: 400, background: theme === 'dark' ? '#18181b' : '#f4f4f5', borderRadius: 12, boxShadow: theme === 'dark' ? '0 2px 8px #0008' : '0 2px 8px #ccc8', position: 'relative', paddingBottom: 24 }}>
      <MapContainer
        center={[10, 0]}
        zoom={2}
        style={{ width: '100%', height: 400, borderRadius: 12 }}
        scrollWheelZoom={false}
        dragging={!loading}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url={theme === 'dark' ? darkTile : lightTile}
          attribution="&copy; OpenStreetMap contributors"
        />
        {Object.entries(currencyCounts).map(([currency, count]) => {
          const entry = currencyCountryCoords[currency];
          if (!entry) return null;
          return (
            <CircleMarker
              key={currency}
              center={entry.coords}
              radius={6 + Math.log(count) * 4}
              pathOptions={{ color: theme === 'dark' ? '#38bdf8' : '#2563eb', fillColor: theme === 'dark' ? '#38bdf8' : '#2563eb', fillOpacity: 0.7 }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent={false}>
                {entry.country} ({currency}): {count} user{count > 1 ? 's' : ''}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      {loading && <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,display:'flex',alignItems:'center',justifyContent:'center',color:theme==='dark'?'#fff':'#222',background:theme==='dark'?'#18181bcc':'#f4f4f5cc',zIndex:10}}>Loading map...</div>}
      {/* User count by country with flags */}
      <div style={{marginTop: 24, padding: 8}}>
        <h4 style={{fontWeight:'bold',marginBottom:8}}>Users by Country</h4>
        <div style={{display:'flex',flexWrap:'wrap',gap:16}}>
          {Object.entries(currencyCounts).map(([currency, count]) => {
            const entry = currencyCountryCoords[currency];
            if (!entry) return null;
            const flagUrl = getFlagUrl(entry.country);
            return (
              <div key={currency} style={{display:'flex',alignItems:'center',gap:8,background:theme==='dark'?'#23232b':'#fff',borderRadius:8,padding:'4px 12px',boxShadow:'0 1px 4px #0001'}}>
                {flagUrl && <img src={flagUrl} alt={entry.country+" flag"} style={{width:24,height:18,borderRadius:2,objectFit:'cover',border:'1px solid #ccc'}} />}
                <span style={{fontWeight:500}}>{entry.country}</span>
                <span style={{color:'#888',fontSize:13}}>({count})</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorldMap;
