from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

# Start completely blank: no hotel, dates, guests, ages or SPO.
s = s.replace('value="Ozen Bolifushi" placeholder="Choose or type hotel"', 'value="" placeholder="Choose or type hotel"')
s = s.replace('value="2026-10-25"', 'value=""')
s = s.replace('value="2026-11-03"', 'value=""')
s = s.replace('id="adults" type="number" min="0" value="4"', 'id="adults" type="number" min="0" value="0"')
s = s.replace('id="children" type="number" min="0" value="3"', 'id="children" type="number" min="0" value="0"')
s = s.replace('id="infants" type="number" min="0" value="1"', 'id="infants" type="number" min="0" value="0"')
s = s.replace('id="ages" value="2, 6, 9"', 'id="ages" value=""')

old_apply = '''function applyAutoQty(tr){const type=tr.dataset.type,item=(tr.querySelector(".item").value||"").toLowerCase();if(["MEAL","TRANSFER","DINNER"].includes(type)){if(item.includes("adult"))tr.querySelector(".qty").value=document.getElementById("adults").value||0;else if(item.includes("child"))tr.querySelector(".qty").value=document.getElementById("children").value||0;else if(item.includes("infant"))tr.querySelector(".qty").value=document.getElementById("infants").value||0}}'''
new_apply = '''function applyAutoQty(tr){const type=tr.dataset.type,item=(tr.querySelector(".item").value||"").toLowerCase();if(["MEAL","TRANSFER","DINNER"].includes(type)){if(item.includes("adult"))tr.querySelector(".qty").value=document.getElementById("adults").value||0;else if(item.includes("child"))tr.querySelector(".qty").value=document.getElementById("children").value||0;else if(item.includes("infant"))tr.querySelector(".qty").value=document.getElementById("infants").value||0}if(type==="EXTRA"&&/^green tax$/i.test(tr.querySelector(".item").value||"")){const pax=(Number(document.getElementById("adults").value)||0)+(Number(document.getElementById("children").value)||0);tr.querySelector(".qty").value=pax;if(!tr.querySelector(".rate").value)tr.querySelector(".rate").value=12}}'''
if old_apply not in s:
    raise SystemExit('applyAutoQty pattern not found')
s = s.replace(old_apply, new_apply, 1)

old_defaults = 'function createDefaultRows(){document.getElementById("rows").innerHTML="";addRow({type:"ROOM",item:"",from:checkin.value,to:checkout.value,qty:1});addRow({type:"TRANSFER",item:"",from:checkin.value,to:checkin.value,qty:1});addRow({type:"EXTRA",item:"Green Tax",from:checkin.value,to:checkout.value,qty:1})}'
new_defaults = 'function createDefaultRows(){document.getElementById("rows").innerHTML="";addRow({type:"ROOM",item:"",from:"",to:"",qty:1});addRow({type:"TRANSFER",item:"",from:"",to:"",qty:1});addRow({type:"EXTRA",item:"Green Tax",from:"",to:"",qty:0,rate:12})}'
if old_defaults not in s:
    raise SystemExit('createDefaultRows pattern not found')
s = s.replace(old_defaults, new_defaults, 1)

# Remove unused demo data from startup and keep only clean default rows.
start = s.find('const demo=[')
if start != -1:
    end = s.find('];createDefaultRows();recalc();', start)
    if end == -1:
        raise SystemExit('demo end not found')
    s = s[:start] + 'createDefaultRows();recalc();' + s[end + len('];createDefaultRows();recalc();'):]

# Trigger workflow after creation so the patch is applied.
p.write_text(s, encoding='utf-8')
