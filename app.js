/* =====================================================
   Aidat — Bina Gelir Gider  (tek dosya, çevrimdışı)
   Veriler localStorage'da tutulur.
   ===================================================== */
'use strict';

/* Çoklu bina: her bina kendi veri anahtarında tutulur.
   Eski tek-bina verisi ilk profile otomatik taşınır (migration). */
const VERI_ANAHTARI = 'aidat-app-v1';
const PROFIL_ANAHTARI = 'aidat-profil-v1';
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

/* ---------------- yardımcılar ---------------- */
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const ym = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
/* Yerel saatte tarih: toISOString UTC'ye çevirdiği için akşam saatlerinde yanlış gün verirdi */
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ayAdi = key => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const ayKisa = key => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${y}`; };
function ayKaydir(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return ym(d);
}
const fmt = n => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' ₺';
function fmtTarih(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/* ---------------- veri ---------------- */const BOS_VERI = () => ({ bina: '', aidat: 0, aidatGun: 5, devredenKasa: 0, turlar: [], daireler: [], odemeler: [], giderler: [], aidatYillari: [] });

/* ---- profil (çoklu bina) ---- */
function profilKey(id) { return VERI_ANAHTARI + ':' + id; }
function proYukle() {
  let pro = null;
  try { pro = JSON.parse(localStorage.getItem(PROFIL_ANAHTARI)); } catch (e) { pro = null; }
  if (!pro || !Array.isArray(pro.binalar) || !pro.binalar.length || !pro.binalar.every(b => b && b.id)) {
    let eskiAd = '';
    try { eskiAd = (JSON.parse(localStorage.getItem(VERI_ANAHTARI)) || {}).bina || ''; } catch (e) { eskiAd = ''; }
    pro = { aktif: 'b1', binalar: [{ id: 'b1', ad: String(eskiAd || 'Bina 1').trim() }] };
  }
  if (!pro.binalar.some(b => b.id === pro.aktif)) pro.aktif = pro.binalar[0].id;
  return pro;
}
let PRO = proYukle();
function profiliKaydet() {
  try { localStorage.setItem(PROFIL_ANAHTARI, JSON.stringify(PRO)); } catch (e) { toast('Profil kaydedilemedi'); }
}
function profilAdGuncelle() {
  const p = PRO.binalar.find(b => b.id === PRO.aktif);
  if (p) { p.ad = DB.bina || p.ad; profiliKaydet(); }
}
async function binaGec(id) {
  const b = PRO.binalar.find(x => x.id === id); if (!b) return;
  PRO.aktif = id; profiliKaydet();
  DB = await yukle(); kayitDurumCiz(); renderAll(); git('ozet');
  toast(`Bina değiştirildi: ${b.ad || 'Bina'}`);
}
function yeniBinaEkle() {
  const ad = prompt('Yeni bina adı:', '');
  if (ad === null) return;
  const temiz = ad.trim() || 'Yeni Bina';
  const id = uid();
  PRO.binalar.push({ id, ad: temiz }); PRO.aktif = id; profiliKaydet();
  const yeni = BOS_VERI(); yeni.bina = temiz;
  DB = yeni; save();
  renderAll(); git('ozet');
  toast(`Yeni bina eklendi: ${temiz}`);
}
async function binaSil(id) {
  if (PRO.binalar.length <= 1) return toast('Silinecek başka bina yok');
  const b = PRO.binalar.find(x => x.id === id); if (!b) return;
  if (!confirm(`"${b.ad || 'Bina'}" ve tüm kayıtları (daireler, ödemeler, giderler) kalıcı silinsin mi? Bu işlem geri alınamaz!`)) return;
  PRO.binalar = PRO.binalar.filter(x => x.id !== id);
  try { localStorage.removeItem(profilKey(id)); } catch (e) {}
  if (PRO.aktif === id) { PRO.aktif = PRO.binalar[0].id; DB = await yukle(); }
  profiliKaydet();
  renderAll(); git('ozet'); toast('Bina ve kayıtları silindi');
}
function binaSecimDialog() {
  const rows = [...PRO.binalar].map(b => {
    const aktif = b.id === PRO.aktif;
    return `<div class="item">
      <span class="dot ${aktif ? 'ok' : 'no'}"></span>
      <div class="main"><div class="t1">${esc(b.ad || 'Bina')}${aktif ? ' <span class="tag">Aktif</span>' : ''}</div></div>
      ${aktif ? '' : `<button class="mini" data-binaSec="${b.id}">Seç</button>`}
      <button class="iconbtn" data-binaSil="${b.id}" style="color:#d1495b" aria-label="Sil">✕</button>
    </div>`;
  }).join('');
  sheet('Bina yönetimi', `
    <p class="hint">Her bina kendi dairelerini, ödemelerini ve giderlerini ayrı tutar. Aktif bina tüm ekranlarda varsayılır.</p>
    <div class="list">${rows}</div>
    <div class="btnrow"><button class="btn ghost" id="bs-ekle" style="width:100%">+ Yeni bina ekle</button></div>
  `);
  $('#sheet-body').querySelectorAll('[data-binaSec]').forEach(btn => {
    btn.onclick = () => { binaGec(btn.dataset.binaSec); sheetKapat(); };
  });
  $('#sheet-body').querySelectorAll('[data-binaSil]').forEach(btn => {
    btn.onclick = () => { binaSil(btn.dataset.binaSil); sheetKapat(); };
  });
  $('#bs-ekle').onclick = () => { yeniBinaEkle(); sheetKapat(); };
}

function ornekVeri() {
  const bu = ym();
  return {
    bina: 'Yeşil Apartmanı',
    aidat: 750,
    aidatGun: 5,
    devredenKasa: 12500,
    turlar: [],
    daireler: [
      { id: 'd1', no: '1', ad: 'Ahmet Yılmaz (Yönetici)', tel: '', muaf: true },
      { id: 'd2', no: '2', ad: 'Ayşe Demir', tel: '' },
      { id: 'd3', no: '3', ad: 'Mehmet Kaya', tel: '' },
      { id: 'd4', no: '4', ad: 'Fatma Şahin', tel: '' },
      { id: 'd5', no: '5', ad: 'Ali Çelik', tel: '' },
      { id: 'd6', no: '6', ad: 'Zeynep Arslan', tel: '' },
      { id: 's1', tip: 'dukkan', no: '1', ad: 'Market (zemin)', tel: '', aidat: 1500 },
      { id: 's2', tip: 'dukkan', no: '2', ad: 'Eczane', tel: '', aidat: 1200 }
    ],
    odemeler: [
      { id: uid(), daireId: 'd2', ay: bu, tutar: 750, tarih: today() },
      { id: uid(), daireId: 'd4', ay: bu, tutar: 750, tarih: today() },
      { id: uid(), daireId: 'd3', ay: ayKaydir(bu, -1), tutar: 750, tarih: ayKaydir(bu, -1) + '-09' },
      { id: uid(), daireId: 's1', ay: bu, tutar: 1500, tarih: today() }
    ],
    giderler: [
      { id: uid(), ay: bu, tur: 'Temizlik', aciklama: 'Ortak alan temizliği', tutar: 1200, tarih: bu + '-03' },
      { id: uid(), ay: bu, tur: 'Elektrik', aciklama: 'Ortak elektrik faturası', tutar: 860, tarih: bu + '-10' },
      { id: uid(), ay: bu, tur: 'Asansör', aciklama: 'Aylık bakım', tutar: 900, tarih: bu + '-12' },
      { id: uid(), ay: ayKaydir(bu, -1), tur: 'Su', aciklama: 'Ortak su', tutar: 540, tarih: ayKaydir(bu, -1) + '-14' }
    ]
  };
}

let DB = BOS_VERI();

/* ---- şifreleme (PIN) ---- */
let oturumAnahtari = null;
function baytb64(ui) { let s = ''; ui.forEach(b => s += String.fromCharCode(b)); return btoa(s); }
function b64bayt(s) { const d = atob(s); const a = new Uint8Array(d.length); for (let i = 0; i < d.length; i++) a[i] = d.charCodeAt(i); return a; }
async function pinHashHex(pin, tuzB64) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin + '|' + tuzB64));
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function anahtarUret(pin, tuzB64) {
  const mat = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64bayt(tuzB64), iterations: 150000, hash: 'SHA-256' }, mat, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function sifrele(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, oturumAnahtari, new TextEncoder().encode(JSON.stringify(obj)));
  return JSON.stringify({ '@enc': 1, iv: baytb64(iv), veri: baytb64(new Uint8Array(ct)) });
}
async function sifreCoz(paket) {
  const veri = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64bayt(paket.iv) }, oturumAnahtari, b64bayt(paket.veri));
  return JSON.parse(new TextDecoder().decode(veri));
}

/* Yedek ve storage'dan gelen veriyi güvenli hale getirir */
function normalize(d) {
  d.turlar = Array.isArray(d.turlar) ? d.turlar : [];
  d.daireler ||= []; d.odemeler ||= []; d.giderler ||= [];
  d.daireler.forEach(x => { x.muaf = !!x.muaf; x.tip = x.tip === 'dukkan' ? 'dukkan' : 'daire'; });
  d.aidat = Number(d.aidat) || 0;
  d.devredenKasa = Number(d.devredenKasa) || 0;
  d.aidatGun = Math.min(28, Math.max(1, Number(d.aidatGun) || 5));
  d.aidatYillari = Array.isArray(d.aidatYillari)
    ? d.aidatYillari.filter(x => x && x.yil).map(x => ({ yil: Number(x.yil) || 0, tutar: Math.max(0, Number(x.tutar) || 0) }))
    : [];
  d.ekBorclar = Array.isArray(d.ekBorclar)
    ? d.ekBorclar.filter(x => x && x.daireId).map(x => ({ id: x.id, daireId: x.daireId, tutar: Math.max(0, Number(x.tutar) || 0), aciklama: String(x.aciklama || 'Manuel borç'), tarih: x.tarih || today(), odenen: Math.max(0, Number(x.odenen) || 0), odenenTarih: x.odenenTarih || null }))
    : [];
  return d;
}

async function yukle() {
  try {
    const ham = localStorage.getItem(profilKey(PRO.aktif)) || localStorage.getItem(VERI_ANAHTARI);
    if (!ham) { await kaliciKaydet(ornekVeri()); return DB; }
    const nesne = JSON.parse(ham);
    if (nesne && nesne['@enc']) return normalize(await sifreCoz(nesne));
    return normalize(nesne);
  } catch (e) {
    return ornekVeri();
  }
}
async function kaliciKaydet(next) {
  if (next) DB = next;
  let ham = JSON.stringify(DB);
  try { ham = oturumAnahtari ? await sifrele(DB) : JSON.stringify(DB); } catch (e) {}
  try { localStorage.setItem(profilKey(PRO.aktif), ham); }
  catch (e) { toast('Kayıt yapılamadı (depolama dolu olabilir)'); }
  kayitDamgasi = new Date();
}
const save = next => kaliciKaydet(next);
async function profilYaz(id, veri) {
  const ham = oturumAnahtari ? await sifrele(veri) : JSON.stringify(veri);
  try { localStorage.setItem(profilKey(id), ham); } catch (e) {}
}
async function profilYazDuz(id, veri) {
  try { localStorage.setItem(profilKey(id), JSON.stringify(veri)); } catch (e) {}
}

/* kayıt zamanı göstergesi */
let kayitDamgasi = new Date();
function saatStr(d) {
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
function kayitDurumCiz() {
  const z = $('#kayit-zaman');
  if (!z) return;
  const gun = `${kayitDamgasi.getFullYear()}-${String(kayitDamgasi.getMonth() + 1).padStart(2, '0')}-${String(kayitDamgasi.getDate()).padStart(2, '0')}`;
  z.textContent = `${gun === today() ? 'Bugün' : fmtTarih(gun)} ${saatStr(kayitDamgasi)} · otomatik kaydedildi`;
  $('#kayit-durum').classList.remove('dirty');
  $('#kayit-dot').className = 'dot ok';
}

/* ---- kaydet & çık ---- */
function kaydetCik() {
  save();
  kayitDurumCiz();
  toast('Bilgiler kaydedildi. Çıkmak için sekmeyi kapatabilirsin.');
  setTimeout(() => {
    try { window.close(); } catch (e) {}
    try { if (history.length > 1) history.back(); } catch (e) {}
  }, 700);
}

/* ---------------- hesaplar ---------------- */
const odenen = (daireId, ay) =>
  DB.odemeler.filter(o => o.daireId === daireId && o.ay === ay && !o.ekBorc).reduce((s, o) => s + Number(o.tutar || 0), 0);

/* yönetici dairesi aidattan muaf mı? */
const muafMi = d => !!(d && d.muaf);
/* birimin (daire / dükkan) aylık aidatı */
/* o ay geçerli genel aidat: yıllık aidat geçmişine bakılır;
   geçmiş aylar o tarihteki tutar ile hesaplanır (eski aylar eski tutarla) */
const genelAidat = ay => {
  const yil = Number(String(ay).slice(0, 4));
  const liste = (DB.aidatYillari || []).slice().sort((a, b) => a.yil - b.yil).filter(x => x.yil && x.yil <= yil);
  return liste.length ? Math.max(0, liste[liste.length - 1].tutar || 0) : Math.max(0, Number(DB.aidat) || 0);
};
/* birimin (daire / dükkan) aylık aidatı: özel tutar varsa o, yoksa o yılın genel aidatı */
const birimAidat = (d, ay = ym()) => {
  if (!d) return genelAidat(ay);
  if (d.tip === 'dukkan') return Number(d.aidat) || 0;
  /* Daireye özel aidat yazılmışsa o geçerli, yazılmamışsa o yılın genel aidatı */
  return (d.aidat !== undefined && d.aidat !== null && d.aidat !== '') ? (Number(d.aidat) || 0) : genelAidat(ay);
};
/* bir birimin o ay için aidat tutarı (muafsa 0) */
const aidatTutar = (d, ay) => (muafMi(d) ? 0 : birimAidat(d, ay || ym()));
const birimAd = d => (d.tip === 'dukkan' ? 'Dükkan' : 'Daire');
/* "1", "2A", "10/B" gibi numaraları doğal sırada dizer */
function noSirala(a, b) {
  const pa = String(a.no).match(/^(\d+)(.*)$/), pb = String(b.no).match(/^(\d+)(.*)$/);
  if (pa && pb) {
    const d = Number(pa[1]) - Number(pb[1]);
    if (d) return d;
    return pa[2].localeCompare(pb[2], 'tr', { numeric: true });
  }
  if (pa) return -1;
  if (pb) return 1;
  return String(a.no).localeCompare(String(b.no), 'tr', { numeric: true });
}
/* "1.750,50" / "1750,5" / "1750.50" gibi girişleri sayıya çevirir */
function sayiCoz(v) {
  let t = String(v ?? '').trim().replace(/\s|₺|TL/gi, '');
  if (!t) return NaN;
  if (t.includes(',') && t.includes('.')) {
    t = t.lastIndexOf(',') > t.lastIndexOf('.')
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '');
  } else if (t.includes(',')) {
    t = t.replace(',', '.');
  } else if ((t.match(/\./g) || []).length > 1) {
    t = t.replace(/\./g, '');
  }
  const n = Number(t);
  return isFinite(n) ? n : NaN;
}
const birimler = () => DB.daireler;
const ayniTip = (d, tip) => (d.tip || 'daire') === tip;
/* bir birimin tüm ödemeleri (kasa) */
const birimOdemeleri = d => DB.odemeler.filter(o => o.daireId === d.id);

const ayOzet = ay => {
  const tahsil = DB.odemeler.filter(o => o.ay === ay).reduce((s, o) => s + Number(o.tutar || 0), 0);
  const dukkanTahsil = DB.odemeler.filter(o => o.ay === ay && daireBul(o.daireId)?.tip === 'dukkan')
    .reduce((s, o) => s + Number(o.tutar || 0), 0);
  const gider = DB.giderler.filter(g => g.ay === ay).reduce((s, g) => s + Number(g.tutar || 0), 0);
  const toplamBeklenen = DB.daireler.reduce((s, d) => s + aidatTutar(d, ay), 0);
  const borclu = DB.daireler.filter(d => odenen(d.id, ay) < aidatTutar(d, ay));
  const bekleyen = borclu.reduce((s, d) => s + Math.max(0, aidatTutar(d, ay) - odenen(d.id, ay)), 0);
  const tamOdeyen = DB.daireler.filter(d => aidatTutar(d, ay) > 0 && odenen(d.id, ay) >= aidatTutar(d, ay)).length;
  const odenecek = DB.daireler.filter(d => aidatTutar(d, ay) > 0).length;
  return { tahsil, dukkanTahsil, gider, net: tahsil - gider, bekleyen, borclu, toplamBeklenen, tamOdeyen, odenecek };
};

const kasaToplam = () =>
  DB.devredenKasa + DB.odemeler.reduce((s, o) => s + Number(o.tutar || 0), 0)
  - DB.giderler.reduce((s, g) => s + Number(g.tutar || 0), 0);

const daireBul = id => DB.daireler.find(d => d.id === id);

/* ---- daire bazlı borç ---- */
// ödeme yapılmış en erken ay (yoksa cari ay)
const baslangicAy = () => {
  const aylar = DB.odemeler.map(o => o.ay).filter(Boolean).sort();
  return aylar[0] && aylar[0] < ym() ? aylar[0] : ym();
};
// verilen aya kadar olan tüm aylar
const ayListesi = son => {
  const out = [];
  let k = baslangicAy();
  for (let i = 0; k <= son && i < 240; i++) { out.push(k); k = ayKaydir(k, 1); }
  return out;
};
// bir dairenin borç dökümü
function daireBorc(daireId, sonAy = ym()) {
  /* manuel (ek) borçlar: her kayıt kendi tutarını taşır, aylardan bağımsız */
  const ekler = (DB.ekBorclar || []).filter(b => b.daireId === daireId);
  const ekKalan = ekler.reduce((s, b) => s + Math.max(0, b.tutar - (b.odenen || 0)), 0);
  const aylar = ayListesi(sonAy).map(ay => {
    const odenenT = odenen(daireId, ay);
    const kalan = Math.max(0, aidatTutar(daireBul(daireId), ay) - odenenT);
    return { ay, odenen: odenenT, kalan };
  });
  const borcluAylar = aylar.filter(x => x.kalan > 0);
  const toplam = borcluAylar.reduce((s, x) => s + x.kalan, 0) + ekKalan;
  const odedi = aylar.reduce((s, x) => s + x.odenen, 0) + ekler.reduce((s, b) => s + (b.odenen || 0), 0);
  return { aylar, borcluAylar, toplam, odedi, gecikmisAy: borcluAylar.length, ekler, ekKalan };
}
const toplamBorc = sonAy => DB.daireler.reduce((s, d) => s + daireBorc(d.id, sonAy).toplam, 0);

/* ---------------- durum ---------------- */
const state = { view: 'ozet', ay: ym(), ayAidat: ym(), ayGider: ym(), borcTab: 'acik', raporTab: 'ozet', aidatTip: 'daire', daireTab: 'liste' };

/* ---------------- LİSANS ---------------- */
const LISANS = {
  yil: 2026,
  sahip: 'Cemal Solmaz',
  tel: '+90 532 205 01 97',
  telLink: '+905322050197',
  adres: 'Sümer Mahallesi 69126 Sokak Evliya Apt No:10 Zemin Kat No:10/A Seyhan/Adana',
  mailler: ['cemalsolmaz@outlook.com', 'elumennet@hotmail.com', 'elumennet@gmail.com']
};

function lisansKisa() {
  const el = $('#lic-kisa');
  if (!el) return;
  el.innerHTML = `
    <b>© ${LISANS.yil} ${LISANS.sahip}</b>
    <div class="licrow"><b>Sürüm</b><span>1.4 · ${LISANS.yil}</span></div>
    <div class="licrow"><b>Lisans sahibi</b><span>${LISANS.sahip}</span></div>
    <div class="licrow"><b>Telefon</b><span>${LISANS.tel}</span></div>
    <div class="licrow"><b>E-posta</b><span>${LISANS.mailler[0]}</span></div>
    <div class="tiny">Programın tüm hakları saklıdır. İzinsiz kopyalanamaz ve satılamaz.</div>`;
}

function lisansDialog() {
  const wa = LISANS.telLink.replace('+', '');
  sheet('Lisans Bilgileri', `
    <div class="lic-sheet">
      <div class="lblk">
        <h4>Telif</h4>
        <p><b>© ${LISANS.yil} ${LISANS.sahip}</b><br>
        Program yapım yılı: <b>${LISANS.yil}</b><br>
        Lisans sahibi: <b>${LISANS.sahip}</b></p>
        <p>Programın tüm hakları saklıdır ve saklanmaktadır. İzinsiz kopyalanamaz ve satılamaz.</p>
        <p>Bu yazılımın telif hakkı sahibi Cemal Solmaz'dır; <b>FSEK (5846 sayılı Kanun)</b> kapsamında korunur.</p>
      </div>
      <div class="lblk">
        <h4>📞 İletişim Bilgileri</h4>
        <div class="li"><i>☎</i><span>Telefon: <a href="tel:${LISANS.telLink}">${LISANS.tel}</a></span></div>
        <div class="li"><i>📍</i><span>Adres: ${LISANS.adres}</span></div>
        ${LISANS.mailler.map(m => `<div class="li"><i>✉</i><span>Mail: <a href="mailto:${m}">${m}</a></span></div>`).join('')}
      </div>
      <div class="btnrow">
        <button class="btn" id="lic-ara">Telefon et</button>
        <button class="btn ghost" id="lic-wa">WhatsApp</button>
      </div>
      <div class="btnrow">
        <button class="btn ghost" id="lic-mail">E-posta gönder</button>
        <button class="btn ghost" id="lic-kapat">Kapat</button>
      </div>
      <p class="hint" style="text-align:center;margin-top:14px">© ${LISANS.yil} ${LISANS.sahip} · Tüm hakları saklıdır.</p>
    </div>
  `);
  $('#lic-ara').onclick = () => { location.href = 'tel:' + LISANS.telLink; };
  $('#lic-wa').onclick = () => window.open(`https://wa.me/${wa}`, '_blank');
  $('#lic-mail').onclick = () => { location.href = 'mailto:' + LISANS.mailler[0] + '?subject=' + encodeURIComponent('Aidat programı hakkında'); };
  $('#lic-kapat').onclick = sheetKapat;
}

