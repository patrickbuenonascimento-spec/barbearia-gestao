/* v30 - Gestão lê a planilha direto do sheets-proxy e preenche state.records */
(function(){
  if (window.__gestaoDirectSheetsV30) return;
  window.__gestaoDirectSheetsV30 = true;

  const SPREADSHEET_ID = '1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc';
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const clean = v => String(v ?? '').replace(/^\uFEFF/, '').trim();
  const norm = v => clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const brNum = v => {
    let t = clean(v);
    if (!t || t === '-' || t === 'R$ -') return 0;
    const neg = /\(|-/.test(t);
    t = t.replace(/R\$/gi,'').replace(/[()\s]/g,'').replace(/%/g,'');
    if (t.includes(',') && t.includes('.')) t = t.replace(/\./g,'').replace(',','.');
    else if (t.includes(',')) t = t.replace(',','.');
    let n = Number(t.replace(/[^0-9.]/g,''));
    if (!Number.isFinite(n)) n = 0;
    return neg ? -Math.abs(n) : n;
  };
  const toIsoDate = v => {
    const s = clean(v);
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const d = m[1].padStart(2,'0'), mo = m[2].padStart(2,'0');
      let y = m[3]; if (y.length === 2) y = '20' + y;
      return `${y}-${mo}-${d}`;
    }
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0,10);
    return s;
  };
  const csvParse = text => {
    text = String(text || '').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i=0;i<text.length;i++) {
      const ch = text[i], nx = text[i+1];
      if (q) {
        if (ch === '"' && nx === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else {
        if (ch === '"') q = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += ch;
      }
    }
    row.push(cell); rows.push(row);
    return rows.filter(r => r.some(c => clean(c) !== ''));
  };
  function canonicalHeader(h){
    const n = norm(h);
    if (n.includes('data prevista')) return 'Data prevista';
    if (n.endsWith(' data') || n === 'data' || n.includes(' data')) return 'Data';
    if (n === 'hora' || n.includes(' hora')) return 'Hora';
    if (n.includes('id atendimento')) return 'ID atendimento';
    if (n.includes('cliente')) return 'Cliente';
    if (n.includes('servico') || n.includes('serviço')) return 'Serviço';
    if (n.includes('profissional') || n.includes('colaborador')) return 'Profissional';
    if (n.includes('status')) return 'Status';
    if (n.includes('pagamento')) return 'Pagamento';
    if (n.includes('parcela')) return 'Parcelas';
    if (n.includes('valor tabela')) return 'Valor tabela';
    if (n.includes('desconto')) return 'Desconto';
    if (n.includes('venda liquida') || n.includes('venda líquida')) return 'Venda líquida';
    if (n.includes('taxa') && n.includes('%')) return 'Taxa %';
    if (n.includes('taxa') && n.includes('r')) return 'Taxa R$';
    if (n.includes('liquido previsto') || n.includes('líquido previsto')) return 'Líquido previsto';
    if (n.includes('comissao') && n.includes('%')) return 'Comissão %';
    if (n.includes('comissao') && n.includes('r')) return 'Comissão R$';
    if (n.includes('parte barbearia')) return 'Parte barbearia';
    if (n.includes('custo material')) return 'Custo material';
    if (n.includes('margem')) return 'Margem do atendimento';
    if (n.includes('conciliacao') || n.includes('conciliação')) return 'Conciliação';
    return clean(h);
  }
  function sheetRows(csv){
    const rows = csvParse(csv);
    if (!rows.length) return [];
    const headers = rows[0].map(canonicalHeader);
    return rows.slice(1).map(r => {
      const o = {};
      headers.forEach((h,i)=>{ if (h) o[h] = clean(r[i]); });
      return o;
    });
  }
  function readRowsFromSheet(sheets, name){
    const key = Object.keys(sheets || {}).find(k => norm(k) === norm(name));
    if (!key) return [];
    return sheetRows(sheets[key]);
  }
  function mapAtendimento(r, idx){
    const data = toIsoDate(r['Data']);
    const cliente = clean(r['Cliente']);
    const servico = clean(r['Serviço']);
    if (!data || !cliente || !servico) return null;
    const venda = brNum(r['Venda líquida'] || r['Valor tabela']);
    const tabela = brNum(r['Valor tabela'] || r['Venda líquida']);
    const taxa = brNum(r['Taxa R$']);
    const liquido = brNum(r['Líquido previsto'] || r['Venda líquida']);
    const comissao = brNum(r['Comissão R$']);
    const custo = brNum(r['Custo material']);
    const margem = brNum(r['Margem do atendimento']);
    return {
      id: clean(r['ID atendimento']) || `sheet-${data}-${idx}`,
      date: data,
      time: clean(r['Hora']),
      clientName: cliente,
      serviceName: servico,
      collaboratorName: clean(r['Profissional'] || 'TAISE'),
      professional: clean(r['Profissional'] || 'TAISE'),
      status: clean(r['Status'] || 'Atendido'),
      paymentMethod: clean(r['Pagamento'] || 'Não informado'),
      installments: Number(brNum(r['Parcelas'] || 1)) || 1,
      tableValue: tabela,
      discount: brNum(r['Desconto']),
      saleValue: venda,
      netSale: venda,
      cardFeeValue: taxa,
      expectedNet: liquido,
      commissionValue: comissao,
      materialCost: custo,
      margin: margem,
      expectedDate: toIsoDate(r['Data prevista']) || data,
      reconciliation: clean(r['Conciliação']),
      source: 'Google Sheets'
    };
  }
  function mapProductSale(r, idx){
    const data = toIsoDate(r['Data'] || r['data']);
    const produto = clean(r['Produto'] || r['produto'] || r['Item']);
    if (!data || !produto) return null;
    return { id:`produto-${data}-${idx}`, date:data, productName:produto, quantity:brNum(r['Quantidade'] || r['Qtd'] || 1) || 1, total:brNum(r['Total'] || r['Valor total'] || r['Valor'] || r['Venda']), paymentMethod:clean(r['Pagamento'] || r['Forma de pagamento']), source:'Google Sheets' };
  }
  function mapStock(r, idx){
    const nome = clean(r['Produto'] || r['Item'] || r['Nome']);
    if (!nome) return null;
    return { id:`estoque-${idx}`, name:nome, currentStock:brNum(r['Estoque atual'] || r['Atual'] || r['Quantidade'] || r['Saldo']), minStock:brNum(r['Estoque mínimo'] || r['Minimo'] || r['Mínimo'] || 5), unit:clean(r['Unidade'] || 'un'), source:'Google Sheets' };
  }
  function mapBill(r, idx){
    const data = toIsoDate(r['Data'] || r['Vencimento'] || r['Data vencimento'] || r['Competência']);
    const desc = clean(r['Descrição'] || r['Conta'] || r['Categoria'] || r['Despesa']);
    if (!data || !desc) return null;
    return { id:`conta-${data}-${idx}`, dueDate:data, description:desc, category:clean(r['Categoria'] || desc), value:brNum(r['Valor'] || r['Total'] || r['Previsto']), paidValue:brNum(r['Valor pago'] || r['Pago'] || r['Valor'] || r['Total']), status:clean(r['Status'] || ''), source:'Google Sheets' };
  }
  function ensureStatus(){
    let box = $('#gestaoSyncStatusV30') || $('#gestaoSyncStatusV29');
    const host = $('#gestaoUnicaV28 .panel-header') || $('#gestaoV28') || $('#gestaoV27');
    if (!box && host) {
      box = document.createElement('div');
      box.id = 'gestaoSyncStatusV30';
      box.className = 'import-status warning';
      box.style.marginTop = '10px';
      box.textContent = 'Aguardando leitura direta da planilha.';
      host.parentElement?.insertBefore(box, host.nextSibling);
    }
    return box;
  }
  function ensureButtons(){
    const header = $('#gestaoUnicaV28 .panel-header');
    if (!header) return;
    if (!$('#gestaoDirectSyncV30')) {
      const wrap = document.createElement('div');
      wrap.className = 'toolbar-row compact';
      wrap.style.marginTop = '10px';
      wrap.innerHTML = '<button type="button" class="primary-button" id="gestaoDirectSyncV30">Ler planilha agora</button><button type="button" class="secondary-button" id="gestaoForceGraphsV30">Atualizar gráficos</button>';
      header.appendChild(wrap);
    }
  }
  function count(){ return Array.isArray(window.state?.records) ? window.state.records.length : 0; }
  function saveAndRender(){
    try { if (typeof saveState === 'function') saveState(); } catch(e){}
    try { if (typeof renderAll === 'function') renderAll(); } catch(e){}
    try {
      $$('.screen').forEach(s => s.classList.remove('active'));
      $('#gestaoUnicaV28')?.classList.add('active');
      $$('.nav-link[data-screen]').forEach(b => b.classList.remove('active'));
      $('.nav-link[data-screen="gestaoUnicaV28"]')?.classList.add('active');
      const title = $('#pageTitle'); if (title) title.textContent = 'Gestão';
    } catch(e){}
    ensureButtons();
  }
  async function directSync(){
    ensureButtons();
    const box = ensureStatus();
    if (box) { box.className = 'import-status warning'; box.textContent = 'Lendo planilha diretamente pelo proxy...'; }
    try {
      const url = `/.netlify/functions/sheets-proxy?spreadsheetId=${encodeURIComponent(SPREADSHEET_ID)}&sheets=${encodeURIComponent('Atendimentos,Vendas Produtos,Contas,Estoque')}`;
      const response = await fetch(url, { cache:'no-store' });
      const json = await response.json();
      if (!json.ok || !json.sheets) throw new Error(json.message || 'Proxy não retornou dados válidos.');
      if (!window.state) window.state = {};
      const atendRows = readRowsFromSheet(json.sheets, 'Atendimentos');
      const records = atendRows.map(mapAtendimento).filter(Boolean);
      if (!records.length) throw new Error(`Aba Atendimentos lida, mas nenhum atendimento válido foi encontrado. Linhas lidas: ${atendRows.length}.`);
      window.state.records = records;
      const prod = readRowsFromSheet(json.sheets, 'Vendas Produtos').map(mapProductSale).filter(Boolean);
      if (prod.length) window.state.productSales = prod;
      const bills = readRowsFromSheet(json.sheets, 'Contas').map(mapBill).filter(Boolean);
      if (bills.length) window.state.bills = bills;
      const stock = readRowsFromSheet(json.sheets, 'Estoque').map(mapStock).filter(Boolean);
      if (stock.length) window.state.stockItems = stock;
      try { localStorage.setItem('gestao_barber_last_sheet_import_v30', JSON.stringify({ at:new Date().toISOString(), records:records.length, products:prod.length, bills:bills.length, stock:stock.length })); } catch(e){}
      saveAndRender();
      const b = ensureStatus();
      if (b) { b.className = 'import-status success'; b.textContent = `Planilha carregada: ${records.length} atendimento(s), ${prod.length} venda(s) de produto, ${bills.length} conta(s), ${stock.length} item(ns) de estoque.`; }
      try { if (typeof showToast === 'function') showToast(`Planilha carregada: ${records.length} atendimentos.`); } catch(e){}
      return true;
    } catch(err) {
      console.error('directSync v30', err);
      if (box) { box.className = 'import-status error'; box.textContent = `Erro na leitura direta: ${err.message || err}`; }
      return false;
    }
  }
  document.addEventListener('click', e => {
    if (e.target.closest('#gestaoDirectSyncV30') || e.target.closest('#gestaoSyncBtnV29')) { e.preventDefault(); directSync(); }
    if (e.target.closest('#gestaoForceGraphsV30')) { e.preventDefault(); saveAndRender(); }
    if (e.target.closest('.nav-link[data-screen="gestaoUnicaV28"]')) setTimeout(()=>{ ensureButtons(); ensureStatus(); if (count() === 0) directSync(); }, 600);
  }, true);
  const oldSet = window.setScreen;
  if (typeof oldSet === 'function') {
    window.setScreen = function patchedSetScreenV30(id){
      const out = oldSet.apply(this, arguments);
      if (id === 'gestaoUnicaV28') setTimeout(()=>{ ensureButtons(); ensureStatus(); if (count() === 0) directSync(); }, 650);
      return out;
    };
  }
  setTimeout(()=>{ ensureButtons(); ensureStatus(); if ($('#gestaoUnicaV28.active') && count() === 0) directSync(); }, 1600);
  window.gestaoDirectSyncV30 = directSync;
})();
