'use strict';
const FM_CHANNELS={focus:{name:'专注',description:'把注意力交给手边的事。'},chill:{name:'chill',description:'松一点，让好心情慢慢发生。'},workout:{name:'运动',description:'跟上节奏，向前一点。'},calm:{name:'平静',description:'深呼吸，留一点安静给自己。'}};
const fmAudio=$('#fmAudio');
let fmState={channel:'focus',stations:{},volume:.65,active:false},fmRecords={},fmReady=false,fmResume=null,fmSaving=null;
let scanQueue=[],scanQueued=new Set(),scanBusy=false,scanPaused=false,scanCurrent=null,scanWorker=null,scanWorkerTask=null,decodeContext=null,scanLastError=false;
function fmStation(){return fmState.stations[fmState.channel]||(fmState.stations[fmState.channel]={current:null,position:0,bag:[],history:[]});}
function fmLabels(t){return FMEngine.effectiveLabels(fmRecords[t.id],t);}
function fmPool(channel=fmState.channel){return tracks.filter(t=>fmLabels(t).includes(channel));}
function fmSave(){if(!fmReady)return Promise.resolve();return write('settings',fmState,'fm-state').catch(()=>toast('FM 进度未能保存，请检查浏览器存储空间'));}
function fmSaveRecords(){return write('settings',fmRecords,'fm-labels').catch(()=>{scanLastError=true;throw Error('分类结果保存失败');});}
function fmDebounceSave(){if(!fmSaving)fmSaving=setTimeout(()=>{fmSaving=null;fmSave();},1000);}
function fmRender(){
 if(!fmReady)return;const station=fmStation(),t=byId(station.current),pool=fmPool();
 $('#fmChannels').innerHTML=Object.entries(FM_CHANNELS).map(([id,c])=>`<button class="fm-channel ${id===fmState.channel?'active':''}" data-fm-channel="${id}" aria-pressed="${id===fmState.channel}">${c.name}<small>${fmPool(id).length}</small></button>`).join('');
 $('#fmCover').src=cover(t);$('#fmCover').alt=t?`${t.title}专辑封面`:'浅浅 FM 封面';
 $('#fmTitle').textContent=t?.title||(pool.length?'选一种心情，开始听。':scanBusy?'音乐正在慢慢归位…':'这个频道还很安静。');
 $('#fmArtist').textContent=t?`${t.artist} · ${t.album}`:pool.length?`${FM_CHANNELS[fmState.channel].description} ${pool.length} 首等你来听。`:scanBusy?'整理完成的音乐会陆续加入频道。':'可以切换频道，或在「管理频道」中加入歌曲。';
 $('#fmToggle').innerHTML=icon(fmAudio.paused?'play':'pause');$('#fmToggle').setAttribute('aria-label',fmAudio.paused?'播放浅浅FM':'暂停浅浅FM');$('#fmCard').classList.toggle('is-playing',!fmAudio.paused);
 $('#fmLike').classList.toggle('liked',!!t&&meta.liked.includes(t.id));$('#fmLike').disabled=!t;$('#fmAdjust').disabled=!t;$('#fmExclude').disabled=!t;
 $('#fmCaption').textContent=!fmAudio.paused?`${FM_CHANNELS[fmState.channel].name}频道 · 正在为你播放`:t?`${FM_CHANNELS[fmState.channel].name}频道 · 暂停中`:FM_CHANNELS[fmState.channel].description;
 const done=tracks.filter(t=>fmRecords[t.id]?.version===1).length;
 $('#fmScanStatus').textContent=scanBusy?`正在整理 ${done} / ${tracks.length} 首`:scanPaused?`已暂停整理 · ${done} / ${tracks.length}`:scanLastError?'部分分类未保存，可稍后重试':`${done} 首已整理 · 本地音乐`;
 $('#fmScanToggle').textContent=scanPaused?'继续整理':scanBusy?'暂停整理':'重新整理';
 $('#fmDuration').textContent=fmt(Number.isFinite(fmAudio.duration)?fmAudio.duration:t?.duration||0);
 $('#fmMute').innerHTML=icon(fmAudio.muted||fmAudio.volume===0?'muted':'volume');
}
function fmResetSource(track,position=0){fmResume=position;fmAudio.src=source(track);fmAudio.load();}
async function fmLoad(id,{play=true,newVisit=true}={}){
 const t=byId(id);if(!t)return;const s=fmStation();
 if(s.current!==id||!fmAudio.getAttribute('src')){fmAudio.pause();s.current=id;s.position=0;fmResetSource(t,0);}
 if(newVisit){s.history=[...s.history.filter(x=>x!==id),id].slice(-40);}
 fmRender();fmSave();
 if(play){fmState.active=true;audio.pause();try{await fmAudio.play();}catch(e){if(e.name!=='AbortError')toast('FM 暂时无法播放这首歌，请试试下一首');}}
}
async function fmNext(play=true){
 const s=fmStation(),pool=fmPool().map(t=>t.id),pick=FMEngine.nextFromPool(pool,s.bag,s.current);s.bag=pick.bag;
 if(!pick.next){fmAudio.pause();s.current=null;s.position=0;fmAudio.removeAttribute('src');fmAudio.load();fmResume=null;fmRender();fmSave();toast(scanBusy?'这个频道还在整理中，可以先听其他频道':'这个频道暂无歌曲，可在「管理频道」添加');return;}
 // Replaying the only song must start from the beginning after it has ended.
 if(s.current===pick.next&&fmAudio.ended){fmAudio.currentTime=0;s.position=0;}
 await fmLoad(pick.next,{play});
}
async function fmToggle(){
 if(!fmAudio.paused){fmAudio.pause();return;}
 const s=fmStation();if(!byId(s.current)||!fmAudio.getAttribute('src'))return fmNext();
 if(fmAudio.paused){fmState.active=true;audio.pause();try{await fmAudio.play();}catch{toast('请点击下一首，或检查音频格式');}}else fmAudio.pause();
}
async function fmChangeChannel(channel){
 if(!FM_CHANNELS[channel])return;if(channel===fmState.channel){if(fmAudio.paused)fmToggle();return;}fmAudio.pause();
 fmState.channel=channel;const s=fmStation(),t=byId(s.current);
 if(t&&fmPool().some(x=>x.id===t.id)){fmResetSource(t,s.position||0);fmRender();fmSave();fmState.active=true;audio.pause();fmAudio.play().catch(()=>toast('点击 FM 播放键，继续收听'));}
 else {s.current=null;s.position=0;fmAudio.removeAttribute('src');fmAudio.load();fmResume=null;fmRender();fmSave();fmNext();}
}
async function fmSetManual(t,labels){
 const old=fmRecords[t.id];fmRecords[t.id]={...old,manual:[...labels],excluded:[]};
 try{await fmSaveRecords();}catch(error){if(old)fmRecords[t.id]=old;else delete fmRecords[t.id];throw error;}
 const s=fmStation();if(s.current===t.id&&!fmLabels(t).includes(fmState.channel)){const playing=!fmAudio.paused;fmAudio.pause();s.current=null;s.position=0;fmAudio.removeAttribute('src');fmAudio.load();fmResume=null;if(playing&&fmPool().length)fmNext();else fmSave();}
 fmRender();
}
function fmAdjustTrack(id){
 const t=byId(id);if(!t)return;const labels=fmLabels(t);
 showModal('这首歌，适合什么心情？',`<p class="help-copy">${esc(t.title)} · ${esc(t.artist)}</p><div class="fm-edit-options">${Object.entries(FM_CHANNELS).map(([key,c])=>`<label><input type="checkbox" name="channel" value="${key}" ${labels.includes(key)?'checked':''}>${c.name}</label>`).join('')}</div><p class="help-copy">可以多选，也可以全部取消。你的选择会优先于自动分类。</p>`,async data=>{await fmSetManual(t,data.getAll('channel'));closeModal();toast('已记住这首歌适合的心情');});
}
function fmOpenManager(){
 showModal('整理你的 FM 频道',`<p class="fm-manager-intro">同一首歌，可以适合不止一种心情。自动初分只是起点，你的选择优先。</p><div class="fm-manager-tools"><input id="fmManagerSearch" aria-label="搜索频道歌曲" placeholder="搜索歌名、歌手"><select id="fmManagerFilter" aria-label="筛选频道歌曲"><option value="all">全部歌曲</option>${Object.entries(FM_CHANNELS).map(([id,c])=>`<option value="${id}">${c.name}频道</option>`).join('')}<option value="unassigned">未加入频道</option><option value="manual">我调整过的</option></select></div><div id="fmManagerList" class="fm-track-manager"></div><div class="fm-reclassify"><p>分类会在本地保存。首版按音频节奏与能量初分，<br>不上传音乐，支持你随时调整。</p><button type="button" class="secondary" id="fmRescan">重新自动整理</button></div>`,null,false);
 $('#modal').classList.add('fm-manager');$('#modal').addEventListener('close',()=>$('#modal').classList.remove('fm-manager'),{once:true});
 const list=$('#fmManagerList');
 function paint(){const q=$('#fmManagerSearch').value.trim().toLowerCase(),filter=$('#fmManagerFilter').value;const items=tracks.filter(t=>{const labels=fmLabels(t);return`${t.title} ${t.artist}`.toLowerCase().includes(q)&&(filter==='all'||filter==='manual'&&Array.isArray(fmRecords[t.id]?.manual)||filter==='unassigned'&&!labels.length||labels.includes(filter));});
  list.innerHTML=items.map(t=>{const r=fmRecords[t.id],labels=fmLabels(t),status=Array.isArray(r?.manual)?'你调整的':r?.method==='audio'?'声学初分':r?.method==='metadata'?'歌曲信息初分':r?.status==='silent'?'静音片段，待你选择':r?.status==='failed'?'暂不能分析，待你选择':'等待整理';return`<div class="fm-tag-row" data-fm-manage-track="${t.id}"><div><strong>${esc(t.title)}</strong><small>${esc(t.artist)} · ${status}</small>${Array.isArray(r?.manual)||r?.excluded?.length?`<button class="fm-reset" data-fm-reset="${t.id}" type="button">恢复自动分类</button>`:''}</div><div class="fm-tag-options">${Object.entries(FM_CHANNELS).map(([c,v])=>`<label><input type="checkbox" data-fm-tag="${t.id}" value="${c}" ${labels.includes(c)?'checked':''}>${v.name}</label>`).join('')}</div></div>`;}).join('')||'<p class="help-copy">这里还没有歌曲，试试其他筛选或先导入音乐。</p>';
 }
 $('#fmManagerSearch').oninput=$('#fmManagerFilter').onchange=paint;
 list.onchange=async e=>{const id=e.target.dataset.fmTag;if(!id)return;const row=e.target.closest('[data-fm-manage-track]'),labels=[...row.querySelectorAll('input:checked')].map(x=>x.value);try{await fmSetManual(byId(id),labels);paint();}catch{toast('分类没有保存成功，请重试');paint();}};
 list.onclick=async e=>{const b=e.target.closest('[data-fm-reset]');if(!b)return;const r=fmRecords[b.dataset.fmReset];const old={...r};r.manual=null;r.excluded=[];try{await fmSaveRecords();fmRender();paint();}catch{Object.assign(r,old);toast('恢复失败，请重试');}};
 $('#fmRescan').onclick=()=>{closeModal();fmRescan();};paint();
}
function fmQueueTracks(){
 if(!fmReady)return;for(const t of tracks){if(fmRecords[t.id]?.version===1||scanQueued.has(t.id)||scanCurrent===t.id)continue;scanQueue.push(t.id);scanQueued.add(t.id);}fmScan();
}
function fmWorkerAnalyze(segments,sampleRate,t){
 if(!scanWorker){try{scanWorker=new Worker('fm-worker.js');scanWorker.onmessage=e=>{if(!scanWorkerTask||e.data.id!==scanWorkerTask.id)return;clearTimeout(scanWorkerTask.timer);const task=scanWorkerTask;scanWorkerTask=null;e.data.error?task.reject(Error(e.data.error)):task.resolve(e.data);};scanWorker.onerror=()=>{if(scanWorkerTask){clearTimeout(scanWorkerTask.timer);scanWorkerTask.reject(Error('音频分析未完成'));scanWorkerTask=null;}scanWorker.terminate();scanWorker=null;};}catch{return Promise.resolve(FMEngine.analyze(segments,sampleRate,t));}}
 return new Promise((resolve,reject)=>{const id=t.id,timer=setTimeout(()=>{scanWorker?.terminate();scanWorker=null;scanWorkerTask=null;reject(Error('音频分析超时'));},15000);scanWorkerTask={id,timer,resolve,reject};scanWorker.postMessage({id,segments,sampleRate,track:{title:t.title,artist:t.artist,album:t.album,genre:t.genre}},segments.map(s=>s.buffer));});
}
async function fmAnalyzeTrack(t){
 if(t.blob?.size>60*1024*1024||t.duration>1500)return{auto:FMEngine.metadataLabels(t),method:'metadata',status:'large',version:1};
 if(!decodeContext)decodeContext=new OfflineAudioContext(1,1,11025);
 const bytes=t.blob?await t.blob.arrayBuffer():await(await fetch(t.src)).arrayBuffer();
 let buffer=await decodeContext.decodeAudioData(bytes);const samples=buffer.getChannelData(0),sampleRate=buffer.sampleRate,span=Math.min(samples.length,Math.floor(12*sampleRate));
 const offsets=[.15,.5,.8].map(p=>Math.max(0,Math.min(samples.length-span,Math.round(samples.length*p-span/2))));
 const segments=[...new Set(offsets)].map(start=>samples.slice(start,start+span));buffer=null;
 const result=await fmWorkerAnalyze(segments,sampleRate,t);
 return{auto:result.labels,features:result.features,method:'audio',status:result.features.rms<.0003?'silent':'done',version:1};
}
async function fmScan(){
 if(scanBusy||scanPaused||!fmReady)return;scanBusy=true;scanLastError=false;fmRender();
 try{while(scanQueue.length&&!scanPaused){
  const id=scanQueue.shift();scanQueued.delete(id);const t=byId(id);if(!t)continue;scanCurrent=id;
  let result;try{result=await fmAnalyzeTrack(t);}catch{result={auto:FMEngine.metadataLabels(t),method:'metadata',status:'failed',version:1};}
  if(byId(id)){const old=fmRecords[id];fmRecords[id]={...old,...result};try{await fmSaveRecords();}catch{if(old)fmRecords[id]=old;else delete fmRecords[id];scanPaused=true;}}
  scanCurrent=null;fmRender();await new Promise(r=>setTimeout(r,150));
 }}finally{scanCurrent=null;scanBusy=false;fmRender();}
}
function fmRescan(){
 // Keep your edits and the current in-flight item. Recompute automatic results only.
 for(const t of tracks)if(t.id!==scanCurrent&&fmRecords[t.id])delete fmRecords[t.id].version;
 scanPaused=false;fmState.scanPaused=false;fmSave();fmQueueTracks();toast('正在重新整理，手动选择会保留');
}
async function fmBoot(){
 if(fmReady)return;try{const [state,labels]=await Promise.all([read('settings','fm-state'),read('settings','fm-labels')]);fmState={...fmState,...state};if(!FM_CHANNELS[fmState.channel])fmState.channel='focus';fmState.stations=fmState.stations||{};fmRecords=labels||{};scanPaused=!!fmState.scanPaused;fmReady=true;fmAudio.volume=fmState.volume;$('#fmVolume').value=fmState.volume;setRange($('#fmVolume'),fmState.volume*100);const s=fmStation(),t=byId(s.current);if(t)fmResetSource(t,s.position||0);else{s.current=null;s.position=0;}fmRender();fmQueueTracks();}catch(error){console.error(error);toast('FM 暂时无法读取本地收藏，请刷新重试');}}
