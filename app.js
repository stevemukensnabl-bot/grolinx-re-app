/* app.js — v1.6
   All UI & logic for GroLinx REI baseline v1.6.
   Drop this next to index.html and open in preview / Netlify.
*/

/* ===================== Utilities ===================== */
function fmtMoney(v, digits=0){ try { return new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:digits}).format(Number(v||0)); } catch(e){ return '$0'; } }
function fmtPct(p, digits=2){ if(!isFinite(p)) return '—'; return (Number(p||0)*100).toFixed(digits) + '%'; }
function uuid(){ return Math.floor(performance.now() + Math.random()*1e6); }
function safe(v, fallback=''){ return (typeof v === 'undefined' || v === null) ? fallback : v; }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

/* ===================== App State ===================== */
const State = {
  tag: 'v1.6',
  savedName: null,
  deal: {
    meta: {
      address: '',
      city: '',
      state: '',
      price: 1500000,
      units: 14,
      yearBuilt: 1995,
      downPaymentPct: 0.35,
      repairBudget: 50000,
      closingCostsPct: 0.03,
      acquisitionCosts: 50000,
      arv: 0,
      reservesMonthly: 290,
      sqft: 7472,
      type: 'Multifamily'
    },
    rents: { proformaAnnualGross: 175200, vacancyPct: 0.06, annualRentGrowthPct: 0.03 },
    expenses: { annualExpensesProforma: 50872.16, expenseGrowthPct: 0.05 },
    renovationSchedule: [ /* {id, phase, cost, startMonthOffset} */ ],
    returnAssumptions: { saleCapRate: 0.06, saleYear: 5, sellingCostsPct: 0.05 }
  },
  apod: {
    incomes: [{label:'Unit Income', amount:175200}],
    expenses: [
      {label:'Taxes', amount:7100, pctOfEGI:false},
      {label:'Insurance', amount:6585, pctOfEGI:false},
      {label:'Maint/Repair', amount:9760, pctOfEGI:false},
      {label:'Utilities', amount:7299, pctOfEGI:false},
      {label:'Management', amount:9372.552, pctOfEGI:false},
      {label:'Reserves', amount:3500, pctOfEGI:false}
    ]
  },
  loanScenarios: [{id:1, name:'Base Loan', loanAmount:975000, interestRate:0.065, termYears:30, amortizationYears:30, interestOnlyYears:0}]
};

/* load & persist */
(function(){ try { const s = localStorage.getItem('rei_v1.6_state'); if(s) Object.assign(State, JSON.parse(s)); } catch(e){} })();
function persist(){ try{ localStorage.setItem('rei_v1.6_state', JSON.stringify(State)); }catch(e){} }

/* ===================== Financial helpers ===================== */
function monthlyPayment(loanAmount, annualRate, amortYears){
  if(!loanAmount || !annualRate || !amortYears) return 0;
  const r = annualRate/12;
  const n = amortYears*12;
  if(r === 0) return loanAmount / n;
  const pay = loanAmount * r / (1 - Math.pow(1 + r, -n));
  return pay;
}
function interestOnlyPayment(loanAmount, annualRate){ return (loanAmount * (annualRate || 0)) / 12; }
function yearlyDebtService(loan){
  if(!loan) return 0;
  if((loan.interestOnlyYears || 0) > 0) return interestOnlyPayment(loan.loanAmount||0, loan.interestRate||0) * 12;
  const m = monthlyPayment(loan.loanAmount||0, loan.interestRate||0, loan.amortizationYears||loan.termYears||30);
  return m * 12;
}

