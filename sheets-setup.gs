// ==========================================
// CONFIGURAÇÕES
// ==========================================

const META_PIXEL_ID      = "SEU_PIXEL_ID_AQUI";
const META_ACCESS_TOKEN  = "SEU_ACCESS_TOKEN_AQUI";

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
    .addItem('Configurar planilha',        'configurarTudo')
    .addItem('Testar envio CAPI',          'testarEnvio')
    .addItem('Diagnóstico',                'diagnosticar')
    .addItem('Limpar cache Meta',          'limparCache')
    .addToUi();
}


// ==========================================
// TRIGGER — onChange
// Lead inserido via Typebot → move para topo + formata + envia Lead via CAPI
// ==========================================

function onChange(e) {
  if (!e || e.changeType !== 'INSERT_ROW') return;

  try {
    const ss = e.source;

    for (const name of ['Leads', 'Pageviews']) {
      const sheet = ss.getSheetByName(name);
      if (!sheet) continue;

      const lastRow = sheet.getLastRow();
      if (lastRow <= 2) continue;

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
        const lead = {};
        headers.forEach((h, i) => { if (h) lead[h] = rowData[i] ? rowData[i].toString() : ''; });
        const result = sendToMeta(lead, 2, 'Lead', lead['Event ID'] || null);
        log('📊 Lead CAPI', { meta: result.success });
      }
    }
  } catch (err) {
    logError('onChange', err);
  }
}


