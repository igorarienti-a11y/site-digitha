const crypto = require('crypto');

const SPREADSHEET_ID = '1T6tdglDqvB8kTdFqCLTw4riC-9xFqhZeEh4D0e14Bdw';
const SHEET_NAME     = 'Leads';

async function getAccessToken(creds) {
  const now    = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim  = Buffer.from(JSON.stringify({
    iss:   creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  })).toString('base64url');

  const unsigned  = `${header}.${claim}`;
  const sign      = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(creds.private_key, 'base64url');
  const jwt       = `${unsigned}.${signature}`;

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  return data.access_token;
}

function formatPhone(raw) {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2);
  return '+55' + d;
}

function getIso() {
  return new Date().toLocaleString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    hour12:   false,
  }).replace(' ', 'T') + '-03:00';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const d    = req.body;
    const utms = d.utms || {};
    const mkt  = { sim: 'Sim, time interno', nao: 'Não possui', parcial: 'Parcial (freelancer/agência)' };

    const row = [
      getIso(),
      d.name  || '',
      (d.email || '').toLowerCase().trim(),
      formatPhone(d.phone),
      d.nicho || '',
      mkt[d.marketing] || d.marketing || '',
      (d.message || '').trim(),
      '',
      utms.utm_source   || '',
      utms.utm_medium   || '',
      utms.utm_campaign || '',
      utms.utm_term     || '',
      utms.utm_content  || '',
    ];

    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const token = await getAccessToken(creds);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A:M:append?valueInputOption=USER_ENTERED`;
    const response = await fetch(url, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ values: [row] }),
    });

    const result = await response.json();
    return res.status(200).json({ success: true, result });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
