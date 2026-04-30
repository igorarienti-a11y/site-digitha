// ==========================================
// CONFIGURAÇÕES
// ==========================================

const META_PIXEL_ID      = "SEU_PIXEL_ID_AQUI";
const META_ACCESS_TOKEN  = "SEU_ACCESS_TOKEN_AQUI";
const META_TEST_CODE     = "";  // cola aqui o test_event_code da Meta (ex: "TEST12345") só durante debug — depois deixa vazio

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const STATUS_EVENTS = {
  'Frio':           'LeadFrio',
  'Morno':          'LeadMorno',
  'Quente':         'LeadQualificado',
  'Fechado':        'LeadFechado',
  'Desqualificado': 'LeadDesqualificado',
};

const STATUS_FIELD = "Status";
const EMAIL_FIELD  = "Email";
const PHONE_FIELD  = "Telefone";
const NAME_FIELD   = "Nome";

const ENABLE_LOGS = true;


// ==========================================
// TRIGGER — onOpen
// Registra menu de utilitários na planilha
// ==========================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Leads')
    .addItem('Formatar + Reordenar todos', 'formatarTodosLeads')
    .addItem('Preencher Event IDs ausentes', 'preencherEventIDsAusentes')
    .addItem('Limpar Data ISO inválido',   'limparDataISOInvalido')
    .addItem('Configurar planilha',        'configurarTudo')
    .addItem('Testar envio CAPI',          'testarEnvio')
    .addItem('Diagnóstico',                'diagnosticar')
    .addItem('Limpar cache Meta',          'limparCache')
    .addToUi();
}

function gerarUUIDv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function preencherEventIDsAusentes() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  if (!sheet) { SpreadsheetApp.getUi().alert('Aba "Leads" não encontrada.'); return; }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const eventIdCol = headers.indexOf('Event ID') + 1;
  if (eventIdCol === 0) { SpreadsheetApp.getUi().alert('Coluna "Event ID" não encontrada.'); return; }

  const range  = sheet.getRange(2, eventIdCol, lastRow - 1, 1);
  const values = range.getValues();
  let preenchidos = 0;

  const novos = values.map(([v]) => {
    const s = String(v || '').trim();
    // Considera ausente se vazio ou se não é UUID válido (ex: "-")
    if (!s || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
      preenchidos++;
      return [gerarUUIDv4()];
    }
    return [v];
  });

  range.setNumberFormat('@').setValues(novos);
  SpreadsheetApp.getUi().alert('✅ ' + preenchidos + ' Event IDs preenchidos.');
  log('🔑 Event IDs gerados', { quantidade: preenchidos });
}


// ==========================================
// TRIGGER — onChange
// Lead inserido via Typebot → move para topo + formata + envia Lead via CAPI
// ==========================================

function onChange(e) {
  if (!e || e.changeType !== 'INSERT_ROW') return;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    logError('onChange:lock', err);
    return;
  }

  try {
    const ss = e.source;

    for (const name of ['Leads', 'Pageviews']) {
      try {
        const sheet = ss.getSheetByName(name);
        if (!sheet) { log('⚠️ Sheet não encontrada: ' + name); continue; }

        const lastRow = sheet.getLastRow();
        if (lastRow < 2) continue;

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const rowData = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];

        // Guard: verificar coluna-chave para saber se esta aba recebeu o insert
        const keyCol = name === 'Leads' ? headers.indexOf('Email') : headers.indexOf('Pagina');
        if (keyCol === -1 || !rowData[keyCol]) continue;

        sheet.insertRowBefore(2);
        sheet.getRange(2, 1, 1, sheet.getLastColumn()).setValues([rowData]);
        sheet.deleteRow(lastRow + 1);
        formatarLinha(sheet, 2);

        log('↑ Lead movido para o topo', { sheet: name, linhaOrigem: lastRow });

        if (name === 'Leads') {
          // Relê após formatarLinha para enviar dados já formatados à Meta
          const formattedRow = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
          const lead = {};
          headers.forEach((h, i) => { if (h) lead[h] = formattedRow[i] ? formattedRow[i].toString() : ''; });
          const result = sendToMeta(lead, 2, 'Lead', lead['Event ID'] || null);
          log('📊 Lead CAPI', { meta: result.success });
        }
      } catch (sheetErr) {
        logError('onChange:' + name, sheetErr);
      }
    }
  } finally {
    lock.releaseLock();
  }
}


