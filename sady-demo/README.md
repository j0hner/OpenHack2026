# SADY

## Todo

- [ ] Pridat datasety
- [ ] Vylepsit UX
- [ ] Udelat dokumentaci
- [ ] Udelat prezetntaci

> **Vyberte pozemek. Zjistěte, čemu se na něm bude dařit.**

Demo webové aplikace pro hackathon otevřených dat. Spojuje pozemek, půdu, klima, vláhu, terén, dostupnost, územní omezení a ekonomiku výsadby do jednoho srozumitelného doporučení pro založení ovocného sadu.

Aplikace běží jako **statický frontend** – bez backendu, registrace a tajných API klíčů. Je připravená pro GitHub Pages.

---

## 1. Co aplikace umí

- **Interaktivní mapa celé ČR** (Leaflet + OpenStreetMap) s přiblížením až na úroveň pozemku.
- **Výběr oblasti** podle kraje, okresu, obce a katastrálního území; kliknutí na kraj v mapě.
- **Vyhledání lokality** přes Nominatim / OpenStreetMap (skutečný online zdroj, s ošetřením chyby).
- **Výběr více ploch** kliknutím v mapě nebo v seznamu, vzájemně propojený.
- **Kreslení vlastní plochy** – přidávání vrcholů, přetažení vrcholů, dokončení, smazání. Výměra a obvod se počítají z geometrie.
- **Detail pozemku** s hodnocením 0–100, slovním výsledkem, třemi důvody, riziky, dalšími kroky a samostatným ukazatelem úplnosti dat.
- **Přepínání 5 ovocných druhů**, pořadí vhodnosti, spon, počet stromů, náběh plodnosti a péče.
- **Ekonomika** s přepočtem investice, ročních toků, NPV, návratnosti, scénářů a porovnáním variant se závlahou / bez závlahy a s podporou / bez podpory.
- **Porovnání až 4 ploch** včetně společné výměry bez dvojího započtení překryvů.
- **Mapové vrstvy** s legendou, vysvětlením a stavem dat (skutečná / předpočítaná / modelová / demo / nedostupná).
- **Panel „Z čeho vycházíme“** s poctivým stavem každého zamýšleného zdroje.
- **Ukládání do localStorage** (výběr, druh, vrstvy, ekonomické vstupy, vlastní plocha) a tlačítko **Obnovit demo**.
- **Ukázka na 7 kroků** pro tříminutovou prezentaci.
- **Lokální režim**: při výpadku mapových dlaždic se dál zobrazuje přibalená hranice ČR a všechny analýzy fungují.

---

## 2. Lokální spuštění

Požadavek: Node.js 18+ a npm.

```bash
npm install
npm run dev
```

Vite vypíše adresu (výchozí `http://localhost:5173`). Aplikace se otevře přímo v mapovém rozhraní – žádná úvodní marketingová stránka ani registrace.

Kontrola typu a produkční build:

```bash
npm run typecheck
npm run build
npm run preview
```

`vite.config.ts` používá `base: './'`, takže build funguje v kořeni i v podadresáři GitHub Pages.

---

## 3. Nasazení na GitHub Pages

### Varianta A – GitHub Actions (doporučeno)

1. Nahrajte projekt do repozitáře na GitHubu (větev `main`).
2. V **Settings → Pages → Build and deployment** zvolte **Source: GitHub Actions**.
3. Push do `main` spustí workflow `.github/workflows/deploy.yml`, který nainstaluje závislosti, spustí build a publikuje `dist`.
4. Aplikace bude na `https://<uživatel>.github.io/<repo>/`.

Workflow používá oficiální akce `actions/configure-pages`, `actions/upload-pages-artifact` a `actions/deploy-pages` a nepotřebuje žádný token v kódu.

### Varianta B – ruční publikace

```bash
npm run build
# obsah složky dist/ nahrajte do větve gh-pages nebo do kořene Pages
```

Pro repozitář na `https://<uživatel>.github.io` (bez podadresáře) není potřeba nic měnit – relativní cesty fungují v obou případech.

