const axios = require('axios');

const NAGER_API = 'https://date.nager.at/api/v3';
const POLL_INTERVAL_MS = 10 * 60 * 1000;
const CALENDAR_REFRESH_MS = 24 * 60 * 60 * 1000;
const BACKGROUNDS = [
  'linear-gradient(135deg, #075985 0%, #312e81 55%, #701a75 100%)',
  'linear-gradient(135deg, #166534 0%, #0f766e 55%, #1d4ed8 100%)',
  'linear-gradient(135deg, #9a3412 0%, #be123c 55%, #7e22ce 100%)',
  'linear-gradient(135deg, #854d0e 0%, #b45309 55%, #be123c 100%)',
];

let workerStarted = false;
let lastCalendarSyncAt = 0;
let calendarSyncYear = 0;
let running = false;

function serviceConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  return url && key ? { url, key } : null;
}

function headers(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function countryFlag(countryCode) {
  const code = String(countryCode || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '🎉';
  return [...code].map(letter => String.fromCodePoint(letter.charCodeAt(0) + 127397)).join('');
}

function backgroundFor(countryCode) {
  const index = [...String(countryCode || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % BACKGROUNDS.length;
  return BACKGROUNDS[index];
}

function eventKey(countryCode, eventDate, name) {
  const slug = String(name || 'holiday').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${countryCode}:${eventDate}:${slug}`;
}

async function mapWithConcurrency(items, concurrency, callback) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        await callback(items[index]);
      } catch (error) {
        console.warn('Special-day calendar country sync failed:', items[index]?.countryCode, error.response?.status || error.message);
      }
    }
  });
  await Promise.all(workers);
}

async function syncCalendar(config, year) {
  const countriesResponse = await axios.get(`${NAGER_API}/AvailableCountries`, { timeout: 15000 });
  const countries = Array.isArray(countriesResponse.data) ? countriesResponse.data : [];
  let imported = 0;

  await mapWithConcurrency(countries, 5, async country => {
    const code = String(country.countryCode || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return;

    const response = await axios.get(`${NAGER_API}/PublicHolidays/${year}/${code}`, { timeout: 15000 });
    const holidays = Array.isArray(response.data) ? response.data : [];
    const rows = holidays
      .filter(holiday => Array.isArray(holiday.types) && holiday.types.some(type => ['Public', 'Observance'].includes(type)))
      .filter(holiday => /^\d{4}-\d{2}-\d{2}$/.test(holiday.date || ''))
      .map(holiday => {
        const localName = String(holiday.localName || holiday.name || 'Special day').slice(0, 200);
        const name = String(holiday.name || localName).slice(0, 200);
        return {
          external_key: eventKey(code, holiday.date, name),
          event_date: holiday.date,
          country_code: code,
          name,
          local_name: localName,
          description: `${localName}${name !== localName ? ` (${name})` : ''} is observed in ${country.name}.`,
          icon: countryFlag(code),
          background: backgroundFor(code),
          event_types: holiday.types || [],
          is_national: Boolean(holiday.global),
          source: 'Nager.Date',
          is_enabled: true,
          updated_at: new Date().toISOString(),
        };
      });

    for (let offset = 0; offset < rows.length; offset += 100) {
      const batch = rows.slice(offset, offset + 100);
      if (!batch.length) continue;
      await axios.post(
        `${config.url}/rest/v1/platform_special_days?on_conflict=external_key`,
        batch,
        { headers: headers(config.key, { Prefer: 'resolution=merge-duplicates,return=minimal' }), timeout: 20000 }
      );
      imported += batch.length;
    }
  });

  console.log(`Special-day calendar synced for ${year}: ${imported} country holiday records`);
}

async function resolveAuthorId(config) {
  if (process.env.SPECIAL_DAYS_AUTHOR_ID) return process.env.SPECIAL_DAYS_AUTHOR_ID;
  const response = await axios.get(
    `${config.url}/rest/v1/user_roles?select=user_id&role=eq.admin&limit=1`,
    { headers: headers(config.key), timeout: 10000 }
  );
  return response.data?.[0]?.user_id || null;
}

async function expireCelebrationPins(config) {
  const now = new Date().toISOString();
  await axios.patch(
    `${config.url}/rest/v1/posts?is_platform_celebration=eq.true&pinned_until=lt.${encodeURIComponent(now)}`,
    { pinned_until: null },
    { headers: headers(config.key, { Prefer: 'return=minimal' }), timeout: 10000 }
  );
}

async function publishToday(config) {
  const today = new Date().toISOString().slice(0, 10);
  const [eventResponse, authorId] = await Promise.all([
    axios.get(
      `${config.url}/rest/v1/platform_special_days?select=*&event_date=eq.${today}&is_enabled=eq.true&order=country_code.asc`,
      { headers: headers(config.key), timeout: 10000 }
    ),
    resolveAuthorId(config),
  ]);
  const events = eventResponse.data || [];
  if (!events.length) return;
  if (!authorId) {
    console.error('Special-day posts were not published: set SPECIAL_DAYS_AUTHOR_ID or create an admin role.');
    return;
  }

  for (const event of events) {
    const label = event.local_name || event.name;
    const post = {
      user_id: authorId,
      content: `${event.icon || '🎉'} ${label}\n\n${event.description || `Celebrate ${label} with the NexSq community!`}`,
      post_type: 'moment',
      privacy: 'public',
      share_to_feed: true,
      moment_type: 'text',
      moment_bg: event.background,
      moment_special_bg: event.background,
      moment_font: 'Inter',
      moment_font_size: 32,
      moment_special_name: label,
      moment_special_message: event.description || `Celebrate ${label} with the NexSq community!`,
      moment_special_icon: event.icon || '🎉',
      moment_special_type: event.event_types?.includes('Public') ? 'holiday' : 'observance',
      moment_special_id: String(event.id),
      moment_special_countries: [event.country_code],
      is_custom_special_day: false,
      is_platform_celebration: true,
      platform_special_day_id: event.id,
      pinned_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    try {
      await axios.post(
        `${config.url}/rest/v1/posts?on_conflict=platform_special_day_id`,
        [post],
        { headers: headers(config.key, { Prefer: 'resolution=ignore-duplicates,return=minimal' }), timeout: 15000 }
      );
      console.log(`Published platform celebration: ${event.country_code} ${label}`);
    } catch (error) {
      console.error(`Could not publish platform celebration ${event.external_key}:`, error.response?.data || error.message);
    }
  }
}

async function runPlatformSpecialDayWorker() {
  if (running) return;
  running = true;
  try {
    const config = serviceConfig();
    if (!config) return;
    const year = new Date().getUTCFullYear();
    if (calendarSyncYear !== year || Date.now() - lastCalendarSyncAt >= CALENDAR_REFRESH_MS) {
      await syncCalendar(config, year);
      calendarSyncYear = year;
      lastCalendarSyncAt = Date.now();
    }
    await expireCelebrationPins(config);
    await publishToday(config);
  } catch (error) {
    console.error('Platform special-day worker failed:', error.response?.data || error.message);
  } finally {
    running = false;
  }
}

function startPlatformSpecialDayWorker() {
  if (workerStarted) return;
  workerStarted = true;
  if (!serviceConfig()) {
    console.warn('Platform special-day worker disabled: Supabase service credentials are missing');
    return;
  }
  void runPlatformSpecialDayWorker();
  const timer = setInterval(runPlatformSpecialDayWorker, POLL_INTERVAL_MS);
  timer.unref();
}

module.exports = { startPlatformSpecialDayWorker, runPlatformSpecialDayWorker };