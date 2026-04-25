export const config = { runtime: 'edge' };

const SPREADSHEET_ID  = '1T6tdglDqvB8kTdFqCLTw4riC-9xFqhZeEh4D0e14Bdw';
const SHEET_NAME      = 'Leads';
const SHEET_PAGEVIEWS = 'Pageviews';
const META_API_VER    = 'v19.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function getAccessToken(serviceAccountKey) {
  const key = JSON.parse(serviceAccountKey);

  const base64UrlEncode = (obj) => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const now = Math.floor(Date.now() / 1000);
  const headerEncoded  = base64UrlEncode({ alg: 'RS256', typ: 'JWT' });
  const payloadEncoded = base64UrlEncode({
    iss:   key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  });

  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  const pemContents = key.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwt = `${signatureInput}.${signatureBase64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error(`Token error: ${tokenData.error_description}`);
  return tokenData.access_token;
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizePhone(raw) {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2);
  return '55' + d;
}

function normalizeName(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

function normalizeCity(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

async function sendMetaLead(d, geo, ip, ts) {
  const pixelId = process.env.META_PIXEL_ID;
  const token   = process.env.META_ACCESS_TOKEN;
  if (!pixelId || !token) return;

  const nameParts = (d.name || '').trim().split(/\s+/);
  const firstName = d.first_name || nameParts[0] || '';
  const lastName  = d.last_name  || nameParts.slice(1).join(' ') || '';

  const [em, ph, fn, ln, country, extId, ct, st, zp] = await Promise.all([
    sha256((d.email || '').toLowerCase().trim()),
    sha256(normalizePhone(d.phone)),
    sha256(normalizeName(firstName)),
    sha256(normalizeName(lastName)),
    sha256('br'),
    sha256(d.event_id || ''),
    geo.city   ? sha256(normalizeCity(geo.city))          : Promise.resolve(''),
    geo.region_code ? sha256(geo.region_code.toLowerCase().slice(0,2)) : Promise.resolve(''),
    geo.postal ? sha256(geo.postal.replace(/\D/g,'').substring(0,8))   : Promise.resolve(''),
  ]);

  const userData = { em, ph, fn, ln, country, external_id: extId,
    client_ip_address: ip, client_user_agent: d.user_agent || '' };
  if (d.fbp) userData.fbp = d.fbp;
  if (d.fbc) userData.fbc = d.fbc;
  if (ct) userData.ct = ct;
  if (st) userData.st = st;
  if (zp) userData.zp = zp;

  const payload = {
    data: [{
      event_name:   'Lead',
      event_time:   Math.floor(Date.now() / 1000),
      event_id:     d.event_id || '',
      action_source: 'website',
      event_source_url: d.page_url || '',
      user_data: userData,
    }],
  };

  await fetch(`https://graph.facebook.com/${META_API_VER}/${pixelId}/events?access_token=${token}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
}

