// node tools/build.mjs /path/to/data.json  -> writes index.html (encrypted per bar with public keys in tools/keys.json)
import fs from 'fs';import path from 'path';const {subtle}=globalThis.crypto;
const T=path.dirname(new URL(import.meta.url).pathname);
const b64=u=>Buffer.from(new Uint8Array(u)).toString('base64');const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const RATES={base:1000,draft:10,bottle:10,liq:20,kitchen:5};
const K=JSON.parse(fs.readFileSync(T+'/keys.json')),D=JSON.parse(fs.readFileSync(process.argv[2]));
const vault={iter:K.iter,updated:D.updated,stamp:D.stamp,bars:{}};
const CFG=fs.existsSync(T+'/cfg.json')?JSON.parse(fs.readFileSync(T+'/cfg.json')):{};
for(const bar of ['13','epo']){
  const payload={updated:D.updated,rates:RATES,shifts:D.shifts.filter(s=>s.bar===bar).map(({gid,bar,other,...s})=>s),sched:(D.sched||[]).filter(s=>s.bar===bar).map(({bar,...s})=>s),plan:(D.plan||[]).filter(s=>s.bar===bar).map(({bar,...s})=>s)};
  const pub=await subtle.importKey('raw',Buffer.from(K.bars[bar].pub,'base64'),{name:'ECDH',namedCurve:'P-256'},false,[]);
  const eph=await subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
  const ak=await subtle.deriveKey({name:'ECDH',public:pub},eph.privateKey,{name:'AES-GCM',length:256},false,['encrypt']);
  const iv=rnd(12);
  vault.bars[bar]={cfg:CFG[bar]||null,wraps:K.bars[bar].wraps,data:{epub:b64(await subtle.exportKey('raw',eph.publicKey)),iv:b64(iv),
    ct:b64(await subtle.encrypt({name:'AES-GCM',iv},ak,new TextEncoder().encode(JSON.stringify(payload))))}};}
const h=fs.readFileSync(T+'/template.html','utf8').replace('/*VAULT*/null',JSON.stringify(vault));
const head=`<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Моя ЗПшечка">
<meta name="theme-color" content="#e8873a">
<meta name="robots" content="noindex">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="apple-touch-icon-v4.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
`;
const i=h.indexOf('<div class="wrap">');
fs.writeFileSync(path.join(T,'..','index.html'),head+h.slice(0,i)+'</head><body>\n'+h.slice(i)+`
<script>if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');</script>
</body></html>`);
console.log('built',D.shifts.length,'shifts, updated',D.updated);
