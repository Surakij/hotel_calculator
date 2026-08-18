from pathlib import Path

patch = Path('.github/patch_guest_gt.py')
index = Path('index.html')
p = patch.read_text(encoding='utf-8')
needle = "  function recalc2(){\n    $('nights').value=calc($('checkin').value,$('checkout').value);"
replacement = "  function sortRows(){const order={ROOM:0,EXTRA:1,MEAL:2,DINNER:3,TRANSFER:4};const rows=[...ROWS.querySelectorAll('tr')];rows.sort((a,b)=>{const ta=a.dataset.type||a.querySelector('.type').value,tb=b.dataset.type||b.querySelector('.type').value;const ga=/^green tax$/i.test(a.querySelector('.item').value||'')?99:(order[ta]??98);const gb=/^green tax$/i.test(b.querySelector('.item').value||'')?99:(order[tb]??98);return ga-gb});rows.forEach(r=>ROWS.appendChild(r))}\n\n  function recalc2(){\n    sortRows();\n    $('nights').value=calc($('checkin').value,$('checkout').value);"
if needle not in p:
    raise SystemExit('recalc marker not found')
p=p.replace(needle,replacement,1)
patch.write_text(p,encoding='utf-8')
js_start=p.index("js = r'''")+len("js = r'''")
js_end=p.index("'''",js_start)
js=p[js_start:js_end]
s=index.read_text(encoding='utf-8')
marker='/* HOTEL CALCULATOR v2 override */'
start=s.index(marker); end=s.index('</script>',start)
s=s[:start]+js+'\n'+s[end:]
index.write_text(s,encoding='utf-8')
