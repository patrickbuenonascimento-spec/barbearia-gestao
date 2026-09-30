/* v34 - Envia atendimentos da planilha para a aba Relatórios */
(function(){
  if (window.__relatoriosPlanilhaV34) return;
  window.__relatoriosPlanilhaV34 = true;

  const SHEET_ID = '1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc';
  const STORAGE_KEY = 'relatorios_atendimentos_planilha_v34';
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  function parseMoney(v){
    if (v == null || v === '' || v === '-') return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s = String(v).trim();
    const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
    s = s.replace(/[()]/g,'').replace(/R\$/gi,'').replace(/%/g,'').replace(/\s/g,'');
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g,'').replace(',','.');
    else if (s.includes(',')) s = s.replace(',','.');
    const n = Number(s.replace(/[^0-9.]/g,''));
    return Number.isFinite(n) ? (neg ? -Math.abs(n) : n) : 0;
  }
  function parseDate(v){
    const s = String(v||'').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!m) return s.slice(0,10);
    let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
    if (y < 100) y += 2000;
    let day, month;
    if (a > 12) { day = a; month = b; }
    else if (b > 12) { month = a; day = b; }
    else { month = a; day = b; }
    return `${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  function csvParse(text){
    const rows=[]; let row=[], cell='', q=false;
    const str=String(text||'');
    for(let i=0;i<str.length;i++){
      const c=str[i], n=str[i+1];
      if(q){ if(c==='"'&&n==='"'){cell+='"';i++;} else if(c==='"'){q=false;} else cell+=c; }
      else { if(c==='"') q=true; else if(c===','){row.push(cell);cell='';} else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell='';} else if(c!=='\r') cell+=c; }
    }
    row.push(cell); rows.push(row);
    return rows.filter(r=>r.some(c=>String(c||'').trim()!==''));
  }
  function headerIndex(rows){
    return rows.findIndex(r=>r.map(x=>String(x||'').trim().toLowerCase()).includes('data') && r.map(x=>String(x||'').trim().toLowerCase()).includes('cliente'));
  }
  function objectsFromCsv(csv){
    const rows = csvParse(csv);
    const hi = headerIndex(rows);
    if (hi < 0) return [];
    const headers = rows[hi].map(h=>String(h||'').trim());
    return rows.slice(hi+1).map(r=>{
      const o={}; headers.forEach((h,i)=>{ if(h) o[h]=r[i] ?? ''; }); return o;
    }).filter(o=>String(o.Data||'').trim() && String(o.Cliente||'').trim());
  }
  function mapRecord(o, idx){
    const vendaLiquida = parseMoney(o['Venda líquida']);
    const valorTabela = parseMoney(o['Valor tabela']);
    const liquidoPrevisto = parseMoney(o['Líquido previsto']);
    const taxa = parseMoney(o['Taxa R$']);
    const comissao = parseMoney(o['Comissão R$']);
    const parteBarbearia = parseMoney(o['Parte barbearia']);
    const custoMaterial = parseMoney(o['Custo material']);
    const margem = parseMoney(o['Margem do atendimento']);
    const desconto = parseMoney(o.Desconto);
    const id = String(o['ID atendimento'] || `PLAN-${idx+1}`).trim();
    return {
      id,
      source: 'Google Sheets',
      sheetSource: 'Atendimentos',
      date: parseDate(o.Data),
      data: parseDate(o.Data),
      time: String(o.Hora || '').trim(),
      hora: String(o.Hora || '').trim(),
      appointmentId: id,
      scheduleId: id,
      clientName: String(o.Cliente || '').trim(),
      cliente: String(o.Cliente || '').trim(),
      serviceName: String(o['Serviço'] || '').trim(),
      servico: String(o['Serviço'] || '').trim(),
      collaboratorName: String(o.Profissional || '').trim(),
      professionalName: String(o.Profissional || '').trim(),
      profissional: String(o.Profissional || '').trim(),
      status: String(o.Status || '').trim() || 'Atendido',
      paymentMethod: String(o.Pagamento || '').trim() || 'Não informado',
      pagamento: String(o.Pagamento || '').trim() || 'Não informado',
      installments: Number(parseMoney(o.Parcelas)) || 1,
      tableValue: valorTabela,
      valorTabela,
      discount: desconto,
      desconto,
      saleValue: vendaLiquida,
      netSale: vendaLiquida,
      vendaLiquida,
      feePercent: String(o['Taxa %'] || '').trim(),
      feeValue: taxa,
      taxa,
      expectedNet: liquidoPrevisto,
      liquidoPrevisto,
      commissionPercent: String(o['Comissão %'] || '').trim(),
      commissionValue: comissao,
      comissao,
      barbershopShare: parteBarbearia,
      parteBarbearia,
      materialCost: custoMaterial,
      custoMaterial,
      margin: margem,
      margem,
      expectedDate: parseDate(o['Data prevista']),
      extractId: String(o['ID extrato'] || '').trim(),
      reconciliation: String(o['Conciliação'] || '').trim(),
      conciliacao: String(o['Conciliação'] || '').trim(),
      financial: vendaLiquida > 0,
      raw: o
    };
  }
  function normalizeRecords(rows){ return rows.map(mapRecord).filter(r=>r.date && r.clientName); }
  function mergeIntoState(records){
    window.state = window.state || {};
    const old = Array.isArray(window.state.records) ? window.state.records : [];
    const others = old.filter(r => r.source !== 'Google Sheets' && r.sheetSource !== 'Atendimentos');
    window.state.records = others.concat(records);
    try { if (typeof saveState === 'function') saveState(); else localStorage.setItem('barberShopStateV2', JSON.stringify(window.state)); } catch(e) {}
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ updatedAt: new Date().toISOString(), total: records.length, records })); } catch(e) {}
  }
  async function loadReportsFromSheet(){
    const box = ensureBox();
    if (box) { box.className='import-status warning'; box.textContent='Atualizando relatórios com os atendimentos da planilha...'; }
    try {
      const url = `/.netlify/functions/sheets-proxy?spreadsheetId=${encodeURIComponent(SHEET_ID)}&sheets=${encodeURIComponent('Atendimentos')}`;
      const res = await fetch(url, { cache:'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Falha ao ler planilha.');
      const csv = json.sheets?.Atendimentos || json.result?.Atendimentos || json.data?.Atendimentos || '';
      if (!csv) throw new Error('A aba Atendimentos não veio no retorno da planilha.');
      const rows = objectsFromCsv(csv);
      const records = normalizeRecords(rows);
      if (!records.length) throw new Error('Nenhum atendimento válido encontrado na aba Atendimentos.');
      mergeIntoState(records);
      try { if (typeof renderAll === 'function') renderAll(); } catch(e) {}
      try { if (typeof setScreen === 'function') setScreen('reports'); } catch(e) {}
      const total = records.reduce((s,r)=>s+(r.saleValue||0),0);
      const financial = records.filter(r=>r.saleValue>0).length;
      const b = ensureBox();
      if (b) { b.className='import-status success'; b.textContent=`Relatórios atualizados: ${records.length} atendimentos, ${financial} financeiros, venda líquida R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}.`; }
      return records;
    } catch(err) {
      console.error(err);
      const b = ensureBox();
      if (b) { b.className='import-status error'; b.textContent=`Erro ao atualizar relatórios: ${err.message || err}`; }
      return [];
    }
  }
  function ensureBox(){
    const host = $('#reports') || $('.screen#reports');
    if (!host) return null;
    let panel = $('#reportsSheetSyncV34');
    if (!panel) {
      panel = document.createElement('article');
      panel.id = 'reportsSheetSyncV34';
      panel.className = 'panel wide-panel';
      panel.innerHTML = '<div class="panel-header split-header"><div><p class="eyebrow">Planilha conectada</p><h3>Relatórios com atendimentos da planilha</h3><p class="muted">Use este botão para enviar a aba Atendimentos para a área de Relatórios.</p></div><button type="button" class="primary-button" id="syncReportsFromSheetV34">Atualizar relatórios</button></div><div id="reportsSheetStatusV34" class="import-status warning">Aguardando atualização dos relatórios.</div>';
      const grid = host.querySelector('.section-grid') || host;
      grid.prepend(panel);
    }
    return $('#reportsSheetStatusV34');
  }
  function maybeAuto(){
    ensureBox();
    const onReports = $('#reports.active') || document.body.dataset?.screen === 'reports';
    const hasSheetRecords = Array.isArray(window.state?.records) && window.state.records.some(r=>r.source==='Google Sheets'||r.sheetSource==='Atendimentos');
    if (onReports && !hasSheetRecords) setTimeout(loadReportsFromSheet, 500);
  }
  document.addEventListener('click', e=>{
    if (e.target.closest('#syncReportsFromSheetV34')) { e.preventDefault(); loadReportsFromSheet(); }
    if (e.target.closest('.nav-link[data-screen="reports"]')) setTimeout(maybeAuto, 600);
  }, true);
  const oldSet = window.setScreen;
  if (typeof oldSet === 'function') {
    window.setScreen = function(id){ const out = oldSet.apply(this, arguments); if (id === 'reports') setTimeout(maybeAuto, 600); return out; };
  }
  window.syncReportsFromSheetV34 = loadReportsFromSheet;
  setTimeout(()=>{ ensureBox(); maybeAuto(); }, 1500);
})();