/* ---------------- çizim: ÖZET ---------------- */
function renderOzet() {
  const ay = state.ay, s = ayOzet(ay), n = DB.daireler.length;
  $('#ozet-bina').textContent = DB.bina || 'Bina';
  kayitDurumCiz();
  $('#ay-adi').textContent = ayAdi(ay);
  gecikmeCizHtml();

  $('#k-tahsil').textContent = fmt(s.tahsil);
  $('#k-tahsil-sub').textContent = `${s.tamOdeyen} / ${n} birim ödedi`;
  $('#k-gider').textContent = fmt(s.gider);
  const gs = DB.giderler.filter(g => g.ay === ay).length;
  $('#k-gider-sub').textContent = `${gs} kayıt`;
  $('#k-net').textContent = fmt(s.net);
  $('#k-net-sub').textContent = s.net >= 0 ? 'ay pozitif kapandı' : 'ay ekside';
  $('#k-bekleyen').textContent = fmt(s.bekleyen);
  $('#k-bekleyen-sub').textContent = `${s.borclu.length} birim ödemedi`;

  const oran = s.toplamBeklenen > 0 ? Math.min(100, Math.round(s.tahsil / s.toplamBeklenen * 100)) : 0;
  $('#oran').textContent = `%${oran}`;
  $('#oran-bar').style.width = oran + '%';

  const dk = $('#k-dukkan');
  if (dk) {
    const dukkanlar = birimler().filter(d => d.tip === 'dukkan');
    dk.textContent = fmt(s.dukkanTahsil);
    $('#k-dukkan-sub').textContent = `${dukkanlar.length} dükkan · kasaya dahil`;
  }
  $('#kasa-devreden').textContent = fmt(DB.devredenKasa);
  $('#kasa-toplam').textContent = fmt(kasaToplam());

  // ödenmeyen daireler
  const el = $('#ozet-borc');
  if (!DB.daireler.length) {
    el.innerHTML = `<div class="empty">Henüz daire yok. <b>Daireler</b> sekmesinden ekleyebilirsin.</div>`;
  } else if (!s.borclu.length) {
    el.innerHTML = `<div class="empty">🎉 Bu ay tüm daireler aidatını ödedi.</div>`;
  } else {
    const gecikmisler = new Set(gecikmeBilgisi(ay).liste.map(x => x.id));
    el.innerHTML = `<div class="list">` + s.borclu
      .sort((a, b) => noSirala(a, b))
      .map(d => {
        const o = odenen(d.id, ay), kalan = Math.max(0, aidatTutar(d, ay) - o);
        const gecikti = gecikmisler.has(d.id);
        return `<div class="item" data-borc="${d.id}">
          <span class="dot ${gecikti ? 'no' : 'ok'}"></span>
          <div class="main"><div class="t1">${birimAd(d)} ${esc(d.no)}${d.ad ? ' · ' + esc(d.ad) : ''}${gecikti ? ' <b style="color:#d1495b">· gecikti</b>' : ''}</div>
            <div class="t2">${o > 0 ? `Kısmi ödeme: ${fmt(o)}` : 'Ödeme yapılmadı'}${gecikti ? ' · GECİKMİŞ' : ''}</div></div>
          <div class="amt minus">${fmt(kalan)}</div>
        </div>`;
      }).join('') + `</div>`;
  }

  // son hareketler
  const har = [
    ...DB.odemeler.map(o => ({ t: 'in', tarih: o.tarih, tutar: o.tutar, ad: `Aidat · ${daireBul(o.daireId) ? birimAd(daireBul(o.daireId)) : 'Daire'} ${daireBul(o.daireId)?.no ?? '?'}`, alt: o.ay ? ayAdi(o.ay) : '' })),
    ...DB.giderler.map(g => ({ t: 'out', tarih: g.tarih, tutar: g.tutar, ad: g.aciklama || g.tur, alt: g.tur }))
  ].sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '')).slice(0, 8);

  $('#ozet-son').innerHTML = har.length
    ? `<div class="list">` + har.map(h => `<div class="item">
        <span class="dot ${h.t === 'in' ? 'ok' : 'no'}"></span>
        <div class="main"><div class="t1">${esc(h.ad)}</div>
          <div class="t2">${esc(h.alt)}${h.tarih ? ' · ' + fmtTarih(h.tarih) : ''}</div></div>
        <div class="amt ${h.t === 'in' ? 'plus' : 'minus'}">${h.t === 'in' ? '+' : '−'}${fmt(h.tutar)}</div>
      </div>`).join('') + `</div>`
    : `<div class="empty">Henüz hareket yok.</div>`;
}

/* ---------------- çizim: AİDAT ---------------- */
function renderAidat() {
  const ay = state.ayAidat;
  $('#aidat-ay').textContent = ayAdi(ay);
  const tipA = state.aidatTip === 'dukkan' ? 'dukkan' : 'daire';
  const listem = birimler().filter(d => ayniTip(d, tipA));
  const dukkanTutar = listem.reduce((s, d) => s + aidatTutar(d, ay), 0);
  /* "özel": daireye özel tutar girilmişse o gösterilir; genel aidatla karşılaştırma yapılmaz */
  const ozelMi = d => !muafMi(d) && (d.tip || 'daire') === 'daire' && d.aidat !== undefined && d.aidat !== null && d.aidat !== '';
  const ozelBirim = listem.filter(ozelMi).length;
  const ab = $('#aidat-baslik');
  if (ab) ab.textContent = tipA === 'dukkan' ? 'Dükkan aidatları (her dükkan farklı)' : 'Bu ayın aidatı';
  $('#aidat-tutar').textContent = (tipA === 'dukkan')
    ? (listem.length ? `Aylık toplam ${fmt(dukkanTutar)}` : 'Dükkan aidatı girilmemiş')
    : fmt(genelAidat(ay)) + ' / daire' + (ozelBirim ? ` · ${ozelBirim} birim özel` : '');
  const el = $('#aidat-liste');
  const ilkBorc = listem.filter(d => odenen(d.id, ay) < aidatTutar(d, ay)).length;
  const tb = $('#btn-toplu');
  tb.textContent = ilkBorc ? `Tümünü tahsil et (${ilkBorc})` : 'Hepsi ödedi';
  tb.disabled = ilkBorc === 0;

  if (!listem.length) {
    el.innerHTML = `<div class="empty">Önce <b>Daireler</b> sekmesinden ${tipA === 'dukkan' ? 'dükkan' : 'daire'} ekle.</div>`;
    return;
  }
  const rows = [...listem].sort((a, b) => noSirala(a, b));
  el.innerHTML = rows.map(d => {
    const o = odenen(d.id, ay), tar = aidatTutar(d, ay), tam = tar > 0 && o >= tar;
    const kalan = Math.max(0, tar - o);
    const durum = tar === 0 ? 'muaf' : (tam ? 'ok' : (o > 0 ? 'half' : 'no'));
    return `<div class="rowaidat ${tam ? 'paid' : ''}" data-daire="${d.id}">
      <span class="dot ${durum}"></span>
      <div class="main" data-detay="${d.id}">
        <div class="daire">${birimAd(d)} ${esc(d.no)}</div>
        <div class="meta">${esc(d.ad || 'İsim yok')}${muafMi(d) ? ' · <b class="muaf">Muaf</b>' : (o > 0 ? ' · ' + fmt(o) + ' ödendi' : '')}${(d.tip !== 'dukkan' && ozelMi(d)) ? ' · özel ' + fmt(tar) : ''}</div>
      </div>
      <div class="right">
        ${!tam && o > 0 && tar > 0 ? `<span class="borc-pill">${fmt(kalan)}</span>` : ''}
        ${tar === 0
          ? `<span class="tick muaf-tick" title="Aidattan muaf">M</span>`
          : `<button class="tick ${tam ? 'on' : (o > 0 ? 'part' : '')}" data-tick="${d.id}" aria-label="Ödendi işaretle">${tam ? '✓' : (o > 0 ? '~' : '○')}</button>`}
      </div>
    </div>`;
  }).join('');
}

/* ---------------- çizim: GİDER ---------------- */
function renderGider() {
  const ay = state.ayGider;
  $('#gider-ay').textContent = ayAdi(ay);
  const list = DB.giderler.filter(g => g.ay === ay)
    .sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const top = list.reduce((s, g) => s + Number(g.tutar || 0), 0);
  $('#gider-toplam').textContent = fmt(top);

  $('#gider-liste').innerHTML = list.length
    ? list.map(g => `<div class="item" data-gider="${g.id}">
        <span class="dot no"></span>
        <div class="main"><div class="t1">${esc(g.aciklama || g.tur)}</div>
          <div class="t2">${esc(g.tur)}${g.tarih ? ' · ' + fmtTarih(g.tarih) : ''}</div></div>
        <div class="amt minus">−${fmt(g.tutar)}</div>
      </div>`).join('')
    : `<div class="empty">Bu ay gider kaydı yok.</div>`;
}

