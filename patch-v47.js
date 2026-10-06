/* v47 - Recuperador 2.0 com controle de agenda por dias */
(function(){
  if (window.__recuperadorClientesV47) return;
  window.__recuperadorClientesV47 = true;

  window.__gestaoV33 = true;
  window.__agendaDiskoV39 = true;
  window.__agendaDiskoV40 = true;
  window.__agendaDiskoV41 = true;
  window.__agendaDiskoV42 = true;
  window.__agendaVaziaForceV43 = true;
  window.__barberDataHubV44 = true;
  window.__agendaDiaV45 = true;
  window.__recuperadorClientesV46 = true;

  const SHEET_ID = '1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc';
  const SCREEN = 'recuperadorClientesV47';
  const BOX = 'recuperadorClientesBoxV47';
  const CACHE = 'recuperador_v47_atendimentos';
  const CFG = 'recuperador_v47_cfg';
  const STATUS = 'recuperador_v47_status';
  const WEEK = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const brl = n => Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  function todayIso(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function addDays(iso,n){ const m=String(iso||todayIso()).match(/^(\d{4})-(\d{2})-(\d{2})/); const d=m?new Date(+m[1],+m[2]-1,+m[3]+n,12):new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function dayObj(iso){ const m=String(iso||todayIso()).match(/^(\d{4})-(\d{2})-(\d{2})/); return m?new Date(+m[1],+m[2]-1,+m[3],12):new Date(); }
  function brDate(iso){ const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m?`${m[3]}/${m[2]}/${m[1]}`:String(iso||''); }
  function daysSince(iso){ return Math.max(0, Math.floor((dayObj(todayIso()) - dayObj(iso)) / 86400000)); }

  function dateIso(v){
    if(!v) return '';
    const s=String(v).trim();
    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if(m){
      let a=Number(m[1]), b=Number(m[2]), y=m[3].length===2?'20'+m[3]:m[3];
      let d, mo;
      if(b > 12){ mo=a; d=b; }
      else if(a > 12){ d=a; mo=b; }
      else { mo=a; d=b; }
      return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
    return '';
  }

  function money(v){
    if(v==null || v==='' || v==='-' || v==='–') return 0;
    if(typeof v==='number') return Number.isFinite(v)?v:0;
    let s=String(v).trim(); const neg=/^\(.*\)$/.test(s)||/^-/.test(s);
    s=s.replace(/[()]/g,'').replace(/R\$/gi,'').replace(/%/g,'').replace(/\s/g,'');
    if(s.includes(',') && s.includes('.')) s=s.replace(/\./g,'').replace(',','.');
    else if(s.includes(',')) s=s.replace(',','.');
    const n=Number(s.replace(/[^0-9.]/g,'')); return Number.isFinite(n)?(neg?-Math.abs(n):n):0;
  }

  function csvParse(text){
    const rows=[]; let row=[], cur='', q=false; text=String(text||'');
    for(let i=0;i<text.length;i++){
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
    const idx=rows.findIndex(r=>{ const ns=r.map(norm); return ns.some(x=>x==='data'||x.endsWith(' data')) && ns.some(x=>x.includes('cliente')) && ns.some(x=>x.includes('servico')); });
    if(idx<0) return [];
    const h=rows[idx].map(x=>String(x||'').trim());
    return rows.slice(idx+1).map(r=>{ const o={}; h.forEach((k,i)=>{ if(k) o[k]=r[i]??''; }); return o; }).filter(o=>Object.values(o).some(x=>String(x||'').trim() && String(x).trim()!=='-'));
  }

  function getField(o,names){
    for(const n of names){
      if(o[n]!=null && String(o[n]).trim()!=='') return o[n];
      const key=Object.keys(o).find(k=>norm(k)===norm(n));
      if(key && String(o[key]).trim()!=='') return o[key];
    }
    return '';
  }

  function loadJSON(k,f){ try{return JSON.parse(localStorage.getItem(k)||'') || f;}catch(e){return f;} }
  function saveJSON(k,d){ localStorage.setItem(k, JSON.stringify(d)); }
  function cfg(){ return {minDays:30, professional:'Todos', status:'Todos', minTicket:0, search:'', agendaStart:todayIso(), agendaEnd:addDays(todayIso(),7), selectedDay:todayIso(), dailyGoal:8, ...loadJSON(CFG,{})}; }
  function setCfg(p){ saveJSON(CFG,{...cfg(),...p}); }
  function statuses(){ return loadJSON(STATUS,{}); }
  function setStatus(key,status){ const s=statuses(); s[key]={status, updatedAt:new Date().toISOString()}; saveJSON(STATUS,s); render(); }
  function rows(){ return loadJSON(CACHE,[]); }

  function rowData(r){
    const service=String(getField(r,['Serviço','Servico'])).trim() || 'Serviço';
    return {
      date: dateIso(getField(r,['Data'])),
      hour: String(getField(r,['Hora'])).trim(),
      client: String(getField(r,['Cliente'])).trim(),
      service,
      prof: String(getField(r,['Profissional'])).trim() || 'Sem profissional',
      status: String(getField(r,['Status'])).trim(),
      payment: String(getField(r,['Pagamento'])).trim(),
      sale: money(getField(r,['Venda líquida','Venda liquida','Líquido previsto','Liquido previsto','Valor tabela']))
    };
  }

  function buildClients(){
    const map=new Map();
    rows().forEach(r=>{
      const d=rowData(r); if(!d.date || !d.client) return;
      const k=norm(d.client); if(!k) return;
      const it=map.get(k)||{key:k,name:d.client,count:0,paidCount:0,total:0,last:'',lastProfessional:'',lastService:'',svc:{},prof:{}};
      it.count++;
      if(d.sale>0){ it.paidCount++; it.total+=d.sale; }
      if(!it.last || d.date>it.last){ it.last=d.date; it.lastProfessional=d.prof; it.lastService=d.service; }
      it.svc[d.service]=(it.svc[d.service]||0)+1;
      it.prof[d.prof]=(it.prof[d.prof]||0)+1;
      map.set(k,it);
    });
    const st=statuses();
    return [...map.values()].map(c=>{
      const favService=Object.entries(c.svc).sort((a,b)=>b[1]-a[1])[0]?.[0]||'Cabelo';
      const mainProfessional=Object.entries(c.prof).sort((a,b)=>b[1]-a[1])[0]?.[0]||c.lastProfessional||'Sem profissional';
      const ticket=c.paidCount?c.total/c.paidCount:0;
      return {...c, favService, mainProfessional, ticket, days:daysSince(c.last), contactStatus:st[c.key]?.status||'Pendente'};
    });
  }

  function filteredClients(){
    const c=cfg(); const q=norm(c.search);
    return buildClients().filter(x=>{
      if(x.days < Number(c.minDays||30)) return false;
      if(c.professional!=='Todos' && norm(x.mainProfessional)!==norm(c.professional) && norm(x.lastProfessional)!==norm(c.professional)) return false;
      if(c.status!=='Todos' && x.contactStatus!==c.status) return false;
      if(Number(c.minTicket||0)>0 && x.ticket<Number(c.minTicket||0)) return false;
      if(q && !norm(`${x.name} ${x.favService} ${x.mainProfessional}`).includes(q)) return false;
      return true;
    }).sort((a,b)=>(b.ticket*b.days)-(a.ticket*a.days));
  }

  function messageFor(c, targetDay){
    const first=c.name.split(' ')[0]||c.name;
    const dayText=targetDay?` no dia ${brDate(targetDay)}`:' essa semana';
    if(norm(c.favService).includes('barba')) return `Oi, ${first}! Tudo bem? Vi que já faz ${c.days} dias desde seu último atendimento. Tenho alguns horários${dayText} com a Emily. Quer que eu veja um bom pra você?`;
    return `Oi, ${first}! Tudo bem? Vi aqui que já faz ${c.days} dias desde seu último corte. Tenho alguns horários${dayText} com a Emily. Quer que eu veja um horário bom pra você?`;
  }
  function waLink(msg){ return `https://wa.me/?text=${encodeURIComponent(msg)}`; }

  function daysBetween(start,end){
    const out=[]; let cur=start || todayIso(); let limit=0;
    while(cur<=end && limit<62){ out.push(cur); cur=addDays(cur,1); limit++; }
    return out;
  }

  function agendaDays(){
    const c=cfg(); const list=daysBetween(c.agendaStart,c.agendaEnd);
    const all=rows().map(rowData).filter(x=>x.date && x.client);
    return list.map(date=>{
      const items=all.filter(x=>x.date===date).sort((a,b)=>(a.hour||'99:99').localeCompare(b.hour||'99:99'));
      const revenue=items.reduce((s,x)=>s+x.sale,0);
      const byProf={}; items.forEach(x=>byProf[x.prof]=(byProf[x.prof]||0)+1);
      const count=items.length; const goal=Number(c.dailyGoal||8);
      const status=count===0?'Vazio':count<Math.ceil(goal*.5)?'Fraco':count<goal?'Médio':'Bom';
      return {date, items, count, revenue, byProf, status};
    });
  }

  async function safeJson(response){
    const text=await response.text(); const t=text.trim();
    if(!t) throw new Error('Resposta vazia da planilha.');
    if(t.startsWith('<')) throw new Error('A rota da planilha retornou HTML. Faça deploy sem cache e confirme /api/sheets-proxy.');
    try{return JSON.parse(t);}catch(e){throw new Error('Resposta da planilha não é JSON válido.');}
  }

  async function sync(){
    const box=$('#v47Status'); if(box){box.className='import-status warning'; box.textContent='Lendo Atendimentos da planilha...';}
    const qs=`spreadsheetId=${encodeURIComponent(SHEET_ID)}&sheets=${encodeURIComponent('Atendimentos')}`;
    let json;
    try{ json=await fetch(`/api/sheets-proxy?${qs}`,{cache:'no-store',headers:{Accept:'application/json'}}).then(safeJson); }
    catch(e){ json=await fetch(`/.netlify/functions/sheets-proxy?${qs}`,{cache:'no-store',headers:{Accept:'application/json'}}).then(safeJson); }
    if(!json.ok) throw new Error(json.message || 'Não consegui ler a planilha.');
    const csv=json.sheets?.Atendimentos || json.sheets?.['Atendimentos'];
    const obj=rowsToObjects(csvParse(csv));
    saveJSON(CACHE,obj);
    const ok=$('#v47Status'); if(ok){ok.className='import-status success'; ok.textContent=`Atendimentos carregados: ${obj.length}. Agenda e recuperador atualizados.`;}
    render();
  }

  function hideOld(){
    const old=['recuperarClientesV33','recuperadorClientesV46','agendaVaziaV33','agendaVaziaDiskoV41','agendaVaziaDiskoV42','agendaDiaV45'];
    old.forEach(id=>{const el=$('#'+id); if(el){el.classList.remove('active'); el.style.display='none';}});
    $$('.nav-link[data-screen]').forEach(b=>{const s=b.dataset.screen||''; const t=norm(b.textContent||''); if(old.includes(s)||t.includes('agenda vazia')||t.includes('agenda do dia')||(t.includes('recuperador')&&s!==SCREEN)) b.remove();});
  }

  function css(){
    if($('#v47css')) return;
    const s=document.createElement('style'); s.id='v47css'; s.textContent=`
      .v47grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.v47two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.v47card{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.055);padding:16px}.v47card span{display:block;color:var(--muted);font-size:.82rem}.v47card strong{display:block;font-size:1.45rem;margin-top:6px}.v47filters{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:12px 0}.v47filters label{min-width:145px}.v47table{width:100%;border-collapse:collapse}.v47table th,.v47table td{border-bottom:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.v47table th{color:var(--muted);font-size:.76rem;text-transform:uppercase;letter-spacing:.06em}.v47badge{display:inline-flex;padding:5px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);font-weight:850;font-size:.75rem}.v47badge.bad{background:rgba(255,104,104,.12);border-color:rgba(255,104,104,.25);color:#ffd1d1}.v47badge.warn{background:rgba(255,211,109,.12);border-color:rgba(255,211,109,.25);color:#ffe7a8}.v47badge.ok{background:rgba(87,214,137,.12);border-color:rgba(87,214,137,.25);color:#c9ffd9}.v47days{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}.v47day{border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.04);padding:12px;text-align:left;cursor:pointer}.v47day.active{outline:2px solid var(--gold);background:rgba(255,211,109,.08)}.v47day b{display:block;font-size:1rem}.v47day small{display:block;color:var(--muted);margin-top:4px}.v47actions{display:flex;gap:6px;flex-wrap:wrap}.v47note{border:1px dashed var(--line);border-radius:18px;padding:14px;color:var(--muted);background:rgba(255,255,255,.035)}@media(max-width:1100px){.v47grid,.v47two{grid-template-columns:1fr}.v47table{font-size:.86rem}}`;
    document.head.appendChild(s);
  }

  function ensure(){
    css(); hideOld();
    let nav=$(`.nav-link[data-screen="${SCREEN}"]`);
    if(!nav){ nav=document.createElement('button'); nav.type='button'; nav.className='nav-link'; nav.dataset.screen=SCREEN; nav.innerHTML='<span>🎯</span>Recuperador 2.0'; $('.nav')?.appendChild(nav); }
    nav.style.display='flex'; nav.classList.remove('v27-hidden');
    let screen=$('#'+SCREEN);
    if(!screen){ screen=document.createElement('section'); screen.id=SCREEN; screen.className='screen'; screen.innerHTML=`<div id="${BOX}"></div>`; $('.content')?.appendChild(screen); }
  }

  function openScreen(){
    ensure(); $$('.screen').forEach(x=>x.classList.remove('active')); $('#'+SCREEN)?.classList.add('active');
    $$('.nav-link[data-screen]').forEach(b=>b.classList.toggle('active', b.dataset.screen===SCREEN));
    const title=$('#pageTitle'); if(title) title.textContent='Recuperador 2.0';
    render();
  }

  function renderAgenda(){
    const c=cfg(); const days=agendaDays(); const selected=days.find(d=>d.date===c.selectedDay) || days[0];
    const total=days.reduce((s,d)=>s+d.count,0), revenue=days.reduce((s,d)=>s+d.revenue,0), weak=days.filter(d=>d.status==='Vazio'||d.status==='Fraco').length;
    const dayCards=days.map(d=>{const cls=d.date===c.selectedDay?' active':''; const badge=d.status==='Bom'?'ok':d.status==='Médio'?'warn':'bad'; return `<button type="button" class="v47day${cls}" data-day="${esc(d.date)}"><b>${esc(brDate(d.date))}</b><small>${esc(WEEK[dayObj(d.date).getDay()])}</small><span class="v47badge ${badge}">${esc(d.status)}</span><small>${d.count} atend. • ${brl(d.revenue)}</small><small>${Object.entries(d.byProf).map(([p,n])=>`${p}: ${n}`).join(' | ') || 'Sem lançamentos'}</small></button>`;}).join('');
    const items=(selected?.items||[]).map(x=>`<tr><td>${esc(x.hour||'-')}</td><td><strong>${esc(x.client)}</strong></td><td>${esc(x.service)}</td><td>${esc(x.prof)}</td><td>${esc(x.payment||'-')}</td><td>${brl(x.sale)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nenhum atendimento lançado nesse dia. Use os clientes para recuperar e preencher essa data.</td></tr>';
    const candidates=filteredClients().slice(0,8).map(x=>{const msg=messageFor(x, selected?.date); return `<tr><td><strong>${esc(x.name)}</strong><br><span class="muted">${x.days} dias parado • ${esc(x.favService)}</span></td><td>${brl(x.ticket)}</td><td>${esc(x.mainProfessional)}</td><td class="v47actions"><button type="button" class="secondary-button small-button" data-copy="${esc(msg)}">Copiar</button><a class="secondary-button small-button" href="${esc(waLink(msg))}" target="_blank" rel="noopener">WhatsApp</a></td></tr>`;}).join('');
    return `<div class="v47card"><h4>Controle da agenda por dias</h4><div class="v47filters"><label>Data inicial<input type="date" id="v47AgendaStart" value="${esc(c.agendaStart)}"></label><label>Data final<input type="date" id="v47AgendaEnd" value="${esc(c.agendaEnd)}"></label><label>Meta atend./dia<input type="number" id="v47DailyGoal" value="${esc(c.dailyGoal)}" min="1"></label><button type="button" class="secondary-button" id="v47ApplyAgenda">Ver período</button></div><div class="v47grid"><div class="v47card"><span>Dias no período</span><strong>${days.length}</strong></div><div class="v47card"><span>Atendimentos lançados</span><strong>${total}</strong></div><div class="v47card"><span>Dias fracos/vazios</span><strong>${weak}</strong></div><div class="v47card"><span>Faturamento do período</span><strong>${brl(revenue)}</strong></div></div><div class="v47days" style="margin-top:14px">${dayCards}</div></div><div class="v47two" style="margin-top:14px"><div class="v47card"><h4>Dia selecionado: ${esc(brDate(selected?.date||c.selectedDay))}</h4><table class="v47table"><thead><tr><th>Hora</th><th>Cliente</th><th>Serviço</th><th>Profissional</th><th>Pagto.</th><th>Valor</th></tr></thead><tbody>${items}</tbody></table></div><div class="v47card"><h4>Clientes para preencher esse dia</h4><p class="muted">Sugestão baseada nos clientes parados e no ticket. Use para preencher os dias fracos.</p><table class="v47table"><thead><tr><th>Cliente</th><th>Ticket</th><th>Prof.</th><th>Ação</th></tr></thead><tbody>${candidates||'<tr><td colspan="4">Nenhum cliente nos filtros atuais.</td></tr>'}</tbody></table></div></div>`;
  }

  function renderClients(){
    const c=cfg(); const clients=filteredClients(); const professionals=['Todos',...Array.from(new Set(buildClients().map(x=>x.mainProfessional).filter(Boolean))).sort()];
    const totalPotential=clients.slice(0,20).reduce((s,x)=>s+(x.ticket||45),0);
    const rowsHtml=clients.slice(0,80).map(x=>{ const msg=messageFor(x,c.selectedDay); const sev=x.days>=60?'bad':x.days>=45?'warn':'ok'; return `<tr><td><strong>${esc(x.name)}</strong><br><span class="muted">${x.count} visita(s) • último: ${brDate(x.last)}</span></td><td><span class="v47badge ${sev}">${x.days} dias</span></td><td>${esc(x.favService)}</td><td>${esc(x.mainProfessional)}</td><td>${brl(x.ticket)}</td><td><select data-status-client="${esc(x.key)}"><option ${x.contactStatus==='Pendente'?'selected':''}>Pendente</option><option ${x.contactStatus==='Chamado'?'selected':''}>Chamado</option><option ${x.contactStatus==='Respondeu'?'selected':''}>Respondeu</option><option ${x.contactStatus==='Agendou'?'selected':''}>Agendou</option><option ${x.contactStatus==='Sem resposta'?'selected':''}>Sem resposta</option></select></td><td class="v47actions"><button type="button" class="secondary-button small-button" data-copy="${esc(msg)}">Copiar</button><a class="secondary-button small-button" href="${esc(waLink(msg))}" target="_blank" rel="noopener">WhatsApp</a></td></tr>`;}).join('');
    return `<div class="v47card" style="margin-top:14px"><h4>Clientes para recuperar</h4><div class="v47filters"><label>Dias sem voltar<input type="number" id="v47MinDays" value="${esc(c.minDays)}" min="1"></label><label>Profissional<select id="v47Professional">${professionals.map(p=>`<option ${p===c.professional?'selected':''}>${esc(p)}</option>`).join('')}</select></label><label>Status<select id="v47ContactStatus"><option ${c.status==='Todos'?'selected':''}>Todos</option><option ${c.status==='Pendente'?'selected':''}>Pendente</option><option ${c.status==='Chamado'?'selected':''}>Chamado</option><option ${c.status==='Respondeu'?'selected':''}>Respondeu</option><option ${c.status==='Agendou'?'selected':''}>Agendou</option><option ${c.status==='Sem resposta'?'selected':''}>Sem resposta</option></select></label><label>Ticket mínimo<input type="number" id="v47MinTicket" value="${esc(c.minTicket)}" min="0"></label><label>Buscar<input id="v47Search" value="${esc(c.search)}" placeholder="Nome, serviço..."></label><button type="button" class="secondary-button" id="v47ApplyFilters">Aplicar filtros</button></div><div class="v47grid"><div class="v47card"><span>Clientes no filtro</span><strong>${clients.length}</strong></div><div class="v47card"><span>Potencial Top 20</span><strong>${brl(totalPotential)}</strong></div><div class="v47card"><span>60+ dias parados</span><strong>${clients.filter(x=>x.days>=60).length}</strong></div><div class="v47card"><span>Agendou</span><strong>${clients.filter(x=>x.contactStatus==='Agendou').length}</strong></div></div><table class="v47table" style="margin-top:14px"><thead><tr><th>Cliente</th><th>Dias</th><th>Serviço favorito</th><th>Profissional</th><th>Ticket</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rowsHtml||'<tr><td colspan="7">Nenhum cliente encontrado.</td></tr>'}</tbody></table></div>`;
  }

  function render(){
    ensure(); const loaded=rows().length; const c=cfg();
    $('#'+BOX).innerHTML = `<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Recuperação + Agenda</p><h3>Recuperador 2.0</h3><p class="muted">Escolha os dias para ver como a agenda está e use clientes parados para preencher os dias fracos.</p></div><button type="button" class="primary-button" id="v47Sync">Atualizar Atendimentos</button></div><div id="v47Status" class="import-status ${loaded?'success':'warning'}">${loaded?`Base carregada: ${loaded} atendimentos.`:'Clique em Atualizar Atendimentos para ler a planilha.'}</div>${renderAgenda()}${renderClients()}</article>`;
  }

  document.addEventListener('click', e=>{
    if(e.target.closest(`.nav-link[data-screen="${SCREEN}"]`)){ e.preventDefault(); e.stopPropagation(); openScreen(); }
    if(e.target.closest('#v47Sync')){ e.preventDefault(); sync().catch(err=>{const b=$('#v47Status'); if(b){b.className='import-status error'; b.textContent='Erro: '+(err.message||err);}}); }
    const day=e.target.closest('.v47day[data-day]'); if(day){ e.preventDefault(); setCfg({selectedDay:day.dataset.day}); render(); }
    if(e.target.closest('#v47ApplyAgenda')){ e.preventDefault(); setCfg({agendaStart:$('#v47AgendaStart')?.value||todayIso(), agendaEnd:$('#v47AgendaEnd')?.value||addDays(todayIso(),7), dailyGoal:Number($('#v47DailyGoal')?.value||8)}); render(); }
    if(e.target.closest('#v47ApplyFilters')){ e.preventDefault(); setCfg({minDays:Number($('#v47MinDays')?.value||30), professional:$('#v47Professional')?.value||'Todos', status:$('#v47ContactStatus')?.value||'Todos', minTicket:Number($('#v47MinTicket')?.value||0), search:$('#v47Search')?.value||''}); render(); }
    const copy=e.target.closest('[data-copy]'); if(copy){ e.preventDefault(); navigator.clipboard?.writeText(copy.dataset.copy||''); copy.textContent='Copiado'; setTimeout(()=>copy.textContent='Copiar',1200); }
  }, true);

  document.addEventListener('change', e=>{
    const sel=e.target.closest('select[data-status-client]'); if(sel){ setStatus(sel.dataset.statusClient, sel.value); }
  }, true);

  const oldSet=window.setScreen;
  if(typeof oldSet==='function') window.setScreen=function(id){ const out=oldSet.apply(this,arguments); if(id===SCREEN) setTimeout(openScreen,30); return out; };
  window.renderRecuperadorClientesV47=render;
  window.syncRecuperadorClientesV47=sync;
  setTimeout(()=>{ ensure(); if(!rows().length) render(); },1200);
})();