'use strict';
// Space belongs to playback, even when a previously clicked Next button has focus.
// Enter still activates focused buttons. Editing fields and modal dialogs keep
// their normal keyboard behavior.
let playbackSpaceHeld=false;
function playbackSpaceKey(event){return event.code==='Space'||event.key===' ';}
function playbackIsEditing(target){return !!(target?.isContentEditable||target?.closest?.('input,textarea,select,[role="textbox"]'));}
document.addEventListener('keydown',event=>{
 if(!playbackSpaceKey(event)||event.isComposing||event.altKey||event.ctrlKey||event.metaKey)return;
 if(playbackIsEditing(event.target)||document.querySelector('#modal')?.open)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(event.repeat||playbackSpaceHeld)return;
 playbackSpaceHeld=true;
 if(typeof fmAudio!=='undefined'&&!fmAudio.paused){fmToggle();return;}
 if(!audio.paused){toggle();return;}
 if(typeof fmReady!=='undefined'&&fmReady&&fmState.active){fmToggle();return;}
 toggle();
},true);
document.addEventListener('keyup',event=>{
 if(!playbackSpaceKey(event))return;
 if(playbackSpaceHeld){event.preventDefault();event.stopImmediatePropagation();}
 playbackSpaceHeld=false;
},true);
window.addEventListener('blur',()=>{playbackSpaceHeld=false;});
