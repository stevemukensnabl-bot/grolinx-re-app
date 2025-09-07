/* app.js — externalized GroLinx vanilla JS app (UTF-8, no BOM) */
(function(){
  'use strict';
  console.log('GroLinx v1.3.7-external starting', new Date().toISOString());

  // Helpers
  function money(n, d){ d = (typeof d === 'number') ? d : 0; if(n==null || isNaN(n)) return '-'; return '$' + Number(n).toLocaleString(undefined, {minimumFractionDigits:d, maximumFractionDigits:d}); }
  function pct(n){ if(n==null || isNaN(n)) return '-'; return (Number(n)*100).toFixed(2) + '%'; }
  function monthlyPI(loan, annualRate, years){ if(!loan || !years) return 0; var r = (annualRate || 0) / 12; var n = years * 12; if(r === 0) return loan / n; return loan * (r * Math.pow(1+r, n)) / (Math.pow(1+r, n) - 1); }

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function buildPeriod(startMonth, startYear){ var labels=[]; var m=startMonth; var y=startYear; for(var i=0;i<12;i++){ labels.push({m:m,y:y,label: MONTHS[m] + ' ' + y}); m=(m+1)%12; if(m===0) y+=1; } return labels; }

  // App state (trimmed sample) — you can expand this later
  var state = {
    activeModule: 'dealanalyzer',
    modules: [ {id:'dashboard',label:'Investor Dashboard'}, {id:'finder',label:'Investment Finder'}, {id:'dealanalyzer',label:'Deal Analyzer'} ],
    dealTabs: 'summary',
    deal: { name:'123 Main St', market:'Anytown, USA', price:1500000, units:14, downPct:0.35, downAmt:525000, loanAmt:975000, rate:0.065, termYears:30, closingCostPct:0.03, rehab:50000, vacancyRate:0.06, otherIncome:0, saleCap:0.06, sellCostPct:0.05 },
    t12: { startMonth: (new Date()).getMonth(), startYear: (new Date()).getFullYear()-1, rows: [ {id:1,category:'Taxes',months:Array(12).fill(7100/12)}, {id:2,category:'Insurance',months:Array(12).fill(6585/12)}, {id:3,category:'Maintenance',months:Array(12).fill(9760/12)} ] },
    scenarios: [ { id:1, name:'Base (65% LTV, 6.5%, 30yr)', loanAmt: 975000, rate:0.065, termYears:30 } ]
  };

  function dealCalcs(){ var d = state.deal; var grossYr1 = 142440; var vacYr1 = grossYr1 * (d.vacancyRate||0); var egiYr1 = grossYr1 - vacYr1 + (d.otherIncome||0); var t12TotalAnnual = state.t12.rows.reduce(function(s,r){ return s + r.months.reduce(function(a,b){ return a + (Number(b)||0); },0); },0); var pmt = monthlyPI(d.loanAmt,d.rate,d.termYears); var ads = pmt * 12; var noi = egiYr1 - t12TotalAnnual; var cf = noi - ads; var cap = d.price ? (noi / d.price) : 0; var coc = d.downAmt ? (cf / d.downAmt) : 0; return { grossYr1:v grossYr1, vacYr1:vacYr1, egiYr1:egiYr1, t12TotalAnnual:t12TotalAnnual, pmt:pmt, ads:ads, noi:noi, cf:cf, cap:cap, coc:coc } }

  // render tabs
  function renderModuleTabs(){ var bar = document.getElementById('tabsbar'); if(!bar) return; bar.innerHTML = ''; state.modules.forEach(function(m){ var btn = document.createElement('button'); btn.className = 'pill' + (state.activeModule === m.id ? ' active' : ''); btn.textContent = m.label; btn.addEventListener('click', function(){ state.activeModule = m.id; render(); }); bar.appendChild(btn); }); }

  // Placeholder renderers (kept small to avoid heavy code)
  function renderDashboard(container){ var card = document.createElement('div'); card.className = 'card'; card.innerHTML = '<div style="font-weight:800">Investor Dashboard</div><div class="muted">Profiles, commitments, and investor list.</div>'; container.appendChild(card); }
  function renderFinder(container){ var card = document.createElement('div'); card.className = 'card'; card.innerHTML = '<div style="font-weight:800">Investment Finder</div><div class="muted">Search and filters for deals.</div>'; container.appendChild(card); }
  function renderDealAnalyzer(container){ var d = state.deal; var calc = (function(){ var grossYr1 = 142440; var vacYr1 = grossYr1 * (d.vacancyRate||0); var egiYr1 = grossYr1 - vacYr1 + (d.otherIncome||0); var t12TotalAnnual = state.t12.rows.reduce(function(s,r){ return s + r.months.reduce(function(a,b){ return a + (Number(b)||0); },0); },0); var pmt = monthlyPI(d.loanAmt,d.rate,d.termYears); var ads = pmt*12; var noi = egiYr1 - t12TotalAnnual; var cf = noi - ads; var cap = d.price ? (noi/d.price) : 0; var coc = d.downAmt ? (cf/d.downAmt) : 0; return {pmt:pmt,ads:ads,noi:noi,cf:cf,cap:cap,coc:coc}; })();
    var card = document.createElement('div'); card.className = 'card';
    card.innerHTML = '<div style="font-weight:800">Deal Analyzer</div>' +
                     '<div style="margin-top:8px" class="grid-2">' +
                     '<div class="card"><div style="font-weight:700">Purchase Price</div><div>'+ (d.price?('$'+d.price.toLocaleString()):'-') +'</div></div>' +
                     '<div class="card"><div style="font-weight:700">Cap Rate (Yr1)</div><div>'+ (calc.cap? ( (calc.cap*100).toFixed(2)+'%') : '-') +'</div></div>' +
                     '</div>';
    container.appendChild(card);
  }

  function render(){ try{ renderModuleTabs(); var root = document.getElementById('app'); if(!root) return; root.innerHTML = ''; var mount = document.createElement('div'); if(state.activeModule === 'dashboard') renderDashboard(mount); if(state.activeModule === 'finder') renderFinder(mount); if(state.activeModule === 'dealanalyzer') renderDealAnalyzer(mount); root.appendChild(mount); console.log('render completed; activeModule=', state.activeModule); }catch(err){ console.error('Error in render()', err); var app = document.getElementById('app'); if(app) app.innerHTML = '<div class="card" style="border-color: #ef4444; background:#fff6f6; color:#7f1d1d">An error occurred. See console for details.</div>'; } }

  // Initialize
  try{ render(); }catch(e){ console.error('Startup error', e); }

})();
