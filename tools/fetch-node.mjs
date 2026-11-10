// Сбор смен из GainUp без браузера (для GitHub Actions).
// Логин и пароль берутся из переменных окружения GAINUP_LOGIN / GAINUP_PASSWORD (секреты репозитория).
// node tools/fetch-node.mjs <out.json>
import fs from 'fs';
import * as cheerio from 'cheerio';

const BASE = 'https://app.gainbp.com/13ruleskirov';
const LOGIN = process.env.GAINUP_LOGIN, PWD = process.env.GAINUP_PASSWORD;
if (!LOGIN || !PWD) { console.error('Нет секретов GAINUP_LOGIN / GAINUP_PASSWORD'); process.exit(2); }

const jar = new Map();
const UA = 'Mozilla/5.0 (zarplata-barov)';
function keep(res) { for (const c of res.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i).trim(), kv.slice(i + 1)); } }
const cookie = () => [...jar].map(([k, v]) => k + '=' + v).join('; ');
async function req(url, opt = {}) {
  for (let hop = 0; hop < 5; hop++) {
    const r = await fetch(url, { ...opt, redirect: 'manual', headers: { 'User-Agent': UA, Cookie: cookie(), ...(opt.headers || {}) } });
    keep(r);
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), url).href.replace(/^http:/, 'https:'); opt = {}; continue; }
    return { status: r.status, url, text: await r.text() };
  }
  throw new Error('слишком много перенаправлений');
}
const n = t => +String(t || '0').replace(/\s/g, '').replace(',', '.') || 0;
const isLogin = html => /name="pwd"/.test(html) && /name="form" value="login"|value="login" name="form"/.test(html);

// 1. вход
let p = await req(BASE + '/retail/shifts');
if (isLogin(p.text)) {
  const body = new URLSearchParams({ login: LOGIN, pwd: PWD, form: 'login' });
  p = await req(BASE + '/retail/shifts', { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (isLogin(p.text)) p = await req(BASE + '/retail/shifts');
}
if (isLogin(p.text)) { console.error('Не удалось войти в GainUp: проверьте логин и пароль в секретах'); process.exit(3); }

// 2. смены с 1-го числа прошлого месяца (по Москве)
const now = new Date(Date.now() + 3 * 3600e3);
const FROM = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
const $l = cheerio.load(p.text);
const ids = $l('a[href*="retail/shifts/"]').map((i, a) => +String($l(a).attr('href')).split('/').pop()).get().filter(Boolean);
const top = Math.max(...ids);
if (!isFinite(top)) { console.error('Список смен пуст — изменилась страница GainUp?'); process.exit(4); }

const key = t => t.slice(6, 10) + t.slice(3, 5) + t.slice(0, 2) + t.slice(11);
const shifts = [], sched = [];
let misses = 0;
for (let id = top; id > 0; id--) {
  const r = await req(BASE + '/retail/shifts/' + id);
  if (r.status !== 200 || isLogin(r.text)) { if (++misses > 20) break; continue; }
  misses = 0;
  const $ = cheerio.load(r.text);
  const q = {};
  $('tr').each((i, tr) => { const c = $(tr).children('td'); if (c.length === 2) q[$(c[0]).text().trim()] = $(c[1]).text().trim(); });
  const opened = q['Открыта'] || '';
  if (!opened) continue;
  if (opened < FROM) break;
  const paid = n(q['Сумма продаж']) - n(q['Сумма возвратов']);
  const bar = q['Подразделение'] === 'Московская 33' ? '13' : 'epo';
  const name = (q['Автор'] || '').replace(/\s+/g, ' ').replace(/\s*(13шка|Еще по одной|Ещё по одной|ЕПО)\s*/gi, ' ').trim();
  const items = [];
  const det = $('table').filter((i, t) => $(t).text().includes('Время продажи')).first();
  det.find('tr').each((i, tr) => {
    const c = $(tr).children('td').map((j, td) => $(td).text().trim()).get();
    if (c.length >= 10 && /^\d+$/.test(c[0])) items.push({ t: c[1], type: c[4], qty: n(c[5]), sum: n(c[9]) });
  });
  // Рабочий день смены = день первой продажи (продажи до 06:00 — предыдущий день); без продаж — день открытия
  let wd = opened.slice(0, 10);
  const ft = items.map(i => i.t).filter(Boolean).sort((a, b) => key(a).localeCompare(key(b)))[0];
  if (ft) {
    const dt = new Date(Date.UTC(+ft.slice(6, 10), +ft.slice(3, 5) - 1, +ft.slice(0, 2), +ft.slice(11, 13), +ft.slice(14, 16)));
    if (dt.getUTCHours() < 6) dt.setUTCDate(dt.getUTCDate() - 1);
    wd = dt.toISOString().slice(0, 10);
  }
  sched.push({ date: wd, bar, name, open: opened.slice(11, 16), close: q['Закрыта'] ? q['Закрыта'].slice(0, 16).replace(' ', 'T') : null, sales: paid });
  if (!q['Закрыта'] || paid <= 0) continue;
  const sum = ts => items.filter(i => ts.includes(i.type)).reduce((a, i) => a + i.sum, 0);
  const cnt = ts => items.filter(i => ts.includes(i.type) && i.sum > 0).reduce((a, i) => a + i.qty, 0);
  shifts.push({ gid: id, date: wd, bar, name,
    draft: Math.round(sum(['Пиво разливное']) * 100) / 100, bottle: cnt(['пиво фасовка', 'Вода']), liq: cnt(['настойки']),
    kitchen: Math.round(sum(['кухня', 'Снеки']) * 100) / 100 });
}
if (!shifts.length) { console.error('Ни одной закрытой смены — что-то не так, данные не обновляю'); process.exit(5); }
const iso = now.toISOString();
const out = { updated: iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) + ', ' + iso.slice(11, 16), stamp: iso.slice(0, 16), shifts, sched };
fs.writeFileSync(process.argv[2] || 'data.json', JSON.stringify(out));
console.log('смен:', shifts.length, 'с', FROM, 'данные на', out.updated);
