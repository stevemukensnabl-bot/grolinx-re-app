/* app.js — fixed build for GroLinx REI
   This file is a cleaned, vanilla JS implementation of the app logic.
   Drop this next to index.html and deploy.
*/

/* ========== Utilities ========== */
function fmtMoney(v, digits = 0) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: digits }).format(Number(v || 0));
  } catch (e) {
    return '$0';
  }
}
function fmtPct(p, digits = 2) { if (!isFinite(p)) return '—'; return (Number(p || 0) * 100).toFixed(digits) + '%'; }
function uuid() { return Math.floor(performance.now() + Math.random() * 1e6); }
function safe(v, fallback = '') { return (typeof v === 'undefined' || v === null) ? fallback : v; }

/* ========== State ========== */
const State = {
  tag: 'v1.4.0',
  savedName: null,
  deal: {
    meta: { address: '', city: '', state: '', price: 1500000, units: 14, yearBuilt: 1995, downPaymentPct: 0.35, repairBudget: 50000, closingCostsPct: 0.03, acquisitionCosts: 50000, arv: 0, reservesMonthly: 290, sqft: 7472, type: 'Multifamily' },
    rents: { proformaAnnualGross: 175200, vacancyPct: 0.06, annualRentGrowthPct: 0.03 },
    expenses: { annualExpensesProforma: 50872.16, expenseGrowthPct: 0.05 },
    renovationSchedule: [],
    returnAssumptions: { saleCapRate: 0.06, saleYear: 5, sellingCostsPct: 0.05 }
  },
  apod: { incomes: [{ label: 'Unit Income', amount: 175200 }], expenses: [ { label: 'Taxes', amount: 7100, pctOfEGI: false }, { label: 'Insurance', amount: 6585, pctOfEGI: false }, { label: 'Maint/Repair', amount: 9760, pctOfEGI: false }, { label: 'Utilities', amount: 7299, pctOfEGI: false }, { label: 'Management', amount: 9372.552, pctOfEGI: false }, { label: 'Reserves', amount: 3500, pctOfEGI: false } ] },
  loanScenarios: [{ id: 1, name: 'Base Loan', loanAmount: 975000, interestRate: 0.065, termYears: 30, amortizationYears: 30, interestOnlyYears: 0 }]
};

(function(){ try { const s = localStorage.getItem('rei_state_v1'); if (s) Object.assign(State, JSON.parse(s)); } catch(e){} })();
function persist(){ try { localStorage.setItem('rei_state_v1', JSON.stringify(State)); } catch(e){} }

/* ========== Financial helpers ========== */
function monthlyPayment(loanAmount, annualRate, amortYears){
  if(!loanAmount || !annualRate || !amortYears) return 0;
  const r = annualRate/12;
  const n = amortYears*12;
  if(r === 0) return loanAmount / n;
  const pay = loanAmount * r / (1 - Math.pow(1 + r, -n));
  return pay;
}
function interestOnlyPayment(loanAmount, annualRate){ return (loanAmount * (annualRate || 0)) / 12; }
function yearlyDebtService(loan){ if(!loan) return 0; if((loan.interestOnlyYears || 0) > 0) return interestOnlyPayment(loan.loanAmount||0, loan.interestRate||0) * 12; const m = monthlyPayment(loan.loanAmount||0, loan.interestRate||0, loan.amortizationYears||loan.termYears||30); return m * 12; }

