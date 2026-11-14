import {FRUITS} from '../data/fruitProfiles';
import type {AnalysisArea,CategoryKey,CategoryScore,FruitKey,SuitabilityResult} from './types';
import type {RegionalData} from './regionalData';
import {mean} from './openData';

// HPJ ranges follow VÚMOP's soil groups. The numeric suitability values are our
// explicit screening heuristic, not BPEJ official ratings or measured chemistry.
export const SOIL_GROUPS=[
 [1,8,90,'černozemě'],[9,13,85,'hnědozemě'],[14,17,80,'luvizemě'],
 [18,20,65,'rendziny a pararendziny'],[21,23,50,'regozemě'],[24,33,70,'kambizemě'],
 [34,36,45,'půdy chladných oblastí'],[37,39,20,'mělké půdy'],[40,41,30,'silně svažité půdy'],
 [42,54,40,'pseudogleje'],[55,59,65,'fluvizemě'],[60,63,60,'černice'],[64,78,20,'gleje'],
 [79,81,60,'koluvizemě'],[82,89,35,'antropozemě'],
] as const;
const weights:Record<CategoryKey,number>={soil:35,climate:40,water:25,terrain:0,access:0};
const labels:Record<CategoryKey,string>={soil:'Půda',climate:'Klima',water:'Vláha',terrain:'Terén',access:'Provoz'};
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
const fmt=(n:number)=>n.toLocaleString('cs-CZ',{maximumFractionDigits:1});
export const validClimateYears=(data:RegionalData|null|undefined)=>data?.climate?.years.filter(y=>[y.temperatureMeanC,y.rainfallMm,y.et0Mm,y.springFrostDays,y.summerDays].every(v=>v!==null&&Number.isFinite(v)))??[];

