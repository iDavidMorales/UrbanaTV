(()=>{
const root=document.getElementById('urbanRouteMount');if(!root)return;
const routes=p=>p==='/musica'||p==='/noticias'||p.startsWith('/noticias/');
const source=p=>p==='/musica'?'/musica.html?embedded=1':'/noticias.html?embedded=1'+(p.startsWith('/noticias/')?'&slug='+encodeURIComponent(p.slice('/noticias/'.length)):'');
const frame=document.createElement('iframe');frame.title='Sección de UrbanaTV';frame.style.cssText='width:100%;height:100%;border:0;display:block';root.append(frame);
function playbackSearch(targetSearch=''){
 const incoming=new URLSearchParams(targetSearch||'');
 const current=new URLSearchParams(location.search);
 const params=new URLSearchParams();
 let saved=null;try{saved=JSON.parse(localStorage.getItem('urbanatv:last-track:v1')||'null')}catch{}
 // Preserve playback from the target URL first, then the current URL, and finally
 // the mini-player's persisted state (useful when a news slug is opened without a query).
 const track=incoming.get('track')||current.get('track')||(saved&&typeof saved.file==='string'?saved.file:'');
 const time=incoming.get('t')||current.get('t')||(saved&&Number.isFinite(Number(saved.time))&&Number(saved.time)>0?String(Math.floor(Number(saved.time))):'');
 if(track)params.set('track',track);
 if(time)params.set('t',time);
 const query=params.toString();return query?'?'+query:'';
}
function show(path,push=false,hash='',search=''){
 const active=routes(path),target=path+playbackSearch(search)+(hash||'');
 if(push&&(location.pathname+location.search+location.hash)!==target)history.pushState({urbanRoute:path},'',target);
 root.hidden=!active;document.body.classList.toggle('urban-route-active',active);
 if(active){const url=source(path);if(frame.getAttribute('src')!==url)frame.src=url;window.scrollTo(0,0)}
 else {if(frame.hasAttribute('src'))frame.removeAttribute('src');if(hash){requestAnimationFrame(()=>{const section=document.getElementById(hash.slice(1));if(section)section.scrollIntoView({behavior:'smooth',block:'start'})})}else window.scrollTo({top:0,behavior:'smooth'})}
 document.title=active?(path==='/musica'?'Música | UrbanaTV':'Notas de la calle | UrbanaTV'):'UrbanaTV — La calle tiene voz';
}
window.urbanaNavigate=show;
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.data?.type!=='urbana-route')return;if(event.source!==frame.contentWindow)return;const path=String(event.data.path||'');if(routes(path))show(path,true)});
document.addEventListener('click',e=>{
 const a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||a.target==='_blank'||a.hasAttribute('download'))return;
 const url=new URL(a.href);if(url.origin!==location.origin)return;
 if(routes(url.pathname)||url.pathname==='/'||url.pathname.startsWith('/videos/')){e.preventDefault();if(url.pathname.startsWith('/videos/')){history.pushState({},'',url.pathname+playbackSearch(url.search));show('/',false);const id=url.pathname.match(/-([A-Za-z0-9_-]{11})$/)?.[1];if(id&&typeof window.urbanaOpenVideo==='function')window.urbanaOpenVideo(id)}else show(url.pathname,true,url.hash,url.search)}
});
frame.addEventListener('load',()=>{try{const doc=frame.contentDocument;if(!doc)return;const style=doc.createElement('style');style.textContent='header,footer:not(.player){display:none!important}body{padding-top:12px!important}';doc.head.append(style);doc.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||a.target==='_blank'||e.ctrlKey||e.metaKey)return;const u=new URL(a.href);if(u.origin===location.origin&&(routes(u.pathname)||u.pathname==='/')){e.preventDefault();show(u.pathname,true,u.hash)}})}catch{}});
window.addEventListener('popstate',()=>{if(location.pathname.startsWith('/videos/')){show('/',false);const id=location.pathname.match(/-([A-Za-z0-9_-]{11})$/)?.[1];if(id&&window.urbanaOpenVideo)window.urbanaOpenVideo(id)}else{show(location.pathname,false,location.hash,location.search);window.dispatchEvent(new Event('urban-route-changed'))}});
show(location.pathname,false,location.hash,location.search);
})();