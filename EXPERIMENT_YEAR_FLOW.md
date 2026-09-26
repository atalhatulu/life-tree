# Yıllık Akış Deney Alanı

Bu dal, çalışan `main` sürümünden ayrıdır. Deney kodu `src/experimental/year_flow_scheduler.js` altında tutulur ve mevcut `Game.ageOneYear()` veya canlı arayüz tarafından çağrılmaz.

## Çalıştırma
`npm test` bütün mevcut testleri ve deney testlerini çalıştırır.
`node --test tests/year_flow_experiment.test.js` yalnızca deney testlerini çalıştırır.

## Deney sınırı
İlk aşama: deterministik tarih planlayıcı, artık yıl, olay sıralaması ve oyun durumunu değiştirmeme garantisi. Yıllık motorun sonuçları henüz gün gün hesaplanmıyor. Sonraki aşama, kararların kalan yılın sonuçlarını etkileyebilmesi için motorun işlem sınırlarını ayrı bir deney API'sinde tanımlamak. Deney doğrulanmadan `main`e birleştirilmez.