// ==========================================
// TRIGGER — onEdit
// Mudança de Status na aba Leads dispara envio para Meta
// ==========================================

function onEdit(e) {
  if (e.range.getNumRows() > 1 || e.range.getNumColumns() > 1) return;

  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== 'Leads') return;

  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row === 1) return;

  try {
    const headers     = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const statusCol   = headers.indexOf(STATUS_FIELD) + 1;
    const statusValue = (e.value || '').toString().trim();

    if (statusCol > 0 && col === statusCol && STATUS_EVENTS[statusValue]) {
      log('🔥 Status → ' + statusValue, { linha: row });
      enviarLeadQualificado(sheet, row, headers, statusValue);
    }
  } catch (err) {
    logError('onEdit', err);
  }
}


// ==========================================
// ENVIO PRINCIPAL
// ==========================================

function enviarLeadQualificado(sheet, rowNumber, headers, status) {
  headers = headers || sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];

  const lead = {};
  headers.forEach((h, i) => { if (h) lead[h] = rowData[i] ? rowData[i].toString() : ''; });

  const eventName = STATUS_EVENTS[status];
  // Passa Event ID do lead para garantir dedup estável após reordenação
  const result = sendToMeta(lead, rowNumber, eventName, lead['Event ID'] || null);
  log('📊 Resultado envio', { linha: rowNumber, evento: eventName, meta: result.success });
  return result;
}


// ==========================================
// META — Conversions API
// ==========================================

function sendToMeta(lead, rowNumber, eventName, eventId) {
  try {
    if (META_PIXEL_ID === 'SEU_PIXEL_ID_AQUI')    return { success: false, error: 'Pixel não configurado' };
    if (META_ACCESS_TOKEN === 'SEU_ACCESS_TOKEN_AQUI') return { success: false, error: 'Token não configurado' };

    const props     = PropertiesService.getScriptProperties();
    if (!eventId) log('⚠️ Event ID ausente — dedup por rowNumber pode falhar após reordenação', { linha: rowNumber });
    const cachedKey = eventId
      ? 'meta_sent_' + eventName + '_' + eventId
      : 'meta_sent_' + eventName + '_' + rowNumber;

    if (props.getProperty(cachedKey)) {
      log('⏭️ Meta: já enviado', { linha: rowNumber, evento: eventName });
      return { success: false, skipped: true };
    }

    const userData = buildUserData(lead);
    if (!userData) return { success: false, error: 'Sem email ou telefone' };

    const eventTime = Math.floor(Date.now() / 1000);
    const payload = {
      data: [{
        event_name:    eventName,
        event_time:    eventTime,
        event_id:      eventId || (eventName + '_' + rowNumber + '_' + eventTime),
        action_source: 'system_generated',
        user_data:     userData
      }]
    };
    if (META_TEST_CODE) payload.test_event_code = META_TEST_CODE;
    const url = 'https://graph.facebook.com/v19.0/' + META_PIXEL_ID + '/events';
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + META_ACCESS_TOKEN },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const ok = res.getResponseCode() >= 200 && res.getResponseCode() < 300;
    if (ok) props.setProperty(cachedKey, new Date().toISOString());

    log('📡 Meta', { linha: rowNumber, status: res.getResponseCode(), ok });
    return { success: ok, statusCode: res.getResponseCode(), body: res.getContentText().substring(0, 200) };

  } catch (err) {
    logError('sendToMeta', err);
    return { success: false, error: err.toString() };
  }
}


// ==========================================
// HASH E NORMALIZAÇÃO — Meta Advanced Matching
// ==========================================

