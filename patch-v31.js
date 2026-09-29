/* v31 - Gestão completa: leitura direta da planilha, aba Atendimentos, gráficos e filtro por datas */
(function(){
  if (window.__gestaoV31) return;
  window.__gestaoV31 = true;

  const SHEET_ID = '1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc';
  const SCREEN = 'gestaoCompletaV31';
  const DATA_KEY = 'gestao_barber_sheets_data_v31';
  const FILTER_KEY = 'gestao_barber_date_filter_v31';
  const TAB_KEY = 'gestao_barber_tab_v31';
  const SHEETS = ['Config','Atendimentos','Vendas Produtos','Contas','Extrato','Conciliacao','Estoque','Mov Estoque','Equipe','Folha e Prolabore','DRE','Fluxo Caixa','Auditoria','Pacotes e Permutas'];
  const HIDE = new Set(['gestaoUnicaV28','managementUnifiedV27','managementAdvancedV17','workbookSyncV22','productSalesV21','stockControlV21','billsControlV21','closingDreV21','auditV21','customerRecoveryV26','cloudSync','paymentsCenterV17','packagesCenterV17','onlineBooking','automation','automation100','management']);
  const TABS = [['geral','Visão geral','📌'],['atendimentos','Atendimentos','🧾'],['planilha','Planilha','📊'],['produtos','Produtos','🧴'],['estoque','Estoque','📦'],['contas','Contas','🧾'],['dre','DRE / Fluxo','📈'],['auditoria','Auditoria','✅'],['clientes','Recuperar clientes','🎯']];

  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const money = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const num = v => { if (v==null || v==='') return 0; if (typeof v === 'number') return isFinite(v)?v:0; let s=String(v).replace(/R\$/gi,'').replace(/\s/g,''); const neg=/\(|-/.test(s); s=s.replace(/[()]/g,'').replace(/-/g,''); if (s.includes(',') && s.includes('.')) s=s.replace(/\./g,'').replace(',','.'); else if (s.includes(',')) s=s.replace(',','.'); const n=Number(s.replace(/[^0-9.]/g,'')); return isFinite(n) ? (neg ? -Math.abs(n) : n) : 0; };
  const today = () => new Date().toISOString().slice(0,10);
  const dObj = iso => new Date(`${iso || today()}T12:00:00`);
  const brDate = iso => { if(!iso) return '-'; const [y,m,d]=String(iso).slice(0,10).split('-'); return y&&m&&d ? `${d}/${m}/${y}` : String(iso); };
  const monthKey = d => String(d||'').slice(0,7);

  function parseDate(v){
    if(!v) return '';
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
    let s=String(v).trim();
    if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    let m=s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if(m){
      let a=Number(m[1]), b=Number(m[2]), y=Number(m[3]); if(y<100) y+=2000;
      let mm,dd;
      if(a>12){ dd=a; mm=b; } else if(b>12){ mm=a; dd=b; } else { mm=a; dd=b; }
      return `${y}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
    }
    return '';
  }

  function csvParse(text){
    const rows=[]; let row=[], cell='', q=false;
    text=String(text||'').replace(/^\uFEFF/,'');
    for(let i=0;i<text.length;i++){
      const c=text[i], n=text[i+1];
      if(q){ if(c==='"' && n==='"'){ cell+='"'; i++; } else if(c==='"') q=false; else cell+=c; }
      else { if(c==='"') q=true; else if(c===','){ row.push(cell); cell=''; } else if(c==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; } else if(c!=='\r') cell+=c; }
    }
    row.push(cell); rows.push(row);
    return rows.filter(r=>r.some(c=>String(c).trim()!==''));
  }

  function headerName(name, idx){
    const n=norm(name);
    if(idx===0 && n.includes('data')) return 'Data';
    if(n==='hora' || n.includes(' hora')) return 'Hora';
    if(n.includes('id atendimento')) return 'ID atendimento';
    if(n.includes('cliente')) return 'Cliente';
    if(n.includes('servico') || n.includes('serviço')) return 'Serviço';
    if(n.includes('profissional') || n.includes('colaborador')) return 'Profissional';
    if(n.includes('status')) return 'Status';
    if(n.includes('pagamento')) return 'Pagamento';
    if(n.includes('parcelas')) return 'Parcelas';
    if(n.includes('valor tabela')) return 'Valor tabela';
    if(n.includes('desconto')) return 'Desconto';
    if(n.includes('venda liquida') || n.includes('venda líquida')) return 'Venda líquida';
    if(n.includes('taxa r')) return 'Taxa R$';
    if(n.includes('liquido previsto') || n.includes('líquido previsto')) return 'Líquido previsto';
    if(n.includes('comissao r') || n.includes('comissão r')) return 'Comissão R$';
    if(n.includes('parte barbearia')) return 'Parte barbearia';
    if(n.includes('custo material')) return 'Custo material';
    if(n.includes('margem')) return 'Margem do atendimento';
    if(n.includes('data prevista')) return 'Data prevista';
    if(n.includes('conciliacao') || n.includes('conciliação')) return 'Conciliação';
    return String(name||'').trim() || `col_${idx}`;
  }

  function rowsToObjects(csv){
    const rows=csvParse(csv);
    if(!rows.length) return [];
    let headerIndex=0;
    for(let i=0;i<Math.min(rows.length,8);i++){
      const joined=norm(rows[i].join(' '));
      if(joined.includes('cliente') && (joined.includes('servico') || joined.includes('serviço') || joined.includes('pagamento'))){ headerIndex=i; break; }
    }
    const header=rows[headerIndex].map(headerName);
    return rows.slice(headerIndex+1).map(r=>{
      const o={}; header.forEach((h,i)=>o[h]=String(r[i]??'').trim()); return o;
    }).filter(o=>Object.values(o).some(v=>String(v).trim()!==''));
  }

  function parseAllSheets(sheets){
    const raw=sheets||{};
    const atend=rowsToObjects(raw['Atendimentos']||'').map((o,i)=>({
      id: o['ID atendimento'] || `sheet-${i}`,
      date: parseDate(o['Data']),
      time: o['Hora'] || '',
      client: o['Cliente'] || '',
      service: o['Serviço'] || 'Serviço',
      professional: o['Profissional'] || '',
      status: o['Status'] || '',
      payment: o['Pagamento'] || 'Não informado',
      parcels: o['Parcelas'] || '',
      tableValue: num(o['Valor tabela']),
      discount: num(o['Desconto']),
      sale: num(o['Venda líquida']) || num(o['Valor tabela']),
      fee: num(o['Taxa R$']),
      net: num(o['Líquido previsto']) || num(o['Venda líquida']) || num(o['Valor tabela']),
      commission: num(o['Comissão R$']),
      barberPart: num(o['Parte barbearia']),
      material: num(o['Custo material']),
      margin: num(o['Margem do atendimento']),
      forecastDate: parseDate(o['Data prevista']),
      reconcile: o['Conciliação'] || ''
    })).filter(r=>r.date && r.client && !/cancelado|ausencia|ausência/i.test(r.status));

    const products=rowsToObjects(raw['Vendas Produtos']||'').map((o,i)=>{
      const keys=Object.keys(o); const get=(names)=>{for(const name of names){const k=keys.find(x=>norm(x).includes(norm(name))); if(k) return o[k];} return '';};
      return { id:`prod-${i}`, date:parseDate(get(['data'])), product:get(['produto','item','descrição','descricao'])||'Produto', qty:num(get(['qtd','quantidade'])), total:num(get(['total','valor','venda'])) };
    }).filter(x=>x.date||x.product!=='Produto'||x.total);

    const bills=rowsToObjects(raw['Contas']||'').map((o,i)=>{
      const keys=Object.keys(o); const get=(names)=>{for(const name of names){const k=keys.find(x=>norm(x).includes(norm(name))); if(k) return o[k];} return '';};
      return { id:`bill-${i}`, date:parseDate(get(['data','vencimento','pagamento'])), category:get(['categoria','tipo'])||'Conta', description:get(['descricao','descrição','conta','fornecedor'])||'Conta', value:num(get(['valor','pago','total'])) };
    }).filter(x=>x.date||x.value||x.description!=='Conta');

    const stock=rowsToObjects(raw['Estoque']||'').map((o,i)=>{
      const keys=Object.keys(o); const get=(names)=>{for(const name of names){const k=keys.find(x=>norm(x).includes(norm(name))); if(k) return o[k];} return '';};
      return { id:`stock-${i}`, item:get(['produto','item','insumo','nome'])||'Item', current:num(get(['atual','saldo','estoque','quantidade'])), min:num(get(['minimo','mínimo','estoque minimo']))||5, cost:num(get(['custo','valor'])) };
    }).filter(x=>x.item!=='Item'||x.current||x.cost);

    return {raw, atend, products, bills, stock, updatedAt:new Date().toISOString()};
  }

  function saveData(data){ localStorage.setItem(DATA_KEY, JSON.stringify(data)); }
  function getData(){ try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')}catch(e){return {}} }
  function filter(){ try{return JSON.parse(localStorage.getItem(FILTER_KEY)||'{}')}catch(e){return {}} }
  function setFilter(f){ localStorage.setItem(FILTER_KEY, JSON.stringify({...filter(),...f})); }
  function activeTab(){ const t=localStorage.getItem(TAB_KEY)||'geral'; return TABS.some(x=>x[0]===t)?t:'geral'; }
  function setTab(t){ localStorage.setItem(TAB_KEY,t); render(); }

  function dateRange(atend){
    const ds=atend.map(r=>r.date).filter(Boolean).sort();
    const f=filter();
    if(!ds.length) return {start:f.start||'', end:f.end||''};
    const last=ds[ds.length-1]; const defaultStart=`${last.slice(0,7)}-01`;
    return {start:f.start||defaultStart, end:f.end||last};
  }
  function inRange(date,start,end){ if(!date) return false; if(start && date<start) return false; if(end && date>end) return false; return true; }
  function scoped(){ const data=getData(); const all=data.atend||[]; const r=dateRange(all); return {...data, range:r, atendFiltered:all.filter(x=>inRange(x.date,r.start,r.end)), productsFiltered:(data.products||[]).filter(x=>!x.date||inRange(x.date,r.start,r.end)), billsFiltered:(data.bills||[]).filter(x=>!x.date||inRange(x.date,r.start,r.end))}; }

  function group(rows, key, val){ const m=new Map(); rows.forEach(r=>{const k=key(r)||'Sem informação'; m.set(k,(m.get(k)||0)+(val?val(r):1));}); return [...m.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value); }
  function uniq(rows,key){ return new Set(rows.map(key).filter(Boolean).map(norm)).size; }
  function daily(rows){ const arr=group(rows,r=>r.date,r=>r.sale).sort((a,b)=>a.label.localeCompare(b.label)); return arr; }
  function weekday(rows){ const w=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']; const m=new Map(); rows.forEach(r=>{const d=new Date(`${r.date}T12:00:00`).getDay(); const it=m.get(d)||{label:w[d],value:0}; it.value++; m.set(d,it);}); return [0,1,2,3,4,5,6].map(i=>m.get(i)||{label:w[i],value:0}); }
  function inactive(rows){ const m=new Map(); rows.forEach(r=>{const k=norm(r.client); if(!k)return; const it=m.get(k)||{client:r.client,last:r.date,count:0,total:0,service:r.service}; it.count++; it.total+=r.sale; if(r.date>it.last){it.last=r.date; it.service=r.service;} m.set(k,it);}); return [...m.values()].map(x=>({...x,days:Math.max(0,Math.floor((new Date(today())-new Date(x.last))/86400000))})).filter(x=>x.days>=30).sort((a,b)=>b.days-a.days); }

  function css(){ if($('#gestaoV31Css'))return; const st=document.createElement('style'); st.id='gestaoV31Css'; st.textContent=`.v31-hidden{display:none!important}.v31-datebar{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:12px 0 16px}.v31-datebar label{display:grid;gap:5px;color:var(--muted);font-size:.82rem}.v31-datebar input{min-width:160px}.v31-tabs{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 14px}.v31-tab{border:1px solid var(--line);background:rgba(255,255,255,.06);color:var(--text);padding:10px 13px;border-radius:999px;font-weight:850}.v31-tab.active{background:linear-gradient(145deg,#ffe7a8,var(--gold-strong),var(--gold));color:#171007}.v31-grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.v31-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.v31-two{display:grid;grid-template-columns:1.15fr .85fr;gap:14px}.v31-card{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.055);padding:16px;box-shadow:var(--shadow-soft)}.v31-card h4{margin:0 0 8px}.v31-kpi span{display:block;color:var(--muted);font-size:.82rem}.v31-kpi strong{display:block;font-size:1.55rem;margin:7px 0 2px}.v31-kpi small{color:var(--muted)}.v31-bars{display:grid;gap:10px}.v31-bar{display:grid;grid-template-columns:135px 1fr 88px;gap:10px;align-items:center}.v31-bar span{color:var(--muted);font-size:.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v31-bar div{height:13px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid var(--line);overflow:hidden}.v31-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold-strong));border-radius:999px}.v31-bar b{text-align:right;font-size:.82rem}.v31-line{width:100%;height:210px;color:var(--gold-strong);background:rgba(255,255,255,.035);border:1px solid var(--line);border-radius:20px}.v31-line circle{fill:var(--gold-strong)}.v31-line text{fill:var(--muted);font-size:12px}.v31-mini{height:190px;display:flex;align-items:end;gap:8px}.v31-col{flex:1;display:grid;grid-template-rows:1fr auto;gap:7px;text-align:center;height:100%}.v31-col i{align-self:end;display:block;min-height:5px;border-radius:12px 12px 5px 5px;background:linear-gradient(180deg,var(--gold-strong),var(--orange))}.v31-col span{font-size:.72rem;color:var(--muted)}.v31-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:18px}.v31-table{width:100%;border-collapse:collapse;min-width:860px}.v31-table th,.v31-table td{padding:10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.v31-table th{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.v31-badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,211,109,.12);border:1px solid rgba(255,211,109,.25);color:#ffe7a8;font-size:.76rem;font-weight:850}.v31-badge.bad{background:rgba(255,104,104,.12);border-color:rgba(255,104,104,.25);color:#ffd1d1}.v31-badge.good{background:rgba(87,214,137,.12);border-color:rgba(87,214,137,.25);color:#c9ffd9}.v31-empty{padding:22px;border:1px dashed var(--line);border-radius:18px;color:var(--muted);text-align:center}.v31-muted{color:var(--muted)}@media(max-width:1150px){.v31-grid4,.v31-grid3,.v31-two{grid-template-columns:1fr}.v31-bar{grid-template-columns:100px 1fr 70px}}`; document.head.appendChild(st); }

  function bars(rows, opts={}){ if(!rows.length) return '<div class="v31-empty">Sem dados para exibir.</div>'; const max=Math.max(1,...rows.map(r=>Math.abs(r.value||0))); return `<div class="v31-bars">${rows.map(r=>`<div class="v31-bar"><span>${esc(r.label)}</span><div><i style="width:${Math.max(2,Math.abs(r.value||0)/max*100)}%"></i></div><b>${opts.money?money(r.value):Math.round(r.value||0)}</b></div>`).join('')}</div>`; }
  function mini(rows){ if(!rows.length) return '<div class="v31-empty">Sem dados.</div>'; const max=Math.max(1,...rows.map(r=>Math.abs(r.value||0))); return `<div class="v31-mini">${rows.map(r=>`<div class="v31-col"><i style="height:${Math.max(5,Math.abs(r.value||0)/max*100)}%"></i><span>${esc(String(r.label).slice(5)||r.label)}</span></div>`).join('')}</div>`; }
  function line(rows){ if(!rows.length) return '<div class="v31-empty">Sem dados para gráfico.</div>'; const w=720,h=190,p=28,max=Math.max(1,...rows.map(r=>r.value)),min=Math.min(0,...rows.map(r=>r.value)); const pts=rows.map((r,i)=>{const x=p+(i/(Math.max(1,rows.length-1)))*(w-p*2); const y=h-p-((r.value-min)/(max-min||1))*(h-p*2); return `${x},${y}`;}).join(' '); return `<svg class="v31-line" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>${rows.map((r,i)=>{const x=p+(i/(Math.max(1,rows.length-1)))*(w-p*2); const y=h-p-((r.value-min)/(max-min||1))*(h-p*2); return `<circle cx="${x}" cy="${y}" r="4"></circle>`}).join('')}<text x="${p}" y="${h-6}">${esc(brDate(rows[0].label).slice(0,5))}</text><text x="${w-p-40}" y="${h-6}">${esc(brDate(rows[rows.length-1].label).slice(0,5))}</text></svg>`; }

  function shell(content){ const data=getData(), sc=scoped(), total=data.atend?.length||0, range=sc.range; return `<article class="panel wide-panel"><div class="panel-header split-header"><div><p class="eyebrow">Central única</p><h3>Gestão da Barbearia</h3><p class="muted">Tudo em uma tela: atendimentos, planilha, produtos, estoque, contas, DRE, auditoria e recuperação de clientes.</p></div><div class="toolbar-row compact"><button type="button" class="primary-button" id="v31Sync">Ler planilha agora</button><button type="button" class="secondary-button" id="v31Refresh">Atualizar</button></div></div><div id="v31Status" class="import-status ${total?'success':'warning'}">${total?`Planilha carregada: ${total} atendimento(s). Período atual: ${brDate(range.start)} a ${brDate(range.end)}.`:'Clique em “Ler planilha agora” para puxar os dados.'}</div><div class="v31-datebar"><label>Data inicial<input type="date" id="v31Start" value="${esc(range.start||'')}"></label><label>Data final<input type="date" id="v31End" value="${esc(range.end||'')}"></label><button type="button" class="primary-button" id="v31ApplyDates">Aplicar período</button><button type="button" class="secondary-button" id="v31ClearDates">Limpar filtro</button><span class="v31-muted">${sc.atendFiltered.length} atendimento(s) no período</span></div><div class="v31-tabs">${TABS.map(t=>`<button type="button" class="v31-tab ${activeTab()===t[0]?'active':''}" data-v31tab="${t[0]}">${t[2]} ${t[1]}</button>`).join('')}</div><div id="v31Body">${content}</div></article>`; }

  function renderKpis(sc){ const rows=sc.atendFiltered, revenue=rows.reduce((s,r)=>s+r.sale,0), prod=sc.productsFiltered.reduce((s,r)=>s+r.total,0), bills=sc.billsFiltered.reduce((s,r)=>s+r.value,0), clients=uniq(rows,r=>r.client), ticket=rows.length?revenue/rows.length:0, profit=revenue+prod-bills; return `<div class="v31-grid4"><div class="v31-card v31-kpi"><span>Faturamento serviços</span><strong>${money(revenue)}</strong><small>${rows.length} atendimento(s)</small></div><div class="v31-card v31-kpi"><span>Clientes atendidos</span><strong>${clients}</strong><small>No período selecionado</small></div><div class="v31-card v31-kpi"><span>Ticket médio</span><strong>${money(ticket)}</strong><small>Serviços</small></div><div class="v31-card v31-kpi"><span>Resultado estimado</span><strong>${money(profit)}</strong><small>Serviços + produtos - contas</small></div></div>`; }
  function viewGeral(){ const sc=scoped(), rows=sc.atendFiltered; return `${renderKpis(sc)}<div class="v31-two" style="margin-top:14px"><div class="v31-card"><h4>Faturamento por dia</h4>${line(daily(rows))}</div><div class="v31-card"><h4>Atendimentos por dia da semana</h4>${mini(weekday(rows))}</div></div><div class="v31-grid3" style="margin-top:14px"><div class="v31-card"><h4>Serviços mais vendidos</h4>${bars(group(rows,r=>r.service,r=>1).slice(0,8))}</div><div class="v31-card"><h4>Formas de pagamento</h4>${bars(group(rows,r=>r.payment,r=>r.sale).slice(0,8),{money:true})}</div><div class="v31-card"><h4>Profissionais</h4>${bars(group(rows,r=>r.professional||'Não informado',r=>r.sale).slice(0,8),{money:true})}</div></div>`; }
  function viewAtendimentos(){ const rows=scoped().atendFiltered.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)); return `<div class="v31-card"><h4>Atendimentos no período</h4><div class="v31-table-wrap"><table class="v31-table"><thead><tr><th>Data</th><th>Hora</th><th>Cliente</th><th>Serviço</th><th>Profissional</th><th>Pagamento</th><th>Venda</th><th>Status</th><th>Conciliação</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${brDate(r.date)}</td><td>${esc(r.time)}</td><td><strong>${esc(r.client)}</strong></td><td>${esc(r.service)}</td><td>${esc(r.professional)}</td><td>${esc(r.payment)}</td><td>${money(r.sale)}</td><td>${esc(r.status)}</td><td>${esc(r.reconcile)}</td></tr>`).join(''):'<tr><td colspan="9" class="v31-empty">Sem atendimentos no período selecionado.</td></tr>'}</tbody></table></div></div>`; }
  function viewPlanilha(){ const d=getData(); const raw=d.raw||{}; return `<div class="v31-grid3"><div class="v31-card v31-kpi"><span>Abas lidas</span><strong>${Object.keys(raw).length}</strong><small>${Object.keys(raw).join(', ')||'Nenhuma'}</small></div><div class="v31-card v31-kpi"><span>Atendimentos importados</span><strong>${d.atend?.length||0}</strong><small>Total da aba Atendimentos</small></div><div class="v31-card v31-kpi"><span>Última leitura</span><strong>${d.updatedAt?new Date(d.updatedAt).toLocaleTimeString('pt-BR'):'-'}</strong><small>${d.updatedAt?new Date(d.updatedAt).toLocaleDateString('pt-BR'):'Ainda não lido'}</small></div></div><div class="v31-card" style="margin-top:14px"><h4>Status</h4><p class="v31-muted">Use “Ler planilha agora” sempre que alterar a planilha no Google Sheets. O período selecionado filtra todos os gráficos e a aba Atendimentos.</p></div>`; }
  function viewProdutos(){ const sc=scoped(), rows=sc.productsFiltered; return `<div class="v31-two"><div class="v31-card"><h4>Produtos mais vendidos</h4>${bars(group(rows,r=>r.product,r=>r.total||r.qty).slice(0,10),{money:true})}</div><div class="v31-card v31-kpi"><span>Total produtos</span><strong>${money(rows.reduce((s,r)=>s+r.total,0))}</strong><small>${rows.length} lançamento(s)</small></div></div>`; }
  function viewEstoque(){ const d=getData(), rows=d.stock||[], low=rows.filter(x=>x.current<=x.min); return `<div class="v31-grid3"><div class="v31-card v31-kpi"><span>Itens cadastrados</span><strong>${rows.length}</strong></div><div class="v31-card v31-kpi"><span>Estoque baixo</span><strong>${low.length}</strong></div><div class="v31-card v31-kpi"><span>Valor em estoque</span><strong>${money(rows.reduce((s,r)=>s+(r.current*r.cost),0))}</strong></div></div><div class="v31-card" style="margin-top:14px"><h4>Itens em atenção</h4><div class="v31-table-wrap"><table class="v31-table"><thead><tr><th>Item</th><th>Atual</th><th>Mínimo</th><th>Status</th></tr></thead><tbody>${low.length?low.map(r=>`<tr><td>${esc(r.item)}</td><td>${r.current}</td><td>${r.min}</td><td><span class="v31-badge bad">Comprar</span></td></tr>`).join(''):'<tr><td colspan="4" class="v31-empty">Nenhum item abaixo do mínimo.</td></tr>'}</tbody></table></div></div>`; }
  function viewContas(){ const rows=scoped().billsFiltered; return `<div class="v31-two"><div class="v31-card"><h4>Contas por categoria</h4>${bars(group(rows,r=>r.category,r=>r.value).slice(0,10),{money:true})}</div><div class="v31-card"><h4>Últimas contas</h4><div class="v31-table-wrap"><table class="v31-table"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${rows.length?rows.slice(0,20).map(r=>`<tr><td>${brDate(r.date)}</td><td>${esc(r.description)}</td><td>${esc(r.category)}</td><td>${money(r.value)}</td></tr>`).join(''):'<tr><td colspan="4" class="v31-empty">Sem contas no período.</td></tr>'}</tbody></table></div></div></div>`; }
  function viewDre(){ const sc=scoped(), serv=sc.atendFiltered.reduce((s,r)=>s+r.sale,0), prod=sc.productsFiltered.reduce((s,r)=>s+r.total,0), costs=sc.billsFiltered.reduce((s,r)=>s+r.value,0), result=serv+prod-costs; return `<div class="v31-grid4"><div class="v31-card v31-kpi"><span>Receita serviços</span><strong>${money(serv)}</strong></div><div class="v31-card v31-kpi"><span>Receita produtos</span><strong>${money(prod)}</strong></div><div class="v31-card v31-kpi"><span>Contas/custos</span><strong>${money(costs)}</strong></div><div class="v31-card v31-kpi"><span>Resultado</span><strong>${money(result)}</strong></div></div><div class="v31-card" style="margin-top:14px"><h4>DRE visual</h4>${bars([{label:'Serviços',value:serv},{label:'Produtos',value:prod},{label:'Contas',value:costs},{label:'Resultado',value:result}],{money:true})}</div>`; }
  function viewAuditoria(){ const sc=scoped(), pending=sc.atendFiltered.filter(r=>/pendente|forma nao|forma não|nao encontrado|não encontrado/i.test(`${r.reconcile} ${r.payment}`)); const noPay=sc.atendFiltered.filter(r=>!r.payment||/nao informado|não informado/i.test(r.payment)); const noId=sc.atendFiltered.filter(r=>!r.id||String(r.id).startsWith('sheet-')); return `<div class="v31-grid3"><div class="v31-card v31-kpi"><span>Pendências</span><strong>${pending.length}</strong></div><div class="v31-card v31-kpi"><span>Sem pagamento</span><strong>${noPay.length}</strong></div><div class="v31-card v31-kpi"><span>Sem ID original</span><strong>${noId.length}</strong></div></div><div class="v31-card" style="margin-top:14px"><h4>Itens para conferir</h4><div class="v31-table-wrap"><table class="v31-table"><thead><tr><th>Data</th><th>Cliente</th><th>Problema</th><th>Valor</th></tr></thead><tbody>${pending.concat(noPay).slice(0,30).map(r=>`<tr><td>${brDate(r.date)}</td><td>${esc(r.client)}</td><td>${esc(r.reconcile||r.payment||'Conferir')}</td><td>${money(r.sale)}</td></tr>`).join('') || '<tr><td colspan="4" class="v31-empty">Sem alertas principais.</td></tr>'}</tbody></table></div></div>`; }
  function viewClientes(){ const data=getData(), all=data.atend||[], rows=inactive(all); return `<div class="v31-card"><h4>Clientes para recuperar</h4><div class="v31-table-wrap"><table class="v31-table"><thead><tr><th>Cliente</th><th>Última visita</th><th>Dias sem voltar</th><th>Serviço provável</th><th>Mensagem</th></tr></thead><tbody>${rows.length?rows.slice(0,60).map(r=>{const msg=`Oi, ${r.client}! Tudo bem? Aqui é da Barbearia da Taíse. Vi que já faz um tempinho desde seu último atendimento de ${r.service}. Essa semana abrimos horários e posso reservar um para você. Nos dias mais tranquilos teremos um brinde especial.`; return `<tr><td><strong>${esc(r.client)}</strong></td><td>${brDate(r.last)}</td><td><span class="v31-badge ${r.days>=60?'bad':''}">${r.days} dias</span></td><td>${esc(r.service)}</td><td><button class="secondary-button small-button" data-v31copy="${esc(msg)}">Copiar</button></td></tr>`}).join(''):'<tr><td colspan="5" class="v31-empty">Sem clientes acima de 30 dias sem voltar.</td></tr>'}</tbody></table></div></div>`; }

  function currentView(){ const t=activeTab(); if(t==='atendimentos')return viewAtendimentos(); if(t==='planilha')return viewPlanilha(); if(t==='produtos')return viewProdutos(); if(t==='estoque')return viewEstoque(); if(t==='contas')return viewContas(); if(t==='dre')return viewDre(); if(t==='auditoria')return viewAuditoria(); if(t==='clientes')return viewClientes(); return viewGeral(); }

  function ensure(){ css(); let s=$('#'+SCREEN); if(!s){ s=document.createElement('section'); s.id=SCREEN; s.className='screen'; s.innerHTML='<div id="gestaoV31"></div>'; $('.content')?.appendChild(s); }
    let nav=$(`.nav-link[data-screen="${SCREEN}"]`); if(!nav){ nav=document.createElement('button'); nav.type='button'; nav.className='nav-link'; nav.dataset.screen=SCREEN; nav.innerHTML='<span>📊</span>Gestão'; const before=$('.nav-link[data-screen="clients"]'); if(before?.parentElement) before.parentElement.insertBefore(nav,before); else $('.nav')?.appendChild(nav); }
    $$('.nav-link[data-screen]').forEach(b=>{ if(HIDE.has(b.dataset.screen)){ b.classList.add('v31-hidden'); b.style.display='none'; } });
    nav.style.display='flex'; nav.classList.remove('v31-hidden'); nav.innerHTML='<span>📊</span>Gestão'; return s; }
  function openGestao(){ ensure(); $$('.screen').forEach(x=>x.classList.remove('active')); $('#'+SCREEN)?.classList.add('active'); $$('.nav-link[data-screen]').forEach(x=>x.classList.remove('active')); $(`.nav-link[data-screen="${SCREEN}"]`)?.classList.add('active'); const title=$('#pageTitle'); if(title) title.textContent='Gestão'; render(); }
  function render(){ ensure(); const host=$('#gestaoV31'); if(host) host.innerHTML=shell(currentView()); }

  async function sync(){ const box=$('#v31Status'); if(box){box.className='import-status warning'; box.textContent='Lendo Google Sheets...';}
    try{ const url=`/.netlify/functions/sheets-proxy?spreadsheetId=${encodeURIComponent(SHEET_ID)}&sheets=${encodeURIComponent(SHEETS.join(','))}`; const res=await fetch(url,{cache:'no-store'}); const json=await res.json(); if(!json.ok && !json.sheets) throw new Error(json.message||'A função não retornou dados.'); const data=parseAllSheets(json.sheets||{}); saveData(data);
      if(!window.state) window.state={}; window.state.records=data.atend.map(r=>({id:r.id,date:r.date,time:r.time,clientName:r.client,serviceName:r.service,professionalName:r.professional,status:r.status,paymentMethod:r.payment,saleValue:r.sale,netValue:r.net,commissionValue:r.commission,materialCost:r.material}));
      try{ if(typeof saveState==='function') saveState(); }catch(e){}
      render(); const b=$('#v31Status'); if(b){b.className=data.atend.length?'import-status success':'import-status warning'; b.textContent=data.atend.length?`Planilha lida com sucesso: ${data.atend.length} atendimento(s), ${data.products.length} produto(s), ${data.bills.length} conta(s), ${data.stock.length} item(ns) de estoque.`:'A planilha respondeu, mas não encontrei atendimentos. Confira cabeçalhos da aba Atendimentos.';}
    }catch(e){ const b=$('#v31Status'); if(b){b.className='import-status error'; b.textContent=`Erro ao ler planilha: ${e.message||e}`;} console.error(e); }
  }

  document.addEventListener('click', e=>{ const nav=e.target.closest(`.nav-link[data-screen="${SCREEN}"], .nav-link[data-screen="gestaoUnicaV28"], .nav-link[data-screen="managementUnifiedV27"]`); if(nav){ e.preventDefault(); e.stopPropagation(); return openGestao(); } const tab=e.target.closest('[data-v31tab]'); if(tab){ e.preventDefault(); return setTab(tab.dataset.v31tab); } if(e.target.closest('#v31Sync')){ e.preventDefault(); return sync(); } if(e.target.closest('#v31Refresh')){ e.preventDefault(); return render(); } if(e.target.closest('#v31ApplyDates')){ e.preventDefault(); setFilter({start:$('#v31Start')?.value||'', end:$('#v31End')?.value||''}); return render(); } if(e.target.closest('#v31ClearDates')){ e.preventDefault(); localStorage.removeItem(FILTER_KEY); return render(); } const cp=e.target.closest('[data-v31copy]'); if(cp){ navigator.clipboard?.writeText(cp.dataset.v31copy||''); try{ if(typeof showToast==='function') showToast('Mensagem copiada.'); }catch(_){} } }, true);

  const oldSet=window.setScreen; if(typeof oldSet==='function'){ window.setScreen=function(id){ if(id===SCREEN || id==='gestaoUnicaV28' || id==='managementUnifiedV27') { openGestao(); return; } return oldSet.apply(this,arguments); }; }
  setTimeout(()=>{ ensure(); render(); }, 700);
  setTimeout(()=>{ ensure(); render(); }, 1800);
})();
