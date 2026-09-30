/* v40 - Agenda Vazia Disko: leitura segura sem quebrar quando Netlify/Disko devolve HTML */
(function(){
  if (window.__agendaDiskoV40) return;
  window.__agendaDiskoV40 = true;

  // A v40 substitui a tela da Agenda Vazia. Não usa a planilha.
  const AV = 'agendaVaziaV33';
  const BOX = 'avV33';
  const CFG = 'agenda_disko_v40_cfg';
  const CACHE = 'agenda_disko_v40_cache';
  const DEFAULT_URL = 'https://taisemourabarber.disko.com.br/marcacao';
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const week = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const br = iso => { const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso||''); };
  const dayObj = iso => { const m=String(iso||todayIso()).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1],+m[2]-1,+m[3],12) : new Date(); };
  const mins = t => { const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1]*60 + +m[2] : 0; };
  const hm = n => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;

  function cfg(){
    try { return { url:DEFAULT_URL, start:todayIso(), days:10, interval:30, goal:5, weekStart:'14:30', weekEnd:'20:00', satStart:'09:00', satEnd:'17:00', ...JSON.parse(localStorage.getItem(CFG)||localStorage.getItem('agenda_disko_v39_cfg')||'{}') }; }
    catch(e){ return { url:DEFAULT_URL, start:todayIso(), days:10, interval:30, goal:5, weekStart:'14:30', weekEnd:'20:00', satStart:'09:00', satEnd:'17:00' }; }
  }
  function setCfg(p){ localStorage.setItem(CFG, JSON.stringify({...cfg(), ...p})); }
  function saveCache(data){ try { localStorage.setItem(CACHE, JSON.stringify({ savedAt:new Date().toISOString(), data })); } catch(e){} }
  function loadCache(){ try { return JSON.parse(localStorage.getItem(CACHE)||'null'); } catch(e){ return null; } }

  function expectedSlots(iso, c){
    const dow = dayObj(iso).getDay();
    if (dow === 0) return [];
    const start = dow === 6 ? c.satStart : c.weekStart;
    const end = dow === 6 ? c.satEnd : c.weekEnd;
    const a = mins(start), b = mins(end), step = Math.max(15, Number(c.interval)||30);
    const out = [];
    for (let m=a; m<b; m+=step) out.push(hm(m));
    return out;
  }
  function normalizeTimes(list){
    return Array.from(new Set((list||[]).map(x=>String(x||'').trim()).filter(x=>/^(\d{1,2}):(\d{2})$/.test(x)).map(x=>{ const [h,m]=x.split(':'); return `${String(+h).padStart(2,'0')}:${m}`; }))).sort();
  }

  function ensureCss(){
    if ($('#v40css')) return;
    const s=document.createElement('style'); s.id='v40css';
    s.textContent=`.v40grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.v40card{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.055);padding:16px}.v40card span{display:block;color:var(--muted);font-size:.82rem}.v40card strong{display:block;font-size:1.45rem;margin-top:6px}.v40filters{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:12px 0}.v40filters label{min-width:150px}.v40table{width:100%;border-collapse:collapse}.v40table th,.v40table td{border-bottom:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.v40table th{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.v40slots{display:flex;gap:6px;flex-wrap:wrap;max-width:540px}.v40slot{display:inline-flex;padding:4px 8px;border-radius:999px;background:rgba(87,214,137,.12);border:1px solid rgba(87,214,137,.25);color:#c9ffd9;font-weight:800;font-size:.78rem}.v40badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,211,109,.12);border:1px solid rgba(255,211,109,.25);color:#ffe7a8;font-weight:850;font-size:.76rem}.v40badge.bad{background:rgba(255,104,104,.12);border-color:rgba(255,104,104,.25);color:#ffd1d1}.v40badge.ok{background:rgba(87,214,137,.12);border-color:rgba(87,214,137,.25);color:#c9ffd9}.v40bar{height:12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid var(--line);overflow:hidden}.v40bar b{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--green),var(--gold),var(--orange))}.v40note{border:1px dashed var(--line);border-radius:18px;padding:14px;color:var(--muted);background:rgba(255,255,255,.035);margin-top:14px}@media(max-width:1100px){.v40grid{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  }
  function ensureScreen(){
    ensureCss();
    let nav = $(`.nav-link[data-screen="${AV}"]`);
    if (!nav) { nav = document.createElement('button'); nav.type='button'; nav.className='nav-link'; nav.dataset.screen=AV; nav.innerHTML='<span>📅</span>Agenda Vazia'; $('.nav')?.appendChild(nav); }
    nav.style.display = 'flex';
    let screen = $('#'+AV);
    if (!screen) { screen=document.createElement('section'); screen.id=AV; screen.className='screen'; screen.innerHTML=`<div id="${BOX}"></div>`; $('.content')?.appendChild(screen); }
    if (!$('#'+BOX)) screen.innerHTML=`<div id="${BOX}"></div>`;
  }

  function controls(){
    const c = cfg();
    return `<div id="v40Status" class="import-status warning">Agenda Vazia ligada diretamente ao Disko. Clique em Ler agenda do Disko.</div>
    <div class="v40filters">
      <label>Link público Disko<input id="v40Url" value="${esc(c.url)}" placeholder="https://taisemourabarber.disko.com.br/marcacao"></label>
      <label>Data inicial<input type="date" id="v40Start" value="${esc(c.start || todayIso())}"></label>
      <label>Dias à frente<input type="number" id="v40Days" min="1" max="30" value="${esc(c.days)}"></label>
      <label>Intervalo agenda<input type="number" id="v40Interval" min="15" step="15" value="${esc(c.interval)}"></label>
      <label>Meta mín. livres<input type="number" id="v40Goal" min="1" value="${esc(c.goal)}"></label>
      <button type="button" class="primary-button" id="v40Load">Ler agenda do Disko</button>
    </div>
    <details class="v40note"><summary>Configurar horários de funcionamento</summary>
      <div class="v40filters">
        <label>Seg–sex início<input type="time" id="v40WeekStart" value="${esc(c.weekStart)}"></label>
        <label>Seg–sex fim<input type="time" id="v40WeekEnd" value="${esc(c.weekEnd)}"></label>
        <label>Sábado início<input type="time" id="v40SatStart" value="${esc(c.satStart)}"></label>
        <label>Sábado fim<input type="time" id="v40SatEnd" value="${esc(c.satEnd)}"></label>
        <button type="button" class="secondary-button" id="v40SaveCfg">Salvar horários</button>
      </div>
    </details>`;
  }

  async function fetchJsonSafe(url){
    const response = await fetch(url, { cache:'no-store', headers:{ 'Accept':'application/json,text/plain,*/*' } });
    const text = await response.text();
    const start = text.trim().slice(0,80);
    if (!response.ok) throw new Error(`A função retornou HTTP ${response.status}. Resposta: ${start || 'vazia'}`);
    if (/^</.test(start) || /<html|<!doctype/i.test(start)) {
      throw new Error('A função do Netlify retornou HTML em vez de JSON. Faça novo deploy sem cache e confirme se a função disko-proxy foi publicada.');
    }
    try { return JSON.parse(text); }
    catch(e){ throw new Error(`Resposta não veio em JSON válido. Início da resposta: ${start}`); }
  }

  function renderResult(json){
    ensureScreen();
    const c = cfg();
    const days = Array.isArray(json?.days) ? json.days : [];
    const openDays = days.filter(d=>expectedSlots(d.date,c).length>0);
    const rows = days.map(d=>{
      const expected = expectedSlots(d.date,c);
      const times = normalizeTimes((d.availableTimes && d.availableTimes.length) ? d.availableTimes : d.times);
      const free = times.filter(t=>!expected.length || (mins(t)>=mins(expected[0]) && mins(t)<=mins(expected[expected.length-1]||'23:59')));
      const pct = expected.length ? Math.min(100, Math.round((free.length/expected.length)*100)) : 0;
      const badge = !expected.length ? '<span class="v40badge">Fechado</span>' : !free.length ? '<span class="v40badge bad">Sem horários lidos</span>' : free.length >= Number(c.goal||5) ? '<span class="v40badge bad">Alta folga</span>' : '<span class="v40badge ok">Baixa folga</span>';
      return `<tr><td><strong>${esc(br(d.date))}</strong><br><span class="muted">${esc(week[dayObj(d.date).getDay()])}</span></td><td>${badge}</td><td>${free.length}/${expected.length||'-'}<div class="v40bar"><b style="width:${pct}%"></b></div></td><td><div class="v40slots">${free.slice(0,24).map(t=>`<span class="v40slot">${esc(t)}</span>`).join('') || '<span class="muted">Nenhum horário legível no retorno do Disko.</span>'}</div></td><td><a class="secondary-button small-button" href="${esc(d.url || c.url)}" target="_blank" rel="noopener">Abrir</a></td></tr>`;
    }).join('');
    const totalFree = openDays.reduce((s,d)=>s+normalizeTimes((d.availableTimes&&d.availableTimes.length)?d.availableTimes:d.times).length,0);
    const weak = openDays.filter(d=>normalizeTimes((d.availableTimes&&d.availableTimes.length)?d.availableTimes:d.times).length >= Number(c.goal||5));
    const noData = openDays.filter(d=>!normalizeTimes((d.availableTimes&&d.availableTimes.length)?d.availableTimes:d.times).length);
    $('#'+BOX).innerHTML = `<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Agenda futura</p><h3>Agenda Vazia ligada ao Disko</h3><p class="muted">Fonte principal: agenda pública do Disko. Esta tela não usa a planilha para prever os próximos dias.</p></div></div>${controls()}<div class="v40grid"><div class="v40card"><span>Dias analisados</span><strong>${days.length}</strong></div><div class="v40card"><span>Dias abertos</span><strong>${openDays.length}</strong></div><div class="v40card"><span>Horários livres lidos</span><strong>${totalFree}</strong></div><div class="v40card"><span>Dias com alta folga</span><strong>${weak.length}</strong></div></div><div class="v40note">${noData.length ? `${noData.length} dia(s) aberto(s) não retornaram horários legíveis. Isso pode acontecer se o Disko montar os horários só por JavaScript interno.` : 'Leitura concluída sem erro de JSON.'}</div><div class="v40card" style="margin-top:14px"><h4>Próximos dias lidos no Disko</h4><table class="v40table"><thead><tr><th>Data</th><th>Status</th><th>Folga</th><th>Horários livres lidos</th><th>Disko</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
  }

  function renderEmpty(){
    ensureScreen();
    const cached = loadCache();
    if (cached?.data?.days?.length) return renderResult(cached.data);
    $('#'+BOX).innerHTML = `<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Agenda futura</p><h3>Agenda Vazia ligada ao Disko</h3><p class="muted">Use esta tela para ler os próximos dias diretamente da agenda pública do Disko.</p></div></div>${controls()}<div class="v40note">Clique em <strong>Ler agenda do Disko</strong>. A v40 não tenta converter HTML em JSON; ela valida a resposta antes e mostra erro claro se a função do Netlify não estiver publicada.</div></article>`;
  }

  async function loadDisko(){
    const c = {...cfg(), url:$('#v40Url')?.value || DEFAULT_URL, start:$('#v40Start')?.value || todayIso(), days:Number($('#v40Days')?.value || 10), interval:Number($('#v40Interval')?.value||30), goal:Number($('#v40Goal')?.value||5), weekStart:$('#v40WeekStart')?.value||cfg().weekStart, weekEnd:$('#v40WeekEnd')?.value||cfg().weekEnd, satStart:$('#v40SatStart')?.value||cfg().satStart, satEnd:$('#v40SatEnd')?.value||cfg().satEnd};
    setCfg(c);
    const box = $('#v40Status'); if (box) { box.className='import-status warning'; box.textContent='Lendo próximos dias diretamente no Disko...'; }
    try {
      const url = `/.netlify/functions/disko-proxy?url=${encodeURIComponent(c.url)}&start=${encodeURIComponent(c.start)}&days=${encodeURIComponent(c.days)}`;
      const json = await fetchJsonSafe(url);
      if (!json.ok) throw new Error(json.message || 'Falha ao ler Disko.');
      saveCache(json);
      renderResult(json);
      const b = $('#v40Status'); if (b) { b.className='import-status success'; b.textContent=`Disko lido: ${json.days?.length || 0} dia(s) analisado(s).`; }
    } catch (err) {
      const b = $('#v40Status'); if (b) { b.className='import-status error'; b.textContent=`Erro ao ler Disko: ${err.message || err}`; }
    }
  }

  document.addEventListener('click', e=>{
    if (e.target.closest('#v40Load')) { e.preventDefault(); e.stopPropagation(); loadDisko(); }
    if (e.target.closest('#v40SaveCfg')) { e.preventDefault(); e.stopPropagation(); setCfg({weekStart:$('#v40WeekStart')?.value,weekEnd:$('#v40WeekEnd')?.value,satStart:$('#v40SatStart')?.value,satEnd:$('#v40SatEnd')?.value,interval:Number($('#v40Interval')?.value||30),goal:Number($('#v40Goal')?.value||5)}); renderEmpty(); }
    if (e.target.closest(`.nav-link[data-screen="${AV}"]`)) setTimeout(renderEmpty, 220);
  }, true);

  const oldSet = window.setScreen;
  if (typeof oldSet === 'function') {
    window.setScreen = function(id){ const out = oldSet.apply(this, arguments); if (id === AV) setTimeout(renderEmpty, 220); return out; };
  }
  window.renderAgendaDiskoV40 = renderEmpty;
  window.loadAgendaDiskoV40 = loadDisko;
  setTimeout(()=>{ ensureScreen(); if ($('#'+AV)?.classList.contains('active')) renderEmpty(); }, 1800);
})();