function buildUserData(lead) {
  const email = lead[EMAIL_FIELD];
  const phone = lead[PHONE_FIELD];

  if (!email && !phone) return null;

  const name  = lead[NAME_FIELD] || '';
  const parts = normalizeName(name).split(/\s+/);
  const fn    = parts[0] || '';
  const ln    = parts.slice(1).join(' ') || '';

  const ud = {};

  if (email) ud.em         = [sha256(normalizeEmail(email))];
  if (phone) ud.ph         = [sha256(normalizePhone(phone))];
  if (fn)    ud.fn         = [sha256(fn)];
  if (ln)    ud.ln         = [sha256(ln)];
  ud.country               = [sha256('br')];
  if (lead['Event ID'])  ud.external_id = [lead['Event ID'].toString()];
  if (lead['Cidade'])    ud.ct = [sha256(normalizeCity(lead['Cidade']))];
  if (lead['Estado'])    ud.st = [sha256(lead['Estado'].toLowerCase().substring(0, 2))];
  if (lead['CEP']) {
    const cep = lead['CEP'].toString().replace(/\D/g, '').padStart(8, '0');
    if (cep.length === 8) ud.zp = [sha256(cep)];
  }

  if (lead['IP'])        ud.client_ip_address = lead['IP'];
  if (lead['Navegador']) ud.client_user_agent  = lead['Navegador'];
  if (lead['FBC'])       ud.fbc                = lead['FBC'];
  if (lead['FBP'])       ud.fbp                = lead['FBP'];

  return ud;
}

function normalizeName(name) {
  return (name || '')
    .toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, '').trim();
}

function normalizeCity(city) {
  return (city || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

function sha256(value) {
  const str = (value == null ? '' : String(value));
  if (!str) return '';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str);
  return bytes.map(b => ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2)).join('');
}

function normalizeEmail(email) {
  return (email || '').toString().trim().toLowerCase();
}

function normalizePhone(phone) {
  if (!phone) return '';
  let d = phone.toString().replace(/\D/g, '');
  if (d.startsWith('0')) d = d.substring(1);
  if (d.startsWith('55')) return (d.length >= 12 && d.length <= 13) ? d : '';
  if (d.length === 11) return '55' + d;
  if (d.length === 10) { log('⚠️ Telefone rejeitado (10 dígitos — fixo ou sem nono dígito): ' + phone); return ''; }
  return '';
}


// ==========================================
// TESTES
// ==========================================