/* ---------------- çizim: BORÇ DURUMU ---------------- */
function renderBorc() {
  const sonAy = ym();
  const tip = state.borcTip || 'daire';
  const grup = birimler().filter(d => ayniTip(d, tip));
  const n = grup.length;
  const data = grup.map(d => ({ d, b: daireBorc(d.id, sonAy) }))
    .sort((x, y) => y.b.toplam - x.b.toplam || noSirala(x.d, y.d));
  const toplam = data.reduce((s, x) => s + x.b.toplam, 0);
  const borclu = data.filter(x => x.b.toplam > 0);
  const temiz = data.filter(x => x.b.toplam <= 0);

  $('#b-toplam').textContent = fmt(toplam);
  const soz = tip === 'dukkan' ? 'dükkan' : 'daire';
  $('#b-toplam-sub').textContent = `${borclu.length} ${soz} borçlu`;
  $('#b-temiz').textContent = String(temiz.length);
  $('#b-temiz-sub').textContent = `toplam ${n} ${soz}`;

  document.querySelectorAll('#borc-tip-tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.tip === state.borcTip));
  document.querySelectorAll('#borc-tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.b === state.borcTab));
  const el = $('#borc-liste');
  if (!n) { el.innerHTML = `<div class="empty">Henüz ${tip === 'dukkan' ? 'dükkan' : 'daire'} yok.</div>`; return; }

  if (state.borcTab === 'acik') {
    el.innerHTML = borclu.length ? borclu.map(({ d, b }) => kart(d, b, sonAy)).join('')
      : `<div class="empty">🎉 Tüm ${soz}lerin borcu yok. Her şey güncel.</div>`;
  } else if (state.borcTab === 'gecmis') {
    const aylar = ayListesi(sonAy).filter(ay => ay < sonAy).reverse();
    if (!aylar.length) { el.innerHTML = `<div class="empty">Henüz geçmiş ay yok.</div>`; return; }
    el.innerHTML = aylar.map(ay => {
      const kalanTop = grup.reduce((s, d) => s + Math.max(0, aidatTutar(d, ay) - odenen(d.id, ay)), 0);
      const kisi = grup.filter(d => odenen(d.id, ay) < aidatTutar(d, ay)).length;
      return `<div class="item" data-aydetay="${ay}">
        <span class="dot ${kisi ? 'no' : 'ok'}"></span>
        <div class="main"><div class="t1">${ayAdi(ay)}</div>
          <div class="t2">${kisi ? kisi + ' ' + soz + ' ödemedi' : 'Tamamı ödendi'}</div></div>
        <div class="amt ${kalanTop ? 'minus' : 'plus'}">${kalanTop ? fmt(kalanTop) : '✓'}</div>
      </div>`;
    }).join('');
  } else {
    el.innerHTML = data.map(({ d, b }) => kart(d, b, sonAy)).join('');
  }
}

/* ödeme ödenen toplamı: b.odedi (daireBorc'tan) */
function kart(d, b, sonAy) {
  const durum = b.toplam <= 0 ? 'ok' : (b.odedi > 0 && b.gecikmisAy === 1 ? 'half' : 'no');
  const alt = b.toplam <= 0
    ? (b.odedi > 0 ? 'Ödemeler tam' : 'Ödeme kaydı yok')
    : `${b.gecikmisAy} ay ödenmemiş${b.odedi > 0 ? ' · ' + fmt(b.odedi) + ' ödenmiş' : ''}`;
  return `<div class="item" data-borclu="${d.id}">
    <span class="dot ${durum}"></span>
    <div class="main"><div class="t1">${birimAd(d)} ${esc(d.no)}${d.ad ? ' · ' + esc(d.ad) : ''}</div>
      <div class="t2">${alt}</div></div>
    <div class="amt ${b.toplam ? 'minus' : 'plus'}">${b.toplam ? fmt(b.toplam) : '✓'}</div>
  </div>`;
}

function borcDialog(daireId) {
  const d = daireBul(daireId); if (!d) return;
  const b = daireBorc(daireId, ym());
  const satir = x => `<div class="item">
      <span class="dot ${x.kalan ? 'no' : 'ok'}"></span>
      <div class="main"><div class="t1">${ayAdi(x.ay)}</div>
        <div class="t2">${x.odenen ? fmt(x.odenen) + ' ödendi' : 'Ödeme yok'}</div></div>
      <div class="amt ${x.kalan ? 'minus' : 'plus'}">${x.kalan ? fmt(x.kalan) : '✓'}</div>
    </div>`;
  sheet(`${birimAd(d)} ${d.no} — borç`, `
    <p class="hint">${esc(d.ad || 'İsim yok')} · bugüne kadar</p>
    <div class="panel row" style="margin-top:6px">
      <div><div class="clabel">Toplam borç</div><div class="cval sm red-text">${fmt(b.toplam)}</div></div>
      <div style="text-align:right"><div class="clabel">Ödenen</div><div class="cval sm green-text">${fmt(b.odedi)}</div></div>
    </div>
    ${b.toplam > 0 ? `<button class="btn" id="bd-kapat" style="width:100%;margin-top:12px">Tüm borcu tahsil et</button>` : ''}
    <h2 class="sect">Aylara göre</h2>
    <div class="list">${b.aylar.slice().reverse().map(satir).join('')}</div>
    ${b.ekler && b.ekler.length ? `<h2 class="sect">Manuel borçlar</h2>
      <div class="list">${b.ekler.map(x => {
        const kal = Math.max(0, x.tutar - (x.odenen || 0));
        return `<div class="item"><span class="dot ${kal ? 'no' : 'ok'}"></span>
          <div class="main"><div class="t1">${fmt(x.tutar)}${kal ? ' · kalan ' + fmt(kal) : ' · ödendi ✓'}</div>
            <div class="t2">${esc(x.aciklama || 'Manuel borç')}${x.tarih ? ' · ' + fmtTarih(x.tarih) : ''}</div></div>
          <div class="right">${kal ? `<button class="mini" data-ekode="${x.id}">Öde</button>` : ''}</div></div>`;
      }).join('')}</div>` : ''}
  `);
  $('#sheet-body').querySelectorAll('[data-ekode]').forEach(b => {
    b.onclick = () => {
      const x = (DB.ekBorclar || []).find(z => z.id === b.dataset.ekode); if (!x) return;
      const kal = Math.max(0, x.tutar - (x.odenen || 0));
      DB.odemeler.push({ id: uid(), daireId, ay: ym(), ekBorc: true, aciklama: x.aciklama || 'Manuel borç', tutar: kal, tarih: today() });
      x.odenen = (x.odenen || 0) + kal; x.odenenTarih = today();
      save(); renderAll(); toast(`${fmt(kal)} manuel borç tahsil edildi`);
      borcDialog(daireId);
    };
  });
  const btn = $('#bd-kapat');
  if (btn) btn.onclick = () => {
    b.ekler.filter(x => Math.max(0, x.tutar - (x.odenen || 0)) > 0).forEach(x => {
      const kal = Math.max(0, x.tutar - (x.odenen || 0));
      DB.odemeler.push({ id: uid(), daireId, ay: ym(), ekBorc: true, aciklama: x.aciklama || 'Manuel borç', tutar: kal, tarih: today() });
      x.odenen = (x.odenen || 0) + kal; x.odenenTarih = today();
    });
    save(); sheetKapat(); renderAll();
    toast(`${birimAd(d)} ${d.no} · ${fmt(b.toplam)} borç kapatıldı`);
  };
}

/* ---------------- çizim: RAPOR (12 ay) ---------------- */
function raporAylari() {
  const son = ym();
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const ay = ayKaydir(son, -i);
    const gelir = DB.odemeler.filter(o => o.ay === ay).reduce((s, o) => s + Number(o.tutar || 0), 0);
    const dukkan = DB.odemeler.filter(o => o.ay === ay && daireBul(o.daireId)?.tip === 'dukkan')
      .reduce((s, o) => s + Number(o.tutar || 0), 0);
    const gider = DB.giderler.filter(g => g.ay === ay).reduce((s, g) => s + Number(g.tutar || 0), 0);
    const daireSay = DB.daireler.filter(d => odenen(d.id, ay) > 0).length;
    out.push({ ay, gelir, dukkan, gider, net: gelir - gider, daireSay, gecerli: ay <= son });
  }
  return out;
}
const paraKisa = n => (Math.abs(n) >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace('.', ',') + 'b' : String(Math.round(n)));

function renderRapor() {
  const aylar = raporAylari();
  const gelir = aylar.reduce((s, x) => s + x.gelir, 0);
  const gider = aylar.reduce((s, x) => s + x.gider, 0);
  const giderAdet = DB.giderler.filter(g => aylar.some(x => x.ay === g.ay)).length;
  const bugunAy = ym();

  $('#r-gelir').textContent = fmt(gelir);
  const dukkanGelir = aylar.reduce((s, x) => s + x.dukkan, 0);
  $('#r-gelir-sub').textContent = `daire ${fmt(gelir - dukkanGelir)} · dükkan ${fmt(dukkanGelir)}`;
  $('#r-gider').textContent = fmt(gider);
  $('#r-gider-sub').textContent = `${giderAdet} kayıt`;
  $('#r-net').textContent = fmt(gelir - gider);
  $('#r-ort').textContent = fmt(gider / 12);

  document.querySelectorAll('#rapor-tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.r === state.raporTab));
  const el = $('#rapor-icerik');

  if (state.raporTab === 'ozet') {
    el.innerHTML = `<div class="rtab">
      <div class="rrow head"><span>Ay</span><span class="num">Gelir</span><span class="num">Gider</span><span class="num">Net</span></div>
      ${aylar.map(x => `<div class="rrow ${x.net < 0 ? 'net-neg' : 'net-pos'} ${x.ay === bugunAy ? 'now' : ''}" data-raporay="${x.ay}">
        <span class="r-ay">${MONTHS[Number(x.ay.split('-')[1]) - 1].slice(0, 3)} ${x.ay.slice(2, 4)}</span>
        <span class="num in">${x.gelir ? fmt(x.gelir) : '—'}</span>
        <span class="num out">${x.gider ? fmt(x.gider) : '—'}</span>
        <span class="num net">${fmt(x.net)}</span>
      </div>`).join('')}
      <div class="rrow head" style="border-top:1px solid var(--line)">
        <span>Toplam</span><span class="num in">${fmt(gelir)}</span><span class="num out">${fmt(gider)}</span>
        <span class="num net">${fmt(gelir - gider)}</span></div>
    </div>
    <p class="hint">Bir aya dokunursan Özet o aya geçer.</p>`;
  }

  if (state.raporTab === 'grafik') {
    const max = Math.max(1, ...aylar.map(x => Math.max(x.gelir, x.gider)));
    el.innerHTML = `<div class="chart">
      <div class="bars">
        ${aylar.map(x => `<div class="col ${x.ay === bugunAy ? 'today' : ''}" data-raporay="${x.ay}" title="${ayAdi(x.ay)} · gelir ${fmt(x.gelir)} / gider ${fmt(x.gider)}">
          <div class="pair">
            <div class="b" style="height:${Math.round(x.gelir / max * 100)}%"></div>
            <div class="b out" style="height:${Math.round(x.gider / max * 100)}%"></div>
          </div>
          <div class="lbl">${MONTHS[Number(x.ay.split('-')[1]) - 1].slice(0, 3)}<br>${x.ay.slice(2, 4)}</div>
        </div>`).join('')}
      </div>
      <div class="legend"><span><i class="g"></i>Gelir</span><span><i class="r"></i>Gider</span></div>
    </div>
    <div class="panel" style="margin-top:10px">
      <div class="prow"><span>En yüksek gider ayı</span><b>${ayAdi(aylar.slice().sort((a, b) => b.gider - a.gider)[0].ay)}</b></div>
      <div class="prow" style="margin-top:6px"><span>En iyi ay (net)</span><b>${ayAdi(aylar.slice().sort((a, b) => b.net - a.net)[0].ay)}</b></div>
      <div class="prow" style="margin-top:6px"><span>En kötü ay (net)</span><b>${ayAdi(aylar.slice().sort((a, b) => a.net - b.net)[0].ay)}</b></div>
    </div>`;
  }

  if (state.raporTab === 'dukkan') {
    const dukkanlar = birimler().filter(d => d.tip === 'dukkan');
    if (!dukkanlar.length) { el.innerHTML = `<div class="empty">Henüz dükkan kaydı yok.</div>`; return; }
    const son12 = aylar.map(x => x.ay);
    const rows = dukkanlar.map(d => {
      const o = DB.odemeler.filter(x => x.daireId === d.id && son12.includes(x.ay));
      const toplam = o.reduce((s, x) => s + Number(x.tutar || 0), 0);
      return { d, toplam };
    }).sort((a, b) => b.toplam - a.toplam);
    const top = rows.reduce((s, r) => s + r.toplam, 0);
    el.innerHTML = `<div class="rtab">
      <div class="rrow head" style="grid-template-columns:1fr 1fr"><span>Dükkan</span><span class="num">12 aylık gelir</span></div>
      ${rows.map(r => `<div class="rrow" style="grid-template-columns:1fr 1fr" data-borclu="${r.d.id}">
        <span class="r-ay">${esc(r.d.no)}${r.d.ad ? ' · ' + esc(r.d.ad) : ''}</span>
        <span class="num in">${r.toplam ? fmt(r.toplam) : '—'}</span>
      </div>`).join('')}
      <div class="rrow head" style="grid-template-columns:1fr 1fr;border-top:1px solid var(--line)">
        <span>Toplam</span><span class="num in">${fmt(top)}</span></div>
    </div>
    <p class="hint">Dükkan aidatları kasaya ve toplam gelire dahildir. Detay için satıra dokun.</p>
    <div class="btnrow"><button class="btn ghost" id="btn-dukkan-aidat">Tüm dükkanlara aynı aidatı yaz</button></div>
    <p class="hint">Her dükkana ayrı fiyat vermek için: Daireler → Dükkanlar → dükkana dokun → <b>Aylık aidat</b> alanını değiştir.</p>`;
    const btn = $('#btn-dukkan-aidat');
    if (btn) btn.onclick = () => {
      const v = prompt('Tüm dükkanlar için aylık aidat (₺):', String(dukkanlar[0] ? birimAidat(dukkanlar[0]) : ''));
      if (v === null) return;
      const t = Math.max(0, Number(String(v).replace(',', '.')) || 0);
      dukkanlar.forEach(d => { d.aidat = t; });
      state.dukkanAidat = t;
      save(); renderRapor(); toast(`Tüm dükkanlara ${fmt(t)}/ay yazıldı`);
    };
  }

  if (state.raporTab === 'kalem') {
    const toplam = Math.max(1, gider);
    const gruplar = {};
    DB.giderler.filter(g => aylar.some(x => x.ay === g.ay)).forEach(g => {
      const k = g.tur || 'Diğer';
      gruplar[k] = (gruplar[k] || 0) + Number(g.tutar || 0);
    });
    const list = Object.entries(gruplar).sort((a, b) => b[1] - a[1]);
    el.innerHTML = list.length ? list.map(([k, v]) => `<div class="kalem">
        <div class="kh"><span>${esc(k)}</span><span>${fmt(v)}</span></div>
        <div class="kbar"><i style="width:${Math.max(2, Math.round(v / toplam * 100))}%"></i></div>
        <div class="kp">12 aylık giderin %${Math.round(v / toplam * 100)}'i · aylık ort. ${fmt(v / 12)}</div>
      </div>`).join('') : `<div class="empty">Son 12 ayda gider kaydı yok.</div>`;
  }
}

/* ---------------- grafik sekmesi (dairesel değil; SVG) ---------------- */
function cizgiSvg(seriler, renkler) {
  const W = 320, H = 150, PADX = 34, PADT = 10, PADB = 20;
  const n = seriler[0].veri.length;
  const max = Math.max(1, ...seriler.flatMap(s => s.veri));
  const x = i => PADX + (n === 1 ? 0 : i * (W - PADX - 6) / (n - 1));
  const y = v => PADT + (H - PADT - PADB) * (1 - v / max);
  const cizgi = dizi => dizi.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const grid = [0, 0.5, 1].map(k => {
    return `<line x1="${PADX}" y1="${y(max * k)}" x2="${W - 4}" y2="${y(max * k)}" stroke="var(--line)" stroke-dasharray="3 3"/>` +
      `<text x="${PADX - 5}" y="${y(max * k) + 3}" fill="#8fa0ad" font-size="8" text-anchor="end">${k ? fmt(max * k) : ''}</text>`;
  });
  const etiketler = [0, n >> 1, n - 1].map(i =>
    `<text x="${x(i)}" y="${H - 5}" fill="#8fa0ad" font-size="8" text-anchor="middle">${ayAdi(seriler[0].etiketler[i]).slice(0, 3)}</text>`).join('');
  const yollar = seriler.map((s, k) =>
    `<path d="${cizgi(s.veri)}" fill="none" stroke="${renkler[k]}" stroke-width="2" stroke-linejoin="round">` +
    (s.veri[n - 1] ? `<title>${esc(s.ad)}: son ${fmt(s.veri[n - 1])}</title>` : '') + '</path>');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img">${grid}${etiketler}${yollar}</svg>`;
}

function renderGrafik() {
  /* 12 aylık tahsilat/gider trendi */
  const aylar = raporAylari();
  const etiketler = aylar.map(x => x.ay);
  const trend = cizgiSvg([
    { ad: 'Tahsilat', veri: aylar.map(x => x.gelir), etiketler },
    { ad: 'Gider', veri: aylar.map(x => x.gider), etiketler }
  ], ['#35b06f', '#d1495b']);
  const gelen12 = aylar.reduce((s, x) => s + x.gelir, 0);
  const giden12 = aylar.reduce((s, x) => s + x.gider, 0);

  /* çoklu bina karşılaştırması */
  const satirBina = async id => {
    const b = PRO.binalar.find(x => x.id === id); if (!b) return null;
    let veri = b.id === PRO.aktif ? DB : null;
    if (!veri) {
      const ham = localStorage.getItem(profilKey(b.id));
      const n = JSON.parse(ham || 'null');
      if (n && n['@enc'] && !oturumAnahtari) return null;
      veri = normalize((n && n['@enc']) ? await sifreCoz(n) : n);
    }
    return veri;
  };
  const son12 = aylar.map(x => x.ay);
  const binaSatirlar = (() => {
    const satirlar = [];
    const proms = PRO.binalar.map(async b => {
      const v = await satirBina(b.id);
      if (!v) { satirlar.push({ b, gelir: null, gider: null, kilitli: true }); return; }
      const gelir = v.odemeler.filter(o => son12.includes(o.ay)).reduce((s, o) => s + Number(o.tutar || 0), 0);
      const gider = v.giderler.filter(g => son12.includes(g.ay)).reduce((s, g) => s + Number(g.tutar || 0), 0);
      satirlar.push({ b, gelir, gider, kilitli: false, net: gelir - gider });
    });
    return Promise.all(proms).then(() => satirlar);
  })();
  const kayit = DB.giderler.filter(g => aylar.some(x => x.ay === g.ay)).length;
  const set = (id, txt) => { const nd = $(id); if (nd) nd.textContent = txt; };
  set('#g-x12-gelir', fmt(gelen12));
  set('#g-x12-gelir-sub', 'aidat + ek tahsilat');
  set('#g-x12-gider', fmt(giden12));
  set('#g-x12-gider-sub', `${kayit} kayıt`);
  set('#grafik-donem', `${ayAdi(aylar[0].ay)} – ${ayAdi(aylar[aylar.length - 1].ay)}`);
  const trendEl = $('#grafik-trend');
  if (trendEl) trendEl.innerHTML = trend;

  /* çoklu bina karşılaştırması */
  const binaEl = $('#grafik-binalar');
  if (!binaEl) return;
  binaSatirlar.then(satirlar => {
    satirlar.sort((a, b) => (b.gelir || 0) - (a.gelir || 0));
    binaEl.innerHTML = satirlar.length <= 1
      ? `<p class="hint">Karşılaştırma için ikinci bir bina ekleyin: Daireler → Ayarlar → “Çoklu bina”.</p>`
      : `<div class="rtab">
          <div class="rrow head" style="grid-template-columns:1.2fr 1fr 1fr 1fr"><span>Bina</span><span class="num">12ay gelir</span><span class="num">gider</span><span class="num">net</span></div>
          ${satirlar.map(s => s.kilitli ? `
          <div class="rrow" style="grid-template-columns:1.2fr 1fr 1fr 1fr"><span class="r-ay">${esc(s.b.ad || 'Bina')} <span class="tag">PIN</span></span><span class="num" style="color:#8fa0ad" colspan="3">gizli</span></div>` : `
          <div class="rrow" style="grid-template-columns:1.2fr 1fr 1fr 1fr" data-binagec="${s.b.id}">
            <span class="r-ay">${esc(s.b.ad || 'Bina')}${s.b.id === PRO.aktif ? ' <span class="tag">Aktif</span>' : ''}</span>
            <span class="num in">${fmt(s.gelir)}</span><span class="num out">${fmt(s.gider)}</span>
            <span class="num net">${fmt(s.net || 0)}</span></div>`).join('')}
        </div>
        <p class="hint">Satıra dokunursan o bina aktif olur (PIN korumalı binalar şifresi açılmadan gizli kalır).</p>`;
    binaEl.querySelectorAll('[data-binagec]').forEach(row => {
      row.addEventListener('click', () => binaGec(row.dataset.binagec));
    });
  });
}

function raporMetni() {
  const aylar = raporAylari();
  const satir = aylar.map(x => `${MONTHS[Number(x.ay.split('-')[1]) - 1]} ${x.ay.slice(0, 4)}: gelir ${fmt(x.gelir)} | gider ${fmt(x.gider)} | net ${fmt(x.net)}`);
  const gelir = aylar.reduce((s, x) => s + x.gelir, 0);
  const gider = aylar.reduce((s, x) => s + x.gider, 0);
  const dukkan = aylar.reduce((s, x) => s + x.dukkan, 0);
  return `*${DB.bina || 'Bina'}* — Son 12 Ay Gelir/Gider\n\n${satir.join('\n')}\n\nToplam gelir: ${fmt(gelir)} (daire ${fmt(gelir - dukkan)} + dükkan ${fmt(dukkan)})\nToplam gider: ${fmt(gider)}\nNet: ${fmt(gelir - gider)}`;
}

/* =====================================================
   PDF ÇIKTISI — yazdır penceresi ile (bağımlılıksız,
   çevrimdışı çalışır; Chrome/Edge "PDF olarak kaydet")
   ===================================================== */
function pdfYazdir(baslik, icerik) {
  const w = window.open('', '_blank', 'width=940,height=960');
  if (!w) { toast('PDF penceresi açılamadı — açılır pencerelere izin verin'); return; }
  w.document.open();
  w.document.write(`<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><title>${esc(baslik)}</title>
<style>
@page { size: A4 portrait; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 10.5pt; color:#14202b; margin:0; }
.baslikbolum { border-bottom: 2.5px solid #0f2a43; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
.baslikbolum h1 { margin: 0; font-size: 16pt; color: #0f2a43; }
.baslikbolum .kucuk { color: #56646f; font-size: 9pt; text-align: right; line-height: 1.45; }
h2 { font-size: 11.5pt; color:#0f2a43; margin: 16px 0 4px; border-bottom: 1px solid #c9d4de; padding-bottom: 3px; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; }
th, td { border: 1px solid #bcc7d2; padding: 5px 7px; font-size: 9.5pt; }
th { background: #eaf0f6; text-align: left; }
.num { text-align: right; white-space: nowrap; }
tfoot td { font-weight: 700; background: #f4f7fa; }
.pos { color: #1b7a43; } .neg { color: #c0392b; }
.dipnot { margin-top: 20px; color:#56646f; font-size: 8.5pt; border-top: 1px solid #c9d4de; padding-top: 6px; }
.kartlar { display: flex; gap: 10px; flex-wrap: wrap; margin: 8px 0 12px; }
.kart { border: 1px solid #bcc7d2; border-radius: 6px; padding: 8px 12px; min-width: 130px; }
.kart span { display: block; font-size: 8.5pt; color: #56646f; }
.kart b { font-size: 11pt; }
.netpos { color: #1b7a43; } .netneg { color: #c0392b; }
</style></head><body>
${icerik}
<div class="dipnot">© ${LISANS.yil} ${LISANS.sahip} · Aidat — Bina Gelir Gider · ${esc(DB.bina || 'Bina')} · çıktı tarihi: ${fmtTarih(today())}</div>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch (e) { /* bazı tarayıcılar otomatik yazdırmayı engeller */ } }, 350);
}

/* ---- Aylık Aidat Pusulası ---- */
function pusulaPdf() {
  const ay = state.ayAidat, s = ayOzet(ay);
  const liste = [...birimler()].sort(noSirala);
  const satirlar = liste.map(d => {
    const tar = aidatTutar(d, ay), o = odenen(d.id, ay), kalan = Math.max(0, tar - o);
    const tam = tar > 0 && o >= tar;
    const durum = muafMi(d) ? 'Muaf' : (tar === 0 ? 'Aidat yok' : (tam ? 'Ödendi ✓' : (o > 0 ? 'Kısmi' : 'Ödenmedi')));
    const tarihler = DB.odemeler.filter(p => p.daireId === d.id && p.ay === ay).map(p => fmtTarih(p.tarih)).join(', ');
    return `<tr><td>${birimAd(d)} ${esc(d.no)}</td><td>${esc(d.ad || '—')}</td><td class="num">${tar ? fmt(tar) : '—'}</td><td class="num">${o ? fmt(o) : '—'}</td><td class="num ${kalan ? 'neg' : ''}">${kalan ? fmt(kalan) : '—'}</td><td>${durum}</td><td>${esc(tarihler)}</td></tr>`;
  }).join('');
  const oran = s.toplamBeklenen > 0 ? Math.min(100, Math.round(s.tahsil / s.toplamBeklenen * 100)) : 0;
  const kasa = kasaToplam();
  pdfYazdir(`Aidat Pusulası — ${ayAdi(ay)}`, `
    <div class="baslikbolum">
      <h1>Aidat Tahsil Pusulası</h1>
      <div class="kucuk"><b>${esc(DB.bina || 'Bina')}</b><br>${ayAdi(ay)}<br>Aidat günü: ayın ${DB.aidatGun || 5}'i</div>
    </div>
    <h2>Birim bazlı aidat durumu</h2>
    <table>
      <thead><tr><th>Birim</th><th>Sakin / Kiracı</th><th class="num">Aidat</th><th class="num">Ödenen</th><th class="num">Kalan</th><th>Durum</th><th>Ödeme tarihi</th></tr></thead>
      <tbody>${satirlar}</tbody>
      <tfoot><tr><td colspan="3">TOPLAM</td><td class="num">${fmt(s.tahsil)}</td><td class="num">${fmt(s.bekleyen)}</td><td colspan="2">Tahsilat oranı %${oran}</td></tr></tfoot>
    </table>
    ${s.bekleyen > 0 ? `<h2>Gecikmiş / bekleyen birimler</h2>
      <table><thead><tr><th>Birim</th><th>Sakin / Kiracı</th><th class="num">Kalan aidat</th></tr></thead><tbody>
      ${s.borclu.map(d => `<tr><td>${birimAd(d)} ${esc(d.no)}</td><td>${esc(d.ad || '—')}</td><td class="num neg">${fmt(Math.max(0, aidatTutar(d, ay) - odenen(d.id, ay)))}</td></tr>`).join('')}
      </tbody></table>` : '<p>Tüm birimler bu ay aidatını ödemiştir.</p>'}
    <div class="kartlar">
      <div class="kart"><span>Tahsil edilen</span><b class="pos">${fmt(s.tahsil)}</b></div>
      <div class="kart"><span>Bekleyen aidat</span><b class="neg">${fmt(s.bekleyen)}</b></div>
      <div class="kart"><span>Dükkan tahsilatı</span><b>${fmt(s.dukkanTahsil)}</b></div>
      <div class="kart"><span>Devreden kasa</span><b>${fmt(DB.devredenKasa)}</b></div>
      <div class="kart"><span>Kasa toplam</span><b class="${kasa >= 0 ? 'netpos' : 'netneg'}">${fmt(kasa)}</b></div>
    </div>`);
}

/* ---- Tek kişilik aidat makbuzu ---- */
function makbuzPdf(daireId, ay) {
  const d = daireBul(daireId); if (!d) return;
  const odemeler = DB.odemeler.filter(x => x.daireId === daireId && (x.ay === ay || x.ekBorc));
  if (!odemeler.length) return toast('Makbuz için ödeme kaydı yok');
  const toplamOdenen = odemeler.reduce((s, x) => s + Number(x.tutar || 0), 0);
  const tar = aidatTutar(d, ay);
  const kalan = Math.max(0, tar - odenen(daireId, ay));
  const satirlar = [...odemeler].sort((a, b) => (a.tarih || '').localeCompare(b.tarih || '')).map(x =>
    `<tr><td>${fmtTarih(x.tarih || '')}</td><td>${x.ekBorc ? esc(x.aciklama || 'Manuel borç') : 'Aidat'}</td><td class="num">${fmt(x.tutar)}</td></tr>`).join('');
  pdfYazdir(`Aidat Makbuzu — ${birimAd(d)} ${d.no}`, `
    <div class="baslikbolum">
      <h1>Aidat Makbuzu</h1>
      <div class="kucuk"><b>${esc(DB.bina || 'Bina')}</b><br>${d.tip === 'dukkan' ? 'Dükkan' : 'Daire'} No: <b>${esc(d.no)}</b> · Sakin: <b>${esc(d.ad || '—')}</b>${ay ? '<br>' + ayAdi(ay) : ''}</div>
    </div>
    <div class="kartlar">
      <div class="kart"><span>Tahsil edilen tutar</span><b class="pos">${fmt(toplamOdenen)}</b></div>
      <div class="kart"><span>Buradaki ay aidatı</span><b>${fmt(tar)}</b></div>
      <div class="kart"><span>Kalan borç</span><b class="${kalan ? 'neg' : 'pos'}">${fmt(kalan)}</b></div>
    </div>
    <table>
      <thead><tr><th>Tarih</th><th>Açıklama</th><th class="num">Tutar</th></tr></thead>
      <tbody>${satirlar}</tbody>
      <tfoot><tr><td colspan="2">TOPLAM</td><td class="num">${fmt(toplamOdenen)}</td></tr></tfoot>
    </table>`);
}

/* ---- Yönetim raporu (son 12 ay) ---- */
function yonetimRaporuPdf() {
  const aylar = raporAylari();
  const gelir = aylar.reduce((s, x) => s + x.gelir, 0);
  const gider = aylar.reduce((s, x) => s + x.gider, 0);
  const net = gelir - gider;
  const dukkanGelir = aylar.reduce((s, x) => s + x.dukkan, 0);
  const tablo = aylar.map(x => `<tr><td>${ayAdi(x.ay)}</td><td class="num">${x.gelir ? fmt(x.gelir) : '—'}</td><td class="num">${x.gider ? fmt(x.gider) : '—'}</td><td class="num ${x.net < 0 ? 'neg' : 'pos'}">${fmt(x.net)}</td><td class="num">${x.daireSay || '—'}</td></tr>`).join('');
  const kalemGruplar = {};
  DB.giderler.filter(g => aylar.some(x => x.ay === g.ay)).forEach(g => {
    const k = g.tur || 'Diğer';
    kalemGruplar[k] = (kalemGruplar[k] || 0) + Number(g.tutar || 0);
  });
  const kalemler = Object.entries(kalemGruplar).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${fmt(v)}</td><td class="num">%${Math.round(v / Math.max(1, gider) * 100)}</td><td class="num">${fmt(v / 12)}</td></tr>`).join('');
  const borcBul = (() => {
    let top = 0, kimse = [];
    birimler().forEach(d => {
      const b = daireBorc(d.id, ym());
      if (b.toplam > 0) { top += b.toplam; kimse.push(`<tr><td>${birimAd(d)} ${esc(d.no)}</td><td>${esc(d.ad || '—')}</td><td class="num">${b.gecikmisAy} ay</td><td class="num neg">${fmt(b.toplam)}</td></tr>`); }
    });
    return { top, kimse };
  })();
  const kasa = kasaToplam();
  pdfYazdir(`Yönetim Raporu — ${ayAdi(ym())}`, `
    <div class="baslikbolum">
      <h1>Gelir / Gider Yönetim Raporu</h1>
      <div class="kucuk"><b>${esc(DB.bina || 'Bina')}</b><br>Son 12 ay: ${ayKisa(aylar[0].ay)} — ${ayKisa(aylar[11].ay)}<br>Birim sayısı: ${birimler().length} (daire ${birimler().filter(d => d.tip !== 'dukkan').length} + dükkan ${birimler().filter(d => d.tip === 'dukkan').length})</div>
    </div>
    <div class="kartlar">
      <div class="kart"><span>Toplam gelir (daire)</span><b>${fmt(gelir - dukkanGelir)}</b></div>
      <div class="kart"><span>Toplam gelir (dükkan)</span><b>${fmt(dukkanGelir)}</b></div>
      <div class="kart"><span>Toplam gider</span><b class="neg">${fmt(gider)}</b></div>
      <div class="kart"><span>Net bakiye</span><b class="${net >= 0 ? 'netpos' : 'netneg'}">${fmt(net)}</b></div>
      <div class="kart"><span>Ortalama aylık gider</span><b>${fmt(gider / 12)}</b></div>
      <div class="kart"><span>Kasa toplam</span><b class="${kasa >= 0 ? 'netpos' : 'netneg'}">${fmt(kasa)}</b></div>
    </div>
    <h2>Aylık gelir-gider tablosu</h2>
    <table>
      <thead><tr><th>Ay</th><th class="num">Gelir</th><th class="num">Gider</th><th class="num">Net</th><th class="num">Ödeyen</th></tr></thead>
      <tbody>${tablo}</tbody>
      <tfoot><tr><td>TOPLAM</td><td class="num">${fmt(gelir)}</td><td class="num">${fmt(gider)}</td><td class="num">${fmt(net)}</td><td>—</td></tr></tfoot>
    </table>
    <h2>Gider kalemleri (son 12 ay)</h2>
    ${kalemler ? `<table><thead><tr><th>Kalem</th><th class="num">Tutar</th><th class="num">Payı</th><th class="num">Aylık ort.</th></tr></thead><tbody>${kalemler}</tbody></table>` : '<p>Son 12 ayda gider kaydı yok.</p>'}
    <h2>Borç durumu (tüm aylar dahil)</h2>
    ${borcBul.kimse.length ? `<table><thead><tr><th>Birim</th><th>Sakin / Kiracı</th><th class="num">Ödenmeyen ay</th><th class="num">Toplam borç</th></tr></thead><tbody>${borcBul.kimse}</tbody><tfoot><tr><td colspan="3">TOPLAM BORÇ</td><td class="num">${fmt(borcBul.top)}</td></tr></tfoot></table>` : '<p>Hiçbir birimin borcu yok; tüm ödemeler günceldir.</p>'}`);
}

/* ---------------- çizim: DAİRELER ---------------- */
function renderDaire() {
  const el = $('#daire-liste');
  const tip = state.daireTab === 'dukkan' ? 'dukkan' : 'daire';
  const grup = birimler().filter(d => ayniTip(d, tip));
  document.querySelectorAll('#unit-tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.u === tip));
  const ekle = $('#btn-daire-ekle');
  if (ekle) ekle.textContent = tip === 'dukkan' ? '+ Dükkan' : '+ Daire';
  const toplu = $('#btn-dukkan-toplu');
  if (toplu) toplu.hidden = tip !== 'dukkan';
  const oz = $('#unit-ozet');
  if (oz) {
    const daireSay = birimler().filter(d => d.tip === 'daire').length;
    const dukkanSay = birimler().filter(d => d.tip === 'dukkan').length;
    const dukkanAidatTop = birimler().filter(d => d.tip === 'dukkan' && !muafMi(d)).reduce((s, d) => s + birimAidat(d), 0);
    oz.innerHTML = `<b>${daireSay}</b> daire · <b>${dukkanSay}</b> dükkan — dükkanlardan aylık <b>${fmt(dukkanAidatTop)}</b> aidat beklenir.`;
  }
  if (!grup.length) {
    el.innerHTML = `<div class="empty">Henüz ${tip === 'dukkan' ? 'dükkan' : 'daire'} eklenmedi.</div>`;
  } else {
    const rows = [...grup].sort((a, b) => noSirala(a, b));
    el.innerHTML = rows.map(d => {
      const bu = odenen(d.id, state.ay);
      const borc = Math.max(0, aidatTutar(d, state.ay) - bu);
      return `<div class="item" data-daireduzenle="${d.id}">
        <span class="dot ${borc > 0 ? 'no' : 'ok'}"></span>
        <div class="main"><div class="t1">${birimAd(d)} ${esc(d.no)}${d.ad ? ' · ' + esc(d.ad) : ''}${muafMi(d) ? ' <span class="tag">Muaf</span>' : ''}${d.tip === 'dukkan' ? ' <span class="tag aidat-tag">' + fmt(birimAidat(d)) + '/ay</span>' : ''}</div>
          <div class="t2">${d.tip === 'dukkan' ? 'Aylık ' + fmt(birimAidat(d)) : (d.tel ? esc(d.tel) : 'Telefon yok')} · ${ayKisa(state.ay)}: ${muafMi(d) ? 'aidat muaf' : (bu > 0 ? fmt(bu) + ' ödedi' : 'ödemede yok')}</div></div>
        <div class="amt ${borc > 0 ? 'minus' : 'plus'}">${borc > 0 ? fmt(borc) : '✓'}</div>
      </div>`;
    }).join('');
  }

  $('#tur-liste').innerHTML = DB.turlar.map(t =>
    `<span class="chip" data-tursil="${esc(t)}">${esc(t)} <span class="x">✕</span></span>`).join('')
    || `<p class="hint">Kalem yok.</p>`;

  $('#set-bina').value = DB.bina || '';
  $('#set-aidat').value = DB.aidat || '';
  $('#set-gun').value = DB.aidatGun || 5;
  $('#set-kasa').value = DB.devredenKasa || 0;
  /* yıllık aidat geçmişi */
  const yl = $('#aidat-yil-liste');
  if (yl) yl.innerHTML = (DB.aidatYillari || []).slice().sort((a, b) => b.yil - a.yil).map(x =>
    `<span class="chip" data-yilsil="${x.yil}">${x.yil}: aylık ${fmt(x.tutar)} <span class="x">✕</span></span>`).join('')
    || `<p class="hint">Tarih kısa geçmişi bulunmuyor; tüm aylar güncel aidat (${fmt(DB.aidat)}) ile hesaplanıyor.</p>`;
  /* profil (bina) çipleri */
  const pb = $('#bina-liste');
  if (pb) pb.innerHTML = [...PRO.binalar].map(b =>
    `<span class="chip" data-binagec="${b.id}">${esc(b.ad || 'Bina')}${b.id === PRO.aktif ? ' <span class="tag">Aktif</span>' : ''}</span>`).join('');
  const muaf = DB.daireler.filter(muafMi);
  const mo = $('#muaf-ozet');
  if (mo) mo.innerHTML = muaf.length
    ? `Aidattan muaf <b>${muaf.length}</b> birim: ${muaf.map(d => birimAd(d) + ' ' + esc(d.no)).join(', ')}. Bu birimler borç ve bekleyen aidat hesabına katılmaz.`
    : 'Aidattan muaf daire yok. Yönetici dairesi gibi daireleri buradan işaretleyebilirsin.';
  const dz = $('#dukkan-ayar-ozet');
  if (dz) {
    const dukkanlar = birimler().filter(d => d.tip === 'dukkan');
    const toplam = dukkanlar.filter(d => !muafMi(d)).reduce((s, d) => s + birimAidat(d), 0);
    dz.innerHTML = dukkanlar.length
      ? `Toplam <b>${dukkanlar.length}</b> dükkan · aylık dükkan aidatı toplamı <b>${fmt(toplam)}</b>. Her dükkanın aidatını <b>Daireler → Dükkanlar</b> bölümünden tek tek değiştirebilirsin.`
      : 'Henüz dükkan yok. Daireler → Dükkanlar bölümünden ekleyebilirsin.';
  }
  const ml = $('#muaf-liste');
  if (ml) ml.innerHTML = muaf.map(d =>
    `<span class="chip" data-muafsil="${d.id}">Daire ${esc(d.no)} <span class="x">✕</span></span>`).join('');
  const ek = $('#ek-borc-liste');
  if (ek) {
    const ekler = (DB.ekBorclar || []).filter(b => Math.max(0, b.tutar - (b.odenen || 0)) > 0);
    const toplamEk = ekler.reduce((s, b) => s + Math.max(0, b.tutar - (b.odenen || 0)), 0);
    ek.innerHTML = ekler.map(b => {
      const d = daireBul(b.daireId);
      return `<div class="item"><span class="dot no"></span>
        <div class="main"><div class="t1">${d ? birimAd(d) + ' ' + esc(d.no) : 'Birim'} · ${fmt(Math.max(0, b.tutar - (b.odenen || 0)))}</div>
        <div class="t2">${esc(b.aciklama || 'Manuel borç')}${b.tarih ? ' · ' + fmtTarih(b.tarih) : ''}</div></div>
        <div class="amt minus">—</div></div>`;
    }).join('') || `<p class="hint">Manuel borç yok. Daireler → Ayarlar bölümünden veya aidat ekranındaki detay penceresinden girebilirsin.</p>`;
  }
}

function renderAll() {
  if (state.view === 'ozet') renderOzet();
  if (state.view === 'aidat') renderAidat();
  if (state.view === 'gider') renderGider();
  if (state.view === 'borc') renderBorc();
  if (state.view === 'rapor') renderRapor();
  if (state.view === 'daire') renderDaire();
  if (state.view === 'grafik') renderGrafik();
  guvenlikDurumCiz();
}

/* ---------------- gezinme ---------------- */
function git(v) {
  state.view = v;
  ['ozet', 'aidat', 'gider', 'borc', 'rapor', 'grafik', 'daire'].forEach(k => { $('#v-' + k).hidden = k !== v; });
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  window.scrollTo({ top: 0 });
  renderAll();
}

/* ---------------- toast ---------------- */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800);
}

/* ---------------- sheet ---------------- */
function sheet(title, html) {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  $('#sheet-wrap').hidden = false;
}
function sheetKapat() {
  $('#sheet-wrap').hidden = true;
  $('#sheet-body').innerHTML = '';
}

/* =====================================================
   OLAYLAR
   ===================================================== */

/* gezinme */
$('#nav').addEventListener('click', e => {
  const b = e.target.closest('button[data-v]');
  if (b) git(b.dataset.v);
});
$('#sheet-bg').addEventListener('click', sheetKapat);

/* ay okları */
$('#ay-geri').onclick = () => { state.ay = ayKaydir(state.ay, -1); renderOzet(); };
$('#ay-ileri').onclick = () => { state.ay = ayKaydir(state.ay, 1); renderOzet(); };
$('#aidat-tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab[data-tip]'); if (!t) return;
  state.aidatTip = t.dataset.tip;
  document.querySelectorAll('#aidat-tabs .tab').forEach(x => x.classList.toggle('on', x === t));
  renderAidat();
});
$('#a-geri').onclick = () => { state.ayAidat = ayKaydir(state.ayAidat, -1); renderAidat(); };
$('#a-ileri').onclick = () => { state.ayAidat = ayKaydir(state.ayAidat, 1); renderAidat(); };
$('#g-geri').onclick = () => { state.ayGider = ayKaydir(state.ayGider, -1); renderGider(); };
$('#g-ileri').onclick = () => { state.ayGider = ayKaydir(state.ayGider, 1); renderGider(); };

