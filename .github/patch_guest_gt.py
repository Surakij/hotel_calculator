from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')

# Green Tax: ADL + CHD only, excluding INF. Default rate = 12 USD.
start = s.index('function applyAutoQty(')
end = s.index('function getDiscounts(', start)
new_apply = r'''function applyAutoQty(tr){
 const type=tr.dataset.type,item=(tr.querySelector(".item").value||"").toLowerCase();
 if(["MEAL","TRANSFER","DINNER"].includes(type)){
   if(item.includes("adult"))tr.querySelector(".qty").value=document.getElementById("adults").value||0;
   else if(item.includes("child"))tr.querySelector(".qty").value=document.getElementById("children").value||0;
   else if(item.includes("infant"))tr.querySelector(".qty").value=document.getElementById("infants").value||0;
 }
 if(type==="EXTRA" && /^green tax$/i.test(tr.querySelector(".item").value||"")){
   const adults=Number(document.getElementById("adults").value)||0;
   const children=Number(document.getElementById("children").value)||0;
   tr.querySelector(".qty").value=adults+children;
   if(!tr.querySelector(".rate").value)tr.querySelector(".rate").value=12;
 }
}
'''
s = s[:start] + new_apply + s[end:]

# Clear All: also reset guest counts to zero.
m = re.search(r'function clearAll\(\)\{.*?\n\}', s, re.S)
if not m:
    raise SystemExit('clearAll function not found')
old = m.group(0)
new = old
if 'document.getElementById("adults").value=0' not in new:
    new = new.replace('function clearAll(){', 'function clearAll(){\n document.getElementById("adults").value=0;\n document.getElementById("children").value=0;\n document.getElementById("infants").value=0;\n document.getElementById("ages").value="";')
s = s[:m.start()] + new + s[m.end():]

# Guest count changes should update automatically populated quantities, including Green Tax.
if 'function syncGuestQuantities()' not in s:
    helper = 'function syncGuestQuantities(){document.querySelectorAll("#rows tr").forEach(tr=>applyAutoQty(tr));recalc()}\n'
    pos = s.find('</script>')
    s = s[:pos] + helper + 'document.getElementById("adults").addEventListener("input",syncGuestQuantities);document.getElementById("children").addEventListener("input",syncGuestQuantities);document.getElementById("infants").addEventListener("input",syncGuestQuantities);\n' + s[pos:]

p.write_text(s, encoding='utf-8')