---

## 4. Struktura projektu

| Soubor / složka | Role |
| --- | --- |
| `src/App.tsx` | Stav aplikace, propojení panelů, ukázková prezentace, ukládání |
| `src/components/*` | Uživatelské rozhraní (lišta, levý panel, detail, doporučení, ekonomika, porovnání, zdroje, ukázka) |
| `src/map/MapView.tsx` | Mapová logika: dlaždice, vrstvy, výběr, kreslení, náhradní režim |
| `src/lib/adapters.ts` | Datové adaptéry skutečných zdrojů (Nominatim, pokus o ČÚZK WFS) |
| `src/data/demoAreas.ts` | Ukázkové plochy A–E, jejich atributy a popisy |
| `src/data/layers.ts` | Demo geometrie mapových vrstev, legendy a stav dat |
| `src/data/regions.ts` | Číselník krajů, okresů a ukázkových obcí / k. ú. |
| `src/data/geo/` | Lokálně přibalená hranice ČR (Natural Earth) a kraje (Eurostat NUTS 2021) |
| `src/data/fruitProfiles.ts` | Oddělené pěstitelské profily druhů – modelové předpoklady |
| `src/lib/scoring.ts` | Transparentní skórovací model (váhy 30/30/20/10/10) |
| `src/lib/economics.ts` | Ekonomické výpočty, scénáře, NPV, návratnost |
| `src/lib/geo.ts` | Výměry, obvody, sjednocení geometrií (Turf) |
| `src/lib/storage.ts` | Ukládání a obnovení stavu v localStorage |
| `src/data/provenance.ts` | Panel „Z čeho vycházíme“ a zásady práce s daty |

---

## 5. Skutečně napojené zdroje a demo data

### Napojeno (funguje bez klíče)

| Zdroj | Použití | Poznámka |
| --- | --- | --- |
| **Natural Earth 1:50m** | hranice ČR | lokálně přibalený GeoJSON, funguje offline |
| **Eurostat GISCO NUTS 2021** | hranice 14 krajů | lokálně přibalený GeoJSON |
| **OpenStreetMap** | podkladové dlaždice | online, při výpadku se zapne lokální režim |
| **Nominatim / OSM** | vyhledání lokality | online dotaz s timeoutem a chybovým stavem |

### Záměrně nenapojeno (vždy viditelně označeno)

| Zdroj | Stav v demu |
| --- | --- |
| ČÚZK / RÚIAN – parcely | **Nedostupné** – veřejné WFS neumožňuje volání z prohlížeče (CORS), demo nemá backend. Tlačítko ověření parcely chybu poctivě zobrazí. |
| LPIS – půdní bloky | **Demo data** – ilustrativní bloky, do výpočtu nevstupují |
| BPEJ – půdní jednotky | **Demo data / modelový profil** |
| ČHMÚ – klima a sucho | **Modelový předpoklad** odvozený z typických podmínek oblasti |
| ČÚZK DMR – terén | **Demo odhad** sklonu a expozice |
| AOPK, VÚV TGM – omezení | **Demo ilustrace** ochranného pásma a záplavového území |
| ČSÚ, MZe, SZIF – výnosy, ceny, podpory | **Modelové předpoklady** |

> Uvedení instituce v aplikaci neznamená, že je zdroj připojený. Stav u každého ukazatele odpovídá skutečnosti.

---

## 6. Model a jeho hranice

**Váhy (návrh pro demo):** půda 30 %, klima 30 %, vláha 20 %, terén 10 %, provoz 10 %.