/* ---- ÖZET: borçluya dokun → ödeme al ---- */
$('#ozet-borc').addEventListener('click', e => {
  const it = e.target.closest('[data-borc]');
  if (it) aidatDialog(it.dataset.borc, state.ay);
});

/* ---- AİDAT ---- */
$('#aidat-liste').addEventListener('click', e => {
  const tick = e.target.closest('[data-tick]');
  if (tick) { aidatToggle(tick.dataset.tick, state.ayAidat); return; }
  const det = e.target.closest('[data-detay]');
  if (det) aidatDialog(det.dataset.detay, state.ayAidat);
});

function aidatToggle(daireId, ay) {
  const d = daireBul(daireId); if (!d) return;
  if (muafMi(d)) return toast(`${birimAd(d)} ${d.no} aidattan muaf`);
  const tar = aidatTutar(d, ay);          // birimin kendi aidatı (dükkan/özel daire dahil)
  const o = odenen(daireId, ay);
  if (tar > 0 && o >= tar) {
    // ödemeyi geri al
    DB.odemeler = DB.odemeler.filter(x => !(x.daireId === daireId && x.ay === ay));
    save(); renderAll(); toast(`${birimAd(d)} ${d.no} ödemesi geri alındı`);
  } else if (tar > 0) {
    const kalan = tar - o;
    DB.odemeler.push({ id: uid(), daireId, ay, tutar: kalan, tarih: today() });
    save(); renderAll(); toast(`${birimAd(d)} ${d.no} · ${fmt(kalan)} tahsil edildi`);
  } else if (o > 0) {
    DB.odemeler = DB.odemeler.filter(x => !(x.daireId === daireId && x.ay === ay));
    save(); renderAll(); toast(`${birimAd(d)} ${d.no} ödemesi geri alındı`);
  } else {
    toast('Önce ayarlardan aidat tutarını gir');
  }
}

