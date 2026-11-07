# Uygulama mimarisi ve hesaplama sözleşmesi

## Kapsam

Know Your Place manuel veri girişli bir kişisel finans uygulamasıdır. Banka, SMS, e-posta ve canlı Google Sheets bağlantısı kapsam dışıdır.

## Bileşenler

- `Finance.Domain` finans modellerini, doğrulamayı ve hesaplama kurallarını içerir. Web ve veritabanı bağımlılığı yoktur.
- `Finance.Application` hesap, kayıt güncelleme ve rapor kullanım senaryolarını içerir. Domain'e ve kendi tanımladığı saklama arayüzlerine bağlıdır.
- `Finance.Infrastructure` bu arayüzleri EF Core, Npgsql ve PostgreSQL ile uygular. Parola hash'leri, oturumlar ve salt okunur SQLite aktarımı burada yönetilir.
- `Finance.Api` HTTP uçlarını, çerez ve JWT doğrulamasını, yetkilendirmeyi ve bağımlılıkların kaydını içerir.
- `frontend/` React, TypeScript, Tailwind v4 ve shadcn/ui yapısını kullanır. Oturum, kayıt listeleri/düzenleme ve ayarlar ayrı özellik klasörlerindedir.
- PostgreSQL her hesap için ayrı, sürümlü bir finans dokümanı saklar. Aynı işlemde güncellenen `finance_entries` tablosu liste satırlarını ayrı ayrı tutar ve hesap, kayıt türü, tarih, kategori ve kart üzerinden indeksler. Atomik kaydetme koşulu kullanıcı kimliğini ve sürümü birlikte denetler. Çakışmada 409 döner.
- Liste ekranları `/api/lists/{collection}/{year}/{month}` üzerinden PostgreSQL'de arama, filtreleme, sıralama ve sayfalama yapar. Taksit ilerlemesi, ekstreler ve vadeler mevcut hesaplama motorundan alınır, liste sorgusu bu sonuçlara PostgreSQL'de uygulanır. `/api/workspace` açılışta işlem listeleri yerine ekranın ortak verilerini verir. Tam doküman, düzenleme doğrulaması ve JSON yedekleme için korunur.
- Para C# decimal ve iki ondalık basamakla doğrulanır, tarihler DateOnly'dir. Raporlarda bugünün tarihi Europe/Istanbul kullanır.
- Finans uçları `GET/PUT /api/state`, `GET /api/report/{year}/{month}` ve `GET /api/card-outlook/{year}/{month}` adreslerindedir. Oturum uçları `POST /api/login`, `GET /api/session` ve `POST /api/logout` adreslerindedir. `POST /api/register` üyelik oluşturur. `PUT /api/profile`, mevcut şifreyle oturumdaki hesabın kullanıcı adını ve şifresini günceller. `GET /health` servis durumunu verir.
- Yazma istekleri `X-Finance-Request` başlığını gerektirir ve CORS kapalıdır. Hesap kapsamındaki istekler ayrıca ekranda açık olan hesabı `X-Finance-Account` başlığıyla doğrular. Başlık oturumdaki kullanıcıdan farklıysa istek reddedilir. Bu kontrol, başka sekmede hesap değiştiğinde eski ekrandan yeni hesaba yazmayı engeller.
- Giriş, üyelik ve hesap değişikliği hız sınırlıdır. 12 saat geçerli JWT, `HttpOnly` ve `SameSite=Strict` oturum çerezinde taşınır. HTTPS varsayılanında çerez `Secure` niteliğine sahiptir. `ALLOW_HTTP=true` doğrudan IP HTTP istisnasını açar. **Beni hatırla** kullanıcı adını cihazda saklar ve şifre doldurmayı tarayıcının parola yöneticisine bırakır. Hesap bilgisi değişikliği mevcut oturumları geçersiz kılar.
- Yeni üyelere açılan tur, `POST /api/tour/start` ile hesap başına bir kez başlatılabilir. Önceden mevcut hesaplar turu görmüş olarak işaretlenir.

## Genel varlık ve devir — güncel hesaplama

Bakiye **0 TL'den** başlar ve kaydedilmiş hareketlerle değişir.

**Kaydedilmiş bakiye = tarihe kadar girilmiş gelirler (maaş ve avans dahil) − kartsız günlük harcamalar − gerçekleşmiş ekstre ödemeleri − kartsız abonelik/taksit ödemeleri.** Kendi hesapları arasındaki transferler ve nakit çekme gibi toplam parayı değiştirmeyen hareketler `IsTransfer` ile hariç tutulur. Önceki ay/yıl kayıtları ve maaş planı başlangıcından önce girilen gerçek hareketler de hesaba katılır. Ay/yıl filtresi bu hareketleri silmez.

