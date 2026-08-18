from pathlib import Path

INDEX = Path("index.html")
s = INDEX.read_text(encoding="utf-8")

marker = "/* HOTEL CALCULATOR v2 override */"
if marker in s:
    start = s.index(marker)
    end = s.index("</script>", start)
    s = s[:start] + s[end:]
fallback = "/* Ensure required initial rows exist even if the earlier row builder fails. */"
if fallback in s:
    start = s.index(fallback)
    end = s.index("</script>", start)
    s = s[:start] + s[end:]

js = r'''
/* HOTEL CALCULATOR FIXED DATE/ROW LAYER */
(function(){
  const $=id=>document.getElementById(id);
  const ROWS=$('rows');
  const COLORS={ROOM:'#2f80d1',MEAL:'#4caf50',TRANSFER:'#8064c8',DINNER:'#ed7d31',EXTRA:'#d4a500'};
  const ORDER={ROOM:0,EXTRA:1,MEAL:2,DINNER:3,TRANSFER:4};
  const pad=n=>String(n).padStart(2,'0');
  function parseDate(v){
    if(!v)return null;
    let m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(v).trim());
    if(m)v=`${m[3]}-${m[2]}-${m[1]}`;
    m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v).trim());
    if(!m)return null;
    const d=new Date(+m[1],+m[2]-1,+m[3]);
    return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null;
  }
  const display=v=>{const d=parseDate(v);return d?`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`:''};
  const short=v=>{const d=parseDate(v);return d?`${pad(d.getDate())}.${pad(d.getMonth()+1)}`:''};
  const nights=(a,b)=>{const x=parseDate(a),y=parseDate(b);return x&&y?Math.max(0,Math.round((y-x)/86400000)):0};
  const addDays=(v,n)=>{const d=parseDate(v);if(!d)return '';d.setDate(d.getDate()+n);return display(d)};
  const money=n=>Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  function discounts(tr){return [...tr.querySelectorAll('.discount')].map(x=>Number(x.value)||0).filter(x=>x>0)}
  function applyDiscounts(v,ds){return ds.reduce((x,d)=>x*(1-d/100),v)}

  let picker=null,target=null,pickerStart=null,pickerTwo=false;
  function closePicker(){if(picker){picker.remove();picker=null}}
  function monthTitle(d){return d.toLocaleString('en-US',{month:'long',year:'numeric'})}
  function drawMonth(parent,month,minDate,selected){
    const box=document.createElement('div');box.className='hc-month';
    const title=document.createElement('div');title.className='hc-month-title';title.textContent=monthTitle(month);box.append(title);
    const grid=document.createElement('div');grid.className='hc-grid';
    ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(x=>{const h=document.createElement('span');h.textContent=x;grid.append(h)});
    const first=new Date(month.getFullYear(),month.getMonth(),1),offset=(first.getDay()+6)%7;
    for(let i=0;i<offset;i++){const e=document.createElement('span');e.className='empty';grid.append(e)}
    const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let day=1;day<=count;day++){
      const d=new Date(month.getFullYear(),month.getMonth(),day),b=document.createElement('button');
      b.type='button';b.textContent=day;const value=display(d);
      if(minDate&&d<minDate){b.disabled=true;b.className='disabled'}
      if(selected===value)b.classList.add('selected');
      b.onclick=()=>{
        const isCheckin=target.id==='checkin';
        target.value=value;
        target.dispatchEvent(new Event('change',{bubbles:true}));
        closePicker();
        if(isCheckin)openPicker($('checkout'),value,true);
      };
      grid.append(b);
    }
    box.append(grid);parent.append(box);
  }
  function showPicker(){
    if(!target)return;
    closePicker();
    picker=document.createElement('div');picker.className='hc-picker';
    const head=document.createElement('div');head.className='hc-picker-head';
    const prev=document.createElement('button');prev.type='button';prev.textContent='‹';
    const title=document.createElement('strong');title.textContent=pickerTwo?'Select Check-out':'Select date';
    const next=document.createElement('button');next.type='button';next.textContent='›';
    prev.onclick=()=>{pickerStart.setMonth(pickerStart.getMonth()-1);showPicker()};
    next.onclick=()=>{pickerStart.setMonth(pickerStart.getMonth()+1);showPicker()};
    head.append(prev,title,next);picker.append(head);
    const months=document.createElement('div');months.className=pickerTwo?'hc-months two':'hc-months';
    const min=target.id==='checkout'&&$('checkin').value?parseDate($('checkin').value):null;
    const selected=display(target.value);
    drawMonth(months,new Date(pickerStart),min,selected);
    if(pickerTwo)drawMonth(months,new Date(pickerStart.getFullYear(),pickerStart.getMonth()+1,1),min,selected);
    picker.append(months);
    const r=target.getBoundingClientRect(),width=pickerTwo?520:280;
    picker.style.left=Math.min(Math.max(8,r.left),window.innerWidth-width-8)+'px';
    picker.style.top=(r.bottom+4)+'px';
    document.body.append(picker);
  }
  function openPicker(input,monthHint,twoMonths=false){
    target=input;
    const base=parseDate(monthHint)||parseDate(input.value)||parseDate($('checkin').value)||new Date();
    pickerStart=new Date(base.getFullYear(),base.getMonth(),1);
    pickerTwo=twoMonths||input.id==='checkout';
    if(input.id==='checkout'&&$('checkin').value){const ci=parseDate($('checkin').value);pickerStart=new Date(ci.getFullYear(),ci.getMonth(),1)}
    showPicker();
  }
  document.addEventListener('mousedown',e=>{if(picker&&!picker.contains(e.target)&&e.target!==target)closePicker()});
  window.addEventListener('resize',closePicker);

  function dateInput(cls,value,onManual){
    const i=document.createElement('input');
    i.className=cls;i.type='text';i.inputMode='numeric';i.maxLength=10;i.placeholder='DD.MM.YYYY';i.value=display(value);
    i.addEventListener('input',()=>{i.value=i.value.replace(/[^\d.]/g,'').slice(0,10)});
    i.addEventListener('blur',()=>{if(i.value&&!parseDate(i.value))i.value='';onManual&&onManual(i)});
    i.addEventListener('click',()=>openPicker(i));
    return i;
  }
  function replaceGlobalDates(){
    const ci=$('checkin'),co=$('checkout');
    const ni=dateInput('global-date',ci.value,()=>globalChanged('checkin'));ni.id='checkin';ci.replaceWith(ni);
    const no=dateInput('global-date',co.value,()=>globalChanged('checkout'));no.id='checkout';co.replaceWith(no);
  }
  function globalChanged(which){
    const ci=$('checkin').value,co=$('checkout').value;
    if(which==='checkin'){
      const n=Math.max(0,parseInt($('nights').value,10)||0);
      if(ci&&n>0)$('checkout').value=addDays(ci,n);
      else if(ci&&co&&parseDate(co)>=parseDate(ci))$('nights').value=nights(ci,co);
      else if(co&&parseDate(co)<parseDate(ci)){$('checkout').value='';$('nights').value=0}
    }else{
      if(ci&&co&&parseDate(co)<parseDate(ci)){$('checkout').value='';$('nights').value=0}
      else $('nights').value=nights(ci,co);
    }
    syncDefaultDates();recalc();
  }

  function typeOptions(selected=''){return `<option value=""></option>${Object.keys(ORDER).map(x=>`<option ${x===selected?'selected':''}>${x}</option>`).join('')}`}
  function setupDiscounts(tr,data={}){
    const box=tr.querySelector('.discounts');box.innerHTML='';
    const values=[data.d1??data.discount??0,data.d2??0,data.d3??0,data.d4??0];let count=1;
    for(let i=1;i<4;i++)if(Number(values[i])>0)count=i+1;
    for(let i=0;i<count;i++){
      const wrap=document.createElement('span');wrap.className='discount-item';
      const inp=document.createElement('input');inp.className='discount';inp.type='number';inp.min=0;inp.max=100;inp.step=1;inp.value=values[i]||0;wrap.append(inp);
      if(i>0){const rm=document.createElement('button');rm.type='button';rm.className='discount-remove';rm.textContent='−';rm.onclick=()=>{wrap.remove();recalc()};wrap.append(rm)}box.append(wrap);
    }
    const add=document.createElement('button');add.type='button';add.className='discount-add';add.textContent='+';
    add.onclick=()=>{if(box.querySelectorAll('.discount').length<4){const wrap=document.createElement('span');wrap.className='discount-item';const inp=document.createElement('input');inp.className='discount';inp.type='number';inp.min=0;inp.max=100;inp.step=1;inp.value=0;const rm=document.createElement('button');rm.type='button';rm.className='discount-remove';rm.textContent='−';rm.onclick=()=>{wrap.remove();recalc()};wrap.append(inp,rm);box.insertBefore(wrap,add);recalc()}};box.append(add);
  }
  function rowDatesManual(tr){tr.dataset.defaultDates='0';recalc()}
  function setDefaultDates(tr){
    if(tr.dataset.defaultDates!=='1')return;
    const type=tr.dataset.type,item=tr.querySelector('.item').value||'';
    if(type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&/^green tax$/i.test(item))){tr.querySelector('.from').value=display($('checkin').value);tr.querySelector('.to').value=display($('checkout').value)}
  }
  function syncDefaultDates(){ROWS.querySelectorAll('tr').forEach(setDefaultDates)}
  function applyQty(tr){
    const type=tr.dataset.type,item=(tr.querySelector('.item').value||'').toLowerCase(),q=tr.querySelector('.qty');
    if(['MEAL','TRANSFER','DINNER'].includes(type)){if(item.includes('adult'))q.value=$('adults').value||0;else if(item.includes('child'))q.value=$('children').value||0;else if(item.includes('infant'))q.value=$('infants').value||0}
    if(type==='EXTRA'&&/^green tax$/i.test(tr.querySelector('.item').value||'')){q.value=(Number($('adults').value)||0)+(Number($('children').value)||0);if(!tr.querySelector('.rate').value)tr.querySelector('.rate').value=12}
  }
  function addRow(data={}){
    const tr=document.createElement('tr');tr.dataset.type=data.type||'';
    tr.dataset.defaultDates=(data.defaultDates===undefined?((data.type==='ROOM'||data.type==='MEAL'||(data.type==='EXTRA'&&/^green tax$/i.test(data.item||'')))?'1':'0'):(data.defaultDates?'1':'0'));
    tr.innerHTML=`<td><select class="type">${typeOptions(data.type||'')}</select></td><td><input class="item" value="${esc(data.item||'')}" placeholder="Choose or type manually"></td><td class="from-cell"></td><td class="to-cell"></td><td><input class="nights" readonly></td><td><input class="qty" type="number" min="0" step="1" value="${data.qty??''}"></td><td><input class="rate" type="number" min="0" step="0.01" value="${data.rate??''}"></td><td class="discounts"></td><td class="net">0.00</td><td><button type="button" class="delete">×</button></td>`;
    ROWS.appendChild(tr);
    const f=dateInput('from',data.from||'',()=>rowDatesManual(tr)),t=dateInput('to',data.to||'',()=>rowDatesManual(tr));
    f.addEventListener('change',()=>rowDatesManual(tr));t.addEventListener('change',()=>rowDatesManual(tr));
    tr.querySelector('.from-cell').append(f);tr.querySelector('.to-cell').append(t);setupDiscounts(tr,data);
    const type=tr.querySelector('.type'),item=tr.querySelector('.item');
    type.onchange=()=>{tr.dataset.type=type.value;item.setAttribute('list','list_'+type.value);if(type.value==='ROOM'||type.value==='MEAL'||(type.value==='EXTRA'&&/^green tax$/i.test(item.value))){tr.dataset.defaultDates='1';setDefaultDates(tr)}else{tr.dataset.defaultDates='0';f.value='';t.value=''}applyQty(tr);recalc()};
    item.oninput=()=>{if(tr.dataset.type==='EXTRA'&&/^green tax$/i.test(item.value)){tr.dataset.defaultDates='1';setDefaultDates(tr)}else if(tr.dataset.type==='EXTRA'){tr.dataset.defaultDates='0';f.value='';t.value=''}applyQty(tr);recalc()};
    ['.qty','.rate'].forEach(sel=>tr.querySelector(sel).addEventListener('input',recalc));tr.querySelector('.discounts').addEventListener('input',recalc);tr.querySelector('.delete').onclick=()=>{tr.remove();recalc()};
    item.setAttribute('list','list_'+(data.type||''));applyQty(tr);setDefaultDates(tr);recalc();return tr;
  }
  window.addRow=addRow;
  function rowsData(){return [...ROWS.querySelectorAll('tr')].map(tr=>{const type=tr.dataset.type||tr.querySelector('.type').value,item=tr.querySelector('.item').value,from=tr.querySelector('.from').value,to=tr.querySelector('.to').value,n=nights(from,to),qty=Number(tr.querySelector('.qty').value)||0,rate=Number(tr.querySelector('.rate').value)||0,ds=discounts(tr);let base=qty*rate;if(type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&/^green tax$/i.test(item)))base*=n;else if(type==='EXTRA'&&from&&to)base*=n;return{type,item,from,to,nights:n,qty,rate,discounts:ds,net:applyDiscounts(base,ds)}}).filter(x=>x.type||x.item||x.rate)}
  window.currentRows=rowsData;
  function recalc(){
    const ci=$('checkin').value,co=$('checkout').value;if(document.activeElement!==$('nights'))$('nights').value=nights(ci,co);let total=0;
    ROWS.querySelectorAll('tr').forEach(tr=>{const type=tr.dataset.type||tr.querySelector('.type').value,from=tr.querySelector('.from').value,to=tr.querySelector('.to').value,n=nights(from,to);tr.querySelector('.nights').value=n;applyQty(tr);const q=Number(tr.querySelector('.qty').value),rate=Number(tr.querySelector('.rate').value),ds=discounts(tr);let base=0;if(Number.isFinite(q)&&Number.isFinite(rate)){base=q*rate;if(type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&from&&to))base*=n}const net=applyDiscounts(base,ds);tr.querySelector('.net').textContent=money(net);total+=net;tr.querySelector('.type').style.background=COLORS[type]||'';tr.querySelector('.type').style.color=type?'white':''});
    const all=[...ROWS.querySelectorAll('tr')];all.sort((a,b)=>{const ta=a.dataset.type||a.querySelector('.type').value,tb=b.dataset.type||b.querySelector('.type').value,ga=ta==='EXTRA'&&/^green tax$/i.test(a.querySelector('.item').value)?99:(ORDER[ta]??98),gb=tb==='EXTRA'&&/^green tax$/i.test(b.querySelector('.item').value)?99:(ORDER[tb]??98);return ga-gb});all.forEach(x=>ROWS.appendChild(x));$('grandTotal').textContent='$'+money(total);$('topTotal').value=money(total);
  }
  window.recalc=recalc;
  function cleanLabel(s){return String(s||'').replace(/\s*-\s*(Adult|Child|Infant|ADL|CHD|INF)\s*$/i,'').trim()}
  function group(type,rows){const gs=[];rows.filter(x=>x.type===type).forEach(x=>{const key=[cleanLabel(x.item),x.from,x.to,x.discounts.join(',')].join('|');let g=gs.find(z=>z.key===key);if(!g){g={key,base:cleanLabel(x.item),rows:[]};gs.push(g)}g.rows.push(x)});return gs}
  function formula(x){let f=`${money(x.rate).replaceAll(',','')}*${x.qty}`;if(x.type==='ROOM'||x.type==='MEAL'||(x.type==='EXTRA'&&x.from&&x.to))f+=`*${x.nights}`;(x.discounts||[]).forEach(d=>f+=`-${d}%`);return f}
  function groupedFormula(g){let f=g.rows.length>1?`(${g.rows.map(x=>`${money(x.rate).replaceAll(',','')}*${x.qty}`).join('+')})`:`${money(g.rows[0].rate).replaceAll(',','')}*${g.rows[0].qty}`;if(g.rows[0].type==='ROOM'||g.rows[0].type==='MEAL'||(g.rows[0].type==='EXTRA'&&g.rows[0].from&&g.rows[0].to))f+=`*${g.rows[0].nights}`;(g.rows[0].discounts||[]).forEach(d=>f+=`-${d}%`);return f}
  function shareText(){recalc();const rs=rowsData(),out=[];const hotel=($('hotel').value||'').trim();if(hotel)out.push(hotel);const pax=[];if(+$('adults').value>0)pax.push(`${$('adults').value} ADL`);if(+$('children').value>0)pax.push(`${$('children').value} CHD`);if(+$('infants').value>0)pax.push(`${$('infants').value} INF`);if(pax.length)out.push(pax.join(' / '));if($('ages').value.trim())out.push(`Ages: ${$('ages').value.trim()}`);if($('spo').value.trim())out.push(`SPO: ${$('spo').value.trim()}`);if(out.length)out.push('');group('ROOM',rs).forEach(g=>g.rows.forEach(x=>out.push(`${short(x.from)} - ${short(x.to)} : ${g.base} : ${formula(x)} = ${money(x.net)}`)));group('EXTRA',rs).filter(g=>!/^green tax$/i.test(g.base)).forEach(g=>out.push(`${g.base} : ${groupedFormula(g)} = ${money(g.rows.reduce((s,x)=>s+x.net,0))}`));group('MEAL',rs).forEach(g=>out.push(`${short(g.rows[0].from)} - ${short(g.rows[0].to)} : ${g.base} : ${groupedFormula(g)} = ${money(g.rows.reduce((s,x)=>s+x.net,0))}`));group('DINNER',rs).forEach(g=>out.push(`${g.base} : ${groupedFormula(g)} = ${money(g.rows.reduce((s,x)=>s+x.net,0))}`));group('TRANSFER',rs).forEach(g=>{const ow=/\bOW\b/i.test(g.base);out.push(`${ow?short(g.rows[0].from)+' - '+short(g.rows[0].to)+' : ':''}${g.base} : ${groupedFormula(g)} = ${money(g.rows.reduce((s,x)=>s+x.net,0))}`)});rs.filter(x=>x.type==='EXTRA'&&/^green tax$/i.test(x.item)).forEach(x=>out.push(`Green Tax : ${formula(x)} = ${money(x.net)}`));out.push('',`TOTAL: ${money(rs.reduce((s,x)=>s+x.net,0))} USD`);return out.join('\n')}
  window.shareText=shareText;
  window.shareHtml=function(){return shareText().split('\n').map(line=>{const e=esc(line);if(!line)return '';if(/^(\d{2}\.\d{2} - \d{2}\.\d{2}) : ([^:]+) :/.test(line))return e.replace(/^(\d{2}\.\d{2} - \d{2}\.\d{2}) : ([^:]+) :/,'<strong>$1 : $2</strong> :');if(/^([^:]+) :/.test(line))return e.replace(/^([^:]+) :/,'<strong>$1</strong> :');return e}).join('\n')};
  function init(){replaceGlobalDates();$('nights').readOnly=false;$('nights').value='0';$('nights').addEventListener('input',()=>{const n=Math.max(0,parseInt($('nights').value,10)||0),ci=$('checkin').value;if(ci){$('checkout').value=n?addDays(ci,n):'';syncDefaultDates();recalc()}});['adults','children','infants'].forEach(id=>$(id).addEventListener('input',()=>{ROWS.querySelectorAll('tr').forEach(applyQty);recalc()}));$('checkin').addEventListener('change',()=>globalChanged('checkin'));$('checkout').addEventListener('change',()=>globalChanged('checkout'));$('hotel').value='';$('adults').value='0';$('children').value='0';$('infants').value='0';$('ages').value='';$('spo').value='';ROWS.innerHTML='';addRow({type:'ROOM',qty:1,defaultDates:true});addRow({type:'TRANSFER',qty:1,defaultDates:false});addRow({type:'EXTRA',item:'Green Tax',qty:0,rate:12,defaultDates:true});recalc()}
  const style=document.createElement('style');style.textContent=`.hc-picker{z-index:10000;background:#fff;border:1px solid #d8dee6;border-radius:8px;box-shadow:0 8px 24px #0002;padding:10px;width:280px}.hc-picker-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.hc-picker-head button{width:28px;height:28px;padding:0;background:#f3f4f6;border:0;border-radius:5px}.hc-months.two{display:grid;grid-template-columns:1fr 1fr;gap:14px;width:500px}.hc-month-title{text-align:center;font-weight:700;margin-bottom:5px}.hc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.hc-grid span,.hc-grid button{height:28px;display:flex;align-items:center;justify-content:center;font-size:12px}.hc-grid span{color:#6b7280}.hc-grid .empty{visibility:hidden}.hc-grid button{background:#fff;border:0;border-radius:4px;padding:0}.hc-grid button:hover:not(:disabled),.hc-grid button.selected{background:#17365d;color:#fff}.hc-grid button:disabled{color:#c5cbd3;cursor:not-allowed}.global-date{width:100%;height:38px;border:1px solid var(--line);border-radius:6px;padding:7px 9px;background:#fff}td .from,td .to{width:100%;height:32px;border:1px solid #dfe4ea;border-radius:5px;padding:4px 6px}`;document.head.append(style);init();
})();
'''
s = s.replace("</script>", js + "\n</script>", 1)
INDEX.write_text(s, encoding="utf-8")
