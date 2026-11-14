# Kategorie, ruční vstupy a úklid dat

Ověřeno 14. 11. 2026, větev `codex/categories-data-cleanup`. Výsledek: PASS.

## Funkční změny

- Ochrana přírody/AOPK odstraněná z mapy, požadavků, modelových omezení, zdrojů i pěti prostorových výřezů. Ponechaná data mají konkrétní použití; inventář je v [OPEN_DATA.md](../OPEN_DATA.md). Datové soubory mají 6 340 092 B, celý public/data se zmenšil o 9 662 B. Číselné výsledky pěti skutečných parcel zůstávají 72 / 71 / 55 / 79 / 76.
- Nastavení odstraněné; téma se přepíná sluncem/měsícem v hlavičce. Přejmenování a jednotlivé/hromadné odstranění mají v tmavém režimu odpovídající povrchy a text.
- Vlastní kategorie, jednotlivé i hromadné přiřazení, správa kategorií a souhrnné ekonomické scénáře. Návratnost se počítá ze součtu toků, překryv geometrie blokuje souhrn. Přejmenovaná parcela ukazuje původní skutečné číslo.
- Ruční HPJ, teplota, srážky, ET0 a počty jarních mrazových/letních dnů skutečně mění vhodnost. Hodnoty mají vlastní původ a validaci; prázdno není nula. Reset obnoví otevřené vstupy. Ruční průměry nejsou uměle převedeny na historickou řadu a nemění barvu dostupnosti otevřených dat.
- Analýzy otevřené navigací čekají na výběr. Změna pozemku analýzu zachová; výběr mimo Analýzy otevře mapu. Individuální ekonomika je celá sbalená pod Modelový výsledek pro daný druh; Scénáře obsahují vysvětlivku.
- Přehled Pozemky má obousměrné řazení podle výměry, ovoce, vhodnosti a názvu, kombinovatelné rozsahy/filtry a prázdné i chybové stavy. Nehodnocené plochy zůstávají bez skóre.
- Nesousedící výběr má viditelné upozornění. Hover má stručnou strukturu, šířku 235 px a nejvýše čtyři řádky. Duplicitní discovery geometrie a souběžné/fadující tooltipy se odstraní.

## Kontroly v prohlížeči

Izolovaný testovací origin :5182 používal skutečné parcely 1641 a 1647, k. ú. 649864, bez zásahu do uložených parcel hlavního náhledu :5181. Desktop 1440×900, mobil 390×844 a výchozí velikost náhledu. Dočasné změny velikosti jsou vrácené.

- Kategorie Jižní sad, vlastní název Sad u cesty vedle čísla 1641, jabloň a hrušeň: po obnovení zachované. Souhrn 2 ploch, 0,19 ha, 218 stromů; základní návratnost rok 9.
- Ruční HPJ 90 byla odmítnuta a původní skóre zůstalo 79. Ruční srážky 0 vytvořily označený smíšený scénář se skóre 59; obnovení zachovalo 0, druhá parcela měla dál 75 a prázdný vlastní vstup. Reset vrátil 79. Vyplnění a použití fungovalo také na mobilu.
- Přepínání analýzy mezi oběma parcelami přes pole i seznam zachovalo otevřenou analýzu. Otevření navigací začalo bez vybraného pozemku. Sbalení/rozbalení ekonomického výpočtu funguje.
- Řazení výměry změnilo pořadí oběma směry. Filtr hrušně dal 1/2, kombinace s vhodností od 90 dala srozumitelný prázdný výsledek, reset vrátil 2/2.
- Neplatná dělicí čára mimo parcelu zobrazila chybu. Platná čára dala části 0,05 + 0,06 ha; součet odpovídá původní ploše. Potvrzení a vrácení zachovalo kategorii a plochu. Následné spojení sousedících částí zachovalo souhrn 0,19 ha; neplatné dřívější undo se zruší, aby vedle spojení neobnovilo překrývajícího rodiče.
- Zrušení hromadného odstranění zachovalo plochy. Potvrzení odstranilo pět testovacích ploch včetně pracovních částí; po obnovení se nevrátily a kategorie zůstala prázdná. Hlavní náhled zachoval obě původní uložené parcely 1641 a 853/9.
- Tmavé přejmenování i potvrzení odstranění jsou vizuálně čitelné. Výpočet kontrastů explicitních barev: 6,9–13,4 : 1. Při přepnutí na světlé téma zůstaly funkce dostupné.
- Otevření již viditelného štítku Skutečná data na mobilu zachovalo přesnou pozici i rozměry (x 244,24; y 405,83; 97,43×28 px). Vysvětlivka podporuje zavření/Escape. Posuvný panel měl odsazení přibližně 8,67 px od rámu; šířka dokumentu i viewportu 390 px. Návrat mezi záložkami detailu vrací posuv na začátek; výměra je mimo oblast zavíracího tlačítka.

Snímky: [přehled desktop](categories-overview-dark.jpg), [scénáře](category-scenarios-desktop.jpg), [scénáře mobil](category-scenarios-mobile.jpg), [filtry mobil](parcel-overview-mobile.jpg), [přejmenování](rename-dark-mobile.jpg), [odstranění](bulk-delete-dark-mobile.jpg), [tooltip](parcel-tooltip-final.jpg), [hlavní náhled](final-map-dark.jpg).

## Automatické kontroly

PASS: TypeScript, produkční Vite build, testy regional, regional-status, regional-lifecycle, automatic-coverage, parcel-coverage, theme, parcel-categories, parcel-overview, manual-inputs, geometry-operations, no-demo a verify-open-data. Dostupnost porovnána na 46 skutečných geometriích, geometrické testy zahrnují plochu/otvory/multipolygony. Ruční testy pokrývají změnu skutečného modelu, kombinaci zdrojů, limity, neplatné/osiřelé záznamy a neměnnost původních dat.

Finální build: hlavní JS 359,89 kB (gzip 117,62), samostatná mapa 149,76 kB, geometrie 49,45 kB; bez varování o velkém chunku. Nový otevřený dataset nebyl přidán. Návrhy DMR 5G, historie ČHMÚ a ALADIN v [DATA_CANDIDATES.md](../DATA_CANDIDATES.md) jsou oddělené návrhy integrace, nikoli příslib již fungující předpovědi výnosu. Přímý CORS nových numerických zdrojů není ověřený.
