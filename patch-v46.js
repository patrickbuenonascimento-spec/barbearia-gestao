/* v46 - Recuperador 2.0 único: remove Agenda Vazia/Agenda do Dia/Recuperador antigo */
(function(){
  if (window.__recuperadorClientesV46) return;
  window.__recuperadorClientesV46 = true;

  // Bloqueia módulos antigos que criavam agenda vazia/agenda do dia/recuperador antigo.
  window.__gestaoV33 = true;
  window.__agendaDiskoV39 = true;
  window.__agendaDiskoV40 = true;
  window.__agendaDiskoV41 = true;
  window.__agendaDiskoV42 = true;
  window.__agendaVaziaForceV43 = true;
  window.__barberDataHubV44 = true;
  window.__agendaDiaV45 = true;

  const SHEET_ID = '1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc';
  const SCREEN = 'recuperadorClientesV46';
  const BOX = 'recuperadorClientesBoxV46';
  const CACHE = 'recuperador_v46_atendimentos';
  const CFG = 'recuperador_v46_cfg';
  const STATUS = 'recuperador_v46_status';
  const DEFAULT_GIFT = 'sobrancelha, pezinho ou hidratação simples';

  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const brl = n => Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const todayIso = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const brDate = iso => { const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso||''); };
  const dayObj = iso => { const m=String(iso||todayIso()).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2]-1, +m[3], 12) : new Date(); };
  const daysSince = iso => Math.max(0, Math.floor((dayObj(todayIso()) - dayObj(iso)) / 86400000));

  function dateIso(v){
    if(!v) return '';
    const s=String(v).trim();
    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if(m){
      let a=Number(m[1]), b=Number(m[2]), y=m[3].length===2?'20'+m[3]:m[3];
      // Google CSV costuma vir M/D/YYYY. Quando o segundo número passa de 12, é mês/dia.
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
    if(typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s=String(v).trim();
    const neg=/^\(.*\)$/.test(s) || /^-/.test(s);
    s=s.replace(/[()]/g,'').replace(/R\$/gi,'').replace(/%/g,'').replace(/\s/g,'');
    if(s.includes(',') && s.includes('.')) s=s.replace(/\./g,'').replace(',','.');
    else if(s.includes(',')) s=s.replace(',','.');
    const n=Number(s.replace(/[^0-9.]/g,''));
    return Number.isFinite(n) ? (neg ? -Math.abs(n) : n) : 0;
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

  function cleanHeader(h){
    const n=norm(h);
    const known=['data','hora','id atendimento','cliente','servico','serviço','profissional','status','pagamento','parcelas','valor tabela','desconto','venda liquida','venda líquida','taxa','taxa r','liquido previsto','líquido previsto','comissao','comissão','comissao r','comissão r','parte barbearia','custo material','margem do atendimento'];
    for(const k of known){ const nk=norm(k); if(n===nk || n.endsWith(' '+nk)) return k.replace('serviço','Serviço').replace('servico','Serviço'); }
    return String(h||'').trim();
  }

  function rowsToObjects(rows){
    const idx = rows.findIndex(r => {
      const ns=r.map(norm);
      return ns.some(x=>x==='data'||x.endsWith(' data')) && ns.some(x=>x.includes('cliente')) && ns.some(x=>x.includes('servico')||x.includes('servico'));
    });
    if(idx < 0) return [];
    const h=rows[idx].map(cleanHeader);
    return rows.slice(idx+1).map(r=>{
      const o={}; h.forEach((k,i)=>{ if(k) o[k]=r[i] ?? ''; }); return o;
    }).filter(o => Object.values(o).some(x => String(x||'').trim() && String(x).trim() !== '-'));
  }

  function getField(o, names){
    for(const n of names){
      if(o[n] != null && String(o[n]).trim() !== '') return o[n];
      const key=Object.keys(o).find(k=>norm(k)===norm(n));
      if(key && String(o[key]).trim() !== '') return o[key];
    }
    return '';
  }

  function loadJSON(key, fallback){ try{return JSON.parse(localStorage.getItem(key)||'') || fallback;}catch(e){return fallback;} }
  function saveJSON(key, data){ localStorage.setItem(key, JSON.stringify(data)); }
  function cfg(){ return {minDays:30, professional:'Todos', status:'Todos', minTicket:0, search:'', gift:DEFAULT_GIFT, ...loadJSON(CFG,{})}; }
  function setCfg(p){ saveJSON(CFG, {...cfg(), ...p}); }
  function statuses(){ return loadJSON(STATUS, {}); }
  function setStatus(clientKey, status){ const s=statuses(); s[clientKey]={status, updatedAt:new Date().toISOString()}; saveJSON(STATUS,s); render(); }
  function atendimentos(){ return loadJSON(CACHE, []); }

  function serviceMessage(c){
    const fav=norm(c.favService);
    const name=c.name.split(' ')[0] || c.name;
    if(fav.includes('barba') && fav.includes('cabelo')) return `Oi, ${name}! Tudo bem? Vi aqui que já faz ${c.days} dias desde seu último cabelo e barba. Tenho alguns horários essa semana com a Emily. Quer que eu veja um horário bom pra você?`;
    if(fav.includes('barba')) return `Oi, ${name}! Tudo bem? Vi que já faz ${c.days} dias desde sua última barba. A Emily está com alguns horários livres essa semana. Quer que eu veja um pra você?`;
    if(fav.includes('sobrancelha')) return `Oi, ${name}! Tudo bem? Já faz um tempinho desde seu último atendimento. Temos horários essa semana pra deixar o visual em dia. Quer que eu veja uma opção?`;
    return `Oi, ${name}! Tudo bem? Vi aqui que já faz ${c.days} dias desde seu último corte. Tenho alguns horários essa semana com a Emily. Quer que eu veja um horário bom pra você?`;
  }

  function messageFor(c){
    const base=serviceMessage(c);
    if(c.ticket >= 70) return base + ` Posso tentar encaixar também ${cfg().gift}.`;
    if(c.days >= 60) return `Oi, ${c.name.split(' ')[0] || c.name}! Tudo bem? Faz um bom tempo que você não aparece por aqui. Quer que eu veja um horário com a Emily essa semana pra deixar o visual em dia?`;
    return base;
  }

  function buildClients(){
    const rows=atendimentos(); const map=new Map();
    rows.forEach(r=>{
      const name=String(getField(r,['Cliente'])).trim(); if(!name) return;
      const k=norm(name); if(!k) return;
      const d=dateIso(getField(r,['Data'])); if(!d) return;
      const service=String(getField(r,['Serviço','Servico'])).trim() || 'Serviço';
      const prof=String(getField(r,['Profissional'])).trim() || 'Sem profissional';
      const sale=money(getField(r,['Venda líquida','Venda liquida','Líquido previsto','Liquido previsto','Valor tabela']));
      const it=map.get(k)||{key:k,name,count:0,paidCount:0,total:0,last:'',lastProfessional:'',svc:{},prof:{}};
      it.count++;
      if(sale>0){it.paidCount++; it.total+=sale;}
      if(!it.last || d>it.last){it.last=d; it.lastProfessional=prof; it.lastService=service;}
      it.svc[service]=(it.svc[service]||0)+1;
      it.prof[prof]=(it.prof[prof]||0)+1;
      map.set(k,it);
    });
    const st=statuses();
    return [...map.values()].map(c=>{
      const favService=Object.entries(c.svc).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'Cabelo';
      const mainProfessional=Object.entries(c.prof).sort((a,b)=>b[1]-a[1])[0]?.[0] || c.lastProfessional || 'Sem profissional';
      const ticket=c.paidCount ? c.total / c.paidCount : 0;
      const d=daysSince(c.last);
      return {...c, favService, mainProfessional, ticket, days:d, contactStatus: st[c.key]?.status || 'Pendente', statusAt: st[c.key]?.updatedAt || ''};
    });
  }

  function filteredClients(){
    const c=cfg();
    return buildClients().filter(x=>{
      if(x.days < Number(c.minDays||30)) return false;
      if(c.professional && c.professional !== 'Todos'){
        const want=norm(c.professional); if(norm(x.mainProfessional)!==want && norm(x.lastProfessional)!==want) return false;
      }
      if(c.status && c.status !== 'Todos' && x.contactStatus !== c.status) return false;
      if(Number(c.minTicket||0) > 0 && x.ticket < Number(c.minTicket||0)) return false;
      const q=norm(c.search); if(q && !norm(`${x.name} ${x.favService} ${x.mainProfessional}`).includes(q)) return false;
      return true;
    }).sort((a,b)=> (b.ticket*b.days) - (a.ticket*a.days));
  }

  async function safeJson(response){
    const text=await response.text(); const t=text.trim();
    if(!t) throw new Error('Resposta vazia da planilha.');
    if(t.startsWith('<')) throw new Error('A rota da planilha retornou HTML. Faça deploy sem cache e confirme /api/sheets-proxy.');
    try{return JSON.parse(t);}catch(e){throw new Error('Resposta da planilha não é JSON válido.');}
  }

  async function sync(){
    const box=$('#v46Status'); if(box){box.className='import-status warning'; box.textContent='Lendo Atendimentos da planilha...';}
    const qs=`spreadsheetId=${encodeURIComponent(SHEET_ID)}&sheets=${encodeURIComponent('Atendimentos')}`;
    let json;
    try{ json = await fetch(`/api/sheets-proxy?${qs}`,{cache:'no-store',headers:{Accept:'application/json'}}).then(safeJson); }
    catch(e){ json = await fetch(`/.netlify/functions/sheets-proxy?${qs}`,{cache:'no-store',headers:{Accept:'application/json'}}).then(safeJson); }
    if(!json.ok) throw new Error(json.message || 'Não consegui ler a planilha.');
    const csv=json.sheets?.Atendimentos || json.sheets?.['Atendimentos'];
    const rows=rowsToObjects(csvParse(csv));
    saveJSON(CACHE, rows);
    // Alimenta também nomes comuns do app antigo, sem depender deles.
    window.state = window.state || {};
    window.state.records = rows;
    if(typeof window.saveState === 'function') { try{ window.saveState(); }catch(e){} }
    if(box){box.className='import-status success'; box.textContent=`Atendimentos carregados: ${rows.length}. Recuperador atualizado.`;}
    render();
  }

  function hideOld(){
    const oldIds=['recuperarClientesV33','agendaVaziaV33','agendaVaziaDiskoV41','agendaVaziaDiskoV42','agendaVaziaForceV43','agendaDiaV45','agendaDiaBoxV45'];
    oldIds.forEach(id=>{ const el=$('#'+id); if(el){ el.classList.remove('active'); el.style.display='none'; }});
    $$('.nav-link[data-screen]').forEach(b=>{
      const s=b.dataset.screen||''; const tx=norm(b.textContent||'');
      if(oldIds.includes(s) || tx.includes('agenda vazia') || tx.includes('agenda do dia') || (tx.includes('recuperar clientes') && s!==SCREEN)) b.remove();
    });
  }

  function css(){
    if($('#v46css')) return;
    const s=document.createElement('style'); s.id='v46css'; s.textContent=`
      .v46grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.v46card{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.055);padding:16px}.v46card span{display:block;color:var(--muted);font-size:.82rem}.v46card strong{display:block;font-size:1.45rem;margin-top:6px}.v46filters{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:12px 0}.v46filters label{min-width:150px}.v46table{width:100%;border-collapse:collapse}.v46table th,.v46table td{border-bottom:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.v46table th{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.v46badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,211,109,.12);border:1px solid rgba(255,211,109,.25);color:#ffe7a8;font-weight:850;font-size:.76rem}.v46badge.bad{background:rgba(255,104,104,.12);border-color:rgba(255,104,104,.25);color:#ffd1d1}.v46badge.ok{background:rgba(87,214,137,.12);border-color:rgba(87,214,137,.25);color:#c9ffd9}.v46msg{max-width:360px;color:var(--muted);font-size:.88rem;line-height:1.35}.v46actions{display:flex;gap:6px;flex-wrap:wrap}.v46note{border:1px dashed var(--line);border-radius:18px;padding:14px;color:var(--muted);background:rgba(255,255,255,.035)}@media(max-width:1100px){.v46grid{grid-template-columns:1fr}.v46table{font-size:.84rem}.v46actions{min-width:180px}}`;
    document.head.appendChild(s);
  }

  function ensure(){
    css(); hideOld();
    let nav=$(`.nav-link[data-screen="${SCREEN}"]`);
    if(!nav){ nav=document.createElement('button'); nav.type='button'; nav.className='nav-link'; $('.nav')?.appendChild(nav); }
    nav.dataset.screen=SCREEN; nav.innerHTML='<span>🎯</span>Recuperador 2.0'; nav.style.display='flex';
    let screen=$('#'+SCREEN);
    if(!screen){ screen=document.createElement('section'); screen.id=SCREEN; screen.className='screen'; screen.innerHTML=`<div id="${BOX}"></div>`; $('.content')?.appendChild(screen); }
    if(!$('#'+BOX)) screen.innerHTML=`<div id="${BOX}"></div>`;
  }

  function openScreen(){
    ensure(); $$('.screen').forEach(s=>s.classList.remove('active')); $('#'+SCREEN)?.classList.add('active');
    $$('.nav-link[data-screen]').forEach(b=>b.classList.toggle('active', b.dataset.screen===SCREEN));
    const title=$('#pageTitle'); if(title) title.textContent='Recuperador 2.0';
    render();
  }

  function controls(){ const c=cfg(); const profs=['Todos',...Array.from(new Set(buildClients().flatMap(x=>[x.mainProfessional,x.lastProfessional]).filter(Boolean))).sort()]; return `<div id="v46Status" class="import-status warning">Base local: ${atendimentos().length} atendimentos. Clique em Atualizar Atendimentos.</div><div class="v46filters"><label>Profissional<select id="v46Prof">${profs.map(p=>`<option ${p===c.professional?'selected':''}>${esc(p)}</option>`).join('')}</select></label><label>Dias sem voltar<input id="v46MinDays" type="number" min="1" value="${esc(c.minDays)}"></label><label>Ticket mínimo<input id="v46MinTicket" type="number" min="0" value="${esc(c.minTicket)}"></label><label>Status<select id="v46ContactStatus">${['Todos','Pendente','Chamado','Respondeu','Agendou','Sem resposta'].map(s=>`<option ${s===c.status?'selected':''}>${s}</option>`).join('')}</select></label><label>Buscar<input id="v46Search" value="${esc(c.search)}" placeholder="nome, serviço..."></label><label>Brinde/oferta<input id="v46Gift" value="${esc(c.gift)}"></label><button type="button" class="primary-button" id="v46Sync">Atualizar Atendimentos</button><button type="button" class="secondary-button" id="v46Apply">Aplicar filtros</button></div>`; }

  function render(){
    ensure(); const clients=filteredClients(); const all=buildClients(); const c=cfg();
    const inactive30=all.filter(x=>x.days>=30).length, inactive45=all.filter(x=>x.days>=45).length, inactive60=all.filter(x=>x.days>=60).length;
    const potential=clients.slice(0,20).reduce((s,x)=>s+(x.ticket||45),0);
    const emily=clients.filter(x=>norm(x.mainProfessional).includes('emily') || norm(x.lastProfessional).includes('emily'));
    const rows=clients.map(x=>{ const msg=messageFor(x); const wa=`https://wa.me/?text=${encodeURIComponent(msg)}`; return `<tr><td><strong>${esc(x.name)}</strong><br><span class="muted">${esc(x.count)} visita(s) • ${esc(x.paidCount)} paga(s)</span></td><td>${esc(brDate(x.last))}<br><span class="v46badge ${x.days>=60?'bad':x.days>=45?'':'ok'}">${x.days} dias</span></td><td>${esc(x.favService)}<br><span class="muted">${esc(x.mainProfessional)}</span></td><td><strong>${brl(x.ticket)}</strong><br><span class="muted">total ${brl(x.total)}</span></td><td><span class="v46badge">${esc(x.contactStatus)}</span></td><td><div class="v46msg">${esc(msg)}</div></td><td><div class="v46actions"><button type="button" class="secondary-button small-button v46Copy" data-msg="${esc(msg)}">Copiar</button><a class="secondary-button small-button" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a><button type="button" class="secondary-button small-button v46Set" data-client="${esc(x.key)}" data-status="Chamado">Chamado</button><button type="button" class="secondary-button small-button v46Set" data-client="${esc(x.key)}" data-status="Respondeu">Respondeu</button><button type="button" class="primary-button small-button v46Set" data-client="${esc(x.key)}" data-status="Agendou">Agendou</button><button type="button" class="danger-button small-button v46Set" data-client="${esc(x.key)}" data-status="Sem resposta">Sem resposta</button></div></td></tr>`; }).join('');
    $('#'+BOX).innerHTML=`<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">CRM e faturamento</p><h3>Recuperador 2.0</h3><p class="muted">Tela única para recuperar clientes parados. A Agenda Vazia e o recuperador antigo foram removidos do menu.</p></div></div>${controls()}<div class="v46grid"><div class="v46card"><span>Clientes únicos na base</span><strong>${all.length}</strong></div><div class="v46card"><span>Parados 30+/45+/60+</span><strong>${inactive30}/${inactive45}/${inactive60}</strong></div><div class="v46card"><span>Clientes no filtro</span><strong>${clients.length}</strong></div><div class="v46card"><span>Potencial top 20</span><strong>${brl(potential)}</strong></div></div><div class="v46note" style="margin-top:14px"><strong>Foco prático:</strong> comece pelos clientes com maior ticket e mais dias sem voltar. Para encher agenda da Emily, use o filtro de profissional e copie as mensagens. Clientes relacionados à Emily no filtro atual: <strong>${emily.length}</strong>.</div><div class="v46card" style="margin-top:14px"><h4>Clientes para chamar</h4><table class="v46table"><thead><tr><th>Cliente</th><th>Última visita</th><th>Preferência</th><th>Ticket</th><th>Status</th><th>Mensagem pronta</th><th>Ação</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Nenhum cliente encontrado com os filtros atuais.</td></tr>'}</tbody></table></div></article>`;
  }

  document.addEventListener('click', e=>{
    const nav=e.target.closest(`.nav-link[data-screen="${SCREEN}"]`); if(nav){ e.preventDefault(); e.stopPropagation(); openScreen(); return; }
    if(e.target.closest('#v46Sync')){ e.preventDefault(); sync().catch(err=>{const b=$('#v46Status'); if(b){b.className='import-status error'; b.textContent='Erro: '+(err.message||err);}}); }
    if(e.target.closest('#v46Apply')){ e.preventDefault(); setCfg({professional:$('#v46Prof')?.value||'Todos',minDays:Number($('#v46MinDays')?.value||30),minTicket:Number($('#v46MinTicket')?.value||0),status:$('#v46ContactStatus')?.value||'Todos',search:$('#v46Search')?.value||'',gift:$('#v46Gift')?.value||DEFAULT_GIFT}); render(); }
    const set=e.target.closest('.v46Set'); if(set){ e.preventDefault(); setStatus(set.dataset.client,set.dataset.status); }
    const cp=e.target.closest('.v46Copy'); if(cp){ e.preventDefault(); navigator.clipboard?.writeText(cp.dataset.msg||''); cp.textContent='Copiado'; setTimeout(()=>cp.textContent='Copiar',1200); }
  }, true);

  const oldSet=window.setScreen;
  if(typeof oldSet==='function') window.setScreen=function(id){ const out=oldSet.apply(this,arguments); if(id===SCREEN) setTimeout(openScreen,50); else setTimeout(hideOld,50); return out; };
  window.renderRecuperadorClientesV46=render;
  window.syncRecuperadorClientesV46=sync;
  setTimeout(()=>{ ensure(); if(!atendimentos().length) sync().catch(()=>render()); else render(); },1400);
})();