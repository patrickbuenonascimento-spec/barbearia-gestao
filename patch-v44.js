/* v44 - DataHub Barbearia: planilha única, faturamento e agenda com plano B */
(function(){
  if (window.__barberDataHubV44) return;
  window.__barberDataHubV44 = true;

  // Neutraliza agendas antigas em cache, mas mantém Recuperar Clientes da v33 quando existir.
  window.__agendaDiskoV39 = true;
  window.__agendaDiskoV40 = true;
  window.__agendaDiskoV41 = true;
  window.__agendaDiskoV42 = true;
  window.__agendaDiskoV43 = true;

  const SHEET_ID = '1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc';
  const API_SHEETS = '/api/sheets-proxy';
  const API_DISKO = '/api/disko-proxy';
  const STORE = 'barbearia_datahub_v44';
  const AGENDA_STORE = 'barbearia_agenda_manual_v44';
  const CFG = 'barbearia_datahub_cfg_v44';
  const FAT_SCREEN = 'faturamentoV44';
  const AGENDA_SCREEN = 'agendaVaziaV44';
  const DEFAULT_DISKO = 'https://taisemourabarber.disko.com.br/marcacao';
  const SHEETS = [
    'Painel','Config','Atendimentos','Vendas Produtos','Contas','Extrato','Conciliacao','Estoque','Mov Estoque',
    'Equipe','Folha e Prolabore','DRE','Fluxo Caixa','Auditoria','Pacotes e Permutas','Permutas'
  ];

  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const brl = n => Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const pct = n => `${Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
  const todayIso = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const monthStart = () => todayIso().slice(0,8)+'01';
  const dayObj = iso => { const m=String(iso||todayIso()).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1],+m[2]-1,+m[3],12) : new Date(); };
  const brDate = iso => { const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso||''); };
  const addDays = (iso,n) => { const d=dayObj(iso); d.setDate(d.getDate()+Number(n||0)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const week = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const mins = t => { const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1]*60 + +m[2] : 0; };
  const hm = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

  function cfg(){
    try { return { start:monthStart(), end:todayIso(), dailyGoal:800, diskoUrl:DEFAULT_DISKO, agendaDays:10, interval:30, weekStart:'14:30', weekEnd:'20:00', satStart:'09:00', satEnd:'17:00', ...JSON.parse(localStorage.getItem(CFG)||'{}') }; }
    catch(e){ return { start:monthStart(), end:todayIso(), dailyGoal:800, diskoUrl:DEFAULT_DISKO, agendaDays:10, interval:30, weekStart:'14:30', weekEnd:'20:00', satStart:'09:00', satEnd:'17:00' }; }
  }
  function setCfg(p){ localStorage.setItem(CFG, JSON.stringify({...cfg(), ...p})); }

  function parseMoney(v){
    if (v == null || v === '' || v === '-' || v === '–') return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s = String(v).trim();
    const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
    s = s.replace(/[()]/g,'').replace(/R\$/gi,'').replace(/%/g,'').replace(/\s/g,'');
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g,'').replace(',','.');
    else if (s.includes(',')) s = s.replace(',','.');
    const n = Number(s.replace(/[^0-9.]/g,''));
    return Number.isFinite(n) ? (neg ? -Math.abs(n) : n) : 0;
  }

  function dateIso(v){
    if (!v) return '';
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${String(+m[2]).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`;
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!m) return '';
    let a=+m[1], b=+m[2], y=+m[3]; if (y<100) y+=2000;
    let day, month;
    if (a > 12) { day=a; month=b; }
    else if (b > 12) { month=a; day=b; }
    else { day=a; month=b; }
    return `${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function csvParse(text){
    const rows=[]; let row=[], cell='', q=false; const s=String(text||'');
    for(let i=0;i<s.length;i++){
      const c=s[i], n=s[i+1];
      if(q){ if(c==='"'&&n==='"'){cell+='"'; i++;} else if(c==='"'){q=false;} else cell+=c; }
      else { if(c==='"') q=true; else if(c===','){row.push(cell); cell='';} else if((c==='\n'||c==='\r')){ if(c==='\r'&&n==='\n') i++; row.push(cell); rows.push(row); row=[]; cell=''; } else cell+=c; }
    }
    row.push(cell); rows.push(row);
    return rows.map(r=>r.map(x=>String(x||'').trim())).filter(r=>r.some(c=>c));
  }

  function headerIndex(rows, sheetName){
    const keysBySheet = {
      'Atendimentos':['data','cliente','servico','profissional','venda liquida','comissao'],
      'Vendas Produtos':['data','cliente','produto','venda bruta','liquido previsto'],
      'Contas':['vencimento','fornecedor','categoria','valor previsto','valor pago','status'],
      'Extrato':['data','descricao bancaria','valor','tipo','categoria'],
      'Equipe':['profissional','funcao','vinculo','ativo','comissao'],
      'Folha e Prolabore':['competencia','profissional','total a pagar'],
      'Pacotes e Permutas':['cliente','tipo','valor']
    };
    const keys = keysBySheet[sheetName] || ['data','cliente','valor','status','categoria','profissional'];
    let best = {idx:-1,score:-1};
    rows.slice(0,20).forEach((r,i)=>{
      const ns = r.map(norm);
      const score = keys.reduce((s,k)=>s+(ns.some(c=>c===k || c.includes(k))?1:0),0);
      if(score > best.score) best = {idx:i,score};
    });
    return best.score >= 2 ? best.idx : -1;
  }

  function objectsFromCsv(csv, sheetName){
    const rows = csvParse(csv);
    const hi = headerIndex(rows, sheetName);
    if (hi < 0) return [];
    const headers = rows[hi].map(h=>String(h||'').trim());
    return rows.slice(hi+1).map(r=>{
      const o={}; headers.forEach((h,i)=>{ if(h) o[h]=r[i] ?? ''; }); return o;
    }).filter(o=>Object.values(o).some(v=>String(v||'').trim() && String(v).trim() !== '-'));
  }

  function by(obj, names){
    const entries = Object.entries(obj||{});
    for (const n of names) {
      const target = norm(n);
      const hit = entries.find(([k])=>norm(k)===target || norm(k).includes(target));
      if (hit) return hit[1];
    }
    return '';
  }

  function normalizeAll(raw){
    const atend = (raw.Atendimentos||[]).map((o,i)=>{
      const iso = dateIso(by(o,['Data']));
      const id = String(by(o,['ID atendimento']) || `ATD-${i+1}`).trim();
      const sale = parseMoney(by(o,['Venda líquida','Venda liquida']));
      const expectedNet = parseMoney(by(o,['Líquido previsto','Liquido previsto']));
      const commission = parseMoney(by(o,['Comissão R$','Comissao R$','Comissão','Comissao']));
      const share = parseMoney(by(o,['Parte barbearia']));
      const margin = parseMoney(by(o,['Margem do atendimento','Margem']));
      return {
        id, dateISO:iso, date: iso ? `${iso}T12:00:00` : '', displayDate: brDate(iso),
        time:String(by(o,['Hora'])||'').trim(), client:String(by(o,['Cliente'])||'').trim(), service:String(by(o,['Serviço','Servico'])||'').trim(),
        professional:String(by(o,['Profissional'])||'').trim(), status:String(by(o,['Status'])||'Atendido').trim(), payment:String(by(o,['Pagamento'])||'Não informado').trim(),
        sale, tableValue:parseMoney(by(o,['Valor tabela'])), discount:parseMoney(by(o,['Desconto'])), expectedNet, commission,
        barbershopShare:share, materialCost:parseMoney(by(o,['Custo material'])), margin, raw:o, financial:sale>0,
        source:'DataHubV44'
      };
    }).filter(r=>r.dateISO && r.client);

    const products = (raw['Vendas Produtos']||[]).map((o,i)=>{
      const iso = dateIso(by(o,['Data']));
      return { id:String(by(o,['ID','ID produto'])||`PROD-${i+1}`), dateISO:iso, date:iso?`${iso}T12:00:00`:'', client:String(by(o,['Cliente'])||'').trim(), product:String(by(o,['Produto'])||'').trim(), quantity:parseMoney(by(o,['Quantidade'])), gross:parseMoney(by(o,['Venda bruta'])), cmv:parseMoney(by(o,['CMV'])), fee:parseMoney(by(o,['Taxa R$'])), expectedNet:parseMoney(by(o,['Líquido previsto','Liquido previsto'])), payment:String(by(o,['Pagamento'])||'').trim(), raw:o };
    }).filter(r=>r.dateISO || r.product);

    const bills = (raw.Contas||[]).map((o,i)=>{
      const iso = dateIso(by(o,['Pagamento'])) || dateIso(by(o,['Vencimento'])) || dateIso(by(o,['Competência','Competencia']));
      return { id:String(by(o,['ID conta'])||`CONTA-${i+1}`), dateISO:iso, supplier:String(by(o,['Fornecedor'])||'').trim(), category:String(by(o,['Categoria'])||'').trim(), description:String(by(o,['Descrição','Descricao'])||'').trim(), expected:parseMoney(by(o,['Valor previsto'])), paid:parseMoney(by(o,['Valor pago'])), status:String(by(o,['Status'])||'').trim(), raw:o };
    }).filter(r=>r.supplier || r.paid || r.expected);

    const extract = (raw.Extrato||[]).map((o,i)=>{ const iso=dateIso(by(o,['Data'])); return { id:`EXT-${i+1}`, dateISO:iso, description:String(by(o,['Descrição bancária','Descricao bancaria','Descrição','Descricao'])||'').trim(), account:String(by(o,['Conta'])||'').trim(), value:parseMoney(by(o,['Valor'])), type:String(by(o,['Tipo'])||'').trim(), category:String(by(o,['Categoria'])||'').trim(), raw:o }; }).filter(r=>r.dateISO || r.value);

    const team = (raw.Equipe||[]).map((o,i)=>{
      const name = String(by(o,['Profissional','Nome'])||'').trim();
      return { id:`COL-${i+1}-${norm(name).replace(/\s/g,'-')}`, name, role:String(by(o,['Função','Funcao'])||'').trim(), bond:String(by(o,['Vínculo','Vinculo'])||'').trim(), active:/sim|ativo|yes|true/i.test(String(by(o,['Ativo?','Ativo'])||'')), commissionPercent:parseMoney(by(o,['Comissão %','Comissao %'])), salary:parseMoney(by(o,['Salário/Pró-labore','Salario/Pro-labore','Pró-labore','Pro-labore'])), pix:String(by(o,['Chave Pix'])||'').trim(), notes:String(by(o,['Observações','Observacoes'])||'').trim(), raw:o };
    }).filter(r=>r.name);

    const payroll = (raw['Folha e Prolabore']||[]).map((o,i)=>({ id:`FOLHA-${i+1}`, competence:String(by(o,['Competência','Competencia'])||'').trim(), professional:String(by(o,['Profissional'])||'').trim(), total:parseMoney(by(o,['Total a pagar','Valor','Pró-labore','Pro-labore'])), raw:o })).filter(r=>r.professional || r.total);

    return { raw, atend, products, bills, extract, team, payroll, updatedAt:new Date().toISOString() };
  }

  function loadHub(){ try { return JSON.parse(localStorage.getItem(STORE)||'null') || normalizeAll({}); } catch(e){ return normalizeAll({}); } }
  function saveHub(model){ localStorage.setItem(STORE, JSON.stringify(model)); window.BarberDataHubV44 = model; }

  async function safeJson(res){
    const text = await res.text();
    const t = text.trim();
    if (!t) throw new Error('Resposta vazia.');
    if (t.startsWith('<')) throw new Error('A rota retornou HTML, não JSON. Verifique deploy/redirect do Netlify.');
    try { return JSON.parse(t); } catch(e){ throw new Error('JSON inválido: '+t.slice(0,120)); }
  }

  async function syncHub(){
    setStatus('Lendo planilha inteira pelo DataHub...', 'warn');
    const url = `${API_SHEETS}?spreadsheetId=${encodeURIComponent(SHEET_ID)}&sheets=${encodeURIComponent(SHEETS.join(','))}`;
    const res = await fetch(url,{cache:'no-store', headers:{Accept:'application/json'}});
    const json = await safeJson(res);
    if (!json.ok) throw new Error(json.message || 'Falha ao ler a planilha.');
    const raw = {};
    Object.entries(json.sheets || {}).forEach(([name,csv]) => { raw[name] = objectsFromCsv(csv, name); });
    const model = normalizeAll(raw);
    model.sheetErrors = json.errors || [];
    saveHub(model);
    bridgeState(model);
    setStatus(`DataHub atualizado: ${model.atend.length} atendimentos, ${model.products.length} produtos, ${model.bills.length} contas, ${model.team.length} colaboradores.`, 'ok');
    renderFaturamento();
    return model;
  }

  function bridgeState(model){
    window.state = window.state || {};
    const oldRecords = Array.isArray(window.state.records) ? window.state.records.filter(r => r.source !== 'DataHubV44') : [];
    const records = model.atend.map(r=>({
      id:r.id, source:'DataHubV44', date:r.date, data:r.date, dateISO:r.dateISO, displayDate:r.displayDate, time:r.time, hora:r.time,
      clientName:r.client, cliente:r.client, serviceName:r.service, servico:r.service, collaboratorName:r.professional, professionalName:r.professional, profissional:r.professional,
      status:r.status, paymentMethod:r.payment, pagamento:r.payment, saleValue:r.sale, vendaLiquida:r.sale, netSale:r.sale,
      expectedNet:r.expectedNet, liquidoPrevisto:r.expectedNet, commissionValue:r.commission, comissao:r.commission, barbershopShare:r.barbershopShare,
      materialCost:r.materialCost, margin:r.margin, margem:r.margin, raw:r.raw
    }));
    window.state.records = oldRecords.concat(records);
    const collaborators = model.team.map(t=>({ id:t.id, name:t.name, nome:t.name, collaboratorName:t.name, role:t.role, funcao:t.role, bond:t.bond, vinculo:t.bond, active:t.active, ativo:t.active, commissionRate:t.commissionPercent, commissionPercent:t.commissionPercent, salary:t.salary, pix:t.pix, notes:t.notes, source:'DataHubV44', raw:t.raw }));
    window.state.collaborators = collaborators;
    window.state.team = collaborators;
    window.state.professionals = collaborators;
    window.state.employees = collaborators;
    window.state.productsSales = model.products;
    window.state.bills = model.bills;
    window.state.extract = model.extract;
    try { localStorage.setItem('barberShopStateV2', JSON.stringify(window.state)); } catch(e) {}
    try { if (typeof saveState === 'function') saveState(); } catch(e) {}
    try { if (typeof renderAll === 'function') renderAll(); } catch(e) {}
  }

  function inRange(iso,start,end){ return (!start || iso>=start) && (!end || iso<=end); }
  function filteredModel(){ const c=cfg(), h=loadHub(); return {...h, atend:h.atend.filter(r=>inRange(r.dateISO,c.start,c.end)), products:h.products.filter(r=>inRange(r.dateISO,c.start,c.end)), bills:h.bills.filter(r=>inRange(r.dateISO,c.start,c.end)), extract:h.extract.filter(r=>inRange(r.dateISO,c.start,c.end))}; }

  function stats(model){
    const serviceRows = model.atend.filter(r=>r.sale>0);
    const serviceSales = serviceRows.reduce((s,r)=>s+r.sale,0);
    const productSales = model.products.reduce((s,r)=>s+r.gross,0);
    const expenses = model.bills.filter(b=>/pago|compensa/i.test(b.status) || b.paid>0).reduce((s,b)=>s+b.paid,0);
    const commission = model.atend.reduce((s,r)=>s+r.commission,0);
    const barbershop = model.atend.reduce((s,r)=>s+(r.barbershopShare || Math.max(0,r.sale-r.commission)),0);
    const clients = new Set(model.atend.map(r=>norm(r.client)).filter(Boolean)).size;
    const ticket = serviceRows.length ? serviceSales / serviceRows.length : 0;
    return { serviceSales, productSales, totalSales:serviceSales+productSales, expenses, commission, barbershop, clients, ticket, count:model.atend.length, financialCount:serviceRows.length };
  }

  function groupBy(list, keyFn, valFn){ const m=new Map(); list.forEach(x=>{ const k=keyFn(x)||'Sem informação'; m.set(k,(m.get(k)||0)+(valFn?valFn(x):1)); }); return [...m.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value); }
  function bars(items, money=false){ const max=Math.max(1,...items.map(i=>Math.abs(i.value||0))); return `<div class="v44bars">${items.map(i=>`<div class="v44bar"><span>${esc(i.label)}</span><i><b style="width:${Math.max(3,Math.abs(i.value||0)/max*100)}%"></b></i><strong>${money?brl(i.value):Math.round(i.value||0)}</strong></div>`).join('')}</div>`; }

  function clientMap(all){
    const m=new Map();
    all.forEach(r=>{ const k=norm(r.client); if(!k) return; const it=m.get(k)||{name:r.client,count:0,total:0,last:'',services:{}}; it.count++; if(r.sale>0) it.total+=r.sale; if(r.dateISO && (!it.last || r.dateISO>it.last)) it.last=r.dateISO; it.services[r.service]=(it.services[r.service]||0)+1; m.set(k,it); });
    return [...m.values()].map(c=>({...c, ticket:c.count?c.total/c.count:0, fav:Object.entries(c.services).sort((a,b)=>b[1]-a[1])[0]?.[0]||'Cabelo', days:Math.floor((dayObj(todayIso())-dayObj(c.last))/86400000)}));
  }

  function css(){
    if ($('#v44css')) return;
    const s=document.createElement('style'); s.id='v44css';
    s.textContent = `.v44grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.v44two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.v44card{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.055);padding:16px}.v44card span{display:block;color:var(--muted);font-size:.82rem}.v44card strong{display:block;font-size:1.45rem;margin-top:6px}.v44filters{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:12px 0}.v44filters label{min-width:150px}.v44note{border:1px dashed var(--line);border-radius:18px;padding:14px;color:var(--muted);background:rgba(255,255,255,.035)}.v44table{width:100%;border-collapse:collapse}.v44table th,.v44table td{border-bottom:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.v44table th{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.v44badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,211,109,.12);border:1px solid rgba(255,211,109,.25);color:#ffe7a8;font-weight:850;font-size:.76rem}.v44badge.bad{background:rgba(255,104,104,.12);border-color:rgba(255,104,104,.25);color:#ffd1d1}.v44badge.ok{background:rgba(87,214,137,.12);border-color:rgba(87,214,137,.25);color:#c9ffd9}.v44bars{display:grid;gap:11px}.v44bar{display:grid;grid-template-columns:130px 1fr 92px;gap:10px;align-items:center}.v44bar span{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v44bar i{height:14px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid var(--line);overflow:hidden}.v44bar b{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--gold),var(--orange))}.v44bar strong{text-align:right;font-size:.85rem}.v44slots{display:flex;gap:6px;flex-wrap:wrap;max-width:540px}.v44slot{display:inline-flex;padding:4px 8px;border-radius:999px;background:rgba(87,214,137,.12);border:1px solid rgba(87,214,137,.25);color:#c9ffd9;font-weight:800;font-size:.78rem}@media(max-width:1100px){.v44grid,.v44two{grid-template-columns:1fr}.v44bar{grid-template-columns:95px 1fr 70px}}`;
    document.head.appendChild(s);
  }

  function ensureScreen(id, boxId){ css(); let screen=$('#'+id); if(!screen){ screen=document.createElement('section'); screen.id=id; screen.className='screen'; screen.innerHTML=`<div id="${boxId}"></div>`; $('.content')?.appendChild(screen); } if(!$('#'+boxId)) screen.innerHTML=`<div id="${boxId}"></div>`; return screen; }
  function addNav(id,label,icon){ let nav=$(`.nav-link[data-screen="${id}"]`); if(!nav && id===AGENDA_SCREEN) nav=$(`.nav-link[data-screen="agendaVaziaV33"],.nav-link[data-screen="agendaVaziaDiskoV43"],.nav-link[data-screen="agendaVaziaDiskoV42"]`); if(!nav){ nav=document.createElement('button'); nav.type='button'; nav.className='nav-link'; $('.nav')?.appendChild(nav); } nav.dataset.screen=id; nav.innerHTML=`<span>${icon}</span>${label}`; nav.style.display='flex'; nav.classList.remove('v27-hidden'); return nav; }
  function show(id){
    ensureAll();
    $$('.screen').forEach(s=>s.classList.remove('active'));
    const screen=$('#'+id); if(screen) screen.classList.add('active');
    $$('.nav-link[data-screen]').forEach(b=>b.classList.toggle('active', b.dataset.screen===id));
    const title=$('#pageTitle'); if(title) title.textContent = id===FAT_SCREEN?'Faturamento':'Agenda Vazia';
    if(id===FAT_SCREEN) renderFaturamento(); else if(id===AGENDA_SCREEN) renderAgenda();
  }
  function ensureAll(){ addNav(FAT_SCREEN,'Faturamento','💰'); addNav(AGENDA_SCREEN,'Agenda Vazia','📅'); ensureScreen(FAT_SCREEN,'faturamentoBoxV44'); ensureScreen(AGENDA_SCREEN,'agendaBoxV44'); }
  function setStatus(msg, kind='warn'){ const box=$('#v44Status'); if(box){ box.className = 'import-status '+(kind==='ok'?'success':kind==='err'?'error':'warning'); box.textContent = msg; } }

  function periodControls(extra=''){
    const c=cfg();
    return `<div id="v44Status" class="import-status warning">DataHub pronto. Clique em Atualizar base da planilha.</div><div class="v44filters"><label>Início<input type="date" id="v44Start" value="${esc(c.start)}"></label><label>Fim<input type="date" id="v44End" value="${esc(c.end)}"></label><label>Meta diária<input type="number" id="v44DailyGoal" min="1" value="${esc(c.dailyGoal)}"></label><button type="button" class="primary-button" id="v44Sync">Atualizar base da planilha</button><button type="button" class="secondary-button" id="v44Apply">Aplicar período</button>${extra}</div>`;
  }

  function renderFaturamento(){
    ensureScreen(FAT_SCREEN,'faturamentoBoxV44');
    const hub=filteredModel(); const all=loadHub(); const st=stats(hub); const c=cfg();
    const daysOpen = Math.max(1, Math.ceil((dayObj(c.end)-dayObj(c.start))/86400000)+1);
    const target = Number(c.dailyGoal||0) * daysOpen;
    const missing = Math.max(0, target - st.totalSales);
    const perDay = groupBy(hub.atend.filter(r=>r.sale>0), r=>r.dateISO, r=>r.sale).sort((a,b)=>a.label.localeCompare(b.label)).slice(-12);
    const prof = groupBy(hub.atend.filter(r=>r.sale>0), r=>r.professional||'Sem profissional', r=>r.sale).slice(0,8);
    const services = groupBy(hub.atend, r=>r.service||'Serviço', ()=>1).slice(0,8);
    const inactive = clientMap(all.atend).filter(c=>c.days>=30).sort((a,b)=>b.days-a.days).slice(0,12);
    const emily = hub.atend.filter(r=>/emily/i.test(r.professional));
    const emilySales = emily.reduce((s,r)=>s+r.sale,0);
    const taiseSales = hub.atend.filter(r=>/tai|tha/i.test(norm(r.professional))).reduce((s,r)=>s+r.sale,0);
    const messages = inactive.slice(0,5).map(c=>`Oi, ${c.name}! Tudo bem? Notei que já faz um tempinho desde seu último atendimento. Essa semana temos horários para ${c.fav}. Quer que eu veja um melhor horário para você?`);
    $('#faturamentoBoxV44').innerHTML = `<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">DataHub Barbearia</p><h3>Central de Faturamento</h3><p class="muted">Base única: Atendimentos, Produtos, Contas, Extrato, Equipe, Folha e Pacotes. Use essa tela para decidir o que vender hoje.</p></div></div>${periodControls()}<div class="v44grid"><div class="v44card"><span>Faturamento do período</span><strong>${brl(st.totalSales)}</strong></div><div class="v44card"><span>Meta do período</span><strong>${brl(target)}</strong></div><div class="v44card"><span>Falta para meta</span><strong>${brl(missing)}</strong></div><div class="v44card"><span>Ticket médio serviços</span><strong>${brl(st.ticket)}</strong></div></div><div class="v44grid" style="margin-top:14px"><div class="v44card"><span>Serviços</span><strong>${brl(st.serviceSales)}</strong></div><div class="v44card"><span>Produtos</span><strong>${brl(st.productSales)}</strong></div><div class="v44card"><span>Comissões</span><strong>${brl(st.commission)}</strong></div><div class="v44card"><span>Clientes únicos</span><strong>${st.clients}</strong></div></div><div class="v44two" style="margin-top:14px"><div class="v44card"><h4>Faturamento por dia</h4>${perDay.length?bars(perDay,true):'<div class="v44note">Sem faturamento no período selecionado.</div>'}</div><div class="v44card"><h4>Faturamento por profissional</h4>${prof.length?bars(prof,true):'<div class="v44note">Sem dados por profissional.</div>'}</div></div><div class="v44two" style="margin-top:14px"><div class="v44card"><h4>Foco Emily</h4><p class="muted">A estratégia comercial deve preencher a agenda da Emily sem sobrecarregar a Taíse.</p><table class="v44table"><tr><th>Profissional</th><th>Produção</th><th>Atendimentos</th></tr><tr><td>Emily</td><td>${brl(emilySales)}</td><td>${emily.length}</td></tr><tr><td>Taíse</td><td>${brl(taiseSales)}</td><td>${hub.atend.filter(r=>/tai|tha/i.test(norm(r.professional))).length}</td></tr></table></div><div class="v44card"><h4>Serviços mais vendidos</h4>${services.length?bars(services,false):'<div class="v44note">Sem serviços carregados.</div>'}</div></div><div class="v44card" style="margin-top:14px"><h4>Ações para aumentar faturamento</h4><table class="v44table"><thead><tr><th>Ação</th><th>Motivo</th><th>Prioridade</th></tr></thead><tbody><tr><td>Preencher horários vazios da Emily</td><td>Maior capacidade de crescimento sem depender da agenda da Taíse.</td><td><span class="v44badge bad">Alta</span></td></tr><tr><td>Recuperar clientes 30+ dias</td><td>${inactive.length} clientes aparecem sem retorno recente.</td><td><span class="v44badge bad">Alta</span></td></tr><tr><td>Vender plano de cabelo mensal</td><td>Transforma agenda vazia em recorrência e previsibilidade de caixa.</td><td><span class="v44badge ok">Boa</span></td></tr><tr><td>Adicionar sobrancelha/pezinho</td><td>Aumenta ticket sem ocupar muito tempo.</td><td><span class="v44badge">Média</span></td></tr></tbody></table></div><div class="v44card" style="margin-top:14px"><h4>Clientes para chamar agora</h4>${inactive.length?`<table class="v44table"><thead><tr><th>Cliente</th><th>Dias sem voltar</th><th>Serviço provável</th><th>Mensagem</th></tr></thead><tbody>${inactive.slice(0,10).map(c=>`<tr><td>${esc(c.name)}</td><td>${c.days}</td><td>${esc(c.fav)}</td><td><button type="button" class="secondary-button small-button v44Copy" data-msg="${esc(`Oi, ${c.name}! Tudo bem? Vi que faz ${c.days} dias desde seu último atendimento. Essa semana temos horários para ${c.fav}. Quer que eu veja um horário para você?`)}">Copiar</button></td></tr>`).join('')}</tbody></table>`:'<div class="v44note">Sem clientes inativos calculados. Atualize a base da planilha.</div>'}</div><div class="v44note" style="margin-top:14px">Atualizado em: ${all.updatedAt?new Date(all.updatedAt).toLocaleString('pt-BR'):'nunca'}. Abas lidas: ${Object.keys(all.raw||{}).length}.</div></article>`;
  }

  function loadManual(){ try{return JSON.parse(localStorage.getItem(AGENDA_STORE)||'[]')}catch(e){return []} }
  function saveManual(x){ localStorage.setItem(AGENDA_STORE, JSON.stringify(x||[])); }
  function expectedSlots(iso,c){ const dow=dayObj(iso).getDay(); if(dow===0) return []; const start=dow===6?c.satStart:c.weekStart; const end=dow===6?c.satEnd:c.weekEnd; const a=mins(start), b=mins(end), step=Math.max(15,Number(c.interval)||30); const out=[]; for(let m=a;m<b;m+=step) out.push(hm(m)); return out; }

  async function readDisko(){
    const c=cfg();
    const url = `${API_DISKO}?url=${encodeURIComponent(c.diskoUrl || DEFAULT_DISKO)}&start=${encodeURIComponent(c.start || todayIso())}&days=${encodeURIComponent(c.agendaDays || 10)}`;
    const res = await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});
    const json = await safeJson(res);
    if(!json.ok) throw new Error(json.message || 'Disko retornou erro.');
    return json;
  }

  function renderAgenda(diskoJson=null){
    ensureScreen(AGENDA_SCREEN,'agendaBoxV44');
    const c=cfg(); const manual=loadManual(); const days = Array.from({length:Number(c.agendaDays)||10},(_,i)=>addDays(c.start||todayIso(),i));
    const diskoDays = Array.isArray(diskoJson?.days) ? diskoJson.days : [];
    const rows = days.map(iso=>{
      const expected=expectedSlots(iso,c);
      const d=diskoDays.find(x=>x.date===iso);
      const diskoTimes = Array.from(new Set([...(d?.availableTimes||[]),...(d?.times||[])]));
      const man = manual.filter(x=>x.date===iso);
      const manualTimes = man.flatMap(x=>String(x.times||'').split(/[ ,;]+/).filter(Boolean));
      const times = Array.from(new Set([...diskoTimes,...manualTimes])).sort();
      const free = times.filter(t=>!expected.length || (mins(t)>=mins(expected[0]) && mins(t)<=mins(expected[expected.length-1]||'23:59')));
      const status = !expected.length ? 'Fechado' : free.length ? `${free.length} horário(s)` : (d ? 'Disko sem horários' : 'Não consultado');
      return `<tr><td><strong>${brDate(iso)}</strong><br><span class="muted">${week[dayObj(iso).getDay()]}</span></td><td>${esc(status)}</td><td><div class="v44slots">${free.slice(0,30).map(t=>`<span class="v44slot">${esc(t)}</span>`).join('') || '<span class="muted">Sem horários livres informados.</span>'}</div></td><td>${man.length?`<span class="v44badge ok">Manual</span>`:''} ${d?`<span class="v44badge">Disko</span>`:''}</td><td><a class="secondary-button small-button" target="_blank" rel="noopener" href="${esc(d?.url||c.diskoUrl||DEFAULT_DISKO)}">Abrir Disko</a></td></tr>`;
    }).join('');
    $('#agendaBoxV44').innerHTML = `<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Agenda futura</p><h3>Agenda Vazia para vender mais</h3><p class="muted">Tenta ler o Disko. Se o Disko não entregar horários, você lança manualmente os buracos e o sistema gera ação comercial.</p></div></div><div id="v44AgendaStatus" class="import-status warning">Disko costuma retornar a página sem horários legíveis. Use o botão abaixo e, se vier vazio, lance manualmente os horários.</div><div class="v44filters"><label>Link Disko<input id="v44DiskoUrl" value="${esc(c.diskoUrl||DEFAULT_DISKO)}"></label><label>Data inicial<input type="date" id="v44AgendaStart" value="${esc(c.start||todayIso())}"></label><label>Dias<input type="number" min="1" max="30" id="v44AgendaDays" value="${esc(c.agendaDays||10)}"></label><label>Intervalo<input type="number" min="15" step="15" id="v44Interval" value="${esc(c.interval||30)}"></label><button type="button" class="primary-button" id="v44ReadDisko">Ler Disko</button><button type="button" class="secondary-button" id="v44SaveAgendaCfg">Salvar agenda</button></div><details class="v44note"><summary>Lançar horário vazio manualmente</summary><div class="v44filters"><label>Data<input type="date" id="v44ManualDate" value="${esc(c.start||todayIso())}"></label><label>Profissional<input id="v44ManualProfessional" value="Emily"></label><label>Horários livres<input id="v44ManualTimes" placeholder="14:30 15:00 16:30"></label><label>Observação<input id="v44ManualNote" placeholder="ex.: tarde fraca"></label><button type="button" class="primary-button" id="v44AddManual">Adicionar</button></div></details><div class="v44card" style="margin-top:14px"><h4>Próximos dias</h4><table class="v44table"><thead><tr><th>Data</th><th>Status</th><th>Horários livres</th><th>Fonte</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div><div class="v44card" style="margin-top:14px"><h4>Mensagem para preencher agenda</h4><p class="muted">Use quando houver horário vazio da Emily.</p><button type="button" class="secondary-button v44Copy" data-msg="${esc('Oi! Temos alguns horários disponíveis essa semana com a Emily. Quer que eu veja um melhor horário para você cortar o cabelo?')}" >Copiar mensagem curta</button><button type="button" class="secondary-button v44Copy" data-msg="${esc('Passando para avisar que abrimos alguns horários essa semana. Se quiser manter o corte em dia, posso reservar um horário para você com a Emily.')}" >Copiar mensagem retorno</button></div></article>`;
    if(diskoJson){ const total = diskoDays.reduce((s,d)=>s+(d.times?.length||0)+(d.availableTimes?.length||0),0); const box=$('#v44AgendaStatus'); if(box){ box.className='import-status '+(total?'success':'warning'); box.textContent = total ? `Disko lido com ${total} horário(s).` : `Disko respondeu, mas não entregou horários legíveis. Use o lançamento manual para operar a agenda vazia.`; } }
  }

  document.addEventListener('click', async e=>{
    const nav=e.target.closest('.nav-link[data-screen]');
    if(nav && [FAT_SCREEN, AGENDA_SCREEN].includes(nav.dataset.screen)){ e.preventDefault(); e.stopImmediatePropagation(); show(nav.dataset.screen); return; }
    if(e.target.closest('#v44Sync')){ e.preventDefault(); try{ await syncHub(); }catch(err){ setStatus('Erro: '+(err.message||err),'err'); } }
    if(e.target.closest('#v44Apply')){ e.preventDefault(); setCfg({start:$('#v44Start')?.value||monthStart(), end:$('#v44End')?.value||todayIso(), dailyGoal:Number($('#v44DailyGoal')?.value||800)}); renderFaturamento(); }
    if(e.target.closest('.v44Copy')){ e.preventDefault(); const msg=e.target.closest('.v44Copy').dataset.msg||''; try{ await navigator.clipboard.writeText(msg); e.target.textContent='Copiado'; setTimeout(()=>e.target.textContent='Copiar',1200); }catch(_){ prompt('Copie a mensagem:', msg); } }
    if(e.target.closest('#v44SaveAgendaCfg')){ e.preventDefault(); setCfg({diskoUrl:$('#v44DiskoUrl')?.value||DEFAULT_DISKO, start:$('#v44AgendaStart')?.value||todayIso(), agendaDays:Number($('#v44AgendaDays')?.value||10), interval:Number($('#v44Interval')?.value||30)}); renderAgenda(); }
    if(e.target.closest('#v44ReadDisko')){ e.preventDefault(); const box=$('#v44AgendaStatus'); if(box){box.className='import-status warning';box.textContent='Lendo Disko...';} try{ setCfg({diskoUrl:$('#v44DiskoUrl')?.value||DEFAULT_DISKO, start:$('#v44AgendaStart')?.value||todayIso(), agendaDays:Number($('#v44AgendaDays')?.value||10), interval:Number($('#v44Interval')?.value||30)}); const json=await readDisko(); renderAgenda(json); }catch(err){ if(box){box.className='import-status error';box.textContent='Erro ao ler Disko: '+(err.message||err);} } }
    if(e.target.closest('#v44AddManual')){ e.preventDefault(); const list=loadManual(); list.push({date:$('#v44ManualDate')?.value||todayIso(), professional:$('#v44ManualProfessional')?.value||'Emily', times:$('#v44ManualTimes')?.value||'', note:$('#v44ManualNote')?.value||'', createdAt:new Date().toISOString()}); saveManual(list); renderAgenda(); }
  }, true);

  const oldSet = window.setScreen;
  if(typeof oldSet==='function') window.setScreen = function(id){ if([FAT_SCREEN,AGENDA_SCREEN].includes(id)){ show(id); return; } return oldSet.apply(this,arguments); };

  window.BarberDataHubV44 = loadHub();
  window.syncBarberDataHubV44 = syncHub;
  window.renderFaturamentoV44 = renderFaturamento;
  window.renderAgendaVaziaV44 = renderAgenda;

  setTimeout(()=>{ ensureAll(); bridgeState(loadHub()); }, 1500);
})();