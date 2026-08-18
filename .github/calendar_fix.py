from pathlib import Path

INDEX = Path('index.html')
s = INDEX.read_text(encoding='utf-8')
markers = [
    '/* HOTEL CALCULATOR v2 override */',
    '/* HOTEL CALCULATOR FIXED DATE/ROW LAYER */',
    '/* HOTEL CALCULATOR CALENDAR FIX */',
    '/* HOTEL CALCULATOR DATE / CALENDAR FINAL LAYER */',
    '/* HOTEL CALCULATOR DATE / CALENDAR REBUILT */',
]
positions = [s.find(m) for m in markers if s.find(m) >= 0]
if positions:
    start = min(positions)
    end = s.index('</script>', start)
    s = s[:start] + s[end:]

js = r'''/* HOTEL CALCULATOR DATE / CALENDAR REBUILT */
(function(){
  const $=id=>document.getElementById(id), ROWS=$('rows');
  if(!ROWS)return;
  const pad=n=>String(n).padStart(2,'0');
  function parseDate(v){
    v=String(v||'').trim(); let y,m,d,x;
    if((x=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v))){d=+x[1];m=+x[2];y=+x[3]}
    else if((x=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v))){y=+x[1];m=+x[2];d=+x[3]}
    else return null;
    const dt=new Date(y,m-1,d);
    return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d?dt:null;
  }
  const display=d=>d?`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`:'';
  const iso=d=>d?`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`:'';
  const nights=(a,b)=>{const x=parseDate(a),y=parseDate(b);return x&&y?Math.max(0,Math.round((y-x)/86400000)):0};
  const addDays=(v,n)=>{const d=parseDate(v);if(!d)return '';d.setDate(d.getDate()+Number(n||0));return display(d)};
  const money=n=>Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const discounts=tr=>[...tr.querySelectorAll('.discount')].map(x=>+x.value||0).filter(x=>x>0);
  const applyDiscounts=(v,ds)=>ds.reduce((x,d)=>x*(1-d/100),v);
  const globalType=tr=>{const type=tr.dataset.type||tr.querySelector('.type')?.value||'',item=(tr.querySelector('.item')?.value||'').trim();return type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&/^green tax$/i.test(item));};

  let picker=null, pickerInput=null, pickerRow=null, pickerMode='global', pickerMonth=null;
  function closePicker(){if(picker){picker.remove();picker=null;}}
  function stop(e){e.preventDefault();e.stopPropagation();}

  function setGlobalDate(input,value){
    input.value=value;
    const ci=$('checkin'),co=$('checkout'),n=$('nights');
    if(input===ci){
      const nn=+n.value||0;
      if(nn>0)co.value=addDays(value,nn); else if(co.value&&parseDate(co.value)&&parseDate(co.value)>=parseDate(value))n.value=nights(value,co.value); else co.value='';
    }else{
      const a=parseDate(ci.value),b=parseDate(value);
      if(a&&b&&b<a){co.value='';n.value=0;}else n.value=nights(ci.value,value);
    }
    syncDefaults(); recalcFinal();
    if(input===ci){
      // After check-in, open check-out as the next step.
      openPicker(co,true);
    }else closePicker();
  }

  function setRowDate(input,value){
    input.value=value;
    const tr=input.closest('tr');
    if(tr)tr.dataset.defaultDates='0';
    recalcFinal();
    closePicker();
  }

  function renderCalendar(){
    if(!picker)return;
    picker.innerHTML='';
    const head=document.createElement('div');head.className='hc-cal-head';
    const prev=document.createElement('button'),next=document.createElement('button'),title=document.createElement('strong');
    prev.type=next.type='button';prev.textContent='‹';next.textContent='›';
    title.textContent=pickerMonth.toLocaleString('en-US',{month:'long',year:'numeric'});
    prev.addEventListener('click',e=>{stop(e);pickerMonth=new Date(pickerMonth.getFullYear(),pickerMonth.getMonth()-1,1);renderCalendar()});
    next.addEventListener('click',e=>{stop(e);pickerMonth=new Date(pickerMonth.getFullYear(),pickerMonth.getMonth()+1,1);renderCalendar()});
    head.append(prev,title,next);picker.append(head);
    const grid=document.createElement('div');grid.className='hc-cal-grid';
    ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(v=>{const s=document.createElement('span');s.textContent=v;grid.append(s)});
    const first=new Date(pickerMonth.getFullYear(),pickerMonth.getMonth(),1),offset=(first.getDay()+6)%7;
    for(let i=0;i<offset;i++){const s=document.createElement('span');s.className='empty';grid.append(s)}
    const count=new Date(pickerMonth.getFullYear(),pickerMonth.getMonth()+1,0).getDate();
    const minDate=pickerMode==='row'&&pickerRow?.classList.contains('to')?parseDate(pickerRow.closest('tr')?.querySelector('.from')?.value):pickerInput?.id==='checkout'?parseDate($('checkin')?.value):null;
    const selected=parseDate(pickerMode==='row'?pickerRow?.value:pickerInput?.value);
    for(let day=1;day<=count;day++){
      const d=new Date(pickerMonth.getFullYear(),pickerMonth.getMonth(),day),b=document.createElement('button');
      b.type='button';b.textContent=day;
      if(minDate&&d<minDate)b.disabled=true;
      if(selected&&d.getTime()===selected.getTime())b.classList.add('selected');
      b.addEventListener('click',e=>{stop(e);const v=display(d);pickerMode==='global'?setGlobalDate(pickerInput,v):setRowDate(pickerRow,v)});
      grid.append(b);
    }
    picker.append(grid);
  }

  function openPicker(input,autoNext=false){
    closePicker();pickerMode='global';pickerInput=input;pickerRow=null;
    const d=parseDate(input.value)||parseDate($('checkin')?.value)||new Date();pickerMonth=new Date(d.getFullYear(),d.getMonth(),1);
    picker=document.createElement('div');picker.className='hc-calendar';document.body.append(picker);renderCalendar();positionPicker(input);
  }
  function openRowPicker(input){
    closePicker();pickerMode='row';pickerRow=input;pickerInput=null;
    const d=parseDate(input.value)||parseDate($('checkin')?.value)||new Date();pickerMonth=new Date(d.getFullYear(),d.getMonth(),1);
    picker=document.createElement('div');picker.className='hc-calendar';document.body.append(picker);renderCalendar();positionPicker(input);
  }
  function positionPicker(input){
    const r=input.getBoundingClientRect(),w=270;picker.style.width=w+'px';let left=Math.min(Math.max(8,r.left),window.innerWidth-w-8),top=r.bottom+6;if(top+picker.offsetHeight>window.innerHeight-8)top=Math.max(8,r.top-picker.offsetHeight-6);picker.style.left=left+'px';picker.style.top=top+'px';}

  function replaceGlobal(id){
    const old=$(id);if(!old)return null;
    const fresh=old.cloneNode(true);fresh.type='text';fresh.removeAttribute('readonly');fresh.className='global-date-final';fresh.placeholder='DD.MM.YYYY';fresh.value=display(parseDate(old.value));old.replaceWith(fresh);
    fresh.addEventListener('input',()=>{fresh.value=fresh.value.replace(/[^\d.]/g,'').slice(0,10)});
    fresh.addEventListener('blur',()=>{if(fresh.value&&!parseDate(fresh.value))fresh.value='';else if(fresh.value)fresh.value=display(parseDate(fresh.value));globalChanged(fresh)});
    fresh.addEventListener('click',e=>{e.stopPropagation();openPicker(fresh)});
    return fresh;
  }
  function globalChanged(input){
    if(!parseDate(input.value)){recalcFinal();return;}
    const ci=$('checkin'),co=$('checkout'),n=$('nights');
    if(input===ci){const nn=+n.value||0;if(nn>0)co.value=addDays(input.value,nn);else if(parseDate(co.value))n.value=nights(ci.value,co.value)}
    else {const a=parseDate(ci.value),b=parseDate(co.value);if(a&&b&&b<a){co.value='';n.value=0}else n.value=nights(ci.value,co.value)}
    syncDefaults();recalcFinal();
  }

  function decorateRowDate(input,cls){
    if(!input)return;
    const fresh=input.cloneNode(true);fresh.type='text';fresh.removeAttribute('readonly');fresh.placeholder='DD.MM.YYYY';fresh.value=display(parseDate(input.value));fresh.className=input.className;fresh.dataset.rebuiltDate='1';input.replaceWith(fresh);
    fresh.addEventListener('input',()=>fresh.value=fresh.value.replace(/[^\d.]/g,'').slice(0,10));
    fresh.addEventListener('blur',()=>{if(fresh.value&&!parseDate(fresh.value))fresh.value='';else if(fresh.value)fresh.value=display(parseDate(fresh.value));fresh.closest('tr').dataset.defaultDates='0';recalcFinal()});
    fresh.addEventListener('click',e=>{e.stopPropagation();openRowPicker(fresh)});
  }
  function decorateRows(){
    ROWS.querySelectorAll('tr').forEach(tr=>{
      const type=tr.dataset.type||tr.querySelector('.type')?.value||'',item=tr.querySelector('.item')?.value||'';
      if(tr.dataset.defaultDates===undefined)tr.dataset.defaultDates=globalType(tr)?'1':'0';
      const f=tr.querySelector('.from'),t=tr.querySelector('.to');
      if(f&&!f.dataset.rebuiltDate)decorateRowDate(f,'from');
      if(t&&!t.dataset.rebuiltDate)decorateRowDate(t,'to');
    });
    syncDefaults();applyTypeColors();
  }
  function syncDefaults(){
    ROWS.querySelectorAll('tr').forEach(tr=>{if(tr.dataset.defaultDates!=='1')return;const f=tr.querySelector('.from'),t=tr.querySelector('.to');if(f)f.value=$('checkin')?.value||'';if(t)t.value=$('checkout')?.value||'';});
  }

  function recalcFinal(){
    const ci=$('checkin')?.value||'',co=$('checkout')?.value||'';
    if($('nights'))$('nights').value=nights(ci,co);
    let total=0;
    ROWS.querySelectorAll('tr').forEach(tr=>{
      const type=tr.dataset.type||tr.querySelector('.type')?.value||'',item=tr.querySelector('.item')?.value||'';
      const f=tr.querySelector('.from')?.value||'',t=tr.querySelector('.to')?.value||'',nn=nights(f,t);
      const q=+tr.querySelector('.qty')?.value||0,r=+tr.querySelector('.rate')?.value||0;
      let base=q*r;
      if(type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&/^green tax$/i.test(item)))base*=nn;
      else if(type==='EXTRA'&&f&&t)base*=nn;
      const net=applyDiscounts(base,discounts(tr));
      if(tr.querySelector('.nights'))tr.querySelector('.nights').value=nn;
      if(tr.querySelector('.net'))tr.querySelector('.net').textContent=money(net);
      total+=net;
    });
    if($('grandTotal'))$('grandTotal').textContent='$'+money(total);
    if($('topTotal'))$('topTotal').value=money(total);
    applyTypeColors();
  }
  window.recalc=recalcFinal;

  function applyTypeColors(){
    const colors={ROOM:'#2f80d1',MEAL:'#4caf50',TRANSFER:'#8064c8',DINNER:'#ed7d31',EXTRA:'#d4a500'};
    ROWS.querySelectorAll('tr').forEach(tr=>{const sel=tr.querySelector('.type');if(!sel)return;const c=colors[tr.dataset.type||sel.value]||'';sel.style.background=c;sel.style.color=c?'white':'';});
  }

  function init(){
    const ci=replaceGlobal('checkin'),co=replaceGlobal('checkout');if(!ci||!co)return;
    if($('nights')){$('nights').readOnly=false;$('nights').type='number';$('nights').min='0';$('nights').step='1';$('nights').placeholder='0';$('nights').classList.add('plain-nights');$('nights').addEventListener('input',()=>{const v=Math.max(0,+$('nights').value||0);$('nights').value=v;if(ci.value&&v>0)co.value=addDays(ci.value,v);else if(ci.value&&!v)co.value='';syncDefaults();recalcFinal()});}
    // Preserve existing rows. Only decorate them; do not delete/recreate them.
    decorateRows();recalcFinal();
    ROWS.addEventListener('change',e=>{const tr=e.target.closest('tr');if(!tr)return;if(e.target.classList.contains('type')){tr.dataset.type=e.target.value;if(globalType(tr)){tr.dataset.defaultDates='1';syncDefaults()}else tr.dataset.defaultDates='0';applyTypeColors();recalcFinal()}if(e.target.classList.contains('item')){if(globalType(tr)){tr.dataset.defaultDates='1';syncDefaults()}applyTypeColors();recalcFinal()}});
    document.addEventListener('click',e=>{if(picker&&!picker.contains(e.target)&&e.target!==ci&&e.target!==co&&!e.target.classList.contains('from')&&!e.target.classList.contains('to'))closePicker()});
    window.addEventListener('resize',closePicker);window.addEventListener('scroll',closePicker,true);
  }
  const st=document.createElement('style');st.textContent=`
    .global-date-final,.from,.to{width:100%;height:32px;border:1px solid #dfe4ea;border-radius:5px;padding:4px 6px;background:#fff;box-sizing:border-box}
    .global-date-final{height:38px;border-color:var(--line);border-radius:6px;padding:7px 9px}
    .plain-nights{appearance:auto!important;-webkit-appearance:auto!important}
    .hc-calendar{position:fixed;z-index:100000;background:#fff;border:1px solid #d8dee6;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:10px;box-sizing:border-box}
    .hc-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.hc-cal-head button{width:30px;height:30px;border:0;border-radius:5px;background:#f1f3f5;font-size:20px;padding:0;cursor:pointer}.hc-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.hc-cal-grid span,.hc-cal-grid button{height:30px;display:flex;align-items:center;justify-content:center;font-size:12px;box-sizing:border-box}.hc-cal-grid span{color:#6b7280}.hc-cal-grid .empty{visibility:hidden}.hc-cal-grid button{border:0;border-radius:4px;background:#fff;padding:0;cursor:pointer;color:#111}.hc-cal-grid button:hover:not(:disabled),.hc-cal-grid button.selected{background:#17365d;color:#fff}.hc-cal-grid button:disabled{color:#c5cbd3;cursor:not-allowed}
  `;document.head.append(st);init();
})();
'''

pos=s.rfind('</body>')
if pos==-1: raise RuntimeError('No </body> found')
s=s[:pos]+'<script>\n'+js+'\n</script>\n'+s[pos:]
INDEX.write_text(s,encoding='utf-8')