/* ========== KPI computations ========== */
function computeNOI(){
  const inc = (State.apod.incomes||[]).reduce((s,i)=>s + Number(i.amount||0),0);
  const expBase = (State.apod.expenses||[]).reduce((s,e)=> s + (e.pctOfEGI ? 0 : Number(e.amount||0)), 0);
  const pctBased = (State.apod.expenses||[]).reduce((s,e)=> s + (e.pctOfEGI ? (Number(e.amount||0)/100)*inc : 0), 0);
  const totalExp = expBase + pctBased;
  const noi = inc - totalExp;
  return {inc, totalExp, noi};
}
function computeTopKPIs(){
  const price = Number(State.deal.meta.price || 0);
  const {inc, totalExp, noi} = computeNOI();
  const cap = price ? (noi / price) : 0;
  const loan = (State.loanScenarios||[])[0];
  const ds = loan ? yearlyDebtService(loan) : 0;
  const dscr = ds ? (noi / ds) : 0;
  const equity = price * (Number(State.deal.meta.downPaymentPct||0));
  const cashFlow = noi - ds;
  const coc = equity ? (cashFlow / equity) : 0;
  const grm = (inc && price) ? (price / inc) : 0;
  return {price, inc, totalExp, noi, cap, ds, dscr, equity, cashFlow, coc, grm};
}

/* ========== UI: Top tiles ========== */
function updateTopTiles(){
  const root = document.getElementById('topTiles'); if(!root) return;
  const k = computeTopKPIs(); root.innerHTML = '';
  const tiles = [ {label:'Price', value: fmtMoney(k.price)}, {label:'NOI', value: fmtMoney(k.noi)}, {label:'Cap Rate', value: fmtPct(k.cap)}, {label:'Debt Service (Y1)', value: fmtMoney(k.ds)}, {label:'DSCR', value: k.dscr ? k.dscr.toFixed(2) : '—'}, {label:'CoC', value: fmtPct(k.coc)}, {label:'GRM', value: k.grm ? k.grm.toFixed(2) : '—'}, {label:'Equity', value: fmtMoney(k.equity)}, {label:'Cash Flow (Y1)', value: fmtMoney(k.cashFlow)} ];
  tiles.forEach(t=>{ const el = document.createElement('div'); el.className='tile'; el.innerHTML = '<div class="label">'+t.label+'</div><div class="value">'+t.value+'</div>'; root.appendChild(el); });
}

/* ========== Finder (simple sample) ========== */
function FinderRender(container){
  const sample = [ {id:101,name:'Maple Court',city:'Portland',state:'OR',type:'Multifamily',units:16,price:1850000,cap:0.055,yearBuilt:1998}, {id:102,name:'Cedar Flats',city:'Austin',state:'TX',type:'Multifamily',units:12,price:1420000,cap:0.061,yearBuilt:2005}, {id:103,name:'Riverside Retail',city:'Boise',state:'ID',type:'Retail',units:4,price:950000,cap:0.068,yearBuilt:2010} ];
  container.innerHTML = '';
  const card = document.createElement('div'); card.className='card';
  card.innerHTML = '<h3>Investment Finder</h3><div class="small">Sample properties (click Analyze)</div><div id="fResults"></div>';
  container.appendChild(card);
  const fResults = card.querySelector('#fResults');
  sample.forEach(p=>{
    const row = document.createElement('div'); row.style = 'border:1px solid var(--border);padding:8px;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;';
    row.innerHTML = '<div><div style="font-weight:700">'+p.name+'</div><div class="small">'+p.city+', '+p.state+' • '+p.units+' units • '+p.type+'</div><div class="small">Price '+fmtMoney(p.price)+' • Cap '+fmtPct(p.cap)+'</div></div><div style="display:flex;flex-direction:column;gap:6px"><button class="btn-ghost" data-act="analyze" data-id="'+p.id+'">Analyze</button><button class="btn" data-act="analyzeSave" data-id="'+p.id+'">Analyze & Save</button></div>';
    fResults.appendChild(row);
  });

  fResults.addEventListener('click', function(e){ const btn = e.target.closest('button'); if(!btn) return; const act = btn.getAttribute('data-act'); const id = Number(btn.getAttribute('data-id')); const prop = sample.find(x=>x.id === id); if(!prop) return; State.deal.meta.address = prop.name; State.deal.meta.city = prop.city; State.deal.meta.state = prop.state; State.deal.meta.price = prop.price; State.deal.meta.units = prop.units; State.deal.rents.proformaAnnualGross = Math.round((prop.price*(prop.cap||0.06)) + 50000); persist(); renderTabsAndLoad('deal'); if(act === 'analyzeSave'){ State.savedName = prop.name; persist(); alert('Saved (preview).'); } });
}

