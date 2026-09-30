/* v39 - Agenda Vazia ligada diretamente ao Disko, não à planilha */
(function(){
  if (window.__agendaDiskoV39) return;
  window.__agendaDiskoV39 = true;

  const AV = 'agendaVaziaV33';
  const BOX = 'avV33';
  const CFG = 'agenda_disko_v39_cfg';
  const CACHE = 'agenda_disko_v39_cache';
  const DEFAULT_URL = 'https://taisemourabarber.disko.com.br/marcacao';
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const week = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const br = iso => { const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso||''); };
  const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const addDays = (iso,n) => { const m=String(iso||todayIso()).match(/^(\d{4})-(\d{2})-(\d{2})/); const d=m?new Date(+m[1],+m[2]-1,+m[3]+n,12):new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dayObj = iso => { const m=String(iso||todayIso()).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1],+m[2]-1,+m[3],12) : new Date(); };
  const mins = t => { const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1]*60 + +m[2] : 0; };
  const hm = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

  function cfg(){
    try { return { url:DEFAULT_URL, start:todayIso(), days:10, interval:30, goal:5, weekStart:'14:30', weekEnd:'20:00', satStart:'09:00', satEnd:'17:00', ...JSON.parse(localStorage.getItem(CFG)||'{}') }; }
    catch(e){ return { url:DEFAULT_URL, start:todayIso(), days:10, interval:30, goal:5, weekStart:'14:30', weekEnd:'20:00', satStart:'09:00', satEnd:'17:00' }; }
  }
  function setCfg(p){ localStorage.setItem(CFG, JSON.stringify({...cfg(), ...p})); }
  function loadCache(){ try{return JSON.parse(localStorage.getItem(CACHE)||'null')}catch(e){return null} }
  function saveCache(x){ try{localStorage.setItem(CACHE, JSON.stringify({...x, savedAt:new Date().toISOString()}));}catch(e){} }

  function ensureCss(){
    if ($('#v39css')) return;
    const s=document.createElement('style'); s.id='v39css';
    s.textContent=`.v39grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.v39two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.v39card{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.055);padding:16px}.v39card span{display:block;color:var(--muted);font-size:.82rem}.v39card strong{display:block;font-size:1.45rem;margin-top:6px}.v39filters{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:12px 0}.v39filters label{min-width:150px}.v39table{width:100%;border-collapse:collapse}.v39table th,.v39table td{border-bottom:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.v39table th{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.v39slots{display:flex;gap:6px;flex-wrap:wrap;max-width:520px}.v39slot{display:inline-flex;padding:4px 8px;border-radius:999px;background:rgba(87,214,137,.12);border:1px solid rgba(87,214,137,.25);color:#c9ffd9;font-weight:800;font-size:.78rem}.v39badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,211,109,.12);border:1px solid rgba(255,211,109,.25);color:#ffe7a8;font-weight:850;font-size:.76rem}.v39badge.bad{background:rgba(255,104,104,.12);border-color:rgba(255,104,104,.25);color:#ffd1d1}.v39badge.ok{background:rgba(87,214,137,.12);border-color:rgba(87,214,137,.25);color:#c9ffd9}.v39bar{height:12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid var(--line);overflow:hidden}.v39bar b{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--green),var(--gold),var(--orange))}.v39note{border:1px dashed var(--line);border-radius:18px;padding:14px;color:var(--muted);background:rgba(255,255,255,.035)}@media(max-width:1100px){.v39grid,.v39two{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  }

  function ensureScreen(){
    ensureCss();
    let nav = $(`.nav-link[data-screen="${AV}"]`);
    if (!nav) {
      nav = document.createElement('button'); nav.type='button'; nav.className='nav-link'; nav.dataset.screen=AV; nav.innerHTML='<span>📅</span>Agenda Vazia'; $('.nav')?.appendChild(nav);
    }
    nav.style.display='flex';
    let screen = $('#'+AV);
    if (!screen) { screen=document.createElement('section'); screen.id=AV; screen.className='screen'; screen.innerHTML=`<div id="${BOX}"></div>`; $('.content')?.appendChild(screen); }
    if (!$('#'+BOX)) screen.innerHTML=`<div id="${BOX}"></div>`;
  }

  function expectedSlots(iso, c){
    const d=dayObj(iso); const dow=d.getDay();
    if (dow === 0) return [];
    const start = dow === 6 ? c.satStart : c.weekStart;
    const end = dow === 6 ? c.satEnd : c.weekEnd;
    const a=mins(start), b=mins(end), step=Math.max(15, Number(c.interval)||30);
    const out=[]; for(let m=a; m<b; m+=step) out.push(hm(m)); return out;
  }

  function normalizeTimes(list){
    return Array.from(new Set((list||[]).map(x=>String(x||'').trim()).filter(x=>/^(\d{1,2}):(\d{2})$/.test(x)).map(x=>{const [h,m]=x.split(':'); return `${String(+h).padStart(2,'0')}:${m}`}))).sort();
  }

  function controls(){
    const c=cfg();
    return `<div id="v39Status" class="import-status warning">Agenda Vazia agora usa o Disko diretamente. Clique em Ler agenda do Disko.</div>
    <div class="v39filters">
      <label>Link público Disko<input id="v39Url" value="${esc(c.url)}" placeholder="https://taisemourabarber.disko.com.br/marcacao"></label>
      <label>Data inicial<input type="date" id="v39Start" value="${esc(c.start || todayIso())}"></label>
      <label>Dias à frente<input type="number" id="v39Days" min="1" max="30" value="${esc(c.days)}"></label>
      <label>Intervalo agenda<input type="number" id="v39Interval" min="15" step="15" value="${esc(c.interval)}"></label>
      <label>Meta mín. horários livres<input type="number" id="v39Goal" min="1" value="${esc(c.goal)}"></label>
      <button type="button" class="primary-button" id="v39Load">Ler agenda do Disko</button>
    </div>
    <details class="v39note"><summary>Configurar horários de funcionamento</summary>
      <div class="v39filters">
        <label>Seg–sex início<input type="time" id="v39WeekStart" value="${esc(c.weekStart)}"></label>
        <label>Seg–sex fim<input type="time" id="v39WeekEnd" value="${esc(c.weekEnd)}"></label>
        <label>Sábado início<input type="time" id="v39SatStart" value="${esc(c.satStart)}"></label>
        <label>Sábado fim<input type="time" id="v39SatEnd" value="${esc(c.satEnd)}"></label>
        <button type="button" class="secondary-button" id="v39SaveCfg">Salvar horários</button>
      </div>
    </details>`;
  }

  function summarize(days, c){
    const openDays = days.filter(d=>expectedSlots(d.date,c).length>0);
    const totalFree = openDays.reduce((s,d)=>s+normalizeTimes(d.availableTimes?.length?d.availableTimes:d.times).length,0);
    const weak = openDays.filter(d=>normalizeTimes(d.availableTimes?.length?d.availableTimes:d.times).length >= Number(c.goal||5));
    const noData = openDays.filter(d=>!normalizeTimes(d.availableTimes?.length?d.availableTimes:d.times).length);
    const best = [...openDays].sort((a,b)=>normalizeTimes(b.availableTimes?.length?b.availableTimes:b.times).length-normalizeTimes(a.availableTimes?.length?a.availableTimes:a.times).length)[0];
    return { openDays, totalFree, weak, noData, best };
  }

  function renderResult(data){
    ensureScreen();
    const c=cfg(); const days = Array.isArray(data?.days) ? data.days : [];
    const s = summarize(days,c);
    const cards = `<div class="v39grid"><div class="v39card"><span>Dias analisados</span><strong>${days.length}</strong></div><div class="v39card"><span>Dias úteis abertos</span><strong>${s.openDays.length}</strong></div><div class="v39card"><span>Horários livres no Disko</span><strong>${s.totalFree}</strong></div><div class="v39card"><span>Dias com agenda vazia</span><strong>${s.weak.length}</strong></div></div>`;
    const rows = days.map(d=>{
      const expected = expectedSlots(d.date,c);
      const free = normalizeTimes(d.availableTimes?.length ? d.availableTimes : d.times).filter(t=>!expected.length || (mins(t)>=mins(expected[0]) && mins(t)<=mins(expected[expected.length-1]||'23:59')));
      const pct = expected.length ? Math.min(100, Math.round((free.length/expected.length)*100)) : 0;
      const badge = !expected.length ? '<span class="v39badge">Fechado</span>' : !free.length ? '<span class="v39badge bad">Sem horários lidos</span>' : free.length >= Number(c.goal||5) ? '<span class="v39badge bad">Alta folga</span>' : '<span class="v39badge ok">Baixa folga</span>';
      return `<tr><td><strong>${esc(br(d.date))}</strong><br><span class="muted">${esc(week[dayObj(d.date).getDay()])}</span></td><td>${badge}</td><td>${free.length}/${expected.length||'-'}<div class="v39bar"><b style="width:${pct}%"></b></div></td><td><div class="v39slots">${free.slice(0,24).map(t=>`<span class="v39slot">${esc(t)}</span>`).join('') || '<span class="muted">Nenhum horário encontrado no retorno do Disko.</span>'}</div></td><td><a class="secondary-button small-button" href="${esc(d.url || c.url)}" target="_blank" rel="noopener">Abrir</a></td></tr>`;
    }).join('');
    const suggestion = s.best ? `Maior folga encontrada: ${br(s.best.date)} com ${normalizeTimes(s.best.availableTimes?.length?s.best.availableTimes:s.best.times).length} horário(s) livres no Disko.` : 'Nenhum dado de horário foi encontrado no Disko.';
    $('#'+BOX).innerHTML = `<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Agenda futura</p><h3>Agenda Vazia ligada ao Disko</h3><p class="muted">Fonte principal: agenda pública do Disko. Esta tela não usa a planilha para prever os próximos dias.</p></div></div>${controls()}${cards}<div class="v39note" style="margin-top:14px">${esc(suggestion)} ${s.noData.length ? `Em ${s.noData.length} dia(s), o Disko não retornou horários legíveis; pode ser página dinâmica ou dia sem agenda pública.` : ''}</div><div class="v39card" style="margin-top:14px"><h4>Próximos dias lidos no Disko</h4><table class="v39table"><thead><tr><th>Data</th><th>Status</th><th>Folga</th><th>Horários livres lidos</th><th>Disko</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
  }

  function renderEmpty(){
    ensureScreen();
    const cached = loadCache();
    if (cached?.data?.days?.length) return renderResult(cached.data);
    $('#'+BOX).innerHTML = `<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Agenda futura</p><h3>Agenda Vazia ligada ao Disko</h3><p class="muted">Use esta tela para ler os próximos dias diretamente da agenda pública do Disko.</p></div></div>${controls()}<div class="v39note">Clique em <strong>Ler agenda do Disko</strong>. Se o Disko entregar os horários no HTML público, o sistema lista os próximos dias e os horários livres. Se o Disko renderizar tudo por JavaScript interno, o aviso vai aparecer aqui.</div></article>`;
  }

  async function loadDisko(){
    const c={...cfg(), url:$('#v39Url')?.value || DEFAULT_URL, start:$('#v39Start')?.value || todayIso(), days:Number($('#v39Days')?.value || 10), interval:Number($('#v39Interval')?.value||30), goal:Number($('#v39Goal')?.value||5), weekStart:$('#v39WeekStart')?.value||cfg().weekStart, weekEnd:$('#v39WeekEnd')?.value||cfg().weekEnd, satStart:$('#v39SatStart')?.value||cfg().satStart, satEnd:$('#v39SatEnd')?.value||cfg().satEnd};
    setCfg(c);
    const box=$('#v39Status'); if(box){box.className='import-status warning';box.textContent='Lendo próximos dias diretamente no Disko...';}
    try{
      const url=`/.netlify/functions/disko-proxy?url=${encodeURIComponent(c.url)}&start=${encodeURIComponent(c.start)}&days=${encodeURIComponent(c.days)}`;
      const json=await fetch(url,{cache:'no-store'}).then(r=>r.json());
      if(!json.ok) throw new Error(json.message || 'Falha ao ler Disko.');
      saveCache({data:json,cfg:c});
      renderResult(json);
      const b=$('#v39Status'); if(b){b.className='import-status success';b.textContent=`Disko lido: ${json.days?.length||0} dia(s) analisado(s).`;}
    }catch(err){
      const b=$('#v39Status'); if(b){b.className='import-status error';b.textContent=`Erro ao ler Disko: ${err.message || err}`;}
    }
  }

  document.addEventListener('click', e=>{
    if(e.target.closest('#v39Load')){ e.preventDefault(); loadDisko(); }
    if(e.target.closest('#v39SaveCfg')){ e.preventDefault(); setCfg({weekStart:$('#v39WeekStart')?.value,weekEnd:$('#v39WeekEnd')?.value,satStart:$('#v39SatStart')?.value,satEnd:$('#v39SatEnd')?.value,interval:Number($('#v39Interval')?.value||30),goal:Number($('#v39Goal')?.value||5)}); renderEmpty(); }
    const nav=e.target.closest(`.nav-link[data-screen="${AV}"]`);
    if(nav){ setTimeout(renderEmpty,80); }
  }, true);

  const oldSet = window.setScreen;
  if (typeof oldSet === 'function') {
    window.setScreen = function(id){ const out=oldSet.apply(this,arguments); if(id===AV) setTimeout(renderEmpty,80); return out; };
  }
  window.renderAgendaDiskoV39 = renderEmpty;
  window.loadAgendaDiskoV39 = loadDisko;
  setTimeout(()=>{ ensureScreen(); if($('#'+AV)?.classList.contains('active')) renderEmpty(); },1400);
})();