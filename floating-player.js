(()=>{
const $=id=>document.getElementById(id);
const panel=$('urbanMiniPlayer'),audio=$('urbanMiniAudio');
if(!panel||!audio)return;
const title=$('urbanMiniTitle'),artist=$('urbanMiniArtist'),toggle=$('urbanMiniToggle'),seek=$('urbanMiniSeek'),status=$('urbanMiniStatus'),list=$('urbanTracklist'),listToggle=$('urbanTracklistToggle'),open=$('urbanMiniOpen');
let tracks=[],current=-1,lastSaved=0,lastUrlSync=0;const promoPlay=new URLSearchParams(location.search).get('playMusic')==='1';const STATE_KEY='urbanatv:last-track:v1';let saved=null;try{saved=JSON.parse(localStorage.getItem(STATE_KEY)||'null')}catch{};
function persist(force=false){if(current<0||!tracks[current])return;const now=Date.now();if(!force&&now-lastSaved<2500)return;lastSaved=now;try{localStorage.setItem(STATE_KEY,JSON.stringify({file:tracks[current].file,time:Math.max(0,audio.currentTime||0),playing:!audio.paused,updated:now}))}catch{}}
const safe=p=>typeof p==='string'&&((p.startsWith('/mp3/')&&!p.includes('..'))||(p.startsWith('https://')&&p.includes('.public.blob.vercel-storage.com/')));
function sync(){
 toggle.innerHTML=audio.paused?'<i class="fa-solid fa-play" aria-hidden="true"></i>':'<i class="fa-solid fa-pause" aria-hidden="true"></i>';toggle.setAttribute('aria-label',audio.paused?'Reproducir':'Pausar');toggle.title=audio.paused?'Reproducir':'Pausar';panel.dataset.playing=String(!audio.paused);
 title.textContent=current>=0?tracks[current].title:'UrbanaTV Music';
 artist.textContent=current>=0?tracks[current].artist:'La música no es contenido, es vida';
 for(const [i,b] of [...list.querySelectorAll('button[data-index]')].entries()){b.classList.toggle('active',i===current);b.setAttribute('aria-current',i===current?'true':'false');b.querySelector('.track-indicator').innerHTML=i===current&&!audio.paused?'<i class="fa-solid fa-volume-high" aria-hidden="true"></i>':'<i class="fa-solid fa-play" aria-hidden="true"></i>'}
}
function stableTrackId(track){return String(track?.id??track?._id??track?.slug??track?.file??'')}
function syncUrl(force=false){
 if(current<0||!tracks[current])return;
 const now=Date.now();if(!force&&now-lastUrlSync<5000)return;lastUrlSync=now;
 try{
  const track=tracks[current],u=new URL(location.href);
  u.searchParams.set('track',track.file);
  const id=stableTrackId(track);if(id)u.searchParams.set('trackId',id);
  if(Number.isFinite(audio.currentTime)&&audio.currentTime>0)u.searchParams.set('t',String(Math.floor(audio.currentTime)));else u.searchParams.delete('t');
  const next=u.pathname+u.search+u.hash;
  if(next!==location.pathname+location.search+location.hash)history.replaceState({...history.state,urbanTrack:track.file,urbanTrackId:id},'',next);
 }catch{}
}
function choose(i,options={}){
 if(!tracks.length)return;persist(true);current=(i+tracks.length)%tracks.length;audio.src=tracks[current].file;
 if(Number.isFinite(Number(options.time))&&Number(options.time)>0)audio.addEventListener('loadedmetadata',()=>{audio.currentTime=Math.min(Number(options.time),Math.max(0,(audio.duration||Number(options.time))-1));syncUrl(true)},{once:true});
 syncUrl(true);
 status.textContent='Seleccionada: '+tracks[current].title+' · ID: '+stableTrackId(tracks[current]);
 if(options.autoplay!==false)audio.play().then(()=>{status.textContent='Reproduciendo ahora · '+tracks[current].title;syncUrl(true)}).catch(()=>{status.textContent='La canción está lista. Pulsa ▶ para reproducir.';sync()});
 sync()
}
function renderList(){
 list.replaceChildren();
 if(!tracks.length){const p=document.createElement('p');p.className='urban-mini-status';p.textContent='Aún no hay canciones. Sube la primera desde la biblioteca.';list.append(p);return}
 for(const [i,t] of tracks.entries()){
 const b=document.createElement('button');b.type='button';b.className='urban-track';b.dataset.index=String(i);
 const note=document.createElement('span');note.className='track-indicator';note.textContent='▶';
 const desc=document.createElement('span');desc.className='track-desc';
 const name=document.createElement('strong');name.textContent=t.title;
 const who=document.createElement('small');who.textContent=t.artist;
 desc.append(name,who);b.append(note,desc);b.addEventListener('click',()=>choose(i));list.append(b)
 }
 sync()
}
function show(){panel.hidden=false;open.setAttribute('aria-expanded','true');sync()}
function hide(){panel.hidden=true;open.setAttribute('aria-expanded','false');persist(true)}
window.addEventListener('message',event=>{if(event.origin!==location.origin||!event.data||event.data.type!=='urbana-play-track')return;const frame=document.querySelector('#urbanRouteMount iframe');if(!frame||event.source!==frame.contentWindow)return;const i=tracks.findIndex(t=>t.file===event.data.file);if(i>=0){show();choose(i)}});

// Atajos de teclado accesibles: espacio reproducir/pausar, flechas buscar y Shift+flechas cambiar canción.
document.addEventListener('keydown',event=>{
 if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
 const target=event.target,tag=target&&target.tagName?target.tagName.toLowerCase():'';
 if(['input','textarea','select'].includes(tag)||target?.isContentEditable)return;
 if(event.code==='Space'&&current>=0){event.preventDefault();toggle.click();return}
 if(event.key==='ArrowLeft'&&current>=0&&!event.shiftKey){event.preventDefault();audio.currentTime=Math.max(0,audio.currentTime-10);persist(true);syncUrl(true);return}
 if(event.key==='ArrowRight'&&current>=0&&!event.shiftKey){event.preventDefault();audio.currentTime=Math.min(audio.duration||Infinity,audio.currentTime+10);persist(true);syncUrl(true);return}
 if(event.shiftKey&&event.key==='ArrowLeft'&&tracks.length){event.preventDefault();choose(current-1);return}
 if(event.shiftKey&&event.key==='ArrowRight'&&tracks.length){event.preventDefault();choose(current+1)}
});
// Volver/avanzar restaura la canción y el segundo indicados en la URL sin perder el estado del mini reproductor.
window.addEventListener('popstate',()=>{
 const params=new URLSearchParams(location.search),file=params.get('track'),id=params.get('trackId');
 if(!file&&!id)return;
 const idx=tracks.findIndex(t=>(file&&t.file===file)||(id&&stableTrackId(t)===id));
 if(idx<0)return;
 const time=Math.max(0,Number(params.get('t')||0));
 if(idx!==current){const resumePlayback=!audio.paused;choose(idx,{time,autoplay:resumePlayback})}
 else if(Number.isFinite(time)&&time>=0&&audio.readyState>=1){audio.currentTime=Math.min(time,Number.isFinite(audio.duration)?Math.max(0,audio.duration-1):time);persist(true)}
});

open.addEventListener('click',()=>{panel.hidden?show():hide()});
$('urbanMiniClose').addEventListener('click',hide);
listToggle.addEventListener('click',()=>{const isOpen=list.hidden;list.hidden=!isOpen;listToggle.setAttribute('aria-expanded',String(isOpen));listToggle.setAttribute('aria-label',isOpen?'Ocultar lista de canciones':'Mostrar lista de canciones');listToggle.title=isOpen?'Ocultar canciones':'Mostrar lista de canciones';listToggle.innerHTML=isOpen?'<i class="fa-solid fa-list" aria-hidden="true"></i><span>Ocultar lista</span>':'<i class="fa-solid fa-list" aria-hidden="true"></i><span>Lista de canciones</span>';if(isOpen)list.scrollIntoView({block:'nearest',behavior:'smooth'});});
toggle.addEventListener('click',async()=>{if(!tracks.length){status.textContent='No hay canciones disponibles para reproducir';return}if(current<0){choose(0);return}if(audio.paused){status.textContent='Iniciando reproducción…';try{await audio.play();status.textContent='Reproduciendo ahora'}catch(e){status.textContent='El navegador bloqueó la reproducción. Pulsa ▶ otra vez o elige una canción de la lista.'}sync()}else{audio.pause();status.textContent='Reproducción pausada';sync()}});
$('urbanMiniPrev').addEventListener('click',()=>choose(current-1));
$('urbanMiniNext').addEventListener('click',()=>choose(current+1));
audio.addEventListener('ended',()=>choose(current+1));
// Controles multimedia del sistema operativo, auriculares y pantalla bloqueada.
function updateMediaSession(){try{if(!('mediaSession' in navigator)||current<0||!tracks[current])return;const t=tracks[current];if('MediaMetadata' in window)navigator.mediaSession.metadata=new MediaMetadata({title:t.title||'UrbanaTV Music',artist:t.artist||'UrbanaTV',album:'UrbanaTV Music',artwork:t.cover&&safe(t.cover)?[{src:t.cover}]:[]});for(const [action,handler] of Object.entries({play:()=>audio.play().catch(()=>{}),pause:()=>audio.pause(),previoustrack:()=>choose(current-1),nexttrack:()=>choose(current+1),seekbackward:d=>{audio.currentTime=Math.max(0,audio.currentTime-(d.seekOffset||10));syncUrl(true)},seekforward:d=>{audio.currentTime=Math.min(audio.duration||Infinity,audio.currentTime+(d.seekOffset||10));syncUrl(true)}})){try{navigator.mediaSession.setActionHandler(action,handler)}catch{}}if(Number.isFinite(audio.duration)&&audio.duration>0)navigator.mediaSession.setPositionState({duration:audio.duration,playbackRate:audio.playbackRate,position:Math.min(audio.currentTime,audio.duration)})}catch{}}
audio.addEventListener('loadedmetadata',updateMediaSession);audio.addEventListener('timeupdate',()=>{try{if('mediaSession' in navigator&&Number.isFinite(audio.duration)&&audio.duration>0)navigator.mediaSession.setPositionState({duration:audio.duration,playbackRate:audio.playbackRate,position:Math.min(audio.currentTime,audio.duration)})}catch{}});window.addEventListener('urban-video-start',()=>{if(!audio.paused){audio.pause();status.textContent='Música pausada mientras ves el video';persist(true)}});
audio.addEventListener('play',()=>{sync();persist(true);syncUrl(true)});audio.addEventListener('pause',()=>{sync();persist(true);syncUrl(true)});audio.addEventListener('seeked',()=>{persist(true);syncUrl(true)});window.addEventListener('pagehide',()=>persist(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)persist(true)});
audio.addEventListener('timeupdate',()=>{seek.value=audio.duration&&Number.isFinite(audio.duration)?String(100*audio.currentTime/audio.duration):'0';persist();syncUrl()});
seek.addEventListener('input',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(seek.value)/100});
fetch('/api/tracks',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Catálogo no disponible');return r.json()}).then(data=>{tracks=(Array.isArray(data.tracks)?data.tracks:[]).filter(t=>safe(t.file)&&t.title&&t.artist);status.textContent=tracks.length?tracks.length+' canciones disponibles':'Todavía no hay canciones MP3.';toggle.disabled=!tracks.length;renderList();show();if(tracks.length){const params=new URLSearchParams(location.search),sharedFile=params.get('track'),sharedId=params.get('trackId'),sharedIndex=tracks.findIndex(t=>(sharedFile&&t.file===sharedFile)||(sharedId&&stableTrackId(t)===sharedId)),found=sharedIndex>=0?sharedIndex:(!promoPlay&&saved?tracks.findIndex(t=>t.file===saved.file):-1);current=found>=0?found:0;audio.src=tracks[current].file;const resume=sharedIndex>=0?Math.max(0,Number(params.get('t')||0)):(found>=0&&Number.isFinite(Number(saved.time))?Math.max(0,Number(saved.time)):0);if(resume){audio.addEventListener('loadedmetadata',()=>{audio.currentTime=Math.min(resume,Math.max(0,(audio.duration||resume)-1));sync();syncUrl(true)},{once:true})}status.textContent=sharedIndex>=0?'Enlace compartido: '+tracks[current].title:(resume?'Retomando donde te quedaste…':'Lista para escuchar');sync();if(sharedIndex>=0||promoPlay||!saved||saved.playing){audio.play().then(()=>{status.textContent='Reproduciendo ahora';sync();syncUrl(true)}).catch(()=>{status.textContent='La canción está lista. Pulsa ▶ para reproducir.';sync();syncUrl(true)})}else syncUrl(true)}}).catch(()=>{toggle.disabled=true;status.textContent='No se pudo cargar la biblioteca.';renderList();show()});
})();

