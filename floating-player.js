(()=>{
const $=id=>document.getElementById(id);
const panel=$('urbanMiniPlayer'),audio=$('urbanMiniAudio');
if(!panel||!audio)return;
const title=$('urbanMiniTitle'),artist=$('urbanMiniArtist'),toggle=$('urbanMiniToggle'),seek=$('urbanMiniSeek'),status=$('urbanMiniStatus'),list=$('urbanTracklist'),listToggle=$('urbanTracklistToggle'),open=$('urbanMiniOpen');
let tracks=[],current=-1,lastSaved=0;const promoPlay=new URLSearchParams(location.search).get('playMusic')==='1';const STATE_KEY='urbanatv:last-track:v1';let saved=null;try{saved=JSON.parse(localStorage.getItem(STATE_KEY)||'null')}catch{};
function persist(force=false){if(current<0||!tracks[current])return;const now=Date.now();if(!force&&now-lastSaved<2500)return;lastSaved=now;try{localStorage.setItem(STATE_KEY,JSON.stringify({file:tracks[current].file,time:Math.max(0,audio.currentTime||0),playing:!audio.paused,updated:now}))}catch{}}
const safe=p=>typeof p==='string'&&((p.startsWith('/mp3/')&&!p.includes('..'))||(p.startsWith('https://')&&p.includes('.public.blob.vercel-storage.com/')));
function sync(){
 toggle.innerHTML=audio.paused?'<i class="fa-solid fa-play" aria-hidden="true"></i>':'<i class="fa-solid fa-pause" aria-hidden="true"></i>';toggle.setAttribute('aria-label',audio.paused?'Reproducir':'Pausar');toggle.title=audio.paused?'Reproducir':'Pausar';
 title.textContent=current>=0?tracks[current].title:'UrbanaTV Music';
 artist.textContent=current>=0?tracks[current].artist:'La música no es contenido, es vida';
 for(const [i,b] of [...list.querySelectorAll('button[data-index]')].entries()){b.classList.toggle('active',i===current);b.setAttribute('aria-current',i===current?'true':'false');b.querySelector('.track-indicator').innerHTML=i===current&&!audio.paused?'<i class="fa-solid fa-volume-high" aria-hidden="true"></i>':'<i class="fa-solid fa-play" aria-hidden="true"></i>'}
}
function choose(i){if(!tracks.length)return;persist(true);current=(i+tracks.length)%tracks.length;audio.src=tracks[current].file;audio.play().catch(()=>{status.textContent='No se pudo reproducir la canción';sync()});sync()}
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
open.addEventListener('click',()=>{panel.hidden?show():hide()});
$('urbanMiniClose').addEventListener('click',hide);
listToggle.addEventListener('click',()=>{const isOpen=list.hidden;list.hidden=!isOpen;listToggle.setAttribute('aria-expanded',String(isOpen));listToggle.setAttribute('aria-label',isOpen?'Ocultar lista de canciones':'Mostrar lista de canciones');listToggle.title=isOpen?'Ocultar canciones':'Mostrar lista de canciones';listToggle.innerHTML=isOpen?'<i class="fa-solid fa-list" aria-hidden="true"></i><span>Ocultar lista</span>':'<i class="fa-solid fa-list" aria-hidden="true"></i><span>Lista de canciones</span>';if(isOpen)list.scrollIntoView({block:'nearest',behavior:'smooth'});});
toggle.addEventListener('click',async()=>{if(!tracks.length){status.textContent='No hay canciones disponibles para reproducir';return}if(current<0){choose(0);return}if(audio.paused){status.textContent='Iniciando reproducción…';try{await audio.play();status.textContent='Reproduciendo ahora'}catch(e){status.textContent='El navegador bloqueó la reproducción. Pulsa ▶ otra vez o elige una canción de la lista.'}sync()}else{audio.pause();status.textContent='Reproducción pausada';sync()}});
$('urbanMiniPrev').addEventListener('click',()=>choose(current-1));
$('urbanMiniNext').addEventListener('click',()=>choose(current+1));
audio.addEventListener('ended',()=>choose(current+1));window.addEventListener('urban-video-start',()=>{if(!audio.paused){audio.pause();status.textContent='Música pausada mientras ves el video';persist(true)}});
audio.addEventListener('play',()=>{sync();persist(true)});audio.addEventListener('pause',()=>{sync();persist(true)});audio.addEventListener('seeked',()=>persist(true));window.addEventListener('pagehide',()=>persist(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)persist(true)});
audio.addEventListener('timeupdate',()=>{seek.value=audio.duration&&Number.isFinite(audio.duration)?String(100*audio.currentTime/audio.duration):'0';persist()});
seek.addEventListener('input',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(seek.value)/100});
fetch('/api/tracks',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Catálogo no disponible');return r.json()}).then(data=>{tracks=(Array.isArray(data.tracks)?data.tracks:[]).filter(t=>safe(t.file)&&t.title&&t.artist);status.textContent=tracks.length?tracks.length+' canciones disponibles':'Todavía no hay canciones MP3.';toggle.disabled=!tracks.length;renderList();show();if(tracks.length){const found=!promoPlay&&saved&&tracks.findIndex(t=>t.file===saved.file);current=found>=0?found:0;audio.src=tracks[current].file;const resume=found>=0&&Number.isFinite(Number(saved.time))?Math.max(0,Number(saved.time)):0;if(resume){audio.addEventListener('loadedmetadata',()=>{audio.currentTime=Math.min(resume,Math.max(0,(audio.duration||resume)-1));sync()},{once:true})}status.textContent=resume?'Retomando donde te quedaste…':'Lista para escuchar';sync();if(promoPlay||!saved||saved.playing){audio.play().then(()=>{status.textContent='Reproduciendo ahora';sync();if(promoPlay){history.replaceState({},'',location.pathname+location.hash)}}).catch(()=>{status.textContent='Pulsa ▶ para continuar escuchando';sync()})}}}).catch(()=>{toggle.disabled=true;status.textContent='No se pudo cargar la biblioteca.';renderList();show()});
})();
