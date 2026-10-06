// WhatsApp Grup Botu — Excel/CSV'deki numaraları seçilen WhatsApp grubuna tek tek ekler.
// Kullanım: baslat.bat'a çift tıkla (ya da: node bot.js). Her şeyi adım adım sorar.

const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const ExcelJS = require('exceljs');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, GroupChat } = require('whatsapp-web.js');

const KLASOR = __dirname;
const OTURUM_DOSYASI = path.join(KLASOR, 'oturumlar.json');
const RAPOR_KLASORU = path.join(KLASOR, 'raporlar');

// Gelişmiş ayarlar (config.json'da yoksa bu varsayılanlar kullanılır)
const AYARLAR = {
  partiBoyutu: 1,
  beklemeMinSaniye: 60,
  beklemeMaxSaniye: 150,
  calistirmaBasinaLimit: 25,
  tarayici: '',
  ...(fs.existsSync(path.join(KLASOR, 'config.json'))
    ? JSON.parse(fs.readFileSync(path.join(KLASOR, 'config.json'), 'utf8'))
    : {}),
};

const bekle = (sn) => new Promise((r) => setTimeout(r, sn * 1000));
// min-max arası rastgele bekler; sabit aralıklı işlemler bot gibi görünür
const rastgeleBekle = (min, max) => bekle(min + Math.random() * (max - min));

// İlk girişten sonra WhatsApp Web sayfayı bir kez yeniler; o sırada yapılan
// işlemler "Execution context was destroyed" hatası verir. Bekleyip tekrar dener.
async function tekrarDene(fn, deneme = 5) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const gecici = /Execution context was destroyed|Target closed|detached Frame/i.test(e.message);
      if (!gecici || i >= deneme) throw e;
      console.log('WhatsApp Web sayfası yenileniyor, bekleniyor...');
      await bekle(10);
    }
  }
}

// --- Terminal soruları --------------------------------------------------------
let rl;
const sor = async (soru) => (await rl.question(soru)).trim();

async function sec(baslik, secenekler) {
  console.log(`\n${baslik}`);
  secenekler.forEach((s, i) => console.log(`  ${i + 1}) ${s}`));
  for (;;) {
    const c = parseInt(await sor('Seçimin (numarasını yaz): '), 10);
    if (c >= 1 && c <= secenekler.length) return c - 1;
    console.log('Geçersiz seçim, tekrar dene.');
  }
}

async function evetMi(soru) {
  const c = (await sor(`${soru} (E/H): `)).toLocaleLowerCase('tr');
  return c === 'e' || c === 'evet';
}

// --- Dosya okuma --------------------------------------------------------------
async function sayfayiAc(dosya) {
  const wb = new ExcelJS.Workbook();
  if (dosya.toLowerCase().endsWith('.csv')) {
    // Google Sheets CSV'si virgülle, Türkçe Excel'in CSV'si noktalı virgülle ayrılır
    const ilkSatir = fs.readFileSync(dosya, 'utf8').split(/\r?\n/)[0];
    const ayirici = (ilkSatir.match(/;/g) || []).length > (ilkSatir.match(/,/g) || []).length ? ';' : ',';
    return wb.csv.readFile(dosya, { parserOptions: { delimiter: ayirici } });
  }
  return (await wb.xlsx.readFile(dosya)).worksheets[0];
}

function basliklariAl(ws) {
  return ws.getRow(1).values.map((v) => String(v?.text ?? v ?? '').trim());
}

function numaralariOku(ws, sutun) {
  const numaralar = new Map(); // normalize numara -> ham değer
  const hatalilar = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const cell = row.getCell(sutun).value;
    const ham = String(cell?.text ?? cell?.result ?? cell ?? '').trim();
    if (!ham) return;
    const n = normalizeEt(ham);
    if (n) numaralar.set(n, ham);
    else hatalilar.push(ham);
  });
  return { numaralar, hatalilar };
}

// Türkiye numaralarını 905XXXXXXXXX biçimine çevirir; yabancı numaraları
// ülke koduyla (+ veya 00 ile) yazılmışsa olduğu gibi kabul eder.
function normalizeEt(ham) {
  const yabanci = /^\s*(\+|00)/.test(ham);
  let d = ham.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('05')) d = '9' + d;   // 05xx -> 905xx
  else if (d.length === 10 && d.startsWith('5')) d = '90' + d; // 5xx  -> 905xx
  if (d.length === 12 && d.startsWith('905')) return d;
  if (yabanci && d.length >= 8 && d.length <= 15) return d;
  return null;
}