/* ===================== Top tiles summary ===================== */
function computeNOI(){
  const inc = (State.apod.incomes||[]).reduce((s,i)=>s + Number(i.amount||0),0);
  const expBase = (State.apod.expenses||[]).reduce((s,e)=> s + (e.pctOfEGI ? 0 : Number(e.amount||0)), 0);
  // handle pctOfEGI
  const eg = inc;
  const pctBased = (State.apod.expenses||[]).reduce((s,e)=> s + (e.pctOfEGI ? (Number(e.amount||0)/100)*eg : 0), 0);
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

function updateTopTiles(){
  const root = document.getElementById('topTiles');
  if(!root) return;
  const k = computeTopKPIs();
  root.innerHTML = '';
  const tiles = [
    {label:'Price', value: fmtMoney(k.price)},
    {label:'NOI', value: fmtMoney(k.noi)},
    {label:'Cap Rate', value: fmtPct(k.cap)},
    {label:'Debt Service (Y1)', value: fmtMoney(k.ds)},
    {label:'DSCR', value: k.dscr ? k.dscr.toFixed(2) : '—'},
    {label:'CoC', value: fmtPct(k.coc)},
    {label:'GRM', value: k.grm ? k.grm.toFixed(2) : '—'},
    {label:'Equity', value: fmtMoney(k.equity)},
    {label:'Cash Flow (Y1)', value: fmtMoney(k.cashFlow)}
  ];
  tiles.forEach(t=>{
    const el = document.createElement('div'); el.className='tile';
    el.innerHTML = `<div class="label">${t.label}</div><div class="value">${t.value}</div>`;
    root.appendChild(el);
  });
}

/* ===================== Simple canvas chart for small visuals ===================== */
function drawBarChart(canvas, labels, values, colors){
  if(!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const DPR = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 220;
  canvas.width = w * DPR;
  canvas.height = h * DPR;
  ctx.scale(DPR, DPR);
  ctx.clearRect(0,0,w,h);
  const margin = {l:30,r:20,t:20,b:40};
  const cw = w - margin.l - margin.r;
  const ch = h - margin.t - margin.b;
  const maxVal = Math.max(...values.map(v=>Math.abs(v)), 1);
  const barW = Math.min(80, cw / (labels.length * 1.6));
  labels.forEach((lab, i) => {
    const vx = values[i];
    const x = margin.l + i*(barW*1.6) + (cw - (labels.length*(barW*1.6)))/2;
    const hRatio = (Math.abs(vx) / maxVal);
    const barH = hRatio * ch;
    const y = margin.t + (vx >= 0 ? (ch - barH) : ch);
    ctx.fillStyle = colors && colors[i] ? colors[i] : '#0f4c81';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#111';
    ctx.font = '12px system-ui, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(fmtMoney(vx), x + barW/2, y - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = '12px system-ui, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(lab, x + barW/2, margin.t + ch + 18);
  });
}

/* ===================== Finder (filters, sort, pagination) ===================== */
const Finder = (function(){
  const sample = [
    {id:101,name:'Maple Court',city:'Portland',state:'OR',type:'Multifamily',units:16,price:1850000,cap:0.055,yearBuilt:1998},
    {id:102,name:'Cedar Flats',city:'Austin',state:'TX',type:'Multifamily',units:12,price:1420000,cap:0.061,yearBuilt:2005},
    {id:103,name:'Riverside Retail',city:'Boise',state:'ID',type:'Retail',units:4,price:950000,cap:0.068,yearBuilt:2010},
    {id:104,name:'Willow Gardens',city:'Austin',state:'TX',type:'Multifamily',units:20,price:2100000,cap:0.052,yearBuilt:1988},
    {id:105,name:'Pine Lofts',city:'Dallas',state:'TX',type:'Multifamily',units:10,price:900000,cap:0.07,yearBuilt:2001},
    {id:106,name:'Oak Commons',city:'Austin',state:'TX',type:'Retail',units:3,price:720000,cap:0.064,yearBuilt:2012}
  ];

  let filters = {
    city:'', state:'', priceMin:0, priceMax:0, unitsMin:0, unitsMax:0, capMin:0, type:''
  };
  let sortBy = {field:'price', dir:'asc'};
  let pageSize = 4;
  let page = 1;

  function render(container){
    container.innerHTML = '';
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<h3>Investment Finder</h3>
      <div class="form-grid" style="margin-bottom:8px">
        <div class="field"><label class="small">City</label><input id="fCity" class="input" placeholder="City" /></div>
        <div class="field"><label class="small">State</label><input id="fState" class="input" maxlength="2" placeholder="State" /></div>
        <div class="field"><label class="small">Min Price</label><input id="fPmin" class="input" type="number" /></div>
        <div class="field"><label class="small">Max Price</label><input id="fPmax" class="input" type="number" /></div>
        <div class="field"><label class="small">Min Units</label><input id="fUmin" class="input" type="number" /></div>
        <div class="field"><label class="small">Max Units</label><input id="fUmax" class="input" type="number" /></div>
        <div class="field"><label class="small">Min Cap Rate %</label><input id="fCapMin" class="input" type="number" step="0.001" /></div>
        <div class="field"><label class="small">Property Type</label><select id="fType" class="input"><option value="">Any</option><option>Multifamily</option><option>Retail</option><option>Office</option></select></div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <button id="fSearch" class="btn">Search</button>
        <button id="fClear" class="btn-ghost">Clear</button>
        <div style="margin-left:auto; display:flex; gap:8px; align-items:center;">
          <label class="small">Sort</label>
          <select id="fSort" class="input" style="width:180px">
            <option value="price:asc">Price ↑</option>
            <option value="price:desc">Price ↓</option>
            <option value="cap:asc">Cap ↑</option>
            <option value="cap:desc">Cap ↓</option>
            <option value="units:asc">Units ↑</option>
            <option value="units:desc">Units ↓</option>
          </select>
        </div>
      </div>
      <div id="fResults"></div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button id="loadMore" class="btn-ghost">Load more</button><div id="pager" class="small" style="margin-left:auto"></div></div>`;
    container.appendChild(card);

    const fCity = card.querySelector('#fCity');
    const fState = card.querySelector('#fState');
    const fPmin = card.querySelector('#fPmin');
    const fPmax = card.querySelector('#fPmax');
    const fUmin = card.querySelector('#fUmin');
    const fUmax = card.querySelector('#fUmax');
    const fCapMin = card.querySelector('#fCapMin');
    const fType = card.querySelector('#fType');
    const fResults = card.querySelector('#fResults');
    const fSearch = card.querySelector('#fSearch');
    const fClear = card.querySelector('#fClear');
    const fSort = card.querySelector('#fSort');
    const loadMore = card.querySelector('#loadMore');
    const pager = card.querySelector('#pager');

    function applyFilters(){
      const qCity = (fCity.value || '').toLowerCase();
      const qState = (fState.value || '').toLowerCase();
      const pmin = Number(fPmin.value || 0);
      const pmax = Number(fPmax.value || 0);
      const umin = Number(fUmin.value || 0);
      const umax = Number(fUmax.value || 0);
      const capmin = Number(fCapMin.value || 0);
      const ptype = (fType.value || '').toLowerCase();

      let list = sample.filter(s =>
        (!qCity || (s.city||'').toLowerCase().includes(qCity)) &&
        (!qState || (s.state||'').toLowerCase().includes(qState)) &&
        (!pmin || s.price >= pmin) &&
        (!pmax || s.price <= pmax) &&
        (!umin || s.units >= umin) &&
        (!umax || s.units <= umax) &&
        (!capmin || (s.cap || 0) >= capmin) &&
        (!ptype || (s.type || '').toLowerCase() === ptype)
      );

      // sort
      const sortVal = (fSort.value || 'price:asc').split(':');
      const field = sortVal[0], dir = sortVal[1] === 'desc' ? -1 : 1;
      list.sort((a,b) => {
        const va = a[field] || 0; const vb = b[field] || 0;
        if(va < vb) return -1*dir; if(va > vb) return 1*dir; return 0;
      });

      return list;
    }

    function renderResults(list, resetPagination){
      if(resetPagination) page = 1;
      const start = 0;
      const end = page * pageSize;
      const slice = list.slice(start, end);
      fResults.innerHTML = '';
      if(!slice.length) { fResults.innerHTML = '<div class="small">No results</div>'; return; }
      slice.forEach(p=>{
        const card = document.createElement('div'); card.style = 'border:1px solid var(--border);padding:8px;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px';
        card.innerHTML = `<div style="flex:1"><div style="font-weight:700">${p.name}</div><div class="small">${p.city}, ${p.state} • ${p.units} units • ${p.type}</div><div class="small">Price ${fmtMoney(p.price)} • Cap ${fmtPct(p.cap)}</div></div>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:140px;align-items:flex-end"><button class="btn-ghost" data-act="analyze" data-id="${p.id}">Analyze</button><button class="btn" data-act="analyzeSave" data-id="${p.id}">Analyze & Save</button></div>`;
        fResults.appendChild(card);
      });
      pager.textContent = `Showing ${slice.length} of ${list.length}`;
      loadMore.style.display = (list.length > slice.length) ? 'inline-flex' : 'none';
    }

    fSearch.addEventListener('click', ()=>{ const res = applyFilters(); renderResults(res, true); });
    fClear.addEventListener('click', ()=>{
      fCity.value = ''; fState.value = ''; fPmin.value=''; fPmax.value=''; fUmin.value=''; fUmax.value=''; fCapMin.value=''; fType.value='';
      fSort.value = 'price:asc';
      const res = applyFilters(); renderResults(res, true);
    });
    fSort.addEventListener('change', ()=>{ const res = applyFilters(); renderResults(res, true); });
    loadMore.addEventListener('click', ()=>{ page++; const res = applyFilters(); renderResults(res); });

    // click handlers: analyze
    fResults.addEventListener('click', (e)=>{
      const btn = e.target.closest('button');
      if(!btn) return;
      const act = btn.getAttribute('data-act'); const id = Number(btn.getAttribute('data-id'));
      const prop = sample.find(x=>x.id === id); if(!prop) return;
      if(act === 'analyze' || act === 'analyzeSave'){
        State.deal.meta.address = prop.name; State.deal.meta.city = prop.city; State.deal.meta.state = prop.state;
        State.deal.meta.price = prop.price; State.deal.meta.units = prop.units; State.deal.rents.proformaAnnualGross = Math.round((prop.price*(prop.cap||0.06)) + 50000);
        persist();
        renderTabsAndLoad('deal');
        if(act === 'analyzeSave'){ State.savedName = prop.name; persist(); alert('Saved (preview).'); }
      }
    });

    // initial render
    renderResults(sample, true);
    return {render};
  };

})();