- Genel Bakış ana kartı artık aylık net yerine tüm geçmişten biriken kayıtlı bakiyeyi gösterir. `Varlıklar ve Devir` ekranında önceki ay devri, bu ay para girişi/çıkışı, nakit+banka toplamı, tahmini kart borcu ve 12 aylık devir tablosu vardır.
- Kredi kartı alışverişi günlük gider ve kart borcuna girer; nakdi alışveriş anında azaltmaz. Nakit, ekstreyi ödediğinde yalnızca bir kez azalır. Bu toplam likit varlıktır; borçlar düşülmüş net servet değildir. Kart borcu ayrıca gösterilir.
- `SalaryPlan` bir tahmindir; kaydedilmiş varlığa otomatik eklenmez. Alınan maaş, `Income.IsSalary=true` veya `Type=Maaş/Maas` ile kaydedilir. Aynı ayda plan ve gerçek maaş toplanmaz; plan toplamında max(plan, gerçekleşen) kullanılır. Böylece birden fazla parçalı maaş ödemesi nakitte gerçek tutarıyla birikir, tahminde çift sayılmaz.
- Yeni kart ödemeleri tam ekstre tutarını `Payment.Amount` ve gerçek tarihi `PaidOn` alanına alır. Düzenleme sonrası bu tutarla hesaplanan ekstre uyuşmazsa sessiz geçmiş değişimi yerine doğrulama hatası verilir. Kısmi ekstre ödeme bu sürümde hâlâ desteklenmez.
- Kartı olmayan abonelik ve taksit vadeleri yalnızca plana girer; nakitten düşmek için `CashPayment` kaydı gerekir. Aynı kaynak/tür/vade tek kez ödenebilir. Ödeme geçmişi olan kaynak tutarı veya tarihi değiştirilirse uyumsuzluk reddedilir.
- Kaynaktan gelen eski checkbox ödemelerinin tutarı/tarihi boş olabilir. Böyle kayıtlar geçici olarak plan tutarı ve kesim tarihiyle tahmin edilir ve ekran bu durumu belirtir. Eski kayıtlardaki manuel adetlerin ilk N vade varsayımı geriye uyumluluk için okunur. Yeni ödemeler tarih ve tutarla kaydedilir.
- Gelecek tarihli gelir/ödeme bugünkü bakiyeyi etkilemez. Geçmiş ay raporunda gelecekte yapılmış ödemeler taksit borcunu azaltmaz. Gelecek ay seçilirse gerçekleşen bakiye bugünde kalır, gelecek ay sonuçları ayrı plan sütunundadır.
- `Year` plan hesaplaması da en eski kayıttan birikir; Ocak'ta sıfırlanmaz. `PlanOpeningBalance/PlanClosingBalance` maaş ve bütçe tahminini içerir; gerçek para yerine kullanılmaz.
- Maaş ve bütçe için kayıtlı takip başlangıcı planı yönetir. Öncesinde maaş, bütçe limiti veya tasarruf hedefi üretilmez. Daha önce kaydedilmiş gerçek hareketler bakiye hesabına katılır. Takip başlangıcı günlük ayarlar formunda düzenlenmez.

Yeni kayıt alanları opsiyonel/default değerlidir. Mevcut JSON verileri yerinde okunur; otomatik gelir oluşturulmaz ve canlı kullanıcı kayıtları yeniden içe aktarılmaz. Eksik eski ödeme tutarları veri migrasyonu adı altında uydurulup kalıcı kayda yazılmaz.

## Düzeltilen hesaplama hataları

