import {area} from '@turf/area';
import {bbox} from '@turf/bbox';
import {intersect} from '@turf/intersect';
import {union} from '@turf/union';
import type {Feature,FeatureCollection,Polygon,MultiPolygon} from 'geojson';
import type {AnalysisArea,AreaGeometry} from './types';

type Surface=Polygon|MultiPolygon;
export type SplitDirection='north-south'|'east-west';
const feature=(geometry:AreaGeometry):Feature<Surface>=>({type:'Feature',properties:{},geometry});
const collection=(geometries:AreaGeometry[]):FeatureCollection<Surface>=>({type:'FeatureCollection',features:geometries.map(feature)});
const tolerance=(size:number)=>Math.max(.1,size*.00001);

export function validateWorkingGeometry(geometry:AreaGeometry):void{
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 if(!polygons.length)throw Error('Plocha nemá platnou geometrii.');
 for(const polygon of polygons){
  if(!polygon.length)throw Error('Plocha nemá vnější hranici.');
  for(const ring of polygon){
   if(ring.length<4||ring.some(p=>p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])))throw Error('Hranice plochy obsahuje neplatné souřadnice.');
   const first=ring[0],last=ring[ring.length-1];if(first[0]!==last[0]||first[1]!==last[1])throw Error('Hranice plochy není uzavřená.');
  }
 }
 if(!Number.isFinite(area(geometry))||area(geometry)<1)throw Error('Pracovní plocha musí mít alespoň 1 m².');
}

/** Intersect actual geometry with adjacent bands; retain holes and disconnected parts. */
export function splitGeometry(geometry:AreaGeometry,direction:SplitDirection,count=2,positionPct=50):AreaGeometry[]{
 validateWorkingGeometry(geometry);
 if(!Number.isInteger(count)||count<2||count>8)throw Error('Zvolte 2 až 8 částí.');
 if(positionPct<10||positionPct>90||!Number.isFinite(positionPct))throw Error('Umístěte dělení mezi 10 a 90 % šířky.');
 const [w,s,e,n]=bbox(geometry),vertical=direction==='north-south',low=vertical?w:s,high=vertical?e:n;
 if(high<=low)throw Error('Plochu nelze v tomto směru rozdělit.');
 const stops=[low,...Array.from({length:count-1},(_,i)=>low+(high-low)*(count===2?positionPct/100:(i+1)/count)),high];
 const parts:AreaGeometry[]=[];
 for(let i=0;i<count;i++){
  const a=stops[i],b=stops[i+1];
  const coordinates=vertical?[[a,s],[b,s],[b,n],[a,n],[a,s]]:[[w,a],[e,a],[e,b],[w,b],[w,a]];
  const clipped=intersect(collection([geometry,{type:'Polygon',coordinates:[coordinates]}]));
  if(clipped&&area(clipped)>.000001)parts.push(clipped.geometry);
 }
 if(parts.length<2)throw Error('Dělicí hranice nevytváří alespoň dvě neprázdné části. Změňte směr nebo polohu dělení.');
 parts.forEach(validateWorkingGeometry);
 const original=area(geometry),sum=parts.reduce((total,g)=>total+area(g),0),allowed=tolerance(original);
 if(Math.abs(sum-original)>allowed)throw Error('Dělení nezachovalo celou výměru. Zvolte jiný směr nebo menší plochu.');
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
  const shared=intersect(collection([parts[i],parts[j]]));
  if(shared&&area(shared)>allowed)throw Error('Vytvořené části se překrývají; dělení se neuložilo.');
 }
 return parts;
}

export function mergeGeometries(geometries:AreaGeometry[]):AreaGeometry{
 if(geometries.length<2||geometries.length>20)throw Error('Pro spojení vyberte 2 až 20 ploch.');
 geometries.forEach(validateWorkingGeometry);
 const merged=union(collection(geometries));
 if(!merged)throw Error('Vybrané geometrie se nepodařilo spojit.');
 validateWorkingGeometry(merged.geometry);
 const mergedSize=area(merged),sum=geometries.reduce((total,g)=>total+area(g),0),largest=Math.max(...geometries.map(g=>area(g)));
 if(mergedSize>sum+tolerance(sum)||mergedSize<largest-tolerance(largest))throw Error('Výsledek spojení má neplatnou výměru.');
 return merged.geometry;
}

export type WorkingArea=AnalysisArea&{derivedFrom:{operation:'split'|'merge';sourceIds:string[];sourceNames:string[]}};
export function makeWorkingArea(geometry:AreaGeometry,name:string,sources:AnalysisArea[],operation:'split'|'merge'):WorkingArea{
 validateWorkingGeometry(geometry);
 if(!sources.length)throw Error('Chybí zdrojová plocha.');
 const id='working-'+(globalThis.crypto?.randomUUID?.()??`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
 const same=(key:'katastr'|'obec'|'okres'|'kraj')=>sources.every(s=>s.location[key]===sources[0].location[key])?sources[0].location[key]:'více území';
 return {id,name:name.trim().slice(0,100)||'Pracovní plocha',kind:'custom',geometry,landUse:'pracovní vymezení',location:{code:'PRACOVNÍ',katastr:same('katastr'),obec:same('obec'),okres:same('okres'),kraj:same('kraj')},attributes:{soil:null,climate:null,water:null,terrain:null,access:null,constraints:null},availability:{soil:'missing',climate:'missing',water:'missing',terrain:'missing',access:'missing'},sourceNote:`Pracovní geometrie: ${operation==='split'?'rozdělení':'spojení'} ploch ${sources.map(s=>s.name).join(', ')}. Podklady se nově přiřazují podle výsledné geometrie.`,story:'Úprava pracovní plochy v aplikaci. Nejde o právní změnu hranic parcel ani vlastnictví v katastru.',derivedFrom:{operation,sourceIds:sources.map(s=>s.id),sourceNames:sources.map(s=>s.name)}};
}