/* ========== Deal Analyzer (simplified) ========== */
function DealAnalyzerView(){
  const root = document.createElement('div');
  const header = document.createElement('div'); header.className='card'; header.innerHTML = '<h3>Deal Analyzer</h3>';
  root.appendChild(header);

  const sections = document.createElement('div'); sections.className='card';
  sections.innerHTML = '<h4>Sections</h4><div style="display:flex;gap:8px"><button id="sInputs" class="btn-ghost">Inputs</button><button id="sAPOD" class="btn-ghost">APOD</button></div><div id="sectionContent" style="margin-top:12px"></div>';
  root.appendChild(sections);

  function renderInputs(){ const el = sections.querySelector('#sectionContent'); el.innerHTML = ''; const card = document.createElement('div'); card.className='card'; const m = State.deal.meta; card.innerHTML = '<div class="form-grid"><div class="field"><label class="small">Address</label><input name="address" class="input" value="'+safe(m.address)+'" /></div><div class="field"><label class="small">Price</label><input name="price" class="input" type="number" value="'+Number(m.price||0)+'" /></div></div>'; el.appendChild(card);
    card.querySelectorAll('input[name]').forEach(inp=>{ inp.addEventListener('change', ()=>{ const name = inp.name; const val = inp.type === 'number' ? Number(inp.value||0) : inp.value; State.deal.meta[name] = val; persist(); updateTopTiles(); }); }); }

  function renderAPOD(){ const el = sections.querySelector('#sectionContent'); el.innerHTML = ''; const card = document.createElement('div'); card.className='card'; card.innerHTML = '<div id="apodReport"></div><div style="margin-top:10px;display:flex;gap:8px"><button id="exportAPODCSV" class="btn-ghost">Export CSV</button></div>'; el.appendChild(card);
    function renderReport(){ const incTotal = (State.apod.incomes||[]).reduce((s,i)=>s + Number(i.amount||0),0); const expenseTotal = (State.apod.expenses||[]).reduce((s,e)=> s + (e.pctOfEGI ? ((Number(e.amount||0)/100)*incTotal) : Number(e.amount||0)), 0); const noi = incTotal - expenseTotal; const price = Number((State.deal.meta && State.deal.meta.price) || 0); const cap = price ? (noi/price) : 0; const loan = (State.loanScenarios||[])[0]; const ds = loan ? yearlyDebtService(loan) : 0; const cf = noi - ds; const equity = price * Number(State.deal.meta.downPaymentPct || 0); const coc = equity ? (cf / equity) : 0; const grm = price && incTotal ? (price / incTotal) : 0; const dcr = ds ? (noi / ds) : 0; const div = card.querySelector('#apodReport'); div.innerHTML = '<table><tbody>' + '<tr><td><strong>Price</strong></td><td class="num">'+fmtMoney(price)+'</td></tr>' + '<tr><td><strong>Income Total (EGI)</strong></td><td class="num">'+fmtMoney(incTotal)+'</td></tr>' + '<tr><td><strong>Operating Expenses</strong></td><td class="num">'+fmtMoney(expenseTotal)+'</td></tr>' + '<tr><td><strong>NOI</strong></td><td class="num">'+fmtMoney(noi)+'</td></tr>' + '<tr><td><strong>Cap Rate</strong></td><td class="num">'+fmtPct(cap)+'</td></tr>' + '<tr><td><strong>Debt Service (Y1)</strong></td><td class="num">'+fmtMoney(ds)+'</td></tr>' + '<tr><td><strong>Cash Flow (Y1)</strong></td><td class="num">'+fmtMoney(cf)+'</td></tr>' + '<tr><td><strong>Cash-on-Cash (CoC)</strong></td><td class="num">'+fmtPct(coc)+'</td></tr>' + '</tbody></table>'; }
    renderReport();

    card.querySelector('#exportAPODCSV').addEventListener('click', function(){
      const rows = [['Metric','Value']];
      const incTotal = (State.apod.incomes || []).reduce((s,i)=> s + Number(i.amount || 0), 0);
      rows.push(['Income Total', incTotal]);
      (State.apod.incomes || []).forEach(i => rows.push([i.label, i.amount]));
      rows.push([]);
      (State.apod.expenses || []).forEach(e => {
        const val = e.pctOfEGI ? (String(e.amount) + '% of EGI') : e.amount;
        rows.push([e.label, val]);
      });
      // CSV-escape double quotes by doubling them
      const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('
');
      const blob = new Blob([csv], {type: 'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'apod.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
  }

  sections.querySelector('#sInputs').addEventListener('click', renderInputs);
  sections.querySelector('#sAPOD').addEventListener('click', renderAPOD);
  renderInputs();
  return root;
}

/* ========== Dashboard & Docs ========== */
function DashboardView(){ const d = document.createElement('div'); d.className='card'; d.innerHTML = '<h3>Investor Dashboard</h3><div class="small">Saved Deal: '+safe(State.savedName,'(none)')+'</div>'; return d; }
function DocsView(){ const d = document.createElement('div'); d.className='card'; d.innerHTML = '<h3>Docs & Exports</h3><div class="small">CSV export available. XLSX/docx available in production builds.</div>'; return d; }

/* ========== Top-level tabs and routing ========== */
const TOP_TABS = [ {id:'dashboard', label:'Investor Dashboard'}, {id:'finder', label:'Investment Finder'}, {id:'deal', label:'Deal Analyzer'}, {id:'docs', label:'Docs & Exports'} ];
const topTabsWrap = document.getElementById('tabsRow');
const appRoot = document.getElementById('app');
function renderTopTabs(activeId){ topTabsWrap.innerHTML = ''; TOP_TABS.forEach(t=>{ const b = document.createElement('button'); b.className = 'pill' + (t.id === activeId ? ' active' : ''); b.textContent = t.label; b.addEventListener('click', ()=>{ renderTopTabs(t.id); renderTabsAndLoad(t.id); }); topTabsWrap.appendChild(b); }); }
function getViewById(id){ if(id === 'dashboard') return DashboardView(); if(id === 'finder'){ const node = document.createElement('div'); FinderRender(node); return node; } if(id === 'deal') return DealAnalyzerView(); if(id === 'docs') return DocsView(); return DashboardView(); }
function renderTabsAndLoad(activeId){ renderTopTabs(activeId); appRoot.innerHTML = ''; appRoot.appendChild(getViewById(activeId)); updateTopTiles(); }

/* theme toggle wiring */
(function(){ const btn = document.getElementById('themeToggle'); const initial = localStorage.getItem('rei_theme') || 'light'; document.documentElement.setAttribute('data-theme', initial); function updateBtn(){ const cur = document.documentElement.getAttribute('data-theme') || 'light'; btn.style.color = cur === 'light' ? '#0b2138' : '#ffffff'; btn.style.borderColor = cur === 'light' ? '#d1e3f6' : '#ffffff'; btn.textContent = cur === 'light' ? 'Switch to Dark' : 'Switch to Light'; } updateBtn(); btn.addEventListener('click', ()=>{ const cur = document.documentElement.getAttribute('data-theme') || 'light'; const n = cur === 'light' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', n); localStorage.setItem('rei_theme', n); updateBtn(); }); })();

/* initial boot */
renderTabsAndLoad('finder');
updateTopTiles();

/* expose */
window.renderTabsAndLoad = renderTabsAndLoad;
