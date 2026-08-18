from pathlib import Path

patch=Path('.github/patch_guest_gt.py'); index=Path('index.html')
p=patch.read_text(encoding='utf-8')
repls=[
("function renderPicker(){\n    closePicker(); if(!pickerTarget)return;", "function renderPicker(){\n    if(picker){picker.remove();picker=null;} if(!pickerTarget)return;"),
("e.onclick=()=>{pickerTarget.value=val; pickerTarget.dispatchEvent(new Event('input',{bubbles:true})); closePicker();};", "e.onclick=()=>{const wasCheckin=pickerTarget.id==='checkin'; const selected=val; pickerTarget.value=selected; pickerTarget.dispatchEvent(new Event('input',{bubbles:true})); closePicker(); if(wasCheckin && $('checkout')) openPicker($('checkout'),selected);};"),
("function openPicker(input,monthHint){pickerTarget=input; const d=dateObj(input.value)||dateObj(monthHint)||new Date();", "function openPicker(input,monthHint){if(input.id==='checkout' && $('checkin').value)input.dataset.minDate=$('checkin').value; pickerTarget=input; const d=dateObj(input.value)||dateObj(monthHint)||new Date();"),
("} else if(id==='checkout') $('nights').value=calc(ci,co);", "} else if(id==='checkout'){if(ci&&co&&dateObj(co)<dateObj(ci)){$('checkout').value='';$('nights').value=0;}else $('nights').value=calc(ci,co);}"),
]
for a,b in repls:p=p.replace(a,b)
needle="  function recalc2(){\n    $('nights').value=calc($('checkin').value,$('checkout').value);"
if "function sortRows()" not in p:
    p=p.replace(needle,"  function sortRows(){const order={ROOM:0,EXTRA:1,MEAL:2,DINNER:3,TRANSFER:4};const rows=[...ROWS.querySelectorAll('tr')];rows.sort((a,b)=>{const ta=a.dataset.type||a.querySelector('.type').value,tb=b.dataset.type||b.querySelector('.type').value;const ga=/^green tax$/i.test(a.querySelector('.item').value||'')?99:(order[ta]??98);const gb=/^green tax$/i.test(b.querySelector('.item').value||'')?99:(order[tb]??98);return ga-gb});rows.forEach(r=>ROWS.appendChild(r))}\n\n  function recalc2(){\n    sortRows();\n    $('nights').value=calc($('checkin').value,$('checkout').value);",1)
old="    ROWS.innerHTML='';\n    addRow({type:'ROOM',qty:1,autoDates:true}); addRow({type:'TRANSFER',qty:1,autoDates:false}); addRow({type:'EXTRA',item:'Green Tax',qty:0,rate:12,autoDates:true});"
new="    ROWS.innerHTML='';\n    [{type:'ROOM',qty:1},{type:'TRANSFER',qty:1},{type:'EXTRA',item:'Green Tax',qty:0,rate:12}].forEach(data=>{try{addRow(data)}catch(e){console.error('Initial row error',e)}});\n    if(ROWS.querySelectorAll('tr').length<3){\n      ROWS.innerHTML='';\n      [{type:'ROOM',qty:1},{type:'TRANSFER',qty:1},{type:'EXTRA',item:'Green Tax',qty:0,rate:12}].forEach(data=>addRow(data));\n    }"
p=p.replace(old,new)
patch.write_text(p,encoding='utf-8')
js_start=p.index("js = r'''")+len("js = r'''"); js_end=p.index("'''",js_start); js=p[js_start:js_end]
s=index.read_text(encoding='utf-8'); marker='/* HOTEL CALCULATOR v2 override */'; start=s.index(marker); end=s.index('</script>',start); index.write_text(s[:start]+js+'\n'+s[end:],encoding='utf-8')
s=index.read_text(encoding='utf-8')
s=s.replace('<td></td><td></td><td><input class="nights"','<td><input class="from" type="text"></td><td><input class="to" type="text"></td><td><input class="nights"')

# DINNER and TRANSFER are one-time charges. OW uses dates for display only, not nights multiplication.
s=s.replace("||type==='DINNER'||type==='TRANSFER'&&/\\bOW\\b/i.test(item)", "")
s=s.replace("||type==='DINNER'||type==='TRANSFER'&&/\\bOW\\b/i.test(tr.querySelector('.item').value)", "")
s=s.replace("||x.type==='DINNER'||x.type==='TRANSFER'&&/\\bOW\\b/i.test(x.item)", "")
s=s.replace("||g.rows[0].type==='DINNER'||g.rows[0].type==='TRANSFER'&&/\\bOW\\b/i.test(g.rows[0].item)", "")

fallback=r'''/* Ensure required initial rows exist even if the earlier row builder fails. */
(function(){
  const rows=document.getElementById('rows');
  if(!rows || rows.querySelectorAll('tr').length>=3)return;
  const first=rows.querySelector('tr');
  if(!first)return;
  function bind(tr){
    const type=tr.querySelector('.type'), item=tr.querySelector('.item');
    type.addEventListener('change',()=>{tr.dataset.type=type.value;item.setAttribute('list','list_'+type.value);applyAutoQty(tr);recalc()});
    item.addEventListener('input',()=>{applyAutoQty(tr);recalc()});
    ['.from','.to','.qty','.rate'].forEach(sel=>tr.querySelector(sel).addEventListener('input',()=>recalc()));
    tr.querySelector('.discounts').addEventListener('input',()=>recalc());
    tr.querySelector('.delete').addEventListener('click',()=>{tr.remove();recalc()});
  }
  function cloneRow(type,item,qty,rate){
    const tr=first.cloneNode(true);tr.dataset.type=type;tr.dataset.autoDates='0';
    tr.querySelector('.type').value=type;tr.querySelector('.item').value=item;tr.querySelector('.from').value='';tr.querySelector('.to').value='';tr.querySelector('.nights').value='';tr.querySelector('.qty').value=qty;tr.querySelector('.rate').value=rate;
    tr.querySelectorAll('.discount').forEach((d,i)=>{if(i>0)d.parentElement.remove();else d.value=0});
    rows.appendChild(tr);bind(tr);applyAutoQty(tr);return tr;
  }
  if(rows.querySelectorAll('tr').length<2)cloneRow('TRANSFER','',1,'');
  if(rows.querySelectorAll('tr').length<3)cloneRow('EXTRA','Green Tax',0,12);
  recalc();
})();'''
start_marker='/* Ensure required initial rows exist even if the earlier row builder fails. */'
if start_marker in s:
    s=s[:s.index(start_marker)]+fallback+'\n'+s[s.index('</script>',s.index(start_marker)):]
else:
    s=s.replace('</script>',fallback+'\n</script>',1)
index.write_text(s,encoding='utf-8')
