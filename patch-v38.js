/* v38 - Integração central limpa: planilha -> state, relatórios e colaboradores */
(function(){
  if (window.__sheetCoreV38) return;
  window.__sheetCoreV38 = true;

  // Neutraliza rotinas antigas que mexiam em relatórios/datas.
  window.__relatoriosPlanilhaV34 = true;
  window.__reportsDateFixV35 = true;
  window.__reportsDateFixV36 = true;
  window.__reportsCleanV37 = true;

  const SHEET_ID = '1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc';
  const STORAGE_KEY = 'barber_sheet_core_v38';
  const SHEETS = ['Atendimentos','Equipe','Vendas Produtos','Contas','Extrato','Conciliacao','Estoque','Mov Estoque','Folha e Prolabore','Pacotes e Permutas','Config'];
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  let lastSync = null;
  let syncing = false;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function normKey(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function val(row, names){
    for(const n of names){
      if(row[n] != null && String(row[n]).trim() !== '') return row[n];
      const wanted = normKey(n);
      const k = Object.keys(row).find(x=>normKey(x)===wanted);
      if(k && row[k] != null && String(row[k]).trim() !== '') return row[k];
    }
    return '';
  }
  function money(v){
    if(v==null || v==='' || v==='-') return 0;
    if(typeof v==='number') return Number.isFinite(v)?v:0;
    let s=String(v).trim();
    const neg=/^\(.*\)$/.test(s) || /^-/.test(s);
    s=s.replace(/[()]/g,'').replace(/R\$/gi,'').replace(/%/g,'').replace(/\s/g,'');
    if(s.includes(',') && s.includes('.')) s=s.replace(/\./g,'').replace(',','.');
    else if(s.includes(',')) s=s.replace(',','.');
    const n=Number(s.replace(/[^0-9.]/g,''));
    return Number.isFinite(n) ? (neg ? -Math.abs(n) : n) : 0;
  }
  function percent(v){
    const n = money(v);
    if(!n) return 0;
    return n > 1 ? n/100 : n;
  }
  function parseDateParts(v){
    const raw=String(v||'').trim();
    if(!raw) return null;
    if(/^\d{4}-\d{2}-\d{2}/.test(raw)){
      const [y,m,d]=raw.slice(0,10).split('-').map(Number);
      return {y,m,d};
    }
    const m=raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if(!m) return null;
    let a=Number(m[1]), b=Number(m[2]), y=Number(m[3]);
    if(y<100) y+=2000;
    let month, day;
    // Google Sheets no retorno atual vem como M/D/YYYY: 9/29/2026.
    if(b>12){ month=a; day=b; }
    else if(a>12){ day=a; month=b; }
    else { month=a; day=b; }
    if(!y || !month || !day) return null;
    return {y, m:month, d:day};
  }
  function dateInfo(v){
    const p=parseDateParts(v);
    if(!p) return {iso:'', noon:'', display:''};
    const iso=`${p.y}-${String(p.m).padStart(2,'0')}-${String(p.d).padStart(2,'0')}`;
    return { iso, noon:`${iso}T12:00:00`, display:`${String(p.d).padStart(2,'0')}/${String(p.m).padStart(2,'0')}/${p.y}` };
  }
  function parseCsv(text){
    const rows=[]; let row=[], cell='', q=false;
    const str=String(text||'');
    for(let i=0;i<str.length;i++){
      const c=str[i], n=str[i+1];
      if(q){
        if(c==='"'&&n==='"'){cell+='"';i++;}
        else if(c==='"') q=false;
        else cell+=c;
      } else {
        if(c==='"') q=true;
        else if(c===','){row.push(cell); cell='';}
        else if(c==='\n'){row.push(cell); rows.push(row); row=[]; cell='';}
        else if(c!=='\r') cell+=c;
      }
    }
    row.push(cell); rows.push(row);
    return rows.filter(r=>r.some(c=>String(c||'').trim()!==''));
  }
  function findHeader(rows, required){
    const req=required.map(normKey);
    return rows.findIndex(r=>{
      const keys=r.map(normKey);
      return req.every(x=>keys.includes(x));
    });
  }
  function csvObjects(csv, required){
    const rows=parseCsv(csv);
    const i=findHeader(rows, required);
    if(i<0) return [];
    const headers=rows[i].map(h=>String(h||'').trim());
    return rows.slice(i+1).map(r=>{
      const o={}; headers.forEach((h,j)=>{ if(h) o[h]=r[j]??''; }); return o;
    }).filter(o=>Object.values(o).some(x=>String(x||'').trim()!==''));
  }
  function sheetCsv(payload, name){
    const sources=[payload?.sheets, payload?.result, payload?.data];
    for(const src of sources){
      if(src && typeof src[name]==='string') return src[name];
      if(src && src[name] && typeof src[name].csv==='string') return src[name].csv;
    }
    return '';
  }

  function mapAttendance(o, idx){
    const di=dateInfo(val(o,['Data']));
    const pi=dateInfo(val(o,['Data prevista']));
    const id=String(val(o,['ID atendimento']) || `GS-${idx+1}`).trim();
    const venda=money(val(o,['Venda líquida','Venda liquida']));
    const rec={
      id, source:'Google Sheets', sheetSource:'Atendimentos', importedBy:'v38',
      date:di.noon, data:di.noon, dateISO:di.iso, dataISO:di.iso, displayDate:di.display,
      time:String(val(o,['Hora'])).trim(), hora:String(val(o,['Hora'])).trim(),
      appointmentId:id, scheduleId:id,
      clientName:String(val(o,['Cliente'])).trim(), cliente:String(val(o,['Cliente'])).trim(),
      serviceName:String(val(o,['Serviço','Servico'])).trim(), servico:String(val(o,['Serviço','Servico'])).trim(),
      collaboratorName:String(val(o,['Profissional','Colaborador'])).trim(), professionalName:String(val(o,['Profissional','Colaborador'])).trim(), profissional:String(val(o,['Profissional','Colaborador'])).trim(),
      status:String(val(o,['Status'])).trim() || 'Atendido',
      paymentMethod:String(val(o,['Pagamento'])).trim() || 'Não informado', pagamento:String(val(o,['Pagamento'])).trim() || 'Não informado',
      installments:money(val(o,['Parcelas'])) || 1,
      tableValue:money(val(o,['Valor tabela'])), valorTabela:money(val(o,['Valor tabela'])),
      discount:money(val(o,['Desconto'])), desconto:money(val(o,['Desconto'])),
      saleValue:venda, netSale:venda, vendaLiquida:venda, valor:venda,
      feePercent:String(val(o,['Taxa %'])).trim(), feeValue:money(val(o,['Taxa R$'])), taxa:money(val(o,['Taxa R$'])),
      expectedNet:money(val(o,['Líquido previsto','Liquido previsto'])), liquidoPrevisto:money(val(o,['Líquido previsto','Liquido previsto'])),
      commissionPercent:String(val(o,['Comissão %','Comissao %'])).trim(), commissionRate:percent(val(o,['Comissão %','Comissao %'])),
      commissionValue:money(val(o,['Comissão R$','Comissao R$'])), comissao:money(val(o,['Comissão R$','Comissao R$'])),
      barbershopShare:money(val(o,['Parte barbearia'])), parteBarbearia:money(val(o,['Parte barbearia'])),
      materialCost:money(val(o,['Custo material'])), custoMaterial:money(val(o,['Custo material'])),
      margin:money(val(o,['Margem do atendimento'])), margem:money(val(o,['Margem do atendimento'])),
      expectedDate:pi.noon, expectedDateISO:pi.iso, expectedDisplayDate:pi.display,
      extractId:String(val(o,['ID extrato'])).trim(),
      reconciliation:String(val(o,['Conciliação','Conciliacao'])).trim(), conciliacao:String(val(o,['Conciliação','Conciliacao'])).trim(),
      financial:venda>0,
      raw:o
    };
    return rec;
  }
  function mapCollaborator(o, idx){
    const start=dateInfo(val(o,['Data início','Data inicio']));
    const end=dateInfo(val(o,['Data fim']));
    const name=String(val(o,['Profissional','Nome','Colaborador'])).trim();
    return {
      id:`COL-${name || idx+1}`.replace(/\s+/g,'-').toUpperCase(),
      source:'Google Sheets', sheetSource:'Equipe', importedBy:'v38',
      name, nome:name, professionalName:name, profissional:name,
      role:String(val(o,['Função','Funcao'])).trim(), funcao:String(val(o,['Função','Funcao'])).trim(),
      type:String(val(o,['Vínculo','Vinculo'])).trim(), vinculo:String(val(o,['Vínculo','Vinculo'])).trim(),
      startDate:start.noon, startDateISO:start.iso, dataInicio:start.noon,
      endDate:end.noon, endDateISO:end.iso, dataFim:end.noon,
      active:/^(sim|s|ativo|true|1)$/i.test(String(val(o,['Ativo?','Ativo'])).trim()),
      ativo:/^(sim|s|ativo|true|1)$/i.test(String(val(o,['Ativo?','Ativo'])).trim()),
      commissionRate:percent(val(o,['Comissão %','Comissao %'])), commissionPercent:String(val(o,['Comissão %','Comissao %'])).trim(),
      salary:money(val(o,['Salário/Pró-labore','Salario/Pro-labore','Salário','Pro-labore','Pró-labore'])),
      pixKey:String(val(o,['Chave Pix'])).trim(), chavePix:String(val(o,['Chave Pix'])).trim(),
      notes:String(val(o,['Observações','Observacoes'])).trim(), observacoes:String(val(o,['Observações','Observacoes'])).trim(),
      raw:o
    };
  }

  function cleanImported(arr, sheet){
    return (Array.isArray(arr)?arr:[]).filter(x=>!(x && (x.source==='Google Sheets' || x.importedBy==='v38') && (!sheet || x.sheetSource===sheet)));
  }
  function writeState(data){
    window.state = window.state || {};
    const records = data.Atendimentos.map(mapAttendance).filter(r=>r.dateISO && r.clientName);
    const collaborators = data.Equipe.map(mapCollaborator).filter(c=>c.name);

    window.state.records = cleanImported(window.state.records, 'Atendimentos').concat(records);
    window.state.attendances = cleanImported(window.state.attendances, 'Atendimentos').concat(records);
    window.state.appointments = cleanImported(window.state.appointments, 'Atendimentos').concat(records);

    window.state.collaborators = cleanImported(window.state.collaborators, 'Equipe').concat(collaborators);
    window.state.team = cleanImported(window.state.team, 'Equipe').concat(collaborators);
    window.state.professionals = cleanImported(window.state.professionals, 'Equipe').concat(collaborators);
    window.state.employees = cleanImported(window.state.employees, 'Equipe').concat(collaborators);

    window.state.sheetDataV38 = data;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({updatedAt:new Date().toISOString(), totals:{records:records.length, collaborators:collaborators.length}, data})); } catch(e){}
    try { if(typeof saveState==='function') saveState(); else localStorage.setItem('barberShopStateV2', JSON.stringify(window.state)); } catch(e){}
    try { if(typeof renderAll==='function') renderAll(); } catch(e){}
    lastSync = {records, collaborators, data, at:new Date()};
    window.barberSheetCoreV38 = {records, collaborators, data, sync:syncAll};
    return lastSync;
  }
  async function syncAll(reason='manual'){
    if(syncing) return lastSync;
    syncing=true;
    statusAll('warning','Sincronizando planilha com o sistema inteiro...');
    try{
      const url=`/.netlify/functions/sheets-proxy?spreadsheetId=${encodeURIComponent(SHEET_ID)}&sheets=${encodeURIComponent(SHEETS.join(','))}`;
      const res=await fetch(url,{cache:'no-store'});
      const json=await res.json();
      if(!json.ok) throw new Error(json.message || 'Falha ao ler planilha.');
      const data={};
      for(const s of SHEETS){
        const csv=sheetCsv(json,s);
        const req=s==='Atendimentos'?['Data','Cliente']:s==='Equipe'?['Profissional','Função']:[''];
        data[s]=csv ? csvObjects(csv, req[0]?req:['']) : [];
      }
      const out=writeState(data);
      renderCollaboratorsPanel(out.collaborators);
      renderReportsPanel(out.records);
      statusAll('success',`Planilha integrada: ${out.records.length} atendimento(s) e ${out.collaborators.length} colaborador(es) carregados.`);
      return out;
    }catch(err){
      console.error(err);
      statusAll('error',`Erro na integração da planilha: ${err.message || err}`);
      return null;
    }finally{ syncing=false; }
  }

  function ensurePanel(screenId, panelId, title, subtitle, buttonText){
    let screen=$('#'+screenId);
    if(!screen){
      screen=document.createElement('section'); screen.id=screenId; screen.className='screen';
      $('.content')?.appendChild(screen);
    }
    let panel=$('#'+panelId);
    if(!panel){
      panel=document.createElement('article'); panel.id=panelId; panel.className='panel wide-panel';
      panel.innerHTML=`<div class="panel-header split-header"><div><p class="eyebrow">Planilha conectada</p><h3>${esc(title)}</h3><p class="muted">${esc(subtitle)}</p></div><button type="button" class="primary-button" data-v38-sync>${esc(buttonText)}</button></div><div class="import-status warning" data-v38-status>Aguardando sincronização.</div><div data-v38-body style="margin-top:14px"></div>`;
      const grid=screen.querySelector('.section-grid') || screen;
      grid.prepend(panel);
    }
    return panel;
  }
  function renderReportsPanel(records){
    const panel=ensurePanel('reports','reportsSheetCoreV38','Relatórios integrados à planilha','Envia os atendimentos da aba Atendimentos para os relatórios sem alterar datas.','Atualizar relatórios');
    const body=panel.querySelector('[data-v38-body]');
    const total=records.reduce((s,r)=>s+(r.saleValue||0),0);
    const financial=records.filter(r=>r.saleValue>0).length;
    const dates=records.map(r=>r.dateISO).filter(Boolean).sort();
    const period=dates.length?`${formatISO(dates[0])} a ${formatISO(dates[dates.length-1])}`:'-';
    body.innerHTML=`<div class="metric-grid"><div class="metric-card"><span>Atendimentos</span><strong>${records.length}</strong></div><div class="metric-card"><span>Financeiros</span><strong>${financial}</strong></div><div class="metric-card"><span>Venda líquida</span><strong>${currency(total)}</strong></div><div class="metric-card"><span>Período</span><strong>${esc(period)}</strong></div></div>`;
  }
  function renderCollaboratorsPanel(list){
    const panel=ensurePanel('collaborators','collaboratorsSheetCoreV38','Colaboradores da planilha','Lista alimentada pela aba Equipe.','Atualizar colaboradores');
    const body=panel.querySelector('[data-v38-body]');
    if(!list.length){ body.innerHTML='<p class="muted">Nenhum colaborador encontrado na aba Equipe.</p>'; return; }
    body.innerHTML=`<div class="table-wrapper"><table><thead><tr><th>Profissional</th><th>Função</th><th>Vínculo</th><th>Ativo</th><th>Comissão</th><th>Observações</th></tr></thead><tbody>${list.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.role)}</td><td>${esc(c.type)}</td><td>${c.active?'Sim':'Não'}</td><td>${esc(c.commissionPercent || (c.commissionRate*100).toFixed(0)+'%')}</td><td>${esc(c.notes)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function statusAll(cls,msg){
    ['reportsSheetCoreV38','collaboratorsSheetCoreV38'].forEach(id=>{
      const p=$('#'+id); const box=p?.querySelector('[data-v38-status]');
      if(box){ box.className=`import-status ${cls}`; box.textContent=msg; }
    });
  }
  function currency(n){ return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function formatISO(iso){ if(!iso) return '-'; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
  function removeOldPanels(){
    ['reportsSheetSyncV34','reportsDateFixV35','reportsDateFixV36','reportsSheetSyncV37','gestaoSyncStatusV29'].forEach(id=>$('#'+id)?.remove());
  }
  function ensureNav(){
    const nav=$('.nav');
    if(nav && !$('.nav-link[data-screen="collaborators"]')){
      const btn=document.createElement('button'); btn.type='button'; btn.className='nav-link'; btn.dataset.screen='collaborators'; btn.innerHTML='<span>👥</span>Colaboradores';
      nav.appendChild(btn);
    }
  }
  function onScreen(id){
    removeOldPanels(); ensureNav();
    if(id==='reports'){ renderReportsPanel(lastSync?.records || (window.state?.records||[]).filter(r=>r.sheetSource==='Atendimentos')); }
    if(id==='collaborators'){ renderCollaboratorsPanel(lastSync?.collaborators || (window.state?.collaborators||[]).filter(c=>c.sheetSource==='Equipe')); }
    if((id==='reports'||id==='collaborators') && !lastSync) setTimeout(()=>syncAll('auto'),350);
  }
  document.addEventListener('click', e=>{
    if(e.target.closest('[data-v38-sync]')){ e.preventDefault(); syncAll('manual'); return; }
    const nav=e.target.closest('.nav-link[data-screen]');
    if(nav) setTimeout(()=>onScreen(nav.dataset.screen),250);
  }, true);
  const oldSet=window.setScreen;
  if(typeof oldSet==='function'){
    window.setScreen=function(id){ const out=oldSet.apply(this,arguments); setTimeout(()=>onScreen(id),250); return out; };
  }
  window.syncSheetCoreV38=syncAll;
  setTimeout(()=>{ removeOldPanels(); ensureNav(); renderReportsPanel([]); renderCollaboratorsPanel([]); syncAll('startup'); },1800);
})();