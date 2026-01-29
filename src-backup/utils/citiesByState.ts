export const citiesByState: { [key: string]: { [key: string]: string[] } } = {
  ZA: {
    'Western Cape': [
      'Cape Town', 'Stellenbosch', 'Paarl', 'Worcester', 'George', 'Bellville', 'Somerset West',
      'Durbanville', 'Parow', 'Goodwood', 'Claremont', 'Rondebosch', 'Newlands', 'Sea Point',
      'Green Point', 'Century City', 'Brackenfell', 'Kuils River', 'Mitchells Plain', 'Khayelitsha'
    ],
    'Gauteng': [
      'Johannesburg', 'Pretoria', 'Centurion', 'Sandton', 'Randburg', 'Roodepoort', 'Benoni',
      'Boksburg', 'Kempton Park', 'Germiston', 'Alberton', 'Vereeniging', 'Soweto', 'Midrand',
      'Fourways', 'Rosebank', 'Melville', 'Parktown', 'Bryanston', 'Edenvale'
    ],
    'KwaZulu-Natal': [
      'Durban', 'Pietermaritzburg', 'Umhlanga', 'Ballito', 'Richards Bay', 'Newcastle',
      'Ladysmith', 'Pinetown', 'Westville', 'Hillcrest', 'Amanzimtoti', 'Margate', 'Port Shepstone',
      'Scottburgh', 'Kloof', 'Glenwood', 'Berea', 'Morningside', 'La Lucia', 'Umkomaas'
    ],
    'Eastern Cape': [
      'Port Elizabeth', 'East London', 'Mthatha', 'Uitenhage', 'Queenstown', 'Grahamstown',
      'Butterworth', 'King William\'s Town', 'Graaff-Reinet', 'Jeffreys Bay', 'Stutterheim',
      'Alice', 'Cradock', 'Port Alfred', 'Somerset East', 'Addo', 'St Francis Bay', 'Humansdorp',
      'Kirkwood', 'Port St Johns'
    ],
    'Free State': [
      'Bloemfontein', 'Welkom', 'Kroonstad', 'Bethlehem', 'Sasolburg', 'Virginia', 'Phuthaditjhaba',
      'Botshabelo', 'Thaba Nchu', 'Harrismith', 'Parys', 'Frankfort', 'Ficksburg', 'Ladybrand',
      'Wesselsbron', 'Bothaville', 'Vrede', 'Reitz', 'Senekal', 'Clarens'
    ],
    'Limpopo': [
      'Polokwane', 'Tzaneen', 'Phalaborwa', 'Lephalale', 'Mokopane', 'Thohoyandou', 'Louis Trichardt',
      'Giyani', 'Bela-Bela', 'Modimolle', 'Hoedspruit', 'Musina', 'Vaalwater', 'Tzaneen',
      'Duiwelskloof', 'Makhado', 'Nylstroom', 'Warmbaths', 'Tzaneen', 'Haenertsburg'
    ],
    'Mpumalanga': [
      'Nelspruit', 'Witbank', 'Secunda', 'Middelburg', 'Standerton', 'Ermelo', 'Barberton',
      'White River', 'Hazyview', 'Sabie', 'Piet Retief', 'Malelane', 'Komatipoort', 'Bethal',
      'Carolina', 'Lydenburg', 'Graskop', 'Pilgrim\'s Rest', 'Badplaas', 'Belfast'
    ],
    'North West': [
      'Rustenburg', 'Potchefstroom', 'Klerksdorp', 'Mahikeng', 'Brits', 'Lichtenburg', 'Vryburg',
      'Zeerust', 'Stilfontein', 'Orkney', 'Hartbeespoort', 'Koster', 'Wolmaransstad', 'Coligny',
      'Delareyville', 'Sannieshof', 'Ottosdal', 'Ganyesa', 'Taung', 'Mmabatho'
    ],
    'Northern Cape': [
      'Kimberley', 'Upington', 'Springbok', 'De Aar', 'Kuruman', 'Kathu', 'Postmasburg',
      'Prieska', 'Calvinia', 'Sutherland', 'Port Nolloth', 'Alexander Bay', 'Nieuwoudtville',
      'Carnarvon', 'Williston', 'Fraserburg', 'Loeriesfontein', 'Van Wyksvlei', 'Garies', 'Pofadder'
    ]
  },
  US: {
    'California': [
      'Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno', 'Sacramento', 'Long Beach',
      'Oakland', 'Anaheim', 'Santa Ana', 'Bakersfield', 'Riverside', 'Stockton', 'Chula Vista',
      'Irvine', 'Fremont', 'San Bernardino', 'Modesto', 'Oxnard', 'Fontana'
    ],
    'New York': [
      'New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany', 'New Rochelle',
      'Mount Vernon', 'Schenectady', 'Utica', 'White Plains', 'Hempstead', 'Troy', 'Niagara Falls',
      'Binghamton', 'Freeport', 'Valley Stream', 'Long Beach', 'Rome', 'North Tonawanda'
    ],
    'Texas': [
      'Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington',
      'Corpus Christi', 'Plano', 'Laredo', 'Lubbock', 'Garland', 'Irving', 'Amarillo',
      'Grand Prairie', 'Brownsville', 'Pasadena', 'McKinney', 'Mesquite', 'McAllen'
    ]
  },
  GB: {
    'England': [
      'London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Newcastle', 'Sheffield',
      'Bristol', 'Leicester', 'Coventry', 'Hull', 'Nottingham', 'Plymouth', 'Stoke-on-Trent',
      'Wolverhampton', 'Derby', 'Swansea', 'Southampton', 'Salford', 'Portsmouth'
    ],
    'Scotland': [
      'Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness', 'Perth', 'Stirling',
      'Dunfermline', 'Ayr', 'Kilmarnock', 'Paisley', 'East Kilbride', 'Livingston', 'Hamilton',
      'Cumbernauld', 'Kirkcaldy', 'Dunfermline', 'Motherwell', 'Falkirk', 'St Andrews'
    ],
    'Wales': [
      'Cardiff', 'Swansea', 'Newport', 'Bangor', 'St Davids', 'St Asaph', 'Wrexham',
      'Rhyl', 'Barry', 'Caerphilly', 'Bridgend', 'Merthyr Tydfil', 'Aberystwyth', 'Llandudno',
      'Colwyn Bay', 'Mold', 'Haverfordwest', 'Llanelli', 'Porthcawl', 'Pontypridd'
    ]
  },
  NG: {
    'Lagos': [
      'Lagos', 'Ikeja', 'Surulere', 'Victoria Island', 'Lekki', 'Ajah', 'Ikoyi', 'Apapa',
      'Yaba', 'Oshodi', 'Mushin', 'Ikorodu', 'Badagry', 'Epe', 'Ibeju-Lekki', 'Magodo',
      'Gbagada', 'Maryland', 'Ogba', 'Alimosho'
    ],
    'Abuja': [
      'Abuja', 'Garki', 'Wuse', 'Maitama', 'Asokoro', 'Jabi', 'Kubwa', 'Gwarinpa',
      'Lugbe', 'Nyanya', 'Karu', 'Suleja', 'Bwari', 'Kuje', 'Gwagwalada', 'Dutse',
      'Lokogoma', 'Gudu', 'Utako', 'Apo'
    ],
    'Kano': [
      'Kano', 'Fagge', 'Nasarawa', 'Tarauni', 'Dala', 'Gwale', 'Kumbotso', 'Ungogo',
      'Dawakin Tofa', 'Tofa', 'Rimin Gado', 'Bagwai', 'Gezawa', 'Gabasawa', 'Minjibir',
      'Dawakin Kudu', 'Bichi', 'Tsanyawa', 'Kunchi', 'Makoda'
    ],
    'Rivers': [
      'Port Harcourt', 'Obio-Akpor', 'Eleme', 'Okrika', 'Ogu-Bolo', 'Ahoada', 'Degema',
      'Bonny', 'Opobo', 'Andoni', 'Oyigbo', 'Etche', 'Omuma', 'Ikwerre', 'Emohua',
      'Asari-Toru', 'Akuku-Toru', 'Abua-Odual', 'Ogba-Egbema-Ndoni', 'Tai'
    ],
    'Oyo': [
      'Ibadan', 'Oyo', 'Ogbomoso', 'Iseyin', 'Saki', 'Eruwa', 'Igboho', 'Igbeti',
      'Kisi', 'Ibarapa', 'Okeho', 'Igboora', 'Awe', 'Fiditi', 'Ilero', 'Lanlate',
      'Idere', 'Igbo-Ora', 'Tede', 'Ago-Are'
    ],
    'Delta': [
      'Asaba', 'Warri', 'Sapele', 'Ughelli', 'Agbor', 'Oghara', 'Koko', 'Burutu',
      'Ozoro', 'Kwale', 'Oleh', 'Isiokolo', 'Abraka', 'Oghara', 'Obiaruku', 'Umunede',
      'Ogwashi-Uku', 'Ibusa', 'Okpanam', 'Ubulu-Uku'
    ],
    'Kaduna': [
      'Kaduna', 'Zaria', 'Kafanchan', 'Saminaka', 'Makarfi', 'Kachia', 'Kagoro',
      'Kajuru', 'Jema\'a', 'Soba', 'Ikara', 'Kubau', 'Lere', 'Giwa', 'Birnin Gwari',
      'Chikun', 'Igabi', 'Kauru', 'Kudan', 'Sabon Gari'
    ],
    'Ogun': [
      'Abeokuta', 'Sagamu', 'Ijebu-Ode', 'Ilaro', 'Ota', 'Iperu', 'Ijebu-Igbo',
      'Ayetoro', 'Ifo', 'Owode', 'Ijebu-Ife', 'Ijebu-Mushin', 'Odeda', 'Imeko',
      'Ipokia', 'Odogbolu', 'Remo North', 'Yewa North', 'Yewa South', 'Ewekoro'
    ],
    'Ondo': [
      'Akure', 'Ondo', 'Owo', 'Okitipupa', 'Ikare', 'Ore', 'Idanre', 'Igbokoda',
      'Ode-Aye', 'Igbara-Oke', 'Igbara-Odo', 'Iju', 'Ita-Ogbolu', 'Oba-Ile', 'Ondo',
      'Ore', 'Owo', 'Ikare-Akoko', 'Oka-Akoko', 'Isua-Akoko'
    ],
    'Enugu': [
      'Enugu', 'Nsukka', 'Agbani', 'Awgu', 'Udi', 'Oji-River', 'Nkanu', 'Ezeagu',
      'Isi-Uzo', 'Nkanu East', 'Nkanu West', 'Udenu', 'Igbo-Eze North', 'Igbo-Eze South',
      'Nsukka', 'Uzo-Uwani', 'Enugu East', 'Enugu North', 'Enugu South', 'Enugu West'
    ]
  },
  KE: {
    'Nairobi': [
      'Nairobi', 'Westlands', 'Kilimani', 'Lavington', 'Karen', 'Langata', 'Donholm',
      'Buruburu', 'South B', 'South C', 'Embakasi', 'Kasarani', 'Ruiru', 'Thika',
      'Kiambu', 'Limuru', 'Kikuyu', 'Ngong', 'Ongata Rongai', 'Kitengela'
    ],
    'Mombasa': [
      'Mombasa', 'Nyali', 'Bamburi', 'Shanzu', 'Likoni', 'Changamwe', 'Kisauni',
      'Mtwapa', 'Kilifi', 'Malindi', 'Watamu', 'Lamu', 'Diani', 'Ukunda', 'Voi',
      'Mariakani', 'Mazeras', 'Miritini', 'Port Reitz', 'Bombolulu'
    ],
    'Kisumu': [
      'Kisumu', 'Milimani', 'Tom Mboya', 'Kondele', 'Nyalenda', 'Manyatta', 'Nyamasaria',
      'Kibos', 'Ahero', 'Awasi', 'Muhoroni', 'Sondu', 'Kendu Bay', 'Homa Bay',
      'Oyugis', 'Kapsabet', 'Eldoret', 'Kericho', 'Bomet', 'Narok'
    ]
  },
  GH: {
    'Greater Accra': [
      'Accra', 'Tema', 'East Legon', 'West Legon', 'Cantonments', 'Osu', 'Labone',
      'Dansoman', 'Madina', 'Adenta', 'Ashaiman', 'Nungua', 'Teshie', 'La', 'Spintex',
      'Airport Residential', 'Ridge', 'Kokomlemle', 'Achimota', 'Kasoa'
    ],
    'Ashanti': [
      'Kumasi', 'Obuasi', 'Ejisu', 'Mampong', 'Konongo', 'Bekwai', 'Asokwa',
      'Suame', 'Tafo', 'Bantama', 'Manhyia', 'Santasi', 'Ayigya', 'Patasi',
      'Deduako', 'Atonsu', 'Ahodwo', 'Fomena', 'Ejura', 'Mamponteng'
    ]
  },
  EG: {
    'Cairo': [
      'Cairo', 'Giza', 'Maadi', 'Heliopolis', 'Nasr City', 'New Cairo', '6th of October',
      'Sheikh Zayed', 'Dokki', 'Mohandessin', 'Zamalek', 'Aguza', 'Shubra', 'Ain Shams',
      'Helwan', 'Badr City', 'New Giza', 'Katameya', 'Rehab', 'Madinaty'
    ],
    'Alexandria': [
      'Alexandria', 'Agami', 'Miami', 'Sidi Gaber', 'Smouha', 'Louran', 'Miami',
      'Glim', 'Saba Pasha', 'Mandraki', 'Borg El Arab', 'New Borg El Arab',
      'Abu Qir', 'Montaza', 'Ras El Tin', 'Mansheya', 'Kafr Abdo', 'Sidi Bishr',
      'Asafra', 'Karmouz'
    ]
  },
  IN: {
    'Maharashtra': [
      'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur',
      'Amravati', 'Kolhapur', 'Sangli', 'Jalgaon', 'Akola', 'Latur', 'Ahmednagar',
      'Chandrapur', 'Parbhani', 'Ichalkaranji', 'Jalna', 'Bhusawal', 'Panvel'
    ],
    'Delhi': [
      'New Delhi', 'Delhi Cantonment', 'Dwarka', 'Rohini', 'Pitampura', 'Rohini',
      'Janakpuri', 'Saket', 'Vasant Kunj', 'Hauz Khas', 'Lajpat Nagar', 'Defence Colony',
      'Greater Kailash', 'Connaught Place', 'Karol Bagh', 'Rajouri Garden', 'Paschim Vihar',
      'Patel Nagar', 'Shahdara', 'Seelampur'
    ],
    'Karnataka': [
      'Bangalore', 'Mysore', 'Hubli', 'Mangalore', 'Belgaum', 'Gulbarga', 'Davanagere',
      'Bellary', 'Bijapur', 'Shimoga', 'Tumkur', 'Raichur', 'Bidar', 'Hospet',
      'Gadag', 'Chitradurga', 'Kolar', 'Mandya', 'Hassan', 'Chikmagalur'
    ]
  },
  CN: {
    'Beijing': [
      'Beijing', 'Chaoyang', 'Haidian', 'Xicheng', 'Dongcheng', 'Fengtai', 'Shijingshan',
      'Tongzhou', 'Changping', 'Daxing', 'Fangshan', 'Mentougou', 'Shunyi', 'Huairou',
      'Pinggu', 'Miyun', 'Yanqing', 'Beijing Economic-Technological Development Area',
      'Beijing Capital International Airport', 'Beijing CBD', 'Beijing Financial Street'
    ],
    'Shanghai': [
      'Shanghai', 'Pudong', 'Puxi', 'Huangpu', 'Xuhui', 'Changning', 'Jing\'an',
      'Putuo', 'Hongkou', 'Yangpu', 'Minhang', 'Baoshan', 'Jiading', 'Jinshan',
      'Songjiang', 'Qingpu', 'Fengxian', 'Chongming', 'Shanghai Free Trade Zone',
      'Lujiazui', 'Xujiahui'
    ]
  },
  JP: {
    'Tokyo': [
      'Tokyo', 'Shibuya', 'Shinjuku', 'Ginza', 'Roppongi', 'Akihabara', 'Harajuku',
      'Ikebukuro', 'Ueno', 'Asakusa', 'Odaiba', 'Tsukiji', 'Ebisu', 'Meguro',
      'Nakameguro', 'Daikanyama', 'Jiyugaoka', 'Kichijoji', 'Nakano', 'Koenji'
    ],
    'Osaka': [
      'Osaka', 'Umeda', 'Namba', 'Shinsaibashi', 'Dotonbori', 'Tennoji', 'Nipponbashi',
      'Amerikamura', 'Horie', 'Nakazakicho', 'Kitashinchi', 'Sakuranomiya', 'Tsuruhashi',
      'Abeno', 'Tanimachi', 'Kyobashi', 'Tengachaya', 'Imazato', 'Taisho', 'Nishinari'
    ]
  },
  SG: {
    'Central Region': [
      'Singapore', 'Orchard', 'Marina Bay', 'Raffles Place', 'Tanjong Pagar', 'Chinatown',
      'Clarke Quay', 'Robertson Quay', 'Boat Quay', 'Bugis', 'Little India', 'Dhoby Ghaut',
      'Somerset', 'Novena', 'Toa Payoh', 'Bishan', 'Ang Mo Kio', 'Serangoon', 'Paya Lebar',
      'Eunos'
    ],
    'East Region': [
      'Tampines', 'Bedok', 'Pasir Ris', 'Simei', 'Changi', 'Loyang', 'Siglap',
      'Katong', 'Joo Chiat', 'Geylang', 'Kallang', 'Paya Lebar', 'Eunos', 'Kembangan',
      'Bedok Reservoir', 'Tampines North', 'Tampines West', 'Tampines East', 'Tampines Central',
      'Tampines South'
    ]
  },
  AE: {
    'Dubai': [
      'Dubai', 'Downtown Dubai', 'Dubai Marina', 'Jumeirah', 'Palm Jumeirah', 'Business Bay',
      'Deira', 'Bur Dubai', 'Al Barsha', 'Jumeirah Beach Residence', 'Dubai Internet City',
      'Dubai Media City', 'Dubai Knowledge Park', 'Dubai Sports City', 'Dubai Healthcare City',
      'Dubai Design District', 'Dubai Silicon Oasis', 'Dubai International City',
      'Dubai Motor City', 'Dubai Production City'
    ],
    'Abu Dhabi': [
      'Abu Dhabi', 'Al Reem Island', 'Yas Island', 'Saadiyat Island', 'Al Raha Beach',
      'Khalifa City', 'Al Reef', 'Al Ghadeer', 'Al Raha Gardens', 'Al Bandar', 'Al Muneera',
      'Al Zeina', 'Al Raha', 'Al Wahda', 'Al Nahyan', 'Al Karamah', 'Al Mushrif',
      'Al Bateen', 'Al Manaseer', 'Al Muroor'
    ]
  }
}; 