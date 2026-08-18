from pathlib import Path

INDEX = Path('index.html')
s = INDEX.read_text(encoding='utf-8')

# Remove a previous copy of this fix so repeated GitHub Actions runs stay idempotent.
marker = '/* HOTEL CALCULATOR CALENDAR FIX */'
if marker in s:
    start = s.index(marker)
    end = s.index('</script>', start)
    s = s[:start] + s[end:]

js = r'''/* HOTEL CALCULATOR CALENDAR FIX */
(function(){
  const $=id=>document.getElementById(id);
  const pad=n=>String(n).padStart(2,'0');
  const parse=v=>{
    const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(v||'').trim());
    if(!m)return null;
    const d=new Date(+m[3],+m[2]-1,+m[1]);
    return d.getFullYear()===+m[3]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[1]?d:null;
  };
  const fmt=d=>`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
  const diff=(a,b)=>{const x=parse(a),y=parse(b);return x&&y?Math.max(0,Math.round((y-x)/86400000)):0};
  const addDays=(v,n)=>{const d=parse(v);if(!d)return '';d.setDate(d.getDate()+n);return fmt(d)};

  let picker=null,target=null,month=null,two=false;
  function close(){if(picker){picker.remove();picker=null}}
  function syncRows(){
    document.querySelectorAll('#rows tr').forEach(tr=>{
      if(tr.dataset.defaultDates!=='1')return;
      const from=tr.querySelector('.from'),to=tr.querySelector('.to');
      if(from)from.value=$('checkin').value||'';
      if(to)to.value=$('checkout').value||'';
    });
  }
  function changed(which){
    const ci=$('checkin'),co=$('checkout'),n=$('nights');
    if(!ci||!co||!n)return;
    if(which==='checkin'){
      const nights=Number.parseInt(n.value,10)||0;
      if(ci.value&&nights>0)co.value=addDays(ci.value,nights);
      else if(ci.value&&co.value&&parse(co.value)>=parse(ci.value))n.value=diff(ci.value,co.value);
      else if(co.value&&parse(co.value)<parse(ci.value)){co.value='';n.value=0}
    }else{
      if(ci.value&&co.value&&parse(co.value)<parse(ci.value)){co.value='';n.value=0}
      else n.value=diff(ci.value,co.value);
    }
    syncRows();
    if(window.recalc)window.recalc();
  }
  function selectDate(value){
    const isCheckin=target.id==='checkin';
    target.value=value;
    changed(isCheckin?'checkin':'checkout');
    close();
    if(isCheckin){
      // Selecting Check-in immediately opens Check-out in the same position.
      open($('checkout'),value,true);
    }
  }
  function monthName(d){return d.toLocaleString('en-US',{month:'long',year:'numeric'})}
  function draw(parent,m,min,selected){
    const box=document.createElement('div');box.className='hc-month';
    const title=document.createElement('div');title.className='hc-month-title';title.textContent=monthName(m);box.append(title);
    const grid=document.createElement('div');grid.className='hc-grid';
    ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(x=>{const h=document.createElement('span');h.textContent=x;grid.append(h)});
    const first=new Date(m.getFullYear(),m.getMonth(),1),off=(first.getDay()+6)%7;
    for(let i=0;i<off;i++){const e=document.createElement('span');e.className='empty';grid.append(e)}
    const count=new Date(m.getFullYear(),m.getMonth()+1,0).getDate();
    for(let day=1;day<=count;day++){
      const d=new Date(m.getFullYear(),m.getMonth(),day),b=document.createElement('button');
      b.type='button';b.textContent=day;b.className='hc-day';
      const value=fmt(d);
      if(min&&d<min){b.disabled=true;b.classList.add('disabled')}
      if(value===selected)b.classList.add('selected');
      b.addEventListener('pointerdown',e=>e.preventDefault());
      b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectDate(value)});
      grid.append(b);
    }
    box.append(grid);parent.append(box);
  }
  function render(){
    close();
    picker=document.createElement('div');picker.className='hc-picker-fixed';
    const head=document.createElement('div');head.className='hc-picker-head';
    const prev=document.createElement('button');prev.type='button';prev.textContent='‹';
    const title=document.createElement('strong');title.textContent=two?'Select Check-out':'Select date';
    const next=document.createElement('button');next.type='button';next.textContent='›';
    prev.onclick=e=>{e.preventDefault();month=new Date(month.getFullYear(),month.getMonth()-1,1);render()};
    next.onclick=e=>{e.preventDefault();month=new Date(month.getFullYear(),month.getMonth()+1,1);render()};
    head.append(prev,title,next);picker.append(head);
    const months=document.createElement('div');months.className=two?'hc-months-fixed two':'hc-months-fixed';
    const min=target.id==='checkout'&&parse($('checkin').value)?parse($('checkin').value):null;
    const selected=target.value||'';
    draw(months,new Date(month),min,selected);
    if(two)draw(months,new Date(month.getFullYear(),month.getMonth()+1,1),min,selected);
    picker.append(months);
    document.body.append(picker);
    const r=target.getBoundingClientRect(),w=two?520:290,h=picker.offsetHeight;
    let left=Math.min(Math.max(8,r.left),window.innerWidth-w-8);
    let top=r.bottom+6;
    if(top+h>window.innerHeight-8)top=Math.max(8,r.top-h-6);
    picker.style.left=left+'px';picker.style.top=top+'px';
  }
  function open(input,hint,twoMonths){
    target=input;two=!!twoMonths||input.id==='checkout';
    const base=parse(hint)||parse(input.value)||parse($('checkin').value)||new Date();
    month=new Date(base.getFullYear(),base.getMonth(),1);
    if(input.id==='checkout'&&parse($('checkin').value)){
      const ci=parse($('checkin').value);month=new Date(ci.getFullYear(),ci.getMonth(),1);
    }
    render();
  }

  function replace(id){
    const old=$(id);if(!old)return null;
    const fresh=old.cloneNode(true);fresh.removeAttribute('readonly');fresh.type='text';fresh.className=(id==='checkin'||id==='checkout')?'global-date':fresh.className;fresh.value=old.value||'';old.replaceWith(fresh);return fresh;
  }
  function init(){
    const ci=replace('checkin'),co=replace('checkout');if(!ci||!co)return;
    ci.addEventListener('click',e=>{e.stopPropagation();open(ci,null,false)});
    co.addEventListener('click',e=>{e.stopPropagation();open(co,null,true)});
    ci.addEventListener('blur',()=>{if(ci.value&&!parse(ci.value))ci.value='';changed('checkin')});
    co.addEventListener('blur',()=>{if(co.value&&!parse(co.value))co.value='';changed('checkout')});
    ci.addEventListener('input',()=>{ci.value=ci.value.replace(/[^\d.]/g,'').slice(0,10)});
    co.addEventListener('input',()=>{co.value=co.value.replace(/[^\d.]/g,'').slice(0,10)});
    document.addEventListener('click',e=>{if(picker&&!picker.contains(e.target)&&e.target!==ci&&e.target!==co)close()});
    window.addEventListener('resize',close);
  }
  const st=document.createElement('style');
  st.textContent=`
    .hc-picker-fixed{position:fixed;z-index:99999;background:#fff;border:1px solid #d8dee6;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:10px;width:290px;box-sizing:border-box}
    .hc-picker-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
    .hc-picker-head button{width:28px;height:28px;border:0;border-radius:5px;background:#f1f3f5;font-size:18px;cursor:pointer}
    .hc-months-fixed{display:block}.hc-months-fixed.two{display:grid;grid-template-columns:1fr 1fr;gap:14px;width:500px}
    .hc-month-title{text-align:center;font-weight:700;margin-bottom:5px}.hc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
    .hc-grid span,.hc-grid button{height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;box-sizing:border-box}
    .hc-grid span{color:#6b7280}.hc-grid .empty{visibility:hidden}.hc-grid button{border:0;border-radius:4px;background:#fff;padding:0;cursor:pointer;color:#111}
    .hc-grid button:hover:not(:disabled),.hc-grid button.selected{background:#17365d;color:#fff}.hc-grid button:disabled{color:#c5cbd3;cursor:not-allowed}
  `;
  document.head.append(st);init();
})();
'''
s=s.replace('</script>',js+'\n</script>',1)
INDEX.write_text(s,encoding='utf-8')
