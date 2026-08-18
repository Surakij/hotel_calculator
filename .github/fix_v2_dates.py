from pathlib import Path
patch=Path('.github/patch_guest_gt.py'); index=Path('index.html')
p=patch.read_text(encoding='utf-8')
p=p.replace("function openPicker(input,monthHint){pickerTarget=input; const d=dateObj(input.value)||dateObj(monthHint)||new Date();", "function openPicker(input,monthHint){if(input.id==='checkout' && $('checkin').value)input.dataset.minDate=$('checkin').value; pickerTarget=input; const d=dateObj(input.value)||dateObj(monthHint)||new Date();")
p=p.replace("} else if(id==='checkout') $('nights').value=calc(ci,co);", "} else if(id==='checkout'){if(ci&&co&&dateObj(co)<dateObj(ci)){$('checkout').value='';$('nights').value=0;}else $('nights').value=calc(ci,co);}")
patch.write_text(p,encoding='utf-8')
js_start=p.index("js = r'''")+len("js = r'''"); js_end=p.index("'''",js_start); js=p[js_start:js_end]
s=index.read_text(encoding='utf-8'); marker='/* HOTEL CALCULATOR v2 override */'; start=s.index(marker); end=s.index('</script>',start); index.write_text(s[:start]+js+'\n'+s[end:],encoding='utf-8')
