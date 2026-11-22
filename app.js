'use strict';
const $ = s => document.querySelector(s);
const icons = {
 music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 play:'<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>', pause:'<path d="M9 5v14M16 5v14" stroke-width="3.5"/>',
 previous:'<path d="M5 5v14m14-14L7 12l12 7Z" fill="currentColor"/>',next:'<path d="M19 5v14M5 5l12 7-12 7Z" fill="currentColor"/>',
 repeat:'<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>',
 single:'<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3M11 10l1-1v6"/>',
 shuffle:'<path d="m17 3 4 4-4 4M3 17h3c5 0 7-10 12-10h3M3 7h3c1.5 0 3 1 4 3m4 4c1 2 2 3 4 3h3m-4-4 4 4-4 4"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
 disc:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M5 12a7 7 0 0 1 7-7m0 14a7 7 0 0 0 7-7"/>',
 volume:'<path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 muted:'<path d="m11 4-6 5H2v6h3l6 5Zm5 5 6 6m0-6-6 6"/>',
 queue:'<path d="M4 5h16M4 11h16M4 17h9m4-2 4 3-4 3Z"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/>',
 expand:'<path d="M4 9V4h5m6 0h5v5M4 15v5h5m11-5v5h-5"/>',down:'<path d="m5 9 7 7 7-7"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
 edit:'<path d="m15 5 4 4M4 20l4-1L21 6l-4-4L4 15Zm9 0h8"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 folder:'<path d="M3 6h7l2 3h9v11H3Z"/>', trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',check:'<path d="m4 12 5 5L20 6"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n] || icons.music}</svg>`;
function hydrate(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = s => !Number.isFinite(s) ? '00:00' : `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const uid = () => crypto.randomUUID();
let db, tracks=[], playlists=[], meta={liked:[],recent:[],queue:[],current:null,mode:'order',volume:.7,position:0};
let view='library', query='', urls=new Map(), lyricIndex=-2, initialized=false, toastTimer, importBusy=false, saveTimer;
const audio=$('#audio');
const defaults=[
 {id:'demo-forest',title:'林间来信',artist:'浅浅静听',album:'静下来的时光 · 原创试听',duration:36,src:'assets/forest.wav',cover:'assets/forest.svg',demo:true,lrc:'[00:00.00]林间来信\n[00:05.00]光落在树梢，风经过窗前\n[00:12.00]把匆忙，暂时留在门外\n[00:19.00]此刻，只需要安静地听\n[00:27.00]浅浅听，慢慢喜欢\n[00:33.00]原创器乐试听 · 无人声'},
 {id:'demo-rain',title:'雨落之后',artist:'浅浅静听',album:'静下来的时光 · 原创试听',duration:36,src:'assets/rain.wav',cover:'assets/rain.svg',demo:true,lrc:'[00:00.00]雨落之后\n[00:06.00]城市慢了下来\n[00:13.00]留一扇窗，给好心情\n[00:21.00]听见属于自己的节奏\n[00:29.00]雨停了，音乐还在\n[00:33.00]原创器乐试听 · 无人声'},
 {id:'demo-evening',title:'黄昏慢半拍',artist:'浅浅静听',album:'静下来的时光 · 原创试听',duration:36,src:'assets/evening.wav',cover:'assets/evening.svg',demo:true,lrc:'[00:00.00]黄昏慢半拍\n[00:06.00]日落把天空染成温柔的颜色\n[00:13.00]今天也辛苦了\n[00:21.00]不用急着赶往下一站\n[00:29.00]把时光，交给音乐\n[00:33.00]原创器乐试听 · 无人声'}
];
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('qianqian-listen',1);req.onupgradeneeded=()=>{req.result.createObjectStore('tracks',{keyPath:'id'});req.result.createObjectStore('settings');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function read(store,key){return new Promise((resolve,reject)=>{const req=db.transaction(store).objectStore(store)[key===undefined?'getAll':'get'](key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function write(store,value,key){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,...(key===undefined?[]:[key]));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
async function persist(){try{await write('settings',{meta,playlists},'state');}catch(e){toast('保存失败：浏览器存储空间不足或不可用');console.error(e);}}
function byId(id){return tracks.find(t=>t.id===id);}
function cover(t){if(t?.coverBlob){const k=t.id+'-cover';if(!urls.has(k))urls.set(k,URL.createObjectURL(t.coverBlob));return urls.get(k);}return t?.cover||'assets/forest.svg';}
function source(t){if(t.blob){if(!urls.has(t.id))urls.set(t.id,URL.createObjectURL(t.blob));return urls.get(t.id);}return t.src;}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function visibleTracks(){let list=tracks;if(view==='liked')list=meta.liked.map(byId).filter(Boolean);else if(view==='recent')list=meta.recent.map(byId).filter(Boolean);else if(view!=='library')list=(playlists.find(p=>p.id===view)?.tracks||[]).map(byId).filter(Boolean);return list.filter(t=>`${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(query));}
function render(){
 const list=visibleTracks(),p=playlists.find(p=>p.id===view),title=view==='library'?'本地音乐':view==='liked'?'我喜欢的音乐':view==='recent'?'最近播放':p?.name||'本地音乐';
 $('#crumb').textContent=title;$('#viewTitle').innerHTML=`${esc(title)} <span>${list.length} 首</span>`;$('#libraryCount').textContent=tracks.length;
 $('#viewDescription').textContent=view==='recent'?'那些反复听起的，都是生活的回声。':view==='liked'?'每一次喜欢，都有迹可循。':p?'把同一种心情，放在一起。':'收藏每一首，想要单曲循环的心情。';
 $('#playlistOptions').hidden=!p;$('#listTotal').textContent=`${list.length} 首 · ${Math.round(list.reduce((s,t)=>s+(t.duration||0),0)/60)} 分钟`;
 document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
 $('#playlists').innerHTML=playlists.map(p=>`<div class="playlist-entry ${p.id===view?'active':''}"><button class="playlist-item" data-playlist="${p.id}" title="${esc(p.name)}"><span class="playlist-tile">${icon('music')}</span><span>${esc(p.name)}</span></button><button class="icon-btn playlist-more" data-playlist-more="${p.id}" title="管理歌单" aria-label="${esc(p.name)}的更多操作" aria-haspopup="dialog">${icon('more')}</button></div>`).join('');
 $('#songs').innerHTML=list.length?list.map((t,i)=>`<div class="song-row ${meta.current===t.id?'current':''}" data-track="${t.id}" tabindex="0" role="button" aria-label="播放 ${esc(t.title)}"><span class="song-number">${meta.current===t.id?'<span class="playing-bars"><i></i><i></i><i></i></span>':String(i+1).padStart(2,'0')}</span><div class="song-title-cell"><img class="song-cover" src="${cover(t)}" alt="${esc(t.album)}封面"><div><h3 class="track-title">${esc(t.title)}</h3><span class="track-artist">${esc(t.artist)}</span></div></div><span class="track-album">${esc(t.album)}</span><span class="track-duration">${fmt(t.duration)}</span><span class="row-actions"><button class="icon-btn ${meta.liked.includes(t.id)?'liked':''}" data-like="${t.id}" title="${meta.liked.includes(t.id)?'取消喜欢':'喜欢'}" aria-label="${meta.liked.includes(t.id)?'取消喜欢':'喜欢'} ${esc(t.title)}">${icon('heart')}</button><button class="icon-btn" data-more="${t.id}" title="歌曲操作" aria-label="${esc(t.title)}的更多操作">${icon('more')}</button></span></div>`).join(''):`<div class="empty-state">${icon(query?'search':'music')}<p>${query?'没有找到这首歌':view==='library'?'把第一首喜欢的歌，放进来。':view==='recent'?'听过的音乐，会留在这里。':'这里还很安静。'}</p><small>${query?'试试其他歌曲、歌手或专辑名称':'导入音乐，或在歌曲的「···」中加入歌单'}</small></div>`;
 updatePlayer();renderQueue();document.dispatchEvent(new Event('librarychange'));
}
function navigate(v){view=v;query='';$('#search').value='';render();}
function updatePlayer(){
 const t=byId(meta.current);$('#nowTitle').textContent=t?.title||'选择一首音乐';$('#nowArtist').textContent=t?.artist||'浅浅静听';$('#smallCover').src=cover(t);$('#likeCurrent').classList.toggle('liked',meta.liked.includes(meta.current));
 $('#togglePlay').innerHTML=icon(audio.paused?'play':'pause');$('#togglePlay').setAttribute('aria-label',audio.paused?'播放':'暂停');document.body.classList.toggle('paused',audio.paused);$('#record').classList.toggle('spinning',!audio.paused);$('#tonearm').classList.toggle('engaged',!audio.paused);
 $('#mode').innerHTML=icon(meta.mode==='shuffle'?'shuffle':meta.mode==='single'?'single':'repeat');$('#mode').title={order:'顺序循环',shuffle:'随机播放',single:'单曲循环'}[meta.mode];$('#mode').setAttribute('aria-label',`播放模式：${$('#mode').title}`);$('#mode').classList.toggle('active',meta.mode!=='order');$('#queueCount').textContent=meta.queue.length;
 $('#recordCover').src=cover(t);$('#focusTitle').textContent=t?.title||'选一首喜欢的歌';$('#focusMeta').textContent=t?`${t.artist}  /  ${t.album}`:'把时光交给音乐';
 $('#duration').textContent=fmt(Number.isFinite(audio.duration)?audio.duration:t?.duration||0);
}
function renderQueue(){$('#queueSubtitle').textContent=`共 ${meta.queue.length} 首 · ${$('#mode').title}`;$('#queueList').innerHTML=meta.queue.map(byId).filter(Boolean).map(t=>`<button class="queue-track ${t.id===meta.current?'current':''}" data-queue="${t.id}"><img src="${cover(t)}" alt=""><div><strong>${esc(t.title)}</strong><small>${esc(t.artist)}</small></div><span>${fmt(t.duration)}</span></button>`).join('')||'<p class="help-copy">选一首歌，开始今天的聆听。</p>';}
async function playTrack(id,list=null,autoplay=true){
 const t=byId(id);if(!t)return;
 if(list)meta.queue=list.map(x=>typeof x==='string'?x:x.id);
 if(!meta.queue.includes(id))meta.queue=[...meta.queue,id];
 const changed=meta.current!==id||!audio.getAttribute('src');
 if(changed){audio.pause();meta.current=id;meta.position=0;audio.src=source(t);renderLyrics();}
 meta.recent=[id,...meta.recent.filter(i=>i!==id)].slice(0,100);render();await persist();
 if(autoplay){try{await audio.play();}catch(e){if(e.name!=='AbortError')toast('无法播放此文件，请换用 MP3、WAV 或浏览器支持的音频');}}
}
async function toggle(){if(!byId(meta.current)){const list=visibleTracks();if(list.length)await playTrack(list[0].id,list);else toast('先导入一首音乐吧');return;}if(!audio.getAttribute('src'))await playTrack(meta.current,null,false);if(audio.paused){try{await audio.play();}catch{toast('暂时无法播放，请检查音频格式');}}else audio.pause();}
function skip(direction,ended=false){const list=meta.queue.map(byId).filter(Boolean);if(!list.length)return;if(ended&&meta.mode==='single'){audio.currentTime=0;audio.play().catch(()=>toast('请点击播放继续'));return;}let idx=list.findIndex(t=>t.id===meta.current);if(meta.mode==='shuffle'&&list.length>1){let next;do{next=Math.floor(Math.random()*list.length);}while(next===idx);idx=next;}else idx=(idx+direction+list.length)%list.length;playTrack(list[idx].id);}
async function like(id){if(!id)return;meta.liked=meta.liked.includes(id)?meta.liked.filter(x=>x!==id):[...meta.liked,id];await persist();render();}
function setRange(el,pct){el.style.setProperty('--pct',`${Math.max(0,Math.min(100,pct))}%`);}
function parseLRC(text){let offset=Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1]||0)/1000;const out=[];for(const line of text.split(/\r?\n/)){const times=[...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];const content=line.replace(/\[[^\]]*\]/g,'').trim();for(const m of times)if(content)out.push({time:Math.max(0,+m[1]*60+ +m[2]+offset),text:content});}return out.sort((a,b)=>a.time-b.time);}
let currentLyrics=[];
function renderLyrics(){const t=byId(meta.current);currentLyrics=parseLRC(t?.lrc||'');lyricIndex=-2;$('#lyrics').innerHTML=currentLyrics.length?currentLyrics.map((l,i)=>`<button data-lyric="${i}" title="跳转到 ${fmt(l.time)}">${esc(l.text)}</button>`).join(''):`<div class="lyric-empty">${t?.lrc?esc(t.lrc).replace(/\n/g,'<br>'):'此刻，让旋律说话。<br><small>导入 LRC 歌词，跟着音乐慢慢看。</small>'}</div>`;syncLyrics(true);}
function syncLyrics(force=false){let i=-1;for(let j=0;j<currentLyrics.length;j++){if(currentLyrics[j].time<=audio.currentTime)i=j;else break;}if(i===lyricIndex&&!force)return;lyricIndex=i;$('#lyrics').querySelectorAll('button').forEach((b,j)=>b.classList.toggle('active',j===i));if(!$('#focusView').hidden){const b=$(`#lyrics button[data-lyric="${Math.max(i,0)}"]`);if(b)$('#lyricsWindow').scrollTo({top:b.offsetTop-$('#lyrics').offsetTop-$('#lyricsWindow').clientHeight/2+b.clientHeight/2,behavior:force?'instant':'smooth'});}}
function focus(open=true){$('#focusView').hidden=!open;if(open){renderLyrics();updatePlayer();syncLyrics(true);}}
function showModal(title,html,submit,showActions=true){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;$('#modalActions').hidden=!showActions;$('#modalActions button[type="submit"]').textContent='保存';$('#modalForm').onsubmit=async e=>{e.preventDefault();try{await submit?.(new FormData(e.target));}catch(err){console.error(err);toast('操作没有保存成功，请重试');}};$('#modal').showModal();}
function closeModal(){$('#modal').close();}
function playlistForm(existing=null){showModal(existing?'编辑歌单':'新建歌单',`<label class="field">歌单名称<input name="name" maxlength="40" required autofocus value="${esc(existing?.name||'')}" placeholder="给此刻的心情起个名字"></label><p class="help-copy">把喜欢的音乐，放在同一个角落。</p>`,async data=>{const name=data.get('name').trim();if(!name)return;if(existing)existing.name=name;else{const p={id:uid(),name,tracks:[]};playlists.push(p);view=p.id;}await persist();closeModal();render();toast(existing?'歌单已更新':'歌单创建好了，在歌曲「···」中添加音乐');});}
function managePlaylist(id){
 const p=playlists.find(p=>p.id===id);if(!p)return;
 showModal('管理歌单',`<p class="help-copy">${esc(p.name)}</p><div class="modal-menu"><button type="button" id="renamePlaylist">${icon('edit')} 重命名歌单</button><button type="button" id="deletePlaylist" class="danger">${icon('trash')} 删除歌单</button></div>`,null,false);
 $('#renamePlaylist').onclick=()=>{closeModal();playlistForm(p);};
 $('#deletePlaylist').onclick=()=>{closeModal();showModal('删除歌单？',`<p class="help-copy">删除「${esc(p.name)}」后，歌曲仍然保留在本地音乐库中。</p>`,async()=>{
  playlists=playlists.filter(x=>x.id!==p.id);await persist();closeModal();
  if(view===p.id)navigate('library');else render();
  toast('歌单已删除，歌曲仍在音乐库');
 });$('#modalActions button[type="submit"]').textContent='删除歌单';};
}
function addToPlaylist(id){showModal('收藏到歌单',`<div class="modal-menu">${playlists.map(p=>`<button type="button" data-add-to="${p.id}">${icon('folder')} ${esc(p.name)} ${p.tracks.includes(id)?'（已添加）':''}</button>`).join('')}<button type="button" id="addNewPlaylist">${icon('plus')} 新建歌单并添加</button></div>`,null,false);$('#modalBody').onclick=async e=>{const b=e.target.closest('[data-add-to]');if(b){const p=playlists.find(p=>p.id===b.dataset.addTo);if(!p.tracks.includes(id))p.tracks.push(id);await persist();closeModal();render();toast('已加入歌单');}if(e.target.closest('#addNewPlaylist')){closeModal();showModal('新建歌单', '<label class="field">歌单名称<input name="name" required maxlength="40" autofocus placeholder="给此刻的心情起个名字"></label>',async data=>{const name=data.get('name').trim();if(!name)return;playlists.push({id:uid(),name,tracks:[id]});await persist();closeModal();render();toast('已创建歌单并添加歌曲');});}};}
function trackMenu(id){const t=byId(id),p=playlists.find(p=>p.id===view);showModal(t.title,`<div class="modal-menu"><button type="button" data-action="add">${icon('plus')} 添加到歌单</button><button type="button" data-action="edit">${icon('edit')} 编辑信息 / 封面 / 歌词</button>${p?`<button type="button" data-action="remove">${icon('close')} 从此歌单移除</button>`:''}<button type="button" class="danger" data-action="delete">${icon('trash')} 从音乐库移除</button></div>`,null,false);$('#modalBody').onclick=e=>{const a=e.target.closest('[data-action]')?.dataset.action;if(!a)return;closeModal();if(a==='add')addToPlaylist(id);if(a==='edit')editTrack(id);if(a==='remove'){p.tracks=p.tracks.filter(x=>x!==id);persist();render();toast('已从歌单移除，歌曲仍在音乐库');}if(a==='delete')confirmRemove(t);};}
function confirmRemove(t){showModal('移除这首音乐？',`<p class="help-copy">将从本播放器的音乐库和歌单中移除「${esc(t.title)}」。电脑上的原始文件不会删除，可随时重新导入。</p>`,async()=>{const tx=db.transaction('tracks','readwrite');tx.objectStore('tracks').delete(t.id);await new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=j;});tracks=tracks.filter(x=>x.id!==t.id);playlists.forEach(p=>p.tracks=p.tracks.filter(x=>x!==t.id));meta.liked=meta.liked.filter(x=>x!==t.id);meta.recent=meta.recent.filter(x=>x!==t.id);meta.queue=meta.queue.filter(x=>x!==t.id);if(meta.current===t.id){audio.pause();audio.removeAttribute('src');audio.load();meta.current=null;meta.position=0;$('#currentTime').textContent='00:00';$('#progress').value=0;setRange($('#progress'),0);renderLyrics();}await persist();closeModal();render();toast('已移除，原文件仍然保留');});}
function fileAsText(file){return file.arrayBuffer().then(b=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(b);}catch{return new TextDecoder('gb18030').decode(b);}});}
function editTrack(id){const t=byId(id);if(!t){toast('先选择一首音乐');return;}showModal('编辑这首音乐',`<label class="field">歌曲名称<input name="title" required maxlength="100" value="${esc(t.title)}"></label><label class="field">歌手<input name="artist" maxlength="100" value="${esc(t.artist)}"></label><label class="field">专辑<input name="album" maxlength="100" value="${esc(t.album)}"></label><label class="field">专辑封面<input name="coverFile" type="file" accept="image/*"></label><label class="field">歌词（支持带时间的 LRC）<textarea name="lrc" placeholder="[00:00.00]第一句歌词">${esc(t.lrc||'')}</textarea></label>`,async data=>{const c=data.get('coverFile');if(c?.size>8*1024*1024){toast('封面请小于 8 MB');return;}const updated={...t,title:data.get('title').trim(),artist:data.get('artist').trim()||'未知歌手',album:data.get('album').trim()||'本地音乐',lrc:data.get('lrc')};if(!updated.title)return;if(c?.size){if(!c.type.startsWith('image/')){toast('请选择图片文件');return;}updated.coverBlob=c;delete updated.coverSource;delete updated.coverSourceURL;}await write('tracks',updated);Object.assign(t,updated);if(c?.size){delete t.coverSource;delete t.coverSourceURL;URL.revokeObjectURL(urls.get(id+'-cover'));urls.delete(id+'-cover');}closeModal();render();if(meta.current===id)renderLyrics();toast('已保存歌曲信息');});}
async function importLrc(file,id=meta.current){const t=byId(id);if(!t){toast('先选择要配歌词的歌曲');return;}if(file.size>2*1024*1024){toast('歌词文件过大');return;}const text=await fileAsText(file);const updated={...t,lrc:text};await write('tracks',updated);Object.assign(t,updated);if(id===meta.current)renderLyrics();toast(`已为「${t.title}」导入歌词`);}
// Read common ID3v2 tags and embedded APIC covers without sending audio anywhere.
function tagString(bytes){if(!bytes.length)return '';const encoding=bytes[0];try{return new TextDecoder(encoding===0?'windows-1252':encoding===3?'utf-8':encoding===2?'utf-16be':bytes[1]===255&&bytes[2]===254?'utf-16le':'utf-16be').decode(bytes.subarray(encoding===1?3:1)).replace(/\0/g,'').trim();}catch{return '';}}
function syncsafe(b,p){return ((b[p]&127)<<21)|((b[p+1]&127)<<14)|((b[p+2]&127)<<7)|(b[p+3]&127);}
async function readTags(file){
 const b=new Uint8Array(await file.slice(0,Math.min(file.size,12*1024*1024)).arrayBuffer()),d=new DataView(b.buffer),out={};
 if(String.fromCharCode(...b.subarray(0,3))!=='ID3')return out;
 const ver=b[3];if(ver!==3&&ver!==4)return out;const end=Math.min(b.length,10+syncsafe(b,6));let p=10;
 if(b[5]&0x40&&p+4<end)p+=ver===3?4+d.getUint32(p):syncsafe(b,p);
 while(p+10<end){const id=String.fromCharCode(...b.subarray(p,p+4)),size=ver===4?syncsafe(b,p+4):d.getUint32(p+4);if(!/^[A-Z0-9]{4}$/.test(id)||size<=0||p+10+size>end)break;const v=b.subarray(p+10,p+10+size);if(id==='TIT2')out.title=tagString(v);if(id==='TPE1')out.artist=tagString(v);if(id==='TALB')out.album=tagString(v);if(id==='TCON')out.genre=tagString(v);if(id==='APIC'&&v.length>6){let j=1;while(j<v.length&&v[j])j++;const mime=new TextDecoder().decode(v.subarray(1,j));j+=2;if(v[0]===1||v[0]===2){while(j+1<v.length&&(v[j]||v[j+1]))j+=2;j+=2;}else{while(j<v.length&&v[j])j++;j++;}if(j<v.length&&/^image\/(jpeg|png|webp|gif)$/i.test(mime))out.coverBlob=new Blob([v.subarray(j)],{type:mime});}p+=10+size;
 }return Object.fromEntries(Object.entries(out).filter(([,v])=>v));
}
function durationOf(blob){return new Promise(resolve=>{const el=new Audio(),url=URL.createObjectURL(blob);let done=false;const finish=n=>{if(done)return;done=true;clearTimeout(timer);el.removeAttribute('src');el.load();URL.revokeObjectURL(url);resolve(n);};const timer=setTimeout(()=>finish(0),4000);el.onloadedmetadata=()=>finish(Number.isFinite(el.duration)?el.duration:0);el.onerror=()=>finish(0);el.src=url;});}
async function importFiles(files){
 if(importBusy){toast('音乐正在导入，请稍候');return;}importBusy=true;$('#importButton').disabled=true;const all=[...files],audios=all.filter(f=>f.type.startsWith('audio/')||/\.(mp3|wav|flac|m4a|ogg|aac|opus|webm)$/i.test(f.name)),lrcs=all.filter(f=>/\.lrc$/i.test(f.name));let count=0,duplicates=0,failed=0;toast('正在把音乐放进收藏馆…');
 try{for(const f of audios){const key=`${f.name}:${f.size}:${f.lastModified}`;const existing=tracks.find(t=>t.fileKey===key);if(existing){duplicates++;continue;}const bare=f.name.replace(/\.[^.]+$/,''),parts=bare.split(/\s+-\s+/);let tags={};try{tags=await readTags(f);}catch{}const t={id:uid(),fileKey:key,fileName:f.name,title:tags.title||parts.slice(1).join(' - ')||bare,artist:tags.artist||(parts.length>1?parts[0]:'未知歌手'),album:tags.album||'本地音乐',blob:f,duration:await durationOf(f),cover:'assets/forest.svg',...tags};const lrc=lrcs.find(l=>l.name.replace(/\.lrc$/i,'')===bare);if(lrc)t.lrc=await fileAsText(lrc);try{await write('tracks',t);tracks.push(t);const p=playlists.find(p=>p.id===view);if(p)p.tracks.push(t.id);count++;}catch{failed++;toast('存储空间不足，这首歌未导入');}}
 for(const l of lrcs){const bare=l.name.replace(/\.lrc$/i,'');const t=tracks.find(t=>t.fileName?.replace(/\.[^.]+$/,'')===bare||t.title===bare);if(t){await importLrc(l,t.id);}else if(!audios.length&&lrcs.length===1&&meta.current)await importLrc(l);}
 await persist();render();toast(count?`已导入 ${count} 首音乐${duplicates?`，跳过 ${duplicates} 首重复歌曲`:''}${failed?`，${failed} 首未能保存`:''}`:duplicates?'这些音乐已经在收藏馆了':lrcs.length?'歌词导入完成':'请选择 MP3、WAV、FLAC 等音频文件');
 }catch(e){console.error(e);toast('导入未完成，请检查文件或浏览器存储空间');}finally{importBusy=false;$('#importButton').disabled=false;$('#fileInput').value='';}
}
hydrate();
$('#navigation').onclick=e=>{const v=e.target.closest('[data-view]');if(v)navigate(v.dataset.view);};
$('.brand').onclick=e=>{e.preventDefault();navigate('library');focus(false);};
$('#playlists').onclick=e=>{const more=e.target.closest('[data-playlist-more]');if(more){managePlaylist(more.dataset.playlistMore);return;}const p=e.target.closest('[data-playlist]');if(p)navigate(p.dataset.playlist);};
$('#createPlaylist').onclick=()=>playlistForm();
$('#playlistOptions').onclick=()=>managePlaylist(view);
$('#search').oninput=e=>{query=e.target.value.trim().toLowerCase();render();};
$('#songs').onclick=e=>{const liked=e.target.closest('[data-like]'),more=e.target.closest('[data-more]'),row=e.target.closest('[data-track]');if(liked)return void like(liked.dataset.like);if(more)return trackMenu(more.dataset.more);if(row)playTrack(row.dataset.track,visibleTracks());};
$('#songs').onkeydown=e=>{if(e.key==='Enter'&&e.target.matches('[data-track]')){e.preventDefault();playTrack(e.target.dataset.track,visibleTracks());}};
$('#playAll').onclick=()=>{const list=visibleTracks();if(list.length)playTrack(list[0].id,list);else toast('先导入几首喜欢的音乐吧');};
$('#shuffleAll').onclick=()=>{const list=visibleTracks();if(!list.length)return toast('先导入音乐吧');meta.mode='shuffle';playTrack(list[Math.floor(Math.random()*list.length)].id,list);};
$('#togglePlay').onclick=toggle;$('#previous').onclick=()=>skip(-1);$('#next').onclick=()=>skip(1);$('#likeCurrent').onclick=()=>like(meta.current);
$('#mode').onclick=()=>{const modes=['order','single','shuffle'];meta.mode=modes[(modes.indexOf(meta.mode)+1)%3];persist();updatePlayer();renderQueue();toast($('#mode').title);};
$('#volume').oninput=e=>{audio.volume=+e.target.value;audio.muted=false;meta.volume=audio.volume;setRange(e.target,audio.volume*100);$('#mute').innerHTML=icon(audio.volume?'volume':'muted');persist();};
$('#mute').onclick=()=>{audio.muted=!audio.muted;$('#mute').innerHTML=icon(audio.muted?'muted':'volume');$('#mute').title=audio.muted?'取消静音':'静音';$('#mute').setAttribute('aria-label',$('#mute').title);};
$('#progress').oninput=e=>{if(Number.isFinite(audio.duration)){audio.currentTime=e.target.value/1000*audio.duration;setRange(e.target,e.target.value/10);syncLyrics();}};
$('#openPlayer').onclick=$('#nowTitle').onclick=$('#toggleFocus').onclick=()=>focus();$('#closeFocus').onclick=()=>focus(false);$('#focusEdit').onclick=()=>editTrack(meta.current);
$('#queueButton').onclick=()=>{$('#queuePanel').hidden=!$('#queuePanel').hidden;renderQueue();};$('#closeQueue').onclick=()=>$('#queuePanel').hidden=true;$('#queueList').onclick=e=>{const row=e.target.closest('[data-queue]');if(row)playTrack(row.dataset.queue);};
$('#lyrics').onclick=e=>{const b=e.target.closest('[data-lyric]');if(b&&Number.isFinite(audio.duration)){audio.currentTime=Math.min(audio.duration,currentLyrics[+b.dataset.lyric].time);syncLyrics(true);}};
$('#importButton').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=e=>importFiles(e.target.files);$('#importLyrics').onclick=()=>{if(!meta.current)return toast('先选择一首音乐');$('#lrcInput').click();};$('#lrcInput').onchange=async e=>{if(e.target.files[0]){try{await importLrc(e.target.files[0]);}catch{toast('歌词导入失败');}}e.target.value='';};
$('#closeModal').onclick=$('#cancelModal').onclick=closeModal;
$('#modal').onclick=e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}};
$('#helpButton').onclick=()=>showModal('欢迎来到浅浅静听',`<div class="help-copy"><p><strong>把音乐放进来</strong><br>点击「导入音乐」，或把文件拖到窗口。支持 MP3、WAV、FLAC、M4A 等格式，能否播放取决于浏览器解码支持。内嵌封面与信息目前自动读取 MP3 的 ID3v2.3 / 2.4 标签。</p><p><strong>听歌，也看歌词</strong><br>点击底部专辑封面，展开黑胶播放页。可导入 LRC 歌词；一起导入的同名歌词会自动配对。歌曲「···」可更换封面、编辑信息和歌词。</p><p><strong>留住喜欢的心情</strong><br>侧栏「＋」建立歌单，在歌曲「···」中添加。歌曲与歌单存在当前浏览器中，清除浏览器网站数据会清空收藏，请保留原始音乐文件。</p><p><kbd>空格</kbd> 播放 / 暂停　<kbd>←</kbd> / <kbd>→</kbd> 快退 / 快进 5 秒<br><kbd>/</kbd> 搜索　<kbd>Esc</kbd> 收起播放页</p><p>内置三段原创器乐试听，播放页的文字为氛围文案。全部功能可离线使用，无需账户。</p></div>`,null,false);
audio.onplay=audio.onpause=()=>updatePlayer();audio.onended=()=>skip(1,true);audio.onerror=()=>{if(audio.getAttribute('src'))toast('这首音频无法解码，请换个格式试试');};
audio.onloadedmetadata=()=>{const t=byId(meta.current);if(t&&Number.isFinite(audio.duration)){t.duration=audio.duration;$('#duration').textContent=fmt(audio.duration);if(initialized&&meta.position>0&&Math.abs(audio.currentTime-meta.position)>1&&audio.currentTime===0)audio.currentTime=Math.min(meta.position,audio.duration);}};
audio.ontimeupdate=()=>{const time=audio.currentTime,dur=audio.duration;$('#currentTime').textContent=fmt(time);const pct=Number.isFinite(dur)&&dur>0?time/dur:0;$('#progress').value=pct*1000;setRange($('#progress'),pct*100);syncLyrics();meta.position=time;clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(),800);};
audio.onpause=()=>{updatePlayer();if(initialized)persist();};
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,button,a,[role="button"]')||$('#modal').open)return;if(e.key==='/'){e.preventDefault();$('#search').focus();}if(e.key==='Escape'){focus(false);$('#queuePanel').hidden=true;}if(e.key==='ArrowRight'&&Number.isFinite(audio.duration)){e.preventDefault();audio.currentTime=Math.min(audio.duration,audio.currentTime+5);}if(e.key==='ArrowLeft'){e.preventDefault();audio.currentTime=Math.max(0,audio.currentTime-5);}});
let dragDepth=0;document.addEventListener('dragenter',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();dragDepth++;$('#dropOverlay').hidden=false;}});document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('dragleave',e=>{e.preventDefault();if(--dragDepth<=0){dragDepth=0;$('#dropOverlay').hidden=true;}});document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('#dropOverlay').hidden=true;if(e.dataTransfer.files.length)importFiles(e.dataTransfer.files);});
async function init(){try{db=await openDB();tracks=await read('tracks');const state=await read('settings','state');if(state){meta={...meta,...state.meta};playlists=state.playlists||[];}else{tracks=defaults.map(t=>({...t}));for(const t of tracks)await write('tracks',t);playlists=[{id:uid(),name:'一个人的好天气',tracks:tracks.map(t=>t.id)},{id:uid(),name:'留一点时间给自己',tracks:[]}];meta.current=tracks[0].id;meta.queue=tracks.map(t=>t.id);await persist();}audio.volume=meta.volume;$('#volume').value=meta.volume;setRange($('#volume'),meta.volume*100);render();renderLyrics();const t=byId(meta.current);if(t)audio.src=source(t);initialized=true;document.dispatchEvent(new Event('libraryready'));if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});}catch(e){console.error(e);toast('本地存储不可用，请用启动器在常规浏览器中打开');} }
init();
