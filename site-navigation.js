(()=>{
const root=document.getElementById('urbanRouteMount');if(!root)return;
const routes=p=>p==='/musica'||p==='/noticias'||p.startsWith('/noticias/');
const source=p=>p==='/musica'?'/musica.html?embedded=1':'/noticias.html?embedded=1'+(p.startsWith('/noticias/')?'&slug='+encodeURIComponent(p.slice('/noticias/'.length)):'');
const frame=document.createElement('iframe');frame.title='Sección de UrbanaTV';frame.style.cssText='width:100%;height:100%;border:0;display:block';root.append(frame);
function show(path,push=false,hash=''){
 const active=routes(path),target=path+(hash||'');
 if(push&&location.pathname+location.hash!==target)history.pushState({urbanRoute:path},'',target);
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
 if(routes(url.pathname)||url.pathname==='/'||url.pathname.startsWith('/videos/')){e.preventDefault();if(url.pathname.startsWith('/videos/')){history.pushState({},'',url.pathname);show('/',false);const id=url.pathname.match(/-([A-Za-z0-9_-]{11})$/)?.[1];if(id&&typeof window.urbanaOpenVideo==='function')window.urbanaOpenVideo(id)}else show(url.pathname,true,url.hash)}
});
frame.addEventListener('load',()=>{try{const doc=frame.contentDocument;if(!doc)return;const style=doc.createElement('style');style.textContent='header,footer:not(.player){display:none!important}body{padding-top:12px!important}';doc.head.append(style);doc.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||a.target==='_blank'||e.ctrlKey||e.metaKey)return;const u=new URL(a.href);if(u.origin===location.origin&&(routes(u.pathname)||u.pathname==='/')){e.preventDefault();show(u.pathname,true,u.hash)}})}catch{}});
window.addEventListener('popstate',()=>{if(location.pathname.startsWith('/videos/')){show('/',false);const id=location.pathname.match(/-([A-Za-z0-9_-]{11})$/)?.[1];if(id&&window.urbanaOpenVideo)window.urbanaOpenVideo(id)}else{show(location.pathname,false,location.hash);window.dispatchEvent(new Event('urban-route-changed'))}});
show(location.pathname,false,location.hash);
})();