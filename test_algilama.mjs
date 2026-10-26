// Gece Bekçisi - ALGILAMA testi.
// Amaç iki yönlü: (1) dalga sesi/beyaz gürültü ve loş oda kamera gürültüsü alarm
// ÜRETMEMELİ, (2) gerçek nöbet işaretleri (ritmik hareket, inleme/hırıltı) yine
// YAKALANMALI. Sayfanın gerçek evaluateSecond() kodunu çalıştırır.
import fs from 'node:fs';
import vm from 'node:vm';

const yol = process.argv[2] || 'birlesik.html';
const html = fs.readFileSync(yol, 'utf8');
const kod = html.match(/<script>([\s\S]*)<\/script>/)[1];

function sahteOge(ad = 'oge') {
  const t = {
    tagName: ad, textContent: '', value: '', checked: false, hidden: false,
    innerHTML: '', style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, removeEventListener() {}, append() {}, remove() {}, select() {},
    querySelector: () => sahteOge('alt'), querySelectorAll: () => [],
    closest: () => null, getContext: () => sahteCtx, play: async () => {},
    readyState: 0, width: 0, height: 0, getBoundingClientRect: () => ({left:0,top:0,width:320,height:240}),
  };
  return new Proxy(t, { get: (o, k) => (k in o ? o[k] : undefined), set: (o, k, v) => (o[k] = v, true) });
}
const sahteCtx = { drawImage() {}, getImageData: () => ({ data: new Uint8Array(80 * 60 * 4) }), fillRect(){}, strokeRect(){}, clearRect(){}, beginPath(){}, stroke(){} };
const depo = new Map();
const g = {
  console, addEventListener() {}, removeEventListener() {},
  setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
  Date, Math, JSON, String, Number, Object, Array, Promise, Error, URLSearchParams,
  Uint8Array, Float32Array, isNaN, parseInt, parseFloat,
  Blob: class { constructor(p, o) { this.parts = p; this.type = o && o.type; } },
  MediaStream: class {},
  location: { search: '?test' },
  localStorage: { getItem: k => (depo.has(k) ? depo.get(k) : null), setItem: (k, v) => depo.set(k, v) },
  crypto: { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = i * 7 + 3; return a; } },
  navigator: { sendBeacon: () => true, clipboard: { writeText: async () => {} },
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [], getVideoTracks: () => [], getAudioTracks: () => [] }) } },
  document: { querySelector: () => sahteOge(), querySelectorAll: () => [], createElement: () => sahteOge(),
    addEventListener() {}, body: sahteOge('body'), visibilityState: 'visible', hidden: false, execCommand: () => true },
  fetch: async () => ({ ok: true, status: 200 }),
};
g.window = g; g.globalThis = g;
vm.createContext(g);
vm.runInContext(kod, g);
const gb = g.window.__gb;
if (!gb || !gb.evaluateSecond) { console.error('HATA: algılama test kancası yok'); process.exit(1); }

// Sayfanin saati testin elinde: 70 simule saniye gercekte birkac milisaniye
// surer, oysa flasin korleme penceresi gercek zamana bakar. ilerle() cagrilmadigi
// surece saat sabit kalir, yani eski testlerin davranisi degismez.
let saat = Date.now();
const ilerle = (ms) => { saat += ms; };
class SahteDate extends Date {
  constructor(...a) { if (a.length) super(...a); else super(saat); }
  static now() { return saat; }
}
g.Date = SahteDate;

