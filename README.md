# Gece Bekçisi

Evde kullanılmayan bir Android telefonu, çocuk epilepsi nöbeti için yardımcı bir
gözcüye çevirir: kamera/mikrofon/titreşim ile uzun süren hareketi veya sesi fark
edince ntfy üzerinden iPhone'lara acil bildirim gönderir ve nöbet sonrası
1 saatlik kontrol hatırlatmalarını yürütür.

**Tıbbi cihaz değildir.** Her nöbeti yakalayamaz, boşuna da alarm verebilir.
Diğer önlemlerin yerine değil, yanında kullanılır.

Görüntü ve ses telefondan dışarı çıkmaz; dışarıya yalnızca kısa bildirim metni gider.
Sayfa sunucu kullanmaz, ayarlar telefonun kendi hafızasında durur.

## Alarm sesi

`ses/gecealarm.mp3` — 520 Hz kare dalga, T-3 yangın alarmı ritmi, 28 sn, 329 KB.
Pushover'ın kendi sesleri kısa uyarı tonlarıdır ve uykudan uyandırmaz.
pushover.net → Your Custom Sounds → Upload a Sound ile yüklenir, adı `gecealarm`.
Sınırlar: MP3, en çok 500 KB, iOS için en çok 30 sn.
