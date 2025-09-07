/* app.js — GroLinx polished UX build (UTF-8, no BOM) */
(function(){
  'use strict';
  console.log('GroLinx v1.4.0 starting', new Date().toISOString());

  // Helpers
  function money(n,d){ d=(typeof d==='number')?d:0; if(n==null||isNaN(n)) return '-'; return '$'+Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}); }
  function pct(n){ if(n==null||isNaN(n)) return '-'; return (Number(n)*100).toFixed(2)+'%'; }
  function monthlyPI(loan, annualRate, years){ if(!loan||!years) return 0; var r=(annualRate||0)/12; var n=years*12; if(r===0) return loan/n; return loan*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1); }
  var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function buildPeriod(startMonth, startYear){ var labels=[], m=startMonth, y=startYear; for(var i=0;i<12;i++){ labels.push({m:m,y:y,label:MONTHS[m]+' '+y}); m=(m+1)%12; if(m===0) y+=1; } return labels; }

  // LS keys
  var LS_THEME='grolinx_theme', LS_ACTIVE='grolinx_active', LS_PROFILE='grolinx_profile';

  // State
  var state={
    activeModule: localStorage.getItem(LS_ACTIVE)||'dealanalyzer',
    modules:[{id:'dashboard',label:'Dashboard'},{id:'finder',label:'Finder'},{id:'dealanalyzer',label:'Deal Analyzer'}],
    isEnterprise:false,
    profile: JSON.parse(localStorage.getItem(LS_PROFILE)||JSON.stringify({name:'GroLinx User',email:'user@grolinx.com',commitment:250000})),
    investors:[{id:1,name:'Acme Capital',contact:'invest@acme.com',committed:2000000,deployed:1200000},{id:2,name:'BluePeak LP',contact:'team@bluepeak.com',committed:1000000,deployed:450000}],
    deal:{ name:'123 Main St', market:'Anytown, USA', price:1500000, units:14, downPct:0.35, downAmt:525000, loanAmt:975000, rate:0.065, termYears:30, closingCostPct:0.03, rehab:50000, vacancyRate:0.06, otherIncome:0, saleCap:0.06, sellCostPct:0.05 },
    scenarios:[{id:1,name:'Base (65% LTV, 6.5% 30yr)',loanAmt:975000,rate:0.065,termYears:30},{id:2,name:'Alt (70% LTV, 6.75% 30yr)',loanAmt:1050000,rate:0.0675,termYears:30}],
    t12:{ startMonth:(new Date()).getMonth(), startYear:(new Date()).getFullYear()-1, rows:[{id:1,category:'Taxes',months:Array(12).fill(7100/12)},{id:2,category:'Insurance',months:Array(12).fill(6585/12)},{id:3,category:'Maintenance',months:Array(12).fill(9760/12)}] }
  };

  // Theme
  function applyTheme(t){ if(t==='dark') document.documentElement.setAttribute('data-theme','dark'); else document.documentElement.removeAttribute('data-theme'); localStorage.setItem(LS_THEME,t); }
  applyTheme(localStorage.getItem(LS_THEME)||'light');

  // Utils
  function clear(el){ while(el&&el.firstChild) el.removeChild(el.firstChild); }
  function escapeHtml(s){ if(s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function downloadFile(name,content,type){ var blob=new Blob([content],{type:type}); var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(function(){URL.revokeObjectURL(url);},1200); }

  // Tabs
  function renderModuleTabs(){ var row=document.getElementById('tabsRow'); if(!row) return; clear(row); state.modules.forEach(function(m){ var b=document.createElement('button'); b.className='pill'+(state.activeModule===m.id?' active':''); b.textContent=m.label; b.addEventListener('click',function(){ state.activeModule=m.id; localStorage.setItem(LS_ACTIVE,m.id); render(); }); row.appendChild(b); }); var plan=document.getElementById('planLabel'); if(plan) plan.textContent=(state.isEnterprise?'Plan: Enterprise':'Plan: Basic'); }

  // Dashboard (clean two-column)
  function renderDashboard(root){
    var grid=document.createElement('div'); grid.className='grid-2';

    var left=document.createElement('div');
    var profile=document.createElement('div'); profile.className='card';
    profile.innerHTML='<h3>Profile</h3>'+
      '<div class="form-grid">'+
      '<div class="field"><label>Name</label><input id="pName" class="input" value="'+escapeHtml(state.profile.name)+'"></div>'+
      '<div class="field"><label>Email</label><input id="pEmail" class="input" value="'+escapeHtml(state.profile.email)+'"></div>'+
      '<div class="field"><label>Commitment</label><input id="pCommit" class="input" type="number" value="'+(state.profile.commitment||0)+'"></div>'+
      '<div class="field"><label>Plan</label><input disabled class="input" value="'+(state.isEnterprise?'Enterprise':'Basic')+'"></div>'+
      '</div>'+ 
      '<div style="margin-top:10px;display:flex;gap:8px"><button id="saveProfile" class="btn">Save</button><button id="togglePlan" class="btn-ghost">Toggle Plan</button></div>';
    left.appendChild(profile);

    var right=document.createElement('div');
    var inv=document.createElement('div'); inv.className='card';
    var list='<h3>Investors</h3>';
    state.investors.forEach(function(it){ list+='<div style="padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px">'+
      '<div style="font-weight:700">'+escapeHtml(it.name)+'</div>'+ 
      '<div class="muted" style="font-size:12px">'+escapeHtml(it.contact)+'</div>'+ 
      '<div class="muted" style="font-size:12px">Committed: '+money(it.committed)+' • Deployed: '+money(it.deployed)+'</div>'+ 
      '</div>'; });
    list+='<div style="margin-top:10px;font-weight:700">Add Investor</div>'+
      '<div class="form-grid" style="margin-top:6px">'+
      '<input id="newInvName" class="input" placeholder="Name">'+
      '<input id="newInvContact" class="input" placeholder="Contact">'+
      '<input id="newInvCommitted" class="input" type="number" placeholder="Committed">'+
      '<button id="addInvestorBtn" class="btn-ghost">Add</button>'+
      '</div>';
    inv.innerHTML=list;
    right.appendChild(inv);

    grid.appendChild(left); grid.appendChild(right); root.appendChild(grid);

    // Events
    var save=document.getElementById('saveProfile'); if(save){ save.addEventListener('click',function(){ state.profile.name=document.getElementById('pName').value||''; state.profile.email=document.getElementById('pEmail').value||''; state.profile.commitment=Number(document.getElementById('pCommit').value)||0; localStorage.setItem(LS_PROFILE,JSON.stringify(state.profile)); alert('Profile saved'); }); }
    var tgl=document.getElementById('togglePlan'); if(tgl){ tgl.addEventListener('click',function(){ state.isEnterprise=!state.isEnterprise; render(); }); }
    var add=document.getElementById('addInvestorBtn'); if(add){ add.addEventListener('click', function(){ var n=(document.getElementById('newInvName').value||'').trim(); if(!n) return alert('Enter name'); var c=(document.getElementById('newInvContact').value||'').trim(); var amt=Number(document.getElementById('newInvCommitted').value)||0; var id=Math.max.apply(null,[0].concat(state.investors.map(function(x){return x.id;})))+1; state.investors.push({id:id,name:n,contact:c,committed:amt,deployed:0}); render(); }); }
  }

  // Deal Analyzer
  function dealCalcs(){ var d=state.deal; var grossYr1=142440; var vacYr1=grossYr1*(d.vacancyRate||0); var egiYr1=grossYr1-vacYr1+(d.otherIncome||0); var t12TotalAnnual=state.t12.rows.reduce(function(s,r){return s+r.months.reduce(function(a,b){return a+(Number(b)||0);},0);},0); var pmt=monthlyPI(d.loanAmt,d.rate,d.termYears); var ads=pmt*12; var noi=egiYr1-t12TotalAnnual; var cf=noi-ads; var cap=d.price?(noi/d.price):0; var coc=d.downAmt?(cf/d.downAmt):0; return {grossYr1:grossYr1,vacYr1:vacYr1,egiYr1:egiYr1,t12TotalAnnual:t12TotalAnnual,pmt:pmt,ads:ads,noi:noi,cf:cf,cap:cap,coc:coc}; }

  function renderDealAnalyzer(root){
    // Header card
    var head=document.createElement('div'); head.className='card'; head.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center">'+
      '<div><div style="font-weight:800;font-size:18px">'+escapeHtml(state.deal.name)+'</div><div class="muted" style="font-size:12px">'+escapeHtml(state.deal.market)+'</div></div>'+ 
      '<div class="muted" style="font-size:12px">Units: '+(state.deal.units||'-')+'</div></div>';
    root.appendChild(head);

    var grid=document.createElement('div'); grid.className='grid-2';

    // Left column
    var left=document.createElement('div');

    // Inputs card
    var inp=document.createElement('div'); inp.className='card';
    inp.innerHTML='<h3>Deal Inputs</h3>'+ 
      '<div class="form-grid">'+
      '<div class="field"><label>Purchase Price</label><input id="in_price" class="input" type="number" value="'+(state.deal.price||0)+'"></div>'+
      '<div class="field"><label>Down %</label><input id="in_downPct" class="input" type="number" step="0.001" value="'+(state.deal.downPct||0.35)+'"></div>'+
      '<div class="field"><label>Interest Rate (0-1)</label><input id="in_rate" class="input" type="number" step="0.0001" value="'+(state.deal.rate||0.065)+'"></div>'+
      '<div class="field"><label>Term (years)</label><input id="in_term" class="input" type="number" value="'+(state.deal.termYears||30)+'"></div>'+
      '<div class="field"><label>Vacancy Rate (0-1)</label><input id="in_vac" class="input" type="number" step="0.001" value="'+(state.deal.vacancyRate||0)+'"></div>'+
      '<div class="field"><label>Other Income (annual)</label><input id="in_other" class="input" type="number" value="'+(state.deal.otherIncome||0)+'"></div>'+
      '</div>'+ 
      '<div style="margin-top:10px; display:flex; gap:8px"><button id="applyDealBtn" class="btn">Apply</button><button id="resetDealBtn" class="btn-ghost">Reset</button></div>';
    left.appendChild(inp);

    // Metrics tiles
    var tiles=document.createElement('div'); tiles.className='tiles'; tiles.style.marginTop='12px';
    var cal=dealCalcs();
    tiles.innerHTML=
      tile('Cap Rate', cal.cap? (cal.cap*100).toFixed(2)+'%':'-', rating(cal.cap, 0.055, 0.07))+
      tile('NOI', money(cal.noi), rating(cal.noi, 60000, 90000))+
      tile('Annual Debt', money(cal.ads), 'muted')+
      tile('Cash Flow', money(cal.cf), rating(cal.cf, 0, 30000));
    left.appendChild(tiles);

    // Scenarios
    var sc=document.createElement('div'); sc.className='card'; sc.style.marginTop='12px';
    var shtml='<h3>Financing Scenarios</h3>';
    state.scenarios.forEach(function(s){ shtml+= '<div style="padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px; display:flex; justify-content:space-between; gap:10px">'+
      '<div><div style="font-weight:700">'+escapeHtml(s.name)+'</div><div class="muted" style="font-size:12px">Loan: '+money(s.loanAmt)+' • Rate: '+(s.rate*100).toFixed(2)+'% • Term: '+s.termYears+' yrs</div></div>'+ 
      '<div><button class="btn-ghost applySc" data-sid="'+s.id+'">Apply</button></div></div>'; });
    shtml+='<button id="addScenarioBtn" class="btn-ghost">+ Add Scenario</button>';
    sc.innerHTML=shtml; left.appendChild(sc);

    // Right column
    var right=document.createElement('div');

    // T12 card
    var t12=document.createElement('div'); t12.className='card';
    var period=buildPeriod(state.t12.startMonth, state.t12.startYear);
    var t12h='<h3>T12</h3><div class="muted" style="font-size:12px">Start: '+period[0].label+'</div>';
    t12h+='<div style="margin-top:8px"><table><thead><tr><th>Category</th><th class="num">Annual</th></tr></thead><tbody>';
    state.t12.rows.forEach(function(row){ var total=row.months.reduce(function(a,b){return a+(Number(b)||0);},0); t12h+='<tr><td>'+escapeHtml(row.category)+'</td><td class="num">'+money(total)+'</td></tr>'; });
    t12h+='</tbody></table></div><div style="margin-top:8px"><button id="exportT12" class="btn-ghost">Export CSV</button></div>';
    t12.innerHTML=t12h; right.appendChild(t12);

    // APOD card
    var apod=document.createElement('div'); apod.className='card'; apod.style.marginTop='12px';
    var ap=dealCalcs();
    apod.innerHTML='<h3>APOD</h3>'+
      '<div class="muted" style="font-size:12px">Year 1</div>'+ 
      '<div style="margin-top:8px">GSI: <b>'+money(ap.grossYr1)+'</b></div>'+ 
      '<div>NOI: <b>'+money(ap.noi)+'</b></div>'+ 
      '<div>Cash Flow: <b>'+money(ap.cf)+'</b></div>';
    right.appendChild(apod);

    grid.appendChild(left); grid.appendChild(right); root.appendChild(grid);

    // Bindings
    var apply=document.getElementById('applyDealBtn'); if(apply){ apply.addEventListener('click',function(){
      state.deal.price=Number(document.getElementById('in_price').value)||0;
      state.deal.downPct=Number(document.getElementById('in_downPct').value)||0;
      state.deal.downAmt=state.deal.price*state.deal.downPct;
      state.deal.loanAmt=state.deal.price-state.deal.downAmt;
      state.deal.rate=Number(document.getElementById('in_rate').value)||0;
      state.deal.termYears=Number(document.getElementById('in_term').value)||30;
      state.deal.vacancyRate=Number(document.getElementById('in_vac').value)||0;
      state.deal.otherIncome=Number(document.getElementById('in_other').value)||0;
      render();
    }); }
    var reset=document.getElementById('resetDealBtn'); if(reset){ reset.addEventListener('click',function(){ state.deal={ name:'123 Main St', market:'Anytown, USA', price:1500000, units:14, downPct:0.35, downAmt:525000, loanAmt:975000, rate:0.065, termYears:30, closingCostPct:0.03, rehab:50000, vacancyRate:0.06, otherIncome:0, saleCap:0.06, sellCostPct:0.05 }; render(); }); }
    var btns=document.getElementsByClassName('applySc'); for(var j=0;j<btns.length;j++){ btns[j].addEventListener('click', function(ev){ var sid=Number(ev.target.getAttribute('data-sid')); var sc=state.scenarios.find(function(x){return x.id===sid;}); if(sc){ state.deal.loanAmt=sc.loanAmt; state.deal.rate=sc.rate; state.deal.termYears=sc.termYears; state.deal.downAmt=state.deal.price-state.deal.loanAmt; render(); } }); }
    var exp=document.getElementById('exportT12'); if(exp){ exp.addEventListener('click', function(){ var rows=[['Category','Annual']]; state.t12.rows.forEach(function(r){ var total=r.months.reduce(function(a,b){return a+(Number(b)||0);},0); rows.push([r.category,total]); }); var csv=rows.map(function(r){ return r.map(function(c){ var s=String(c); if(s.indexOf(',')!==-1) s='"'+s.replace(/"/g,'""')+'"'; return s; }).join(','); }).join('\n'); downloadFile('t12_export.csv', csv, 'text/csv'); }); }
  }

  function tile(label, value, cls){ return '<div class="tile '+(cls||'')+'"><div class="label">'+label+'</div><div class="value">'+value+'</div></div>'; }
  function rating(val, warnCut, okCut){ if(val==null||isNaN(val)) return 'muted'; if(val>=okCut) return 'ok'; if(val>=warnCut) return 'warn'; return 'bad'; }

  // Finder (kept light)
  function renderFinder(root){ var c=document.createElement('div'); c.className='card'; c.innerHTML='<h3>Finder</h3><div class="muted" style="font-size:12px">Search sample listings and open in Analyzer.</div><div style="margin-top:8px"><button id="openSample" class="btn">Open Sample Deal</button></div>'; root.appendChild(c); var b=document.getElementById('openSample'); if(b) b.addEventListener('click', function(){ state.deal={ name:'Sample 14-unit', market:'Orlando, FL', price:1500000, units:14, downPct:0.35, downAmt:525000, loanAmt:975000, rate:0.065, termYears:30, vacancyRate:0.06, otherIncome:0 }; state.activeModule='dealanalyzer'; localStorage.setItem(LS_ACTIVE,'dealanalyzer'); render(); }); }

  // Render root
  function render(){ try{ renderModuleTabs(); var root=document.getElementById('app'); if(!root) return; clear(root); if(state.activeModule==='dashboard') renderDashboard(root); else if(state.activeModule==='finder') renderFinder(root); else if(state.activeModule==='dealanalyzer') renderDealAnalyzer(root); else root.appendChild(document.createTextNode('Unknown module')); console.log('render completed; activeModule=', state.activeModule); }catch(err){ console.error('Render error', err); var r=document.getElementById('app'); if(r) r.innerHTML='<div class="card" style="border-color:#ef4444;background:#fff6f6;color:#7f1d1d">An error occurred during render. See console.</div>'; } }

  // Theme toggle
  var themeBtn=document.getElementById('themeToggle'); if(themeBtn){ themeBtn.addEventListener('click', function(){ var cur=localStorage.getItem(LS_THEME)||'light'; var next=(cur==='light')?'dark':'light'; applyTheme(next); }); }

  // Init
  try{ render(); }catch(e){ console.error('Startup error', e); }

})();