1. **Avans:** `IsBorrowing` kazanılmış ek gelirden ayrılır. Net plan = maaş planı + ek gelir − gider. Nakit/varlık planı avans nakit girişini ayrıca içerir. Avans likit nakdi artırır, kazanılmış gelir veya borçtan arındırılmış servet değildir. Kredi anapara/faiz ayrıştırması kaynakta veri olmadığı için yapılmaz.
2. **Maaş gerçek bakiye değildir:** Maaş plan olarak gösterilir. TrackingStart öncesine otomatik maaş konulmaz. Geçmiş gerçek nakit bakiyesi üretilmez. Maaş değişiminde eski ve yeni tutar geçerlilik aylarıyla saklanır.
3. **Bütçe tahmini:** Bugünün ayı dahil gelecekteki aylarda günlük gider için max(kayıt, bütçe) kullanılır. Seçili ayı değiştirmek hesaplama motorunun bugünkü tahmin sınırını değiştirmez.
4. **Abonelik ekstresi:** Her ay gerçek ödeme gününde bir vade üretilir; başlangıç/bitiş aralığına giriyorsa sayılır. Tarih kart kesim fonksiyonuyla tek bir ekstreye atanır. Pasife almak için bitiş tarihi girilir, böylece geçmiş gider silinmez. Geçmişten başlayan abonelikte fiyat değişimi eski kaydı dün kapatır ve yeni kaydı bugünden başlatır.
5. **Taksit:** Devam eden bir plan ilk ödenmemiş vade ve kalan adetle açılır. İlk tarihten itibaren `Count` adet vade üretilir. Ay sonu kısalmaları sonraki aylara taşınmaz. Mevcut kayıtlardaki farklı ilk ve son tutarlar finansal doğruluk için saklanır. Borç, ödenmemiş vadelerin tutarları toplamıdır.
6. **Taksit ödemesi:** Ödeme durumu kayıtlı kart ekstresi veya kartsız vade ödemesinden hesaplanır. Eski manuel adet, aynı vade için gerçek ödeme kaydı varsa devre dışı kalır.
7. **Ödeme kimliği:** Sabit kart kimliği ve tam kesim tarihi saklanır. Ay/yıl seçimi veya kartın adı/sırası değişmesi ödeme kaydını değiştirmez. Kartın isteğe bağlı `StatementDates` kayıtları tek bir ay için bankanın doğrulanmış kesim ve son ödeme tarihini uygular. Diğer aylarda standart kural geçerlidir. Ödeme geçmişi olan kartın standart kuralı ve kayıtlı ödemenin dönem kesimi korunur.
8. **Çift gider:** Ekstre ödeme onayı başka bir gider oluşturmaz. Taksit ve abonelik günlük harcamalara tekrar girilmemelidir. Manuel girilen benzer iki kaydın aynı alışveriş olduğunu otomatik bilmek mümkün değildir.
9. **Kapsam ve doğrulama:** Dinamik kart/kategori listeleri kullanılır; eski 4 kart/7 kategori/300–1000 satır formül sınırları yoktur. Pozitif para, kuruş hassasiyeti, tarih, tam sayı taksit, kart ilişkisi, tekil kimlikler doğrulanır. Limit 0 ise yüzde 0 gibi yanıltıcı oran üretilmez.

## Saklama ve sınırlamalar

- PostgreSQL'e geçişte SQLite kaynağı salt okunur açılır. Tek kullanıcılı doküman `owner` hesabına bağlanır. Çok kullanıcılı kaynakta hesap kimlikleri, parola hash'leri ve oturum kayıtları aktarılır. PostgreSQL'e yazılan dokümanlar ve sürümler işlem kapanmadan kaynakla karşılaştırılır. Yeni hesaplar boş hareket listeleri, sıfır maaş/bütçe hedefleri ve hazır kategori adlarıyla başlar.
- Ekstreler tahminidir; banka ekstresi/faiz/iade/kur dönüşümü kendiliğinden bilinmez. Ödeme onayı tam ödeme içindir; kısmi tutar kaydı bu sürümde yoktur.
- Harcamalar işlem tarihine, aylık taksitler vade plan tarihine göre raporlanır. Kart ekstresi kesim ayı ayrı görünür.
- Aylık bütçe ve tasarruf hedefi güncel global ayardır; geçmiş bütçe planları sürümlenmez. Eski planı saklamak için JSON yedeği kullanılabilir. Maaş ve abonelik fiyatları için dönem geçmişi vardır.
- JSON aktarımı oturumdaki hesabın finans verisini değiştirir. Kayıttan önce onay ve sunucu doğrulaması vardır. Silme geri alınamaz. Önce dışa aktarma yapılabilir.
- PWA uygulama kabuğunu önbelleğe alır, API cevaplarını ve finansal verileri önbelleğe almaz. İnternet olmadan kayıt okunmaz/yazılmaz; çevrimdışı işlem kuyruğu yoktur.
- Ana ekrana ekleme HTTPS gerektirir; Android destekleyen tarayıcıda yükleme istemi, iOS Safari'de Paylaş → Ana Ekrana Ekle kullanılır. App Store / Play Store paketi değildir.

## Doğrulama

`dotnet run --project tests/Finance.Tests` bağımsız senaryoları çalıştırır. `pnpm build` TypeScript kontrolü, üretim paketi ve service worker üretimini çalıştırır. `scripts/smoke.py` çalışan API'de kimlik doğrulama, kalıcı kayıt, doğrulama ve eşzamanlılık sınamalarını yapar.
