const { google } = require('googleapis');

const SPREADSHEET_ID = '1T6tdglDqvB8kTdFqCLTw4riC-9xFqhZeEh4D0e14Bdw';
const SHEET_NAME     = 'Leads';

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
    hour12: false,
  }).replace(' ', 'T') + '-03:00';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const data = req.body;
    const utms = data.utms || {};

    const marketingMap = {
      sim:     'Sim, time interno',
      nao:     'Não possui',
      parcial: 'Parcial (freelancer/agência)',
    };

    const row = [
      getIso(),
      data.name  || '',
      (data.email || '').toLowerCase().trim(),
      formatPhone(data.phone),
      data.nicho || '',
      marketingMap[data.marketing] || data.marketing || '',
      (data.message || '').trim(),
      '',
      utms.utm_source   || '',
      utms.utm_medium   || '',
      utms.utm_campaign || '',
      utms.utm_term     || '',
      utms.utm_content  || '',
    ];

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:M`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
