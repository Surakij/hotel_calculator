from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('out.push(`${room.item} : ${dshort(room.from)}-${dshort(room.to)}  ${expr(room)} = ${fmt(room.net)}`)', 'out.push(`${dshort(room.from)} - ${dshort(room.to)} : ${room.item} : ${expr(room)} = ${fmt(room.net)}`)', 1)
s=re.sub(r'`\$\{label\} : \$\{dshort\(x\.from\)\}-\$\{dshort\(x\.to\)\}\s+\$\{expr\(x\)\} = \$\{fmt\(x\.net\)\}`', r'`${dshort(x.from)} - ${dshort(x.to)} : ${label} : ${expr(x)} = ${fmt(x.net)}`', s, count=1)
p.write_text(s,encoding='utf-8')