/* ---------------- yapay sinyal üreticileri ---------------- */
// tekrarlanabilir rastgelelik (her çalıştırmada aynı sonuç)
let tohum = 12345;
const rnd = () => (tohum = (tohum * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 0.816;

const NB = 12;                                  // bant sayısı (BANDS.length-1)
const BANT_HZ = [150, 250, 375, 550, 775, 1075, 1475, 2000, 2700, 3650, 4900, 6550];

// Dalga sesi / beyaz gürültü: bütün bantlar BİRLİKTE yükselip alçalır (~10 sn periyot),
// renk (şekil) sabit kalır. Gerçek cihazlarda genlik 6-14 dB arası salınır.
function dalgaBantlari(t, siddet = 1) {
  const zarf = siddet * 7 * Math.sin(2 * Math.PI * t / 10) + siddet * 3 * Math.sin(2 * Math.PI * t / 3.7);
  return Array.from({ length: NB }, (_, b) => {
    const egim = -3.5 * Math.log2(BANT_HZ[b] / 150);   // pembe/kahverengi gürültü eğimi
    return -46 + egim + zarf + gauss() * 0.8;
  });
}
// İnleme / hırıltı: 300-800 Hz'de dar bir tepe -> bantların RENGİ değişir.
function inleme(bantlar, kuvvet = 12) {
  const o = bantlar.slice();
  o[2] += kuvvet; o[3] += kuvvet * 1.1; o[4] += kuvvet * 0.6; o[1] += kuvvet * 0.4;
  return o;
}
// Loş odada kamera karıncalanması: düşük, rastgele, ritimsiz piksel değişimi.
const karincaKare = () => Math.max(0, 0.019 + gauss() * 0.006);
// Nöbet hareketi: ~3 Hz ritmik, belirgin.
const nobetKare = (t) => Math.max(0, 0.02 + 0.075 * Math.abs(Math.sin(2 * Math.PI * 3 * t)) + gauss() * 0.004);

/* ---------------- simülasyon ---------------- */
function kur({ micAlone = true, cam = true, sens = 3, dur = 12 } = {}) {
  Object.assign(gb.cfg, { cam, mic: true, micAlone, shake: false, sens, dur, roi: null });
  const st = gb.st;
  st.running = true; st.alarm = null; st.pausedUntil = 0; st.lastAlarmEnd = 0;
  st.fr = []; st.frHist = []; st.snd = []; st.acc = []; st.accHist = [];
  st.rawM = []; st.rawS = []; st.rawA = []; st.hM = []; st.hS = []; st.hA = [];
  st.prevS = 0; st.lumSum = 0; st.lumN = 0;
  st.startedAt = Date.now() - 100000;   // ısınma bitmiş sayılsın (counts = true)
  tohum = 12345;
  return st;
}

// saniye saniye ilerletir; alarm eşiğinin (risk >= 0.8) ilk aşıldığı saniyeyi döndürür
function kosu(sn, uretici, opt) {
  const st = kur(opt);
  let enYuksek = 0, alarmSn = null, enYuksekS = 0, enYuksekM = 0;
  for (let t = 0; t < sn; t++) {
    const { kareler, bantlar } = uretici(t);
    st.fr = kareler;                                  // 1 sn'lik kamera örnekleri
    st.snd = bantlar.map(b => Float32Array.from(b));  // 1 sn'lik ses örnekleri
    gb.evaluateSecond();
    const L = st.last;
    enYuksek = Math.max(enYuksek, L.risk);
    enYuksekS = Math.max(enYuksekS, L.s);
    enYuksekM = Math.max(enYuksekM, L.m);
    if (alarmSn === null && L.risk >= 0.8) alarmSn = t;
  }
  return { enYuksek, alarmSn, enYuksekS, enYuksekM };
}

const KARE_HZ = 12, SES_HZ = 10;
const sesSaniye = (t, f) => Array.from({ length: SES_HZ }, (_, i) => f(t + i / SES_HZ));
const kareSaniye = (t, f) => Array.from({ length: KARE_HZ }, (_, i) => f(t + i / KARE_HZ));

let gecti = 0, kaldi = 0;
function kontrol(ad, kosul, ek = '') {
  if (kosul) { gecti++; console.log('  GECTI  ' + ad + (ek ? '   (' + ek + ')' : '')); }
  else { kaldi++; console.log('  KALDI  ' + ad + '   -> ' + ek); }
}

console.log('\n=== BOŞUNA ALARM OLMAMALI ===');

let r = kosu(120, t => ({
  kareler: kareSaniye(t, () => 0),                     // kamera kapalı gibi (sabit)
  bantlar: sesSaniye(t, tt => dalgaBantlari(tt, 1)),
}), { cam: false });
kontrol('Hafif dalga sesi, 120 sn', r.alarmSn === null, `alarm yok; en yüksek risk ${r.enYuksek.toFixed(2)}, ses seviyesi ${r.enYuksekS.toFixed(2)} (eşik 1)`);

r = kosu(120, t => ({
  kareler: kareSaniye(t, () => 0),
  bantlar: sesSaniye(t, tt => dalgaBantlari(tt, 2.2)),  // sert, yüksek dalgalar
}), { cam: false });
kontrol('Sert/yüksek dalga sesi, 120 sn', r.alarmSn === null, `alarm yok; ses seviyesi ${r.enYuksekS.toFixed(2)}`);

r = kosu(120, t => ({
  kareler: kareSaniye(t, karincaKare),                 // loş oda kamera gürültüsü
  bantlar: sesSaniye(t, tt => dalgaBantlari(tt, 1.6)),
}));
kontrol('Dalga sesi + loş oda kamera gürültüsü, 120 sn', r.alarmSn === null,
  `alarm yok; hareket ${r.enYuksekM.toFixed(2)}, ses ${r.enYuksekS.toFixed(2)}`);

// kısa sesler: iç çekme, dönme, uykuda bir şey söyleme (4 sn) -> süre şartını geçmemeli
r = kosu(150, t => {
  const kisa = (t % 25) >= 10 && (t % 25) < 14;
  return {
    kareler: kareSaniye(t, karincaKare),
    bantlar: sesSaniye(t, tt => kisa ? inleme(dalgaBantlari(tt, 1.4), 11) : dalgaBantlari(tt, 1.4)),
  };
});
kontrol('Çocuğun kısa sesleri (4 sn, tekrar eden)', r.alarmSn === null,
  `alarm yok; süre şartı (12 sn) korudu, ses seviyesi ${r.enYuksekS.toFixed(2)}`);

// yavaş hareketli ışık yansıtan cihaz (dalga/yıldız projeksiyonu): 0,5 Hz, ritmik ama yavaş
r = kosu(120, t => ({
  kareler: kareSaniye(t, tt => Math.max(0, 0.022 + 0.012 * Math.sin(2 * Math.PI * 0.5 * tt) + gauss() * 0.005)),
  bantlar: sesSaniye(t, tt => dalgaBantlari(tt, 1.6)),
}));
kontrol('Tavanda yavas oynayan isik (0,5 Hz) + dalga sesi, 120 sn', r.alarmSn === null,
  'alarm yok; hareket ' + r.enYuksekM.toFixed(2) + ', ritim indirimi tetiklenmedi');

console.log('\n=== NÖBET YAKALANMALI (hassasiyet kaybı olmamalı) ===');

r = kosu(90, t => {
  const nobet = t >= 40;
  return {
    kareler: kareSaniye(t, () => karincaKare()),
    bantlar: sesSaniye(t, tt => nobet ? inleme(dalgaBantlari(tt, 1.6), 12) : dalgaBantlari(tt, 1.6)),
  };
});
kontrol('Dalga sesinin ÜSTÜNE inleme (40. sn)', r.alarmSn !== null && r.alarmSn - 40 <= 20,
  r.alarmSn === null ? 'YAKALANMADI' : `${r.alarmSn - 40} sn sonra alarm`);

// nefes araları olan inleme: 3 sn ses, 1 sn sessizlik
r = kosu(90, t => {
  const nobet = t >= 40 && (t - 40) % 4 !== 3;
  return {
    kareler: kareSaniye(t, () => karincaKare()),
    bantlar: sesSaniye(t, tt => nobet ? inleme(dalgaBantlari(tt, 1.6), 12) : dalgaBantlari(tt, 1.6)),
  };
});
kontrol('Nefes aralıklı inleme (3 sn ses / 1 sn boşluk)', r.alarmSn !== null && r.alarmSn - 40 <= 22,
  r.alarmSn === null ? 'YAKALANMADI' : `${r.alarmSn - 40} sn sonra alarm`);

r = kosu(90, t => {
  const nobet = t >= 40;
  return {
    kareler: kareSaniye(t, tt => nobet ? nobetKare(tt) : karincaKare()),
    bantlar: sesSaniye(t, tt => dalgaBantlari(tt, 1.6)),   // dalga sesi sürüyor
  };
});
kontrol('Kamerada ritmik nöbet hareketi (40. sn), dalga sesi açıkken', r.alarmSn !== null && r.alarmSn - 40 <= 20,
  r.alarmSn === null ? 'YAKALANMADI' : `${r.alarmSn - 40} sn sonra alarm`);

r = kosu(90, t => {
  const nobet = t >= 40;
  return {
    kareler: kareSaniye(t, tt => nobet ? nobetKare(tt) : karincaKare()),
    bantlar: sesSaniye(t, tt => nobet ? inleme(dalgaBantlari(tt, 1.6), 10) : dalgaBantlari(tt, 1.6)),
  };
});
kontrol('Hareket + ses birlikte (tonik-klonik benzeri)', r.alarmSn !== null && r.alarmSn - 40 <= 15,
  r.alarmSn === null ? 'YAKALANMADI' : `${r.alarmSn - 40} sn sonra alarm`);

// "ses tek başına alarm verebilsin" KAPALI: ses yalnız destek olmalı
r = kosu(90, t => {
  const nobet = t >= 40;
  return {
    kareler: kareSaniye(t, () => karincaKare()),
    bantlar: sesSaniye(t, tt => nobet ? inleme(dalgaBantlari(tt, 1.6), 12) : dalgaBantlari(tt, 1.6)),
  };
}, { micAlone: false });
kontrol('Ayar kapalıyken ses TEK BAŞINA alarm vermiyor', r.alarmSn === null,
  `alarm yok (beklenen davranış); ses seviyesi ${r.enYuksekS.toFixed(2)}`);

// en düşük hassasiyette (1) nöbet hâlâ yakalanıyor mu?
r = kosu(90, t => {
  const nobet = t >= 40;
  return {
    kareler: kareSaniye(t, tt => nobet ? nobetKare(tt) : karincaKare()),
    bantlar: sesSaniye(t, tt => dalgaBantlari(tt, 1.6)),
  };
}, { sens: 1 });
kontrol('Hassasiyet 1 (en az alarm) ile ritmik nöbet', r.alarmSn !== null && r.alarmSn - 40 <= 25,
  r.alarmSn === null ? 'YAKALANMADI' : `${r.alarmSn - 40} sn sonra alarm`);

console.log('\n=== KARANLIK ODA · TELEFONUN FLASI ===');

// Sahte kamera izi: applyConstraints cagrilarini sayar, istenirse reddeder.
function sahteIz({ destek = true } = {}) {
  const iz = { cagri: [], destek };
  iz.applyConstraints = async (c) => {
    iz.cagri.push(c.advanced[0].torch);
    if (!iz.destek) throw new Error('OverconstrainedError');
  };
  return iz;
}
function flasKur({ torch = 'auto', destek = true, lum = 8 } = {}) {
  const st = kur();
  st.startedAt = saat - 100000;
  const iz = sahteIz({ destek });
  st.stream = { getVideoTracks: () => [iz], getAudioTracks: () => [], getTracks: () => [iz] };
  st.torchCap = null; st.torchOn = false; st.torchBase = null; st.torchSeed = [];
  st.torchBusy = false; st.camBlindUntil = 0; st.darkFor = 0; st.brightFor = 0;
  st.warned = {}; st.lum = lum;
  gb.cfg.torch = torch; gb.cfg.front = false;
  return { st, iz };
}
// bir saniye gecsin: saat ilerler, denetim calisir, bekleyen söz cozulur
const tik = async () => { ilerle(1000); gb.torchTick(); await new Promise(r => setTimeout(r, 0)); };

// 1) Otomatik mod: oda karanliksa flas yanar - ama anlik bir golgede degil
{
  const { st, iz } = flasKur({ torch: 'auto', lum: 8 });
  await tik();
  const erken = st.torchOn;
  for (let i = 0; i < 5; i++) await tik();
  kontrol('Otomatik: 1 sn karanlikta yakmaz, 5 sn surerse yakar',
    !erken && st.torchOn === true, `ilk tik ${erken}, sonra ${st.torchOn}`);
}

// 2) Otomatik mod: oda aydinsa hic yakmaz
{
  const { st } = flasKur({ torch: 'auto', lum: 90 });
  for (let i = 0; i < 20; i++) await tik();
  kontrol('Otomatik: oda aydinken flas yanmaz', st.torchOn === false, `torchOn ${st.torchOn}`);
}

// 3) Kapali mod: ne kadar karanlik olursa olsun yanmaz
{
  const { st, iz } = flasKur({ torch: 'off', lum: 2 });
  for (let i = 0; i < 20; i++) await tik();
  kontrol('Kapali ayarda flas hic yanmaz', st.torchOn === false && iz.cagri.length === 0,
    `torchOn ${st.torchOn}, cagri ${iz.cagri.length}`);
}

// 4) Surekli mod: karanlik olmasa da yanar
{
  const { st } = flasKur({ torch: 'on', lum: 120 });
  await tik();
  kontrol('Surekli ayarda aydinlikta da yanar', st.torchOn === true, `torchOn ${st.torchOn}`);
}

// 5) Oda kendi isigiyla aydinlanirsa flas soner (deneme amacli kisip acmadan)
{
  const { st } = flasKur({ torch: 'auto', lum: 8 });
  for (let i = 0; i < 5; i++) await tik();
  const yandi = st.torchOn;
  st.lum = 60;                                 // flasli normal seviye
  for (let i = 0; i < 10; i++) await tik();    // korleme biter, temel ogrenilir
  const temel = st.torchBase;
  st.lum = 190;                                // tavan lambasi acildi
  for (let i = 0; i < 12; i++) await tik();
  kontrol('Oda aydinlanirsa flas soner', yandi && temel === 60 && st.torchOn === false,
    `yandi ${yandi}, temel ${temel}, torchOn ${st.torchOn}`);
}

// 6) Telefon desteklemiyorsa BIR kez denenir, sonra vazgecilir
{
  const { st, iz } = flasKur({ torch: 'on', destek: false, lum: 5 });
  for (let i = 0; i < 15; i++) await tik();
  kontrol('Destek yoksa tek deneme yapilir', iz.cagri.length === 1 && st.torchCap === false,
    `cagri ${iz.cagri.length}, torchCap ${st.torchCap}`);
}

// Flasin yanma aninda butun kare birden degisir. Bu, hareket olcumunun
// uretebilecegi en buyuk sicramadir; korleme penceresi onu yutmali.
// 4 sn'lik basamak gercekte olandan kotu bir senaryo (gercekte 1-2 kare surer).
async function basamakKosusu({ korleme }) {
  const { st } = flasKur({ torch: korleme ? 'auto' : 'off', lum: 8 });
  Object.assign(gb.cfg, { cam: true, mic: true, micAlone: true, sens: 3, dur: 12, roi: null });
  let alarm = null;
  for (let t = 0; t < 60; t++) {
    ilerle(1000);
    if (t === 20 && korleme) await gb.setTorch(true);
    const basamak = t >= 20 && t < 24;
    st.fr = kareSaniye(t, () => basamak ? 0.92 + gauss() * 0.02 : karincaKare());
    st.snd = sesSaniye(t, tt => dalgaBantlari(tt, 1.6)).map(b => Float32Array.from(b));
    gb.evaluateSecond();
    if (alarm === null && st.last.risk >= 0.8) alarm = t;
    if (t === 23) var basamakSn = st.hM.slice(-4);   // basamagin 4 saniyesi
  }
  return { alarm, basamakSn };
}

// 7) KONTROL: korleme olmazsa basamak gercekten hareket olarak sayiliyor mu?
//    (sayilmiyorsa 8. test bos yere geciyor demektir)
{
  const k = await basamakKosusu({ korleme: false });
  kontrol('Kontrol: korleme yoksa basamak hareket olarak sayilir',
    k.basamakSn.some(x => x > 0), `basamak saniyeleri ${JSON.stringify(k.basamakSn)}`);
}

// 8) EN ONEMLISI: flas yanarken bu basamak alarm vermemeli
{
  const k = await basamakKosusu({ korleme: true });
  kontrol('Flas yanarken parlaklik basamagi alarm vermez',
    k.alarm === null && k.basamakSn.every(x => x === 0),
    k.alarm === null ? `alarm yok, basamak saniyeleri ${JSON.stringify(k.basamakSn)}` : `${k.alarm}. sn ALARM`);
}

// 9) Korleme bittikten sonra kamera YINE nobeti yakalamali (kalici korluk olmasin)
{
  const { st } = flasKur({ torch: 'auto', lum: 40 });
  Object.assign(gb.cfg, { cam: true, mic: true, micAlone: true, sens: 3, dur: 12, roi: null });
  await gb.setTorch(true);
  let alarm = null;
  for (let t = 0; t < 70; t++) {
    ilerle(1000);
    const nobet = t >= 30;
    st.fr = kareSaniye(t, tt => nobet ? nobetKare(tt) : karincaKare());
    st.snd = sesSaniye(t, tt => dalgaBantlari(tt, 1.6)).map(b => Float32Array.from(b));
    gb.evaluateSecond();
    if (alarm === null && st.last.risk >= 0.8) alarm = t;
  }
  kontrol('Flas yandiktan sonra nobet YINE yakalanir', alarm !== null && alarm - 30 <= 25,
    alarm === null ? 'YAKALANMADI' : `${alarm - 30} sn sonra alarm`);
}

console.log(`\nSONUC: ${gecti} gecti, ${kaldi} kaldi`);
process.exit(kaldi ? 1 : 0);