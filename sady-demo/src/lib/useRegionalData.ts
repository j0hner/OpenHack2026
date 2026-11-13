import {useEffect,useMemo,useRef,useState} from 'react';
import type {AnalysisArea} from './types';
import {geometryKey,loadRegionalData} from './regionalData';

export function useRegionalData(areas:AnalysisArea[],wantedIds:string[],realMode:boolean){
 const [records,setRecords]=useState<Record<string,AnalysisArea['regional']>>({});
 const [retry,setRetry]=useState({key:'',seq:0});
 const lastRetry=useRef(0);
 const wanted=areas.filter(a=>realMode&&a.kind==='sample'||wantedIds.includes(a.id)&&(realMode||a.kind!=='sample'));
 const signature=wanted.map(a=>geometryKey(a.geometry)).sort().join('|');
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  const forceKey=retry.seq>lastRetry.current?retry.key:'';lastRetry.current=retry.seq;
  const todo=[...new Map(wanted.map(a=>[geometryKey(a.geometry),a])).values()].filter(a=>records[geometryKey(a.geometry)]?.status!=='ready'||forceKey===geometryKey(a.geometry));
  const worker=async()=>{
   while(active&&todo.length){
    const area=todo.shift()!,key=geometryKey(area.geometry);
    setRecords(previous=>({...previous,[key]:{status:'loading',data:null}}));
    try{
     const data=await loadRegionalData(area.geometry,controller.signal,forceKey===key);
     if(active)setRecords(previous=>({...previous,[key]:{status:'ready',data}}));
    }catch(error){if(active)setRecords(previous=>({...previous,[key]:{status:'error',data:null,message:error instanceof Error?error.message:'Podklady se nepodařilo načíst.'}}));}
   }
  };
  void worker();void worker();
  return()=>{active=false;controller.abort();};
  // Geometry, not display name or fruit choice, determines the data request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[signature,retry.seq]);
 const evaluated=useMemo(()=>areas.map(a=>{
  if(!realMode&&a.kind==='sample')return a;
  const regional=records[geometryKey(a.geometry)]??{status:'loading' as const,data:null};
  return {...a,regional,attributes:{soil:null,climate:null,water:null,terrain:null,access:null,constraints:null},availability:{soil:'missing' as const,climate:'missing' as const,water:'missing' as const,terrain:'missing' as const,access:'missing' as const},sourceNote:(a.derivedFrom?a.sourceNote+' ':'')+'Hodnocení z otevřených dat přiřazených geometrií a souřadnicemi; regionální údaje jsou označené. Žádný profil jiné lokality.',story:a.derivedFrom?a.story:a.kind==='sample'?'Ukázková geometrie hodnocená skutečnými podklady podle polohy.':a.kind==='parcel'?'Skutečná parcela. Druh pozemku sám o sobě nepotvrzuje povolení výsadby.':'Vlastní geometrie hodnocená skutečnými podklady podle polohy.'};
 }),[areas,records,realMode]);
 return {areas:evaluated,retry:(area:AnalysisArea)=>setRetry(previous=>({key:geometryKey(area.geometry),seq:previous.seq+1}))};
}
