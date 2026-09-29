exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  try {
    const rawUrl = String(event.queryStringParameters?.url || '').trim();
    if (!rawUrl || !/^https:\/\/[a-z0-9.-]*disko\.com\.br\//i.test(rawUrl)) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok:false, message:'URL Disko inválida. Use o link público da agenda Disko.' }) };
    }
    const response = await fetch(rawUrl, { headers: { 'User-Agent':'Mozilla/5.0 Netlify Disko Proxy' } });
    const html = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const times = Array.from(new Set((html.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g) || []))).slice(0, 100);
    const dates = Array.from(new Set((html.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g) || []))).slice(0, 100);
    return { statusCode: 200, headers, body: JSON.stringify({ ok:true, url: rawUrl, times, dates, htmlLength: html.length }) };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok:false, message:String(err.message || err) }) };
  }
};
