from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
# General stay dates automatically drive room, meal and extra/green-tax rows.
s=s.replace('function recalc(){document.getElementById("nights").value=calcNights(checkin.value,checkout.value);let total=0;', 'function syncStayDates(){const cin=document.getElementById("checkin").value,cout=document.getElementById("checkout").value;document.querySelectorAll("#rows tr").forEach(tr=>{const type=tr.dataset.type||tr.querySelector(".type").value;if(["ROOM","MEAL","EXTRA"].includes(type)){tr.querySelector(".from").value=cin;tr.querySelector(".to").value=cout}})}\nfunction recalc(){syncStayDates();document.getElementById("nights").value=calcNights(checkin.value,checkout.value);let total=0;',1)
# DD.MM date format.
s=s.replace('function dshort(s){if(!s)return"";const [y,m,d]=s.split("-");const dt=new Date(+y,+m-1,+d);return dt.toLocaleDateString("en-GB",{day:"2-digit",month:"short"}).replace(" ","-")}', 'function dshort(s){if(!s)return"";const [y,m,d]=s.split("-");return `${d}.${m}`}',1)
# Grouped categories also get date first.
s=s.replace('out.push(`${g.base} : ${formula} = ${fmt(g.rows.reduce((sum,x)=>sum+x.net,0))}`)', 'out.push(`${dshort(g.rows[0].from)} - ${dshort(g.rows[0].to)} : ${g.base} : ${formula} = ${fmt(g.rows.reduce((sum,x)=>sum+x.net,0))}`)',1)
# Default rows after clear/start.
marker='buildLists();const demo='
defaults='buildLists();function createDefaultRows(){document.getElementById("rows").innerHTML="";addRow({type:"ROOM",item:"",from:checkin.value,to:checkout.value,qty:1});addRow({type:"TRANSFER",item:"",from:checkin.value,to:checkin.value,qty:1});addRow({type:"EXTRA",item:"Green Tax",from:checkin.value,to:checkout.value,qty:1})}const demo='
if marker not in s: raise SystemExit('default marker missing')
s=s.replace(marker,defaults,1)
s=s.replace('demo.forEach(addRow);recalc();const shareTextEl=', 'createDefaultRows();recalc();const shareTextEl=',1)
s=s.replace('function clearAll(){if(!confirm("Clear the current calculation and start a new one?"))return;hotel.value="";checkin.value="";checkout.value="";adults.value=0;children.value=0;infants.value=0;ages.value="";spo.value="";document.getElementById("rows").innerHTML="";recalc();toast("Calculation cleared")}', 'function clearAll(){if(!confirm("Clear the current calculation and start a new one?"))return;hotel.value="";checkin.value="";checkout.value="";adults.value=0;children.value=0;infants.value=0;ages.value="";spo.value="";createDefaultRows();recalc();toast("Calculation cleared")}',1)
# Bold date and category in the visual share preview; clipboard/download remain plain text.
s=s.replace('<pre id="shareText"></pre>','<div id="shareText" class="share-preview"></div>',1)
s=s.replace('.modal-head{display:flex;justify-content:space-between;align-items:center}.modal pre{white-space:pre-wrap;font:14px/1.45 Consolas,monospace;background:#f7f8fa;padding:15px;border-radius:7px}', '.modal-head{display:flex;justify-content:space-between;align-items:center}.share-preview{white-space:pre-wrap;font:14px/1.45 Consolas,monospace;background:#f7f8fa;padding:15px;border-radius:7px}',1)
show='''function shareHtml(){const esc=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");return shareText().split("\\n").map((line,i)=>{if(i<2||!line.trim()||line.startsWith("TOTAL:")||line.startsWith("SPO:"))return esc(line);const m=line.match(/^(\\d{2}\\.\\d{2} - \\d{2}\\.\\d{2}) : ([^:]+) : (.*)$/);if(!m)return esc(line);return `<strong>${esc(m[1])}</strong> : <strong>${esc(m[2].trim())}</strong> : ${esc(m[3])}`}).join("\\n")}\nfunction showShare(){shareTextEl.innerHTML=shareHtml();shareModal.style.display="flex"}'''
s=s.replace('function showShare(){shareTextEl.textContent=shareText();shareModal.style.display="flex"}',show,1)
p.write_text(s,encoding='utf-8')
