(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FMEngine=api;})(typeof self!=='undefined'?self:globalThis,function(){
 'use strict';
 const CHANNELS=['focus','chill','workout','calm'];
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 function metadataLabels(track){
  const text=`${track.title||''} ${track.artist||''} ${track.album||''} ${track.genre||''}`.toLowerCase(),tags=[];
  if(/lo[ -]?fi|chill|爵士|jazz|bossa|咖啡|午后/.test(text))tags.push('chill');
  if(/ambient|meditat|sleep|冥想|助眠|平静|静谧|摇篮曲|lullaby|nocturne|夜曲/.test(text))tags.push('calm');
  if(/study|focus|专注|学习|巴赫|bach|钢琴|piano/.test(text))tags.push('focus');
  if(/workout|running|运动|跑步|健身|techno|hardstyle|drum.?and.?bass/.test(text))tags.push('workout');
  return [...new Set(tags)];
 }
 function classify(f,track={}){
  if(!Number.isFinite(f.rms)||f.rms<.0003)return [];
  const energy=clamp(Math.pow(f.rms/.18,.7)),pulse=clamp(f.pulse),bright=clamp(f.brightness),steady=1-clamp(f.dynamics);
  const fast=f.tempoConfidence>.3?clamp((f.bpm-85)/65):clamp(f.onsetRate/3);
  const scores={focus:.35*(1-bright)+.35*(1-pulse)+.2*steady+.1*(1-energy),chill:.35*(1-Math.abs(energy-.4))+.3*(1-pulse)+.2*(1-bright)+.15*steady,workout:.42*pulse+.33*energy+.25*fast,calm:.45*(1-energy)+.35*(1-pulse)+.2*(1-bright)};
  for(const tag of metadataLabels(track))scores[tag]+=.12;
  let labels=CHANNELS.filter(c=>scores[c]>=(c==='workout'?.66:c==='chill'?.63:c==='focus'?.6:.64));
  // Percussive fast music should not enter a calm/study channel just because it is quiet.
  if(pulse>.68)labels=labels.filter(c=>c!=='calm'&&c!=='focus');
  if(!labels.length)labels=[Object.keys(scores).sort((a,b)=>scores[b]-scores[a])[0]];
  return labels;
 }
 function analyze(segments,sampleRate,track={}){
  let totalSquare=0,totalDiff=0,totalSamples=0,duration=0,peaks=0,corrs=[];const energies=[];let fluxSum=0,energySum=0;
  const hop=512,frame=1024;
  for(const samples of segments){
   duration+=samples.length/sampleRate;const env=[];
   for(let i=0;i<samples.length;i++){const x=samples[i];totalSquare+=x*x;if(i)totalDiff+=(x-samples[i-1])**2;totalSamples++;}
   for(let i=0;i+frame<=samples.length;i+=hop){let e=0;for(let j=0;j<frame;j++)e+=samples[i+j]**2;env.push(Math.sqrt(e/frame));}
   const flux=env.map((e,i)=>i?Math.max(0,e-env[i-1]):0);energies.push(...env);fluxSum+=flux.reduce((s,v)=>s+v,0);energySum+=env.reduce((s,v)=>s+v,0);
   const mean=flux.reduce((s,v)=>s+v,0)/(flux.length||1),std=Math.sqrt(flux.reduce((s,v)=>s+(v-mean)**2,0)/(flux.length||1));
   for(let i=1;i<flux.length-1;i++)if(flux[i]>mean+std&&flux[i]>flux[i-1]&&flux[i]>=flux[i+1])peaks++;
   let best={score:0,bpm:0};
   for(let lag=Math.round(60*sampleRate/(180*hop));lag<=Math.round(60*sampleRate/(60*hop));lag++){
    let xy=0,xx=0,yy=0;for(let i=lag;i<flux.length;i++){const a=flux[i]-mean,b=flux[i-lag]-mean;xy+=a*b;xx+=a*a;yy+=b*b;}
    const score=xy/Math.sqrt(xx*yy||1),bpm=60*sampleRate/(lag*hop);
    if(score>best.score)best={score,bpm};
   }corrs.push(best);
  }
  energies.sort((a,b)=>a-b);const p10=energies[Math.floor(energies.length*.1)]||0,p90=energies[Math.floor(energies.length*.9)]||0;
  const best=corrs.sort((a,b)=>b.score-a.score)[0]||{score:0,bpm:0};
  const features={rms:Math.sqrt(totalSquare/(totalSamples||1)),pulse:clamp(fluxSum*7/(energySum||1)),brightness:clamp(Math.sqrt(totalDiff/(totalSquare||1))/.9),dynamics:clamp((p90-p10)/(p90||1)),onsetRate:peaks/(duration||1),bpm:Math.round(best.bpm),tempoConfidence:clamp(best.score)};
  return{features,labels:classify(features,track)};
 }
 function effectiveLabels(record,track){
  const base=Array.isArray(record?.manual)?record.manual:Array.isArray(record?.auto)?record.auto:metadataLabels(track);
  return CHANNELS.filter(c=>base.includes(c)&&!(record?.excluded||[]).includes(c));
 }
 function nextFromPool(pool,bag=[],current=null,random=Math.random){
  const ids=[...new Set(pool)],allowed=new Set(ids);let remaining=bag.filter(id=>allowed.has(id));
  if(!remaining.length){remaining=[...ids];for(let i=remaining.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[remaining[i],remaining[j]]=[remaining[j],remaining[i]];}}
  if(remaining.length>1&&remaining[0]===current)[remaining[0],remaining[1]]=[remaining[1],remaining[0]];
  if(remaining.length===1&&remaining[0]===current&&ids.length>1){const alternatives=ids.filter(id=>id!==current);const next=alternatives[Math.floor(random()*alternatives.length)];return{next,bag:[]};}
  return{next:remaining.shift()||null,bag:remaining};
 }
 return{CHANNELS,metadataLabels,classify,analyze,effectiveLabels,nextFromPool};
});
