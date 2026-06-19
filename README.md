# 🤠 Express Raiders

Ett western-actionspel för webben: hoppa upp på det rullande tåget och rensa det
från banditer – vagn för vagn – tills loket är ditt. Byggt i ren HTML5 + Canvas +
JavaScript, utan beroenden. Funkar på dator och mobil, och kan paketeras som
Android-app.

> **Om ursprunget:** Spelet är en **egen, fristående hyllning** inspirerad av
> arkadgenren med tåg-action från mitten av 80-talet. All kod och grafik i det här
> projektet är skriven från grunden och fri att använda. Projektet innehåller
> *inga* original-ROM:ar, sprites eller annat upphovsrättsskyddat material från
> något kommersiellt spel.

---

## 🎮 Spela

Öppna `index.html` i en webbläsare – det är allt. Inget bygg-steg, ingen server
krävs.

### Kontroller

| Handling | Tangentbord | Mobil |
|----------|-------------|-------|
| Gå       | `◀` `▶` / `A` `D` | Pilknappar |
| Hoppa    | `↑` / `W` / Mellanslag | HOPP |
| Slag     | `J` / `Z` | SLAG |
| Spark    | `K` / `X` | SPARK |

Slaget är snabbt och kort. Sparken har längre räckvidd och knuffar tillbaka.
Töm en vagn på banditer för att rulla vidare. Den sista vagnen vaktas av en boss.

---

## 🚀 Lägg upp på GitHub Pages

1. Skapa/öppna repot och lägg alla filer i roten (eller i en mapp).
2. Pusha (se kommandon längre ner).
3. Gå till **Settings → Pages** på GitHub.
4. Under *Build and deployment* välj **Deploy from a branch**, branch `main`,
   mapp `/ (root)`, och spara.
5. Efter en minut ligger spelet på
   `https://<användarnamn>.github.io/<repo>/`.

### Pusha för första gången

```bash
git init
git add .
git commit -m "Express Raiders – webbversion"
git branch -M main
git remote add origin https://github.com/CyberbobSweden/Express-raiders.git
git push -u origin main
```

Om repot redan finns och har innehåll, kör `git pull --rebase origin main` först.

---

## 📁 Struktur

```
express-raiders/
├── index.html        # Sidan + HUD + touch-kontroller
├── css/style.css     # Western-tema, responsiv layout
├── js/game.js        # Hela spelmotorn (rendering, fysik, AI, ljud)
├── README.md
└── LICENSE
```

Grafiken ritas proceduralt i `game.js` (inga bildfiler), och ljudet syntas i
realtid med WebAudio (inga ljudfiler). Därför är hela spelet bara några få filer.

---

## 📱 Göra om till Android-app

Eftersom spelet redan har touch-kontroller fungerar samma kodbas direkt i en
WebView. Enklaste vägen är **Capacitor**:

```bash
# 1. Skapa ett Capacitor-projekt i repot
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Express Raiders" "se.cyberbob.expressraiders" --web-dir=.

# 2. Lägg till Android-plattformen
npx cap add android

# 3. Kopiera in webbfilerna och öppna i Android Studio
npx cap copy
npx cap open android
```

I Android Studio kan du sedan köra på emulator/telefon eller bygga en signerad
APK/AAB via **Build → Generate Signed Bundle / APK**.

Tips för en bra app-känsla:
- Lås appen till liggande läge i `AndroidManifest.xml`
  (`android:screenOrientation="sensorLandscape"`).
- Sätt `--web-dir` till mappen där `index.html` ligger.
- Vill du undvika Android Studio helt går det även att använda en **TWA**
  (Trusted Web Activity) via [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
  och peka på din GitHub Pages-URL – då blir Pages-sidan din app.

---

## 🛠 Idéer för vidareutveckling

- Häst-jaktbana som bonusnivå mellan vagnarna
- Kast-/skjutvapen och pick-ups
- Highscore sparad lokalt (`localStorage`) eller online
- Egna pixel-sprites istället för procedurgrafik
- Musik via WebAudio-sekvensering

---

## 📜 Licens

MIT – se [LICENSE](LICENSE). Du får använda, ändra och sprita fritt.