$('#fmChannels').onclick=e=>{const b=e.target.closest('[data-fm-channel]');if(b)fmChangeChannel(b.dataset.fmChannel);};
$('#fmToggle').onclick=fmToggle;$('#fmNext').onclick=()=>fmNext();$('#fmManage').onclick=fmOpenManager;
$('#fmAdjust').onclick=()=>fmAdjustTrack(fmStation().current);
$('#fmLike').onclick=()=>like(fmStation().current);
$('#fmExclude').onclick=async()=>{const t=byId(fmStation().current);if(!t)return;const old=fmRecords[t.id],record={...old,excluded:[...new Set([...(old?.excluded||[]),fmState.channel])]};fmRecords[t.id]=record;try{await fmSaveRecords();const playing=!fmAudio.paused;fmAudio.pause();fmStation().current=null;fmStation().position=0;fmAudio.removeAttribute('src');fmAudio.load();fmResume=null;fmRender();fmSave();toast('这首歌不会再出现在当前频道，音乐仍在收藏中');if(fmPool().length)fmNext(playing);}catch{if(old)fmRecords[t.id]=old;else delete fmRecords[t.id];toast('没能保存这个选择，请重试');}};
$('#fmScanToggle').onclick=()=>{if(scanBusy){scanPaused=true;fmState.scanPaused=true;fmSave();fmRender();}else if(scanPaused){scanPaused=false;fmState.scanPaused=false;fmSave();fmQueueTracks();}else fmRescan();};
$('#fmProgress').oninput=e=>{if(Number.isFinite(fmAudio.duration)){fmAudio.currentTime=fmAudio.duration*e.target.value/1000;setRange(e.target,e.target.value/10);}};
$('#fmVolume').oninput=e=>{fmAudio.volume=+e.target.value;fmAudio.muted=false;fmState.volume=fmAudio.volume;setRange(e.target,fmAudio.volume*100);$('#fmMute').innerHTML=icon(fmAudio.volume?'volume':'muted');fmSave();};
$('#fmMute').onclick=()=>{fmAudio.muted=!fmAudio.muted;$('#fmMute').innerHTML=icon(fmAudio.muted?'muted':'volume');$('#fmMute').setAttribute('aria-label',fmAudio.muted?'取消FM静音':'FM静音');};
fmAudio.addEventListener('play',()=>{audio.pause();fmState.active=true;fmRender();fmSave();});
fmAudio.addEventListener('pause',()=>{if(fmResume===null&&fmReady)fmStation().position=fmAudio.currentTime;fmRender();fmSave();});
fmAudio.addEventListener('loadedmetadata',()=>{if(fmResume!==null){fmAudio.currentTime=Math.min(fmResume,Math.max(0,fmAudio.duration-.1));fmResume=null;}fmRender();});
fmAudio.addEventListener('timeupdate',()=>{const time=fmAudio.currentTime,d=fmAudio.duration,p=Number.isFinite(d)&&d>0?time/d:0;$('#fmTime').textContent=fmt(time);$('#fmProgress').value=p*1000;setRange($('#fmProgress'),p*100);if(fmReady&&fmResume===null){fmStation().position=time;fmDebounceSave();}});
fmAudio.addEventListener('ended',()=>fmNext());
fmAudio.addEventListener('error',()=>{if(fmAudio.getAttribute('src'))toast('FM 无法播放这首音频，可以换一首');});
audio.addEventListener('play',()=>{fmAudio.pause();fmState.active=false;fmSave();fmRender();});
document.addEventListener('keydown',e=>{if(!fmState.active||e.target.closest('input,textarea,select,button,a,[role="button"]')||$('#modal').open)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.stopImmediatePropagation();if(Number.isFinite(fmAudio.duration))fmAudio.currentTime=Math.max(0,Math.min(fmAudio.duration,fmAudio.currentTime+(e.key==='ArrowRight'?5:-5)));}},true);
document.addEventListener('libraryready',fmBoot,{once:true});
document.addEventListener('librarychange',()=>{if(!fmReady)return;const s=fmStation();if(s.current&&!byId(s.current)){fmAudio.pause();s.current=null;s.position=0;fmAudio.removeAttribute('src');fmAudio.load();fmResume=null;fmSave();}fmRender();fmQueueTracks();});
window.addEventListener('pagehide',()=>{fmSave();if(fmReady)fmSaveRecords().catch(()=>{});});
if(initialized)fmBoot();
