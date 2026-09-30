/* v41 - Agenda Vazia Disko limpa: remove conflito v39/v40 e trata HTML sem quebrar JSON */
(function(){
  if (window.__agendaDiskoV41) return;
  window.__agendaDiskoV41 = true;

  // Impede versões antigas em cache de assumirem a agenda.
  window.__agendaDiskoV39 = true;
  window.__agendaDiskoV40 = true;

  const SCREEN = 'agendaVaziaDiskoV41';
  const BOX = 'agendaDiskoBoxV41';
  const CFG = 'agenda_disko_v41_cfg';
  const DEFAULT_URL = 'https://taisemourabarber.disko.com.br/marcacao';
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const week = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  function todayIso(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function addDays(iso,n){ const m=String(iso||todayIso()).match(/^(\d{4})-(\d{2})-(\d{2})/); const d=m?new Date(+m[1],+m[2]-1,+m[3]+n,12):new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function dayObj(iso){ const m=String(iso||todayIso()).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1],+m[2]-1,+m[3],12) : new Date(); }
  function br(iso){ const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso||''); }
  function mins(t){ const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1]*60 + +m[2] : 0; }
  function hm(m){ return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }
  function uniqTimes(list){ return Array.from(new Set((list||[]).map(x=>String(x||'').trim()).filter(x=>/^(\d{1,2}):(\d{2})$/.test(x)).map(x=>{const [h,m]=x.split(':'); return `${String(+h).padStart(2,'0')}:${m}`}))).sort(); }

  function cfg(){
    try { return { url:DEFAULT_URL, start:todayIso(), days:10, interval:30, goal:5, weekStart:'14:30', weekEnd:'20:00', satStart:'09:00', satEnd:'17:00', ...JSON.parse(localStorage.getItem(CFG)||'{}') }; }
    catch(e){ return { url:DEFAULT_URL, start:todayIso(), days:10, interval:30, goal:5, weekStart:'14:30', weekEnd:'20:00', satStart:'09:00', satEnd:'17:00' }; }
  }
  function setCfg(p){ localStorage.setItem(CFG, JSON.stringify({...cfg(), ...p})); }

  function expectedSlots(iso, c){
    const dow = dayObj(iso).getDay();
    if (dow === 0) return [];
    const start = dow === 6 ? c.satStart : c.weekStart;
    const end = dow === 6 ? c.satEnd : c.weekEnd;
    const a=mins(start), b=mins(end), step=Math.max(15, Number(c.interval)||30);
    const out=[]; for(let m=a; m<b; m+=step) out.push(hm(m)); return out;
  }

  function ensureCss(){
    if ($('#v41css')) return;
    const s=document.createElement('style'); s.id='v41css';
    s.textContent=`.v41grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.v41card{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.055);padding:16px}.v41card span{display:block;color:var(--muted);font-size:.82rem}.v41card strong{display:block;font-size:1.45rem;margin-top:6px}.v41filters{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:12px 0}.v41filters label{min-width:150px}.v41table{width:100%;border-collapse:collapse}.v41table th,.v41table td{border-bottom:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.v41table th{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.v41slots{display:flex;gap:6px;flex-wrap:wrap;max-width:520px}.v41slot{display:inline-flex;padding:4px 8px;border-radius:999px;background:rgba(87,214,137,.12);border:1px solid rgba(87,214,137,.25);color:#c9ffd9;font-weight:800;font-size:.78rem}.v41badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,211,109,.12);border:1px solid rgba(255,211,109,.25);color:#ffe7a8;font-weight:850;font-size:.76rem}.v41badge.bad{background:rgba(255,104,104,.12);border-color:rgba(255,104,104,.25);color:#ffd1d1}.v41badge.ok{background:rgba(87,214,137,.12);border-color:rgba(87,214,137,.25);color:#c9ffd9}.v41bar{height:12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid var(--line);overflow:hidden}.v41bar b{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--green),var(--gold),var(--orange))}.v41note{border:1px dashed var(--line);border-radius:18px;padding:14px;color:var(--muted);background:rgba(255,255,255,.035)}@media(max-width:1100px){.v41grid{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  }

  function ensureScreen(){
    ensureCss();
    // Desativa telas antigas de agenda para não misturar botões/eventos.
    ['agendaVaziaV33'].forEach(id => { const old=$('#'+id); if(old && id!==SCREEN) old.classList.remove('active'); });
    let nav = $(`.nav-link[data-screen="${SCREEN}"]`) || $(`.nav-link[data-screen="agendaVaziaV33"]`);
    if (!nav) { nav=document.createElement('button'); nav.type='button'; nav.className='nav-link'; $('.nav')?.appendChild(nav); }
    nav.dataset.screen = SCREEN;
    nav.innerHTML = '<span>📅</span>Agenda Vazia';
    nav.style.display='flex';
    let screen = $('#'+SCREEN);
    if (!screen) { screen=document.createElement('section'); screen.id=SCREEN; screen.className='screen'; screen.innerHTML=`<div id="${BOX}"></div>`; $('.content')?.appendChild(screen); }
    if (!$('#'+BOX)) screen.innerHTML=`<div id="${BOX}"></div>`;
  }

  function controls(){ const c=cfg(); return `<div id="v41Status" class="import-status warning">Agenda Vazia ligada diretamente ao Disko. Clique em Ler agenda do Disko.</div><div class="v41filters"><label>Link público Disko<input id="v41Url" value="${esc(c.url)}"></label><label>Data inicial<input type="date" id="v41Start" value="${esc(c.start || todayIso())}"></label><label>Dias à frente<input type="number" id="v41Days" min="1" max="30" value="${esc(c.days)}"></label><label>Intervalo<input type="number" id="v41Interval" min="15" step="15" value="${esc(c.interval)}"></label><label>Meta livre/dia<input type="number" id="v41Goal" min="1" value="${esc(c.goal)}"></label><button type="button" class="primary-button" id="v41Load">Ler agenda do Disko</button></div><details class="v41note"><summary>Horários de funcionamento</summary><div class="v41filters"><label>Seg–sex início<input type="time" id="v41WeekStart" value="${esc(c.weekStart)}"></label><label>Seg–sex fim<input type="time" id="v41WeekEnd" value="${esc(c.weekEnd)}"></label><label>Sábado início<input type="time" id="v41SatStart" value="${esc(c.satStart)}"></label><label>Sábado fim<input type="time" id="v41SatEnd" value="${esc(c.satEnd)}"></label><button type="button" class="secondary-button" id="v41SaveCfg">Salvar horários</button></div></details>`; }

  function renderEmpty(){ ensureScreen(); $('#'+BOX).innerHTML = `<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Agenda futura</p><h3>Agenda Vazia ligada ao Disko</h3><p class="muted">Esta tela não usa a planilha. Ela consulta a função Netlify <code>disko-proxy</code>, que lê o link público do Disko.</p></div></div>${controls()}<div class="v41note">Clique em <strong>Ler agenda do Disko</strong>. Se a resposta vier como HTML em vez de JSON, o sistema não vai quebrar; ele mostrará o diagnóstico aqui.</div></article>`; }

  function normalizeResponse(json, c){
    let days = Array.isArray(json.days) ? json.days : [];
    if (!days.length && (json.availableTimes?.length || json.times?.length)) {
      days = Array.from({length:Number(c.days)||10}, (_,i)=>({ date:addDays(c.start,i), url:json.url||c.url, times:json.times||[], availableTimes:json.availableTimes||json.times||[] }));
    }
    return days;
  }

  function renderResult(json,c){
    const days=normalizeResponse(json,c);
    const rows=days.map(d=>{
      const expected=expectedSlots(d.date,c);
      const free=uniqTimes((d.availableTimes&&d.availableTimes.length?d.availableTimes:d.times)||[]).filter(t=>!expected.length || (mins(t)>=mins(expected[0]) && mins(t)<=mins(expected[expected.length-1]||'23:59')));
      const pct=expected.length?Math.min(100,Math.round(free.length/expected.length*100)):0;
      const badge=!expected.length?'<span class="v41badge">Fechado</span>':!free.length?'<span class="v41badge bad">Sem horários lidos</span>':free.length>=Number(c.goal||5)?'<span class="v41badge bad">Alta folga</span>':'<span class="v41badge ok">Baixa folga</span>';
      return `<tr><td><strong>${esc(br(d.date))}</strong><br><span class="muted">${esc(week[dayObj(d.date).getDay()])}</span></td><td>${badge}</td><td>${free.length}/${expected.length||'-'}<div class="v41bar"><b style="width:${pct}%"></b></div></td><td><div class="v41slots">${free.slice(0,24).map(t=>`<span class="v41slot">${esc(t)}</span>`).join('') || '<span class="muted">Nenhum horário encontrado no retorno do Disko.</span>'}</div></td><td><a class="secondary-button small-button" href="${esc(d.url||c.url)}" target="_blank" rel="noopener">Abrir</a></td></tr>`;
    }).join('');
    const totalFree = days.reduce((s,d)=>s+uniqTimes((d.availableTimes&&d.availableTimes.length?d.availableTimes:d.times)||[]).length,0);
    const high = days.filter(d=>uniqTimes((d.availableTimes&&d.availableTimes.length?d.availableTimes:d.times)||[]).length>=Number(c.goal||5)).length;
    $('#'+BOX).innerHTML = `<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Agenda futura</p><h3>Agenda Vazia ligada ao Disko</h3><p class="muted">Fonte principal: agenda pública do Disko.</p></div></div>${controls()}<div class="v41grid"><div class="v41card"><span>Dias analisados</span><strong>${days.length}</strong></div><div class="v41card"><span>Horários livres lidos</span><strong>${totalFree}</strong></div><div class="v41card"><span>Dias com alta folga</span><strong>${high}</strong></div><div class="v41card"><span>Status</span><strong>${json.ok?'OK':'Erro'}</strong></div></div><div class="v41card" style="margin-top:14px"><h4>Próximos dias lidos no Disko</h4><table class="v41table"><thead><tr><th>Data</th><th>Status</th><th>Folga</th><th>Horários livres lidos</th><th>Disko</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Nenhum dia retornado.</td></tr>'}</tbody></table></div>${json.errors?.length?`<div class="v41note" style="margin-top:14px">Avisos técnicos: ${esc(json.errors.slice(0,3).map(e=>e.message).join(' | '))}</div>`:''}</article>`;
  }

  async function safeReadJson(response){
    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Resposta vazia da função Disko.');
    if (trimmed.startsWith('<') || contentType.includes('text/html')) {
      throw new Error('A função Disko retornou HTML, não JSON. Isso indica que o deploy da função não publicou ou a rota foi redirecionada para o index.html.');
    }
    try { return JSON.parse(trimmed); }
    catch(e){ throw new Error('Resposta da função Disko não é JSON válido: '+trimmed.slice(0,120)); }
  }

  async function loadDisko(){
    const c={...cfg(), url:$('#v41Url')?.value||DEFAULT_URL, start:$('#v41Start')?.value||todayIso(), days:Number($('#v41Days')?.value||10), interval:Number($('#v41Interval')?.value||30), goal:Number($('#v41Goal')?.value||5), weekStart:$('#v41WeekStart')?.value||cfg().weekStart, weekEnd:$('#v41WeekEnd')?.value||cfg().weekEnd, satStart:$('#v41SatStart')?.value||cfg().satStart, satEnd:$('#v41SatEnd')?.value||cfg().satEnd};
    setCfg(c);
    const box=$('#v41Status'); if(box){box.className='import-status warning';box.textContent='Lendo Disko via função Netlify...';}
    try{
      const url=`/.netlify/functions/disko-proxy?url=${encodeURIComponent(c.url)}&start=${encodeURIComponent(c.start)}&days=${encodeURIComponent(c.days)}`;
      const res=await fetch(url,{cache:'no-store', headers:{'Accept':'application/json'}});
      const json=await safeReadJson(res);
      if(!json.ok) throw new Error(json.message||'A função Disko retornou erro.');
      renderResult(json,c);
      const b=$('#v41Status'); if(b){b.className='import-status success';b.textContent=`Disko lido: ${(json.days||[]).length} dia(s) analisado(s).`;}
    } catch(err){
      const b=$('#v41Status'); if(b){b.className='import-status error';b.textContent=`Erro ao ler Disko: ${err.message||err}`;}
    }
  }

  document.addEventListener('click', e=>{
    const oldBtn=e.target.closest('#v39Load,#v40Load');
    if(oldBtn){ e.preventDefault(); e.stopImmediatePropagation(); loadDisko(); return; }
    const btn=e.target.closest('#v41Load');
    if(btn){ e.preventDefault(); e.stopImmediatePropagation(); loadDisko(); return; }
    const save=e.target.closest('#v41SaveCfg');
    if(save){ e.preventDefault(); e.stopImmediatePropagation(); setCfg({weekStart:$('#v41WeekStart')?.value,weekEnd:$('#v41WeekEnd')?.value,satStart:$('#v41SatStart')?.value,satEnd:$('#v41SatEnd')?.value,interval:Number($('#v41Interval')?.value||30),goal:Number($('#v41Goal')?.value||5)}); renderEmpty(); return; }
    const nav=e.target.closest(`.nav-link[data-screen="${SCREEN}"],.nav-link[data-screen="agendaVaziaV33"]`);
    if(nav){ e.preventDefault(); e.stopImmediatePropagation(); ensureScreen(); $$('.screen').forEach(s=>s.classList.remove('active')); $('#'+SCREEN)?.classList.add('active'); $$('.nav-link[data-screen]').forEach(b=>b.classList.toggle('active', b.dataset.screen===SCREEN)); const title=$('#pageTitle'); if(title) title.textContent='Agenda Vazia'; renderEmpty(); }
  }, true);

  const oldSet=window.setScreen;
  if(typeof oldSet==='function'){
    window.setScreen=function(id){ if(id==='agendaVaziaV33'||id===SCREEN){ ensureScreen(); $$('.screen').forEach(s=>s.classList.remove('active')); $('#'+SCREEN)?.classList.add('active'); renderEmpty(); return; } return oldSet.apply(this,arguments); };
  }
  window.renderAgendaDiskoV41=renderEmpty;
  window.loadAgendaDiskoV41=loadDisko;
  setTimeout(()=>{ ensureScreen(); if($('#'+SCREEN)?.classList.contains('active') || $('#agendaVaziaV33')?.classList.contains('active')) renderEmpty(); },1000);
})();