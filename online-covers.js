'use strict';
const coverJobs=[],coverAttempts=new Set();let coverWorking=false;
const coverKey=t=>JSON.stringify([t.title,t.artist,t.album,t.duration]);
const needsCover=t=>t&&!t.demo&&!t.coverBlob&&(!t.cover||t.cover==='assets/forest.svg');
function queueCover(t,retry=false){
 if(!needsCover(t)||location.protocol==='file:')return;
 const key=coverKey(t),attempt=t.id+key;
 if(!retry&&(coverAttempts.has(attempt)||(t.coverCheckedKey===key&&Date.now()-(t.coverCheckedAt||0)<86400000)))return;
 coverAttempts.add(attempt);coverJobs.push({id:t.id,key,retry});workCovers();
}
async function coverBlob(data){
 const bytes=Uint8Array.from(atob(data.imageBase64),c=>c.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:data.mime}));
 try{if(bitmap.width<80||bitmap.height<80)throw Error('封面尺寸太小');const canvas=document.createElement('canvas'),scale=Math.min(1,400/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const context=canvas.getContext('2d');context.fillStyle='#f0f3ed';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('封面保存失败')),'image/jpeg',.86));}finally{bitmap.close();}
}
function updateCoverCredit(){
 const t=byId(meta.current),credit=$('#coverCredit');if(!credit)return;credit.hidden=!t?.coverSource;
 if(t?.coverSource){credit.textContent=`封面 · ${t.coverSource} ↗`;try{const u=new URL(t.coverSourceURL);credit.href=u.protocol==='https:'&&(['music.163.com','music.apple.com','itunes.apple.com'].includes(u.hostname))?u.href:'#';}catch{credit.href='#';}}
}
async function workCovers(){
 if(coverWorking)return;coverWorking=true;
 try{while(coverJobs.length){
  const job=coverJobs.shift(),t=byId(job.id);if(!needsCover(t)||coverKey(t)!==job.key)continue;
  try{
   const r=await fetch('/api/covers/match?'+new URLSearchParams({title:t.title,artist:t.artist,album:t.album,duration:t.duration||0}),{signal:AbortSignal.timeout(45000)});
   if(!r.ok)throw Error('封面来源暂不可用');const data=await r.json();
   const blob=data.cover?await coverBlob(data.cover):null;
   if(!needsCover(t)||!byId(t.id)||coverKey(t)!==job.key)continue;
   // Merge after network and image decoding, preserving any new lyrics or manual edits.
   const fields={coverCheckedKey:job.key,coverCheckedAt:Date.now()};if(blob)Object.assign(fields,{coverBlob:blob,coverSource:data.cover.source,coverSourceURL:data.cover.sourceURL});
   const updated={...t,...fields};await write('tracks',updated);Object.assign(t,fields);
   if(blob){const old=urls.get(t.id+'-cover');if(old)URL.revokeObjectURL(old);urls.delete(t.id+'-cover');render();if(job.retry)toast('已找到封面，并保存到本地');}
   else if(job.retry)toast('暂时没有找到合适的封面，可以编辑歌曲信息后重试');
  }catch{if(job.retry)toast('封面暂时获取失败，稍后可以重试');}
  if(coverJobs.length)await new Promise(r=>setTimeout(r,400));
 }}finally{coverWorking=false;}
}
const credit=document.createElement('a');credit.id='coverCredit';credit.className='cover-credit';credit.target='_blank';credit.rel='noreferrer noopener';credit.hidden=true;$('.turntable').append(credit);
const coverUpdatePlayer=updatePlayer;
updatePlayer=function(){coverUpdatePlayer();updateCoverCredit();queueCover(byId(meta.current));};
const coverImportFiles=importFiles;
importFiles=async function(files){await coverImportFiles(files);tracks.forEach(t=>queueCover(t));};
const coverRender=render;
render=function(){coverRender();tracks.forEach(t=>queueCover(t));};
const coverTrackMenu=trackMenu;
trackMenu=function(id){coverTrackMenu(id);if(!needsCover(byId(id)))return;const button=document.createElement('button');button.type='button';button.innerHTML=`${icon('search')} 自动查找专辑封面`;button.onclick=()=>{closeModal();toast('正在寻找这首歌的封面…');queueCover(byId(id),true);};$('#modalBody .modal-menu').append(button);};
if(initialized)render();
