from pathlib import Path

INDEX = Path('index.html')
s = INDEX.read_text(encoding='utf-8')
markers = [
    '/* HOTEL CALCULATOR v2 override */',
    '/* HOTEL CALCULATOR FIXED DATE/ROW LAYER */',
    '/* HOTEL CALCULATOR CALENDAR FIX */',
    '/* HOTEL CALCULATOR DATE / CALENDAR FINAL LAYER */',
]
positions = [s.find(m) for m in markers if s.find(m) >= 0]
if positions:
    start = min(positions)
    end = s.index('</script>', start)
    s = s[:start] + s[end:]

js = r'''/* HOTEL CALCULATOR DATE / CALENDAR FINAL LAYER */
(function(){
  const $=id=>document.getElementById(id), ROWS=$('rows');
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
  const nights=(a,b)=>{const x=parseDate(a),y=parseDate(b);return x&&y?Math.max(0,Math.round((y-x)/86400000)):0};
  const addDays=(v,n)=>{const d=parseDate(v);if(!d)return '';d.setDate(d.getDate()+n);return display(d)};
  const money=n=>Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const ds=tr=>[...tr.querySelectorAll('.discount')].map(x=>+x.value||0).filter(x=>x>0);
  const apply=(v,a)=>a.reduce((x,d)=>x*(1-d/100),v);

  let picker=null,target=null,month=null,two=false,rowTarget=null,rowMode=null;
  function closePicker(){if(picker){picker.remove();picker=null}}
  function syncDefaults(){
    ROWS.querySelectorAll('tr').forEach(tr=>{
      if(tr.dataset.defaultDates!=='1')return;
      const f=tr.querySelector('.from'),t=tr.querySelector('.to');
      if(f)f.value=$('checkin').value||'';
      if(t)t.value=$('checkout').value||'';
    });
  }
  function recalcFinal(){
    const ci=$('checkin')?.value||'',co=$('checkout')?.value||'';
    if($('nights')&&document.activeElement!==$('nights'))$('nights').value=nights(ci,co);
    let total=0;
    ROWS.querySelectorAll('tr').forEach(tr=>{
      const type=tr.dataset.type||tr.querySelector('.type')?.value||'',item=tr.querySelector('.item')?.value||'';
      const f=tr.querySelector('.from')?.value||'',t=tr.querySelector('.to')?.value||'',n=nights(f,t);
      const q=+tr.querySelector('.qty')?.value||0,r=+tr.querySelector('.rate')?.value||0;
      let base=q*r;
      if(type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&/^green tax$/i.test(item)))base*=n;
      else if(type==='EXTRA'&&f&&t)base*=n;
      const net=apply(base,ds(tr));
      if(tr.querySelector('.nights'))tr.querySelector('.nights').value=n;
      if(tr.querySelector('.net'))tr.querySelector('.net').textContent=money(net);
      total+=net;
    });
    if($('grandTotal'))$('grandTotal').textContent='$'+money(total);
    if($('topTotal'))$('topTotal').value=money(total);
  }
  window.recalc=recalcFinal;

  function globalChanged(which){
    const ci=$('checkin'),co=$('checkout'),n=$('nights');if(!ci||!co||!n)return;
    if(which==='checkin'){
      const nn=+n.value||0;
      if(ci.value&&nn>0)co.value=addDays(ci.value,nn);
      else if(ci.value&&co.value&&parseDate(co.value)&&parseDate(co.value)>=parseDate(ci.value))n.value=nights(ci.value,co.value);
      else if(ci.value&&co.value&&parseDate(co.value)<parseDate(ci.value)){co.value='';n.value=0}
    }else{
      if(ci.value&&co.value&&parseDate(co.value)&&parseDate(co.value)<parseDate(ci.value)){co.value='';n.value=0}
      else n.value=nights(ci.value,co.value);
    }
    syncDefaults();recalcFinal();
  }

  function chooseGlobal(value){
    const isCI=target.id==='checkin';target.value=value;globalChanged(isCI?'checkin':'checkout');closePicker();
    if(isCI)openPicker($('checkout'),value,true);
  }
  function chooseRow(value){
    rowTarget.value=value;rowTarget.closest('tr').dataset.defaultDates='0';closePicker();recalcFinal();
  }

  function monthGrid(parent,m,min,selected,mode){
    const box=document.createElement('div'),title=document.createElement('div'),grid=document.createElement('div');
    box.className='hc-month-final';title.className='hc-month-title-final';title.textContent=m.toLocaleString('en-US',{month:'long',year:'numeric'});grid.className='hc-grid-final';
    ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(v=>{const e=document.createElement('span');e.textContent=v;grid.append(e)});
    const first=new Date(m.getFullYear(),m.getMonth(),1),off=(first.getDay()+6)%7;for(let i=0;i<off;i++){const e=document.createElement('span');e.className='empty';grid.append(e)}
    const count=new Date(m.getFullYear(),m.getMonth()+1,0).getDate();
    for(let day=1;day<=count;day++){
      const d=new Date(m.getFullYear(),m.getMonth(),day),b=document.createElement('button'),v=display(d);b.type='button';b.textContent=day;
      if(min&&d<min){b.disabled=true;b.className='disabled'}if(v===selected)b.classList.add('selected');
      b.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();if(b.disabled)return;mode==='global'?chooseGlobal(v):chooseRow(v)});
      b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});grid.append(b);
    }
    box.append(title,grid);parent.append(box);
  }
  function renderPicker(mode='global'){
    closePicker();picker=document.createElement('div');picker.className='hc-picker-final';
    const head=document.createElement('div');head.className='hc-picker-head-final';const prev=document.createElement('button'),next=document.createElement('button'),title=document.createElement('strong');
    prev.type=next.type='button';prev.textContent='‹';next.textContent='›';title.textContent=mode==='global'?(two?'Select Check-out':'Select date'):'Select date';
    prev.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();month=new Date(month.getFullYear(),month.getMonth()-1,1);renderPicker(mode)});
    next.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();month=new Date(month.getFullYear(),month.getMonth()+1,1);renderPicker(mode)});head.append(prev,title,next);picker.append(head);
    const monthsBox=document.createElement('div');monthsBox.className=two?'hc-months-final two':'hc-months-final';
    let min=null,selected='';
    if(mode==='global'){min=target.id==='checkout'&&parseDate($('checkin').value)?parseDate($('checkin').value):null;selected=target.value||''}
    else {selected=rowTarget.value||'';if(rowMode==='to'&&parseDate(rowTarget.closest('tr').querySelector('.from').value))min=parseDate(rowTarget.closest('tr').querySelector('.from').value)}
    monthGrid(monthsBox,new Date(month),min,selected,mode);if(two)monthGrid(monthsBox,new Date(month.getFullYear(),month.getMonth()+1,1),min,selected,mode);
    picker.append(monthsBox);document.body.append(picker);
    const r=(mode==='global'?target:rowTarget).getBoundingClientRect(),w=two?530:290;picker.style.width=w+'px';let left=Math.min(Math.max(8,r.left),window.innerWidth-w-8),top=r.bottom+6;if(top+picker.offsetHeight>window.innerHeight-8)top=Math.max(8,r.top-picker.offsetHeight-6);picker.style.left=left+'px';picker.style.top=top+'px';
  }
  function openPicker(input,hint,isTwo){target=input;two=!!isTwo||input.id==='checkout';const h=parseDate(hint),v=parseDate(input.value),ci=parseDate($('checkin').value),base=h||v||ci||new Date();month=new Date(base.getFullYear(),base.getMonth(),1);if(input.id==='checkout'&&ci)month=new Date(ci.getFullYear(),ci.getMonth(),1);renderPicker('global')}

  function replaceGlobal(id){
    const old=$(id);if(!old)return null;const fresh=old.cloneNode(true);fresh.type='text';fresh.removeAttribute('readonly');fresh.className='global-date-final';fresh.placeholder='DD.MM.YYYY';fresh.value=display(parseDate(old.value));old.replaceWith(fresh);
    fresh.addEventListener('input',()=>fresh.value=fresh.value.replace(/[^\d.]/g,'').slice(0,10));
    fresh.addEventListener('blur',()=>{if(fresh.value&&!parseDate(fresh.value))fresh.value='';globalChanged(id)});
    fresh.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();if(picker&&target===fresh)return;openPicker(fresh,null,id==='checkout')});return fresh;
  }
  function decorateRows(){
    ROWS.querySelectorAll('tr').forEach(tr=>{
      const type=tr.dataset.type||tr.querySelector('.type')?.value||'',item=tr.querySelector('.item')?.value||'';
      if(tr.dataset.defaultDates===undefined)tr.dataset.defaultDates=(type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&/^green tax$/i.test(item)))?'1':'0';
      ['from','to'].forEach(cls=>{
        const old=tr.querySelector('.'+cls);if(!old||old.dataset.finalDate)return;const fresh=old.cloneNode(true);fresh.type='text';fresh.placeholder='DD.MM.YYYY';fresh.value=display(parseDate(old.value));fresh.dataset.finalDate='1';old.replaceWith(fresh);
        fresh.addEventListener('input',()=>fresh.value=fresh.value.replace(/[^\d.]/g,'').slice(0,10));
        fresh.addEventListener('blur',()=>{if(fresh.value&&!parseDate(fresh.value))fresh.value='';tr.dataset.defaultDates='0';recalcFinal()});
        fresh.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();rowTarget=fresh;rowMode=cls;two=false;const d=parseDate(fresh.value)||parseDate($('checkin').value)||new Date();month=new Date(d.getFullYear(),d.getMonth(),1);renderPicker('row')});
      });
    });syncDefaults();
  }

  function init(){
    const ci=replaceGlobal('checkin'),co=replaceGlobal('checkout');if(!ci||!co)return;$('nights').readOnly=false;$('nights').placeholder='0';
    $('nights').addEventListener('input',()=>{const nn=Math.max(0,+$('nights').value||0);if(ci.value&&nn>0)co.value=addDays(ci.value,nn);else if(ci.value&&!nn)co.value='';syncDefaults();recalcFinal()});
    ROWS.innerHTML='';
    const add=window.addRow;
    if(typeof add==='function'){add({type:'ROOM',qty:1});add({type:'TRANSFER',qty:1});add({type:'EXTRA',item:'Green Tax',qty:0,rate:12})}
    ROWS.querySelectorAll('tr').forEach(tr=>{const type=tr.dataset.type||tr.querySelector('.type')?.value||'',item=tr.querySelector('.item')?.value||'';tr.dataset.defaultDates=(type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&/^green tax$/i.test(item)))?'1':'0'});
    decorateRows();recalcFinal();
    document.addEventListener('click',e=>{if(picker&&!picker.contains(e.target)&&e.target!==ci&&e.target!==co)closePicker()});window.addEventListener('resize',closePicker);window.addEventListener('scroll',closePicker,true);
  }
  const st=document.createElement('style');st.textContent=`
    .global-date-final{width:100%;height:38px;border:1px solid var(--line);border-radius:6px;padding:7px 9px;background:#fff}
    .hc-picker-final{position:fixed;z-index:100000;background:#fff;border:1px solid #d8dee6;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:10px;box-sizing:border-box}
    .hc-picker-head-final{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.hc-picker-head-final button{width:28px;height:28px;border:0;border-radius:5px;background:#f1f3f5;font-size:18px;padding:0;cursor:pointer}
    .hc-months-final{display:block}.hc-months-final.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.hc-month-title-final{text-align:center;font-weight:700;margin-bottom:5px}.hc-grid-final{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
    .hc-grid-final span,.hc-grid-final button{height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;box-sizing:border-box}.hc-grid-final span{color:#6b7280}.hc-grid-final .empty{visibility:hidden}.hc-grid-final button{border:0;border-radius:4px;background:#fff;padding:0;cursor:pointer;color:#111}.hc-grid-final button:hover:not(:disabled),.hc-grid-final button.selected{background:#17365d;color:#fff}.hc-grid-final button:disabled{color:#c5cbd3;cursor:not-allowed}
  `;document.head.append(st);init();
})();
'''
s=s.replace('</script>',js+'\n</script>',1)
INDEX.write_text(s,encoding='utf-8')