// --- Oturumlar (hangi WhatsApp numarası) --------------------------------------
const oturumlariOku = () => (fs.existsSync(OTURUM_DOSYASI) ? JSON.parse(fs.readFileSync(OTURUM_DOSYASI, 'utf8')) : {});
const oturumlariYaz = (o) => fs.writeFileSync(OTURUM_DOSYASI, JSON.stringify(o, null, 2));
const numaraGoster = (n) => (n?.startsWith('90') && n.length === 12 ? `+90 ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8, 10)} ${n.slice(10)}` : `+${n}`);

function tarayiciBul() {
  if (AYARLAR.tarayici) return AYARLAR.tarayici;
  const adaylar = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ];
  return adaylar.find((p) => fs.existsSync(p));
}

async function oturumSec() {
  const oturumlar = oturumlariOku();
  const idler = Object.keys(oturumlar);
  const secenekler = [
    ...idler.map((id) => `${numaraGoster(oturumlar[id].numara)} ile devam et`),
    'Yeni bir WhatsApp numarası bağla (QR okutacaksın)',
  ];
  if (idler.length) secenekler.push('Kayıtlı bir numaranın bağlantısını kaldır');

  const c = await sec('Hangi WhatsApp numarasıyla ekleme yapılacak?', secenekler);
  if (c < idler.length) return { clientId: idler[c], yeni: false };
  if (c === idler.length) return { clientId: `kullanici-${Date.now()}`, yeni: true };

  // Bağlantı kaldırma
  const k = await sec('Hangi numaranın bağlantısı kaldırılsın?', idler.map((id) => numaraGoster(oturumlar[id].numara)));
  fs.rmSync(path.join(KLASOR, '.wwebjs_auth', `session-${idler[k]}`), { recursive: true, force: true });
  delete oturumlar[idler[k]];
  oturumlariYaz(oturumlar);
  console.log('Kaldırıldı. Telefonda da WhatsApp > Bağlı cihazlar bölümünden bu bilgisayarın oturumunu kapatmayı unutma.');
  return oturumSec();
}

async function baglan({ clientId, yeni }) {
  const tarayici = tarayiciBul();
  if (!tarayici) throw new Error('Bilgisayarda Chrome ya da Edge bulunamadı. Chrome kur, ya da config.json\'a "tarayici" yolunu yaz.');

  const client = new Client({
    authStrategy: new LocalAuth({ clientId }),
    // Yeni numarada QR, açılan Chrome penceresinde okutulur; kayıtlı numarada pencere gizli çalışır
    puppeteer: { headless: !yeni, executablePath: tarayici },
  });
  client.on('qr', (qr) => {
    if (yeni) {
      console.log('\nAçılan Chrome penceresindeki QR kodu telefonda WhatsApp > Bağlı cihazlar > Cihaz bağla ile okut.');
    } else {
      console.log('\nBu numaranın oturumu sona ermiş. Aşağıdaki QR kodu WhatsApp > Bağlı cihazlar > Cihaz bağla ile okut:');
      qrcode.generate(qr, { small: true });
    }
  });
  client.on('auth_failure', (m) => console.error('Giriş başarısız:', m));

  console.log('\nWhatsApp\'a bağlanılıyor (1-2 dakika sürebilir)...');
  await new Promise((resolve) => { client.once('ready', resolve); client.initialize(); });

  const numara = client.info.wid.user;
  const oturumlar = oturumlariOku();
  oturumlar[clientId] = { numara };
  oturumlariYaz(oturumlar);
  console.log(`Bağlandı: ${numaraGoster(numara)}`);
  console.log('Sohbetlerin yüklenmesi bekleniyor...');
  await bekle(15);
  return client;
}

// --- Grup seçimi --------------------------------------------------------------
// whatsapp-web.js'in getChats/getChatById'si WhatsApp Web'in güncel sürümünde kararsız,
// bu yüzden gruplar doğrudan WhatsApp Web'in sohbet listesinden okunur.
// guncelleId verilirse o grubun üye listesi önce WhatsApp sunucusundan tazelenir
// (bu bilgisayardaki kopya eski kalmış olabilir).
function gruplariAl(client, guncelleId) {
  return tekrarDene(() => client.pupPage.evaluate(async (guncelleId) => {
    if (guncelleId) {
      await window.require('WAWebGroupQueryJob')
        .queryAndUpdateGroupMetadataById({ id: window.require('WAWebWidFactory').createWid(guncelleId) });
    }
    const api = window.require('WAWebApiContact');
    const prefs = window.require('WAWebUserPrefsMeUser');
    // Kendi kimliğim hem telefon hem "lid" biçiminde olabilir
    const benIdler = [prefs.getMaybeMeUser?.(), prefs.getMaybeMeLidUser?.()].filter(Boolean).map((w) => w._serialized);
    // Üye kimlikleri "lid" biçiminde olabilir; mümkünse telefon numarası biçimine çevir
    const tel = (w) => {
      try { return (w.server === 'lid' ? api.getPhoneNumber(w) : w)?._serialized || w._serialized; } catch { return w._serialized; }
    };
    return window.require('WAWebCollections').Chat.getModelsArray()
      .filter((c) => c.id?.server === 'g.us' && (!guncelleId || c.id._serialized === guncelleId))
      .map((c) => {
        const katilimcilar = c.groupMetadata?.participants?.getModelsArray?.() || [];
        const ben = katilimcilar.find((p) => benIdler.includes(p.id?._serialized));
        return {
          id: c.id._serialized,
          ad: c.formattedTitle || c.name || '(adsız grup)',
          benAdmin: !!(ben?.isAdmin || ben?.isSuperAdmin),
          uyeler: katilimcilar.map((p) => tel(p.id)),
        };
      });
  }, guncelleId));
}

