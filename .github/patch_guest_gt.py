from pathlib import Path

INDEX = Path("index.html")
s = INDEX.read_text(encoding="utf-8")

# Remove only old compatibility layers. Keep the currently working calendar.
for marker in [
    "/* HOTEL CALCULATOR v2 override */",
    "/* HOTEL CALCULATOR FIXED DATE/ROW LAYER */",
    "/* HOTEL CALCULATOR CALENDAR FIX */",
    "/* HOTEL CALCULATOR DATE FIX */",
]:
    while marker in s:
        start = s.index(marker)
        end = s.find("</script>", start)
        if end == -1:
            break
        s = s[:start] + s[end:]

js = r'''
/* HOTEL CALCULATOR - STAY DEFAULTS + NIGHTS STEPPER */
(function(){
  const $=id=>document.getElementById(id), rows=$('rows');
  if(!rows)return;
  const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'');
  function addDays(v,n){if(!validDate(v))return '';const d=new Date(v+'T00:00:00');d.setDate(d.getDate()+Number(n||0));return d.toISOString().slice(0,10)}

  /* Nights: editable number plus compact +/- controls. */
  const nights=$('nights');
  if(nights&&!nights.dataset.stepperReady){
    nights.dataset.stepperReady='1'; nights.readOnly=false; nights.type='number'; nights.min='0'; nights.max='365'; nights.step='1'; nights.value=nights.value||'0';
    const wrap=document.createElement('div');wrap.className='nights-stepper';nights.parentNode.insertBefore(wrap,nights);wrap.appendChild(nights);
    const controls=document.createElement('div');controls.className='nights-controls';
    const minus=document.createElement('button');minus.type='button';minus.textContent='−';minus.className='nights-minus';
    const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.className='nights-plus';controls.append(minus,plus);wrap.appendChild(controls);
    function setN(n){n=Math.max(0,Math.min(365,parseInt(n,10)||0));nights.value=n;if(validDate($('checkin').value))$('checkout').value=n?addDays($('checkin').value,n):'';if(typeof recalc==='function')recalc()}
    minus.onclick=()=>setN((parseInt(nights.value,10)||0)-1); plus.onclick=()=>setN((parseInt(nights.value,10)||0)+1);
    nights.addEventListener('input',()=>setN(nights.value));
  }

  function isGlobal(tr){const type=tr.dataset.type||tr.querySelector('.type')?.value||'',item=(tr.querySelector('.item')?.value||'').trim();return type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&/^green tax$/i.test(item))}
  function applyDefaults(tr){if(tr.dataset.followGlobal!=='1'||!isGlobal(tr))return;const f=tr.querySelector('.from'),t=tr.querySelector('.to');if(f)f.value=$('checkin')?.value||'';if(t)t.value=$('checkout')?.value||''}
  function prepare(tr,makeDefault){if(!tr)return;if(tr.dataset.followGlobal===undefined)tr.dataset.followGlobal=makeDefault?'1':'0';const f=tr.querySelector('.from'),t=tr.querySelector('.to');if(f&&!f.dataset.manualListener){f.dataset.manualListener='1';f.addEventListener('change',()=>tr.dataset.followGlobal='0');f.addEventListener('input',()=>tr.dataset.followGlobal='0')}if(t&&!t.dataset.manualListener){t.dataset.manualListener='1';t.addEventListener('change',()=>tr.dataset.followGlobal='0');t.addEventListener('input',()=>tr.dataset.followGlobal='0')}applyDefaults(tr)}
  function syncStayDefaults(){rows.querySelectorAll('tr').forEach(tr=>{if(tr.dataset.followGlobal===undefined)tr.dataset.followGlobal=isGlobal(tr)?'1':'0';applyDefaults(tr)})}
  window.syncStayDates=syncStayDefaults;

  rows.querySelectorAll('tr').forEach(tr=>prepare(tr,isGlobal(tr)));
  syncStayDefaults();

  if(typeof window.addRow==='function'&&!window.addRow.__stayWrapped){
    const original=window.addRow;
    function wrapped(data){const result=original(data||{});const list=[...rows.querySelectorAll('tr')],tr=list[list.length-1];if(tr){tr.dataset.followGlobal=isGlobal(tr)?'1':'0';prepare(tr,isGlobal(tr));applyDefaults(tr)}return result}
    wrapped.__stayWrapped=true;window.addRow=wrapped;
  }

  rows.addEventListener('change',e=>{const tr=e.target.closest('tr');if(!tr)return;if(e.target.classList.contains('type')||e.target.classList.contains('item')){if(isGlobal(tr)){tr.dataset.followGlobal='1';prepare(tr,true);applyDefaults(tr)}else tr.dataset.followGlobal='0';if(typeof recalc==='function')recalc()}});

  ['checkin','checkout'].forEach(id=>{const el=$(id);if(!el||el.dataset.stayListener)return;el.dataset.stayListener='1';el.addEventListener('change',()=>{const ci=$('checkin').value,co=$('checkout').value;if(id==='checkin'){const n=parseInt($('nights').value,10)||0;if(validDate(ci)&&n>0)$('checkout').value=addDays(ci,n)}if(id==='checkout'&&validDate(ci)&&validDate(co)&&new Date(co)<new Date(ci))$('checkout').value='';if(typeof recalc==='function')recalc()})});

  const style=document.createElement('style');style.textContent=`
    .nights-stepper{display:flex;align-items:stretch;width:100%;height:38px}
    .nights-stepper>#nights{flex:1;min-width:0;width:auto!important;height:38px!important;border-radius:6px 0 0 6px!important}
    .nights-controls{display:flex;flex-direction:column;width:30px;flex:0 0 30px}
    .nights-controls button{padding:0!important;margin:0!important;border-radius:0!important;height:19px;line-height:18px;font-size:13px;font-weight:700;background:#e9eef5;color:#17365d;border-left:1px solid #d8dee6}
    .nights-controls .nights-plus{border-radius:0 5px 0 0!important;border-top:1px solid #d8dee6}
    .nights-controls .nights-minus{border-radius:0 0 5px 0!important}
    .nights-controls button:hover{background:#dce6f2}
  `;document.head.appendChild(style);
})();
'''

pos=s.rfind('</body>')
if pos==-1: raise RuntimeError('No </body> found')
s=s[:pos]+'<script>\n'+js+'\n</script>\n'+s[pos:]
INDEX.write_text(s,encoding='utf-8')