// ==========================================
// TRIGGER — onEdit
// Mudança de Status na aba Leads dispara envio para Meta
// ==========================================

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== 'Leads') return;

  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row === 1) return;

  try {
    const headers   = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const statusCol = headers.indexOf(STATUS_FIELD) + 1;

    if (statusCol > 0 && col === statusCol && STATUS_EVENTS[e.value]) {
      log('🔥 Status → ' + e.value, { linha: row });
      enviarLeadQualificado(sheet, row, headers, e.value);
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
  const result = sendToMeta(lead, rowNumber, eventName);
  log('📊 Resultado envio', { linha: rowNumber, evento: eventName, meta: result.success });
  return result;
}


// ==========================================
// META — Conversions API
// ==========================================

function sendToMeta(lead, rowNumber, eventName, eventId) {
  try {
    if (META_PIXEL_ID === 'SEU_PIXEL_ID_AQUI') return { success: false, error: 'Pixel não configurado' };

    const props     = PropertiesService.getScriptProperties();
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
    const url = 'https://graph.facebook.com/v19.0/' + META_PIXEL_ID + '/events?access_token=' + META_ACCESS_TOKEN;
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
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
  if (lead['Event ID'])  ud.external_id = [sha256(lead['Event ID'])];
  if (lead['Cidade'])    ud.ct = [sha256(normalizeCity(lead['Cidade']))];
  if (lead['Estado'])    ud.st = [sha256(lead['Estado'].toLowerCase().substring(0, 2))];
  if (lead['CEP'])       ud.zp = [sha256(lead['CEP'].replace(/\D/g, ''))];

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
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
  return bytes.map(b => ('0' + ((b < 0 ? b + 256 : b)).toString(16)).slice(-2)).join('');
}

function normalizeEmail(email) {
  return (email || '').toString().trim().toLowerCase();
}

function normalizePhone(phone) {
  if (!phone) return '';
  let d = phone.toString().replace(/\D/g, '');
  if (d.startsWith('0')) d = d.substring(1);
  if (d.length === 10 || d.length === 11) return '55' + d;
  if (d.startsWith('55') && d.length >= 12) return d;
  return d;
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
  props.deleteProperty('meta_sent_' + STATUS_EVENTS[testStatus] + '_' + testRow);

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

  let quentes = 0;
  for (let i = 2; i <= sheet.getLastRow(); i++) {
    if (sheet.getRange(i, headers.indexOf(STATUS_FIELD) + 1).getValue() === 'Quente') quentes++;
  }

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

  for (let c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
    const w = sheet.getColumnWidth(c);
    if (w < 80)  sheet.setColumnWidth(c, 80);
    if (w > 280) sheet.setColumnWidth(c, 280);
  }

  sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).setBorder(
    null, null, null, null, true, true, '#CBD5E0', SpreadsheetApp.BorderStyle.SOLID
  );

  if (nomeAba === 'Leads') {
    const sheetHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const statusCol    = sheetHeaders.indexOf('Status') + 1;

    sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).clearDataValidations();

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

function parseDataLocal(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = val.toString().trim();

  // ISO: 2026-04-29T19:07:55-03:00
  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (mIso) return new Date(parseInt(mIso[1]), parseInt(mIso[2]) - 1, parseInt(mIso[3]), parseInt(mIso[4]), parseInt(mIso[5]));

  // Já formatado: 29/04/2026 19:07
  const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (mBr) return new Date(parseInt(mBr[3]), parseInt(mBr[2]) - 1, parseInt(mBr[1]), parseInt(mBr[4]), parseInt(mBr[5]));

  return null;
}

function formatarLinha(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dataCol = headers.indexOf('Data') + 1;
  const mesCol  = headers.indexOf('Mês') + 1;
  const isoCol  = headers.indexOf('Data ISO') + 1;
  if (dataCol === 0) return;

  // Usar Data ISO como fonte primária (preserva original); fallback para coluna Data
  const isoVal  = isoCol > 0 ? sheet.getRange(row, isoCol).getValue() : '';
  const dataVal = sheet.getRange(row, dataCol).getValue();
  const rawVal  = isoVal || dataVal;

  const d = parseDataLocal(rawVal);
  if (!d) return;

  // Backup ISO antes de sobrescrever coluna Data
  if (isoCol > 0 && !isoVal) {
    const isoStr = (dataVal instanceof Date) ? dataVal.toISOString() : dataVal.toString();
    sheet.getRange(row, isoCol).setValue(isoStr);
  }

  const pad = n => String(n).padStart(2, '0');
  sheet.getRange(row, dataCol).setValue(
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  );

  if (mesCol > 0 && !sheet.getRange(row, mesCol).getValue()) {
    sheet.getRange(row, mesCol).setValue(MESES[d.getMonth()] + '/' + d.getFullYear());
  }

  const rowColor = (row % 2 === 0) ? BAND_ODD : BAND_EVEN;
  sheet.getRange(row, 1, 1, sheet.getLastColumn()).setBackground(rowColor);
  sheet.getRange(row, 1).setBackground(MES_BG).setFontColor(MES_FG);
}

function moverLeadsParaOTopo() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const isoCol  = headers.indexOf('Data ISO');
  if (isoCol === -1) return;

  const numCols = sheet.getLastColumn();
  const data    = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  // Ordena por Data ISO decrescente (string ISO é comparável lexicograficamente)
  data.sort((a, b) => {
    const da = a[isoCol] ? a[isoCol].toString() : '';
    const db = b[isoCol] ? b[isoCol].toString() : '';
    return db.localeCompare(da);
  });

  sheet.getRange(2, 1, data.length, numCols).setValues(data);

  // Reaplicar cores após reordenação
  for (let i = 2; i <= lastRow; i++) {
    const rowColor = (i % 2 === 0) ? BAND_ODD : BAND_EVEN;
    sheet.getRange(i, 1, 1, numCols).setBackground(rowColor);
    sheet.getRange(i, 1).setBackground(MES_BG).setFontColor(MES_FG);
  }

  log('↕ Leads reordenados por Data ISO', { total: data.length });
}

function formatarTodosLeads() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  if (!sheet) { SpreadsheetApp.getUi().alert('Aba "Leads" não encontrada.'); return; }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  for (let i = 2; i <= lastRow; i++) {
    formatarLinha(sheet, i);
  }

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
  Logger.log('[ERRO] ' + ctx + ': ' + err.toString());
}
