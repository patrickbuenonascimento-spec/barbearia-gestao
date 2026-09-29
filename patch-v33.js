/* v33 - Recuperar Clientes e Agenda Vazia no menu lateral */
(function(){
  if (window.__gestaoV33) return; window.__gestaoV33 = true;

  const SHEET_ID = '1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc';
  const STORE = 'gestao_barber_sheet_v33';
  const CFG = 'gestao_barber_agenda_cfg_v33';
  const RC = 'recuperarClientesV33';
  const AV = 'agendaVaziaV33';
  const DISKO_DEFAULT = 'https://taisemourabarber.disko.com.br/marcacao';
  const SHEETS = ['Atendimentos','Vendas Produtos','Contas','Extrato','Conciliacao','Estoque','Mov Estoque','Equipe','Folha e Prolabore','Pacotes e Permutas'];

  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const brl = n => Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const todayIso = () => new Date().toISOString().slice(0,10);
  const dObj = d => new Date(`${dateIso(d)||todayIso()}T12:00:00`);
  const days = d => Math.max(0, Math.floor((dObj(todayIso()) - dObj(d))/86400000));
  const week = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  function dateIso(v){
    if(!v) return '';
    const s=String(v).trim();
    let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if(m){let y=m[3].length===2?'20'+m[3]:m[3]; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
    m=s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/); if(m){let y=m[3].length===2?'20'+m[3]:m[3]; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
    m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    return '';
  }
  function val(v){
    if(v==null) return 0; let s=String(v).trim(); if(!s || s==='-' || s==='–') return 0;
    const neg = /^\(.*\)$/.test(s) || s.includes('-');
    s=s.replace(/[()]/g,'').replace(/R\$/gi,'').replace(/%/g,'').replace(/\s/g,'');
    if(s.includes(',') && s.includes('.')) s=s.replace(/\./g,'').replace(',','.'); else if(s.includes(',')) s=s.replace(',','.');
    let n=Number(s.replace(/[^0-9.]/g,'')); if(!isFinite(n)) n=0; return neg ? -Math.abs(n) : n;
  }
  function csvParse(text){
    const rows=[]; let row=[], cur='', q=false;
    for(let i=0;i<String(text||'').length;i++){
      const ch=text[i], nx=text[i+1];
      if(ch==='"'){ if(q && nx==='"'){cur+='"'; i++;} else q=!q; }
      else if(ch===',' && !q){ row.push(cur); cur=''; }
      else if((ch==='\n'||ch==='\r') && !q){ if(ch==='\r'&&nx==='\n') i++; row.push(cur); rows.push(row); row=[]; cur=''; }
      else cur+=ch;
    }
    row.push(cur); rows.push(row);
    return rows.map(r=>r.map(x=>String(x||'').trim()));
  }
  function rowsToObjects(rows){
    const idx = rows.findIndex(r => r.some(c=>norm(c)==='data') && r.some(c=>norm(c).includes('cliente')));
    if(idx<0) return [];
    const h = rows[idx].map(c=>String(c||'').trim());
    return rows.slice(idx+1).map(r=>{
      const o={}; h.forEach((k,i)=>{ if(k) o[k]=r[i] ?? ''; }); return o;
    }).filter(o => Object.values(o).some(x => String(x||'').trim() && String(x).trim()!=='-'));
  }
  function loadLocal(){
    try{return JSON.parse(localStorage.getItem(STORE)||localStorage.getItem('gestao_barber_sheet_v32')||'{}')}catch(e){return {}}
  }
  function saveLocal(data){ localStorage.setItem(STORE, JSON.stringify(data||{})); }
  function data(){ return loadLocal(); }
  function arr(name){ const d=data(); return Array.isArray(d[name]) ? d[name] : []; }
  function atds(){ return arr('Atendimentos').filter(r=>dateIso(r['Data']) && r['Cliente']); }
  function positiveMoneyRows(){ return atds().filter(r=>val(r['Venda líquida'])>0); }
  function cfg(){ try{return {diskoUrl:DISKO_DEFAULT, start:'', end:'', goal:5, gift:'sobrancelha, pezinho ou hidratação simples', ...JSON.parse(localStorage.getItem(CFG)||'{}')}}catch(e){return {diskoUrl:DISKO_DEFAULT, start:'', end:'', goal:5, gift:'sobrancelha, pezinho ou hidratação simples'}} }
  function setCfg(p){ localStorage.setItem(CFG, JSON.stringify({...cfg(), ...p})); }
  function filtered(rows){ const c=cfg(); return rows.filter(r=>{const d=dateIso(r['Data']||r['Data prevista']||r['Vencimento']||r['Data pagamento']); return (!c.start||d>=c.start) && (!c.end||d<=c.end);}); }
  function minMaxDates(){ const ds=atds().map(r=>dateIso(r['Data'])).filter(Boolean).sort(); return {min:ds[0]||todayIso(), max:ds[ds.length-1]||todayIso()}; }
  function clientMap(){
    const m=new Map();
    atds().forEach(r=>{ const name=String(r['Cliente']||'').trim(); const k=norm(name); if(!k) return;
      const it=m.get(k)||{name,count:0,paidCount:0,total:0,last:'',svc:{}};
      it.count++; const sale=val(r['Venda líquida']); if(sale>0){it.paidCount++; it.total+=sale;}
      const d=dateIso(r['Data']); if(d && (!it.last || d>it.last)) it.last=d;
      const s=String(r['Serviço']||'Serviço').trim(); it.svc[s]=(it.svc[s]||0)+1; m.set(k,it);
    });
    return [...m.values()].map(c=>({...c, fav:Object.entries(c.svc).sort((a,b)=>b[1]-a[1])[0]?.[0]||'Cabelo', ticket:c.paidCount?c.total/c.paidCount:0}));
  }
  function grouped(rows,key,valfn){ const m=new Map(); rows.forEach(r=>{const k=key(r)||'Sem informação'; m.set(k,(m.get(k)||0)+(valfn?valfn(r):1));}); return [...m.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value); }
  function bar(data,money=false){ const max=Math.max(1,...data.map(x=>Math.abs(x.value||0))); return `<div class="v33bars">${data.map(x=>`<div class="v33bar"><span>${esc(x.label)}</span><i><b style="width:${Math.max(2,Math.abs(x.value||0)/max*100)}%"></b></i><strong>${money?brl(x.value):Math.round(x.value||0)}</strong></div>`).join('')}</div>`; }
  function empty(msg){ return `<div class="v33empty">${esc(msg)}</div>`; }
  function status(msg,kind='warn'){ const c=kind==='ok'?'success':kind==='err'?'error':'warning'; return `<div class="import-status ${c}">${esc(msg)}</div>`; }

  async function syncSheets(){
    const box=$('#v33Status'); if(box){box.className='import-status warning';box.textContent='Lendo planilha...';}
    const url=`/.netlify/functions/sheets-proxy?spreadsheetId=${encodeURIComponent(SHEET_ID)}&sheets=${encodeURIComponent(SHEETS.join(','))}`;
    const j=await fetch(url,{cache:'no-store'}).then(r=>r.json());
    if(!j.ok) throw new Error(j.message||'Não consegui ler a planilha.');
    const out={}; Object.entries(j.sheets||{}).forEach(([name,csv])=>out[name]=rowsToObjects(csvParse(csv)));
    saveLocal(out);
    if(box){box.className='import-status success';box.textContent=`Planilha lida: ${out.Atendimentos?.length||0} atendimentos carregados.`;}
    renderAllV33();
  }

  function css(){ if($('#v33css')) return; const s=document.createElement('style'); s.id='v33css'; s.textContent=`.v33grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.v33card{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.055);padding:16px}.v33card span{display:block;color:var(--muted);font-size:.82rem}.v33card strong{display:block;font-size:1.45rem;margin-top:6px}.v33two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.v33filters{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:12px 0}.v33filters label{min-width:150px}.v33bars{display:grid;gap:11px}.v33bar{display:grid;grid-template-columns:130px 1fr 92px;gap:10px;align-items:center}.v33bar span{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v33bar i{height:14px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid var(--line);overflow:hidden}.v33bar b{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--gold),var(--orange))}.v33bar strong{text-align:right;font-size:.85rem}.v33table{width:100%;border-collapse:collapse}.v33table th,.v33table td{border-bottom:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.v33table th{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.v33empty{border:1px dashed var(--line);border-radius:18px;padding:20px;color:var(--muted);text-align:center}.v33badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,211,109,.12);border:1px solid rgba(255,211,109,.25);color:#ffe7a8;font-weight:850;font-size:.76rem}.v33badge.bad{background:rgba(255,104,104,.12);border-color:rgba(255,104,104,.25);color:#ffd1d1}.v33badge.ok{background:rgba(87,214,137,.12);border-color:rgba(87,214,137,.25);color:#c9ffd9}@media(max-width:1100px){.v33grid,.v33two{grid-template-columns:1fr}.v33bar{grid-template-columns:95px 1fr 70px}}`; document.head.appendChild(s); }
  function show(id){ $$('.screen').forEach(x=>x.classList.remove('active')); const s=$('#'+id); if(s) s.classList.add('active'); $$('.nav-link[data-screen]').forEach(b=>b.classList.toggle('active', b.dataset.screen===id)); const title=$('#pageTitle'); if(title) title.textContent=id===RC?'Recuperar Clientes':'Agenda Vazia'; if(id===RC) renderRC(); else renderAV(); }
  function addNav(id,label,icon){ let b=$(`.nav-link[data-screen="${id}"]`); if(!b){ b=document.createElement('button'); b.type='button'; b.className='nav-link'; b.dataset.screen=id; b.innerHTML=`<span>${icon}</span>${label}`; $('.nav')?.appendChild(b);} b.style.display='flex'; b.classList.remove('v27-hidden'); }
  function ensure(){ css(); addNav(RC,'Recuperar Clientes','🎯'); addNav(AV,'Agenda Vazia','📅'); if(!$('#'+RC)){const s=document.createElement('section'); s.id=RC; s.className='screen'; s.innerHTML='<div id="rcV33"></div>'; $('.content')?.appendChild(s);} if(!$('#'+AV)){const s=document.createElement('section'); s.id=AV; s.className='screen'; s.innerHTML='<div id="avV33"></div>'; $('.content')?.appendChild(s);} }
  function controls(){ const c=cfg(); return `<div id="v33Status">${status(`Dados locais: ${atds().length} atendimentos carregados.`,'ok')}</div><div class="v33filters"><label>Data inicial<input type="date" id="v33Start" value="${esc(c.start)}"></label><label>Data final<input type="date" id="v33End" value="${esc(c.end)}"></label><label>Meta mínima/dia<input type="number" id="v33Goal" value="${esc(c.goal)}" min="1"></label><button type="button" class="primary-button" id="v33Sync">Ler planilha agora</button><button type="button" class="secondary-button" id="v33Apply">Aplicar período</button><button type="button" class="secondary-button" id="v33Clear">Limpar filtro</button></div>`; }
  function renderRC(){ ensure(); const rows=atds(); const clients=clientMap(); const inactive=clients.filter(c=>days(c.last)>=30).sort((a,b)=>days(b.last)-days(a.last)); const financial=positiveMoneyRows(); const total=financial.reduce((s,r)=>s+val(r['Venda líquida']),0); const avg=financial.length?total/financial.length:0; const c=cfg(); $('#rcV33').innerHTML=`<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">CRM da barbearia</p><h3>Recuperar Clientes</h3><p class="muted">Fora da Gestão. Usa a aba Atendimentos para achar clientes que pararam de voltar e gerar ações de retorno.</p></div></div>${controls()}<div class="v33grid"><div class="v33card"><span>Clientes únicos</span><strong>${clients.length}</strong></div><div class="v33card"><span>Clientes há 30+ dias</span><strong>${inactive.length}</strong></div><div class="v33card"><span>Ticket médio financeiro</span><strong>${brl(avg)}</strong></div><div class="v33card"><span>Potencial 20 clientes</span><strong>${brl(inactive.slice(0,20).reduce((s,x)=>s+(x.ticket||avg||45),0))}</strong></div></div><div class="v33two" style="margin-top:14px"><div class="v33card"><h4>Serviços mais comuns</h4>${bar(grouped(rows,r=>r['Serviço'],()=>1).slice(0,7))}</div><div class="v33card"><h4>Forma de pagamento</h4>${bar(grouped(rows,r=>r['Pagamento']||'Não informado',r=>val(r['Venda líquida'])).slice(0,7),true)}</div></div><div class="v33card" style="margin-top:14px"><h4>Lista de reativação</h4>${inactive.length?`<table class="v33table"><thead><tr><th>Cliente</th><th>Última visita</th><th>Dias</th><th>Serviço provável</th><th>Mensagem</th></tr></thead><tbody>${inactive.slice(0,60).map(x=>`<tr><td><strong>${esc(x.name)}</strong><br><small>${x.count} atendimento(s)</small></td><td>${esc(x.last.split('-').reverse().join('/'))}</td><td><span class="v33badge ${days(x.last)>=60?'bad':''}">${days(x.last)}</span></td><td>${esc(x.fav)}</td><td><button class="secondary-button small-button" data-v33copy="Oi, ${esc(x.name)}! Tudo bem? Aqui é da Barbearia da Taíse. Vi que faz um tempinho desde seu último atendimento de ${esc(x.fav)}. Nesta semana temos horários com brinde especial: ${esc(c.gift)}. Quer que eu reserve um horário para você?">Copiar</button></td></tr>`).join('')}</tbody></table>`:empty('Nenhum cliente com 30 dias ou mais sem voltar na base carregada.')}</div></article>`; }
  function dateRange(){ const c=cfg(), mm=minMaxDates(); const a=c.start||mm.min, b=c.end||mm.max; const dates=[]; for(let d=dObj(a); d<=dObj(b); d.setDate(d.getDate()+1)) dates.push(d.toISOString().slice(0,10)); return dates; }
  function slotsFor(date){ const w=dObj(date).getDay(); if(w===0) return []; const start=w===6?'09:00':'14:30', end=w===6?'17:00':'20:00'; const out=[]; let [h,m]=start.split(':').map(Number), [eh,em]=end.split(':').map(Number); while(h*60+m < eh*60+em){ out.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`); m+=30; if(m>=60){h++;m-=60;} } return out; }
  function renderAV(){ ensure(); const c=cfg(); const rows=filtered(atds()); const dates=dateRange(); const byDate=new Map(); rows.forEach(r=>{const d=dateIso(r['Data']); if(!d)return; const it=byDate.get(d)||{date:d,count:0,total:0,times:new Set()}; it.count++; it.total+=val(r['Venda líquida']); if(r['Hora']) it.times.add(String(r['Hora']).slice(0,5)); byDate.set(d,it);}); const dayRows=dates.map(d=>{const it=byDate.get(d)||{date:d,count:0,total:0,times:new Set()}; const slots=slotsFor(d); const emptySlots=slots.filter(t=>!it.times.has(t)); return {...it, slots, emptySlots, weekday:week[dObj(d).getDay()]};}); const weak=dayRows.filter(d=>d.slots.length && d.count<Number(c.goal||5)).sort((a,b)=>a.count-b.count||a.date.localeCompare(b.date)); $('#avV33').innerHTML=`<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Oportunidade comercial</p><h3>Análise da Agenda Vazia</h3><p class="muted">Fora da Gestão. Compara horários de funcionamento com atendimentos da planilha para indicar dias fracos, horários vagos e promoções.</p></div></div>${controls()}<div class="v33filters"><label class="span-2">Link público Disko<input id="v33Disko" value="${esc(c.diskoUrl)}"></label><label>Brinde sugerido<input id="v33Gift" value="${esc(c.gift)}"></label><button type="button" class="secondary-button" id="v33DiskoTest">Testar Disko</button></div><div id="v33DiskoStatus">${status('A análise abaixo usa a planilha. O teste Disko serve como apoio para verificar a agenda pública.','warn')}</div><div class="v33grid"><div class="v33card"><span>Dias analisados</span><strong>${dayRows.length}</strong></div><div class="v33card"><span>Dias fracos</span><strong>${weak.length}</strong></div><div class="v33card"><span>Horários vazios estimados</span><strong>${dayRows.reduce((s,d)=>s+d.emptySlots.length,0)}</strong></div><div class="v33card"><span>Faturamento no período</span><strong>${brl(rows.reduce((s,r)=>s+val(r['Venda líquida']),0))}</strong></div></div><div class="v33two" style="margin-top:14px"><div class="v33card"><h4>Atendimentos por dia</h4>${bar(dayRows.map(d=>({label:`${d.date.slice(8,10)}/${d.date.slice(5,7)} ${d.weekday.slice(0,3)}`,value:d.count})).slice(-20))}</div><div class="v33card"><h4>Dias da semana mais fracos</h4>${bar(grouped(rows,r=>week[dObj(dateIso(r['Data'])).getDay()],()=>1).sort((a,b)=>a.value-b.value).slice(0,7))}</div></div><div class="v33card" style="margin-top:14px"><h4>Ações sugeridas</h4>${weak.length?`<table class="v33table"><thead><tr><th>Data</th><th>Dia</th><th>Atend.</th><th>Horários vazios</th><th>Ação</th></tr></thead><tbody>${weak.slice(0,30).map(d=>`<tr><td>${d.date.split('-').reverse().join('/')}</td><td>${d.weekday}</td><td><span class="v33badge bad">${d.count}</span></td><td>${esc(d.emptySlots.slice(0,10).join(', '))}${d.emptySlots.length>10?'...':''}</td><td>Chamar clientes inativos e oferecer ${esc(c.gift)} para preencher horários vagos.</td></tr>`).join('')}</tbody></table>`:empty('Nenhum dia abaixo da meta no período selecionado.')}</div></article>`; }
  function renderAllV33(){ if($('#'+RC+'.active')) renderRC(); if($('#'+AV+'.active')) renderAV(); }
  document.addEventListener('click', async e=>{
    const nav=e.target.closest(`.nav-link[data-screen="${RC}"],.nav-link[data-screen="${AV}"]`); if(nav){e.preventDefault();e.stopImmediatePropagation();show(nav.dataset.screen);return;}
    if(e.target.closest('#v33Sync')){e.preventDefault();try{await syncSheets();}catch(err){const b=$('#v33Status'); if(b){b.className='import-status error';b.textContent=err.message||String(err);}}}
    if(e.target.closest('#v33Apply')){setCfg({start:$('#v33Start')?.value||'',end:$('#v33End')?.value||'',goal:Number($('#v33Goal')?.value||5),diskoUrl:$('#v33Disko')?.value||cfg().diskoUrl,gift:$('#v33Gift')?.value||cfg().gift});renderAllV33();}
    if(e.target.closest('#v33Clear')){setCfg({start:'',end:''});renderAllV33();}
    const cp=e.target.closest('[data-v33copy]'); if(cp){navigator.clipboard?.writeText(cp.dataset.v33copy||''); try{showToast('Mensagem copiada.')}catch(_){}}
    if(e.target.closest('#v33DiskoTest')){setCfg({diskoUrl:$('#v33Disko')?.value||DISKO_DEFAULT,gift:$('#v33Gift')?.value||cfg().gift});const box=$('#v33DiskoStatus'); if(box){box.innerHTML=status('Testando agenda Disko...','warn');} try{const j=await fetch(`/.netlify/functions/disko-proxy?url=${encodeURIComponent(cfg().diskoUrl)}`,{cache:'no-store'}).then(r=>r.json()); if(box) box.innerHTML=status(j.ok?`Disko respondeu. Horários encontrados na página: ${j.times?.length||0}.`:(j.message||'Não consegui ler o Disko.'), j.ok?'ok':'err');}catch(err){if(box) box.innerHTML=status(err.message||String(err),'err');}}
  }, true);
  setTimeout(()=>{ensure(); if(!atds().length) syncSheets().catch(()=>{});}, 900);
})();