async function grupSec(client) {
  for (;;) {
    console.log('\nÜyelerin ekleneceği grubu seçelim. (Bot grup kuramaz; grubu önce telefondan kurmuş olman gerekir.)');
    const aranan = (await sor('Grup adından bir parça yaz (hepsini görmek için boş bırakıp Enter): ')).toLocaleLowerCase('tr');
    const gruplar = (await gruplariAl(client))
      .filter((g) => g.ad.toLocaleLowerCase('tr').includes(aranan))
      .filter((g) => g.benAdmin)
      .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));

    if (!gruplar.length) {
      console.log('Yönetici olduğun ve bu adla eşleşen bir grup bulunamadı. Grubu yeni kurduysan birkaç saniye bekleyip tekrar dene.');
      continue;
    }
    const gosterilen = gruplar.slice(0, 30);
    if (gruplar.length > 30) console.log(`(${gruplar.length} grup bulundu, ilk 30'u gösteriliyor; aramayı daraltabilirsin.)`);
    const secenekler = [...gosterilen.map((g) => `${g.ad}  (${g.uyeler.length} üye)`), 'Hiçbiri, tekrar ara'];
    const c = await sec('Yönetici olduğun gruplar:', secenekler);
    if (c < gosterilen.length) {
      const [guncel] = await gruplariAl(client, gosterilen[c].id);
      return guncel || gosterilen[c];
    }
  }
}

