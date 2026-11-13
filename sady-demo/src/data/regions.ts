/**
 * Územní číselník pro výběr oblasti.
 *
 * Kraje a jejich kódy odpovídají NUTS3 / RÚIAN. Seznam okresů vychází
 * z administrativního členění ČR (LAU1). Obce a katastrální území jsou
 * v demu zastoupené jen u připravených ukázkových lokalit – úplný číselník
 * obcí a k.ú. (RÚIAN) není součástí statického dema. UI tento stav zobrazuje.
 */

export interface KrajEntry {
  code: string;
  name: string;
}

export interface OkresEntry {
  name: string;
  kraj: string;
}

export interface ObecEntry {
  name: string;
  okres: string;
  katastry: string[];
  areaId?: string;
}

export const KRAJE: KrajEntry[] = [
  { code: 'CZ010', name: 'Hlavní město Praha' },
  { code: 'CZ020', name: 'Středočeský kraj' },
  { code: 'CZ031', name: 'Jihočeský kraj' },
  { code: 'CZ032', name: 'Plzeňský kraj' },
  { code: 'CZ041', name: 'Karlovarský kraj' },
  { code: 'CZ042', name: 'Ústecký kraj' },
  { code: 'CZ051', name: 'Liberecký kraj' },
  { code: 'CZ052', name: 'Královéhradecký kraj' },
  { code: 'CZ053', name: 'Pardubický kraj' },
  { code: 'CZ063', name: 'Kraj Vysočina' },
  { code: 'CZ064', name: 'Jihomoravský kraj' },
  { code: 'CZ071', name: 'Olomoucký kraj' },
  { code: 'CZ072', name: 'Zlínský kraj' },
  { code: 'CZ080', name: 'Moravskoslezský kraj' },
];

export const OKRESY: OkresEntry[] = [
  { name: 'Hlavní město Praha', kraj: 'Hlavní město Praha' },
  ...['Benešov', 'Beroun', 'Kladno', 'Kolín', 'Kutná Hora', 'Mělník', 'Mladá Boleslav', 'Nymburk', 'Praha-východ', 'Praha-západ', 'Příbram', 'Rakovník'].map((name) => ({
    name,
    kraj: 'Středočeský kraj',
  })),
  ...['České Budějovice', 'Český Krumlov', 'Jindřichův Hradec', 'Písek', 'Prachatice', 'Strakonice', 'Tábor'].map((name) => ({
    name,
    kraj: 'Jihočeský kraj',
  })),
  ...['Domažlice', 'Klatovy', 'Plzeň-město', 'Plzeň-jih', 'Plzeň-sever', 'Rokycany', 'Tachov'].map((name) => ({
    name,
    kraj: 'Plzeňský kraj',
  })),
  ...['Cheb', 'Karlovy Vary', 'Sokolov'].map((name) => ({ name, kraj: 'Karlovarský kraj' })),
  ...['Děčín', 'Chomutov', 'Litoměřice', 'Louny', 'Most', 'Teplice', 'Ústí nad Labem'].map((name) => ({
    name,
    kraj: 'Ústecký kraj',
  })),
  ...['Česká Lípa', 'Jablonec nad Nisou', 'Liberec', 'Semily'].map((name) => ({ name, kraj: 'Liberecký kraj' })),
  ...['Hradec Králové', 'Jičín', 'Náchod', 'Rychnov nad Kněžnou', 'Trutnov'].map((name) => ({
    name,
    kraj: 'Královéhradecký kraj',
  })),
  ...['Chrudim', 'Pardubice', 'Svitavy', 'Ústí nad Orlicí'].map((name) => ({ name, kraj: 'Pardubický kraj' })),
  ...['Havlíčkův Brod', 'Jihlava', 'Pelhřimov', 'Třebíč', 'Žďár nad Sázavou'].map((name) => ({
    name,
    kraj: 'Kraj Vysočina',
  })),
  ...['Blansko', 'Brno-město', 'Brno-venkov', 'Břeclav', 'Hodonín', 'Vyškov', 'Znojmo'].map((name) => ({
    name,
    kraj: 'Jihomoravský kraj',
  })),
  ...['Jeseník', 'Olomouc', 'Prostějov', 'Přerov', 'Šumperk'].map((name) => ({ name, kraj: 'Olomoucký kraj' })),
  ...['Kroměříž', 'Uherské Hradiště', 'Vsetín', 'Zlín'].map((name) => ({ name, kraj: 'Zlínský kraj' })),
  ...['Bruntál', 'Frýdek-Místek', 'Karviná', 'Nový Jičín', 'Opava', 'Ostrava-město'].map((name) => ({
    name,
    kraj: 'Moravskoslezský kraj',
  })),
];

export const OBCE: ObecEntry[] = [
  { name: 'Kroměříž', okres: 'Kroměříž', katastry: ['Bílany', 'Kroměříž'], areaId: 'demo-a' },
  { name: 'Staňkovice', okres: 'Louny', katastry: ['Staňkovice u Žatce'], areaId: 'demo-b' },
  { name: 'Horní Maršov', okres: 'Trutnov', katastry: ['Horní Maršov'], areaId: 'demo-c' },
  { name: 'Hustopeče', okres: 'Břeclav', katastry: ['Hustopeče u Brna'], areaId: 'demo-d' },
  { name: 'Třebíč', okres: 'Třebíč', katastry: ['Třebíč'], areaId: 'demo-e' },
];

export const okresyForKraj = (kraj: string) => OKRESY.filter((o) => o.kraj === kraj).map((o) => o.name);

export const obceForOkres = (okres: string) => OBCE.filter((o) => o.okres === okres);
