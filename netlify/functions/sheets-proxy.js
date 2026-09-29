const DEFAULT_SHEETS = [
  'Config','Atendimentos','Vendas Produtos','Contas','Extrato','Conciliacao',
  'Estoque','Mov Estoque','Equipe','Folha e Prolabore','Pacotes e Permutas'
];

function csvUrl(spreadsheetId, sheetName) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  try {
    const spreadsheetId = String(event.queryStringParameters?.spreadsheetId || '').trim();
    if (!/^[a-zA-Z0-9_-]{20,}$/.test(spreadsheetId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok:false, message:'spreadsheetId inválido.' }) };
    }
    const requested = String(event.queryStringParameters?.sheets || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const sheets = requested.length ? requested : DEFAULT_SHEETS;

    const result = {};
    const errors = [];
    for (const sheetName of sheets) {
      try {
        const response = await fetch(csvUrl(spreadsheetId, sheetName), {
          headers: { 'User-Agent':'Mozilla/5.0 Netlify Sheets Proxy' }
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (/<!doctype|<html|ServiceLogin|accounts\.google/i.test(text)) {
          throw new Error('Aba retornou tela de login/permissão. Compartilhe a planilha como Qualquer pessoa com o link: Leitor.');
        }
        if (text && text.trim()) result[sheetName] = text;
      } catch (err) {
        errors.push({ sheetName, message: String(err.message || err) });
      }
    }

    if (!Object.keys(result).length) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok:false, message:'Não consegui ler nenhuma aba válida. Verifique compartilhamento da planilha e nomes das abas.', errors })
      };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok:true, sheets: result, errors }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok:false, message:String(err.message || err) }) };
  }
};