function testarEnvio() {
  const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  if (!sheet) { SpreadsheetApp.getUi().alert('Aba "Leads" não encontrada.'); return; }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf(STATUS_FIELD) + 1;

  let testRow = -1;
  let testStatus = '';
  for (let i = 2; i <= sheet.getLastRow(); i++) {
    const status = sheet.getRange(i, statusCol).getValue();
    if (STATUS_EVENTS[status]) { testRow = i; testStatus = status; break; }
  }

  if (testRow === -1) {
    SpreadsheetApp.getUi().alert('Nenhum lead com status válido encontrado.');
    return;
  }

  const props = PropertiesService.getScriptProperties();
  const testRowData = sheet.getRange(testRow, 1, 1, headers.length).getValues()[0];
  const testEventId = testRowData[headers.indexOf('Event ID')] || null;
  const testCacheKey = testEventId
    ? 'meta_sent_' + STATUS_EVENTS[testStatus] + '_' + testEventId
    : 'meta_sent_' + STATUS_EVENTS[testStatus] + '_' + testRow;
  props.deleteProperty(testCacheKey);

  const result = enviarLeadQualificado(sheet, testRow, headers, testStatus);

  SpreadsheetApp.getUi().alert(
    'Resultado Teste (linha ' + testRow + ' — ' + testStatus + ')',
    'Meta: ' + (result.success ? '✅ OK' : '❌ ' + (result.error || result.reason || 'HTTP ' + result.statusCode)) + '\n\n' +
    (META_PIXEL_ID === 'SEU_PIXEL_ID_AQUI' ? '⚠️ Configure META_PIXEL_ID e META_ACCESS_TOKEN no topo do script' : ''),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function diagnosticar() {
  const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  if (!sheet) { SpreadsheetApp.getUi().alert('Aba "Leads" não encontrada.'); return; }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const lastRow = sheet.getLastRow();
  const quentes = lastRow < 2 ? 0 : sheet
    .getRange(2, headers.indexOf(STATUS_FIELD) + 1, lastRow - 1, 1)
    .getValues().filter(r => r[0] === 'Quente').length;

  SpreadsheetApp.getUi().alert(
    'Diagnóstico',
    'Meta Pixel: '     + (META_PIXEL_ID === 'SEU_PIXEL_ID_AQUI' ? '❌ não configurado' : META_PIXEL_ID) + '\n\n' +
    'Coluna Status: '  + (headers.includes(STATUS_FIELD) ? '✅' : '❌') + '\n' +
    'Coluna Email: '   + (headers.includes(EMAIL_FIELD)  ? '✅' : '❌') + '\n' +
    'Coluna Telefone: '+ (headers.includes(PHONE_FIELD)  ? '✅' : '❌') + '\n\n' +
    'Leads Quentes: '  + quentes,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function limparCache() {
  const props = PropertiesService.getScriptProperties();
  const keys  = props.getKeys();
  keys.filter(k => k.startsWith('meta_sent_')).forEach(k => props.deleteProperty(k));
  SpreadsheetApp.getUi().alert('✅ Cache limpo. Todos os leads serão reenviados na próxima edição de Status.');
}


// ==========================================
// FORMATAÇÃO DAS ABAS (setup inicial)
// ==========================================

const HEADER_BG    = '#2D3748';
const HEADER_FG    = '#FFFFFF';
const BAND_ODD     = '#FFFFFF';
const BAND_EVEN    = '#EDF2F7';
const MES_BG       = '#F6AD55';
const MES_FG       = '#744210';
const SEC_UTM_BG   = '#E9D8FD';
const SEC_TECH_BG  = '#BEE3F8';

const STATUS_VALUES = ['Frio', 'Morno', 'Quente', 'Fechado', 'Desqualificado'];
const STATUS_TAGS   = [
  { value: 'Frio',           bg: '#BEE3F8', fg: '#2B6CB0' },
  { value: 'Morno',          bg: '#C6F6D5', fg: '#276749' },
  { value: 'Quente',         bg: '#FED7AA', fg: '#C05621' },
  { value: 'Fechado',        bg: '#9AE6B4', fg: '#22543D' },
  { value: 'Desqualificado', bg: '#FED7D7', fg: '#9B2335' },
];

const LEADS_HEADERS = [
  'Mês', 'Data', 'Nome', 'Email', 'Telefone', 'Empresa', 'Nicho', 'Marketing Interno', 'Mensagem', 'Status',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'Event ID', 'FBCLID', 'GCLID', 'GBRAID', 'WBRAID', 'TTCLID', 'MSCLKID',
  'FBP', 'FBC', 'Primeiro Nome', 'Sobrenome', 'Pagina', 'Referencia',
  'Idioma', 'Resolucao', 'Fuso Horario', 'IP', 'Navegador', 'Cidade', 'Estado', 'CEP',
  'Data ISO',
];

const PAGEVIEWS_HEADERS = [
  'Mês', 'Data', 'Pagina', 'Referencia',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'FBCLID', 'GCLID', 'GBRAID', 'WBRAID', 'TTCLID', 'MSCLKID',
  'FBP', 'FBC', 'Idioma', 'Resolucao', 'Fuso Horario', 'IP', 'Navegador', 'Cidade', 'Estado', 'CEP',
  'Data ISO',
];

function configurarTudo() {
  criarAbaSeNaoExiste('Leads');
  criarAbaSeNaoExiste('Pageviews');
  configurarAba('Leads',     LEADS_HEADERS,     { utmStart: 11, techStart: 16 });
  configurarAba('Pageviews', PAGEVIEWS_HEADERS, null);
}

function criarAbaSeNaoExiste(nome) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(nome)) {
    ss.insertSheet(nome);
    log('Aba criada: ' + nome);
  }
}

function configurarAba(nomeAba, headers, secoes) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nomeAba);
  if (!sheet) return;

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setBackground(HEADER_BG).setFontColor(HEADER_FG)
    .setFontWeight('bold').setFontSize(10)
    .setVerticalAlignment('middle').setHorizontalAlignment('center')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sheet.setRowHeight(1, 36);
  sheet.getRange(1, 1).setBackground(MES_BG).setFontColor(MES_FG);

  if (secoes) {
    sheet.getRange(1, secoes.utmStart,  1, 5)
      .setBackground(SEC_UTM_BG).setFontColor('#44337A');
    sheet.getRange(1, secoes.techStart, 1, headers.length - secoes.techStart + 1)
      .setBackground(SEC_TECH_BG).setFontColor('#2A4365');
  }

  sheet.setFrozenRows(1);

  sheet.getBandings().forEach(b => b.remove());
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), headers.length)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY)
    .setFirstRowColor(BAND_ODD).setSecondRowColor(BAND_EVEN).setHeaderRowColor(null);

  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getRange(1, 1, 1, headers.length).createFilter();

  for (let c = 1; c <= headers.length; c++) sheet.autoResizeColumn(c);
  SpreadsheetApp.flush();
  for (let c = 1; c <= headers.length; c++) {
    const w = sheet.getColumnWidth(c);
    if (w < 80)  sheet.setColumnWidth(c, 80);
    if (w > 280) sheet.setColumnWidth(c, 280);
  }

  sheet.getRange(2, 1, sheet.getMaxRows() - 1, headers.length).setBorder(
    null, null, null, null, true, true, '#CBD5E0', SpreadsheetApp.BorderStyle.SOLID
  );

  if (nomeAba === 'Leads') {
    const statusCol = headers.indexOf('Status') + 1;

    sheet.getRange(2, 1, sheet.getMaxRows() - 1, headers.length).clearDataValidations();

    const statusRange = sheet.getRange(2, statusCol, sheet.getMaxRows() - 1, 1);
    statusRange.setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(STATUS_VALUES, true).setAllowInvalid(true).build()
    );

    sheet.setConditionalFormatRules([]);
    sheet.setConditionalFormatRules(STATUS_TAGS.map(tag =>
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(tag.value)
        .setBackground(tag.bg).setFontColor(tag.fg)
        .setRanges([statusRange]).build()
    ));
  }

  sheet.getRange(2, 1, sheet.getMaxRows() - 1, 2).setHorizontalAlignment('center');
  log('✓ ' + nomeAba + ': ' + headers.length + ' colunas configuradas');
}


