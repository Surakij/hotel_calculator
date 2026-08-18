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
  const pad=n=>String(n).padStart(2,'0');
  const parse=v=>{v=String(v||'').trim();let m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v),y,mo,d;if(m){d=+m[1];mo=+m[2];y=+m[3]}else{m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v);if(!m)return null;y=+m[1];mo=+m[2];d=+m[3]}const x=new Date(y,mo-1,d);return x.getFullYear()===y&&x.getMonth()===mo-1&&x.getDate()===d?x:null};
  const display=d=>d?`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`:'';
  const addDays=(v,n)=>{const d=parse(v);if(!d)return '';d.setDate(d.getDate()+Number(n||0));return display(d)};
  const globalType=tr=>{const type=tr.dataset.type||tr.querySelector('.type')?.value||'',item=(tr.querySelector('.item')?.value||'').trim();return type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&/^green tax$/i.test(item));};
  const colors={ROOM:'#2f80d1',MEAL:'#4caf50',TRANSFER:'#8064c8',DINNER:'#ed7d31',EXTRA:'#d4a500'};
  function colorRows(){rows.querySelectorAll('tr').forEach(tr=>{const sel=tr.querySelector('.type');if(!sel)return;const c=colors[tr.dataset.type||sel.value]||'';sel.style.background=c;sel.style.color=c?'white':'';});}
  function defaultDates(tr){if(!tr)return;if(tr.dataset.defaultDates===undefined)tr.dataset.defaultDates=globalType(tr)?'1':'0';if(tr.dataset.defaultDates==='1'){const f=tr.querySelector('.from'),t=tr.querySelector('.to');if(f)f.value=$('checkin')?.value||'';if(t)t.value=$('checkout')?.value||'';}}
  function markManual(tr){if(tr)tr.dataset.defaultDates='0';}
  function setNights(v){const n=$('nights'),ci=$('checkin'),co=$('checkout');if(!n)return;v=Math.max(0,Math.min(365,parseInt(v,10)||0));n.value=v;if(ci&&co&&parse(ci.value))co.value=v?addDays(ci.value,v):'';if(typeof window.recalc==='function')window.recalc();}

  const n=$('nights');
  if(n){n.readOnly=false;n.type='number';n.min='0';n.max='365';n.step='1';n.addEventListener('input',()=>setNights(n.value));}

  function rowCalendar(input){
    let picker=document.querySelector('.hc-row-picker');if(picker)picker.remove();
    const tr=input.closest('tr'),isTo=input.classList.contains('to');
    const current=parse(input.value)||parse($('checkin')?.value)||new Date();let month=new Date(current.getFullYear(),current.getMonth(),1);
    picker=document.createElement('div');picker.className='hc-row-picker';document.body.appendChild(picker);
    function render(){
      picker.innerHTML='';const head=document.createElement('div');head.className='hc-row-head';const prev=document.createElement('button'),title=document.createElement('strong'),next=document.createElement('button');
      prev.type=next.type='button';prev.textContent='‹';next.textContent='›';title.textContent=month.toLocaleString('en-US',{month:'long',year:'numeric'});prev.onclick=e=>{e.preventDefault();month=new Date(month.getFullYear(),month.getMonth()-1,1);render()};next.onclick=e=>{e.preventDefault();month=new Date(month.getFullYear(),month.getMonth()+1,1);render()};head.append(prev,title,next);picker.append(head);
      const grid=document.createElement('div');grid.className='hc-row-grid';['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(x=>{const s=document.createElement('span');s.textContent=x;grid.append(s)});
      const first=new Date(month.getFullYear(),month.getMonth(),1),off=(first.getDay()+6)%7;for(let i=0;i<off;i++){const s=document.createElement('span');s.className='empty';grid.append(s)}
      const min=isTo?parse(tr.querySelector('.from')?.value):null;
      for(let day=1;day<=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();day++){const d=new Date(month.getFullYear(),month.getMonth(),day),b=document.createElement('button');b.type='button';b.textContent=day;if(min&&d<min)b.disabled=true;if(parse(input.value)?.getTime()===d.getTime())b.classList.add('selected');b.onclick=e=>{e.preventDefault();e.stopPropagation();input.value=display(d);markManual(tr);picker.remove();if(typeof window.recalc==='function')window.recalc()};grid.append(b)}
      picker.append(grid);
    }
    render();const r=input.getBoundingClientRect();picker.style.left=Math.min(Math.max(8,r.left),window.innerWidth-300)+'px';picker.style.top=Math.min(r.bottom+5,window.innerHeight-340)+'px';
  }
  function prepareDate(input){
    if(!input||input.dataset.stayDateReady)return;input.dataset.stayDateReady='1';const initial=parse(input.value);input.type='text';input.placeholder='DD.MM.YYYY';input.value=display(initial);
    input.addEventListener('input',()=>{input.value=input.value.replace(/[^\d.]/g,'').slice(0,10)});
    input.addEventListener('blur',()=>{if(input.value&&!parse(input.value))input.value='';markManual(input.closest('tr'));if(typeof window.recalc==='function')window.recalc()});
    input.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();rowCalendar(input)});
  }
  function prepareRows(){rows.querySelectorAll('tr').forEach(tr=>{defaultDates(tr);tr.querySelectorAll('.from,.to').forEach(prepareDate)});colorRows();}
  prepareRows();

  if(typeof window.addRow==='function'&&!window.addRow.__stayDefaultsOnly){
    const original=window.addRow;
    function wrapped(data){const result=original(data||{});const list=[...rows.querySelectorAll('tr')],tr=list[list.length-1];if(tr){tr.dataset.defaultDates=globalType(tr)?'1':'0';defaultDates(tr);tr.querySelectorAll('.from,.to').forEach(prepareDate);colorRows();if(typeof window.recalc==='function')window.recalc();}return result;}
    wrapped.__stayDefaultsOnly=true;window.addRow=wrapped;
  }

  rows.addEventListener('change',e=>{const tr=e.target.closest('tr');if(!tr)return;if(e.target.classList.contains('type')){tr.dataset.type=e.target.value;tr.dataset.defaultDates=globalType(tr)?'1':'0';if(globalType(tr))defaultDates(tr);colorRows();if(typeof window.recalc==='function')window.recalc();}if(e.target.classList.contains('item')){if(globalType(tr)){tr.dataset.defaultDates='1';defaultDates(tr)}colorRows();if(typeof window.recalc==='function')window.recalc();}});
  ['checkin','checkout'].forEach(id=>$(id)?.addEventListener('change',()=>{rows.querySelectorAll('tr').forEach(tr=>{if(tr.dataset.defaultDates==='1')defaultDates(tr)});colorRows();}));
  const style=document.createElement('style');style.textContent=`
    .hc-row-picker{position:fixed;z-index:100001;width:290px;background:#fff;border:1px solid #d8dee6;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:10px}
    .hc-row-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.hc-row-head button{width:28px;height:28px;padding:0;border:0;border-radius:5px;background:#f1f3f5;font-size:18px}
    .hc-row-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.hc-row-grid span,.hc-row-grid button{height:28px;display:flex;align-items:center;justify-content:center;font-size:12px}.hc-row-grid span{color:#6b7280}.hc-row-grid .empty{visibility:hidden}.hc-row-grid button{border:0;background:#fff;border-radius:4px;cursor:pointer}.hc-row-grid button:hover:not(:disabled),.hc-row-grid button.selected{background:#17365d;color:#fff}.hc-row-grid button:disabled{color:#c5cbd3;cursor:not-allowed}
    .nights-stepper{display:block!important}.nights-stepper>#nights{width:100%!important;border-radius:6px!important}.nights-controls{display:none!important}
  `;document.head.appendChild(style);
})();
'''

pos=s.rfind('</body>')
if pos==-1: raise RuntimeError('No </body> found')
s=s[:pos]+'<script>\n'+js+'\n</script>\n'+s[pos:]
INDEX.write_text(s,encoding='utf-8')
