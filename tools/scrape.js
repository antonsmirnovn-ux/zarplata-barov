// Run inside a logged-in GainUp tab (app.gainbp.com). Returns JSON string {updated, stamp, shifts:[...], sched:[...]}
(async()=>{
const _n=new Date(Date.now()+3*3600e3);const _p=new Date(Date.UTC(_n.getUTCFullYear(),_n.getUTCMonth()-1,1));
const FROM=_p.toISOString().slice(0,10); // с 1-го числа прошлого месяца
const n=t=>+String(t||'0').replace(/\s/g,'').replace(',','.')||0;
const list=new DOMParser().parseFromString(await fetch('/13ruleskirov/retail/shifts').then(r=>r.text()),'text/html');
const top=Math.max(...[...list.querySelectorAll('a[href*="retail/shifts/"]')].map(a=>+a.getAttribute('href').split('/').pop()).filter(Boolean));
const out=[],sched=[];
const key=t=>t.slice(6,10)+t.slice(3,5)+t.slice(0,2)+t.slice(11);
for(let id=top;id>0;id--){
  const h=await fetch('/13ruleskirov/retail/shifts/'+id).then(r=>r.ok?r.text():'');if(!h)continue;
  const d=new DOMParser().parseFromString(h,'text/html');const req={};
  d.querySelectorAll('tr').forEach(tr=>{const c=tr.querySelectorAll('td');if(c.length==2)req[c[0].textContent.trim()]=c[1].textContent.trim();});
  const opened=req['Открыта']||'';if(opened&&opened<FROM)break;
  const paid=n(req['Сумма продаж'])-n(req['Сумма возвратов']);
  const bar=req['Подразделение']==='Московская 33'?'13':'epo';
  const name=(req['Автор']||'').replace(/\s+/g,' ').replace(/\s*(13шка|Еще по одной|Ещё по одной|ЕПО)\s*/gi,' ').trim();
  const det=[...d.querySelectorAll('table')].find(t=>t.innerText.includes('Время продажи'));const items=[];
  if(det)det.querySelectorAll('tr').forEach(tr=>{const c=[...tr.querySelectorAll('td')].map(x=>x.textContent.trim());
    if(c.length>=10&&/^\d+$/.test(c[0]))items.push({t:c[1],type:c[4],qty:n(c[5]),sum:n(c[9])});});
  // Рабочий день смены = день первой продажи (продажи до 06:00 относятся к предыдущему дню).
  // Так случайно открытая заранее смена относится к дню, когда в ней реально работали. Без продаж — день открытия.
  let wd=opened.slice(0,10);
  const ft=items.map(i=>i.t).filter(Boolean).sort((a,b)=>key(a).localeCompare(key(b)))[0];
  if(ft){const dt=new Date(ft.slice(6,10)+'-'+ft.slice(3,5)+'-'+ft.slice(0,2)+'T'+ft.slice(11,16)+':00');if(dt.getHours()<6)dt.setDate(dt.getDate()-1);
    wd=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');}
  if(opened)sched.push({date:wd,bar,name,open:opened.slice(11,16),close:req['Закрыта']?req['Закрыта'].slice(0,16).replace(' ','T'):null,sales:paid});
  if(!req['Закрыта']||paid<=0)continue;
  // суммы — колонка «Итог», как в отчёте GainUp
  const sum=ts=>items.filter(i=>ts.includes(i.type)).reduce((a,i)=>a+i.sum,0);
  const cnt=ts=>items.filter(i=>ts.includes(i.type)&&i.sum>0).reduce((a,i)=>a+i.qty,0);
  out.push({gid:id,date:wd,bar,name,
    draft:Math.round(sum(['Пиво разливное'])*100)/100,bottle:cnt(['пиво фасовка','Вода']),liq:cnt(['настойки']),
    kitchen:Math.round(sum(['кухня','Снеки'])*100)/100});
}
const now=new Date(Date.now()+3*3600e3).toISOString();
return JSON.stringify({updated:now.slice(8,10)+'.'+now.slice(5,7)+'.'+now.slice(0,4)+', '+now.slice(11,16),stamp:now.slice(0,16),shifts:out,sched});
})()