- Skóre 0–100 vyjadřuje **soulad podmínek s nároky druhu**, nikoli pravděpodobnost úspěchu.
- Chybějící kategorie se **nenahrazuje nulou** – normalizují se váhy dostupných kategorií.
- Pokud chybí **půda nebo klima**, nebo je dostupných méně než 70 % vah, zobrazí se **„Nedostatek dat“** místo čísla.
- **Mezní hodnota:** kategorie pod 30 bodů přebíjí vážený průměr a výsledek je „Rizikový“.
- **Územní kolize** (záplavy, ochrana přírody) a **kvalita podkladů** se hodnotí samostatně a mohou výsledek omezit.
- Skóre 82/100 **není** „82% pravděpodobnost úspěchu“.
- Druh pozemku sám o sobě neznamená, že je výsadba povolená.
- Ekonomika vychází výhradně z uživatelských vstupů; podpora je modelová částka vyžadující ověření podmínek.

### Ukázkové plochy a očekávané výsledky

| Plocha | Lokalita | Charakter | Jabloň bez závlahy |
| --- | --- | --- | --- |
| **A** | Bílany, okres Kroměříž | úrodná Haná, dostatek srážek | 81/100 „Vhodný“ |
| **B** | Staňkovice u Žatce, okres Louny | suchá pánev, záplavové území | 67/100 „Rizikový“ (vláha 5/100 pod mezí) |
| **C** | Horní Maršov, okres Trutnov | chybí půda i klima | „Nedostatek dat“ (úplnost 20 %) |
| **D** | Hustopeče, okres Břeclav | teplá jižní Morava | 77/100 „Vhodný“ |
| **E** | Třebíč, Vysočina | chladné jaro, dostatek vláhy | 71/100 „Vhodný s opatřeními“ |

Geometrie jsou **ukázkové plochy**, nikoli skutečné katastrální parcely. Atributy jsou modelové profily daných oblastí.

---

## 7. Scénář tříminutové prezentace

1. **0:00–0:20 – Problém a slib.** „Rozhodnout o sadu znamená spojit půdu, klima, vodu, terén, omezení a peníze. SADY to dělá na jednom místě.“ Otevřená mapa celé ČR.
2. **0:20–0:40 – Poctivé pokrytí.** Ukažte mapu ČR: „Mapa je celorepubliková, ale analyticky vyhodnocených je 5 ukázkových ploch. Zbytek záměrně nebarvíme.“
3. **0:40–1:10 – Příznivý pozemek.** Klikněte na **plochu A** (nebo „Spustit ukázku“). Ukažte skóre 81/100, tři důvody, úplnost dat 100 %.
4. **1:10–1:40 – Riziko.** Přepněte na **plochu B**. Skóre 67/100, ale výsledek „Rizikový“ – vláha 5/100 pod mezní hodnotou. Ukažte záplavové území jako samostatné omezení.
5. **1:40–2:10 – Změna rozhodnutí.** Zapněte **závlahu**: skóre stoupne na 76/100 („Vhodný s opatřeními“), v ekonomice stoupne investice i výnos. Přepněte druh na **meruňku** – v suché oblasti je vhodnější než jabloň.
6. **2:10–2:40 – Peníze.** Záložka **Ekonomika**: investice, graf toků, NPV, návratnost, scénáře a porovnání se závlahou / bez podpory. Zdůrazněte, že podpora je modelová, ne jistá.
7. **2:40–3:00 – Důvěra.** Záložka **Data a nejistoty** → **Z čeho vycházíme**: skutečná data (hranice, OSM, Nominatim), modelové předpoklady a nedostupné zdroje. „Chybějící data nikdy nevydáváme za výsledek.“

**Záložní plán při výpadku internetu:** aplikace přepne na lokální hranici ČR, ukázkové plochy a analýzy fungují; v panelu vrstev jsou všechna demo data lokální.

---

## 8. Omezení a další kroky

- Analytická data nejsou napojená; jde o demo s výslovně označenými modelovými hodnotami.
- Katastrální parcely vyžadují proxy/backend nebo exporty – statické demo je záměrně neobchází.
- Ekonomické modely jsou zjednodušené (žádná inflace, daně, pojištění, skladovací ztráty).
- Další rozšíření: napojení LPIS/BPEJ/ČHMÚ přes veřejné API s proxy, Sentinel-2 NDVI, správa sadu v čase, tisková zpráva pro porotu.
