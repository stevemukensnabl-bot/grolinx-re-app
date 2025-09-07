// app.js - External probe script (safe ASCII only)
(function(){
  try{
    console.log('EXTERNAL PROBE: app.js loaded');
    var el = document.getElementById('status');
    if(el) el.textContent = 'External script executed successfully.';
  }catch(err){
    console.error('EXTERNAL PROBE ERROR', err);
    try{ document.getElementById('status').textContent = 'External script failed: ' + (err && err.message ? err.message : String(err)); }catch(__){}
  }
})();