$('#btn-toplu').onclick = () => {
  const ay = state.ayAidat;
  if (DB.aidat <= 0) return toast('Önce ayarlardan aidat tutarını gir');
  let n = 0, tut = 0;
  birimler().filter(d => ayniTip(d, state.aidatTip === 'dukkan' ? 'dukkan' : 'daire')).forEach(d => {
    const kalan = aidatTutar(d, ay) - odenen(d.id, ay);
    if (kalan > 0) { DB.odemeler.push({ id: uid(), daireId: d.id, ay, tutar: kalan, tarih: today() }); n++; tut += kalan; }
  });
  save(); renderAll();
  toast(n ? `${n} birimden ${fmt(tut)} tahsil edildi (kasaya eklendi)` : 'Tümü zaten ödedi');
};

function aidatDialog(daireId, ay) {
  const d = daireBul(daireId); if (!d) return;
  const odemeler = DB.odemeler.filter(o => o.daireId === daireId && o.ay === ay && !o.ekBorc);
  const o = odemeler.reduce((s, x) => s + Number(x.tutar), 0);
  const tar = aidatTutar(d, ay);
  const kalan = Math.max(0, tar - o);
  /* manuel (ek) borçlar: dükkan/daire için ayrı tutarlı kayıtlar */
  const ekler = (DB.ekBorclar || []).filter(b => b.daireId === daireId);
  const ekListe = ekler.length ? ekler.map(b => {
    const kal = Math.max(0, b.tutar - (b.odenen || 0));
    return `<div class="item"><span class="dot ${kal ? 'no' : 'ok'}"></span>
      <div class="main"><div class="t1">${fmt(b.tutar)}${kal ? ' · kalan ' + fmt(kal) : ''}</div>
        <div class="t2">${esc(b.aciklama || 'Manuel borç')}${b.tarih ? ' · ' + fmtTarih(b.tarih) : ''}</div></div>
      <div class="right">${kal ? `<button class="mini" data-ekode="${b.id}">Öde</button>` : ''}
      <button class="iconbtn" data-eksil="${b.id}" style="color:#d1495b">✕</button></div></div>`;
  }).join('') : '<p class="hint">Manuel borç yok.</p>';
  const odemelerTum = DB.odemeler.filter(x => x.daireId === daireId && (x.ay === ay || x.ekBorc));
  sheet(`${birimAd(d)} ${d.no}`, `
    <p class="hint">${esc(d.ad || 'İsim yok')} · ${ayAdi(ay)}${d.tip === 'dukkan' ? ' · aylık ' + fmt(birimAidat(d)) : ''}</p>
    ${d.tip === 'dukkan' ? `<div class="btnrow" style="margin:10px 0 4px">
      <button class="btn ghost" id="dl-aidat">Aylık aidatı değiştir (${fmt(birimAidat(d))})</button>
    </div>` : ''}
    <div class="panel row" style="margin-top:6px">
      <div><div class="clabel">Bu ay ödenen</div><div class="cval sm ${tar > 0 && o >= tar ? 'green-text' : ''}">${fmt(o)}</div></div>
      <div style="text-align:right"><div class="clabel">Kalan</div><div class="cval sm red-text">${fmt(kalan)}</div></div>
    </div>
    ${kalan > 0 ? `
    <label class="field"><span>Tahsil edilecek tutar (₺)</span>
      <input id="dl-tutar" type="number" inputmode="decimal" step="1" min="1" value="${kalan}"></label>
    <button class="btn" id="dl-ode" style="width:100%">Ödeme al</button>` : ''}
    ${odemeler.length ? `<h2 class="sect">Ödeme geçmişi</h2><div class="list">${odemeler.map(x =>
      `<div class="item"><span class="dot ok"></span><div class="main"><div class="t1">${fmt(x.tutar)}</div>
        <div class="t2">${fmtTarih(x.tarih)}${x.ekBorc ? ' · ' + esc(x.aciklama || 'manuel borç') : ''}</div></div>
        <button class="iconbtn" data-sil="${x.id}" style="color:#d1495b">✕</button></div>`).join('')}</div>` : ''}
    <h2 class="sect">Manuel borç / ek aidat</h2>
    <div class="list">${ekListe}</div>
    <label class="field" style="margin-top:8px"><span>Manuel tutar (₺)</span>
      <input id="dl-ek-tutar" type="number" inputmode="decimal" step="1" min="1" placeholder="Örn. 350"></label>
    <label class="field"><span>Açıklama</span>
      <input id="dl-ek-acikla" placeholder="Örn. Su borcu, park yeri, tadilat katılımı"></label>
    <button class="btn ghost" id="dl-ek-ekle" style="width:100%">+ Manuel borç ekle</button>
    ${odemelerTum.length ? `<div class="btnrow" style="margin-top:12px"><button class="btn ghost" id="dl-makbuz" style="width:100%">Makbuz PDF'e yazdır</button></div>` : ''}
    ${d.tel ? `<div class="btnrow"><button class="btn ghost" id="dl-wa">WhatsApp'tan hatırlat</button></div>` : ''}
  `);

  const ode = $('#dl-ode');
  if (ode) ode.onclick = () => {
    const t = Number($('#dl-tutar').value);
    if (!(t > 0)) return toast('Geçerli bir tutar gir');
    DB.odemeler.push({ id: uid(), daireId, ay, tutar: t, tarih: today() });
    save(); sheetKapat(); renderAll(); toast(`${fmt(t)} tahsil edildi`);
  };
  /* tüm ödeme kayıtlarındaki silme düğmelerini bağla (yalnızca ilki değil) */
  $('#sheet-body').querySelectorAll('[data-sil]').forEach(sil => {
    sil.onclick = () => {
      DB.odemeler = DB.odemeler.filter(x => x.id !== sil.dataset.sil);
      save(); sheetKapat(); renderAll(); toast('Ödeme silindi');
    };
  });
  const aidatBtn = $('#dl-aidat');
  if (aidatBtn) aidatBtn.onclick = () => {
    const yeni = prompt(`Dükkan ${d.no} için aylık aidat (₺):`, String(birimAidat(d)));
    if (yeni === null) return;
    const t = Math.max(0, Number(String(yeni).replace(',', '.')) || 0);
    d.aidat = t; state.dukkanAidat = t;
    save(); sheetKapat(); renderAll(); toast(`Dükkan ${d.no} aidatı ${fmt(t)} olarak güncellendi`);
  };
  const wa = $('#dl-wa');
  if (wa) wa.onclick = () => {
    const tel = d.tel.replace(/[^0-9]/g, '').replace(/^0/, '90');
    const msg = encodeURIComponent(
      `Sayın ${d.ad || 'sakinimiz'}, ${DB.bina || 'binamız'} Daire ${d.no} için ${ayAdi(ay)} ayı aidat borcunuz ${fmt(kalan)} görünmektedir. Bilginize sunarız.`
    );
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
  };
  /* manuel borç ekleme */
  const ekEkle = $('#dl-ek-ekle');
  if (ekEkle) ekEkle.onclick = () => {
    const t = Math.max(0, sayiCoz($('#dl-ek-tutar').value) || 0);
    const acik = ($('#dl-ek-acikla').value || '').trim();
    if (!(t > 0)) return toast('Geçerli bir tutar gir');
    DB.ekBorclar.push({ id: uid(), daireId, tutar: t, aciklama: acik || 'Manuel borç', tarih: today(), odenen: 0 });
    save(); renderAll();
    toast(`${fmt(t)} manuel borç eklendi`);
    aidatDialog(daireId, ay);
  };
  $('#sheet-body').querySelectorAll('[data-ekode]').forEach(b => {
    b.onclick = () => {
      const x = (DB.ekBorclar || []).find(z => z.id === b.dataset.ekode); if (!x) return;
      const kal = Math.max(0, x.tutar - (x.odenen || 0));
      DB.odemeler.push({ id: uid(), daireId, ay, ekBorc: true, aciklama: x.aciklama || 'Manuel borç', tutar: kal, tarih: today() });
      x.odenen = (x.odenen || 0) + kal; x.odenenTarih = today();
      save(); renderAll();
      toast(`${fmt(kal)} manuel borç tahsil edildi`);
      aidatDialog(daireId, ay);
    };
  });
  $('#sheet-body').querySelectorAll('[data-eksil]').forEach(b => {
    b.onclick = () => {
      DB.ekBorclar = DB.ekBorclar.filter(x => x.id !== b.dataset.eksil);
      save(); renderAll(); toast('Manuel borç silindi');
      aidatDialog(daireId, ay);
    };
  });
  /* makbuz PDF */
  const mkb = $('#dl-makbuz');
  if (mkb) mkb.onclick = () => makbuzPdf(daireId, ay);
}

/* ---- GİDER ---- */
$('#btn-gider-ekle').onclick = () => giderDialog(null);
$('#gider-liste').addEventListener('click', e => {
  const it = e.target.closest('[data-gider]');
  if (it) giderDialog(it.dataset.gider);
});

/* gider kalemi önerileri: kayıtlı kalemler + geçmişte yazılanlar */
function kalemOnerileri(ekle) {
  const set = new Set([...DB.turlar, ...DB.giderler.map(g => g.tur).filter(Boolean)]);
  if (ekle) set.add(ekle);
  return [...set];
}

function giderDialog(id) {
  const g = id ? DB.giderler.find(x => x.id === id) : null;
  const ay = g?.ay || state.ayGider;
  sheet(g ? 'Gideri düzenle' : 'Yeni gider', `
    <label class="field"><span>Tutar (₺)</span>
      <input id="gd-tutar" type="number" inputmode="decimal" step="1" min="0" value="${g ? g.tutar : ''}" placeholder="0"></label>
    <label class="field"><span>Kalem <em class="opt">— kendin yazabilirsin</em></span>
      <input id="gd-tur" list="gd-tur-onerileri" value="${esc(g?.tur || '')}" placeholder="Örn. Elektrik, Temizlik, Asansör">
      <datalist id="gd-tur-onerileri">${kalemOnerileri(g?.tur).map(t => `<option value="${esc(t)}">`).join('')}</datalist></label>
    <label class="field"><span>Açıklama</span>
      <input id="gd-aciklama" value="${esc(g?.aciklama || '')}" placeholder="Örn. Ekim elektrik faturası"></label>
    <label class="field"><span>Tarih</span>
      <input id="gd-tarih" type="date" value="${g?.tarih || today()}"></label>
    <button class="btn danger" id="gd-kaydet" style="width:100%">${g ? 'Kaydet' : 'Gider ekle'}</button>
    ${g ? `<div class="btnrow"><button class="btn ghost danger" id="gd-sil">Gideri sil</button></div>` : ''}
  `);
  $('#gd-kaydet').onclick = () => {
    const tutar = Number($('#gd-tutar').value);
    if (!(tutar > 0)) return toast('Geçerli bir tutar gir');
    const tarih = $('#gd-tarih').value || today();
    const tur = $('#gd-tur').value.trim() || 'Diğer';
    const kayit = {
      id: g?.id || uid(), ay: tarih.slice(0, 7),
      tur,
      aciklama: $('#gd-aciklama').value.trim(),
      tutar, tarih
    };
    if (g) DB.giderler = DB.giderler.map(x => x.id === g.id ? kayit : x);
    else DB.giderler.push(kayit);
    // yazılan kalem, kalem listesinde yoksa eklenir
    if (!DB.turlar.includes(tur)) DB.turlar.push(tur);
    save(); sheetKapat(); renderAll(); toast(g ? 'Gider güncellendi' : `${fmt(tutar)} gider eklendi`);
  };
  if (g) $('#gd-sil').onclick = () => {
    DB.giderler = DB.giderler.filter(x => x.id !== g.id);
    save(); sheetKapat(); renderAll(); toast('Gider silindi');
  };
}

/* ---- RAPOR ---- */
$('#rapor-tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab[data-r]'); if (!t) return;
  state.raporTab = t.dataset.r;
  renderRapor();
});
$('#rapor-icerik').addEventListener('click', e => {
  const a = e.target.closest('[data-raporay]');
  if (a) { state.ay = a.dataset.raporay; git('ozet'); }
});
$('#btn-rapor-cikis').onclick = kaydetCik;
$('#btn-rapor-kopyala').onclick = async () => {
  const metin = raporMetni();
  try {
    if (navigator.share) { await navigator.share({ text: metin }); return; }
    await navigator.clipboard.writeText(metin);
    toast("Rapor kopyalandı, WhatsApp'a yapıştırabilirsin");
  } catch (err) {
    if (navigator.clipboard) { try { await navigator.clipboard.writeText(metin); toast('Rapor kopyalandı'); return; } catch (e) {} }
    toast('Kopyalanamadı');
  }
};

/* ---- KAYDET & ÇIK ---- */
['#btn-cikis', '#btn-cikis2', '#btn-cikis3', '#btn-kaydet-cik'].forEach(sel => {
  const el = $(sel); if (el) el.onclick = kaydetCik;
});

/* ---- PDF ÇIKTISI ---- */
$('#btn-pusula').onclick = pusulaPdf;
$('#btn-rapor-pdf').onclick = yonetimRaporuPdf;

/* ---- CSV / EXCEL CIKTISI ---- */
function csvKaydet(dosyaAdi, basliklar, satirlar) {
  const hucre = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const metin = '\ufeff' + [basliklar, ...satirlar].map(r => r.map(hucre).join(';')).join('\r\n');
  const blob = new Blob([metin], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = dosyaAdi;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
$('#btn-csv-odeme').onclick = () => {
  const satirlar = DB.odemeler
    .map(o => ({ o, d: daireBul(o.daireId) }))
    .sort((a, b) => (a.o.ay || '').localeCompare(b.o.ay || '') || noSirala(a.d || {}, b.d || {}))
    .map(x => [x.d ? birimAd(x.d) : 'Silinmiş', x.o.ay ? ayAdi(x.o.ay) : (x.o.ay || ''), x.d?.no || '', x.d?.ad || '', x.o.tutar, fmtTarih(x.o.tarih)]);
  csvKaydet(`aidat-odemeler-${today()}.csv`, ['Tür', 'Ay', 'Daire/Dükkan No', 'Ad', 'Tutar (₺)', 'Ödeme tarihi'], satirlar);
  toast(`${DB.odemeler.length} ödeme CSV olarak indirildi`);
};
$('#btn-csv-gider').onclick = () => {
  const satirlar = [...DB.giderler]
    .sort((a, b) => (a.ay || '').localeCompare(b.ay || ''))
    .map(g => [g.ay ? ayAdi(g.ay) : g.ay, g.tur || 'Diğer', g.aciklama || '', g.tutar, fmtTarih(g.tarih)]);
  csvKaydet(`aidat-giderler-${today()}.csv`, ['Ay', 'Kalem', 'Açıklama', 'Tutar (₺)', 'Tarih'], satirlar);
  toast(`${DB.giderler.length} gider CSV olarak indirildi`);
};

/* ---- GECİKME UYARISI ---- */
/* Aidat günü geçmiş ve bu ay borcunu kapatmamış birimler */
function gecikmeBilgisi(ay = ym()) {
  const gun = new Date().getDate();
  if (ay !== ym() || gun < (DB.aidatGun || 5)) return { liste: [], toplam: 0, gecikmisGun: Math.max(0, gun - (DB.aidatGun || 5)), sen: false };
  const liste = DB.daireler.filter(d => !muafMi(d) && aidatTutar(d, ay) > 0 && Math.max(0, aidatTutar(d, ay) - odenen(d.id, ay)) > 0);
  const toplam = liste.reduce((s, d) => s + Math.max(0, aidatTutar(d, ay) - odenen(d.id, ay)), 0);
  return { liste, toplam, gecikmisGun: gun - (DB.aidatGun || 5), sen: true };
}

function gecikmeCizHtml(d) {
  const g = gecikmeBilgisi();
  const el = document.getElementById('gecikme-uyari');
  if (!el) return;
  if (!g.liste.length || state.ay !== ym()) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  $('#gecikme-tutar').textContent = fmt(g.toplam);
  $('#gecikme-sub').textContent = `${g.liste.length} birim · aidat günü ${g.gecikmisGun} gün önce geçti`;
}

function hatirlatMesaji(d, ay) {
  const kalan = Math.max(0, aidatTutar(d, ay) - odenen(d.id, ay));
  return `Sayın ${d.ad || 'sakinimiz'}, ${DB.bina || 'binamız'} ${birimAd(d).toLowerCase()} ${d.no} için ${ayAdi(ay)} ayı aidat borcunuz ${fmt(kalan)} olarak gecikmiştir. Ödemenizi rica ederiz. — Yönetim`;
}

function hatirlatTelefon(tel) {
  return String(tel || '').replace(/[^0-9]/g, '').replace(/^0/, '90');
}

function hatirlatDialog() {
  const g = gecikmeBilgisi();
  if (!g || !g.liste.length) return toast('Gecikmiş borçlu yok');
  const telsizListe = g.liste.filter(d => d.tel);
  const telsizler = g.liste.filter(d => !d.tel);
  const satir = d => {
    const kalan = Math.max(0, aidatTutar(d, ym()) - odenen(d.id, ym()));
    return `<div class="item">
      <span class="dot no"></span>
      <div class="main"><div class="t1">${birimAd(d)} ${esc(d.no)} · ${esc(d.ad || 'İsim yok')} <span class="tag">${fmt(kalan)}</span></div>
        <div class="t2">${d.tel ? esc(d.tel) : 'Telefon kayıtlı değil'}</div></div>
      ${d.tel ? `<button class="mini" data-wa="${d.id}">Gönder</button>` : ''}
    </div>`;
  };
  const topluMetin = telsizListe.map(d => `${birimAd(d)} ${d.no} · ${d.ad || '—'} (${d.tel})\n${hatirlatMesaji(d, ym())}`).join('\n\n');
  sheet('Geciken aidatlar · toplu hatırlatma', `
    <p class="hint">Aidat günü geçti ve ${g.liste.length} birim bu ayın aidatını ödemedi (toplam <b>${fmt(g.toplam)}</b>). Her birim için kişisel WhatsApp mesajı hazır:</p>
    <div class="list">${g.liste.map(satir).join('')}</div>
    ${telsizler.length ? `<p class="hint">📵 ${telsizler.length} birimde telefon kaydı yok: ${telsizler.map(d => birimAd(d) + ' ' + esc(d.no)).join(', ')} — Daireler ekranından telefon girildiğinde buradan gönderilebilir.</p>` : ''}
    <div class="btnrow">
      <button class="btn ghost" id="hr-kopyala">Tümünü metin olarak kopyala</button>
      <button class="btn ghost" id="hr-kapat">Kapat</button>
    </div>
    <p class="hint">Her satırda **Gönder** düğmesine basın; tarayıcılar tüm WhatsApp linklerini tek seferde açamaz.</p>
  `);
  $('#sheet-body').querySelectorAll('[data-wa]').forEach(btn => {
    btn.onclick = () => {
      const d = daireBul(btn.dataset.wa); if (!d) return;
      const tel = hatirlatTelefon(d.tel);
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(hatirlatMesaji(d, ym()))}`, '_blank');
      toast(`${birimAd(d)} ${d.no} · WhatsApp penceresi açıldı`);
    };
  });
  const kp = $('#hr-kopyala');
  if (kp) kp.onclick = async () => {
    try { await navigator.clipboard.writeText(topluMetin); toast('Tüm hatırlatmalar kopyalandı'); } catch (e) { toast('Kopyalanamadı'); }
  };
  const kapat = $('#hr-kapat');
  if (kapat) kapat.onclick = sheetKapat;
}
$('#btn-hatirlat').onclick = hatirlatDialog;

