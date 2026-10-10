(()=>{
const root=document.getElementById('urbanRouteMount');if(!root)return;
const routes=p=>p==='/musica'||p==='/noticias'||p.startsWith('/noticias/');
const source=p=>p==='/musica'?'/musica.html?embedded=1':'/noticias.html?embedded=1'+(p.startsWith('/noticias/')?'&slug='+encodeURIComponent(p.slice('/noticias/'.length)):'');
const frame=document.createElement('iframe');frame.title='Sección de UrbanaTV';frame.setAttribute('allow','autoplay');frame.style.cssText='width:100%;height:100%;border:0;display:block';root.append(frame);
function show(path,push){const active=routes(path);if(push)history.pushState({urbanRoute:path},'',path);root.hidden=!active;document.body.classList.toggle('urban-route-active',active);if(active){const url=source(path);if(frame.getAttribute('src')!==url)frame.src=url;window.scrollTo(0,0)}else{frame.removeAttribute('src')}document.title=active?(path==='/musica'?'Música | UrbanaTV':'Notas de la calle | UrbanaTV'):'UrbanaTV — La calle tiene voz'}
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||a.target==='_blank'||a.hasAttribute('download'))return;const url=new URL(a.href);if(url.origin!==location.origin)return;if(routes(url.pathname)||url.pathname==='/'){e.preventDefault();show(url.pathname,true)}});
frame.addEventListener('load',()=>{try{const doc=frame.contentDocument;if(!doc)return;const style=doc.createElement('style');style.textContent='header, footer:not(.player){display:none!important} body{padding-top:12px!important}';doc.head.append(style);doc.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||a.target==='_blank'||e.ctrlKey||e.metaKey)return;const u=new URL(a.href);if(u.origin===location.origin&&(routes(u.pathname)||u.pathname==='/')){e.preventDefault();show(u.pathname,true)}})}catch{}});
window.addEventListener('popstate',()=>show(location.pathname,false));
show(location.pathname,false);
})();