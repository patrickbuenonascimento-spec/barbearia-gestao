/* v35 - Corrige datas dos atendimentos enviados aos Relatórios */
(function(){
  if (window.__corrigeDatasRelatoriosV35) return;
  window.__corrigeDatasRelatoriosV35 = true;

  const SHEET_ID = '1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc';
  const STORAGE_KEY = 'relatorios_atendimentos_planilha_v35';
  const $ = (s,r=document)=>r.querySelector(s);

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
  function isoToBR(iso){
    const s = String(iso || '').slice(0,10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  }
  function parseSheetDate(v){
    if (v == null || v === '') return '';
    if (typeof v === 'number') {
      const base = Date.UTC(1899, 11, 30);
      const d = new Date(base + Math.round(v) * 86400000);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    }
    const s = String(v).trim();
    if (!s) return '';
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!m) return '';
    let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
    if (y < 100) y += 2000;
    let day, month;
    // O Google Sheets pode devolver 9/22/2026 mesmo em planilha BR. Se o segundo número passa de 12, é MM/DD/YYYY.
    if (b > 12) { month = a; day = b; }
    else if (a > 12) { day = a; month = b; }
    else { day = a; month = b; }
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
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
    const dateIso = parseSheetDate(o.Data);
    const expectedDateIso = parseSheetDate(o['Data prevista']);
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
      date: dateIso,
      data: dateIso,
      dateISO: dateIso,
      dataISO: dateIso,
      dateBR: isoToBR(dateIso),
      dataBR: isoToBR(dateIso),
      displayDate: isoToBR(dateIso),
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
      expectedDate: expectedDateIso,
      dataPrevista: expectedDateIso,
      expectedDateBR: isoToBR(expectedDateIso),
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
  function ensureBox(){
    const host = $('#reports') || $('.screen#reports');
    if (!host) return null;
    let panel = $('#reportsSheetSyncV35') || $('#reportsSheetSyncV34');
    if (!panel) {
      panel = document.createElement('article');
      panel.id = 'reportsSheetSyncV35';
      panel.className = 'panel wide-panel';
      panel.innerHTML = '<div class="panel-header split-header"><div><p class="eyebrow">Planilha conectada</p><h3>Relatórios com datas corrigidas</h3><p class="muted">Atualiza os relatórios usando datas no padrão brasileiro.</p></div><button type="button" class="primary-button" id="syncReportsFromSheetV35">Atualizar relatórios</button></div><div id="reportsSheetStatusV35" class="import-status warning">Aguardando atualização dos relatórios.</div>';
      const grid = host.querySelector('.section-grid') || host;
      grid.prepend(panel);
    }
    const oldBtn = $('#syncReportsFromSheetV34');
    if (oldBtn) { oldBtn.id = 'syncReportsFromSheetV35'; oldBtn.textContent = 'Atualizar relatórios'; }
    let status = $('#reportsSheetStatusV35') || $('#reportsSheetStatusV34');
    if (status && status.id !== 'reportsSheetStatusV35') status.id = 'reportsSheetStatusV35';
    return status;
  }
  async function loadReportsFromSheet(){
    const box = ensureBox();
    if (box) { box.className='import-status warning'; box.textContent='Atualizando relatórios com datas corrigidas...'; }
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
      const first = records.map(r=>r.date).sort()[0];
      const last = records.map(r=>r.date).sort().at(-1);
      const b = ensureBox();
      if (b) { b.className='import-status success'; b.textContent=`Relatórios atualizados: ${records.length} atendimentos, período ${isoToBR(first)} a ${isoToBR(last)}, venda líquida R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}.`; }
      return records;
    } catch(err) {
      console.error(err);
      const b = ensureBox();
      if (b) { b.className='import-status error'; b.textContent=`Erro ao atualizar relatórios: ${err.message || err}`; }
      return [];
    }
  }
  document.addEventListener('click', e=>{
    if (e.target.closest('#syncReportsFromSheetV35, #syncReportsFromSheetV34')) { e.preventDefault(); loadReportsFromSheet(); }
    if (e.target.closest('.nav-link[data-screen="reports"]')) setTimeout(()=>{ ensureBox(); }, 500);
  }, true);
  window.syncReportsFromSheetV35 = loadReportsFromSheet;
  window.syncReportsFromSheetV34 = loadReportsFromSheet;
  setTimeout(()=>{ ensureBox(); }, 1200);
})();
