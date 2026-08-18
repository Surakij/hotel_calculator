from pathlib import Path

patch = Path('.github/patch_guest_gt.py')
index = Path('index.html')
p = patch.read_text(encoding='utf-8')
p = p.replace("function renderPicker(){\n    closePicker(); if(!pickerTarget)return;", "function renderPicker(){\n    if(picker){picker.remove();picker=null;} if(!pickerTarget)return;")
p = p.replace("e.onclick=()=>{pickerTarget.value=val; pickerTarget.dispatchEvent(new Event('input',{bubbles:true})); closePicker();};", "e.onclick=()=>{const wasCheckin=pickerTarget.id==='checkin'; const selected=val; pickerTarget.value=selected; pickerTarget.dispatchEvent(new Event('input',{bubbles:true})); closePicker(); if(wasCheckin && $('checkout')) openPicker($('checkout'),selected);};")
patch.write_text(p, encoding='utf-8')
js_start = p.index("js = r'''" ) + len("js = r'''")
js_end = p.index("'''", js_start)
js = p[js_start:js_end]
s = index.read_text(encoding='utf-8')
marker='/* HOTEL CALCULATOR v2 override */'
start=s.index(marker)
end=s.index('</script>',start)
s=s[:start]+js+'\n'+s[end:]
index.write_text(s,encoding='utf-8')
