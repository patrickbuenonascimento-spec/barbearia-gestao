/* v36 - Corrige fuso das datas dos relatórios da planilha */
(function(){
  if (window.__fixDatasRelatoriosV36) return;
  window.__fixDatasRelatoriosV36 = true;

  const STORAGE_KEY = 'relatorios_atendimentos_planilha_v36_datas_corrigidas';
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  function pad(n){ return String(n).padStart(2,'0'); }
  function display(iso){
    const s = String(iso||'').slice(0,10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  }
  function parseSheetDate(v){
    const s = String(v||'').trim();
    if (!s) return '';

    // Já está em ISO: nunca usar new Date('YYYY-MM-DD'), pois isso volta 1 dia em UTC-3.
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

    // Datas vindas do Google Sheets via CSV normalmente chegam como M/D/YYYY: 9/29/2026.
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
      if (y < 100) y += 2000;
      let day, month;

      if (b > 12) { month = a; day = b; }      // 9/29/2026 = 29/09/2026
      else if (a > 12) { day = a; month = b; } // 29/09/2026 = 29/09/2026
      else { month = a; day = b; }             // padrão do CSV do Sheets: M/D/YYYY

      if (month < 1 || month > 12 || day < 1 || day > 31) return '';
      return `${y}-${pad(month)}-${pad(day)}`;
    }
    return '';
  }
  function localNoon(iso){ return iso ? `${iso}T12:00:00` : ''; }

  function fixOneRecord(r){
    if (!r || typeof r !== 'object') return false;
    const isSheet = r.source === 'Google Sheets' || r.sheetSource === 'Atendimentos' || r.raw?.Data;
    if (!isSheet) return false;

    const rawDate = r.raw?.Data || r.data || r.date || r.dateISO || '';
    const iso = parseSheetDate(rawDate) || parseSheetDate(String(r.date||'').slice(0,10));
    if (!iso) return false;

    const oldDate = r.date;
    r.dateISO = iso;
    r.data = iso;
    r.dateOnly = iso;
    r.displayDate = display(iso);
    r.date = localNoon(iso); // evita voltar um dia ao usar new Date(record.date)

    const rawExpected = r.raw?.['Data prevista'] || r.expectedDate || r.dataPrevista || '';
    const expectedIso = parseSheetDate(rawExpected);
    if (expectedIso) {
      r.expectedDateISO = expectedIso;
      r.expectedDateOnly = expectedIso;
      r.expectedDateDisplay = display(expectedIso);
      r.expectedDate = localNoon(expectedIso);
      r.dataPrevista = expectedIso;
    }

    return oldDate !== r.date || r.data !== iso;
  }

  function fixStateDates(){
    if (!Array.isArray(window.state?.records)) return { total:0, fixed:0, min:'', max:'' };
    let fixed = 0;
    const dates = [];
    window.state.records.forEach(r=>{
      const before = JSON.stringify([r.date,r.data,r.dateISO,r.expectedDate]);
      fixOneRecord(r);
      const after = JSON.stringify([r.date,r.data,r.dateISO,r.expectedDate]);
      if (before !== after) fixed++;
      if ((r.source === 'Google Sheets' || r.sheetSource === 'Atendimentos') && r.dateISO) dates.push(r.dateISO);
    });
    dates.sort();
    try { if (typeof saveState === 'function') saveState(); else localStorage.setItem('barberShopStateV2', JSON.stringify(window.state)); } catch(e) {}
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({updatedAt:new Date().toISOString(), total:dates.length, fixed, min:dates[0]||'', max:dates[dates.length-1]||''})); } catch(e) {}
    return { total:dates.length, fixed, min:dates[0]||'', max:dates[dates.length-1]||'' };
  }

  function ensureBox(){
    const host = $('#reports') || $('.screen#reports');
    if (!host) return null;
    let panel = $('#reportsDateFixV36');
    if (!panel) {
      panel = document.createElement('article');
      panel.id = 'reportsDateFixV36';
      panel.className = 'panel wide-panel';
      panel.innerHTML = '<div class="panel-header split-header"><div><p class="eyebrow">Correção de datas</p><h3>Datas da planilha sem erro de fuso</h3><p class="muted">Corrige atendimentos da planilha para não voltar um dia nos relatórios.</p></div><button type="button" class="secondary-button" id="fixReportDatesV36">Corrigir datas</button></div><div id="reportsDateFixStatusV36" class="import-status warning">Aguardando correção das datas.</div>';
      const grid = host.querySelector('.section-grid') || host;
      grid.prepend(panel);
    }
    return $('#reportsDateFixStatusV36');
  }

  function runFixAndRender(){
    const res = fixStateDates();
    try { if (typeof renderAll === 'function') renderAll(); } catch(e) {}
    try { if (typeof setScreen === 'function') setScreen('reports'); } catch(e) {}
    const box = ensureBox();
    if (box) {
      const periodo = res.min && res.max ? `${display(res.min)} a ${display(res.max)}` : 'sem período encontrado';
      box.className = res.total ? 'import-status success' : 'import-status warning';
      box.textContent = res.total ? `Datas corrigidas: ${res.total} atendimento(s) da planilha. Período: ${periodo}.` : 'Nenhum atendimento da planilha encontrado para corrigir.';
    }
    return res;
  }

  function patchSyncFunction(name){
    const original = window[name];
    if (typeof original !== 'function' || original.__patchedV36) return;
    const patched = async function(){
      const out = await original.apply(this, arguments);
      setTimeout(runFixAndRender, 450);
      return out;
    };
    patched.__patchedV36 = true;
    window[name] = patched;
  }

  document.addEventListener('click', e=>{
    if (e.target.closest('#fixReportDatesV36')) { e.preventDefault(); runFixAndRender(); }
    if (e.target.closest('#syncReportsFromSheetV34,#syncReportsFromSheetV35,#syncReportsFromSheetV36')) {
      setTimeout(runFixAndRender, 900);
      setTimeout(runFixAndRender, 1800);
    }
    if (e.target.closest('.nav-link[data-screen="reports"]')) {
      setTimeout(()=>{ ensureBox(); runFixAndRender(); }, 800);
    }
  }, true);

  const oldSetScreen = window.setScreen;
  if (typeof oldSetScreen === 'function' && !oldSetScreen.__dateFixV36) {
    const patchedSetScreen = function(id){
      const out = oldSetScreen.apply(this, arguments);
      if (id === 'reports') setTimeout(()=>{ ensureBox(); runFixAndRender(); }, 800);
      return out;
    };
    patchedSetScreen.__dateFixV36 = true;
    window.setScreen = patchedSetScreen;
  }

  setTimeout(()=>{ patchSyncFunction('syncReportsFromSheetV34'); patchSyncFunction('syncReportsFromSheetV35'); patchSyncFunction('syncReportsFromSheetV36'); ensureBox(); runFixAndRender(); }, 1400);
  setTimeout(()=>{ patchSyncFunction('syncReportsFromSheetV34'); patchSyncFunction('syncReportsFromSheetV35'); patchSyncFunction('syncReportsFromSheetV36'); runFixAndRender(); }, 3200);
  window.fixReportDatesV36 = runFixAndRender;
})();