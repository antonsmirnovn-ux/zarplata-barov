// node tools/setown.mjs '<json>'  -> tools/ownx.json: extra owner-only data, encrypted with the owner public key (no password needed)
import fs from 'fs';import path from 'path';const {subtle}=globalThis.crypto;
const T=path.dirname(new URL(import.meta.url).pathname);
const b64=u=>Buffer.from(new Uint8Array(u)).toString('base64');const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const K=JSON.parse(fs.readFileSync(T+'/keys.json'));const data=process.argv[2];JSON.parse(data);
const pub=await subtle.importKey('raw',Buffer.from(K.own.pub,'base64'),{name:'ECDH',namedCurve:'P-256'},false,[]);
const eph=await subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
const ak=await subtle.deriveKey({name:'ECDH',public:pub},eph.privateKey,{name:'AES-GCM',length:256},false,['encrypt']);
const iv=rnd(12);
fs.writeFileSync(T+'/ownx.json',JSON.stringify({epub:b64(await subtle.exportKey('raw',eph.publicKey)),iv:b64(iv),ct:b64(await subtle.encrypt({name:'AES-GCM',iv},ak,new TextEncoder().encode(data)))}));
console.log('ownx ok');
