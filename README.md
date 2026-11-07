# Know Your Place

**Bütçen belli. Yerini bil.**

Mobil uyumlu kişisel finans uygulaması: günlük harcamalar, gelir/avans ayrımı, abonelikler, taksitler, kart ekstreleri, ödeme işaretleri, kategori bütçeleri ve aylık/yıllık rapor. Manuel veri girişlidir.

Genel varlık 0 TL'den başlayıp kaydedilen hareketlerle aylar ve yıllar arasında devreder. Varlıklar ve Devir ekranı gerçekleşen nakdi, kart borcunu ve gelir/gider planını ayrı gösterir. Maaş alındığında gelir kaydı girilir; planlanan maaş tek başına nakit yaratmaz. [Kurgu incelemesi](docs/logic-audit.md).

**Teknoloji:** .NET 10 + EF Core/PostgreSQL; React + TypeScript + Tailwind v4 + shadcn/ui; PWA; Docker Compose.

## Hızlı başlangıç — Docker

```bash
cp .env.example .env
# .env içindeki ADMIN_PASSWORD değerini en az 12 karakterli eşsiz bir şifreyle değiştir.
# POSTGRES_PASSWORD için ayrı bir rastgele hex parola kullan.
docker compose up -d --build --wait
```

`http://localhost:8080` adresini aç. İlk kurulumda yönetici kullanıcı adı `owner`, şifresi `.env` içindeki `ADMIN_PASSWORD` değeridir. Giriş ekranındaki **Üye ol** ile kişisel hesap oluşturulabilir. Yeni hesapların ilk girişinde rehber turu açılır. Yerel Compose yalnızca loopback'e bağlanır. [Linux dağıtımı](docs/deployment.md)

## Geliştirme

Gerekenler: .NET SDK 10, Node 24, pnpm 11.25.0.

Backend projelerini ve finans testlerini IDE'de `Finance.slnx` ile birlikte açabilirsin.

```bash
# Terminal 1. Erişilebilir bir PostgreSQL veritabanı oluşturup bağlantı bilgilerini gir.
export ConnectionStrings__Finance='Host=127.0.0.1;Database=finance;Username=finance;Password=local-postgres-password'
ADMIN_PASSWORD='local-development-password' ASPNETCORE_ENVIRONMENT=Development dotnet run --project backend/Finance.Api --urls http://localhost:5080
# Terminal 2
cd frontend
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Vite `/api` isteklerini 5080 portuna yönlendirir. Mevcut SQLite kaydını boş bir PostgreSQL veritabanına aktarmak için `SQLITE_IMPORT_PATH` ayarını doğrulanmış dosyaya yönlendirip API'yi `--migrate-only` ile çalıştır. Ayarlar ekranındaki JSON yedeği oturumdaki hesabın finans verilerini içerir.

## Kontroller

```bash
dotnet run --project tests/Finance.Tests
cd frontend && pnpm build
```

- [Hesaplama ve mimari](docs/architecture.md)
- [Linux + HTTPS + yedekleme](docs/deployment.md)
- [Geliştirme talimatları](AGENTS.md)

Ayarlar’daki **Ana ekrana ekle** düğmesi, destekleyen tarayıcılarda yükleme istemini açar. iPhone ve iPad’de Safari’nin **Paylaş → Ana Ekrana Ekle** adımlarını gösterir. Üretimde PWA kurulumu HTTPS gerektirir. İnternet bağlantısı veri işlemleri için gereklidir.
