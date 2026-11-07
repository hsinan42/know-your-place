# Linux üzerinde HTTPS ile kurulum

Docker ve Compose eklentisi olan bir Linux sunucusu, sunucuya yönlenen bir alan adı ve HTTPS için açık 80/443 portları gerekir.

1. `.env.example` dosyasını `.env` olarak kopyala. `ADMIN_PASSWORD` ve `POSTGRES_PASSWORD` için farklı, rastgele parolalar oluştur. `DOMAIN` ve `ACME_EMAIL` alanlarını doldur.
2. `ALLOW_HTTP=false` ve `BIND_ADDRESS=127.0.0.1` ayarlarını kullan. Üretim Compose dosyası için kendi API ve web imajlarının ortak adını `IMAGE_PREFIX`, etiketini `IMAGE_TAG` olarak tanımla. İmaj adları sırasıyla `$IMAGE_PREFIX-api:$IMAGE_TAG` ve `$IMAGE_PREFIX-web:$IMAGE_TAG` biçimindedir.
3. Caddy ile başlat. İlk yönetici kullanıcı adı `owner`, şifresi `ADMIN_PASSWORD` değeridir.

```bash
docker compose --env-file .env -f deploy/compose.prod.yml -f deploy/compose.https.yml up -d --wait
```

Mevcut reverse proxy kullanıyorsan HTTPS trafiğini `127.0.0.1:8088` adresine yönlendir. Bu durumda Caddy overlay'ini kullanmadan yalnızca `deploy/compose.prod.yml` dosyasıyla başlat.

PostgreSQL yedeklerini ve oturum imzalama anahtarını erişimi kısıtlı bir yerde sakla. PostgreSQL yedeğini ayrı bir veritabanına geri yükleyerek doğrula. Ana ekrana PWA olarak yükleme HTTPS gerektirir.
