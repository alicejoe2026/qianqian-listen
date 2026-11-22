'use strict';
const lyricAttempts=new Set(),lyricJobs=[];let lyricWorker=false,searchSequence=0;
const onlineButton=document.createElement('button');onlineButton.className='text-button';onlineButton.id='onlineLyrics';onlineButton.innerHTML=`${icon('search')} 在线搜索歌词`;
const lyricActions=document.createElement('div');lyricActions.className='lyric-actions';$('#importLyrics').before(lyricActions);lyricActions.append(onlineButton,$('#importLyrics'));
onlineButton.onclick=()=>searchLyricsModal(meta.current);
const sourceCaption=document.createElement('div');sourceCaption.className='lyric-source';$('.lyrics-side').append(sourceCaption);
async function lyricsAPI(endpoint,params){
 if(location.protocol==='file:')throw new Error('在线歌词需要通过「启动浅浅静听」打开');
 const r=await fetch(`/api/lyrics/${endpoint}?${new URLSearchParams(params)}`,{signal:AbortSignal.timeout(27000)});
 if(!r.headers.get('content-type')?.includes('application/json'))throw new Error('请重新启动浅浅静听，启用在线歌词功能');
 const data=await r.json();if(!r.ok)throw new Error(data.error||'歌词来源暂不可用');return data;
}
async function applyOnlineLyrics(track,result,onlyIfEmpty=false){
 const data=await lyricsAPI('get',{source:result.source,id:result.id});
 if(!byId(track.id))throw new Error('歌曲已从音乐库移除');
 if(onlyIfEmpty&&track.lrc)return null;
 const updated={...track,lrc:data.text,lyricSource:data.source,lyricURL:data.url};
 await write('tracks',updated);Object.assign(track,updated);if(meta.current===track.id)renderLyrics();return data;
}
function searchLyricsModal(id){
 const t=byId(id);if(!t){toast('先选择一首音乐');return;}
 showModal('在线搜索歌词',`<div class="lyrics-search-fields"><label class="field">歌名<input id="lyricQueryTitle" value="${esc(t.title)}" maxlength="150" placeholder="输入歌曲名称"></label><label class="field">歌手<input id="lyricQueryArtist" value="${esc(t.artist==='未知歌手'?'':t.artist)}" maxlength="150" placeholder="可选，填写更准确"></label><button class="primary" id="runLyricSearch" type="button">${icon('search')} 搜索</button></div><p class="lyric-search-note">搜索网易云与 LRCLIB · 仅发送歌曲信息，不上传音频</p><div id="lyricResults" class="lyric-results" aria-live="polite"></div>`,null,false);
 $('#modal').classList.add('lyrics-dialog');
 $('#modal').addEventListener('close',()=>{$('#modal').classList.remove('lyrics-dialog');searchSequence++;},{once:true});
 const run=async()=>{
  const title=$('#lyricQueryTitle').value.trim(),artist=$('#lyricQueryArtist').value.trim();if(!title){toast('先填一个歌名吧');return;}
  const seq=++searchSequence,resultsNode=$('#lyricResults');$('#runLyricSearch').disabled=true;resultsNode.innerHTML='<p class="help-copy lyric-loading">正在寻找这首歌的歌词…</p>';
  try{const data=await lyricsAPI('search',{title,artist,duration:t.duration||0});if(seq!==searchSequence)return;
   resultsNode.innerHTML=(data.warnings.length?`<p class="lyric-search-note">部分来源暂不可用，已显示其他来源结果。</p>`:'')+(data.results.length?data.results.map((r,i)=>`<div class="lyric-result"><div><strong>${esc(r.title)}</strong><p>${esc(r.artist)} · ${fmt(r.duration)}<br>${esc(r.album||'未知专辑')}</p><span class="lyric-badge">${r.source==='netease'?'网易云':'LRCLIB'}${r.synced===true?' · 滚动歌词':r.synced===false?' · 纯文本歌词':''}</span>${r.score>=95?'<span class="match-badge">推荐匹配</span>':''}</div><button type="button" class="secondary" data-use-lyric="${i}">使用歌词</button></div>`).join(''):'<div class="empty-state"><p>暂时没有找到匹配歌词。</p><small>试试简化歌名、调整歌手，或导入 LRC 文件。</small></div>');
   resultsNode.onclick=async e=>{const b=e.target.closest('[data-use-lyric]');if(!b)return;b.disabled=true;b.textContent='获取中…';try{const r=data.results[+b.dataset.useLyric];const result=await applyOnlineLyrics(t,r);if(seq===searchSequence)closeModal();toast(`已保存${result.synced?'同步':'文本'}歌词 · ${result.source}`);}catch(error){toast(error.message);b.disabled=false;b.textContent='使用歌词';}};
  }catch(error){if(seq===searchSequence)resultsNode.innerHTML=`<p class="help-copy">${esc(error.message)}</p><p class="lyric-search-note">可以重新搜索，或先导入本地 LRC 歌词。</p>`;}finally{if(seq===searchSequence)$('#runLyricSearch').disabled=false;}
 };
 $('#runLyricSearch').onclick=run;for(const el of [$('#lyricQueryTitle'),$('#lyricQueryArtist')])el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(!$('#runLyricSearch').disabled)run();}};run();
}
// Auto-apply only when title, artist and duration closely agree. Keep ambiguous versions for selection.
function queueLyricMatch(t){if(!t||t.demo||t.lrc||lyricAttempts.has(t.id))return;lyricAttempts.add(t.id);lyricJobs.push(t.id);workLyricQueue();}
async function workLyricQueue(){
 if(lyricWorker)return;lyricWorker=true;
 while(lyricJobs.length){
  const t=byId(lyricJobs.shift());if(!t||t.lrc)continue;
  try{
   const data=await lyricsAPI('search',{title:t.title,artist:t.artist,duration:t.duration||0});
   const candidates=data.results.filter(r=>r.score>=95&&r.duration&&t.duration&&Math.abs(r.duration-t.duration)<=4).slice(0,3);
   for(const candidate of candidates){
    if(t.lrc||!byId(t.id))break;
    try{const saved=await applyOnlineLyrics(t,candidate,true);if(saved&&meta.current===t.id)toast('已自动匹配歌词，并保存到本地');break;}catch{await new Promise(r=>setTimeout(r,500));}
   }
  }catch{ /* Online failure never interrupts listening. Manual search remains available. */ }
  if(lyricJobs.length)await new Promise(r=>setTimeout(r,500));
 }
 lyricWorker=false;
}
const baseRenderLyrics=renderLyrics;
renderLyrics=function(){baseRenderLyrics();const t=byId(meta.current);sourceCaption.textContent=t?.lyricSource?`歌词来源：${t.lyricSource} · 已保存本地`:'';if(t&&!t.lrc){$('#lyrics').innerHTML='<div class="lyric-empty">此刻，让旋律说话。<br><small>试试在线搜索歌词，找到属于这首歌的文字。</small></div>';queueLyricMatch(t);}else sourceCaption.textContent=t?.lyricSource?`歌词来源：${t.lyricSource} · 已保存本地`:'';};
const baseTrackMenu=trackMenu;
trackMenu=function(id){baseTrackMenu(id);const b=document.createElement('button');b.type='button';b.innerHTML=`${icon('search')} 在线搜索歌词`;b.onclick=()=>{closeModal();searchLyricsModal(id);};$('#modalBody .modal-menu').prepend(b);};
const baseImportFiles=importFiles;
importFiles=async function(files){await baseImportFiles(files);for(const t of tracks)if(t.blob&&!t.lrc)queueLyricMatch(t);};
if(byId(meta.current))renderLyrics();
