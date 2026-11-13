import {useMemo,useState} from 'react';
import {areaHa} from '../lib/geo';
import {fmtHa} from '../lib/format';
import {splitGeometry,mergeGeometries,type SplitDirection} from '../lib/geometryOperations';
import type {AnalysisArea,AreaGeometry} from '../lib/types';

interface Props {
 activeArea:AnalysisArea|null;
 selectedAreas:AnalysisArea[];
 onSplit:(sourceId:string,parts:AreaGeometry[])=>void;
 onMerge:(sourceIds:string[],geometry:AreaGeometry,name:string)=>void;
}
export default function GeometryTools({activeArea,selectedAreas,onSplit,onMerge}:Props){
 const [direction,setDirection]=useState<SplitDirection>('north-south'),[count,setCount]=useState(2),[position,setPosition]=useState(50),[mergeName,setMergeName]=useState('Spojená plocha');
 const split=useMemo(()=>{
  if(!activeArea)return {parts:[] as AreaGeometry[],error:''};
  try{return {parts:splitGeometry(activeArea.geometry,direction,count,position),error:''};}
  catch(error){return {parts:[] as AreaGeometry[],error:error instanceof Error?error.message:'Plochu nelze rozdělit.'};}
 },[activeArea?.geometry,direction,count,position]);
 const merged=useMemo(()=>{
  if(selectedAreas.length<2)return {geometry:null,error:''};
  try{return {geometry:mergeGeometries(selectedAreas.map(a=>a.geometry)),error:''};}
  catch(error){return {geometry:null,error:error instanceof Error?error.message:'Plochy nelze spojit.'};}
 },[selectedAreas]);
 return <section className="panel-section" aria-label="Dělení a spojování ploch">
  <div className="section-title">Dělení a spojování ploch</div>
  <p className="field-note">Vytvoří nové samostatně pojmenovatelné plochy. Původní pozemky zůstanou uložené; každá nová geometrie dostane vlastní hodnocení. Katastr se nemění.</p>
  <details className="accordion" style={{marginTop:8}}>
   <summary>Rozdělit aktivní plochu</summary>
   <div className="accordion-body">
    {!activeArea?<p className="small">Nejprve vyberte plochu v seznamu nebo v mapě.</p>:<>
     <p className="small"><strong>{activeArea.name}</strong> · {fmtHa(areaHa(activeArea.geometry))}</p>
     <div className="region-grid">
      <label className="field"><span>Směr dělicích hranic</span><select aria-label="Směr dělicích hranic" value={direction} onChange={e=>setDirection(e.target.value as SplitDirection)}><option value="north-south">Sever–jih (svisle)</option><option value="east-west">Východ–západ (vodorovně)</option></select></label>
      <label className="field"><span>Počet pásů</span><select aria-label="Počet pásů" value={count} onChange={e=>setCount(Number(e.target.value))}>{[2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
     </div>
     {count===2&&<label className="field" style={{marginTop:8}}><span>Poloha dělení: {position} % šířky</span><input aria-label="Poloha dělení" type="range" min={10} max={90} step={1} value={position} onChange={e=>setPosition(Number(e.target.value))}/></label>}
     <p className="field-note">Hranice řeže skutečný polygon, včetně otvorů. Pásy mají stejnou šířku, nikoli nutně stejnou výměru. Prázdné pásy nevytvoří novou plochu.</p>
     {split.error?<p className="notice error" role="alert">{split.error}</p>:<ul className="plain-list">{split.parts.map((g,i)=><li className="small" key={i}>Část {i+1}: {fmtHa(areaHa(g))}</li>)}</ul>}
     <button type="button" className="btn primary" style={{marginTop:8}} disabled={split.parts.length<2} onClick={()=>onSplit(activeArea.id,split.parts)}>Vytvořit {split.parts.length||count} samostatné části</button>
    </>}
   </div>
  </details>
  <details className="accordion" style={{marginTop:8}}>
   <summary>Spojit vybrané plochy ({selectedAreas.length})</summary>
   <div className="accordion-body">
    <p className="small">Vyberte 2 až 20 ploch pomocí karet nebo mapy. Překryvy se započítají pouze jednou; oddělené plochy vytvoří jednu vícedílnou pracovní geometrii.</p>
    <ul className="plain-list">{selectedAreas.map(a=><li key={a.id} className="small">{a.name}</li>)}</ul>
    <label className="field"><span>Název spojené plochy</span><input aria-label="Název spojené plochy" maxLength={100} value={mergeName} onChange={e=>setMergeName(e.target.value)}/></label>
    {merged.error&&<p className="notice error" role="alert">{merged.error}</p>}
    {merged.geometry&&<p className="small">Společná výměra bez překryvů: <strong>{fmtHa(areaHa(merged.geometry))}</strong></p>}
    <button type="button" className="btn primary" style={{marginTop:8}} disabled={!merged.geometry||!mergeName.trim()} onClick={()=>merged.geometry&&onMerge(selectedAreas.map(a=>a.id),merged.geometry,mergeName)}>Vytvořit spojenou plochu</button>
   </div>
  </details>
 </section>;
}
