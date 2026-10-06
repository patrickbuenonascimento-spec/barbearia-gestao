/* v45 - Agenda do Dia: Disko + clientes marcados + plano manual */
(function(){
  if(window.__agendaDiaV45) return;
  window.__agendaDiaV45 = true;

  const SHEET_ID = '1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc';
  const SCREEN = 'agendaDiaV45';
  const BOX = 'agendaDiaBoxV45';
  const CFG = 'agenda_dia_v45_cfg';
  const MANUAL = 'agenda_dia_v45_manual';
  const API = '/api/disko-proxy';
  const DEFAULT_URL = 'https://taisemourabarber.disko.com.br/marcacao';
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const week = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  function today(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function br(iso){ const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m?`${m[3]}/${m[2]}/${m[1]}`:String(iso||''); }
  function dObj(iso){ const m=String(iso||today()).match(/^(\d{4})-(\d{2})-(\d{2})/); return m?new Date(+m[1],+m[2]-1,+m[3],12):new Date(); }
  function norm(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
  function mins(t){ const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1]*60 + +m[2] : null; }
  function hm(n){ return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`; }
  function uniqTimes(list){ return Array.from(new Set((list||[]).map(x=>String(x||'').trim()).filter(x=>/^(\d{1,2}):(\d{2})$/.test(x)).map(x=>{const [h,m]=x.split(':');return `${String(+h).padStart(2,'0')}:${m}`}))).sort(); }
  function cfg(){ try{return {url:DEFAULT_URL,date:today(),interval:30,weekStart:'14:30',weekEnd:'20:00',satStart:'09:00',satEnd:'17:00',...JSON.parse(localStorage.getItem(CFG)||'{}')}}catch(e){return {url:DEFAULT_URL,date:today(),interval:30,weekStart:'14:30',weekEnd:'20:00',satStart:'09:00',satEnd:'17:00'}} }
  function setCfg(p){ localStorage.setItem(CFG,JSON.stringify({...cfg(),...p})); }
  function manualAll(){ try{return JSON.parse(localStorage.getItem(MANUAL)||'{}')}catch(e){return {}} }
  function manualDay(date){ return manualAll()[date] || {free:'',booked:''}; }
  function saveManualDay(date,data){ const all=manualAll(); all[date]=data; localStorage.setItem(MANUAL,JSON.stringify(all)); }

  function parseIsoDate(v){
    if(!v) return '';
    const s=String(v).trim();
    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return `${m[1]}-${String(+m[2]).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`;
    m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if(m){ let a=+m[1], b=+m[2], y=String(m[3]).length===2?'20'+m[3]:m[3]; let mo,da; if(a>12){da=a;mo=b}else{mo=a;da=b} return `${y}-${String(mo).padStart(2,'0')}-${String(da).padStart(2,'0')}`; }
    return '';
  }
  function csvParse(text){ const rows=[]; let row=[],cur='',q=false; const s=String(text||''); for(let i=0;i<s.length;i++){ const ch=s[i],nx=s[i+1]; if(ch==='"'){ if(q&&nx==='"'){cur+='"';i++;} else q=!q; } else if(ch===','&&!q){row.push(cur);cur='';} else if((ch==='\n'||ch==='\r')&&!q){ if(ch==='\r'&&nx==='\n')i++; row.push(cur); rows.push(row); row=[]; cur=''; } else cur+=ch; } row.push(cur); rows.push(row); return rows.map(r=>r.map(x=>String(x||'').trim())); }
  function rowsToObjects(rows){ let idx=-1,best=0; rows.forEach((r,i)=>{ const sc=['data','hora','cliente','servico','profissional'].reduce((s,k)=>s+(r.some(c=>norm(c).includes(k))?1:0),0); if(sc>best){best=sc;idx=i;} }); if(idx<0||best<3)return []; const h=rows[idx].map(x=>String(x||'').trim()); return rows.slice(idx+1).map(r=>{const o={}; h.forEach((k,i)=>{if(k)o[k]=r[i]||''}); return o;}).filter(o=>Object.values(o).some(v=>String(v||'').trim()&&String(v).trim()!=='-')); }
  async function loadAtendimentos(){
    const cacheKey='agenda_dia_v45_atendimentos';
    try{ const c=JSON.parse(localStorage.getItem(cacheKey)||'null'); if(c && Date.now()-c.t<180000) return c.rows||[]; }catch(e){}
    const url=`/api/sheets-proxy?spreadsheetId=${encodeURIComponent(SHEET_ID)}&sheets=Atendimentos&_=${Date.now()}`;
    const res=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});
    const text=await res.text();
    if(text.trim().startsWith('<')) throw new Error('A rota da planilha retornou HTML. Refaça o deploy sem cache.');
    const json=JSON.parse(text);
    if(!json.ok) throw new Error(json.message||'Não consegui ler a planilha.');
    const rows=rowsToObjects(csvParse(json.sheets?.Atendimentos||''));
    localStorage.setItem(cacheKey,JSON.stringify({t:Date.now(),rows}));
    return rows;
  }

  function expectedSlots(date,c){ const dow=dObj(date).getDay(); if(dow===0)return []; const start=dow===6?c.satStart:c.weekStart, end=dow===6?c.satEnd:c.weekEnd; const a=mins(start),b=mins(end),step=Math.max(15,Number(c.interval)||30); if(a==null||b==null||b<=a)return []; const out=[]; for(let x=a;x<b;x+=step)out.push(hm(x)); return out; }
  function parseManualBooked(text){ return String(text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean).map(line=>{ const m=line.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(.+)$/); return m?{Hora:m[1],Cliente:m[2],Servico:'Manual',Profissional:'Manual',Origem:'Manual'}:{Hora:'',Cliente:line,Servico:'Manual',Profissional:'Manual',Origem:'Manual'}; }); }
  function bookingsFor(rows,date){ return rows.filter(r=>parseIsoDate(r['Data'])===date).map(r=>({Hora:String(r['Hora']||'').trim(),Cliente:String(r['Cliente']||'').trim(),Servico:String(r['Serviço']||r['Servico']||'').trim(),Profissional:String(r['Profissional']||'').trim(),Status:String(r['Status']||'').trim(),Origem:'Planilha'})).filter(r=>r.Cliente); }
  function diskoDateUrl(base,date){ try{ const u=new URL(base); u.searchParams.set('date',date); u.searchParams.set('data',date); return u.toString(); }catch(e){ return base; } }
  async function readDisko(c){ const url=`${API}?url=${encodeURIComponent(c.url)}&start=${encodeURIComponent(c.date)}&days=1&_=${Date.now()}`; const res=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}}); const text=await res.text(); if(text.trim().startsWith('<')) throw new Error('A rota retornou HTML, não JSON. Refaça o deploy sem cache.'); const json=JSON.parse(text); if(!json.ok) throw new Error(json.message||'Disko retornou erro.'); return json; }

  function css(){ if($('#v45css'))return; const s=document.createElement('style'); s.id='v45css'; s.textContent=`.v45grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.v45card{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.055);padding:16px}.v45card span{display:block;color:var(--muted);font-size:.82rem}.v45card strong{display:block;font-size:1.35rem;margin-top:6px}.v45filters{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:12px 0}.v45filters label{min-width:150px}.v45two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.v45table{width:100%;border-collapse:collapse}.v45table th,.v45table td{border-bottom:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.v45table th{color:var(--muted);font-size:.78rem;text-transform:uppercase}.v45slots{display:flex;gap:7px;flex-wrap:wrap}.v45slot{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(87,214,137,.13);border:1px solid rgba(87,214,137,.26);color:#c9ffd9;font-weight:850;font-size:.8rem}.v45slot.busy{background:rgba(255,104,104,.13);border-color:rgba(255,104,104,.28);color:#ffd1d1}.v45note{border:1px dashed var(--line);border-radius:18px;padding:14px;color:var(--muted);background:rgba(255,255,255,.035)}.v45frame{width:100%;min-height:520px;border:1px solid var(--line);border-radius:20px;background:white}.v45badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,211,109,.12);border:1px solid rgba(255,211,109,.25);color:#ffe7a8;font-weight:850;font-size:.76rem}@media(max-width:1100px){.v45grid,.v45two{grid-template-columns:1fr}}`; document.head.appendChild(s); }
  function ensure(){ css(); ['agendaVaziaV33','agendaDiaV45'].forEach(id=>{const s=$('#'+id); if(s&&id!==SCREEN)s.classList.remove('active')}); let nav=$(`.nav-link[data-screen="${SCREEN}"]`)||$(`.nav-link[data-screen="agendaVaziaV33"]`)||Array.from($$('.nav-link')).find(b=>/agenda/i.test(b.textContent||'')); if(!nav){nav=document.createElement('button');nav.type='button';nav.className='nav-link';$('.nav')?.appendChild(nav)} nav.dataset.screen=SCREEN; nav.innerHTML='<span>📅</span>Agenda do Dia'; nav.style.display='flex'; let screen=$('#'+SCREEN); if(!screen){screen=document.createElement('section');screen.id=SCREEN;screen.className='screen';screen.innerHTML=`<div id="${BOX}"></div>`;$('.content')?.appendChild(screen)} }
  function openScreen(){ ensure(); $$('.screen').forEach(s=>s.classList.remove('active')); $('#'+SCREEN)?.classList.add('active'); $$('.nav-link[data-screen]').forEach(b=>b.classList.toggle('active',b.dataset.screen===SCREEN)); const t=$('#pageTitle'); if(t)t.textContent='Agenda do Dia'; render(); }
  function controls(c){ return `<div class="v45filters"><label>Dia<input type="date" id="v45Date" value="${esc(c.date)}"></label><label>Link Disko<input id="v45Url" value="${esc(c.url)}"></label><label>Intervalo<input type="number" id="v45Interval" min="15" step="15" value="${esc(c.interval)}"></label><button class="primary-button" id="v45Read">Abrir/ler dia</button><a class="secondary-button" id="v45OpenDisko" href="${esc(diskoDateUrl(c.url,c.date))}" target="_blank" rel="noopener">Abrir Disko</a></div><details class="v45note"><summary>Horários e lançamentos manuais</summary><div class="v45filters"><label>Seg-sex início<input type="time" id="v45WeekStart" value="${esc(c.weekStart)}"></label><label>Seg-sex fim<input type="time" id="v45WeekEnd" value="${esc(c.weekEnd)}"></label><label>Sábado início<input type="time" id="v45SatStart" value="${esc(c.satStart)}"></label><label>Sábado fim<input type="time" id="v45SatEnd" value="${esc(c.satEnd)}"></label></div><label>Horários livres manuais <textarea id="v45FreeManual" rows="3" placeholder="09:00 09:30 10:00">${esc(manualDay(c.date).free)}</textarea></label><label>Clientes marcados manuais <textarea id="v45BookedManual" rows="4" placeholder="09:00 - João Corte\n10:30 - Pedro Barba">${esc(manualDay(c.date).booked)}</textarea></label><button class="secondary-button" id="v45SaveManual">Salvar manual</button></details>`; }
  function render(){ ensure(); const c=cfg(); $('#'+BOX).innerHTML=`<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Agenda operacional</p><h3>Agenda do Dia</h3><p class="muted">Seleciona o dia, abre o Disko, tenta ler horários livres e mostra clientes marcados pela planilha/manual.</p></div></div>${controls(c)}<div id="v45Status" class="import-status warning">Selecione o dia e clique em Abrir/ler dia.</div><div id="v45Result"></div><div class="v45card" style="margin-top:14px"><h4>Agenda Disko</h4><p class="muted">Se o Disko bloquear a visualização dentro do app, use o botão Abrir Disko.</p><iframe class="v45frame" src="${esc(diskoDateUrl(c.url,c.date))}"></iframe></div></article>`; }

  async function loadDay(){
    const c={...cfg(),date:$('#v45Date')?.value||today(),url:$('#v45Url')?.value||DEFAULT_URL,interval:Number($('#v45Interval')?.value||30),weekStart:$('#v45WeekStart')?.value||cfg().weekStart,weekEnd:$('#v45WeekEnd')?.value||cfg().weekEnd,satStart:$('#v45SatStart')?.value||cfg().satStart,satEnd:$('#v45SatEnd')?.value||cfg().satEnd}; setCfg(c); render(); const st=$('#v45Status'); if(st){st.className='import-status warning';st.textContent='Lendo planilha e Disko...';}
    let rows=[],disko=null,diskoErr='';
    try{ rows=await loadAtendimentos(); }catch(e){ diskoErr+=' Planilha: '+(e.message||e); }
    try{ disko=await readDisko(c); }catch(e){ diskoErr+=' Disko: '+(e.message||e); }
    const manual=manualDay(c.date);
    const planBookings=bookingsFor(rows,c.date);
    const manualBookings=parseManualBooked(manual.booked);
    const bookings=[...planBookings,...manualBookings];
    const bookedTimes=uniqTimes(bookings.map(b=>b.Hora).filter(Boolean));
    const expected=expectedSlots(c.date,c);
    const diskoTimes=uniqTimes((disko?.days?.[0]?.availableTimes?.length?disko.days[0].availableTimes:disko?.days?.[0]?.times)||[]);
    const manualFree=uniqTimes(String(manual.free||'').split(/[\s,;]+/));
    const freeSource=diskoTimes.length?'Disko':manualFree.length?'Manual':'Estimado';
    const free=(diskoTimes.length?diskoTimes:manualFree.length?manualFree:expected.filter(t=>!bookedTimes.includes(t)));
    const totalPotential=free.length*45;
    const result=`<div class="v45grid"><div class="v45card"><span>Dia selecionado</span><strong>${br(c.date)}</strong></div><div class="v45card"><span>Clientes marcados</span><strong>${bookings.length}</strong></div><div class="v45card"><span>Horários livres</span><strong>${free.length}</strong></div><div class="v45card"><span>Potencial se preencher</span><strong>${totalPotential.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div></div><div class="v45two" style="margin-top:14px"><div class="v45card"><h4>Horários livres (${freeSource})</h4><div class="v45slots">${free.map(t=>`<span class="v45slot">${esc(t)}</span>`).join('')||'<span class="muted">Nenhum horário livre lido. Lance manualmente ou confira no Disko.</span>'}</div></div><div class="v45card"><h4>Horários ocupados</h4><div class="v45slots">${bookedTimes.map(t=>`<span class="v45slot busy">${esc(t)}</span>`).join('')||'<span class="muted">Nenhum horário ocupado encontrado na planilha/manual.</span>'}</div></div></div><div class="v45card" style="margin-top:14px"><h4>Clientes marcados no dia</h4><table class="v45table"><thead><tr><th>Hora</th><th>Cliente</th><th>Serviço</th><th>Profissional</th><th>Origem</th></tr></thead><tbody>${bookings.map(b=>`<tr><td>${esc(b.Hora||'-')}</td><td>${esc(b.Cliente)}</td><td>${esc(b.Servico||'-')}</td><td>${esc(b.Profissional||'-')}</td><td><span class="v45badge">${esc(b.Origem)}</span></td></tr>`).join('')||'<tr><td colspan="5">Nenhum cliente encontrado para este dia.</td></tr>'}</tbody></table></div><div class="v45note" style="margin-top:14px">Observação: se o Disko não expõe nomes de clientes no link público, o app só consegue mostrar clientes vindos da planilha ou lançados manualmente. ${esc(diskoErr)}</div>`;
    $('#v45Result').innerHTML=result;
    if(st){st.className=diskoTimes.length||bookings.length?'import-status success':'import-status warning';st.textContent=diskoTimes.length?`Disko lido: ${diskoTimes.length} horários livres encontrados.`:'Disko não expôs horários livres; use a leitura visual/lançamento manual.';}
  }

  document.addEventListener('click',e=>{ const nav=e.target.closest(`.nav-link[data-screen="${SCREEN}"]`); if(nav){e.preventDefault();e.stopPropagation();openScreen();return;} if(e.target.closest('#v45Read')){e.preventDefault();loadDay();return;} if(e.target.closest('#v45SaveManual')){e.preventDefault(); const c={...cfg(),date:$('#v45Date')?.value||today(),url:$('#v45Url')?.value||DEFAULT_URL,interval:Number($('#v45Interval')?.value||30),weekStart:$('#v45WeekStart')?.value||cfg().weekStart,weekEnd:$('#v45WeekEnd')?.value||cfg().weekEnd,satStart:$('#v45SatStart')?.value||cfg().satStart,satEnd:$('#v45SatEnd')?.value||cfg().satEnd}; setCfg(c); saveManualDay(c.date,{free:$('#v45FreeManual')?.value||'',booked:$('#v45BookedManual')?.value||''}); loadDay();} },true);
  document.addEventListener('change',e=>{ if(e.target && e.target.id==='v45Date'){ setCfg({date:e.target.value}); loadDay(); } },true);
  window.openAgendaDiaV45=openScreen;
  window.loadAgendaDiaV45=loadDay;
  setTimeout(()=>{ensure();},1000);
})();