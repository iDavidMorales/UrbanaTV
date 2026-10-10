(()=>{
const $=id=>document.getElementById(id);
const panel=$('urbanMiniPlayer'),audio=$('urbanMiniAudio');
if(!panel||!audio)return;
const title=$('urbanMiniTitle'),artist=$('urbanMiniArtist'),toggle=$('urbanMiniToggle'),seek=$('urbanMiniSeek'),status=$('urbanMiniStatus'),list=$('urbanTracklist'),listToggle=$('urbanTracklistToggle'),open=$('urbanMiniOpen');
let tracks=[],current=-1;
const safe=p=>typeof p==='string'&&((p.startsWith('/mp3/')&&!p.includes('..'))||(p.startsWith('https://')&&p.includes('.public.blob.vercel-storage.com/')));
function sync(){
 toggle.textContent=audio.paused?'▶':'Ⅱ';toggle.setAttribute('aria-label',audio.paused?'Reproducir':'Pausar');
 title.textContent=current>=0?tracks[current].title:'UrbanaTV Music';
 artist.textContent=current>=0?tracks[current].artist:'La música no es contenido, es vida';
 for(const [i,b] of [...list.querySelectorAll('button[data-index]')].entries()){b.classList.toggle('active',i===current);b.setAttribute('aria-current',i===current?'true':'false');b.querySelector('.track-indicator').textContent=i===current&&!audio.paused?'♫':'▶'}
}
function choose(i){if(!tracks.length)return;current=(i+tracks.length)%tracks.length;audio.src=tracks[current].file;audio.play().catch(()=>{status.textContent='No se pudo reproducir la canción';sync()});sync()}
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
function hide(){panel.hidden=true;open.setAttribute('aria-expanded','false');audio.pause()}
open.addEventListener('click',()=>{panel.hidden?show():hide()});
$('urbanMiniClose').addEventListener('click',hide);
listToggle.addEventListener('click',()=>{list.hidden=!list.hidden;listToggle.setAttribute('aria-expanded',String(!list.hidden));listToggle.textContent=list.hidden?'☷ Lista de canciones':'☷ Ocultar canciones'});
toggle.addEventListener('click',()=>{if(current<0){choose(0);return}if(audio.paused)audio.play().catch(()=>{status.textContent='No se pudo reproducir'});else audio.pause()});
$('urbanMiniPrev').addEventListener('click',()=>choose(current-1));
$('urbanMiniNext').addEventListener('click',()=>choose(current+1));
audio.addEventListener('ended',()=>choose(current+1));
audio.addEventListener('play',sync);audio.addEventListener('pause',sync);
audio.addEventListener('timeupdate',()=>{seek.value=audio.duration&&Number.isFinite(audio.duration)?String(100*audio.currentTime/audio.duration):'0'});
seek.addEventListener('input',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(seek.value)/100});
fetch('/api/tracks',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Catálogo no disponible');return r.json()}).then(data=>{tracks=(Array.isArray(data.tracks)?data.tracks:[]).filter(t=>safe(t.file)&&t.title&&t.artist);status.textContent=tracks.length?tracks.length+' canciones disponibles':'Todavía no hay canciones MP3.';toggle.disabled=!tracks.length;renderList()}).catch(()=>{toggle.disabled=true;status.textContent='No se pudo cargar la biblioteca.';renderList()});
})();