/* ---- LİSANS ---- */
['#btn-lisans', '#link-lisans'].forEach(sel => {
  const el = $(sel); if (el) el.onclick = lisansDialog;
});

/* ---- BİRİM TİPİ (Daire / Dükkan) ---- */
$('#daire-tabs').addEventListener('click', () => {
  const t = document.querySelector('#daire-tabs .tab.on');
  const ut = $('#unit-tabs');
  const uo = $('#unit-ozet');
  if (ut) ut.style.display = (t && t.dataset.t === 'liste') ? '' : 'none';
  if (uo) uo.style.display = (t && t.dataset.t === 'liste') ? '' : 'none';
});

$('#unit-tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab[data-u]'); if (!t) return;
  state.daireTab = t.dataset.u;
  renderDaire();
});
$('#borc-tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab[data-tip]');
  if (t) { state.borcTip = t.dataset.tip; renderBorc(); }
});

/* ---- BORÇ DURUMU ---- */
$('#borc-tip-tabs').addEventListener('click', e => {
  const tipBtn = e.target.closest('.tab[data-tip]');
  if (tipBtn) { state.borcTip = tipBtn.dataset.tip; renderBorc(); return; }
});
$('#borc-tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab[data-b]'); if (!t) return;
  state.borcTab = t.dataset.b;
  renderBorc();
});
$('#borc-liste').addEventListener('click', e => {
  const b = e.target.closest('[data-borclu]');
  if (b) { borcDialog(b.dataset.borclu); return; }
  const a = e.target.closest('[data-aydetay]');
  if (a) { state.ay = a.dataset.aydetay; git('ozet'); }
});

