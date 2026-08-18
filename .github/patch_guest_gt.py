from pathlib import Path

p = Path("index.html")
s = p.read_text(encoding="utf-8")
marker = "/* HOTEL CALCULATOR v2 override */"
if marker in s:
    raise SystemExit(0)

# Keep the existing application intact and inject the new behavior layer at the end of the existing script.
js = r'''/* HOTEL CALCULATOR v2 override */
(function(){
  const ROWS=document.getElementById('rows');
  const $=id=>document.getElementById(id);
  const TYPE_ORDER=['ROOM','EXTRA','MEAL','DINNER','TRANSFER'];
  const oldColors={ROOM:'#2f80d1',MEAL:'#4caf50',TRANSFER:'#8064c8',DINNER:'#ed7d31',EXTRA:'#d4a500'};

  function pad(n){return String(n).padStart(2,'0')}
  function isoToDisplay(v){if(!v)return ''; if(/^\d{2}\.\d{2}\.\d{4}$/.test(v))return v; const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v); return m?`${m[3]}.${m[2]}.${m[1]}`:''}
  function displayToIso(v){if(!v)return ''; const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v.trim()); return m?`${m[3]}-${m[2]}-${m[1]}`:''}
  function dateObj(v){const iso=displayToIso(v)||v; const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||''); if(!m)return null; const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3])); return d.getFullYear()==Number(m[1])&&d.getMonth()==Number(m[2])-1&&d.getDate()==Number(m[3])?d:null}
  function calc(a,b){const x=dateObj(a),y=dateObj(b); if(!x||!y)return 0; return Math.max(0,Math.round((y-x)/86400000))}
  function fmtDate(v){const d=dateObj(v);return d?`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`:''}
  window.calcNights=calc;
  window.dshort=function(v){const d=dateObj(v);return d?`${pad(d.getDate())}.${pad(d.getMonth()+1)}`:''};

  function makeDateInput(cls,value,onChange){
    const input=document.createElement('input'); input.className=cls; input.type='text'; input.inputMode='numeric'; input.placeholder='DD.MM.YYYY'; input.maxLength=10; input.value=fmtDate(value);
    input.addEventListener('input',()=>{input.value=input.value.replace(/[^0-9.]/g,'').slice(0,10); onChange&&onChange(input)});
    input.addEventListener('blur',()=>{if(input.value && !dateObj(input.value)){input.value='';} onChange&&onChange(input)});
    input.addEventListener('click',()=>openPicker(input));
    return input;
  }

  let picker=null, pickerTarget=null, pickerMonth=null;
  function openPicker(input,monthHint){if(input.id==='checkout' && $('checkin').value)input.dataset.minDate=$('checkin').value; pickerTarget=input; const d=dateObj(input.value)||dateObj(monthHint)||new Date(); pickerMonth=new Date(d.getFullYear(),d.getMonth(),1); renderPicker();}
  function closePicker(){if(picker){picker.remove();picker=null;pickerTarget=null}}
  function renderPicker(){
    if(picker){picker.remove();picker=null;} if(!pickerTarget)return;
    picker=document.createElement('div'); picker.className='hc-picker';
    const head=document.createElement('div'); head.className='hc-picker-head';
    const prev=document.createElement('button'); prev.type='button'; prev.textContent='‹';
    const next=document.createElement('button'); next.type='button'; next.textContent='›';
    const title=document.createElement('strong'); title.textContent=pickerMonth.toLocaleString('en-US',{month:'long',year:'numeric'});
    prev.onclick=()=>{pickerMonth.setMonth(pickerMonth.getMonth()-1);renderPicker()}; next.onclick=()=>{pickerMonth.setMonth(pickerMonth.getMonth()+1);renderPicker()};
    head.append(prev,title,next); picker.append(head);
    const days=document.createElement('div'); days.className='hc-days'; ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(x=>{const e=document.createElement('span');e.textContent=x;days.append(e)});
    const first=new Date(pickerMonth.getFullYear(),pickerMonth.getMonth(),1); let offset=(first.getDay()+6)%7;
    for(let i=0;i<offset;i++){const e=document.createElement('span');e.className='empty';days.append(e)}
    const min=pickerTarget.dataset.minDate?dateObj(pickerTarget.dataset.minDate):null;
    const max=pickerTarget.dataset.maxDate?dateObj(pickerTarget.dataset.maxDate):null;
    const count=new Date(pickerMonth.getFullYear(),pickerMonth.getMonth()+1,0).getDate();
    for(let day=1;day<=count;day++){const d=new Date(pickerMonth.getFullYear(),pickerMonth.getMonth(),day),e=document.createElement('button');e.type='button';e.textContent=day;const val=`${pad(day)}.${pad(d.getMonth()+1)}.${d.getFullYear()}`; if((min&&d<min)||(max&&d>max)){e.disabled=true;e.className='disabled'} if(fmtDate(pickerTarget.value)===val)e.className='selected'; e.onclick=()=>{const wasCheckin=pickerTarget.id==='checkin'; const selected=val; pickerTarget.value=selected; pickerTarget.dispatchEvent(new Event('input',{bubbles:true})); closePicker(); if(wasCheckin && $('checkout')) openPicker($('checkout'),selected);}; days.append(e)}
    picker.append(days);
    const rect=pickerTarget.getBoundingClientRect(); picker.style.position='fixed'; picker.style.left=Math.min(rect.left,window.innerWidth-300)+'px'; picker.style.top=(rect.bottom+4)+'px'; document.body.append(picker);
  }
  document.addEventListener('mousedown',e=>{if(picker&&!picker.contains(e.target)&&e.target!==pickerTarget)closePicker()});
  window.addEventListener('resize',closePicker);

  function replaceGlobalDate(id){const old=$(id); if(!old)return old; const n=makeDateInput(id,old.value,()=>globalDateChanged(id)); old.replaceWith(n); return n}
  function globalDateChanged(id){
    const ci=$('checkin').value, co=$('checkout').value;
    if(id==='checkin'){
      const n=parseInt($('nights').value,10)||0;
      if(ci && n>0) $('checkout').value=fmtDate(new Date(dateObj(ci).getTime()+n*86400000));
      else if(co && calc(ci,co)>0) $('nights').value=calc(ci,co);
    } else if(id==='checkout'){if(ci&&co&&dateObj(co)<dateObj(ci)){$('checkout').value='';$('nights').value=0;}else $('nights').value=calc(ci,co);}
    syncDefaultDates(); recalc();
  }

  function addRow(data={}){
    const tr=document.createElement('tr'); tr.dataset.type=data.type||''; tr.dataset.defaultDates=(data.defaultDates?'1':'0');
    tr.dataset.autoDates=(data.type==='ROOM'||data.type==='MEAL'||data.type==='EXTRA'&&/^green tax$/i.test(data.item||''))?'1':'0';
    tr.innerHTML=`<td><select class="type">${typeOptions(data.type||"")}</select></td><td><input class="item" value="${escapeHtml(data.item||"")}" placeholder="Choose or type manually"></td><td></td><td></td><td><input class="nights" readonly></td><td><input class="qty" type="number" min="0" step="1" value="${data.qty??""}"></td><td><input class="rate" type="number" min="0" step="0.01" value="${data.rate??""}"></td><td class="discounts"></td><td class="net">0.00</td><td><button class="delete">×</button></td>`;
    ROWS.appendChild(tr);
    const from=makeDateInput('from',data.from||'',()=>rowDateChanged(tr)); const to=makeDateInput('to',data.to||'',()=>rowDateChanged(tr)); tr.children[2].appendChild(from); tr.children[3].appendChild(to);
    setupDiscounts(tr,data);
    const type=tr.querySelector('.type'), item=tr.querySelector('.item');
    type.addEventListener('change',()=>{tr.dataset.type=type.value; item.setAttribute('list','list_'+type.value); if(type.value==='ROOM'||type.value==='MEAL'){tr.dataset.autoDates='1';applyDefaultDates(tr)}else if(type.value==='EXTRA'&&/^green tax$/i.test(item.value)){tr.dataset.autoDates='1';applyDefaultDates(tr)}else{tr.dataset.autoDates='0';if(type.value==='EXTRA'){tr.querySelector('.from').value='';tr.querySelector('.to').value='';}} applyAutoQty2(tr);recalc();});
    item.addEventListener('input',()=>{if(tr.dataset.type==='EXTRA'&&/^green tax$/i.test(item.value)){tr.dataset.autoDates='1';applyDefaultDates(tr)}else if(tr.dataset.type==='EXTRA'){tr.dataset.autoDates='0'} applyAutoQty2(tr);recalc()});
    ['.qty','.rate'].forEach(sel=>tr.querySelector(sel).addEventListener('input',recalc));
    tr.querySelector('.discounts').addEventListener('input',recalc);
    tr.querySelector('.delete').addEventListener('click',()=>{tr.remove();recalc()});
    item.setAttribute('list','list_'+(data.type||'')); applyAutoQty2(tr); applyDefaultDates(tr); recalc(); return tr;
  }
  window.addRow=addRow;

  function rowDateChanged(tr){tr.dataset.autoDates='0'; recalc()}
  function applyDefaultDates(tr){if(tr.dataset.autoDates!=='1')return; const type=tr.dataset.type; if(type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&/^green tax$/i.test(tr.querySelector('.item').value||''))){tr.querySelector('.from').value=$('checkin').value;tr.querySelector('.to').value=$('checkout').value}}
  function syncDefaultDates(){document.querySelectorAll('#rows tr').forEach(tr=>applyDefaultDates(tr))}
  window.syncStayDates=function(){};

  function applyAutoQty2(tr){const type=tr.dataset.type,item=(tr.querySelector('.item').value||'').toLowerCase(),q=tr.querySelector('.qty'); if(['MEAL','TRANSFER','DINNER'].includes(type)){if(item.includes('adult'))q.value=$('adults').value||0;else if(item.includes('child'))q.value=$('children').value||0;else if(item.includes('infant'))q.value=$('infants').value||0} if(type==='EXTRA'&&/^green tax$/i.test(tr.querySelector('.item').value||'')){q.value=(Number($('adults').value)||0)+(Number($('children').value)||0);if(!tr.querySelector('.rate').value)tr.querySelector('.rate').value=12}}
  window.applyAutoQty=applyAutoQty2;

  function currentRows2(){return [...document.querySelectorAll('#rows tr')].map(tr=>{const type=tr.dataset.type||tr.querySelector('.type').value,item=tr.querySelector('.item').value,from=tr.querySelector('.from').value,to=tr.querySelector('.to').value,nights=calc(from,to),qty=parseFloat(tr.querySelector('.qty').value)||0,rate=parseFloat(tr.querySelector('.rate').value)||0,discounts=getDiscounts(tr);let base=qty*rate;if(type==='ROOM'||type==='MEAL'||type==='DINNER'||type==='TRANSFER'&&/\bOW\b/i.test(item)||type==='EXTRA'&&from&&to)base*=nights;return{type,item,from,to,nights,qty,rate,discounts,net:applyDiscounts(base,discounts)}}).filter(x=>x.type||x.item||x.rate)}
  window.currentRows=currentRows2;

  function sortRows(){const order={ROOM:0,EXTRA:1,MEAL:2,DINNER:3,TRANSFER:4};const rows=[...ROWS.querySelectorAll('tr')];rows.sort((a,b)=>{const ta=a.dataset.type||a.querySelector('.type').value,tb=b.dataset.type||b.querySelector('.type').value;const ga=/^green tax$/i.test(a.querySelector('.item').value||'')?99:(order[ta]??98);const gb=/^green tax$/i.test(b.querySelector('.item').value||'')?99:(order[tb]??98);return ga-gb});rows.forEach(r=>ROWS.appendChild(r))}

  function recalc2(){
    sortRows();
    $('nights').value=calc($('checkin').value,$('checkout').value);
    let total=0; document.querySelectorAll('#rows tr').forEach(tr=>{const type=tr.dataset.type||tr.querySelector('.type').value;const n=calc(tr.querySelector('.from').value,tr.querySelector('.to').value);tr.querySelector('.nights').value=n;applyAutoQty2(tr);const q=parseFloat(tr.querySelector('.qty').value),rate=parseFloat(tr.querySelector('.rate').value),discounts=getDiscounts(tr);let base=0;if(isFinite(q)&&isFinite(rate)){base=q*rate;if(type==='ROOM'||type==='MEAL'||type==='DINNER'||type==='TRANSFER'&&/\bOW\b/i.test(tr.querySelector('.item').value)||type==='EXTRA'&&tr.querySelector('.from').value&&tr.querySelector('.to').value)base*=n}const net=applyDiscounts(base,discounts);tr.querySelector('.net').textContent=fmt(net);total+=net;tr.querySelector('.type').style.background=oldColors[type]||'';tr.querySelector('.type').style.color=type?'white':''});$('grandTotal').textContent='$'+fmt(total);$('topTotal').value=fmt(total)}
  window.recalc=recalc2;

  function typeOptions2(selected=''){return `<option value=""></option>`+TYPE_ORDER.map(x=>`<option ${x===selected?'selected':''}>${x}</option>`).join('')}
  window.typeOptions=typeOptions2;

  function formatFormula(x){let s=`${x.rate?fmt(x.rate).replaceAll(',',''):'0'}*${x.qty}`; if(x.nights>0&&(x.type==='ROOM'||x.type==='MEAL'||x.type==='DINNER'||x.type==='TRANSFER'&&/\bOW\b/i.test(x.item)||x.type==='EXTRA'&&x.from&&x.to))s+=`*${x.nights}`;(x.discounts||[]).forEach(d=>s+=`-${d}%`);return s}
  function cleanLabel(item){return item.replace(/\s*-\s*(Adult|Child|Infant|ADL|CHD|INF)\s*$/i,'').trim()}
  function groupRows(rows,type){const groups=[];rows.filter(x=>x.type===type).forEach(x=>{const base=cleanLabel(x.item),key=[base,x.from,x.to,(x.discounts||[]).join(',')].join('|');let g=groups.find(z=>z.key===key);if(!g){g={key,base,rows:[]};groups.push(g)}g.rows.push(x)});return groups}
  function groupedFormula(g){const parts=g.rows.map(x=>`${fmt(x.rate).replaceAll(',','')}*${x.qty}`);let f=parts.length>1?`(${parts.join('+')})`:parts[0]||'0';if(g.rows[0].nights>0&&(g.rows[0].type==='ROOM'||g.rows[0].type==='MEAL'||g.rows[0].type==='DINNER'||g.rows[0].type==='TRANSFER'&&/\bOW\b/i.test(g.rows[0].item)||g.rows[0].type==='EXTRA'&&g.rows[0].from&&g.rows[0].to))f+=`*${g.rows[0].nights}`;(g.rows[0].discounts||[]).forEach(d=>f+=`-${d}%`);return f}
  function shareText2(){recalc2();const rows=currentRows2(),out=[];const hotel=($('hotel').value||'Hotel').toUpperCase();out.push(hotel);const pax=[];if(Number($('adults').value)>0)pax.push(`${$('adults').value} ADL`);if(Number($('children').value)>0)pax.push(`${$('children').value} CHD`);if(Number($('infants').value)>0)pax.push(`${$('infants').value} INF`);if(pax.length)out.push(pax.join(' / '));if($('ages').value.trim())out.push(`Ages: ${$('ages').value.trim()}`);if($('spo').value.trim())out.push(`SPO: ${$('spo').value.trim()}`);out.push('');
    groupRows(rows,'ROOM').forEach(g=>g.rows.forEach(r=>out.push(`${window.dshort(r.from)} - ${window.dshort(r.to)} : ${g.base} : ${formatFormula(r)} = ${fmt(r.net)}`)));
    groupRows(rows,'EXTRA').filter(g=>!/^green tax$/i.test(g.base)).forEach(g=>{const prefix=g.rows[0].from&&g.rows[0].to?`${window.dshort(g.rows[0].from)} - ${window.dshort(g.rows[0].to)} : `:'';out.push(`${prefix}${g.base} : ${groupedFormula(g)} = ${fmt(g.rows.reduce((s,x)=>s+x.net,0))}`)});
    groupRows(rows,'MEAL').forEach(g=>{out.push(`${window.dshort(g.rows[0].from)} - ${window.dshort(g.rows[0].to)} : ${g.base} : ${groupedFormula(g)} = ${fmt(g.rows.reduce((s,x)=>s+x.net,0))}`)});
    groupRows(rows,'DINNER').forEach(g=>{out.push(`${g.base} : ${groupedFormula(g)} = ${fmt(g.rows.reduce((s,x)=>s+x.net,0))}`)});
    groupRows(rows,'TRANSFER').forEach(g=>{const ow=/\bOW\b/i.test(g.base);out.push(`${ow?window.dshort(g.rows[0].from)+' - '+window.dshort(g.rows[0].to)+' : ':''}${g.base} : ${groupedFormula(g)} = ${fmt(g.rows.reduce((s,x)=>s+x.net,0))}`)});
    rows.filter(x=>x.type==='EXTRA'&&/^green tax$/i.test(x.item)).forEach(x=>out.push(`Green Tax : ${formatFormula(x)} = ${fmt(x.net)}`));
    out.push('',`TOTAL: ${fmt(rows.reduce((s,x)=>s+x.net,0))} USD`);return out.join('\n')}
  window.shareText=shareText2;

  function shareHtml2(){const text=shareText2();return text.split('\n').map(line=>{const esc=escapeHtml(line);if(!line)return '';if(/^(\d{2}\.\d{2} - \d{2}\.\d{2})/.test(line))return esc.replace(/^(\d{2}\.\d{2} - \d{2}\.\d{2})(\s*:)/,'<strong>$1</strong>$2').replace(/: ([^:]+) :/,' : <strong>$1</strong> :');if(/^(Green Tax|SPO:)/.test(line))return esc.replace(/^(Green Tax|SPO:)/,'<strong>$1</strong>');if(/^[A-Za-z].* :/.test(line))return esc.replace(/^([^:]+)(\s*:)/,'<strong>$1</strong>$2');return esc}).join('\n')}
  window.shareHtml=shareHtml2;

  function init(){
    replaceGlobalDate('checkin'); replaceGlobalDate('checkout');
    $('nights').readOnly=false; $('nights').value='0';
    $('nights').addEventListener('input',()=>{let n=Math.max(0,parseInt($('nights').value,10)||0),ci=dateObj($('checkin').value);if(ci){$('checkout').value=n?fmtDate(new Date(ci.getTime()+n*86400000)):'';syncDefaultDates();recalc2()}});
    $('adults').value='0';$('children').value='0';$('infants').value='0';$('hotel').value='';$('ages').value='';$('spo').value='';
    ROWS.innerHTML='';
    addRow({type:'ROOM',qty:1,autoDates:true}); addRow({type:'TRANSFER',qty:1,autoDates:false}); addRow({type:'EXTRA',item:'Green Tax',qty:0,rate:12,autoDates:true});
    ['adults','children','infants'].forEach(id=>$(id).addEventListener('input',()=>{document.querySelectorAll('#rows tr').forEach(applyAutoQty2);recalc2()}));
    $('checkin').addEventListener('change',()=>globalDateChanged('checkin')); $('checkout').addEventListener('change',()=>globalDateChanged('checkout'));
    recalc2();
  }

  const st=document.createElement('style');st.textContent='.hc-picker{z-index:9999;background:#fff;border:1px solid #d8dee6;border-radius:8px;box-shadow:0 8px 24px #0002;padding:8px;width:276px}.hc-picker-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}.hc-picker-head button{padding:4px 9px;background:#f3f4f6}.hc-days{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.hc-days span,.hc-days button{height:30px;padding:0;display:flex;align-items:center;justify-content:center;font-size:12px}.hc-days span{color:#6b7280}.hc-days .empty{visibility:hidden}.hc-days button{background:#fff;border:0;border-radius:4px;padding:0}.hc-days button:hover:not(:disabled),.hc-days button.selected{background:#17365d;color:#fff}.hc-days button:disabled{color:#c5cbd3;cursor:not-allowed}';document.head.appendChild(st);
  init();
})();
'''
needle = "</script>"
if needle not in s:
    raise SystemExit("script tag not found")
s = s.replace(needle, js + "\n" + needle, 1)
p.write_text(s, encoding="utf-8")
