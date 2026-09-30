/* v37 - Relatórios limpos: uma única rotina para planilha, datas e state.records */
(function(){
  if (window.__reportsCleanV37) return;
  window.__reportsCleanV37 = true;

  // Bloqueia rotinas antigas se ainda estiverem no cache do navegador.
  window.__relatoriosPlanilhaV34 = true;
  window.__reportsDateFixV35 = true;
  window.__reportsDateFixV36 = true;

  const SHEET_ID = '1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc';
  const STORAGE_KEY = 'relatorios_atendimentos_planilha_v37';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

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

  function normalizeDateParts(v){
    const s = String(v || '').trim();
    if (!s) return { iso:'', local:'', display:'' };

    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const iso = s.slice(0,10);
      const [y,m,d] = iso.split('-');
      return { iso, local: iso + 'T12:00:00', display: `${d}/${m}/${y}` };
    }

    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!m) return { iso:s, local:s, display:s };

    let a = Number(m[1]);
    let b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;

    let day, month;
    // O Google Sheets está retornando datas como M/D/YYYY: 9/29/2026.
    // Se o segundo número for maior que 12, ele só pode ser o dia.
    if (b > 12) { month = a; day = b; }
    // Se o primeiro número for maior que 12, ele só pode ser o dia.
    else if (a > 12) { day = a; month = b; }
    // Quando é ambíguo, usamos M/D/YYYY porque é assim que o proxy do Sheets está retornando.
    else { month = a; day = b; }

    const iso = `${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return { iso, local: iso + 'T12:00:00', display: `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${y}` };
  }

  function csvParse(text){
    const rows=[]; let row=[], cell='', q=false;
    const str = String(text || '');
    for (let i=0;i<str.length;i++){
      const c=str[i], n=str[i+1];
      if (q) {
        if (c==='"' && n==='"') { cell+='"'; i++; }
        else if (c==='"') q=false;
        else cell+=c;
      } else {
        if (c==='"') q=true;
        else if (c===',') { row.push(cell); cell=''; }
        else if (c==='\n') { row.push(cell); rows.push(row); row=[]; cell=''; }
        else if (c!=='\r') cell+=c;
      }
    }
    row.push(cell); rows.push(row);
    return rows.filter(r => r.some(c => String(c || '').trim() !== ''));
  }

  function tableObjects(csv){
    const rows = csvParse(csv);
    const headerRow = rows.findIndex(r => {
      const n = r.map(x => String(x || '').trim().toLowerCase());
      return n.includes('data') && n.includes('cliente') && n.includes('serviço');
    });
    if (headerRow < 0) return [];
    const headers = rows[headerRow].map(h => String(h || '').trim());
    return rows.slice(headerRow + 1).map(r => {
      const o = {};
      headers.forEach((h,i) => { if (h) o[h] = r[i] ?? ''; });
      return o;
    }).filter(o => String(o.Data || '').trim() && String(o.Cliente || '').trim());
  }

  function mapAttendance(o, idx){
    const d = normalizeDateParts(o.Data);
    const dp = normalizeDateParts(o['Data prevista']);
    const id = String(o['ID atendimento'] || `GS-${idx+1}`).trim();
    const vendaLiquida = parseMoney(o['Venda líquida']);
    const valorTabela = parseMoney(o['Valor tabela']);
    const desconto = parseMoney(o.Desconto);
    const taxa = parseMoney(o['Taxa R$']);
    const liquidoPrevisto = parseMoney(o['Líquido previsto']);
    const comissao = parseMoney(o['Comissão R$']);
    const parteBarbearia = parseMoney(o['Parte barbearia']);
    const custoMaterial = parseMoney(o['Custo material']);
    const margem = parseMoney(o['Margem do atendimento']);

    return {
      id,
      source: 'Google Sheets V37',
      sheetSource: 'Atendimentos',
      importedFromSheet: true,
      date: d.local,
      dateISO: d.iso,
      dateKey: d.iso,
      data: d.iso,
      displayDate: d.display,
      dataFormatada: d.display,
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
      expectedDate: dp.local || '',
      expectedDateISO: dp.iso || '',
      expectedDisplayDate: dp.display || '',
      extractId: String(o['ID extrato'] || '').trim(),
      reconciliation: String(o['Conciliação'] || '').trim(),
      conciliacao: String(o['Conciliação'] || '').trim(),
      financial: vendaLiquida > 0,
      raw: o
    };
  }

  function mergeRecords(records){
    window.state = window.state || {};
    const old = Array.isArray(window.state.records) ? window.state.records : [];
    const keep = old.filter(r => !(r && (r.importedFromSheet || r.sheetSource === 'Atendimentos' || String(r.source || '').includes('Google Sheets'))));
    window.state.records = keep.concat(records);
    try { if (typeof saveState === 'function') saveState(); } catch(e) {}
    try { localStorage.setItem('barberShopStateV2', JSON.stringify(window.state)); } catch(e) {}
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ updatedAt:new Date().toISOString(), total:records.length, records })); } catch(e) {}
  }

  function cleanupOldPanels(){
    ['reportsSheetSyncV34','reportsDateFixV35','reportsDateFixV36','reportsCleanV37Duplicate'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  }

  function ensurePanel(){
    const host = $('#reports') || $('.screen#reports');
    if (!host) return null;
    cleanupOldPanels();
    let panel = $('#reportsCleanV37');
    if (!panel) {
      panel = document.createElement('article');
      panel.id = 'reportsCleanV37';
      panel.className = 'panel wide-panel';
      panel.innerHTML = '<div class="panel-header split-header"><div><p class="eyebrow">Planilha conectada</p><h3>Relatórios corrigidos pela planilha</h3><p class="muted">Esta rotina substitui as correções antigas e usa as datas da planilha sem voltar um dia.</p></div><button type="button" class="primary-button" id="syncReportsCleanV37">Atualizar relatórios</button></div><div id="reportsCleanStatusV37" class="import-status warning">Clique em Atualizar relatórios para recarregar os atendimentos da planilha.</div>';
      const grid = host.querySelector('.section-grid') || host;
      grid.prepend(panel);
    }
    return $('#reportsCleanStatusV37');
  }

  function brMoney(v){ return Number(v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

  async function syncReports(){
    const box = ensurePanel();
    if (box) { box.className = 'import-status warning'; box.textContent = 'Lendo a aba Atendimentos da planilha...'; }
    try {
      const url = `/.netlify/functions/sheets-proxy?spreadsheetId=${encodeURIComponent(SHEET_ID)}&sheets=${encodeURIComponent('Atendimentos')}`;
      const res = await fetch(url, { cache:'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Falha no sheets-proxy.');
      const csv = json.sheets?.Atendimentos || json.result?.Atendimentos || json.data?.Atendimentos || '';
      if (!csv) throw new Error('Aba Atendimentos não retornou dados.');
      const rows = tableObjects(csv);
      const records = rows.map(mapAttendance).filter(r => r.dateISO && r.clientName);
      if (!records.length) throw new Error('Nenhum atendimento válido encontrado.');
      mergeRecords(records);
      try { if (typeof renderAll === 'function') renderAll(); } catch(e) {}
      try { if (typeof setScreen === 'function') setScreen('reports'); } catch(e) {}
      const b = ensurePanel();
      const first = records.map(r=>r.dateISO).sort()[0];
      const last = records.map(r=>r.dateISO).sort().slice(-1)[0];
      const total = records.reduce((s,r)=>s+(r.saleValue||0),0);
      const fin = records.filter(r=>r.saleValue > 0).length;
      const fmt = iso => iso ? iso.split('-').reverse().join('/') : '';
      if (b) { b.className='import-status success'; b.textContent = `Relatórios atualizados: ${records.length} atendimentos (${fin} financeiros), período ${fmt(first)} a ${fmt(last)}, venda líquida ${brMoney(total)}.`; }
      return records;
    } catch(err) {
      console.error(err);
      const b = ensurePanel();
      if (b) { b.className='import-status error'; b.textContent = `Erro nos relatórios: ${err.message || err}`; }
      return [];
    }
  }

  document.addEventListener('click', e => {
    if (e.target.closest('#syncReportsCleanV37')) { e.preventDefault(); syncReports(); }
    if (e.target.closest('.nav-link[data-screen="reports"]')) setTimeout(ensurePanel, 400);
  }, true);

  const oldSetScreen = window.setScreen;
  if (typeof oldSetScreen === 'function' && !oldSetScreen.__reportsCleanV37) {
    const patched = function(id){
      const out = oldSetScreen.apply(this, arguments);
      if (id === 'reports') setTimeout(ensurePanel, 500);
      return out;
    };
    patched.__reportsCleanV37 = true;
    window.setScreen = patched;
  }

  window.syncReportsCleanV37 = syncReports;
  setTimeout(ensurePanel, 1500);
})();
