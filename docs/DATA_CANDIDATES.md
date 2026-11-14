# Doplnění dat pro Moje Sady

Prověřeno 14. 11. 2026 na oficiálních zdrojích. Jde o návrhy další integrace; tyto nové datové sady zatím nejsou součástí výpočtu ani distribuovaného balíku. Současný index vhodnosti zůstává orientačním hodnocením BPEJ a historického klimatu, nikoli pravděpodobností úspěchu nebo předpovědí sklizně.

## 1. ČÚZK DMR 5G – doplnit terén

**Největší přínos pro vhodnost:** výška, sklon, orientace svahu a relativní poloha vůči okolnímu terénu. Ta může pomoci vytipovat mrazové kotliny; sama neprokazuje poškození stromů mrazem.

- [Oficiální rozcestník otevřených dat a licence CC BY 4.0](https://ags.cuzk.cz/opendata/).
- [Konkrétní DMR 5G ImageServer](https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer): služba uvádí surový výškový rastr, pixel 2 m a výškový systém Bpv. Barevné stínování nebo RGB mapa sklonu nejsou číselným výškovým podkladem.
- [Formy poskytování ČÚZK](https://geoportal.cuzk.cz/Dokumenty/Formy_poskytovani_dat_ZU.pdf): LAZ/TXT a export výřezu přes Geoprohlížeč. Nestahovat celou republiku do aplikace.

**Spojení a zpracování:** oříznout model polygonem parcely, navíc vhodným okolním výřezem pro relativní terén. Z výškové mřížky v metrickém CRS spočítat medián a rozsah výšek, sklon a orientaci. Uložit kompaktní výsledky s klíčem geometrie, rozlišením a datem do JSON; pro nové libovolné parcely zajistit odpovídající prostorový výřez. Jeden bod uprostřed parcely nestačí pro sklon celé plochy.

**GitHub Pages:** upřednostnit předzpracování vybraných výřezů v GDAL/PDAL a malé výsledné JSON/rastry načítané podle polohy. Přímé numerické API a CORS je nutné ověřit; zkušební operace `getSamples` v této relaci nevrátila JSON, proto na ní návrh nezávisí. Prohlížecí WMS samo nezaručuje dostupnost číselných výšek. Doplnění terénu nevyžaduje návrat dříve odstraněné terénní mapové vrstvy.

## 2. ČHMÚ – skutečná staniční historie

**Přínos pro klimatická rizika:** ověření regionálního ERA5 pomocí naměřených minimálních teplot a srážek, místní četnost mrazových nocí, průběh suchých období a úplnost historických řad.

- [Oficiální informace o otevřených datech ČHMÚ a licenci CC BY 4.0](https://www.chmi.cz/-/kde-najdu-otev%C5%99en%C3%A1-data-%C4%8Dhm%C3%BA-).
- [Metadata stanic v CSV](https://opendata.chmi.cz/meteorology/climate/historical_csv/metadata/) a [popis struktury](https://opendata.chmi.cz/meteorology/climate/Klimatologicka_data_popis.pdf).
- [Denní teploty](https://opendata.chmi.cz/meteorology/climate/historical_csv/data/daily/temperature/): například `dly-0-20000-0-11406-TMI.csv` pro minimum.
- [Denní srážky](https://opendata.chmi.cz/meteorology/climate/historical_csv/data/daily/precipitation/): soubory prvku `SRA`. Dostupná je také JSON distribuce.

**Spojení a zpracování:** propojit identifikátor stanice, její souřadnice, výšku a období měření. K parcele přiřadit relevantní okolní stanice podle vzdálenosti i výškového rozdílu a uvést tyto parametry. Kontrolovat platnost stanice v jednotlivých letech, chybějící dny, měřené veličiny a kvalitu; nepovažovat nejbližší měření automaticky za mikroklima parcely.

**GitHub Pages:** stáhnout jen vybrané prvky a použitelné stanice, předpočítat roční/jarní agregace a rozdíly vůči ERA5; distribuovat kompaktní regionální JSON. Některé surové CSV mají jednotky MB, proto je netahat pro každé kliknutí. CORS přímého CSV přístupu není v této práci ověřený. Dlouhodobou vhodnost nelze vyvozovat z několika posledních dnů.

## 3. ČHMÚ ALADIN – krátkodobé varování pro péči o sad

**Přínos:** předpovězená minima teplot, srážky a vítr pro blízké dny mohou doplnit upozornění na blížící se mráz a plánování péče. To je jiná úloha než odhad návratnosti nebo dlouhodobého úspěchu nového sadu.

- [Oficiální adresář ALADIN](https://opendata.chmi.cz/meteorology/weather/nwp_aladin/) obsahuje dokumentaci parametrů a tabulky GRIB.
- [Distribuce CZ_1km](https://opendata.chmi.cz/meteorology/weather/nwp_aladin/CZ_1km/00/) obsahuje komprimované `.grb.bz2`, například minima `CLSMINI_TEMPERAT` a teplotu `CLSTEMPERATURE`.
- [Oficiální informace o aktualizaci](https://www.chmi.cz/-/jak-casto-aktualizujete-predpoved): numerické předpovědi se aktualizují čtyřikrát denně. Distribuční mřížka 1 km není příslibem parcelní přesnosti.

**Spojení a zpracování:** bod/polygon parcely spojit s mřížkou a konkrétním během modelu; uchovat čas vydání i platnosti a označit zastaralou předpověď. Provozní varování posuzovat odděleně od indexu historické vhodnosti. Poškození květů nelze spočítat bez fenofáze a relevantního prahu pro odrůdu/podnož.

**GitHub Pages:** GRIB dekomprimovat a zpracovat pomocí ecCodes/GDAL mimo prohlížeč, připravit malé prostorově dělené JSON. Čerstvá předpověď potřebuje pravidelné obnovení dat; jednorázově přibalený soubor zestárne. Přímé tahání desítek MB GRIB do stránky nedoporučuji. Licence ČHMÚ je popsána v odkazu výše; metadata konkrétní distribuce patří k implementační kontrole.

## Co nepřidávat automaticky

- [SoilGrids](https://isric.org/explore/soilgrids): může doplnit regionální model pH a uhlíku, ale oficiální stránka aktuálně uvádí pozastavené REST API. Nestavět na něm živý povinný vstup; případný statický výřez musí být označený jako modelový odhad s nejistotou.
- [LUCAS 2018 TOPSOIL](https://esdac.jrc.ec.europa.eu/content/lucas-2018-topsoil-data): naměřené chemické vlastnosti jsou užitečné pro odborné ověřování, ale distribuce vyžaduje registraci a zvláštní podmínky dalšího šíření. Nejde o vhodný automatický přídavek do veřejného repozitáře; řídké body navíc nereprezentují konkrétní parcelu.
- [LPIS DPB](https://mze.gov.cz/public/app/eagriapp/LpisData/Cr.aspx): pro ověření zemědělského využití a návaznost na hospodaření má smysl později, ale samo nezměří půdu, vodu ani výnos. Celostátní export by pro aktuální výpočty přidal více dat než nové informace. Podmínky konkrétní distribuce je třeba ověřit před přidáním.

**Doporučené pořadí:** DMR 5G a historie ČHMÚ pro zlepšení dlouhodobého hodnocení, ALADIN následně pro samostatná provozní upozornění. Nejprve validovat na skutečných pozemcích a přiznat chybějící pokrytí; nové zdroje nemají pouze zvýšit počet barevných ukazatelů.
