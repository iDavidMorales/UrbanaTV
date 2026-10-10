(()=>{
const by=id=>document.getElementById(id);
const panel=by('urbanMiniPlayer'),audio=by('urbanMiniAudio');
if(!panel||!audio)return;
let tracks=[],current=-1;
const full=by('urbanFull'),fullTitle=by('urbanFullTitle'),fullArtist=by('urbanFullArtist'),fullToggle=by('urbanFullToggle'),fullSeek=by('urbanFullSeek');
const title=by('urbanMiniTitle'),artist=by('urbanMiniArtist'),toggle=by('urbanMiniToggle'),seek=by('urbanMiniSeek'),status=by('urbanMiniStatus');
function update(){if(fullToggle)fullToggle.textContent=audio.paused?'▶':'Ⅱ';if(fullTitle)fullTitle.textContent=current>=0?tracks[current].title:'UrbanaTV Music';if(fullArtist)fullArtist.textContent=current>=0?tracks[current].artist:'La música no es contenido, es vida';toggle.textContent=audio.paused?'▶':'Ⅱ';toggle.setAttribute('aria-label',audio.paused?'Reproducir':'Pausar');if(current>=0){title.textContent=tracks[current].title;artist.textContent=tracks[current].artist}else{title.textContent='UrbanaTV Music';artist.textContent='La música no es contenido, es vida'}}
function choose(i){if(!tracks.length)return;current=(i+tracks.length)%tracks.length;audio.src=tracks[current].file;audio.play().catch(()=>{status.textContent='No se pudo reproducir este MP3';update()});update()}
function show(){panel.hidden=false;by('urbanMiniOpen').setAttribute('aria-expanded','true');update()}
function hide(){panel.hidden=true;by('urbanMiniOpen').setAttribute('aria-expanded','false');audio.pause()}
by('urbanMiniOpen').addEventListener('click',()=>panel.hidden?show():hide());
by('urbanMiniClose').addEventListener('click',hide);
by('urbanExpand').addEventListener('click',()=>{show();full.hidden=false;document.body.style.overflow='hidden';update()});
by('urbanCollapse').addEventListener('click',()=>{full.hidden=true;document.body.style.overflow='';show()});
by('urbanFullToggle').addEventListener('click',()=>toggle.click());
by('urbanFullPrev').addEventListener('click',()=>by('urbanMiniPrev').click());
by('urbanFullNext').addEventListener('click',()=>by('urbanMiniNext').click());
fullSeek.addEventListener('input',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(fullSeek.value)/100});
toggle.addEventListener('click',()=>{if(current<0){choose(0);return}if(audio.paused)audio.play().catch(()=>status.textContent='No se pudo reproducir');else audio.pause()});
by('urbanMiniPrev').addEventListener('click',()=>choose(current-1));
by('urbanMiniNext').addEventListener('click',()=>choose(current+1));
audio.addEventListener('ended',()=>choose(current+1));
audio.addEventListener('play',update);audio.addEventListener('pause',update);
audio.addEventListener('timeupdate',()=>{seek.value=audio.duration&&Number.isFinite(audio.duration)?String(100*audio.currentTime/audio.duration):'0';fullSeek.value=seek.value});
seek.addEventListener('input',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(seek.value)/100});
const safe=p=>typeof p==='string'&&((p.startsWith('/mp3/')&&!p.includes('..'))||(p.startsWith('https://')&&p.includes('.public.blob.vercel-storage.com/')));
fetch('/api/tracks',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Catálogo no disponible');return r.json()}).then(data=>{tracks=(Array.isArray(data.tracks)?data.tracks:[]).filter(t=>safe(t.file)&&t.title&&t.artist);status.textContent=tracks.length?tracks.length+' canciones disponibles':'Todavía no hay canciones MP3. Puedes subir la primera desde Música.';by('urbanFullStatus').textContent=status.textContent;toggle.disabled=!tracks.length;update()}).catch(()=>{toggle.disabled=true;status.textContent='No se pudo cargar la biblioteca. Intenta más tarde.';by('urbanFullStatus').textContent=status.textContent});
})();