function formatPhone(raw) {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2);
  return '+55' + d;
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function getLocalDate() {
  const now   = new Date();
  const offset = -3;
  const local  = new Date(now.getTime() + (offset * 60 + now.getTimezoneOffset()) * 60000);
  const pad    = n => String(n).padStart(2, '0');
  return {
    iso: `${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}-03:00`,
    br:  `${pad(local.getDate())}/${pad(local.getMonth()+1)}/${local.getFullYear()} ${pad(local.getHours())}:${pad(local.getMinutes())}`,
    mes: `${MESES[local.getMonth()]}/${local.getFullYear()}`,
  };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST')   return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const d    = await req.json();
    const utms = d.utms || {};

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
            || req.headers.get('x-real-ip')
            || '';

    // Geolocalização por IP — cidade, estado, CEP para Meta Advanced Matching
    let geo = { city: '', region_code: '', postal: '' };
    if (ip) {
      try {
        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, {
          headers: { 'User-Agent': 'digitha-site/1.0' }
        });
        if (geoRes.ok) {
          const g = await geoRes.json();
          geo = {
            city:        g.city        || '',
            region_code: (g.region_code || '').toLowerCase(),
            postal:      (g.postal      || '').replace(/\D/g, '').substring(0, 8),
          };
        }
      } catch (_) {}
    }

    const ts = getLocalDate();
    let sheetName, fieldMap;

    if (d.type === 'pageview') {
      sheetName = SHEET_PAGEVIEWS;
      fieldMap = {
        // ── visível ──────────────────────────────
        'mês':          ts.mes,
        'data':         ts.br,
        // ── origem ───────────────────────────────
        'page_url':     d.page_url   || '',
        'referrer':     d.referrer   || '',
        // ── utms ─────────────────────────────────
        'utm_source':   utms.utm_source   || '',
        'utm_medium':   utms.utm_medium   || '',
        'utm_campaign': utms.utm_campaign || '',
        'utm_term':     utms.utm_term     || '',
        'utm_content':  utms.utm_content  || '',
        // ── click ids ────────────────────────────
        'fbclid':       d.fbclid  || '',
        'gclid':        d.gclid   || '',
        'gbraid':       d.gbraid  || '',
        'wbraid':       d.wbraid  || '',
        'ttclid':       d.ttclid  || '',
        'msclkid':      d.msclkid || '',
        // ── cookies / advanced match ─────────────
        'fbp':          d.fbp || '',
        'fbc':          d.fbc || '',
        'idioma':       d.language   || '',
        'resolucao':    d.screen     || '',
        'fuso horario': d.timezone   || '',
        'ip':           ip,
        'navegador':    d.user_agent || '',
        'cidade':       geo.city,
        'estado':       geo.region_code,
        'cep':          geo.postal,
        // ── timestamp técnico ─────────────────────
        'data iso':     ts.iso,
      };
    } else {
      const mkt = { sim: 'Sim, time interno', nao: 'Não possui', parcial: 'Parcial (freelancer/agência)' };
      sheetName = SHEET_NAME;
      fieldMap = {
        // ── visível (comercial) ───────────────────
        'mês':                ts.mes,
        'data':               ts.br,
        'nome':               d.name  || '',
        'email':              (d.email || '').toLowerCase().trim(),
        'telefone':           formatPhone(d.phone),
        'empresa':            d.empresa || '',
        'nicho':              d.nicho || '',
        'marketing interno':  mkt[d.marketing] || d.marketing || '',
        'mensagem':           (d.message || '').trim(),
        'status':             '',
        // ── utms ─────────────────────────────────
        'utm_source':         utms.utm_source   || '',
        'utm_medium':         utms.utm_medium   || '',
        'utm_campaign':       utms.utm_campaign || '',
        'utm_term':           utms.utm_term     || '',
        'utm_content':        utms.utm_content  || '',
        // ── advanced match ────────────────────────
        'event id':           d.event_id  || '',
        'fbclid':             d.fbclid    || '',
        'gclid':              d.gclid     || '',
        'gbraid':             d.gbraid    || '',
        'wbraid':             d.wbraid    || '',
        'ttclid':             d.ttclid    || '',
        'msclkid':            d.msclkid   || '',
        'fbp':                d.fbp || '',
        'fbc':                d.fbc || '',
        'primeiro nome':      d.first_name || '',
        'sobrenome':          d.last_name  || '',
        'pagina':             d.page_url   || '',
        'referencia':         d.referrer   || '',
        'idioma':             d.language   || '',
        'resolucao':          d.screen     || '',
        'fuso horario':       d.timezone   || '',
        'ip':                 ip,
        'navegador':          d.user_agent || '',
        'cidade':             geo.city,
        'estado':             geo.region_code,
        'cep':                geo.postal,
        // ── timestamp técnico (ISO 8601 -03:00) ──
        'data iso':           ts.iso,
      };
    }

    let token;
    try {
      token = await getAccessToken(process.env.GOOGLE_CREDENTIALS);
    } catch (tokenErr) {
      throw new Error(`TOKEN_FAIL: ${tokenErr.message}`);
    }

    // Lê a linha 1 (cabeçalhos)
    const headersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!1:1`;
    const headersRes = await fetch(headersUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!headersRes.ok) throw new Error(`HEADERS_FAIL(${headersRes.status})`);

    const headersData = await headersRes.json();
    const headers = (headersData.values?.[0] || []).map(h => h.toLowerCase().trim());

    // Monta a linha na ordem dos cabeçalhos da planilha
    const row = headers.map(h => fieldMap[h] ?? '');

    // Grava
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const res = await fetch(appendUrl, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ values: [row] }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`SHEETS_FAIL(${res.status}): ${JSON.stringify(err)}`);
    }

    if (d.type !== 'pageview') {
      sendMetaLead(d, geo, ip, ts).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true }), {
      status:  200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status:  500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