/* ---- DAİRELER ---- */
$('#btn-daire-ekle').onclick = () => daireDialog(null);
$('#btn-dukkan-toplu').onclick = dukkanTopluEkle;
$('#btn-dukkan-toplu2').onclick = dukkanTopluEkle;
$('#daire-liste').addEventListener('click', e => {
  const it = e.target.closest('[data-daireduzenle]');
  if (it) daireDialog(it.dataset.daireduzenle);
});

function daireDialog(id) {
  const d = id ? daireBul(id) : null;
  const tip = d ? (d.tip || 'daire') : (state.daireTab === 'dukkan' ? 'dukkan' : 'daire');
  const soz = tip === 'dukkan' ? 'Dükkan' : 'Daire';
  const ayni = DB.daireler.filter(x => (x.tip || 'daire') === tip);
  const sonraki = (Math.max(0, ...ayni.map(x => Number(x.no) || 0)) + 1);
  sheet(d ? `${soz} kaydını düzenle` : `Yeni ${soz.toLowerCase()}`, `
    <label class="field"><span>${soz} no <em class="opt">${tip === 'dukkan' ? '— harf, tire, kesir serbest (ör. 1/A, 2, 3B)' : ''}</em></span>
      <input id="dr-no" value="${esc(d?.no ?? sonraki)}" ${tip === 'dukkan' ? 'type="text"' : 'inputmode="numeric"'}
        placeholder="${tip === 'dukkan' ? 'Örn. 1/A' : ''}"></label>
    <label class="field"><span>${tip === 'dukkan' ? 'Dükkan / kiracı adı' : 'Sakin adı'}</span>
      <input id="dr-ad" value="${esc(d?.ad || '')}" placeholder="${tip === 'dukkan' ? 'Örn. Market' : 'Ad Soyad'}"></label>
    <label class="field"><span>Aylık aidat (₺) <em class="opt">${tip === 'dukkan' ? '— sadece bu dükkan' : '— boş bırakırsan genel aidat'}</em></span>
      <input id="dr-aidat" type="number" inputmode="decimal" step="0.01" min="0"
        value="${d ? (tip === 'dukkan' ? (d.aidat ?? '') : ((d.aidat !== undefined && d.aidat !== null && d.aidat !== '') ? d.aidat : '')) : (tip === 'dukkan' ? (state.dukkanAidat ?? '') : '')}"
        placeholder="${tip === 'dukkan' ? 'Örn. 1750' : String(DB.aidat || 0)}"></label>
    ${tip === 'dukkan' && !d ? `<label class="check" style="margin-top:-4px">
      <input type="checkbox" id="dr-tumune">
      <span>Bu tutarı tüm dükkanlara uygula <small>İşaretlemezsen tutar yalnızca bu dükkana yazılır; her dükkanın fiyatı ayrı olabilir</small></span>
    </label>` : ''}
    <label class="field"><span>Telefon</span>
      <input id="dr-tel" type="tel" value="${esc(d?.tel || '')}" placeholder="05xx xxx xx xx"></label>
    <label class="check">
      <input type="checkbox" id="dr-muaf" ${d?.muaf ? 'checked' : ''}>
      <span>Aidattan muaf <small>${tip === 'dukkan' ? 'Dükkan aidat ödemiyorsa işaretle' : 'Yönetici dairesi vb. — borç ve bekleyen tutara dahil edilmez'}</small></span>
    </label>
    <button class="btn" id="dr-kaydet" style="width:100%">${d ? 'Kaydet' : soz + ' ekle'}</button>
    ${d ? `<div class="btnrow"><button class="btn ghost danger" id="dr-sil">${soz} kaydını sil</button></div>` : ''}
  `);
  $('#dr-kaydet').onclick = () => {
    const no = $('#dr-no').value.trim();
    if (!no) return toast(`${soz} no gir`);
    const cakisan = DB.daireler.find(x => (x.tip || 'daire') === tip && x.no.toLocaleLowerCase('tr') === no.toLocaleLowerCase('tr') && x.id !== d?.id);
    if (cakisan) return toast(`Bu numara zaten var: ${soz} ${no}`);
    const aidatDeger = $('#dr-aidat').value.trim();
    /* Dairede aidat boş → genel aidat uygulanır (özel aidat kaydedilmez).
       Dükkan boş → eski değer korunur/yeni ise 0. */
    let kayitAidat;
    if (aidatDeger === '') {
      kayitAidat = tip === 'dukkan' ? (d ? (Number(d.aidat) || 0) : 0) : undefined;
    } else {
      kayitAidat = Math.max(0, Number(String(aidatDeger).replace(',', '.').replace(/\s/g, '')) || 0);
    }
    const kayit = {
      id: d?.id || uid(), tip, no, ad: $('#dr-ad').value.trim(), tel: $('#dr-tel').value.trim(),
      muaf: $('#dr-muaf').checked,
      aidat: kayitAidat
    };
    if (d) DB.daireler = DB.daireler.map(x => x.id === d.id ? kayit : x);
    else DB.daireler.push(kayit);
    if (tip === 'dukkan') {
      const tumune = $('#dr-tumune') && $('#dr-tumune').checked;
      if (tumune) {
        DB.daireler.forEach(x => { if (x.tip === 'dukkan') x.aidat = kayit.aidat; });
      } else if (!d) {
        state.dukkanAidat = kayit.aidat;
      }
    }
    save(); sheetKapat(); renderAll();
    toast(d ? `${soz} güncellendi` : `${soz} eklendi${tip === 'dukkan' ? ' · aylık ' + fmt(kayit.aidat) : ''}`);
  };
  if (d) $('#dr-sil').onclick = () => {
    if (!confirm(`${birimAd(d)} ${d.no} ve tüm ödeme kayıtları silinsin mi?`)) return;
    DB.daireler = DB.daireler.filter(x => x.id !== d.id);
    DB.odemeler = DB.odemeler.filter(o => o.daireId !== d.id);
    save(); sheetKapat(); renderAll(); toast(`${birimAd(d)} silindi`);
  };
}

/* sekmeler */
$('#daire-tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab'); if (!t) return;
  document.querySelectorAll('#daire-tabs .tab').forEach(x => x.classList.toggle('on', x === t));
  const k = t.dataset.t;
  $('#daire-liste').hidden = k !== 'liste';
  $('#daire-giderler').hidden = k !== 'giderler';
  $('#daire-ayarlar').hidden = k !== 'ayarlar';
});

/* gider kalemleri */
$('#btn-tur-ekle').onclick = () => {
  const t = prompt('Yeni gider kalemi adı (birden fazlaysa virgülle ayır):', '');
  if (t === null) return;
  const adlar = t.split(',').map(x => x.trim()).filter(Boolean);
  if (!adlar.length) return;
  adlar.forEach(ad => { if (!DB.turlar.includes(ad)) DB.turlar.push(ad); });
  save(); renderDaire(); toast(`${adlar.length} kalem eklendi`);
};
$('#btn-tur-temizle').onclick = () => {
  if (!DB.turlar.length) return toast('Liste zaten boş');
  if (!confirm('Kalem listesi tamamen boşaltılsın mı?\n\nGider kayıtların ve geçmiş tutarların silinmez; sadece listedeki kalemler kaldırılır. Bundan sonra kalemleri kendin yazabilirsin.')) return;
  DB.turlar = [];
  save(); renderDaire(); toast('Kalem listesi temizlendi — artık kendin yazabilirsin');
};
$('#tur-liste').addEventListener('click', e => {
  const c = e.target.closest('[data-tursil]'); if (!c) return;
  const ad = c.dataset.tursil;
  if (!confirm(`"${ad}" kalemi listeden kaldırılsın mı?`)) return;
  DB.turlar = DB.turlar.filter(x => x !== ad);
  save(); renderDaire();
});

/* ayarlar */
$('#btn-muaf-sec').onclick = () => muafDialog();
$('#muaf-liste').addEventListener('click', e => {
  const c = e.target.closest('[data-muafsil]'); if (!c) return;
  const d = daireBul(c.dataset.muafsil); if (!d) return;
  d.muaf = false; save(); renderDaire(); toast(`${birimAd(d)} ${d.no} artık aidat ödüyor`);
});

/* Birden fazla dükkanı tek seferde ekleme */
function dukkanTopluEkle() {
  const sonraki = Math.max(0, ...DB.daireler.filter(x => x.tip === 'dukkan').map(x => Number(x.no) || 0)) + 1;
  sheet('Dükkanları topluca ekle', `
    <p class="hint">Her satıra bir dükkan yaz. İstersen fiyatı da ekle:<br>
      <b>1/A Market 1500</b> · <b>2 Eczane 1200,50</b> · <b>3B Kafe</b> (fiyat yazmazsan varsayılan uygulanır)</p>
    <label class="field"><span>Dükkanlar</span>
      <textarea id="toplu-metin" rows="6" placeholder="1/A Market 1500&#10;2 Eczane 1200&#10;3B Kafe 2200"></textarea></label>
    <label class="field"><span>Fiyat yazılmayanlara uygulanacak aylık aidat (₺)</span>
      <input id="toplu-aidat" type="number" inputmode="decimal" step="0.01" min="0"
        value="${state.dukkanAidat ?? ''}" placeholder="Örn. 1500"></label>
    <label class="field"><span>Başlangıç numarası (boş satır/no için)</span>
      <input id="toplu-bas" type="number" inputmode="numeric" min="1" value="${sonraki}"></label>
    <button class="btn" id="toplu-ekle" style="width:100%">Dükkanları ekle</button>
  `);
  $('#toplu-ekle').onclick = () => {
    const satirlar = $('#toplu-metin').value.split('\n').map(x => x.trim()).filter(Boolean);
    if (!satirlar.length) return toast('En az bir dükkan yaz');
    const varsayilan = isFinite(sayiCoz($('#toplu-aidat').value)) ? Math.max(0, sayiCoz($('#toplu-aidat').value)) : 0;
    let no = Math.max(1, Number($('#toplu-bas').value) || sonraki);
    let eklenen = 0, atlanan = 0;
    satirlar.forEach(satir => {
      // sadece sayı yazılmışsa o bir no'dur; aksi halde ilk kelime no kabul edilir
      let parcalar = satir.split(/\s+/);
      let noDeger, kalan;
      if (parcalar.length === 1 && !isFinite(sayiCoz(parcalar[0]))) {
        noDeger = String(no++); kalan = parcalar;
      } else {
        noDeger = parcalar.shift(); kalan = parcalar;
      }
      // sonda fiyat var mı?
      let aidat = varsayilan;
      if (kalan.length) {
        const son = kalan[kalan.length - 1].replace(/[^0-9.,]/g, '');
        if (son && isFinite(sayiCoz(son))) { aidat = Math.max(0, sayiCoz(son)); kalan.pop(); }
      }
      const ad = kalan.join(' ').trim();
      const varMi = DB.daireler.some(x => x.tip === 'dukkan' && String(x.no).toLocaleLowerCase('tr') === String(noDeger).toLocaleLowerCase('tr'));
      if (varMi) { atlanan++; return; }
      DB.daireler.push({ id: uid(), tip: 'dukkan', no: String(noDeger), ad, tel: '', muaf: false, aidat });
      eklenen++;
    });
    save(); sheetKapat(); renderAll();
    toast(`${eklenen} dükkan eklendi${atlanan ? ' · ' + atlanan + ' zaten vardı' : ''}`);
  };
}

