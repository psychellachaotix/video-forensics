# Video Forensics Desktop (Windows)

Lokální desktopová varianta Video Forensics pro Windows x64. Aplikace je v češtině, běží jako Electron aplikace a nepoužívá Replit databázi, App Storage ani vlastní síťový backend.

## Instalace

1. Stáhněte `Video-Forensics-1.0.2-x64-setup.exe` (NSIS instalátor) nebo `Video-Forensics-1.0.2-x64-portable.exe` (portable varianta).
2. Windows může zobrazit upozornění SmartScreen, protože build je **nepodepsaný**. Zkontrolujte zdroj EXE a potvrďte spuštění pouze pokud mu důvěřujete.
3. Při prvním spuštění vytvořte případ a přidejte lokální MP4/MOV/AVI/MKV nebo JPG/JPEG/PNG/WebP.

## API klíč

V **Nastavení** vložte Anthropic API klíč `sk-ant-...`. Klíč se ukládá pouze šifrovaný přes Windows Electron `safeStorage`; renderer ho nikdy nedostane a obrazovka zobrazuje jen „nakonfigurován / nenakonfigurován“. Tlačítka umožní klíč změnit nebo smazat.

Předplatné Claude.ai **není API klíč**. Claude.ai a Anthropic API jsou oddělené služby a API používá vlastní tokenové účtování. Interpret a následný nezávislý Verifier se volají pouze z Electron main procesu přes HTTPS. Report uvádí vstupní/výstupní tokeny a odhad ceny. Bez klíče zůstanou lokální metadata a technická zjištění dostupná a AI kroky jsou explicitně označené jako nedostupné.

## Data a soukromí

Případy, JSON, originální evidence a reporty jsou uloženy atomicky v Electron `userData/cases`. Import spočítá SHA-256 a duplicitní soubor znovu nekopíruje. Originální media zůstávají beze změny. Do Anthropic odchází pouze metadata, hash a lokální technická zjištění v AI kroku, nikdy automatický upload souboru.

## Nástroje a editory

`ffprobe` a `ffmpeg` se hledají v nastavené cestě, následně v `resources/binaries`, a nakonec v systémovém PATH. Každý krok pipeline je nezávislý a chyba jednoho kroku nezastaví ostatní. Video editor exportuje přes ffmpeg seřazené trim klipy, filtr, hlasitost/mute a text overlay. Photo editor pracuje nedestruktivně a exportuje kopii s otočením, překlopením, jasem, kontrastem, saturací, grayscale/sepia do PNG/JPEG/WebP.

## Vývoj a build

Po instalaci závislostí v nadřazeném workspace:

```powershell
pnpm --filter @workspace/video-forensics-desktop dev
pnpm --filter @workspace/video-forensics-desktop typecheck
pnpm --filter @workspace/video-forensics-desktop test
pnpm --filter @workspace/video-forensics-desktop build
pnpm --filter @workspace/video-forensics-desktop dist:win
```

`dist:win` vyrobí oba unsigned artefakty: NSIS installer i portable EXE. Do `resources/binaries` lze před buildem vložit Windows `ffmpeg.exe` a `ffprobe.exe`; jinak se použije systémový PATH.