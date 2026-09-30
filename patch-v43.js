/* v43 - Corrige clique da aba Agenda Vazia e mantém Disko via /api/disko-proxy */
(function(){
  if (window.__agendaDiskoV43) return;
  window.__agendaDiskoV43 = true;
  window.__agendaDiskoV39 = true;
  window.__agendaDiskoV40 = true;
  window.__agendaDiskoV41 = true;
  window.__agendaDiskoV42 = true;

  const SCREEN = 'agendaVaziaDiskoV43';
  const BOX = 'agendaDiskoBoxV43';
  const CFG = 'agenda_disko_v43_cfg';
  const API = '/api/disko-proxy';
  const DEFAULT_URL = 'https://taisemourabarber.disko.com.br/marcacao';
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const week = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  function todayIso(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function br(iso){ const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso||''); }
  function dayObj(iso){ const m=String(iso||todayIso()).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1],+m[2]-1,+m[3],12) : new Date(); }
  function mins(t){ const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1]*60 + +m[2] : 0; }
  function hm(m){ return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }
  function uniqTimes(list){ return Array.from(new Set((list||[]).map(x=>String(x||'').trim()).filter(x=>/^(\d{1,2}):(\d{2})$/.test(x)).map(x=>{ const [h,m]=x.split(':'); return `${String(+h).padStart(2,'0')}:${m}`; }))).sort(); }
  function cfg(){ try { return { url:DEFAULT_URL, start:todayIso(), days:10, interval:30, goal:5, weekStart:'14:30', weekEnd:'20:00', satStart:'09:00', satEnd:'17:00', ...JSON.parse(localStorage.getItem(CFG)||'{}') }; } catch(e){ return { url:DEFAULT_URL, start:todayIso(), days:10, interval:30, goal:5, weekStart:'14:30', weekEnd:'20:00', satStart:'09:00', satEnd:'17:00' }; } }
  function setCfg(p){ localStorage.setItem(CFG, JSON.stringify({...cfg(), ...p})); }
  function expectedSlots(iso,c){ const dow=dayObj(iso).getDay(); if(dow===0) return []; const start=dow===6?c.satStart:c.weekStart; const end=dow===6?c.satEnd:c.weekEnd; const a=mins(start), b=mins(end), step=Math.max(15,Number(c.interval)||30); const out=[]; for(let m=a;m<b;m+=step) out.push(hm(m)); return out; }

  function css(){
    if($('#v43css')) return;
    const s=document.createElement('style'); s.id='v43css';
    s.textContent = `.v43grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.v43card{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.055);padding:16px}.v43card span{display:block;color:var(--muted);font-size:.82rem}.v43card strong{display:block;font-size:1.45rem;margin-top:6px}.v43filters{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:12px 0}.v43filters label{min-width:150px}.v43table{width:100%;border-collapse:collapse}.v43table th,.v43table td{border-bottom:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.v43table th{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.v43slots{display:flex;gap:6px;flex-wrap:wrap;max-width:520px}.v43slot{display:inline-flex;padding:4px 8px;border-radius:999px;background:rgba(87,214,137,.12);border:1px solid rgba(87,214,137,.25);color:#c9ffd9;font-weight:800;font-size:.78rem}.v43badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,211,109,.12);border:1px solid rgba(255,211,109,.25);color:#ffe7a8;font-weight:850;font-size:.76rem}.v43badge.bad{background:rgba(255,104,104,.12);border-color:rgba(255,104,104,.25);color:#ffd1d1}.v43badge.ok{background:rgba(87,214,137,.12);border-color:rgba(87,214,137,.25);color:#c9ffd9}.v43bar{height:12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid var(--line);overflow:hidden}.v43bar b{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--green),var(--gold),var(--orange))}.v43note{border:1px dashed var(--line);border-radius:18px;padding:14px;color:var(--muted);background:rgba(255,255,255,.035)}@media(max-width:1100px){.v43grid{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  }

  function ensureScreen(){
    css();
    ['agendaVaziaV33','agendaVaziaDiskoV41','agendaVaziaDiskoV42'].forEach(id=>{ const old=$('#'+id); if(old) old.classList.remove('active'); });
    let nav = $(`.nav-link[data-screen="${SCREEN}"]`) || $(`.nav-link[data-screen="agendaVaziaDiskoV42"]`) || $(`.nav-link[data-screen="agendaVaziaDiskoV41"]`) || $(`.nav-link[data-screen="agendaVaziaV33"]`) || $$('.nav-link').find(b => /agenda\s*vazia/i.test(b.textContent||''));
    if(!nav){ nav=document.createElement('button'); nav.type='button'; nav.className='nav-link'; ($('.nav') || $('.sidebar') || document.body).appendChild(nav); }
    nav.dataset.screen = SCREEN;
    nav.innerHTML = '<span>📅</span>Agenda Vazia';
    nav.style.display = 'flex';
    nav.classList.remove('v27-hidden');
    let screen=$('#'+SCREEN);
    if(!screen){ screen=document.createElement('section'); screen.id=SCREEN; screen.className='screen'; screen.innerHTML=`<div id="${BOX}"></div>`; ($('.content') || $('main') || document.body).appendChild(screen); }
    if(!$('#'+BOX)) screen.innerHTML=`<div id="${BOX}"></div>`;
  }

  function activate(){
    ensureScreen();
    $$('.screen').forEach(s=>s.classList.remove('active'));
    const screen=$('#'+SCREEN); if(screen) screen.classList.add('active');
    $$('.nav-link[data-screen]').forEach(b=>b.classList.toggle('active', b.dataset.screen===SCREEN));
    const title=$('#pageTitle') || $('.topbar h2'); if(title) title.textContent='Agenda Vazia';
    renderEmpty();
  }

  function controls(){ const c=cfg(); return `<div id="v43Status" class="import-status warning">Agenda Vazia conectada ao Disko via <code>${API}</code>.</div><div class="v43filters"><label>Link público Disko<input id="v43Url" value="${esc(c.url)}"></label><label>Data inicial<input type="date" id="v43Start" value="${esc(c.start)}"></label><label>Dias à frente<input type="number" id="v43Days" min="1" max="30" value="${esc(c.days)}"></label><label>Intervalo<input type="number" id="v43Interval" min="15" step="15" value="${esc(c.interval)}"></label><label>Meta livre/dia<input type="number" id="v43Goal" min="1" value="${esc(c.goal)}"></label><button type="button" class="primary-button" id="v43Load">Ler agenda do Disko</button></div><details class="v43note"><summary>Horários de funcionamento</summary><div class="v43filters"><label>Seg–sex início<input type="time" id="v43WeekStart" value="${esc(c.weekStart)}"></label><label>Seg–sex fim<input type="time" id="v43WeekEnd" value="${esc(c.weekEnd)}"></label><label>Sábado início<input type="time" id="v43SatStart" value="${esc(c.satStart)}"></label><label>Sábado fim<input type="time" id="v43SatEnd" value="${esc(c.satEnd)}"></label><button type="button" class="secondary-button" id="v43SaveCfg">Salvar horários</button></div></details>`; }

  function renderEmpty(){
    ensureScreen();
    const box=$('#'+BOX); if(!box) return;
    box.innerHTML = `<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Agenda futura</p><h3>Agenda Vazia ligada ao Disko</h3><p class="muted">Esta tela consulta o Disko diretamente por <code>${API}</code>, sem usar a planilha.</p></div></div>${controls()}<div class="v43note">A API já foi validada. Clique em <strong>Ler agenda do Disko</strong>. Se não aparecerem horários, significa que o HTML público do Disko não expôs os horários, mas a aba está funcionando.</div></article>`;
  }

  async function safeJson(response){ const text=await response.text(); const trimmed=text.trim(); if(!trimmed) throw new Error('Resposta vazia da rota API.'); if(trimmed.startsWith('<')) throw new Error('A rota API retornou HTML, não JSON. Verifique deploy sem cache.'); try{return JSON.parse(trimmed);}catch(e){throw new Error('JSON inválido: '+trimmed.slice(0,120));} }

  function renderResult(json,c){
    const days=Array.isArray(json.days)?json.days:[];
    const rows=days.map(d=>{ const expected=expectedSlots(d.date,c); const free=uniqTimes((d.availableTimes&&d.availableTimes.length?d.availableTimes:d.times)||[]).filter(t=>!expected.length || (mins(t)>=mins(expected[0]) && mins(t)<=mins(expected[expected.length-1]||'23:59'))); const pct=expected.length?Math.min(100,Math.round(free.length/expected.length*100)):0; const badge=!expected.length?'<span class="v43badge">Fechado</span>':!free.length?'<span class="v43badge bad">Sem horários lidos</span>':free.length>=Number(c.goal||5)?'<span class="v43badge bad">Alta folga</span>':'<span class="v43badge ok">Baixa folga</span>'; return `<tr><td><strong>${esc(br(d.date))}</strong><br><span class="muted">${esc(week[dayObj(d.date).getDay()])}</span></td><td>${badge}</td><td>${free.length}/${expected.length||'-'}<div class="v43bar"><b style="width:${pct}%"></b></div></td><td><div class="v43slots">${free.slice(0,24).map(t=>`<span class="v43slot">${esc(t)}</span>`).join('') || '<span class="muted">Nenhum horário encontrado no HTML público do Disko.</span>'}</div></td><td><a class="secondary-button small-button" href="${esc(d.url||c.url)}" target="_blank" rel="noopener">Abrir</a></td></tr>`; }).join('');
    const totalFree=days.reduce((s,d)=>s+uniqTimes((d.availableTimes&&d.availableTimes.length?d.availableTimes:d.times)||[]).length,0);
    const high=days.filter(d=>uniqTimes((d.availableTimes&&d.availableTimes.length?d.availableTimes:d.times)||[]).length>=Number(c.goal||5)).length;
    $('#'+BOX).innerHTML = `<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Agenda futura</p><h3>Agenda Vazia ligada ao Disko</h3><p class="muted">Fonte: ${esc(API)}</p></div></div>${controls()}<div class="v43grid"><div class="v43card"><span>Dias analisados</span><strong>${days.length}</strong></div><div class="v43card"><span>Horários livres lidos</span><strong>${totalFree}</strong></div><div class="v43card"><span>Dias com alta folga</span><strong>${high}</strong></div><div class="v43card"><span>Status API</span><strong>${json.ok?'OK':'Erro'}</strong></div></div><div class="v43card" style="margin-top:14px"><h4>Próximos dias lidos no Disko</h4><table class="v43table"><thead><tr><th>Data</th><th>Status</th><th>Folga</th><th>Horários livres</th><th>Disko</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Nenhum dia retornado.</td></tr>'}</tbody></table></div>${json.errors?.length?`<div class="v43note" style="margin-top:14px">Avisos técnicos: ${esc(json.errors.slice(0,3).map(e=>e.message).join(' | '))}</div>`:''}</article>`;
  }

  async function loadDisko(){
    const c={...cfg(), url:$('#v43Url')?.value||DEFAULT_URL, start:$('#v43Start')?.value||todayIso(), days:Number($('#v43Days')?.value||10), interval:Number($('#v43Interval')?.value||30), goal:Number($('#v43Goal')?.value||5), weekStart:$('#v43WeekStart')?.value||cfg().weekStart, weekEnd:$('#v43WeekEnd')?.value||cfg().weekEnd, satStart:$('#v43SatStart')?.value||cfg().satStart, satEnd:$('#v43SatEnd')?.value||cfg().satEnd};
    setCfg(c);
    const status=$('#v43Status'); if(status){status.className='import-status warning'; status.textContent='Lendo Disko via /api/disko-proxy...';}
    try{ const url=`${API}?url=${encodeURIComponent(c.url)}&start=${encodeURIComponent(c.start)}&days=${encodeURIComponent(c.days)}`; const res=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}}); const json=await safeJson(res); if(!json.ok) throw new Error(json.message||'A API retornou erro.'); renderResult(json,c); const b=$('#v43Status'); if(b){b.className='import-status success'; b.textContent=`Disko lido: ${(json.days||[]).length} dia(s) analisado(s).`;}}
    catch(err){ const b=$('#v43Status'); if(b){b.className='import-status error'; b.textContent=`Erro ao ler Disko: ${err.message||err}`;} }
  }

  document.addEventListener('click', function(e){
    const agendaNav=e.target.closest(`.nav-link[data-screen="${SCREEN}"]`) || (e.target.closest('.nav-link') && /agenda\s*vazia/i.test(e.target.closest('.nav-link').textContent||'') ? e.target.closest('.nav-link') : null);
    if(agendaNav){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); activate(); return false; }
    if(e.target.closest('#v43Load')){ e.preventDefault(); e.stopPropagation(); loadDisko(); return false; }
    if(e.target.closest('#v43SaveCfg')){ e.preventDefault(); setCfg({weekStart:$('#v43WeekStart')?.value,weekEnd:$('#v43WeekEnd')?.value,satStart:$('#v43SatStart')?.value,satEnd:$('#v43SatEnd')?.value,interval:Number($('#v43Interval')?.value||30),goal:Number($('#v43Goal')?.value||5)}); renderEmpty(); return false; }
  }, true);

  const oldSet=window.setScreen;
  if(typeof oldSet==='function') window.setScreen=function(id){ if(id===SCREEN || id==='agendaVaziaV33' || id==='agendaVaziaDiskoV42'){ activate(); return; } return oldSet.apply(this,arguments); };
  window.renderAgendaDiskoV43=activate;
  window.loadAgendaDiskoV43=loadDisko;
  setTimeout(ensureScreen,300);
  setTimeout(ensureScreen,1500);
})();