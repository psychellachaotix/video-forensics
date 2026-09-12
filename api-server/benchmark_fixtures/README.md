# Ověřená sada video benchmarku

JSON soubory v této složce jsou zachycené výstupy stejného workeru
`python/video_forensics.py`, který používá produkční analýza. Neobsahují cesty k
lokálním souborům ani původní názvy uživatelů.

## Provenience a pravda

- `vision-d01.json` a `vision-d02.json`: nativní kamerová videa z akademické
  sady VISION (CC BY-SA 4.0). Kategorie `videos/flat` a `videos/indoor` jsou
  autory datasetu označené jako nativní.
- `ambiguous-yt.json` a `ambiguous-wa.json`: platformové transkódy stejných
  zařízení z kategorií `flatYT` a `flatWA`. Pravda je `UPRAVENO`, ale technické
  nálezy jsou záměrně obtížné a vzorky jsou označené jako nejasné případy.
- `manual-cut.json` a `manual-audio.json`: deterministické FFmpeg úpravy
  nativních zdrojů. Přesné recepty jsou v `aiBenchmark.ts`.
- `partial-ai-d01.json` a `partial-ai-d02.json`: deterministické vložení oblasti
  z plně AI generovaného klipu do nativních kamerových zdrojů.
- `full-ai.json`: celý klip vznikl text-to-video generováním bez vstupního
  obrazu, v potvrzeném formátu 16:9, 1080p, 8 sekund.

Každý záznam v `BENCHMARK_SAMPLES` obsahuje SHA-256 média, stabilní URL nebo
objektovou cestu, důvod štítku, verzi zachycení a produkční obálku
`{status, result, error}` pro všech šest forenzních kroků.

## Spuštění

Benchmark lze zapisovat pouze interním CLI, ne veřejným HTTP endpointem:

```sh
pnpm --filter @workspace/api-server run benchmark -- moje-skupina
```

CLI ukládá očekávanou i skutečnou třídu, jistotu, model, verzi promptu a skupinu
běhu. Skutečná třída používá stejnou bránu Verifieru jako produkční výsledek;
nepotvrzený závěr je uložen jako `NEJASNE`. Opakované spuštění stejné skupiny
přeskočí již dokončené vzorky se stejným hashem a verzí zachycení.