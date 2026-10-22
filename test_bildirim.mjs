// Gece Bekçisi - bildirim katmanı testi.
// Sayfanın GERÇEK kodunu yükler, sadece tarayıcı/ağ tarafını taklit eder.
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('C:/Users/Nutzer/gece-bekcisi/index.html', 'utf8');
const kod = html.match(/<script>([\s\S]*)<\/script>/)[1];

const istekler = [];
let fetchCevabi = () => ({ ok: true, status: 200 });

// --- sahte DOM: her öğe her şeyi kabul eden bir Proxy ---
function sahteOge(ad = 'oge') {
  const hedef = {
    tagName: ad, textContent: '', value: '', checked: false, hidden: false,
    innerHTML: '', style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, removeEventListener() {}, append() {}, remove() {}, select() {},
    querySelector: () => sahteOge('alt'), querySelectorAll: () => [],
    closest: () => null, getContext: () => sahteCtx, play: async () => {},
    readyState: 0, width: 0, height: 0,
  };
  return new Proxy(hedef, {
    get(t, k) {
      if (k in t) return t[k];
      return undefined;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
const sahteCtx = { drawImage() {}, getImageData: () => ({ data: new Uint8Array(80 * 60 * 4) }) };

const depo = new Map();
const g = {
  console,
  addEventListener() {}, removeEventListener() {},
  setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
  Date, Math, JSON, String, Number, Object, Array, Promise, Error, URLSearchParams,
  Uint8Array, Float32Array, isNaN, parseInt, parseFloat,
  Blob: class { constructor(p, o) { this.parts = p; this.type = o && o.type; } },
  MediaStream: class { constructor() {} },
  location: { search: '?test' },
  localStorage: {
    getItem: k => (depo.has(k) ? depo.get(k) : null),
    setItem: (k, v) => depo.set(k, v),
  },
  crypto: { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = i * 7 + 3; return a; } },
  navigator: {
    sendBeacon: (url, body) => { istekler.push({ yol: 'beacon', url, body }); return true; },
    clipboard: { writeText: async () => {} },
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [], getVideoTracks: () => [], getAudioTracks: () => [] }) },
  },
  document: {
    querySelector: () => sahteOge(),
    querySelectorAll: () => [],
    createElement: () => sahteOge(),
    addEventListener() {},
    body: sahteOge('body'),
    visibilityState: 'visible', hidden: false,
    execCommand: () => true,
  },
  async fetch(url, opt) {
    istekler.push({ yol: 'fetch', url, body: opt && opt.body, method: opt && opt.method });
    return fetchCevabi(url, opt);
  },
};
g.window = g;
g.globalThis = g;
vm.createContext(g);
vm.runInContext(kod, g);

const gb = g.window.__gb;
if (!gb) { console.error('HATA: test kancası yok'); process.exit(1); }

let gecti = 0, kaldi = 0;
function kontrol(ad, kosul, ek = '') {
  if (kosul) { gecti++; console.log('  GECTI  ' + ad); }
  else { kaldi++; console.log('  KALDI  ' + ad + (ek ? '  -> ' + ek : '')); }
}
const son = () => istekler[istekler.length - 1];
const alanlar = r => Object.fromEntries(new URLSearchParams(r.body.toString()));

gb.cfg.po_token = 'TOKEN123';
gb.cfg.po_user = 'USERKEY456';
gb.cfg.po_sound = 'siren';
gb.cfg.ntfy_on = true;

console.log('\n1) ALARM (öncelik 5) -> Pushover acil + tekrar + siren');
istekler.length = 0;
await gb.notify('Olası nöbet!', 'Çocuğun yanına gidin.', 5, ['rotating_light']);
const po = istekler.find(r => String(r.url).includes('pushover'));
const nt = istekler.find(r => String(r.url).includes('ntfy'));
kontrol('Pushover isteği gitti', !!po);
kontrol('ntfy isteği de gitti (iki kanal)', !!nt);
const a = alanlar(po);
console.log('     ', JSON.stringify(a));
kontrol('priority = 2 (acil, onay ister)', a.priority === '2', a.priority);
kontrol('retry = 30 sn', a.retry === '30', a.retry);
kontrol('expire = 1800 sn (30 dk sonra kendiliğinden durur)', a.expire === '1800', a.expire);
kontrol('tags = gb-alarm (Samsung onayı iPhone\'u susturabilsin)', a.tags === 'gb-alarm', a.tags);
kontrol('sound = siren', a.sound === 'siren', a.sound);
kontrol('token ve user gönderildi', a.token === 'TOKEN123' && a.user === 'USERKEY456');

