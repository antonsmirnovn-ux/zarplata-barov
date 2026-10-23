// node tools/setcfg.mjs '<webapp url>' '<key13>' '<keyEpo>'  -> writes tools/cfg.json (encrypted per bar with bar public keys)
import fs from 'fs';import path from 'path';const {subtle}=globalThis.crypto;
const T=path.dirname(new URL(import.meta.url).pathname);
const b64=u=>Buffer.from(new Uint8Array(u)).toString('base64');const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const [url,k13,kepo]=process.argv.slice(2);const K=JSON.parse(fs.readFileSync(T+'/keys.json'));const out={};
for(const [bar,key] of [['13',k13],['epo',kepo]]){
  const pub=await subtle.importKey('raw',Buffer.from(K.bars[bar].pub,'base64'),{name:'ECDH',namedCurve:'P-256'},false,[]);
  const eph=await subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
  const ak=await subtle.deriveKey({name:'ECDH',public:pub},eph.privateKey,{name:'AES-GCM',length:256},false,['encrypt']);
  const iv=rnd(12);
  out[bar]={epub:b64(await subtle.exportKey('raw',eph.publicKey)),iv:b64(iv),ct:b64(await subtle.encrypt({name:'AES-GCM',iv},ak,new TextEncoder().encode(JSON.stringify({url,key}))))};}
fs.writeFileSync(T+'/cfg.json',JSON.stringify(out));console.log('cfg ok');
