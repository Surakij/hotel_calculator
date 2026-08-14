from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

start=s.index('function shareText(){')
end=s.index('function showShare(){', start)

new=r'''function shareText(){
 recalc();
 const hotel=(document.getElementById("hotel").value||"Hotel").toUpperCase();
 const cin=dshort(checkin.value),cout=dshort(checkout.value),n=nights.value;
 const ad=adults.value||0,ch=children.value||0,inf=infants.value||0,ages=document.getElementById("ages").value,spo=document.getElementById("spo").value.trim();
 const rows=currentRows();
 let pax=`${ad}ADL`;
 if(Number(ch)>0)pax+=`+${ch}CHD${ages?"("+ages.replace(/\s+/g,"")+")":""}`;
 if(Number(inf)>0)pax+=`+${inf}INF`;
 const out=[hotel,`${cin}-${cout} · ${n}N · ${pax}`];
 if(spo)out.push(`SPO: ${spo}`);
 out.push("");

 const rooms=rows.filter(x=>x.type==="ROOM");
 const extras=rows.filter(x=>x.type==="EXTRA" && !/^green tax$/i.test(x.item));
 const green=rows.filter(x=>x.type==="EXTRA" && /^green tax$/i.test(x.item));
 const usedExtra=new Set();

 rooms.forEach(room=>{
   out.push(`${dshort(room.from)} - ${dshort(room.to)} : ${room.item} : ${expr(room)} = ${fmt(room.net)}`);
   const matching=extras.filter(x=>x.from===room.from && x.to===room.to && !usedExtra.has(x));
   const adl=matching.filter(x=>/adult/i.test(x.item));
   const chd=matching.filter(x=>/child/i.test(x.item));
   const rest=matching.filter(x=>!adl.includes(x)&&!chd.includes(x));
   [...adl,...chd,...rest].forEach(x=>{
     const label=x.item.replace(/\s*-\s*(Adult|Child|Infant)\s*$/i,"").trim();
     out.push(`${label} : ${expr(x)} = ${fmt(x.net)}`); usedExtra.add(x);
   });
 });
 extras.filter(x=>!usedExtra.has(x)).forEach(x=>{
   const label=x.item.replace(/\s*-\s*(Adult|Child|Infant)\s*$/i,"").trim();
   out.push(`${label} : ${expr(x)} = ${fmt(x.net)}`);
 });

 const meals=rows.filter(x=>x.type==="MEAL");
 const mealGroups=[];
 meals.forEach(x=>{
   const base=x.item.replace(/\s*-\s*(Adult|Child|Infant)\s*$/i,"").trim();
   const key=[base,x.from,x.to,(x.discounts||[]).join(",")].join("|");
   let g=mealGroups.find(z=>z.key===key); if(!g){g={key,base,rows:[]};mealGroups.push(g)} g.rows.push(x);
 });
 mealGroups.forEach(g=>{
   const parts=g.rows.map(x=>`${fmt(x.rate).replaceAll(",","")}*${x.qty}`);
   let formula=parts.length>1?`(${parts.join("+")})`:parts[0];
   if(g.rows[0].nights>0)formula+=`*${g.rows[0].nights}`;
   (g.rows[0].discounts||[]).forEach(d=>formula+=`-${d}%`);
   const total=g.rows.reduce((sum,x)=>sum+x.net,0);
   out.push(`${dshort(g.rows[0].from)} - ${dshort(g.rows[0].to)} : ${g.base} : ${formula} = ${fmt(total)}`);
 });

 const dinners=rows.filter(x=>x.type==="DINNER");
 const dinnerGroups=[];
 dinners.forEach(x=>{
   const base=x.item.replace(/\s*-\s*(Adult|Child|Infant)\s*$/i,"").trim();
   const key=[base,x.from,x.to,(x.discounts||[]).join(",")].join("|");
   let g=dinnerGroups.find(z=>z.key===key); if(!g){g={key,base,rows:[]};dinnerGroups.push(g)} g.rows.push(x);
 });
 dinnerGroups.forEach(g=>{
   const parts=g.rows.map(x=>`${fmt(x.rate).replaceAll(",","")}*${x.qty}`);
   let formula=parts.length>1?`(${parts.join("+")})`:parts[0];
   if(g.rows[0].nights>0)formula+=`*${g.rows[0].nights}`;
   (g.rows[0].discounts||[]).forEach(d=>formula+=`-${d}%`);
   const total=g.rows.reduce((sum,x)=>sum+x.net,0);
   out.push(`${g.base} : ${formula} = ${fmt(total)}`);
 });

 const transfers=rows.filter(x=>x.type==="TRANSFER");
 const transferGroups=[];
 transfers.forEach(x=>{
   const base=x.item.replace(/\s*-\s*(Adult|Child|Infant)\s*$/i,"").trim();
   const key=[base,x.from,x.to,(x.discounts||[]).join(",")].join("|");
   let g=transferGroups.find(z=>z.key===key); if(!g){g={key,base,rows:[]};transferGroups.push(g)} g.rows.push(x);
 });
 transferGroups.forEach(g=>{
   const parts=g.rows.map(x=>`${fmt(x.rate).replaceAll(",","")}*${x.qty}`);
   let formula=parts.length>1?`(${parts.join("+")})`:parts[0];
   if(g.rows[0].nights>0)formula+=`*${g.rows[0].nights}`;
   (g.rows[0].discounts||[]).forEach(d=>formula+=`-${d}%`);
   const total=g.rows.reduce((sum,x)=>sum+x.net,0);
   const isOW=/\bOW\b/i.test(g.base);
   const prefix=isOW?`${dshort(g.rows[0].from)} - ${dshort(g.rows[0].to)} : `:"";
   out.push(`${prefix}${g.base} : ${formula} = ${fmt(total)}`);
 });

 green.forEach(x=>out.push(`Green Tax : ${expr(x)} = ${fmt(x.net)}`));
 out.push("",`TOTAL: ${fmt(rows.reduce((s,x)=>s+x.net,0))} USD`);
 return out.join("\n");
}

'''
s=s[:start]+new+s[end:]

# Replace the visual share formatter so only the date/category prefixes requested are bold.
start=s.index('function showShare(){')
end=s.index('function closeShare(){', start)
show=r'''function shareHtml(){
 const esc=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
 return shareText().split("\n").map(line=>{
   if(!line.trim()||line.startsWith("SPO:")||line.startsWith("TOTAL:"))return esc(line);
   let m=line.match(/^(\d{2}\.\d{2} - \d{2}\.\d{2}) : ([^:]+) : (.*)$/);
   if(m)return `<strong>${esc(m[1])} : ${esc(m[2].trim())}</strong> : ${esc(m[3])}`;
   m=line.match(/^([^:]+) : (.*)$/);
   if(m)return `<strong>${esc(m[1].trim())}</strong> : ${esc(m[2])}`;
   return esc(line);
 }).join("\n");
}
function showShare(){shareTextEl.innerHTML=shareHtml();shareModal.style.display="flex"}
'''
s=s[:start]+show+s[end:]
p.write_text(s,encoding='utf-8')
