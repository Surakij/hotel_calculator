from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
old='out.push(`${room.item} : ${dshort(room.from)}-${dshort(room.to)}  ${expr(room)} = ${fmt(room.net)}`)'
new='out.push(`${dshort(room.from)} - ${dshort(room.to)} : ${room.item} : ${expr(room)} = ${fmt(room.net)}`)'
assert old in s
s=s.replace(old,new,1)
old='return `${label} : ${dshort(x.from)}-${dshort(x.to)}  ${expr(x)} = ${fmt(x.net)}`;'
new='return `${dshort(x.from)} - ${dshort(x.to)} : ${label} : ${expr(x)} = ${fmt(x.net)}`;'
assert old in s
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