function muafDialog() {
  if (!DB.daireler.length) return toast('Önce daire ekle');
  const rows = [...DB.daireler].sort((a, b) => noSirala(a, b));
  sheet('Aidattan muaf daireler', `
    <p class="hint">İşaretlediğin daireler (örn. yönetici dairesi) hiçbir ay için borçlu sayılmaz.</p>
    <div class="list">${rows.map(d => `
      <label class="item" style="cursor:pointer">
        <input type="checkbox" class="muaf-cb" value="${d.id}" ${d.muaf ? 'checked' : ''}
          style="width:20px;height:20px;flex:none;accent-color:#0f2a43">
        <div class="main"><div class="t1">${birimAd(d)} ${esc(d.no)}${d.tip === 'dukkan' ? ' <span class="tag aidat-tag">' + fmt(birimAidat(d)) + '/ay</span>' : ''}</div>
          <div class="t2">${esc(d.ad || 'İsim yok')}</div></div>
      </label>`).join('')}</div>
    <button class="btn" id="muaf-kaydet" style="width:100%;margin-top:14px">Kaydet</button>
  `);
  $('#muaf-kaydet').onclick = () => {
    const secili = new Set([...document.querySelectorAll('.muaf-cb:checked')].map(x => x.value));
    DB.daireler.forEach(d => { d.muaf = secili.has(d.id); });
    save(); sheetKapat(); renderAll(); toast('Muaf listesi güncellendi');
  };
}

$('#btn-ayar-kaydet').onclick = () => {
  DB.bina = $('#set-bina').value.trim();
  DB.aidat = Math.max(0, Number($('#set-aidat').value) || 0);
  DB.aidatGun = Math.min(28, Math.max(1, Number($('#set-gun').value) || 5));
  DB.devredenKasa = Number($('#set-kasa').value) || 0;
  save(); profilAdGuncelle(); renderAll(); toast('Ayarlar kaydedildi');
};

/* yıllık aidat geçmişi */
$('#btn-yil-ekle').onclick = () => {
  const ys = prompt('Hangi yıl? (ör. 2026):', String(new Date().getFullYear()));
  if (ys === null) return;
  const yil = parseInt(ys, 10);
  if (!(yil >= 2000 && yil <= 2100)) return toast('Geçerli bir yıl gir (ör. 2026)');
  const ts = prompt(`${yil} yılında aylık genel aidat ne tutardaydı? (₺):`, String(DB.aidat || ''));
  if (ts === null) return;
  const tutar = Math.max(0, sayiCoz(ts) || 0);
  DB.aidatYillari = (DB.aidatYillari || []).filter(x => x.yil !== yil);
  DB.aidatYillari.push({ yil, tutar });
  if (yil === new Date().getFullYear()) DB.aidat = tutar;
  save(); renderAll(); toast(`${yil}: aylık ${fmt(tutar)} aidat kaydedildi`);
};
$('#aidat-yil-liste').addEventListener('click', e => {
  const c = e.target.closest('[data-yilsil]');
  if (!c) return;
  const yil = Number(c.dataset.yilsil);
  if (!confirm(`${yil} yılını aidat geçmişinden çıkarmak istiyor musun?`)) return;
  DB.aidatYillari = (DB.aidatYillari || []).filter(x => x.yil !== yil);
  save(); renderAll(); toast('Yıl silindi');
});

/* bina seçimi / çoklu bina */
$('#ozet-bina').onclick = binaSecimDialog;
$('#btn-bina-yeni').onclick = yeniBinaEkle;
$('#bina-liste').addEventListener('click', e => {
  const c = e.target.closest('[data-binagec]');
  if (c) binaGec(c.dataset.binagec);
});

/* yedek: tüm binaları tek dosyada paketle (elediğimiz elle + bulut otomatik yedek aynı paket) */
async function yedekPaketi() {
  const paket = { coklu: true, aktif: PRO.aktif, binalar: [] };
  for (const b of PRO.binalar) {
    let veri = null;
    if (b.id === PRO.aktif) veri = DB;
    else { try { const n = JSON.parse(localStorage.getItem(profilKey(b.id))); veri = (n && n['@enc']) ? await sifreCoz(n) : n; } catch (e2) { veri = null; } }
    paket.binalar.push({ id: b.id, ad: b.ad || (veri && veri.bina) || 'Bina', veri });
  }
  return paket;
}
$('#btn-yedek').onclick = async () => {
  const r = await yedegiCibasele(await yedekPaketi());
  toast(r.ok ? `Yedek alındı: ${r.nereye}` : 'Yedek alınamadı');
};
$('#btn-geri-yukle').onclick = () => $('#dosya').click();
$('#dosya').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const d = JSON.parse(r.result);
      if (d && d.coklu && Array.isArray(d.binalar) && d.binalar.length) {
        /* çoklu bina yedeği */
        PRO = {
          aktif: d.aktif || d.binalar[0].id,
          binalar: d.binalar.map(b => ({ id: b.id || uid(), ad: (b.veri && b.veri.bina) || b.ad || 'Bina' }))
        };
        if (!PRO.binalar.some(b => b.id === PRO.aktif)) PRO.aktif = PRO.binalar[0].id;
        profiliKaydet();
        for (const b of d.binalar) {
          if (b.veri && Array.isArray(b.veri.daireler)) await profilYaz(b.id, normalize(b.veri));
        }
        DB = await yukle(); profilAdGuncelle();
        renderAll(); toast(`Yedek geri yüklendi — ${PRO.binalar.length} bina`);
      } else if (Array.isArray(d.daireler)) {
        /* eski tek-bina yedeği: aktif binaya uygula */
        await kaliciKaydet(normalize(d)); profilAdGuncelle();
        renderAll(); toast('Yedek geri yüklendi');
      } else throw new Error('geçersiz');
    } catch (err) { toast('Dosya okunamadı'); }
    e.target.value = '';
  };
  r.readAsText(f);
};
$('#btn-ornek').onclick = () => {
  if (!confirm('Mevcut veriler örnek veriyle değiştirilsin mi?')) return;
  save(ornekVeri()); renderAll(); toast('Örnek veri yüklendi');
};
$('#btn-sifirla').onclick = () => {
  if (!confirm('Tüm veriler silinsin mi?\n\nDaireler, dükkanlar, ödemeler, giderler ve gider kalemleri silinir. Bu işlem geri alınamaz.')) return;
  save(BOS_VERI());
  renderAll(); toast('Tüm veriler ve gider kalemleri silindi');
};

/* ---------------- güvenlik (PIN + şifreleme) ---------------- */
$('#btn-pin-kur').onclick = async () => {
  const p1 = prompt('Yeni PIN (4-6 haneli):', '');
  if (p1 === null) return;
  if (!/^\d{4,6}$/.test(p1)) return toast('PIN 4-6 hane olmalı');
  const p2 = prompt('PIN\'i tekrar girin:', '');
  if (p2 === null) return;
  if (p2 !== p1) return toast('PINler eşleşmedi');
  const tuz = baytb64(crypto.getRandomValues(new Uint8Array(16)));
  PRO.guvenlik = { pinHash: await pinHashHex(p1, tuz), tuz };
  oturumAnahtari = await anahtarUret(p1, tuz);
  profiliKaydet();
  for (const b of PRO.binalar) {
    let ham = localStorage.getItem(profilKey(b.id));
    if (b.id === PRO.aktif && !ham) ham = JSON.stringify(DB);
    if (!ham) continue;
    try { const n = JSON.parse(ham); await profilYaz(b.id, (n && n['@enc']) ? await sifreCoz(n) : n); } catch (e) {}
  }
  toast('PIN kuruldu — veriler artık şifreli saklanıyor');
  guvenlikDurumCiz(); renderDaire();
};
$('#btn-pin-kaldir').onclick = async () => {
  if (!(PRO.guvenlik && oturumAnahtari)) return toast('PIN zaten kurulu değil');
  const p = prompt('Mevcut PIN:', '');
  if (p === null) return;
  const h = await pinHashHex(p, PRO.guvenlik.tuz);
  if (h !== PRO.guvenlik.pinHash) return toast('PIN yanlış');
  for (const b of PRO.binalar) {
    const ham = localStorage.getItem(profilKey(b.id));
    if (ham) { try { await profilYazDuz(b.id, await sifreCoz(JSON.parse(ham))); } catch (e) { /* şifresiz veri olabilir, silinmez */ } }
  }
  PRO.guvenlik = null; oturumAnahtari = null; profiliKaydet();
  toast('PIN kaldırıldı — veriler şifresiz saklanıyor');
  guvenlikDurumCiz(); renderDaire();
};

function guvenlikDurumCiz() {
  const pk = $('#pin-durum');
  if (pk) pk.textContent = PRO.guvenlik
    ? '🔒 PIN aktif — veriler AES-256 ile şifreli saklanıyor.'
    : '🔓 PIN kurulmamış — veriler şifresiz saklanıyor.';
  const bs = $('#bulut-siklik');
  if (bs) bs.value = bulutAyar().mod;
  const bd = $('#bulut-durum');
  if (bd) {
    const a = bulutAyar();
    const son = a.son ? `${fmtTarih(a.son.slice(0, 10))} ${a.son.slice(11, 16)}` : 'hiç';
    bd.textContent = `Son yedek: ${son} · ${klasorAdi ? ('hedef klasör: ' + klasorAdi) : 'hedef klasör seçilmemiş'}`;
  }
}

/* ---------------- otomatik bulut yedeği ---------------- */
const BULUT_AYAR_KEY = 'aidat-bulut-v1';
let klasorTutamac = null, klasorAdi = '';
function bulutAyar() {
  let a = null;
  try { a = JSON.parse(localStorage.getItem(BULUT_AYAR_KEY)); } catch (e) { a = null; }
  if (!a || typeof a !== 'object') a = { mod: 'haftalik', son: null };
  if (!['kapali', 'gunluk', 'haftalik'].includes(a.mod)) a.mod = 'haftalik';
  return a;
}
function bulutAyarKaydet(a) { try { localStorage.setItem(BULUT_AYAR_KEY, JSON.stringify(a)); } catch (e) {} }

async function idbIslem(mod, fn) {
  return new Promise((res, rej) => {
    const rq = indexedDB.open('AidatYedek', 1);
    rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains('s')) rq.result.createObjectStore('s'); };
    rq.onsuccess = () => {
      const db = rq.result;
      try { const tx = db.transaction('s', mod); const cikis = fn(tx.objectStore('s')); tx.oncomplete = () => { db.close(); res(cikis && cikis.result !== undefined ? cikis.result : cikis); }; tx.onerror = () => { db.close(); rej(tx.error); }; }
      catch (e) { db.close(); rej(e); }
    };
    rq.onerror = () => rej(rq.error);
  });
}
async function tutamacGetir() {
  if (klasorTutamac) return klasorTutamac;
  try {
    const h = await idbIslem('readonly', s => s.get('klasor'));
    if (h) { klasorTutamac = h; klasorAdi = h.name; await h.requestPermission({ mode: 'readwrite' }).catch(() => {}); }
  } catch (e) {}
  return klasorTutamac;
}
async function tutamacKaydet(h) {
  klasorTutamac = h; klasorAdi = h.name;
  await idbIslem('readwrite', s => s.put(h, 'klasor'));
}

async function yedegiCibasele(paket) {
  const icerik = JSON.stringify(paket, null, 2);
  const ad = `aidat-yedek-${today()}.json`;
  if (klasorTutamac) {
    try {
      const f = await klasorTutamac.getFileHandle(ad, { create: true });
      const w = await f.createWritable();
      await w.write(new Blob([icerik]));
      await w.close();
      return { ok: true, nereye: `${klasorAdi}/${ad}` };
    } catch (e) { /* klasör silindi → indirmeye düş */ }
  }
  try {
    const blob = new Blob([icerik], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ad;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    return { ok: true, nereye: 'tarayıcı indirme klasörü' };
  } catch (e) { return { ok: false }; }
}

async function bulutKaydiDoldur() {
  const a = bulutAyar();
  a.son = new Date().toISOString();
  bulutAyarKaydet(a);
}

async function otomatikYedekKontrol() {
  const a = bulutAyar();
  if (a.mod === 'kapali') return;
  const sonZaman = a.son ? new Date(a.son).getTime() : 0;
  const SINIR = a.mod === 'gunluk' ? 24 * 3600e3 : 7 * 24 * 3600e3;
  if (sonZaman && (Date.now() - sonZaman) < SINIR) return;
  await tutamacGetir();
  const r = await yedegiCibasele(await yedekPaketi());
  if (r.ok) { await bulutKaydiDoldur(); toast(`Otomatik bulut yedeği: ${r.nereye}`); }
  guvenlikDurumCiz();
}

$('#btn-bulut-klasor').onclick = async () => {
  if (!window.showDirectoryPicker) return toast('Bu tarayıcı klasör seçmeyi desteklemiyor; yedekler açılışta otomatik indirilir');
  try {
    const h = await window.showDirectoryPicker({ id: 'aidat-yedek', mode: 'readwrite', startIn: 'documents' });
    await tutamacKaydet(h);
    const a = bulutAyar();
    if (a.mod === 'kapali') { a.mod = 'haftalik'; bulutAyarKaydet(a); }
    toast(`Hedef klasör: ${h.name}`);
    guvenlikDurumCiz(); renderDaire();
  } catch (e) { /* iptal edildi */ }
};
$('#btn-bulut-simdi').onclick = async () => {
  await tutamacGetir();
  const r = await yedegiCibasele(await yedekPaketi());
  if (r.ok) { await bulutKaydiDoldur(); toast(`Yedek alındı: ${r.nereye}`); }
  else toast('Yedek alınamadı');
  guvenlikDurumCiz();
};
$('#bulut-siklik').onchange = e => {
  const a = bulutAyar(); a.mod = e.target.value; bulutAyarKaydet(a);
  toast('Otomatik yedek: ' + e.target.value);
};

/* ---------------- kilit ekranı ---------------- */
function kilitEkran(pinHash, tuz) {
  $('#kilit').hidden = false;
  return new Promise(resolve => {
    let girilen = '';
    const mesaj = $('#kilit-mesaj'), dots = $('#kilit-dots');
    const ciz = () => { dots.textContent = girilen ? '●'.repeat(girilen.length) : '····'; };
    ciz();
    $('#kilit-tuslar').querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        const v = b.dataset.tus;
        if (v === 'sil') { girilen = girilen.slice(0, -1); ciz(); mesaj.textContent = ''; return; }
        if (v === 'ok') {
          if (girilen.length < 4) { mesaj.textContent = 'En az 4 hane girin.'; return; }
          pinHashHex(girilen, tuz).then(h => {
            if (h === pinHash) { $('#kilit').hidden = true; resolve(girilen); }
            else { mesaj.textContent = 'PIN yanlış, tekrar deneyin.'; girilen = ''; ciz(); }
          });
          return;
        }
        if (girilen.length < 8) { girilen += v; ciz(); mesaj.textContent = ''; }
      };
    });
  });
}

/* ---------------- başlat ---------------- */
(async function baslat() {
  PRO = proYukle();
  if (PRO.guvenlik && PRO.guvenlik.pinHash) {
    try { oturumAnahtari = await anahtarUret(await kilitEkran(PRO.guvenlik.pinHash, PRO.guvenlik.tuz), PRO.guvenlik.tuz); }
    catch (e) { PRO.guvenlik = null; profiliKaydet(); }
  }
  DB = await yukle();
  kayitDurumCiz();
  lisansKisa();
  renderAll();
  git('ozet');
  otomatikYedekKontrol();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
