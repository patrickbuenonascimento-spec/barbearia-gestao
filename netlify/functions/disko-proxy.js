function headers() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
}

function isDiskoUrl(raw) {
  return /^https:\/\/[a-z0-9.-]*disko\.com\.br\//i.test(String(raw || '').trim());
}

function toIsoDate(value, offsetDays = 0) {
  let y, m, d;
  const s = String(value || '').trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const br = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (iso) { y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]); }
  else if (br) { d = Number(br[1]); m = Number(br[2]); y = Number(br[3].length === 2 ? '20' + br[3] : br[3]); }
  else {
    const now = new Date();
    y = now.getFullYear(); m = now.getMonth() + 1; d = now.getDate();
  }
  const dt = new Date(y, m - 1, d + offsetDays, 12, 0, 0);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function brDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

function addParam(rawUrl, key, value) {
  const u = new URL(rawUrl);
  u.searchParams.set(key, value);
  return u.toString();
}

function variantsFor(rawUrl, iso) {
  const br = brDate(iso);
  const compact = iso.replace(/-/g, '');
  return Array.from(new Set([
    rawUrl,
    addParam(rawUrl, 'date', iso),
    addParam(rawUrl, 'data', iso),
    addParam(rawUrl, 'dia', iso),
    addParam(rawUrl, 'day', iso),
    addParam(rawUrl, 'd', iso),
    addParam(rawUrl, 'date', br),
    addParam(rawUrl, 'data', br),
    addParam(rawUrl, 'date', compact)
  ]));
}

function cleanText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueSortedTimes(list) {
  return Array.from(new Set(list || []))
    .filter(t => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t))
    .sort((a, b) => a.localeCompare(b));
}

function classifyTimes(html) {
  const raw = String(html || '');
  const text = cleanText(raw);
  const matches = Array.from(text.matchAll(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g));
  const all = [];
  const available = [];
  const unavailable = [];
  for (const m of matches) {
    const time = m[0];
    const start = Math.max(0, m.index - 90);
    const end = Math.min(text.length, m.index + 120);
    const ctx = text.slice(start, end).toLowerCase();
    all.push(time);
    if (/indispon[ií]vel|ocupad|reservad|bloquead|lotad|encerrad|sem hor[aá]rio|unavailable|busy/.test(ctx)) unavailable.push(time);
    if (/dispon[ií]vel|livre|selecion|agendar|marcar|available|book/.test(ctx)) available.push(time);
  }
  const allTimes = uniqueSortedTimes(all).slice(0, 160);
  const unavailableTimes = uniqueSortedTimes(unavailable).slice(0, 160);
  let availableTimes = uniqueSortedTimes(available).slice(0, 160);
  if (!availableTimes.length && allTimes.length) {
    // A página pública de agendamento normalmente exibe apenas horários livres.
    availableTimes = allTimes.filter(t => !unavailableTimes.includes(t));
  }
  const dates = Array.from(new Set((text.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g) || []))).slice(0, 160);
  return { times: allTimes, availableTimes, unavailableTimes, dates, textLength: text.length };
}

async function fetchOne(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 Netlify Disko Proxy',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  const html = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (/ServiceLogin|accounts\.google|<title>\s*Login/i.test(html)) throw new Error('Página retornou login/permissão.');
  return { url, html, ...classifyTimes(html), htmlLength: html.length };
}

exports.handler = async (event) => {
  const h = headers();
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
  try {
    const rawUrl = String(event.queryStringParameters?.url || '').trim();
    if (!rawUrl || !isDiskoUrl(rawUrl)) {
      return { statusCode: 400, headers: h, body: JSON.stringify({ ok:false, message:'URL Disko inválida. Use o link público da agenda Disko.' }) };
    }
    const days = Math.min(30, Math.max(1, Number(event.queryStringParameters?.days || 10) || 10));
    const start = toIsoDate(event.queryStringParameters?.start || '', 0);
    const perDay = [];
    const errors = [];

    for (let i = 0; i < days; i++) {
      const iso = toIsoDate(start, i);
      let best = null;
      for (const candidate of variantsFor(rawUrl, iso)) {
        try {
          const item = await fetchOne(candidate);
          if (!best || (item.availableTimes.length + item.times.length) > (best.availableTimes.length + best.times.length)) best = item;
          if (item.availableTimes.length) break;
        } catch (err) {
          errors.push({ date: iso, url: candidate, message: String(err.message || err) });
        }
      }
      perDay.push({
        date: iso,
        label: brDate(iso),
        url: best?.url || rawUrl,
        times: best?.times || [],
        availableTimes: best?.availableTimes || [],
        unavailableTimes: best?.unavailableTimes || [],
        dates: best?.dates || [],
        htmlLength: best?.htmlLength || 0,
        status: best ? 'ok' : 'sem-retorno'
      });
    }

    const allTimes = uniqueSortedTimes(perDay.flatMap(d => d.times));
    const allAvailable = uniqueSortedTimes(perDay.flatMap(d => d.availableTimes));
    return { statusCode: 200, headers: h, body: JSON.stringify({ ok:true, url: rawUrl, start, days: perDay, times: allTimes, availableTimes: allAvailable, errors }) };
  } catch (err) {
    return { statusCode: 200, headers: h, body: JSON.stringify({ ok:false, message:String(err.message || err) }) };
  }
};