// ==========================================
// FORMATAÇÃO DE LINHAS
// ==========================================

// Índices fixos das colunas (0-based) — evita bugs com headers.indexOf
const COL_MES      = 0;   // A — Mês
const COL_DATA     = 1;   // B — Data
const COL_TELEFONE = 4;   // E — Telefone
const COL_DATAISO  = 36;  // AK — Data ISO
const NUM_COLS     = 37;

// Garante formato E.164 com + no início: +5548999999999
function formatarTelefoneE164(raw) {
  if (!raw) return '';
  let d = raw.toString().replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = d.substring(1);
  if (d.startsWith('55') && d.length >= 12 && d.length <= 13) return '+' + d;
  if (d.length === 11) return '+55' + d;
  if (d.length === 10) return '+55' + d;  // mantém 10 dígitos no sheet (rejeição é só pra Meta)
  return '+' + d;
}

function parseDataLocal(val) {
  if (!val || typeof val !== 'string' || val.trim() === '') return null;
  const s = val.trim();

  // ISO com timezone: 2026-04-30T00:26:00-03:00
  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?([+-]\d{2}:\d{2}|Z)?/);
  if (mIso) {
    const tz = mIso[7] || 'Z';
    const tzOffset = tz === 'Z' ? 0 : (() => {
      const sign = tz[0] === '+' ? 1 : -1;
      const [h, m] = tz.slice(1).split(':').map(Number);
      return sign * (h * 60 + m);
    })();
    const utcMs = Date.UTC(+mIso[1], +mIso[2] - 1, +mIso[3], +mIso[4], +mIso[5], +(mIso[6] || 0));
    return new Date(utcMs - tzOffset * 60000);
  }

  // BR formatado: 29/04/2026 19:07
  const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (mBr) return new Date(+mBr[3], +mBr[2] - 1, +mBr[1], +mBr[4], +mBr[5], 0);

  return null;
}

