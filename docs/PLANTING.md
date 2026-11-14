# Plán rozmístění stromů

V detailu pozemku otevřete **Výsadba**, vyberte ovocný druh a typ výsadby a použijte **Navrhnout rozmístění**. Stejný plánovač je v samostatné záložce Výsadba v analýze. Mapa ukáže jednotlivé stromy a souvislé úseky řad. Zadané změny se použijí až po přepočtu; zobrazení lze vypnout a plán exportovat jako GeoJSON.

## Odborný podklad

Malé profily vycházejí z [MENDELU – Výsadbový plán ovocného sadu](https://web2.mendelu.cz/af_291_projekty/files/10/skripta/index.php?I=8&J=0&K=0&N=4), části o sponech. Ověřeno 14. 11. 2026. Jde o odbornou referenci pro nastavitelné modelové profily, nikoli měřený otevřený prostorový dataset. Do repozitáře se nekopíruje článek ani velká nová datová sada.

| Druh | Výchozí plánovací spon řady × stromy |
|---|---|
| Jabloň, zakrslá podnož / stěna | 4 × 1,5 m |
| Hrušeň, stěnová výsadba | 4 × 2,5 m |
| Slivoň, pásová výsadba | 5 × 3,5 m |
| Třešeň, nižší stěnový tvar | 5 × 3 m |
| Meruňka, pásová výsadba | 6,5 × 4,5 m |

Celkem osm profilů nabízí i volnější varianty jabloní, hrušní a třešní. Zvolené výchozí hodnoty leží v publikovaných rozsazích. Podnož, odrůda, vedení koruny a mechanizace musí odpovídat vybranému typu; spon není univerzální vlastnost druhu. Původní pěstitelské a ekonomické předpoklady zůstávají oddělené.

## Co optimalizace řeší

- Počítá v metrech v lokální azimutální projekci; nepoužívá stupně jako metry ani neopravené měřítko Web Mercatoru.
- Respektuje přesný Polygon/MultiPolygon, všechny otvory, odstup od jejich hranic a místo na obou koncích každého souvislého úseku řady. Výchozí provozní rezervy jsou 3 m od hranice a další 4 m na koncích řad; jsou nastavitelné a nejsou potvrzením právních odstupů.
- Zkouší omezený počet směrů a posunů pravidelné sítě, poté vybere nejlepší nalezené rozmístění pro zadané podmínky. Ruční směr se měří od severu: 0° sever–jih, 90° východ–západ. Není to důkaz globálního agronomického optima.
- Stromy mají skutečné souřadnice a řady nepřemosťují díry ani mezery. Drobné bezpečnostní rezervy brání numerickému umístění těsně přes okraj.

Sklon, zastínění, sítě, existující stromy, opylovací odrůdy a průjezd konkrétní techniky nejsou v tomto geometrickém modelu ověřené. Výstup slouží plánování, nikoli geodetickému vytyčení nebo předpovědi úrody.

## Rozdělené a spojené pozemky

Každá plocha a ovocný druh mají vlastní plán. Nové části ani spojení nepřebírají souřadnice nebo počet stromů z jiné geometrie. Po výběru nového tvaru se počítá nový plán; u spojení se odstraněná vnitřní hranice už nepovažuje za okraj. Původní plán zůstává u původní plochy. Přejmenování jej nemění, změna geometrie nebo ovocného druhu nesmí použít cizí výsledek. Vrácení dělení a mazání odstraní plány zaniklých částí.

Počet stromů z platného plánu nahrazuje plošný odhad v nákladech na sazenice, výsadbu a roční provoz na strom, včetně součtů kategorií. Budoucí výnos t/ha zůstává samostatným vstupem scénáře. Plán bez stromů má nulové tržby z ovoce; případná modelová podpora je oddělený předpoklad.

## Výkon a uložení

Výpočet běží ve Web Workeru. Hranice: 100 ha, 3 km úhlopříčky, 1 200 vrcholů, 64 obrysů včetně otvorů a 10 000 stromů; složitost má další početní limit. Překročení vrátí vysvětlení a žádný zavádějící částečný počet. Ruční směr může snížit náročnost; jinak lze plochu rozdělit. Časový limit pracovníka je 30 s.

LocalStorage ukládá pouze nastavení a ověřený souhrn s verzí algoritmu, geometrií a druhem; tisíce bodů se neukládají. Po obnovení se souřadnice rekonstruují. Paměťová cache drží nejvýše pět plánů. Zastaralé výpočty se ukončí při změně plochy/druhu; neúspěšný návrh nepřepíše poslední platný plán. Mapa kreslí řady a stromy přes Canvas, nikoli tisíce DOM značek.

Kontroly: `test:planting`, `test:planting-profiles`, `test:planting-economics`, `test:planting-persistence`, TypeScript a build. Prohlížečové výsledky jsou v [ověřovacím protokolu](qa/planting-planner.md).
