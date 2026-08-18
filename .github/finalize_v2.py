from pathlib import Path

patch = Path('.github/patch_guest_gt.py')
index = Path('index.html')
p = patch.read_text(encoding='utf-8')
repls = [
    ("function renderPicker(){\n    closePicker(); if(!pickerTarget)return;", "function renderPicker(){\n    if(picker){picker.remove();picker=null;} if(!pickerTarget)return;"),
    ("e.onclick=()=>{pickerTarget.value=val; pickerTarget.dispatchEvent(new Event('input',{bubbles:true})); closePicker();};", "e.onclick=()=>{const wasCheckin=pickerTarget.id==='checkin'; const selected=val; pickerTarget.value=selected; pickerTarget.dispatchEvent(new Event('input',{bubbles:true})); closePicker(); if(wasCheckin && $('checkout')) openPicker($('checkout'),selected);};"),
    ("function openPicker(input,monthHint){pickerTarget=input; const d=dateObj(input.value)||dateObj(monthHint)||new Date();", "function openPicker(input,monthHint){if(input.id==='checkout' && $('checkin').value)input.dataset.minDate=$('checkin').value; pickerTarget=input; const d=dateObj(input.value)||dateObj(monthHint)||new Date();"),
    ("} else if(id==='checkout') $('nights').value=calc(ci,co);", "} else if(id==='checkout'){if(ci&&co&&dateObj(co)<dateObj(ci)){$('checkout').value='';$('nights').value=0;}else $('nights').value=calc(ci,co);}"),
]
for a,b in repls:
    p = p.replace(a,b)
needle = "  function recalc2(){\n    $('nights').value=calc($('checkin').value,$('checkout').value);"
if "function sortRows()" not in p:
    p = p.replace(needle, "  function sortRows(){const order={ROOM:0,EXTRA:1,MEAL:2,DINNER:3,TRANSFER:4};const rows=[...ROWS.querySelectorAll('tr')];rows.sort((a,b)=>{const ta=a.dataset.type||a.querySelector('.type').value,tb=b.dataset.type||b.querySelector('.type').value;const ga=/^green tax$/i.test(a.querySelector('.item').value||'')?99:(order[ta]??98);const gb=/^green tax$/i.test(b.querySelector('.item').value||'')?99:(order[tb]??98);return ga-gb});rows.forEach(r=>ROWS.appendChild(r))}\n\n  function recalc2(){\n    sortRows();\n    $('nights').value=calc($('checkin').value,$('checkout').value);", 1)
old = "    ROWS.innerHTML='';\n    addRow({type:'ROOM',qty:1,autoDates:true}); addRow({type:'TRANSFER',qty:1,autoDates:false}); addRow({type:'EXTRA',item:'Green Tax',qty:0,rate:12,autoDates:true});"
new = "    ROWS.innerHTML='';\n    [{type:'ROOM',qty:1},{type:'TRANSFER',qty:1},{type:'EXTRA',item:'Green Tax',qty:0,rate:12}].forEach(data=>{try{addRow(data)}catch(e){console.error('Initial row error',e)}});\n    if(ROWS.querySelectorAll('tr').length<3){\n      ROWS.innerHTML='';\n      [{type:'ROOM',qty:1},{type:'TRANSFER',qty:1},{type:'EXTRA',item:'Green Tax',qty:0,rate:12}].forEach(data=>addRow(data));\n    }"
p = p.replace(old,new)
patch.write_text(p,encoding='utf-8')
js_start=p.index("js = r'''")+len("js = r'''"); js_end=p.index("'''",js_start); js=p[js_start:js_end]
s=index.read_text(encoding='utf-8'); marker='/* HOTEL CALCULATOR v2 override */'; start=s.index(marker); end=s.index('</script>',start); index.write_text(s[:start]+js+'\n'+s[end:],encoding='utf-8')