function formatarLinha(sheet, row) {
  const numCols = Math.min(NUM_COLS, sheet.getLastColumn());
  const values  = sheet.getRange(row, 1, 1, numCols).getValues()[0];

  // Normaliza telefone PRIMEIRO — independente de data ser válida
  const telRaw = String(values[COL_TELEFONE] || '').trim();
  if (telRaw) {
    const telE164 = formatarTelefoneE164(telRaw);
    if (telE164 && telE164 !== telRaw) {
      sheet.getRange(row, COL_TELEFONE + 1).setNumberFormat('@').setValue(telE164);
    }
  }

  const dataISORaw = values[COL_DATAISO];
  const dataRawVal = values[COL_DATA];
  const dataISO    = String(dataISORaw || '').trim();
  const dataRaw    = String(dataRawVal || '').trim();

  let dateObj  = null;

  // Aceita Date object direto (Sheets pode retornar assim)
  if (dataISORaw instanceof Date && !isNaN(dataISORaw)) dateObj = dataISORaw;
  if (!dateObj && dataRawVal instanceof Date && !isNaN(dataRawVal)) dateObj = dataRawVal;

  if (!dateObj && dataISO) {
    dateObj = parseDataLocal(dataISO);
  }

  if (!dateObj && dataRaw) {
    dateObj = parseDataLocal(dataRaw);
    if (dateObj && /^\d{4}-\d{2}-\d{2}T/.test(dataRaw)) {
      sheet.getRange(row, COL_DATAISO + 1).setValue(dataRaw);
    }
  }

  if (!dateObj) return;

  const pad  = n => String(n).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  const formatted = `${pad(dateObj.getDate())}/${pad(dateObj.getMonth() + 1)}/${yyyy} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;

  sheet.getRange(row, COL_DATA + 1).setValue(formatted);

  if (!String(values[COL_MES] || '').trim()) {
    sheet.getRange(row, COL_MES + 1).setValue(MESES[dateObj.getMonth()] + '/' + yyyy);
  }

  const rowColor = (row % 2 === 0) ? BAND_ODD : BAND_EVEN;
  sheet.getRange(row, 1, 1, numCols).setBackground(rowColor);
  sheet.getRange(row, COL_MES + 1).setBackground(MES_BG).setFontColor(MES_FG);
}

function moverLeadsParaOTopo() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  const actualCols = Math.min(NUM_COLS, sheet.getLastColumn());
  const data = sheet.getRange(2, 1, lastRow - 1, actualCols).getValues();

  const getTs = row => {
    const dataVal = row[COL_DATA];
    const isoVal  = row[COL_DATAISO];
    // Coluna Data é prioritária. Sheets retorna Date object quando interpreta como data.
    if (dataVal instanceof Date && !isNaN(dataVal)) return dataVal.getTime();
    if (isoVal  instanceof Date && !isNaN(isoVal))  return isoVal.getTime();
    const d = parseDataLocal(String(dataVal || '').trim())
           || parseDataLocal(String(isoVal  || '').trim());
    return d ? d.getTime() : 0;
  };

  data.sort((a, b) => getTs(b) - getTs(a));
  sheet.getRange(2, 1, data.length, actualCols).setValues(data);

  for (let i = 0; i < data.length; i++) {
    const r = i + 2;
    sheet.getRange(r, 1, 1, actualCols).setBackground((i % 2 === 0) ? BAND_ODD : BAND_EVEN);
    sheet.getRange(r, COL_MES + 1).setBackground(MES_BG).setFontColor(MES_FG);
  }

  log('↕ Leads reordenados', { total: data.length });
}

function limparDataISOInvalido() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range  = sheet.getRange(2, COL_DATAISO + 1, lastRow - 1, 1);
  const values = range.getValues();
  const cleared = values.map(([v]) => {
    const s = String(v || '').trim();
    return [s && !/^\d{4}-\d{2}-\d{2}T/.test(s) ? '' : v];
  });
  range.setValues(cleared);
  log('🧹 Data ISO inválido limpo');
}

function formatarTodosLeads() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  if (!sheet) { SpreadsheetApp.getUi().alert('Aba "Leads" não encontrada.'); return; }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  for (let i = 2; i <= lastRow; i++) formatarLinha(sheet, i);
  moverLeadsParaOTopo();
  SpreadsheetApp.getUi().alert('✅ ' + (lastRow - 1) + ' leads formatados e reordenados.');
}


// ==========================================
// UTILITÁRIOS
// ==========================================

function log(msg, data) {
  if (!ENABLE_LOGS) return;
  Logger.log('[' + new Date().toISOString() + '] ' + msg + (data ? ' | ' + JSON.stringify(data) : ''));
}

function logError(ctx, err) {
  Logger.log('[ERRO] ' + ctx + ': ' + err.toString() + (err.stack ? '\n' + err.stack : ''));
}
