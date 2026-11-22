importScripts('fm-engine.js');
self.onmessage=e=>{const {id,segments,sampleRate,track}=e.data;try{self.postMessage({id,...FMEngine.analyze(segments,sampleRate,track)});}catch(error){self.postMessage({id,error:error.message});}};