/* ===================== Deal Analyzer (inputs, loan, income/exp, APOD, projection, T12) ===================== */
function DealAnalyzerView(){
  const root = document.createElement('div');

  // header & tiles will live global (topTiles). Render an address header
  function renderDealHeader(){
    const m = State.deal.meta || {};
    const wrap = document.createElement('div');
    wrap.className = 'deal-address';
    const addressLine = [safe(m.address,''), [safe(m.city,''), safe(m.state,'')].filter(Boolean).join(', ')].filter(Boolean).join(' • ');
    const left = document.createElement('div');
    left.innerHTML = `<div class="deal-title">${addressLine || 'Untitled Property'}</div><div class="small">Type: ${safe(m.type,'—')} • Units: ${safe(m.units,0)}</div>`;
    const right = document.createElement('div'); right.className = 'kpis';
    const k = computeTopKPIs();
    right.innerHTML = `<span class="kpi">Price: ${fmtMoney(k.price)}</span>
      <span class="kpi">NOI: ${fmtMoney(k.noi)}</span>
      <span class="kpi">Cap: ${fmtPct(k.cap)}</span>
      <span class="kpi">DSCR: ${k.dscr ? k.dscr.toFixed(2) : '—'}</span>`;
    wrap.appendChild(left); wrap.appendChild(right);
    return wrap;
  }

  root.appendChild(renderDealHeader());

  const sectionTabs = document.createElement('div'); sectionTabs.className = 'section-tabs';
  root.appendChild(sectionTabs);
  const content = document.createElement('div'); root.appendChild(content);

  const sections = [
    {id:'inputs', label:'Deal Inputs'},
    {id:'loan', label:'Loan'},
    {id:'income', label:'Income & Expenses'},
    {id:'apod', label:'APOD'},
    {id:'projection', label:'Projection'},
    {id:'t12', label:'T12'}
  ];

  function renderTabs(activeId){
    sectionTabs.innerHTML = '';
    sections.forEach(s=>{
      const tab = document.createElement('div');
      tab.className = 'section-tab' + (s.id===activeId ? ' active' : '');
      tab.textContent = s.label;
      tab.addEventListener('click', ()=>{ renderTabs(s.id); renderContent(s.id); });
      sectionTabs.appendChild(tab);
    });
    const actions = document.createElement('div');
    actions.style.marginLeft = 'auto';
    actions.style.display = 'inline-flex';
    actions.style.gap = '8px';
    actions.innerHTML = `<button id="saveProp" class="btn-ghost">Save</button><button id="sendLOI" class="btn">Send LOI</button>`;
    sectionTabs.appendChild(actions);
  }

  // Inputs with ARV, renovation schedule, acquisition closings, reserves
  function renderInputs(container){
    container.innerHTML = '';
    const card = document.createElement('div'); card.className='card';
    const m = State.deal.meta || {};
    const renBlocks = (State.deal.renovationSchedule||[]).map(r=>`<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><input class="input ren-phase" data-id="${r.id}" value="${r.phase}" /><input class="input ren-cost" data-id="${r.id}" type="number" value="${r.cost||0}" /><button class="btn-ghost ren-del" data-id="${r.id}">Remove</button></div>`).join('');
    card.innerHTML = `<h3>Deal Inputs</h3>
      <div class="form-grid">
        <div class="field"><label class="small">Address</label><input name="address" class="input" value="${(m.address||'')}" /></div>
        <div class="field"><label class="small">City</label><input name="city" class="input" value="${(m.city||'')}" /></div>
        <div class="field"><label class="small">State</label><input name="state" class="input" value="${(m.state||'')}" maxlength="2" /></div>
        <div class="field"><label class="small">Units</label><input name="units" class="input" type="number" value="${Number(m.units||0)}" /></div>
        <div class="field"><label class="small">Price</label><input name="price" class="input" type="number" value="${Number(m.price||0)}" /></div>
        <div class="field"><label class="small">Down Payment %</label><input name="downPaymentPct" class="input" type="number" step="0.01" value="${Number(m.downPaymentPct||0)}" /></div>
        <div class="field"><label class="small">Repair Budget</label><input name="repairBudget" class="input" type="number" value="${Number(m.repairBudget||0)}" /></div>
        <div class="field"><label class="small">Acquisition Costs</label><input name="acquisitionCosts" class="input" type="number" value="${Number(m.acquisitionCosts||0)}" /></div>
        <div class="field"><label class="small">Closing Costs %</label><input name="closingCostsPct" class="input" type="number" step="0.001" value="${Number(m.closingCostsPct||0)}" /></div>
        <div class="field"><label class="small">ARV (after rehab)</label><input name="arv" class="input" type="number" value="${Number(m.arv||0)}" /></div>
        <div class="field"><label class="small">Reserves / month</label><input name="reservesMonthly" class="input" type="number" value="${Number(m.reservesMonthly||0)}" /></div>
        <div class="field"><label class="small">Year Built</label><input name="yearBuilt" class="input" type="number" value="${Number(m.yearBuilt||0)}" /></div>
      </div>
      <h4 style="margin-top:12px">Renovation Schedule</h4>
      <div id="renList">${renBlocks || '<div class="small">No phases</div>'}</div>
      <div style="margin-top:8px;display:flex;gap:8px"><input id="renPhase" class="input" placeholder="Phase name"/><input id="renCost" class="input" type="number" placeholder="Cost" /><button id="addRen" class="btn">Add Phase</button></div>`;
    container.appendChild(card);

    // bind inputs
    card.querySelectorAll('input[name]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const name = inp.name;
        const val = inp.type === 'number' ? Number(inp.value || 0) : inp.value;
        State.deal.meta[name] = val;
        persist();
        // rerender header & tiles
        const hdr = root.querySelector('.deal-address');
        if(hdr && hdr.parentNode) hdr.replaceWith(renderDealHeader());
        updateTopTiles();
      });
    });

    // ren phasing
    const renList = card.querySelector('#renList');
    card.querySelector('#addRen').addEventListener('click', ()=>{
      const name = card.querySelector('#renPhase').value || 'Phase ' + (State.deal.renovationSchedule.length + 1);
      const cost = Number(card.querySelector('#renCost').value || 0);
      State.deal.renovationSchedule.push({id:uuid(), phase:name, cost});
      persist();
      renderInputs(container);
    });
    renList.addEventListener('click', (e)=>{
      const del = e.target.closest('.ren-del');
      if(!del) return;
      const id = Number(del.getAttribute('data-id'));
      State.deal.renovationSchedule = (State.deal.renovationSchedule||[]).filter(r=>r.id !== id);
      persist();
      renderInputs(container);
    });
  }

  // Loan view with interest-only toggle, amortization years, DSCR calc & schedule
  function renderLoan(container){
    container.innerHTML = '';
    const card = document.createElement('div'); card.className='card';
    const loans = State.loanScenarios || [];
    card.innerHTML = `<h3>Loan Scenarios</h3>
      <div style="margin-bottom:8px"><select id="loanSelect" class="input"></select></div>
      <div id="loanEditor"></div>
      <div style="margin-top:8px"><button id="addLoan" class="btn">Add</button> <button id="cloneLoan" class="btn-ghost">Clone</button></div>
      <div style="margin-top:12px"><h4>Payment Schedule (preview)</h4><div id="loanSchedule"></div></div>`;
    container.appendChild(card);
    const loanSelect = card.querySelector('#loanSelect');

    function rebuild(){
      loanSelect.innerHTML = '';
      (State.loanScenarios||[]).forEach(s=>{
        const o = document.createElement('option');
        o.value = s.id; o.textContent = s.name || ('Loan '+s.id);
        loanSelect.appendChild(o);
      });
      if((State.loanScenarios||[]).length) loanSelect.value = State.loanScenarios[0].id;
      renderEditor();
      renderSchedule();
    }

    function renderEditor(){
      const selId = Number(loanSelect.value);
      const s = (State.loanScenarios||[]).find(x=>Number(x.id)===selId);
      const ed = card.querySelector('#loanEditor'); ed.innerHTML = '';
      if(!s){ ed.innerHTML = '<p class="small">No scenario</p>'; return; }
      ed.innerHTML = `<div class="form-grid">
          <div class="field"><label class="small">Name</label><input name="lname" class="input" value="${safe(s.name,'')}" /></div>
          <div class="field"><label class="small">Loan Amount</label><input name="loanAmount" class="input" type="number" value="${Number(s.loanAmount||0)}" /></div>
          <div class="field"><label class="small">Interest Rate %</label><input name="interestRate" class="input" type="number" step="0.001" value="${Number((s.interestRate||0)*100)}" /></div>
          <div class="field"><label class="small">Term (yrs)</label><input name="termYears" class="input" type="number" value="${Number(s.termYears||0)}" /></div>
          <div class="field"><label class="small">Amortization Years</label><input name="amortizationYears" class="input" type="number" value="${Number(s.amortizationYears||0)}" /></div>
          <div class="field"><label class="small">Interest Only Years</label><input name="interestOnlyYears" class="input" type="number" value="${Number(s.interestOnlyYears||0)}" /></div>
        </div>
        <div style="margin-top:8px"><button id="calcDSCR" class="btn-ghost">Calc DSCR (NOI / DebtService)</button></div>
        <div style="margin-top:8px" id="loanKPIs"></div>`;
      ed.querySelectorAll('input').forEach(inp=>{
        inp.addEventListener('change', ()=>{
          const n = inp.name;
          if(n === 'interestRate'){ s.interestRate = Number(inp.value || 0)/100; }
          else if(n === 'lname'){ s.name = inp.value; }
          else { s[n] = inp.type === 'number' ? Number(inp.value || 0) : inp.value; }
          persist(); rebuild();
        });
      });
      ed.querySelector('#calcDSCR').addEventListener('click', ()=>{
        const ds = yearlyDebtService(s);
        const noi = computeNOI().noi;
        const dscr = ds ? (noi / ds) : 0;
        const el = ed.querySelector('#loanKPIs');
        el.innerHTML = `<div class="small">Debt Service (Y1): ${fmtMoney(ds)} • DSCR: ${dscr ? dscr.toFixed(2) : '—'}</div>`;
      });
    }

    function renderSchedule(){
      const selId = Number(loanSelect.value);
      const s = (State.loanScenarios||[]).find(x=>Number(x.id)===selId);
      const out = card.querySelector('#loanSchedule'); out.innerHTML = '';
      if(!s) return;
      // simple yearly schedule for the first N years (term or 10)
      const years = Math.min(20, s.termYears || 30);
      const rows = [];
      let bal = s.loanAmount || 0;
      for(let y=1;y<=years;y++){
        let yearlyInterest = 0, yearlyPrincipal = 0, payment = 0;
        if(y <= (s.interestOnlyYears||0)){
          yearlyInterest = bal * (s.interestRate || 0);
          payment = yearlyInterest;
          yearlyPrincipal = 0;
        } else {
          const mPayment = monthlyPayment(bal, s.interestRate||0, s.amortizationYears||s.termYears||30);
          payment = mPayment * 12;
          // amortize year by year (approximate)
          let principalPaid = 0, interestPaid = 0;
          let monthlyBal = bal;
          for(let mo=0; mo<12; mo++){
            const monthlyInterest = monthlyBal * (s.interestRate||0)/12;
            const monthlyPrincipal = mPayment - monthlyInterest;
            principalPaid += monthlyPrincipal; interestPaid += monthlyInterest;
            monthlyBal -= monthlyPrincipal;
          }
          yearlyPrincipal = principalPaid; yearlyInterest = interestPaid;
          bal = monthlyBal;
        }
        rows.push({year:y, payment, interest: yearlyInterest, principal: yearlyPrincipal, balance: bal});
      }
      // build table
      const html = `<table style="width:100%"><thead><tr><th>Year</th><th style="text-align:right">Payment</th><th style="text-align:right">Interest</th><th style="text-align:right">Principal</th><th style="text-align:right">Balance</th></tr></thead>
        <tbody>${rows.map(r=>`<tr><td>Y${r.year}</td><td style="text-align:right">${fmtMoney(r.payment)}</td><td style="text-align:right">${fmtMoney(r.interest)}</td><td style="text-align:right">${fmtMoney(r.principal)}</td><td style="text-align:right">${fmtMoney(r.balance)}</td></tr>`).join('')}</tbody></table>`;
      out.innerHTML = html;
    }

    card.querySelector('#addLoan').addEventListener('click', ()=>{
      const id = uuid();
      const copy = { id, name: 'New Loan', loanAmount: 0, interestRate: 0.05, termYears:30, amortizationYears:30, interestOnlyYears:0 };
      State.loanScenarios.push(copy); persist(); rebuild();
    });
    card.querySelector('#cloneLoan').addEventListener('click', ()=>{
      const selId = Number(loanSelect.value);
      const s = (State.loanScenarios||[]).find(x=>Number(x.id)===selId);
      if(!s) return;
      const id = uuid(); const copy = JSON.parse(JSON.stringify(s)); copy.id = id; copy.name = s.name + ' (copy)';
      State.loanScenarios.push(copy); persist(); rebuild();
    });
    loanSelect.addEventListener('change', ()=>{ renderEditor(); renderSchedule(); });
    rebuild();
    // observe updates (rebuild on state change)
  }

  // Income & Expenses with presets, percentage-based entries, CSV import
  function renderIncomeExpenses(container){
    container.innerHTML = '';
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<h3>Income & Expenses</h3>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <button id="addIncome" class="btn-ghost">Add Income</button>
        <button id="addExpense" class="btn-ghost">Add Expense</button>
        <button id="preset" class="btn-ghost">Apply Preset</button>
        <input id="csvInput" type="file" accept=".csv" style="margin-left:auto" />
      </div>
      <div id="incomeList"></div>
      <div style="height:10px"></div>
      <div id="expenseList"></div>
      <div style="margin-top:12px" class="chart-wrap"><canvas id="ieCanvas" style="width:100%;height:120px"></canvas></div>
      <div class="totals-row"><span class="total-badge" id="totInc">Income: $0</span><span class="total-badge" id="totExp">Expenses: $0</span><span class="total-badge" id="totNOI">NOI: $0</span></div>`;
    container.appendChild(card);

    const incDiv = card.querySelector('#incomeList');
    const expDiv = card.querySelector('#expenseList');
    const canvas = card.querySelector('#ieCanvas');
    const csvInput = card.querySelector('#csvInput');

    function render(){
      incDiv.innerHTML = '<h4 class="small">Income</h4>';
      (State.apod.incomes||[]).forEach((it,i)=>{
        const row = document.createElement('div'); row.className='item-row';
        row.innerHTML = `<input class="input inc-label" data-i="${i}" value="${safe(it.label,'')}" /><input class="input inc-amt" data-i="${i}" type="number" value="${Number(it.amount||0)}" /><button class="btn-ghost inc-del" data-i="${i}">Remove</button>`;
        incDiv.appendChild(row);
      });
      expDiv.innerHTML = '<h4 class="small">Expenses (toggle % of EGI)</h4>';
      (State.apod.expenses||[]).forEach((it,i)=>{
        const row = document.createElement('div'); row.className='item-row';
        row.innerHTML = `<input class="input exp-label" data-i="${i}" value="${safe(it.label,'')}" />
          <input class="input exp-amt" data-i="${i}" type="number" value="${Number(it.amount||0)}" />
          <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" class="exp-pct" data-i="${i}" ${it.pctOfEGI ? 'checked' : ''} /> pct of EGI</label>
          <button class="btn-ghost exp-del" data-i="${i}">Remove</button>`;
        expDiv.appendChild(row);
      });
      bind();
      totalsAndChart();
    }

    function bind(){
      // incomes
      incDiv.querySelectorAll('.inc-del').forEach(b=>b.addEventListener('click', ()=>{ const i=Number(b.getAttribute('data-i')); State.apod.incomes.splice(i,1); persist(); render(); updateTopTiles(); }));
      incDiv.querySelectorAll('.inc-label').forEach(inp=>inp.addEventListener('change', ()=>{ const i=Number(inp.getAttribute('data-i')); State.apod.incomes[i].label = inp.value; persist(); updateTopTiles(); }));
      incDiv.querySelectorAll('.inc-amt').forEach(inp=>inp.addEventListener('change', ()=>{ const i=Number(inp.getAttribute('data-i')); State.apod.incomes[i].amount = Number(inp.value||0); persist(); totalsAndChart(); updateTopTiles(); }));

      // expenses
      expDiv.querySelectorAll('.exp-del').forEach(b=>b.addEventListener('click', ()=>{ const i=Number(b.getAttribute('data-i')); State.apod.expenses.splice(i,1); persist(); render(); updateTopTiles(); }));
      expDiv.querySelectorAll('.exp-label').forEach(inp=>inp.addEventListener('change', ()=>{ const i=Number(inp.getAttribute('data-i')); State.apod.expenses[i].label = inp.value; persist(); totalsAndChart(); updateTopTiles(); }));
      expDiv.querySelectorAll('.exp-amt').forEach(inp=>inp.addEventListener('change', ()=>{ const i=Number(inp.getAttribute('data-i')); State.apod.expenses[i].amount = Number(inp.value||0); persist(); totalsAndChart(); updateTopTiles(); }));
      expDiv.querySelectorAll('.exp-pct').forEach(cb=>cb.addEventListener('change', ()=>{ const i=Number(cb.getAttribute('data-i')); State.apod.expenses[i].pctOfEGI = cb.checked; persist(); totalsAndChart(); updateTopTiles(); }));
    }

    function totalsAndChart(){
      const incTotal = (State.apod.incomes||[]).reduce((s,i)=>s + Number(i.amount||0), 0);
      const expPct = (State.apod.expenses||[]).reduce((s,e)=> s + (e.pctOfEGI ? 0 : Number(e.amount||0)), 0);
      const expPctCalc = (State.apod.expenses||[]).reduce((s,e)=> s + (e.pctOfEGI ? ((Number(e.amount||0)/100)*incTotal) : 0), 0);
      const expTotal = expPct + expPctCalc;
      const noi = incTotal - expTotal;
      card.querySelector('#totInc').textContent = 'Income: ' + fmtMoney(incTotal);
      card.querySelector('#totExp').textContent = 'Expenses: ' + fmtMoney(expTotal);
      card.querySelector('#totNOI').textContent = 'NOI: ' + fmtMoney(noi);
      try { drawBarChart(canvas, ['Income','Expenses','NOI'], [incTotal, expTotal, noi], ['rgba(34,197,94,0.9)','rgba(245,158,11,0.9)','rgba(15,76,129,0.9)']); } catch(e){}
    }

    // controls
    card.querySelector('#addIncome').addEventListener('click', ()=>{ State.apod.incomes.push({label:'New Income', amount:0}); persist(); render(); updateTopTiles(); });
    card.querySelector('#addExpense').addEventListener('click', ()=>{ State.apod.expenses.push({label:'New Expense', amount:0, pctOfEGI:false}); persist(); render(); updateTopTiles(); });
    card.querySelector('#preset').addEventListener('click', ()=>{ // sample preset
      State.apod.incomes = [{label:'Unit Income', amount: State.deal.rents.proformaAnnualGross || 0}];
      State.apod.expenses = [
        {label:'Taxes', amount:7100, pctOfEGI:false},
        {label:'Insurance', amount:6585, pctOfEGI:false},
        {label:'Maint/Repair', amount:9760, pctOfEGI:false},
        {label:'Utilities', amount:7299, pctOfEGI:false},
        {label:'Management', amount: (State.deal.rents.proformaAnnualGross || 0) * 0.05, pctOfEGI:true},
        {label:'Reserves', amount:3500, pctOfEGI:false}
      ];
      persist(); render(); updateTopTiles();
    });

    // CSV import: simple format: type,label,amount,pctOfEGI
    csvInput.addEventListener('change', (e)=>{
      const f = e.target.files[0]; if(!f) return;
      const reader = new FileReader();
      reader.onload = function(ev){
        const txt = ev.target.result;
        const rows = txt.split(/?
/).map(r => r.trim()).filter(Boolean);
        rows.forEach(r=>{
          const cols = r.split(',');
          if(cols.length < 3) return;
          const type = cols[0].trim().toLowerCase();
          const label = cols[1].trim();
          const amount = Number(cols[2].trim()||0);
          const pct = (cols[3] && cols[3].trim().toLowerCase().startsWith('p')) ? true : false;
          if(type === 'income') State.apod.incomes.push({label, amount});
          else State.apod.expenses.push({label, amount, pctOfEGI: pct});
        });
        persist(); render(); updateTopTiles();
      };
      reader.readAsText(f);
      csvInput.value = '';
    });

    render();
  }

  // APOD with extra KPIs (CoC, GRM, DCR) and print-friendly
  function renderAPOD(container){
    container.innerHTML = '';
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<h3>APOD — Summary</h3><div id="apodReport"></div>
      <div style="margin-top:10px;display:flex;gap:8px"><button id="exportAPODCSV" class="btn-ghost">Export CSV</button><button id="printAPOD" class="btn-ghost">Print View</button></div>`;
    container.appendChild(card);

    function renderReport(){
      const incTotal = (State.apod.incomes||[]).reduce((s,i)=>s + Number(i.amount||0), 0);
      const expenseTotal = (State.apod.expenses||[]).reduce((s,e)=> s + (e.pctOfEGI ? ((Number(e.amount||0)/100)*incTotal) : Number(e.amount||0)), 0);
      const noi = incTotal - expenseTotal;
      const price = Number((State.deal.meta && State.deal.meta.price) || 0);
      const cap = price ? (noi/price) : 0;
      const loan = (State.loanScenarios||[])[0];
      const ds = loan ? yearlyDebtService(loan) : 0;
      const cf = noi - ds;
      const equity = price * Number(State.deal.meta.downPaymentPct || 0);
      const coc = equity ? (cf / equity) : 0;
      const grm = price && incTotal ? (price / incTotal) : 0;
      const dcr = ds ? (noi / ds) : 0;
      const div = card.querySelector('#apodReport');
      div.innerHTML = `<table style="width:100%"><tbody>
        <tr><td><strong>Price</strong></td><td style="text-align:right">${fmtMoney(price)}</td></tr>
        <tr><td><strong>Income Total (EGI)</strong></td><td style="text-align:right">${fmtMoney(incTotal)}</td></tr>
        <tr><td><strong>Operating Expenses</strong></td><td style="text-align:right">${fmtMoney(expenseTotal)}</td></tr>
        <tr><td><strong>NOI</strong></td><td style="text-align:right">${fmtMoney(noi)}</td></tr>
        <tr><td><strong>Cap Rate</strong></td><td style="text-align:right">${fmtPct(cap)}</td></tr>
        <tr><td><strong>Debt Service (Y1)</strong></td><td style="text-align:right">${fmtMoney(ds)}</td></tr>
        <tr><td><strong>Cash Flow (Y1)</strong></td><td style="text-align:right">${fmtMoney(cf)}</td></tr>
        <tr><td><strong>Cash-on-Cash (CoC)</strong></td><td style="text-align:right">${fmtPct(coc)}</td></tr>
        <tr><td><strong>GRM</strong></td><td style="text-align:right">${grm ? grm.toFixed(2) : '—'}</td></tr>
        <tr><td><strong>DSCR</strong></td><td style="text-align:right">${dcr ? dcr.toFixed(2) : '—'}</td></tr>
      </tbody></table>`;
    }

    card.querySelector('#exportAPODCSV').addEventListener('click', ()=>{
      const rows = [['Metric','Value']];
      const incTotal = (State.apod.incomes||[]).reduce((s,i)=>s + Number(i.amount||0), 0);
      rows.push(['Income Total', incTotal]);
      (State.apod.incomes||[]).forEach(i=> rows.push([i.label, i.amount]));
      rows.push([]);
      (State.apod.expenses||[]).forEach(e=> rows.push([e.label, e.pctOfEGI ? f"{e.amount}% of EGI" : e.amount]));
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('
');
      const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'apod.csv'; a.click(); URL.revokeObjectURL(url);
    });

    card.querySelector('#printAPOD').addEventListener('click', ()=>{
      const w = window.open('', '_blank', 'width=800,height=900');
      const html = `<html><head><title>APOD Print</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:18px}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #ddd}</style></head><body>
        <h2>APOD — ${safe(State.deal.meta.address,'Property')}</h2>${card.querySelector('#apodReport').innerHTML}
        <div style="margin-top:20px"><em>Generated by GroLinx v1.6</em></div></body></html>`;
      w.document.write(html);
      w.document.close();
      w.print();
    });

    renderReport();
    container.appendChild(card);
  }

  // Projection: multi-year cash flow
  function renderProjection(container){
    container.innerHTML = '';
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<h3>Projection</h3>
      <div class="form-grid">
        <div class="field"><label class="small">Hold (yrs)</label><input id="projYears" class="input" type="number" value="5" min="1" max="30" /></div>
        <div class="field"><label class="small">Annual Rent Growth %</label><input id="projRentGrowth" class="input" type="number" step="0.001" value="${Number(State.deal.rents.annualRentGrowthPct||0.03)}" /></div>
        <div class="field"><label class="small">Annual Expense Growth %</label><input id="projExpGrowth" class="input" type="number" step="0.001" value="${Number(State.deal.expenses.expenseGrowthPct||0.05)}" /></div>
        <div class="field"><label class="small">Sale Cap Rate</label><input id="projCap" class="input" type="number" step="0.001" value="${Number(State.deal.returnAssumptions.saleCapRate||0.06)}" /></div>
      </div>
      <div id="projTable" style="margin-top:10px"></div>`;
    container.appendChild(card);

    function build(){
      const years = Number(card.querySelector('#projYears').value || 5);
      const rg = Number(card.querySelector('#projRentGrowth').value || 0);
      const eg = Number(card.querySelector('#projExpGrowth').value || 0);
      const saleCap = Number(card.querySelector('#projCap').value || 0.06);
      let gross = Number(State.deal.rents.proformaAnnualGross || 0);
      let expenses = Number(State.deal.expenses.annualExpensesProforma || 0);
      const loan = (State.loanScenarios||[])[0];
      const dsY = loan ? yearlyDebtService(loan) : 0;
      const rows = [];
      let cumulativeCF = 0;
      for(let y=1;y<=years;y++){
        const egi = gross * (1 - Number(State.deal.rents.vacancyPct || 0));
        const noi = egi - expenses;
        const saleProceeds = (y === years) ? ( (noi / saleCap) * (1 - (State.deal.returnAssumptions.sellingCostsPct || 0.05)) ) : 0;
        const cf = noi - dsY;
        cumulativeCF += cf;
        rows.push({year:y, egi, expenses, noi, ds: dsY, cf, saleProceeds, cumulativeCF});
        gross *= (1+rg); expenses *= (1+eg);
      }
      const html = `<table style="width:100%"><thead><tr><th>Year</th><th style="text-align:right">EGI</th><th style="text-align:right">Expenses</th><th style="text-align:right">NOI</th><th style="text-align:right">DebtSvc</th><th style="text-align:right">CashFlow</th><th style="text-align:right">Sale Proceeds</th></tr></thead>
        <tbody>${rows.map(r=>`<tr><td>Y${r.year}</td><td style="text-align:right">${fmtMoney(r.egi)}</td><td style="text-align:right">${fmtMoney(r.expenses)}</td><td style="text-align:right">${fmtMoney(r.noi)}</td><td style="text-align:right">${fmtMoney(r.ds)}</td><td style="text-align:right">${fmtMoney(r.cf)}</td><td style="text-align:right">${fmtMoney(r.saleProceeds)}</td></tr>`).join('')}</tbody></table>`;
      card.querySelector('#projTable').innerHTML = html;
    }
    card.querySelector('#projYears').addEventListener('change', build);
    card.querySelector('#projRentGrowth').addEventListener('change', build);
    card.querySelector('#projExpGrowth').addEventListener('change', build);
    card.querySelector('#projCap').addEventListener('change', build);
    build();
  }

  // T12 editor: inline editing per month + import/export CSV
  function renderT12(container){
    container.innerHTML = '';
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<h3>T12 — Trailing 12</h3>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <button id="fillEven" class="btn-ghost">Fill Even (from Proforma)</button>
        <button id="clear" class="btn-ghost">Clear</button>
        <button id="exportCSV" class="btn-ghost">Export CSV</button>
        <input id="t12Import" type="file" accept=".csv" style="margin-left:auto" />
      </div>
      <div id="t12Table"></div>`;
    container.appendChild(card);

    // store minimal in-memory
    let data = { incomeMonths: Array(12).fill(0), expenseMonths: Array(12).fill(0) };

    function getLabels(){
      const d = new Date();
      const arr = [];
      for(let i=0;i<12;i++){
        const copy = new Date(d.getFullYear(), d.getMonth() - (11 - i), 1);
        arr.push(copy.toLocaleString(undefined,{month:'short', year:'2-digit'}));
      }
      return arr;
    }

    function renderTable(){
      const labels = getLabels();
      const rows = `<table style="width:100%"><thead><tr><th>Line</th>${labels.map(l=>`<th style="text-align:right">${l}</th>`).join('')}<th style="text-align:right">Total</th></tr></thead>
        <tbody>
          <tr><td>Income</td>${data.incomeMonths.map((v,i)=>`<td style="text-align:right"><input class="t12-in" data-i="${i}" style="width:100px;text-align:right" value="${v}" /></td>`).join('')}<td style="text-align:right"><strong>${fmtMoney(data.incomeMonths.reduce((s,v)=>s+Number(v||0),0))}</strong></td></tr>
          <tr><td>Expenses</td>${data.expenseMonths.map((v,i)=>`<td style="text-align:right"><input class="t12-exp" data-i="${i}" style="width:100px;text-align:right" value="${v}" /></td>`).join('')}<td style="text-align:right"><strong>${fmtMoney(data.expenseMonths.reduce((s,v)=>s+Number(v||0),0))}</strong></td></tr>
          <tr><td>NOI</td>${data.incomeMonths.map((v,i)=>`<td style="text-align:right">${fmtMoney((Number(v||0) - Number(data.expenseMonths[i]||0)))}</td>`).join('')}<td style="text-align:right"><strong>${fmtMoney(data.incomeMonths.reduce((s,v)=>s+Number(v||0),0) - data.expenseMonths.reduce((s,v)=>s+Number(v||0),0))}</strong></td></tr>
        </tbody></table>`;
      card.querySelector('#t12Table').innerHTML = rows;
      bindInputs();
    }

    function bindInputs(){
      card.querySelectorAll('.t12-in').forEach(inp => inp.addEventListener('change', ()=>{
        const i = Number(inp.getAttribute('data-i'));
        data.incomeMonths[i] = Number(inp.value || 0);
        renderTable();
      }));
      card.querySelectorAll('.t12-exp').forEach(inp => inp.addEventListener('change', ()=>{
        const i = Number(inp.getAttribute('data-i'));
        data.expenseMonths[i] = Number(inp.value || 0);
        renderTable();
      }));
    }

    card.querySelector('#fillEven').addEventListener('click', ()=>{
      const inc = Math.round(Number(State.deal.rents.proformaAnnualGross || 0) / 12);
      const exp = Math.round(Number(State.deal.expenses.annualExpensesProforma || 0) / 12);
      data.incomeMonths = Array(12).fill(inc);
      data.expenseMonths = Array(12).fill(exp);
      renderTable();
    });
    card.querySelector('#clear').addEventListener('click', ()=>{ data.incomeMonths = Array(12).fill(0); data.expenseMonths = Array(12).fill(0); renderTable(); });
    card.querySelector('#exportCSV').addEventListener('click', ()=>{
      const labels = getLabels();
      const rows = [['Month','Income','Expense','NOI']].concat(labels.map((l,i)=>[l, data.incomeMonths[i]||0, data.expenseMonths[i]||0, (Number(data.incomeMonths[i]||0) - Number(data.expenseMonths[i]||0))]));
      const csv = rows.map(r => r.join(',')).join('
');
      const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 't12.csv'; a.click(); URL.revokeObjectURL(url);
    });

    card.querySelector('#t12Import').addEventListener('change', (e)=>{
      const f = e.target.files[0]; if(!f) return;
      const reader = new FileReader();
      reader.onload = function(ev){
        const txt = ev.target.result;
        const rows = txt.split(/?
/).map(r=>r.trim()).filter(Boolean);
        // expect header + rows: Month,Income,Expense,...
        const inc = [], exp = [];
        rows.slice(1).forEach(r=>{
          const c = r.split(',');
          if(c.length >= 3){
            inc.push(Number(c[1]||0)); exp.push(Number(c[2]||0));
          }
        });
        if(inc.length === 12){
          data.incomeMonths = inc; data.expenseMonths = exp;
          renderTable();
        } else alert('Import expects 12 rows of Month,Income,Expense');
      };
      reader.readAsText(f);
      e.target.value = '';
    });

    renderTable();
  }

  // render selected section
  function renderContent(id){
    content.innerHTML = '';
    if(id === 'inputs') renderInputs(content);
    else if(id === 'loan') renderLoan(content);
    else if(id === 'income') renderIncomeExpenses(content);
    else if(id === 'apod') renderAPOD(content);
    else if(id === 'projection') renderProjection(content);
    else if(id === 't12') renderT12(content);
  }

  renderTabs('inputs');
  renderContent('inputs');

  // Save / LOI buttons
  root.addEventListener('click', (e)=>{
    const t = e.target;
    if(t && t.id === 'saveProp'){ const name = prompt('Name this property for saving', State.deal.meta.address || 'Saved Deal'); if(name !== null) { State.savedName = name; persist(); alert('Saved (preview).'); } }
    if(t && t.id === 'sendLOI'){ alert('LOI generation is stubbed in preview. In production, a doc would be generated and emailed.'); }
  });

  return root;
}

/* ===================== Dashboard & Docs (lightweight) ===================== */
function DashboardView(){
  const d = document.createElement('div'); d.className = 'card';
  d.innerHTML = `<h3>Investor Dashboard</h3><div id="dashContent"></div>`;
  const content = d.querySelector('#dashContent');
  content.innerHTML = `<div class="small">Saved Deal: ${safe(State.savedName,'(none)')}</div><div style="margin-top:8px" class="small">Quick summary</div>`;
  return d;
}
function DocsView(){
  const d = document.createElement('div'); d.className = 'card';
  d.innerHTML = `<h3>Docs & Exports</h3><div class="small">CSV export present in many screens. XLSX/docx export available in production builds.</div>`;
  return d;
}

/* ===================== App Boot & Routing ===================== */
const TOP_TABS = [
  {id:'dashboard', label:'Investor Dashboard'},
  {id:'finder', label:'Investment Finder'},
  {id:'deal', label:'Deal Analyzer'},
  {id:'docs', label:'Docs & Exports'}
];

const topTabsWrap = document.getElementById('tabsRow');
const appRoot = document.getElementById('app');

function renderTopTabs(activeId){
  topTabsWrap.innerHTML = '';
  TOP_TABS.forEach(t=>{
    const b = document.createElement('button');
    b.className = 'pill' + (t.id === activeId ? ' active' : '');
    b.textContent = t.label;
    b.addEventListener('click', ()=>{ renderTopTabs(t.id); renderTabsAndLoad(t.id); });
    topTabsWrap.appendChild(b);
  });
}

function getViewById(id){
  if(id === 'dashboard') return DashboardView();
  if(id === 'finder') {
    const node = document.createElement('div');
    Finder().render(node); return node;
  }
  if(id === 'deal') return DealAnalyzerView();
  if(id === 'docs') return DocsView();
  return DashboardView();
}

function renderTabsAndLoad(activeId){
  renderTopTabs(activeId);
  appRoot.innerHTML = '';
  appRoot.appendChild(getViewById(activeId));
  updateTopTiles();
  // re-render dashboard tiles header if present
  const hdr = document.querySelector('.deal-address');
  if(hdr && hdr.parentNode){
    hdr.replaceWith(hdr); // noop to keep DOM stable (header updated by views)
  }
}

/* theme toggle wiring */
(function(){
  const btn = document.getElementById('themeToggle');
  const initial = localStorage.getItem('rei_theme') || 'light';
  document.documentElement.setAttribute('data-theme', initial);
  function updateBtn(){
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    btn.style.color = cur === 'light' ? '#0b2138' : '#ffffff';
    btn.style.borderColor = cur === 'light' ? '#d1e3f6' : '#ffffff';
    btn.textContent = cur === 'light' ? 'Switch to Dark' : 'Switch to Light';
  }
  updateBtn();
  btn.addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const n = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', n);
    localStorage.setItem('rei_theme', n);
    updateBtn();
  });
})();

/* initial boot */
renderTabsAndLoad('finder');
updateTopTiles();

/* expose helper for programmatic navigation */
window.renderTabsAndLoad = renderTabsAndLoad;
