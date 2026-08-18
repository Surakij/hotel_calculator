from pathlib import Path

INDEX = Path('index.html')
s = INDEX.read_text(encoding='utf-8')
marker = '/* HOTEL CALCULATOR - STAY ENHANCEMENTS */'
if marker in s:
    start = s.index(marker)
    end = s.index('</script>', start)
    s = s[:start] + s[end:]

js = r'''/* HOTEL CALCULATOR - STAY ENHANCEMENTS */
(function(){
  const $=id=>document.getElementById(id), rows=$('rows');
  if(!rows)return;
  const globalType=tr=>{const type=tr.dataset.type||tr.querySelector('.type')?.value||'',item=(tr.querySelector('.item')?.value||'').trim();return type==='ROOM'||type==='MEAL'||(type==='EXTRA'&&/^green tax$/i.test(item));};
  const colors={ROOM:'#2f80d1',MEAL:'#4caf50',TRANSFER:'#8064c8',DINNER:'#ed7d31',EXTRA:'#d4a500'};
  function colorRows(){rows.querySelectorAll('tr').forEach(tr=>{const sel=tr.querySelector('.type');if(!sel)return;const c=colors[tr.dataset.type||sel.value]||'';sel.style.background=c;sel.style.color=c?'white':'';});}
  function defaultDates(tr){
    if(!tr)return;
    if(tr.dataset.defaultDates===undefined)tr.dataset.defaultDates=globalType(tr)?'1':'0';
    if(tr.dataset.defaultDates==='1'){
      const f=tr.querySelector('.from'),t=tr.querySelector('.to');
      if(f)f.value=$('checkin')?.value||'';
      if(t)t.value=$('checkout')?.value||'';
    }
  }
  rows.querySelectorAll('tr').forEach(defaultDates);colorRows();

  if(typeof window.addRow==='function'&&!window.addRow.__stayDefaultsOnly){
    const original=window.addRow;
    function wrapped(data){
      const result=original(data||{});
      const list=[...rows.querySelectorAll('tr')],tr=list[list.length-1];
      if(tr){tr.dataset.defaultDates=globalType(tr)?'1':'0';defaultDates(tr);colorRows();if(typeof window.recalc==='function')window.recalc();}
      return result;
    }
    wrapped.__stayDefaultsOnly=true;
    window.addRow=wrapped;
  }

  rows.addEventListener('change',e=>{
    const tr=e.target.closest('tr');if(!tr)return;
    if(e.target.classList.contains('type')){
      tr.dataset.type=e.target.value;
      tr.dataset.defaultDates=globalType(tr)?'1':'0';
      if(globalType(tr))defaultDates(tr);
      colorRows();
      if(typeof window.recalc==='function')window.recalc();
    }
    if(e.target.classList.contains('item')){
      if(globalType(tr)){tr.dataset.defaultDates='1';defaultDates(tr)}
      colorRows();
      if(typeof window.recalc==='function')window.recalc();
    }
  });

  ['checkin','checkout'].forEach(id=>$(id)?.addEventListener('change',()=>{
    rows.querySelectorAll('tr').forEach(tr=>{if(tr.dataset.defaultDates==='1')defaultDates(tr)});
    colorRows();
  }));
})();
'''

pos=s.rfind('</body>')
if pos==-1: raise RuntimeError('No </body> found')
s=s[:pos]+'<script>\n'+js+'\n</script>\n'+s[pos:]
INDEX.write_text(s,encoding='utf-8')
