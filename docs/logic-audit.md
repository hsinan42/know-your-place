# Kurgu incelemesi — genel varlık düzeltmesi

Kapsam: kayıtlı hareketlerin birikmesi, gelir/maaş/borç ayrımı, harcama ile ödeme ayrımı, tarih ve geçmiş kayıt bütünlüğü. Bu bir banka mutabakatı veya yatırım hesabı değildir.

| Bulgu | Düzeltme | Kontrol |
|---|---|---|
| Panel yalnızca aylık neti gösteriyordu; geçmişteki para görünmüyordu | 0 TL'den başlayan tarihli nakit defteri; toplam varlık ve önceki aydan devir | Önceki ay ve önceki yıl geliri Ocak/Şubat bakiyesinde korunur |
| Yıl başında kümülatif plan sıfırlanıyordu | Plan en eski kayıttan birikir | Aralık kapanışı Ocak açılışı olur |
| Maaş planı gerçek para ile karışıyordu | Gerçek maaş kayıt alanı; yalnızca alınan maaş nakde girer | Sadece plan varsa nakit 0; gerçek maaş varsa bakiyeye eklenir |
| Maaş gelir olarak girilince hem plan hem ek gelir sayılabiliyordu | Maaş tespiti ve max(plan, gerçekleşen maaş) | 5.000 plan + 5.000 maaş = 5.000 gelir planı |
| Kart alışverişi ve kartı ödeme aynı nakdi iki kez düşürebilirdi | Alışveriş borca, ödeme nakit defterine | 100 kart harcaması + 100 ödeme yalnızca 100 nakit çıkışı |
| Eski ödeme checkbox'larında tutar ve tarih yoktu | Tahmin etiketi ve düzenlenebilir ödeme geçmişi; yeni kayıtta tutar snapshot'ı | Legacy null alanlarla yeni model geriye uyumlu |
| Ödeme sonrası eski işlem tutarı değiştirilince geçmiş ödeme de değişebiliyordu | Tutarı kaydedilmiş ekstre ve ödeme uyumluluğu doğrulanır | Kaynak silme/tutar bozma reddedilir |
| Kartsız düzenli giderlerin ödendiği belli değildi | Bekleyen vadeler ve ayrı nakit ödeme kayıtları | Ödenmemiş abonelik nakdi azaltmaz; Ödedim tek kez azaltır |
| Gelecek tarihli ödeme geçmiş raporu etkiliyordu | Ödenen adet ve kart durumu rapor tarihine bağlı | 5 Şubat ödemesi 31 Ocak'ta ödenmiş sayılmaz |
| Manuel adet ve gerçek nakit ödeme ikinci kez düşebilirdi | Aynı vade kimliğiyle birleştirme | Aynı manuel vade + CashPayment tek çıkış |
| Kendi hesapları arası transfer bütçe ve geliri şişiriyordu | IsTransfer işareti; toplam varlık/gelir/gider dışına alma | İki transfer bacağı bütçeyi şişirmez |
| Bitmiş aboneliği düzenlemek yeni aktif abonelik açabiliyordu | Bitişi geçmiş abonelikte otomatik fiyat versiyonlaması engellendi | Geçmiş kayıt kendiliğinden yeniden başlamaz |
| Yeni rapor yüklenirken eski yıl/ay sonucu görünüyordu | İstek başında eski rapor temizlenir | Eski bakiye yeni dönem etiketiyle gösterilmez |
| Kart satırında anlamsız 0 TL harcama görünüyordu | Kartın ödeme kuralı gösterilir | Kayıt tablosunda kartlar harcama gibi sunulmaz |

## Bilinmeyen veriler ve bilinçli sınırlar

- Kayıtlı varlık sıfırdan başlar.
- Geçmişte alınmış ama girilmemiş maaşlar kendiliğinden var sayılmaz. Kullanıcı gerçekten aldığı maaşları gelir olarak kaydetmelidir.
- Eski ödeme kutuları ve manuel adetler gerçek tarih/tutarı içermediğinde bakiye tahmin içerir. Ekranda uyarısı vardır; asıl bilgiler tamamlanmadan kesin banka bakiyesi denmez.
- Kalan taksit borcu ve kart borcu aynı taksidi kapsayabilir; bunlar birbirine eklenerek toplam borç diye sunulmaz. Likit bakiye ile net servet farklıdır.
- Bütçe ve tasarruf hedefi güncel ayardır; geçmiş bütçe sürümleri bu değişiklikte eklenmedi. Kısmi ekstre ödemesi hâlâ desteklenmez; tam ödenmiş sayılmaz.
- İade ve faiz için otomatik banka verisi yoktur. Kullanıcı uygun gelir/gider kaydını girer; otomatik eşleştirme varsayılmaz.
- Dağıtım kalıcı veritabanı volume'ünü korur.

## Doğrulama

- Hesaplama ve doğrulama senaryoları sentetik kayıtlarla çalışır.
- API smoke testi yeni `assets`, `openingBalance`, `closingBalance` alanlarını ve sonraki yıl Ocak devrini de kontrol eder.
- Sentetik yerel tarayıcı testinde Ekim'den 850 TL devir + Kasım'da 500 TL gerçek maaş = 1.350 TL bakiye görüldü. 100 TL kartsız abonelik ödemesi sonrası bakiye 1.250 TL oldu, aynı vade bekleyen listesinden çıktı.
- 390 px mobil görünümde sayfa genişliği taşmadı. TypeScript ve üretim PWA build başarılı.
