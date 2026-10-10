(()=> {
const $=id=>document.getElementById(id),bell=$('urbanBell'),panel=$('urbanNotificationPanel'),list=$('urbanNotificationList'),badge=$('urbanNotifyCount');
if(!bell||!panel||!list)return;
let entries=[],seen=Date.now(),userId=null,swReg=null;
const key=id=>'urbanatv:notifications:seen:'+id;
const articlesKey='urbanatv:known-article-slugs-v1';
const status=()=> $('urbanPushStatus');
const err=p=>{const box=document.createElement('p');box.className='urban-notice-empty';box.textContent=p;list.replaceChildren(box)};
function render(){
 list.replaceChildren();
 if(!entries.length)err('No hay comentarios recientes.');
 for(const c of entries){const btn=document.createElement('button');btn.type='button';btn.className='urban-notice'+(new Date(c.created_at).getTime()>seen?' unread':'');const label=document.createElement('strong');label.textContent=c.name+' comentó';const excerpt=document.createElement('span');excerpt.textContent=c.body;const time=document.createElement('small');time.textContent=new Date(c.created_at).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'});btn.append(label,excerpt,time);btn.addEventListener('click',()=>{markRead();panel.hidden=true;bell.setAttribute('aria-expanded','false');const id=c.video_id;if(typeof window.urbanaOpenVideo==='function'){window.urbanaNavigate?.('/',true);window.urbanaOpenVideo(id)}else location.assign('/?v='+encodeURIComponent(id))});list.append(btn)}
 const unread=entries.filter(x=>new Date(x.created_at).getTime()>seen).length;badge.hidden=!unread;badge.textContent=unread>9?'9+':String(unread);
}
function markRead(){seen=Date.now();if(userId)try{localStorage.setItem(key(userId),String(seen))}catch{};render()}
async function refreshComments(){
 if(document.hidden)return;
 try{
 const me=await fetch('/api/social?action=me',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json());
 if(!me.user){userId=null;entries=[];badge.hidden=true;if(!panel.hidden)err('Inicia sesión para ver comentarios nuevos.');return}
 if(userId!==String(me.user.id)){userId=String(me.user.id);try{const value=localStorage.getItem(key(userId));seen=value?Number(value):Date.now();if(!value)localStorage.setItem(key(userId),String(seen))}catch{seen=Date.now()}}
 const result=await fetch('/api/social?action=notifications',{credentials:'same-origin',cache:'no-store'});if(!result.ok)throw Error();const data=await result.json();entries=Array.isArray(data.notifications)?data.notifications:[];render();
 }catch{if(!panel.hidden)err('No se pudieron actualizar las notificaciones.')}
}
async function enableNotifications(){
 const button=$('urbanEnableNotifications');
 if(!('Notification' in window)){if(status())status().textContent='Este navegador no admite notificaciones web.';return}
 if(!('serviceWorker' in navigator)){if(status())status().textContent='Este navegador no admite notificaciones en segundo plano.';return}
 button.disabled=true;
 try{
  const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;
  if(permission!=='granted'){if(status())status().textContent=permission==='denied'?'Las notificaciones están bloqueadas en el navegador. Actívalas desde los ajustes del sitio.':'No se activaron los avisos.';return}
  swReg=await navigator.serviceWorker.register('/service-worker.js');
  await navigator.serviceWorker.ready;
  if(status())status().textContent='¡Listo! Recibirás avisos de novedades mientras UrbanaTV esté abierto. Para avisos con el navegador cerrado falta conectar el envío push del servidor.';
  button.textContent='NOTIFICACIONES ACTIVADAS';
  button.disabled=true;
  await checkForNewArticles(true);
 }catch(e){if(status())status().textContent='No se pudieron activar los avisos. Comprueba que el sitio esté abierto por HTTPS.';button.disabled=false}
}
async function checkForNewArticles(initial=false){
 if(!('Notification' in window)||Notification.permission!=='granted'||document.hidden)return;
 try{
  const response=await fetch('/api/articles',{cache:'no-store'});
  if(!response.ok)return;
  const data=await response.json(),articles=Array.isArray(data.articles)?data.articles:[];
  const slugs=articles.map(a=>a.slug).filter(Boolean);
  let known=[];try{known=JSON.parse(localStorage.getItem(articlesKey)||'[]');if(!Array.isArray(known))known=[]}catch{}
  if(!known.length||initial){localStorage.setItem(articlesKey,JSON.stringify(slugs));return}
  const fresh=articles.filter(a=>a.slug&&!known.includes(a.slug));
  localStorage.setItem(articlesKey,JSON.stringify([...slugs,...known].slice(0,150)));
  if(fresh.length&&swReg){
   const a=fresh[0];
   await swReg.showNotification('Nueva publicación · UrbanaTV',{body:a.title||'Hay contenido nuevo en UrbanaTV',icon:'/assets/urbanatv-app-icon.svg',badge:'/assets/urbanatv-app-icon.svg',tag:'urbanatv-new-article-'+a.slug,data:{url:'/noticias/'+encodeURIComponent(a.slug)},renotify:false});
  }
 }catch(e){/* Las novedades se revisan de nuevo en el próximo ciclo. */}
}
bell.addEventListener('click',()=>{panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)refreshComments()});
$('urbanNotifyClose')?.addEventListener('click',()=>{panel.hidden=true;bell.setAttribute('aria-expanded','false')});
$('urbanNotifyRead')?.addEventListener('click',markRead);
$('urbanEnableNotifications')?.addEventListener('click',enableNotifications);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshComments();checkForNewArticles()}});
window.addEventListener('urban-comment-published',refreshComments);
refreshComments();setInterval(refreshComments,60000);setInterval(checkForNewArticles,180000);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/service-worker.js').then(r=>{swReg=r}).catch(()=>{});
if('Notification' in window&&Notification.permission==='granted'&&status())status().textContent='Las notificaciones están permitidas en este navegador.';
})();