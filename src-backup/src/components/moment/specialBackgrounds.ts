// List of special backgrounds for holidays/events
// You can expand this list with more countries and events


export interface SpecialBackground {
  id: string;
  name: string;
  date: string | { rule: string }; // e.g. '12-25' or { rule: 'first Sunday in May' }
  countries: string[]; // ISO 2-letter codes or ['ALL']
  background: string; // CSS gradient, color, or image URL
  icon?: string;
  description?: string;
}

export const specialBackgrounds: SpecialBackground[] = [
  // Global
  {
    id: 'christmas',
    name: 'Christmas',
    date: '12-25',
    countries: ['ALL'],
    background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    icon: '🎄',
    description: 'Celebrate Christmas with the world!',
  },
  {
    id: 'eid',
    name: 'Eid al-Fitr',
    date: { rule: 'lunar calendar' },
    countries: ['ALL'],
    background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    icon: '🌙',
    description: 'Eid Mubarak!',
  },
  {
    id: 'diwali',
    name: 'Diwali',
    date: { rule: 'lunar calendar' },
    countries: ['IN', 'NP', 'SG', 'MY', 'FJ', 'TT', 'MU', 'GB', 'US', 'CA'],
    background: 'linear-gradient(135deg, #fc466b 0%, #3f5efb 100%)',
    icon: '🪔',
    description: 'Festival of Lights!',
  },
  {
    id: 'chinese-new-year',
    name: 'Chinese New Year',
    date: { rule: 'lunar calendar' },
    countries: ['CN', 'SG', 'MY', 'TW', 'HK', 'ID', 'TH', 'PH', 'VN'],
    background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    icon: '🐉',
    description: 'Happy Lunar New Year!',
  },
  {
    id: 'womens-day',
    name: 'International Women’s Day',
    date: '03-08',
    countries: ['ALL'],
    background: 'linear-gradient(135deg, #f953c6 0%, #b91d73 100%)',
    icon: '♀️',
    description: 'Celebrating women everywhere!',
  },
  {
    id: 'childrens-day',
    name: 'International Children’s Day',
    date: '06-01',
    countries: ['ALL'],
    background: 'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)',
    icon: '🧒',
    description: 'For the children of the world!',
  },
  {
    id: 'aids-day',
    name: 'World AIDS Day',
    date: '12-01',
    countries: ['ALL'],
    background: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
    icon: '🎗️',
    description: 'Support for HIV/AIDS awareness.',
  },
  {
    id: 'autism-day',
    name: 'World Autism Awareness Day',
    date: '04-02',
    countries: ['ALL'],
    background: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
    icon: '🧩',
    description: 'Support for autism awareness.',
  },
  {
    id: 'mandela-day',
    name: 'Mandela Day',
    date: '07-18',
    countries: ['ZA'],
    background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    icon: '🕊️',
    description: 'Nelson Mandela International Day',
  },
  // Mother's Day (second Sunday in May, most countries)
  {
    id: 'mothers-day',
    name: 'Mother’s Day',
    date: { rule: 'second Sunday in May' },
    countries: ['ALL'],
    background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    icon: '🌷',
    description: 'Celebrating mothers everywhere!',
  },
  // Father's Day (third Sunday in June, most countries)
  {
    id: 'fathers-day',
    name: 'Father’s Day',
    date: { rule: 'third Sunday in June' },
    countries: ['ALL'],
    background: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
    icon: '👨‍👧‍👦',
    description: 'Celebrating fathers everywhere!',
  },
  // Independence Days (sample, add more as needed)
  {
    id: 'us-independence',
    name: 'US Independence Day',
    date: '07-04',
    countries: ['US'],
    background: 'linear-gradient(135deg, #3a6186 0%, #89253e 100%)',
    icon: '🇺🇸',
    description: 'Happy 4th of July!',
  },
  {
    id: 'nigeria-independence',
    name: 'Nigeria Independence Day',
    date: '10-01',
    countries: ['NG'],
    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    icon: '🇳🇬',
    description: 'Happy Independence Day, Nigeria!',
  },
  {
    id: 'india-independence',
    name: 'India Independence Day',
    date: '08-15',
    countries: ['IN'],
    background: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)',
    icon: '🇮🇳',
    description: 'Happy Independence Day, India!',
  },
  {
    id: 'south-africa-freedom',
    name: 'South Africa Freedom Day',
    date: '04-27',
    countries: ['ZA'],
    background: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)',
    icon: '🇿🇦',
    description: 'Freedom Day, South Africa!',
  },
  // Add more countries and events below (hundreds possible!)
  // ...
];