// --- Ana akış -----------------------------------------------------------------
async function main() {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('==============================================');
  console.log('          WhatsApp Grup Ekleme Botu');
  console.log('==============================================');

  // 1) Liste dosyası
  const dosyalar = fs.readdirSync(KLASOR).filter((f) => /\.(xlsx|csv)$/i.test(f) && !f.startsWith('~$'));
  if (!dosyalar.length) {
    console.log('\nKlasörde Excel (.xlsx) ya da CSV dosyası yok. Üye listesini bu klasöre koyup tekrar çalıştır.');
    return;
  }
  const dosya = dosyalar.length === 1
    ? (console.log(`\nListe dosyası: ${dosyalar[0]}`), dosyalar[0])
    : dosyalar[await sec('Hangi listedeki kişiler eklenecek?', dosyalar)];
  const ws = await sayfayiAc(path.join(KLASOR, dosya));

  // 2) Telefon sütunu
  const basliklar = basliklariAl(ws);
  const dolu = basliklar.map((b, i) => ({ b, i })).filter((x) => x.b);
  const tahmin = dolu.filter((x) => /telefon|tel\b|numara|phone|gsm|cep/i.test(x.b));
  const sutun = tahmin.length === 1
    ? (console.log(`Telefon sütunu: "${tahmin[0].b}"`), tahmin[0].i)
    : dolu[await sec('Telefon numaraları hangi sütunda?', dolu.map((x) => x.b))].i;

  const { numaralar, hatalilar } = numaralariOku(ws, sutun);
  console.log(`${numaralar.size} geçerli (tekrarsız) numara bulundu.`);
  if (hatalilar.length) console.log(`Biçimi anlaşılamadığı için atlanan ${hatalilar.length} değer: ${hatalilar.join(' | ')}`);
  if (!numaralar.size) return;

  // 3) WhatsApp numarası ve bağlantı
  const client = await baglan(await oturumSec());
  const rapor = [];
  const kaydet = (numara, durum, detay = '') => rapor.push({ numara, ham: numaralar.get(numara) ?? '', durum, detay });

  try {
    // 4) Grup
    const grup = await grupSec(client);
    const mevcut = new Set(grup.uyeler);

    // 5) Numaraları kontrol et
    console.log(`\n"${grup.ad}" seçildi. Numaralar kontrol ediliyor (kişi başı birkaç saniye)...`);
    const idler = [];
    for (const numara of numaralar.keys()) {
      if (numara === client.info.wid.user) { kaydet(numara, 'Atlandı', 'Botu çalıştıran numara'); continue; }
      const id = await tekrarDene(() => client.getNumberId(numara));
      if (!id) kaydet(numara, 'WhatsApp yok');
      else if (mevcut.has(id._serialized)) kaydet(numara, 'Zaten grupta');
      else idler.push(id._serialized);
      await rastgeleBekle(2, 5);
    }

    let eklenecek = idler;
    if (eklenecek.length > AYARLAR.calistirmaBasinaLimit) {
      eklenecek.slice(AYARLAR.calistirmaBasinaLimit).forEach((id) => kaydet(id.split('@')[0], 'Sonraki çalıştırmaya kaldı'));
      eklenecek = eklenecek.slice(0, AYARLAR.calistirmaBasinaLimit);
    }

    // 6) Özet ve onay
    const ozet = rapor.reduce((o, r) => ((o[r.durum] = (o[r.durum] || 0) + 1), o), {});
    const dakika = Math.ceil((eklenecek.length * (AYARLAR.beklemeMinSaniye + AYARLAR.beklemeMaxSaniye)) / 2 / AYARLAR.partiBoyutu / 60);
    console.log('\n---------------- ÖZET ----------------');
    console.log(`Grup               : ${grup.ad}`);
    console.log(`Eklenecek          : ${eklenecek.length} kişi (tahmini süre ~${dakika} dk)`);
    for (const [durum, sayi] of Object.entries(ozet)) console.log(`${durum.padEnd(19)}: ${sayi}`);
    if (ozet['Sonraki çalıştırmaya kaldı']) console.log(`(Bir seferde en fazla ${AYARLAR.calistirmaBasinaLimit} kişi eklenir; kalanlar için yarın tekrar çalıştır.)`);
    console.log('--------------------------------------');

    if (!eklenecek.length) { console.log('Eklenecek kimse yok.'); return; }
    if (!(await evetMi('Ekleme başlasın mı?'))) {
      eklenecek.forEach((id) => kaydet(id.split('@')[0], 'Eklenmedi (iptal)'));
      console.log('İptal edildi, hiçbir değişiklik yapılmadı.');
      return;
    }

    // 7) Ekle (ban riskini azaltmak için yavaş ve rastgele aralıklarla)
    console.log('\nEkleme başladı. Bitene kadar bu pencereyi kapatma.');
    // addParticipants sohbet nesnesinden yalnızca client ve id'yi kullanır
    const grupNesnesi = { client, id: { _serialized: grup.id }, addParticipants: GroupChat.prototype.addParticipants };
    for (let i = 0; i < eklenecek.length; i += AYARLAR.partiBoyutu) {
      const parti = eklenecek.slice(i, i + AYARLAR.partiBoyutu);
      let sonuc = await tekrarDene(() => grupNesnesi.addParticipants(parti, { autoSendInviteV4: true }));
      if (typeof sonuc === 'string') sonuc = Object.fromEntries(parti.map((id) => [id, { code: 0, message: sonuc }]));

      for (const id of parti) {
        const s = sonuc?.[id] || {};
        const numara = id.split('@')[0];
        if (s.code === 200) kaydet(numara, 'Eklendi');
        else if (s.code === 409) kaydet(numara, 'Zaten grupta');
        else if (s.isInviteV4Sent) kaydet(numara, 'Davet gönderildi', 'Gizlilik ayarı doğrudan eklemeye izin vermedi');
        else kaydet(numara, 'Hata', `${s.code ?? ''} ${s.message ?? ''}`.trim());
        console.log(`  ${numaraGoster(numara)} -> ${rapor[rapor.length - 1].durum}`);
      }
      if (i + AYARLAR.partiBoyutu < eklenecek.length) await rastgeleBekle(AYARLAR.beklemeMinSaniye, AYARLAR.beklemeMaxSaniye);
    }
    console.log('\nTamamlandı.');
  } finally {
    raporYaz(rapor);
    await client.destroy().catch(() => {});
  }
}

function raporYaz(rapor) {
  if (!rapor.length) return;
  fs.mkdirSync(RAPOR_KLASORU, { recursive: true });
  const dosya = path.join(RAPOR_KLASORU, `rapor-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`);
  const satirlar = ['numara;listedeki;durum;detay', ...rapor.map((r) => [r.numara, r.ham, r.durum, r.detay].join(';'))];
  fs.writeFileSync(dosya, '\uFEFF' + satirlar.join('\n'), 'utf8');
  const ozet = rapor.reduce((o, r) => ((o[r.durum] = (o[r.durum] || 0) + 1), o), {});
  console.log('Sonuç:', ozet);
  console.log(`Rapor: ${dosya}`);
}

if (require.main === module) {
  main()
    .catch((e) => console.error('\nHata:', e?.stack || e))
    .finally(() => rl?.close());
}
module.exports = { normalizeEt, numaralariOku, sayfayiAc, basliklariAl };