export function scoreRegionalArea(area:AnalysisArea,fruit:FruitKey):SuitabilityResult{
 const data=area.regional?.data,req=FRUITS[fruit].requirements,years=validClimateYears(data);
 const raw:Partial<Record<CategoryKey,{score:number;summary:string}>>={};
 const soil=data?.soil;
 if(soil?.valid&&soil.coveragePct>=80){
  const parts=soil.parts.map(p=>({p,group:SOIL_GROUPS.find(g=>Number(p.name.slice(1,3))>=g[0]&&Number(p.name.slice(1,3))<=g[1])}));
  const rated=parts.filter(p=>p.group);
  const coverage=rated.reduce((s,x)=>s+x.p.percent,0);
  if(coverage>=80)raw.soil={score:clamp(rated.reduce((s,x)=>s+x.p.percent*x.group![2],0)/coverage),summary:`BPEJ pokrývá ${fmt(soil.coveragePct)} % plochy. ${rated.map(x=>`${x.p.name} (${x.group![3]}): ${fmt(x.p.percent)} %`).join('; ')}. Index dle skupiny HPJ; pH, humus a skutečná hloubka neznámé.`};
 }
 if(years.length>=15){
  const t=mean(years.map(y=>y.temperatureMeanC))!,rain=mean(years.map(y=>y.rainfallMm))!,et=mean(years.map(y=>y.et0Mm))!,frost=mean(years.map(y=>y.springFrostDays))!,hot=mean(years.map(y=>y.summerDays))!;
  const deviation=Math.max(req.tempOptMinC-t,t-req.tempOptMaxC,0);
  raw.climate={score:clamp(95-deviation*12-Math.min(45,Math.max(0,frost-10)*req.frostSensitivity*.7)-Math.max(0,req.heatNeed*5-hot)*.8),summary:`${years.length} úplných let (${data!.climate!.period}), Ø ${fmt(t)} °C, ${fmt(frost)} mrazových dnů březen–květen, ${fmt(hot)} letních dnů. Regionální reanalýza; mrazy nejsou odhad škody v květu.`};
  const deficit=Math.max(0,req.rainfallOptMm-rain),balance=Math.max(0,et-rain);
  raw.water={score:clamp(100-deficit*.22-(balance/Math.max(et,1))*55*(1+(3-req.droughtTolerance)*.15)),summary:`Ø srážky ${fmt(rain)} mm/rok, ET0 ${fmt(et)} mm/rok; P−ET0 = ${fmt(rain-et)} mm. Jde o klimatickou bilanci, nikoli měřenou půdní vláhu ani potřebu závlahy.`};
 }
 const categories:CategoryScore[]=(Object.keys(weights)as CategoryKey[]).filter(key=>weights[key]>0).map(key=>({key,label:labels[key],weight:weights[key],score:raw[key]?.score??null,status:raw[key]?'partial':'missing',availability:raw[key]?'partial':'missing',summary:raw[key]?.summary??(key==='soil'?`BPEJ: ${soil?fmt(soil.coveragePct)+' % pokrytí':'nedostupná'}. Pro půdní index je nutné alespoň 80 % platného pokrytí.`:key==='climate'||key==='water'?`Klima má ${years.length} úplných let; potřebujeme alespoň 15 z období 2005–2024.`:key==='access'?'Právní přístup a sjízdnost cest nejsou ověřené.':'Výškové podklady pro tuto geometrii nejsou dostatečné.')}));
 const available=categories.filter(c=>c.score!==null),availableWeight=available.reduce((s,c)=>s+c.weight,0);
 const completeness=Math.round(availableWeight*.6);
 const enough=!!raw.soil&&!!raw.climate&&!!raw.water&&availableWeight>=70;
 const overall=enough?Math.round(available.reduce((s,c)=>s+c.score!*c.weight,0)/availableWeight):null;
 const constraints=(data?.protected??[]).map(p=>({label:p.name,detail:`Ochrana přírody zasahuje ${fmt(p.percent)} % plochy; podmínky výsadby ověřte u příslušného orgánu.`}));
 const restrictive=['lesní pozemek','vodní plocha','zastavěná plocha a nádvoří'].includes(area.landUse);
 if(restrictive)constraints.push({label:'Druh pozemku',detail:`${area.landUse}: nejde o běžnou zemědělskou plochu pro založení sadu. Vyžaduje samostatné prověření.`});
 let verdict:SuitabilityResult['verdict']=overall===null?'Nedostatek dat':overall>=75?'Vhodný':overall>=55?'Vhodný s opatřeními':'Rizikový';
 if(overall!==null&&available.some(c=>c.score!<30))verdict='Rizikový';
 if(overall!==null&&restrictive)verdict='Rizikový';
 if(verdict==='Vhodný'&&(constraints.length||req.frostSensitivity>=4&&years.some(y=>y.springFrostDays!>=18)))verdict='Vhodný s opatřeními';
 const reasons=available.slice().sort((a,b)=>a.score!-b.score!).map(c=>`${c.label}: ${c.summary}`).slice(0,3);
 if(!enough)reasons.unshift(area.regional?.status==='loading'?'Načítám skutečné podklady pro polohu a polygon pozemku.':'Pro souhrnné skóre chybí dostatečné pokrytí BPEJ nebo úplná klimatická řada.');
 while(reasons.length<3)reasons.push(data?.errors[reasons.length-1]??'Chybějící údaje nenahrazujeme profilem jiné lokality.');
 const risks:SuitabilityResult['risks']=available.filter(c=>c.score!<60).map(c=>({label:c.label,detail:c.summary,severity:c.score!<30?'high':'medium'}));
 risks.push({label:'Neověřené vlastnosti parcely',detail:'Chybí půdní rozbor (pH, humus, skutečná hloubka), mikroklima, zdroj závlahy, Q100 a právně zajištěný příjezd.',severity:'medium'});
 for(const c of constraints)risks.push({label:c.label,detail:c.detail,severity:'high'});
 for(const error of data?.errors??[])risks.push({label:'Nedostupný podklad',detail:error,severity:'medium'});
 return {fruit,overall,verdict,verdictClass:verdict==='Nedostatek dat'?'nodata':verdict==='Vhodný'?'good':verdict==='Rizikový'?'risk':'caution',categories,completeness,missing:categories.filter(c=>c.score===null).map(c=>c.label),reasons:reasons.slice(0,3),risks,constraints,
  nextSteps:['Potvrdit půdní vlastnosti rozborem a ověřit hloubku profilu.','Prověřit mikroklima a mrazové kotliny přímo na pozemku.','Ověřit přístup, vodu, záplavy a právní podmínky založení sadu.'],
  assumptions:['Index kombinuje skutečná prostorová data s orientačními pravidly a pěstitelskými profily Moje Sady; nejde o validovanou pravděpodobnost úspěchu ani předpověď výnosu.','Váhy regionálního indexu: půda 35 / klima 40 / vláha 25. Terén a provoz nejsou součástí indexu; chybějící povinný podklad zablokuje celkové skóre.','Půda dle HPJ je pouze orientační screening; klimatické údaje patří gridu širší oblasti, nikoli mikroklimatu parcely.','Úplnost snižujeme na 60 % dostupných vah kvůli regionálním a částečným podkladům. Závlaha v tomto indexu nemění klima ani automaticky nedoplňuje vodu.'],
 };
}
