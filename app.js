/* app.js — GroLinx extended external app (UTF-8, no BOM) */
(function(){
  'use strict';
  console.log('GroLinx v1.3.8 starting', new Date().toISOString());

  // Helpers
  function money(n,d){ d = (typeof d === 'number')? d:0; if(n==null || isNaN(n)) return '-'; return '$'+Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}); }
  function pct(n){ if(n==null || isNaN(n)) return '-'; return (Number(n)*100).toFixed(2)+'%'; }
  function monthlyPI(loan, annualRate, years){ if(!loan || !years) return 0; var r=(annualRate||0)/12; var n=years*12; if(r===0) return loan/n; return loan*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1); }

  // Missing helpers (added)
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function buildPeriod(startMonth, startYear){
    var labels=[], m=startMonth, y=startYear;
    for(var i=0;i<12;i++){
      labels.push({m:m,y:y,label: MONTHS[m] + ' ' + y});
      m=(m+1)%12;
      if(m===0) y+=1;
    }
    return labels;
  }

  // Local storage keys
  var LS_THEME = 'grolinx_theme';
  var LS_ACTIVE = 'grolinx_active';
  var LS_PROFILE = 'grolinx_profile';

  // Initial state
  var state = {
    activeModule: localStorage.getItem(LS_ACTIVE) || 'dealanalyzer',
    modules: [
      {id:'dashboard',label:'Investor Dashboard'},
      {id:'finder',label:'Investment Finder'},
      {id:'dealanalyzer',label:'Deal Analyzer'}
    ],
    isEnterprise: false,
    profile: JSON.parse(localStorage.getItem(LS_PROFILE) || JSON.stringify({name:'GroLinx User', email:'user@grolinx.com', commitment:250000})),
    investors: [
      {id:1,name:'Acme Capital',contact:'invest@acme.com',committed:2000000,deployed:1200000},
      {id:2,name:'BluePeak LP',contact:'team@bluepeak.com',committed:1000000,deployed:450000}
    ],
    deal: { name:'123 Main St', market:'Anytown, USA', price:1500000, units:14, downPct:0.35, downAmt:525000, loanAmt:975000, rate:0.065, termYears:30, closingCostPct:0.03, rehab:50000, vacancyRate:0.06, otherIncome:0, saleCap:0.06, sellCostPct:0.05 },
    scenarios: [
      {id:1,name:'Base (65% LTV 6.5% 30yr)',loanAmt:975000,rate:0.065,termYears:30},
      {id:2,name:'Alt (70% LTV 6.75% 30yr)',loanAmt:1050000,rate:0.0675,termYears:30}
    ],
    t12: { startMonth:(new Date()).getMonth(), startYear:(new Date()).getFullYear()-1, rows:[
      {id:1,category:'Taxes',months:Array(12).fill(7100/12)},
      {id:2,category:'Insurance',months:Array(12).fill(6585/12)},
      {id:3,category:'Maintenance',months:Array(12).fill(9760/12)}
    ] }
  };

  // Theme
  function applyTheme(t){ if(t==='dark') document.documentElement.setAttribute('data-theme','dark'); else document.documentElement.removeAttribute('data-theme'); localStorage.setItem(LS_THEME,t); }
  var savedTheme = localStorage.getItem(LS_THEME) || 'light'; applyTheme(savedTheme);

  // Utility: clear children
  function clear(el){ while(el && el.firstChild) el.removeChild(el.firstChild); }

  // Render tabs
  function renderModuleTabs(){
    var bar = document.getElementById('tabsbar'); if(!bar) return;
    clear(bar);
    for(var i=0;i<state.modules.length;i++){
      (function(m){
        var btn = document.createElement('button');
        btn.className = 'pill' + (state.activeModule===m.id? ' active':'');
        btn.textContent = m.label;
        btn.addEventListener('click', function(){
          state.activeModule = m.id;
          localStorage.setItem(LS_ACTIVE, m.id);
          render();
        });
        bar.appendChild(btn);
      })(state.modules[i]);
    }
    var plan = document.getElementById('planLabel'); if(plan) plan.textContent = (state.isEnterprise? 'Plan: Enterprise' : 'Plan: Basic');
  }

  // Dashboard
  function renderDashboard(root){
    var card = document.createElement('div'); card.className='card';
    var html = '';
    html += '<div style="font-weight:800;margin-bottom:8px">Investor Dashboard</div>';
    html += '<div class="muted-small">Profile</div>';
    html += '<div style="margin-top:8px">';
    html += '<div class="field"><label>Name</label><input id="pName" value="'+escapeHtml(state.profile.name)+'"></div>';
    html += '<div class="field"><label>Email</label><input id="pEmail" value="'+escapeHtml(state.profile.email)+'"></div>';
    html += '<div class="field"><label>Commitment</label><input id="pCommit" type="number" value="'+(state.profile.commitment||0)+'"></div>';
    html += '<div style="margin-top:8px"><button id="saveProfile" class="btn">Save Profile</button></div>';
    html += '</div>';
    card.innerHTML = html;
    root.appendChild(card);

    var invCard = document.createElement('div'); invCard.className='card'; invCard.style.marginTop='12px';
    var listHtml = '<div style="font-weight:800;margin-bottom:8px">Investors</div>';
    for(var i=0;i<state.investors.length;i++){
      var it = state.investors[i];
      listHtml += '<div style="padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px">'
        + escapeHtml(it.name)
        + '<div class="muted-small">' + escapeHtml(it.contact) + '</div>'
        + '<div class="muted-small">Committed: '+money(it.committed)+'</div>'
        + '</div>';
    }
    listHtml += '<div style="margin-top:8px;font-weight:700">Add Investor</div>'
      + '<div class="field"><input id="newInvName" placeholder="Name"></div>'
      + '<div class="field"><input id="newInvContact" placeholder="Contact"></div>'
      + '<div class="field"><input id="newInvCommitted" type="number" placeholder="Committed"></div>'
      + '<div><button id="addInvestorBtn" class="btn btn-ghost">Add Investor</button></div>';
    invCard.innerHTML = listHtml;
    root.appendChild(invCard);

    (function(){
      var btn = document.getElementById('saveProfile');
      if(btn){
        btn.addEventListener('click', function(){
          state.profile.name = document.getElementById('pName').value || '';
          state.profile.email = document.getElementById('pEmail').value || '';
          state.profile.commitment = Number(document.getElementById('pCommit').value)||0;
          localStorage.setItem(LS_PROFILE, JSON.stringify(state.profile));
          alert('Profile saved');
        });
      }
      var addBtn = document.getElementById('addInvestorBtn');
      if(addBtn){
        addBtn.addEventListener('click', function(){
          var n = document.getElementById('newInvName').value.trim();
          if(!n) return alert('Enter a name');
          var contact = document.getElementById('newInvContact').value.trim();
          var c = Number(document.getElementById('newInvCommitted').value)||0;
          var id = Math.max(0, applyIds(state.investors))+1;
          state.investors.push({id:id,name:n,contact:contact,committed:c,deployed:0});
          render();
        });
      }
    })();
  }

  function applyIds(arr){ var max = 0; for(var i=0;i<arr.length;i++) if(arr[i].id>max) max=arr[i].id; return max; }

  // Deal Analyzer
  function dealCalcs(){
    var d = state.deal;
    var grossYr1 = 142440;
    var vacYr1 = grossYr1 * (d.vacancyRate||0);
    var egiYr1 = grossYr1 - vacYr1 + (d.otherIncome||0);
    var t12TotalAnnual = state.t12.rows.reduce(function(s,r){
      return s + r.months.reduce(function(a,b){ return a + (Number(b)||0); },0);
    },0);
    var pmt = monthlyPI(d.loanAmt,d.rate,d.termYears);
    var ads = pmt * 12;
    var noi = egiYr1 - t12TotalAnnual;
    var cf = noi - ads;
    var cap = d.price? (noi/d.price):0;
    var coc = d.downAmt? (cf/d.downAmt):0;
    return { grossYr1:grossYr1, vacYr1:vacYr1, egiYr1:egiYr1, t12TotalAnnual:t12TotalAnnual, pmt:pmt, ads:ads, noi:noi, cf:cf, cap:cap, coc:coc };
  }

  function renderDealAnalyzer(root){
    var left = document.createElement('div'); left.style.paddingRight='12px';
    var right = document.createElement('div'); right.style.width='320px';

    var inputs = document.createElement('div'); inputs.className='card';
    var html = '<div style="font-weight:800;margin-bottom:8px">Deal Inputs</div>';
    html += '<div class="field"><label>Property Name</label><input id="in_name" value="'+escapeHtml(state.deal.name)+'"></div>';
    html += '<div class="field"><label>Market</label><input id="in_market" value="'+escapeHtml(state.deal.market)+'"></div>';
    html += '<div class="field"><label>Purchase Price</label><input id="in_price" type="number" value="'+(state.deal.price||0)+'"></div>';
    html += '<div class="field"><label>Down %</label><input id="in_downPct" type="number" step="0.001" value="'+(state.deal.downPct||0.35)+'"></div>';
    html += '<div class="field"><label>Rate (0-1)</label><input id="in_rate" type="number" step="0.0001" value="'+(state.deal.rate||0.065)+'"></div>';
    html += '<div class="field"><label>Term (yrs)</label><input id="in_term" type="number" value="'+(state.deal.termYears||30)+'"></div>';
    html += '<div style="margin-top:8px"><button id="applyDealBtn" class="btn">Apply Inputs</button></div>';
    inputs.innerHTML = html;
    left.appendChild(inputs);

    var metrics = document.createElement('div'); metrics.className='card'; metrics.style.marginTop='12px';
    var cal = dealCalcs();
    var mhtml = '<div style="font-weight:800;margin-bottom:8px">Key Metrics (Yr1)</div>';
    mhtml += '<div>Cap Rate: '+(cal.cap? ( (cal.cap*100).toFixed(2) + '%') : '-') +'</div>';
    mhtml += '<div>NOI: '+money(cal.noi)+'</div>';
    mhtml += '<div>Annual Debt: '+money(cal.ads)+'</div>';
    mhtml += '<div>Cash Flow: '+money(cal.cf)+'</div>';
    metrics.innerHTML = mhtml;
    left.appendChild(metrics);

    var finCard = document.createElement('div'); finCard.className='card'; finCard.style.marginTop='12px';
    var fh = '<div style="font-weight:800;margin-bottom:8px">Financing Scenarios</div>';
    for(var i=0;i<state.scenarios.length;i++){
      var s = state.scenarios[i];
      fh += '<div style="padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px">'
        + '<div style="font-weight:700">'+escapeHtml(s.name)+'</div>'
        + '<div class="muted-small">Loan: '+money(s.loanAmt)+' • Rate: '+(s.rate*100).toFixed(2)+'% • Term: '+s.termYears+' yrs</div>'
        + '<div style="margin-top:6px"><button class="btn-ghost applySc" data-sid="'+s.id+'">Apply</button></div>'
        + '</div>';
    }
    fh += '<div style="margin-top:6px"><button id="addScenarioBtn" class="btn btn-ghost">+ Add Scenario</button></div>';
    finCard.innerHTML = fh;
    left.appendChild(finCard);

    var t12Card = document.createElement('div'); t12Card.className='card';
    var period = buildPeriod(state.t12.startMonth, state.t12.startYear);
    var t12html = '<div style="font-weight:800;margin-bottom:8px">T12 (Trailing 12 months)</div>';
    t12html += '<div class="small muted-small">Start: '+period[0].label+'</div>';
    t12html += '<div style="margin-top:8px">';
    t12html += '<table style="width:100%;border-collapse:collapse">';
    for(var r=0;r<state.t12.rows.length;r++){
      var row = state.t12.rows[r];
      t12html += '<tr><td style="padding:6px;border-bottom:1px solid var(--border)">'+escapeHtml(row.category)+'</td><td style="padding:6px;border-bottom:1px solid var(--border);text-align:right">'+money(row.months.reduce(function(a,b){return a+(Number(b)||0);},0))+'</td></tr>';
    }
    t12html += '</table>';
    t12html += '<div style="margin-top:8px"><button id="exportT12" class="btn btn-ghost">Export CSV</button></div>';
    t12html += '</div>';
    t12Card.innerHTML = t12html;
    right.appendChild(t12Card);

    var apodCard = document.createElement('div'); apodCard.className='card'; apodCard.style.marginTop='12px';
    var ap = dealCalcs();
    var aphtml = '<div style="font-weight:800;margin-bottom:8px">APOD</div>';
    aphtml += '<div>GSI: '+money(ap.grossYr1)+'</div>';
    aphtml += '<div>NOI: '+money(ap.noi)+'</div>';
    aphtml += '<div>Cash Flow: '+money(ap.cf)+'</div>';
    apodCard.innerHTML = aphtml;
    right.appendChild(apodCard);

    var container = document.createElement('div'); container.className='grid-2'; container.appendChild(left); container.appendChild(right);
    root.appendChild(container);

    (function(){
      var apply = document.getElementById('applyDealBtn');
      if(apply){
        apply.addEventListener('click', function(){
          state.deal.name = document.getElementById('in_name').value || '';
          state.deal.market = document.getElementById('in_market').value || '';
          state.deal.price = Number(document.getElementById('in_price').value)||0;
          state.deal.downPct = Number(document.getElementById('in_downPct').value)||0;
          state.deal.downAmt = state.deal.price * state.deal.downPct;
          state.deal.loanAmt = state.deal.price - state.deal.downAmt;
          state.deal.rate = Number(document.getElementById('in_rate').value)||0;
          state.deal.termYears = Number(document.getElementById('in_term').value)||30;
          render();
        });
      }
      var applyBtns = document.getElementsByClassName('applySc');
      for(var j=0;j<applyBtns.length;j++){
        applyBtns[j].addEventListener('click', function(ev){
          var sid = Number(ev.target.getAttribute('data-sid'));
          var sc = state.scenarios.find(function(x){ return x.id===sid; });
          if(sc){
            state.deal.loanAmt = sc.loanAmt;
            state.deal.rate = sc.rate;
            state.deal.termYears = sc.termYears;
            state.deal.downAmt = state.deal.price - state.deal.loanAmt;
            render();
          }
        });
      }
      var addSc = document.getElementById('addScenarioBtn');
      if(addSc){
        addSc.addEventListener('click', function(){
          var id = Math.max(0, applyIds(state.scenarios))+1;
          state.scenarios.push({id:id,name:'New Scenario',loanAmt:state.deal.loanAmt,rate:state.deal.rate,termYears:state.deal.termYears});
          render();
        });
      }
      var exp = document.getElementById('exportT12');
      if(exp){
        exp.addEventListener('click', function(){
          var rows = [['Category','Annual']];
          for(var k=0;k<state.t12.rows.length;k++){
            var row = state.t12.rows[k];
            var total = row.months.reduce(function(a,b){ return a + (Number(b)||0); },0);
            rows.push([row.category, total]);
          }
          var csv = rows.map(function(r){
            return r.map(function(c){
              var s = String(c);
              if(s.indexOf(',')!==-1) s='"'+s.replace(/"/g,'""')+'"';
              return s;
            }).join(',');
          }).join('\n');
          downloadFile('t12_export.csv', csv, 'text/csv');
        });
      }
    })();
  }

  // Finder (light)
  function renderFinder(root){
    var c = document.createElement('div'); c.className='card';
    c.innerHTML = '<div style="font-weight:800">Investment Finder</div><div class="muted-small" style="margin-top:8px">Search sample listings and open in Analyzer.</div><div style="margin-top:8px"><button id="openSample" class="btn">Open Sample Deal</button></div>';
    root.appendChild(c);
    var b = document.getElementById('openSample');
    if(b) b.addEventListener('click', function(){
      state.deal = { name:'Sample 14-unit', market:'Orlando, FL', price:1500000, units:14, downPct:0.35, downAmt:525000, loanAmt:975000, rate:0.065, termYears:30, vacancyRate:0.06, otherIncome:0 };
      state.activeModule='dealanalyzer';
      localStorage.setItem(LS_ACTIVE,'dealanalyzer');
      render();
    });
  }

  // Utilities
  function downloadFile(name, content, type){ var blob = new Blob([content], {type:type}); var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(function(){ URL.revokeObjectURL(url); },1500); }
  function escapeHtml(s){ if(s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;'); }

  // Main render
  function render(){
    try{
      renderModuleTabs();
      var root = document.getElementById('app'); if(!root) return;
      clear(root);
      if(state.activeModule==='dashboard'){ renderDashboard(root); }
      else if(state.activeModule==='finder'){ renderFinder(root); }
      else if(state.activeModule==='dealanalyzer'){ renderDealAnalyzer(root); }
      else { root.appendChild(document.createTextNode('Unknown module')); }
      console.log('render completed; activeModule=', state.activeModule);
    }catch(err){
      console.error('Render error', err);
      var r = document.getElementById('app');
      if(r) r.innerHTML = '<div class="card" style="border-color:#ef4444;background:#fff6f6;color:#7f1d1d">An error occurred during render. See console.</div>';
    }
  }

  // Theme toggle binding
  var themeBtn = document.getElementById('themeToggle');
  if(themeBtn){
    themeBtn.addEventListener('click', function(){
      var cur = localStorage.getItem(LS_THEME) || 'light';
      var next = (cur==='light')? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem(LS_THEME,next);
    });
  }

  // Initialize
  try{ render(); }catch(e){ console.error('Startup error', e); }

})();