console.log('\n2) Nöbet sonrası hatırlatma (öncelik 4) -> yüksek, onay istemez');
istekler.length = 0;
await gb.notify('5. dk kontrol', 'Nefesini kontrol edin.', 4);
const b = alanlar(istekler.find(r => String(r.url).includes('pushover')));
kontrol('priority = 1 (yüksek, sessizi aşar, onay istemez)', b.priority === '1', b.priority);
kontrol('retry/expire YOK (ısrarla çalmaz)', !b.retry && !b.expire);
kontrol('siren YOK (kontrol hatırlatması yumuşak)', !b.sound, b.sound);

console.log('\n3) Alarm denemesi -> yalnızca Pushover, 5 dk');
istekler.length = 0;
await gb.notify('ALARM DENEMESİ', 'deneme', 5, [], { only: 'pushover', expire: 300 });
kontrol('ntfy\'a gitmedi', !istekler.some(r => String(r.url).includes('ntfy')));
kontrol('expire = 300 (deneme kendiliğinden durur)', alanlar(son()).expire === '300', alanlar(son()).expire);

console.log('\n4) Pushover reddederse dürüst davranıyor mu?');
fetchCevabi = () => ({ ok: false, status: 400 });
istekler.length = 0;
gb.queue.length = 0;
const sonuc = await gb.notify('x', 'y', 5, [], { only: 'pushover' });
kontrol('notify false döndü ("gönderildi" demiyor)', sonuc === false, String(sonuc));
kontrol('tekrar deneme kuyruğuna alındı', gb.queue.length === 1, String(gb.queue.length));

console.log('\n5) Pushover kurulmamışsa');
fetchCevabi = () => ({ ok: true, status: 200 });
gb.cfg.po_token = ''; gb.cfg.po_user = '';
istekler.length = 0;
await gb.notify('x', 'y', 5);
kontrol('poAktif() false', gb.poAktif() === false);
kontrol('yalnızca ntfy\'a gitti', istekler.length === 1 && String(son().url).includes('ntfy'));
gb.cfg.ntfy_on = false;
const bos = await gb.notify('x', 'y', 5);
kontrol('hiç kanal yoksa false döner', bos === false, String(bos));

console.log('\n6) Özel alarm sesi (gecealarm)');
gb.cfg.po_token = 'TOKEN123'; gb.cfg.po_user = 'USERKEY456'; gb.cfg.ntfy_on = false;
gb.cfg.po_sound_ozel = 'gecealarm';
fetchCevabi = () => ({ ok: true, status: 200 });
istekler.length = 0;
await gb.notify('Olası nöbet!', 'x', 5, [], { only: 'pushover' });
kontrol('alarmSesi() = gecealarm', gb.alarmSesi() === 'gecealarm', gb.alarmSesi());
kontrol('istekte sound = gecealarm', alanlar(son()).sound === 'gecealarm', alanlar(son()).sound);

console.log('\n7) Ses adı yanlışsa alarm YİNE gitmeli (sessiz kalmamalı)');
let cagri = 0;
fetchCevabi = () => { cagri++; return { ok: cagri > 1, status: cagri > 1 ? 200 : 400 }; };
istekler.length = 0;
gb.queue.length = 0;
const r7 = await gb.notify('Olası nöbet!', 'x', 5, [], { only: 'pushover' });
kontrol('iki istek gönderildi (ilki reddedildi, ikincisi sesisiz)', istekler.length === 2, String(istekler.length));
kontrol('ikinci istekte sound YOK', !alanlar(istekler[1]).sound, alanlar(istekler[1]).sound);
kontrol('ikinci istekte priority hâlâ 2 (acil kaldı)', alanlar(istekler[1]).priority === '2', alanlar(istekler[1]).priority);
kontrol('notify true döndü (alarm gitti)', r7 === true, String(r7));
kontrol('kuyruğa gereksiz kayıt eklenmedi', gb.queue.length === 0, String(gb.queue.length));

console.log('\n8) "İzleme durdu" haberi de alarm sesiyle gitmeli');
fetchCevabi = () => ({ ok: true, status: 200 });
istekler.length = 0;
const govde = gb.poBody('Gece Bekçisi durdu!', 'izleme yok', 4, 0, true);
const a8 = Object.fromEntries(new URLSearchParams(govde.toString()));
kontrol('priority = 1 (onay istemez)', a8.priority === '1', a8.priority);
kontrol('sound = gecealarm (yine de uyandırır)', a8.sound === 'gecealarm', a8.sound);

console.log(`\nSONUC: ${gecti} gecti, ${kaldi} kaldi`);
process.exit(kaldi ? 1 : 0);
