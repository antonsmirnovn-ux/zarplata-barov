// Run inside a logged-in GainUp tab (app.gainbp.com). Returns JSON string {updated, shifts:[...]}
(async()=>{
const FROM='2026-10-01';
const n=t=>+String(t||'0').replace(/\s/g,'').replace(',','.')||0;
const list=new DOMParser().parseFromString(await fetch('/13ruleskirov/retail/shifts').then(r=>r.text()),'text/html');
const top=Math.max(...[...list.querySelectorAll('a[href*="retail/shifts/"]')].map(a=>+a.getAttribute('href').split('/').pop()).filter(Boolean));
const out=[],sched=[];
for(let id=top;id>0;id--){
  const h=await fetch('/13ruleskirov/retail/shifts/'+id).then(r=>r.ok?r.text():'');if(!h)continue;
  const d=new DOMParser().parseFromString(h,'text/html');const req={};
  d.querySelectorAll('tr').forEach(tr=>{const c=tr.querySelectorAll('td');if(c.length==2)req[c[0].textContent.trim()]=c[1].textContent.trim();});
  const opened=req['Открыта']||'';if(opened&&opened<FROM)break;
  const paid=n(req['Сумма продаж'])-n(req['Сумма возвратов']);
  const sub0=req['Подразделение'];
  const nm=(req['Автор']||'').replace(/\s+/g,' ').replace(/\s*(13шка|Еще по одной|Ещё по одной|ЕПО)\s*/gi,' ').trim();
  if(opened)sched.push({date:opened.slice(0,10),bar:sub0==='Московская 33'?'13':'epo',name:nm,open:opened.slice(11,16),close:req['Закрыта']?req['Закрыта'].slice(0,16).replace(' ','T'):null,sales:paid});
  if(!req['Закрыта']||paid<=0)continue;
  const det=[...d.querySelectorAll('table')].find(t=>t.innerText.includes('Время продажи'));const items=[];
  if(det)det.querySelectorAll('tr').forEach(tr=>{const c=[...tr.querySelectorAll('td')].map(x=>x.textContent.trim());
    if(c.length>=10&&/^\d+$/.test(c[0]))items.push({type:c[4],qty:n(c[5]),sum:n(c[9]),gross:n(c[7])});});
  const k=1; // суммы как в отчёте GainUp (до оплаты баллами UDS)
  const sum=ts=>items.filter(i=>ts.includes(i.type)).reduce((a,i)=>a+i.sum,0)*k;
  const cnt=ts=>items.filter(i=>ts.includes(i.type)&&i.sum>0).reduce((a,i)=>a+i.qty,0);
  const sub=req['Подразделение'];
  const name=(req['Автор']||'').replace(/\s+/g,' ').replace(/\s*(13шка|Еще по одной|Ещё по одной|ЕПО)\s*/gi,' ').trim();
  out.push({gid:id,date:opened.slice(0,10),bar:sub==='Московская 33'?'13':'epo',name,
    draft:Math.round(sum(['Пиво разливное'])*100)/100,bottle:cnt(['пиво фасовка','Вода']),liq:cnt(['настойки']),
    kitchen:Math.round(sum(['кухня','Снеки'])*100)/100,kit:Math.round(sum(['кухня'])*100)/100});
}
const now=new Date(Date.now()+3*3600e3).toISOString();
return JSON.stringify({updated:now.slice(8,10)+'.'+now.slice(5,7)+'.'+now.slice(0,4)+', '+now.slice(11,16),stamp:now.slice(0,16),shifts:out,sched});
})()