/* Audience retention: aggregate watch-time signals for the shared YouTube viewer. */
(()=> {
 const endpoint='/api/video-analytics', modal=document.getElementById('watchModal');
 if(!modal)return;
 let video=null,lastTick=0,timer=null,logged='';
 function send(action,extra={}) {
  if(!video)return;
  fetch(endpoint+'?action='+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({video_id:video,title:document.getElementById('watchTitle')?.textContent||'',category:'UrbanaTV',...extra}),keepalive:true}).catch(()=>{});
 }
 function detect(){
  const iframe=modal.querySelector('#player iframe');
  const id=iframe?.src.match(/\/embed\/([\w-]{11})/)?.[1];
  if(!id){stop();return}
  if(id!==video){stop();video=id;logged='';lastTick=Date.now();if(logged!==id){send('view');logged=id}timer=setInterval(tick,10000)}
 }
 function tick(){
  if(!video||!modal.classList.contains('open'))return;
  const now=Date.now(),elapsed=(now-lastTick)/1000;
  if(elapsed>=8&&elapsed<=22)send('watch',{seconds:Math.min(20,Math.round(elapsed))});
  lastTick=now;
 }
 function stop(){if(timer)clearInterval(timer);timer=null;video=null;lastTick=0}
 new MutationObserver(detect).observe(modal,{attributes:true,attributeFilter:['class'],subtree:true,childList:true});
 window.addEventListener('urban-video-start',()=>setTimeout(detect,300));
 window.addEventListener('urban-video-end',()=>{tick();stop()});
})();
/* Order the video catalog by aggregate retention, not clicks alone. */
(()=> {
 const root=document.getElementById('catalog');
 if(!root)return;
 let scores={},busy=false;
 const sortCards=()=>{
  if(busy)return;
  const cards=[...root.querySelectorAll('.video-card')];
  if(cards.length<2)return;
  const idOf=card=>card.querySelector('img')?.src.match(/\/vi\/([\w-]{11})\//)?.[1]||'';
  const ordered=[...cards].sort((a,b)=>{
   const x=scores[idOf(a)]||{},y=scores[idOf(b)]||{};
   return (Number(y.watch_seconds)||0)-(Number(x.watch_seconds)||0)||
    (Number(y.avg_seconds)||0)-(Number(x.avg_seconds)||0)||
    (Number(y.views)||0)-(Number(x.views)||0);
  });
  if(ordered.some((card,i)=>card!==cards[i])){
   busy=true;ordered.forEach(card=>root.append(card));busy=false;
  }
 };
 fetch('/api/video-analytics',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{
  if(!d||!Array.isArray(d.videos))return;
  scores=Object.fromEntries(d.videos.map(v=>[v.video_id,v]));
  sortCards();
 }).catch(()=>{});
 let scheduled=false;
 new MutationObserver(()=>{
  if(scheduled)return;scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;sortCards()});
 }).observe(root,{childList:true});
})();