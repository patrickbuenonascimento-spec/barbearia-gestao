/* v29 - Sincronização automática da planilha dentro da Gestão */
(function(){
  if (window.__gestaoSyncV29) return;
  window.__gestaoSyncV29 = true;
  const DEFAULT_URL = 'https://docs.google.com/spreadsheets/d/1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc/edit?usp=drivesdk';
  const SETTINGS_KEY = 'gestao_barber_google_sheet_sync_v23';
  let syncing = false;
  let triedAuto = false;
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const countRecords = () => Array.isArray(window.state?.records) ? window.state.records.length : 0;
  function toast(msg){ try { if (typeof showToast === 'function') showToast(msg); } catch(e){} }
  function setSettings(){
    try {
      const current = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ auto:true, interval:10, url: current.url || DEFAULT_URL, ...current }));
    } catch(e) {}
  }
  function statusBox(){
    let box = $('#gestaoSyncStatusV29');
    const host = $('#gestaoUnicaV28 .panel-header') || $('#managementUnifiedV27 .panel-header') || $('#gestaoV28') || $('#gestaoV27');
    if (!box && host) {
      box = document.createElement('div');
      box.id = 'gestaoSyncStatusV29';
      box.className = 'import-status warning';
      box.style.marginTop = '10px';
      box.textContent = 'Gestão aguardando sincronização da planilha.';
      host.parentElement?.insertBefore(box, host.nextSibling);
    }
    return box;
  }
  function ensureButton(){
    const header = $('#gestaoUnicaV28 .panel-header') || $('#managementUnifiedV27 .panel-header');
    if (!header || $('#gestaoSyncBtnV29')) return;
    const wrap = document.createElement('div');
    wrap.className = 'toolbar-row compact';
    wrap.style.marginTop = '10px';
    wrap.innerHTML = '<button type="button" class="primary-button" id="gestaoSyncBtnV29">Sincronizar planilha</button><button type="button" class="secondary-button" id="gestaoReloadV29">Atualizar gráficos</button>';
    header.appendChild(wrap);
  }
  function forceOpenGestao(){
    try {
      $$('.screen').forEach(s => s.classList.remove('active'));
      const gestao = $('#gestaoUnicaV28') || $('#managementUnifiedV27');
      if (gestao) gestao.classList.add('active');
      $$('.nav-link[data-screen]').forEach(b => b.classList.remove('active'));
      const nav = $('.nav-link[data-screen="gestaoUnicaV28"]') || $('.nav-link[data-screen="managementUnifiedV27"]');
      if (nav) nav.classList.add('active');
      const title = $('#pageTitle');
      if (title) title.textContent = 'Gestão';
    } catch(e) {}
  }
  async function sync(reason='manual'){
    if (syncing) return false;
    syncing = true;
    setSettings();
    ensureButton();
    const box = statusBox();
    if (box) { box.className = 'import-status warning'; box.textContent = 'Sincronizando planilha do Google Sheets...'; }
    try {
      let ok = false;
      if (window.googleSheetAutoSyncV23?.sync) {
        ok = await window.googleSheetAutoSyncV23.sync(reason);
      } else if ($('#googleSheetSyncNowV23')) {
        $('#googleSheetSyncNowV23').click();
        ok = true;
      } else {
        throw new Error('Módulo de sincronização da planilha ainda não carregou. Aguarde alguns segundos e clique de novo.');
      }
      setTimeout(()=>{
        try { if (typeof saveState === 'function') saveState(); } catch(e){}
        try { if (typeof renderAll === 'function') renderAll(); } catch(e){}
        forceOpenGestao();
        ensureButton();
        const b = statusBox();
        if (b) { b.className = countRecords() ? 'import-status success' : 'import-status warning'; b.textContent = countRecords() ? `Planilha sincronizada. ${countRecords()} atendimento(s) carregado(s).` : 'Sincronização executada, mas nenhum atendimento entrou no sistema. Confira a aba Atendimentos e os cabeçalhos da planilha.'; }
      }, 900);
      return ok;
    } catch(err) {
      console.error(err);
      if (box) { box.className = 'import-status error'; box.textContent = `Erro ao sincronizar planilha: ${err.message || err}`; }
      return false;
    } finally {
      syncing = false;
    }
  }
  function maybeAuto(){
    ensureButton();
    const gestaoVisible = $('#gestaoUnicaV28.active') || $('#managementUnifiedV27.active');
    if (!gestaoVisible) return;
    if (!triedAuto && countRecords() === 0) {
      triedAuto = true;
      setTimeout(()=>sync('auto'), 400);
    } else if (countRecords() > 0) {
      const box = statusBox();
      if (box) { box.className = 'import-status success'; box.textContent = `Dados carregados: ${countRecords()} atendimento(s).`; }
    }
  }
  document.addEventListener('click', (event)=>{
    if (event.target.closest('#gestaoSyncBtnV29')) { event.preventDefault(); sync('manual'); }
    if (event.target.closest('#gestaoReloadV29')) { event.preventDefault(); try { if (typeof renderAll === 'function') renderAll(); } catch(e){} forceOpenGestao(); ensureButton(); maybeAuto(); }
    const nav = event.target.closest('.nav-link[data-screen="gestaoUnicaV28"], .nav-link[data-screen="managementUnifiedV27"]');
    if (nav) setTimeout(maybeAuto, 500);
  }, true);
  const oldSet = window.setScreen;
  if (typeof oldSet === 'function') {
    window.setScreen = function patchedSetScreenV29(id){
      const out = oldSet.apply(this, arguments);
      if (id === 'gestaoUnicaV28' || id === 'managementUnifiedV27') setTimeout(maybeAuto, 500);
      return out;
    };
  }
  setTimeout(()=>{ ensureButton(); maybeAuto(); }, 1200);
  setTimeout(()=>{ ensureButton(); maybeAuto(); }, 3000);
})();
