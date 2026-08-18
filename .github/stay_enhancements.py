from pathlib import Path

INDEX = Path('index.html')
s = INDEX.read_text(encoding='utf-8')
marker = '/* HOTEL CALCULATOR - STAY ENHANCEMENTS */'
if marker in s:
    start = s.index(marker)
    end = s.index('</script>', start)
    s = s[:start] + s[end:]

js = r'''/* HOTEL CALCULATOR - STAY ENHANCEMENTS */
(function(){
  const $=id=>document.getElementById(id), rows=$('rows');
  if(!rows)return;
  const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'');
  const addDays=(v,n)=>{if(!valid(v))return '';const d=new Date(v+'T00:00:00');d.setDate(d.getDate()+Number(n||0));return d.toISOString().slice(0,10)};
  const globalType=tr=>{const type=tr.dataset.type||tr.querySelector('.type')?.value||'',item=(tr.querySelector('.item')?.value||'').trim();return type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&/^green tax$/i.test(item))};
  function syncRows(){rows.querySelectorAll('tr').forEach(tr=>{if(tr.dataset.defaultDates==='1'){const f=tr.querySelector('.from'),t=tr.querySelector('.to');if(f)f.value=$('checkin')?.value||'';if(t)t.value=$('checkout')?.value||''}})}
  function prepare(tr,defaultDates){if(!tr)return;if(tr.dataset.defaultDates===undefined)tr.dataset.defaultDates=defaultDates?'1':'0';const f=tr.querySelector('.from'),t=tr.querySelector('.to');if(f&&!f.dataset.stayManual){f.dataset.stayManual='1';f.addEventListener('input',()=>tr.dataset.defaultDates='0');f.addEventListener('change',()=>tr.dataset.defaultDates='0')}if(t&&!t.dataset.stayManual){t.dataset.stayManual='1';t.addEventListener('input',()=>tr.dataset.defaultDates='0');t.addEventListener('change',()=>tr.dataset.defaultDates='0')}}
  function initialiseRows(){rows.querySelectorAll('tr').forEach(tr=>{if(tr.dataset.defaultDates===undefined)tr.dataset.defaultDates=globalType(tr)?'1':'0';prepare(tr,globalType(tr))});syncRows()}
  initialiseRows();

  if(typeof window.addRow==='function'&&!window.addRow.__stayEnhancement){
    const original=window.addRow;
    function wrapped(data){const result=original(data||{});const list=[...rows.querySelectorAll('tr')],tr=list[list.length-1];if(tr){tr.dataset.defaultDates=globalType(tr)?'1':'0';prepare(tr,globalType(tr));syncRows()}return result}
    wrapped.__stayEnhancement=true;window.addRow=wrapped;
  }

  ['checkin','checkout'].forEach(id=>{const el=$(id);if(!el||el.dataset.stayEnhanceListener)return;el.dataset.stayEnhanceListener='1';el.addEventListener('change',syncRows);el.addEventListener('blur',syncRows)});
  rows.addEventListener('change',e=>{const tr=e.target.closest('tr');if(!tr)return;if(e.target.classList.contains('type')||e.target.classList.contains('item')){if(globalType(tr)){tr.dataset.defaultDates='1';prepare(tr,true);syncRows()}else tr.dataset.defaultDates='0'}});

  /* Nights +/- control. Typing the number still works. */
  const n=$('nights');
  if(n&&!n.dataset.stayStepper){
    n.dataset.stayStepper='1';n.readOnly=false;n.type='number';n.min='0';n.max='365';n.step='1';n.value=n.value||'0';
    const wrap=document.createElement('div');wrap.className='nights-stepper';n.parentNode.insertBefore(wrap,n);wrap.appendChild(n);
    const controls=document.createElement('div');controls.className='nights-controls';
    const minus=document.createElement('button'),plus=document.createElement('button');minus.type=plus.type='button';minus.className='nights-minus';plus.className='nights-plus';minus.textContent='−';plus.textContent='+';controls.append(minus,plus);wrap.appendChild(controls);
    function setN(value){const v=Math.max(0,Math.min(365,parseInt(value,10)||0));n.value=v;const ci=$('checkin');if(ci&&valid(ci.value))$('checkout').value=v?addDays(ci.value,v):'';syncRows();if(typeof recalc==='function')recalc()}
    minus.addEventListener('click',()=>setN((parseInt(n.value,10)||0)-1));plus.addEventListener('click',()=>setN((parseInt(n.value,10)||0)+1));
    n.addEventListener('input',()=>{const v=Math.max(0,Math.min(365,parseInt(n.value,10)||0));n.value=v;const ci=$('checkin');if(ci&&valid(ci.value))$('checkout').value=v?addDays(ci.value,v):'';syncRows();if(typeof recalc==='function')recalc()});
  }

  const style=document.createElement('style');style.textContent=`
    .nights-stepper{display:flex;align-items:stretch;width:100%;height:38px}
    .nights-stepper>#nights{flex:1;min-width:0;width:auto!important;height:38px!important;border-radius:6px 0 0 6px!important}
    .nights-controls{display:flex;flex-direction:column;width:30px;flex:0 0 30px}
    .nights-controls button{padding:0!important;margin:0!important;height:19px;border:0;border-left:1px solid #d8dee6;border-radius:0;background:#e9eef5;color:#17365d;font-size:13px;font-weight:700;line-height:18px;cursor:pointer}
    .nights-controls .nights-plus{border-radius:0 5px 0 0;border-top:1px solid #d8dee6}.nights-controls .nights-minus{border-radius:0 0 5px 0}.nights-controls button:hover{background:#dce6f2}
  `;document.head.appendChild(style);
})();
'''

pos=s.rfind('</body>')
if pos==-1: raise RuntimeError('No </body> found')
s=s[:pos]+'<script>\n'+js+'\n</script>\n'+s[pos:]
INDEX.write_text(s,encoding='utf-8')
