(()=>{
const $=id=>document.getElementById(id),bell=$('urbanBell'),panel=$('urbanNotificationPanel'),list=$('urbanNotificationList'),badge=$('urbanNotifyCount');
if(!bell||!panel||!list)return;
let entries=[],seen=Date.now(),userId=null;
const key=id=>'urbanatv:notifications:seen:'+id;
const err=p=>{const box=document.createElement('p');box.className='urban-notice-empty';box.textContent=p;list.replaceChildren(box)};
function render(){
 list.replaceChildren();
 if(!entries.length){err('No hay comentarios recientes.');}
 for(const c of entries){const btn=document.createElement('button');btn.type='button';btn.className='urban-notice'+(new Date(c.created_at).getTime()>seen?' unread':'');const label=document.createElement('strong');label.textContent=c.name+' comentó';const excerpt=document.createElement('span');excerpt.textContent=c.body;const time=document.createElement('small');time.textContent=new Date(c.created_at).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'});btn.append(label,excerpt,time);btn.addEventListener('click',()=>{markRead();panel.hidden=true;bell.setAttribute('aria-expanded','false');const id=c.video_id;if(typeof window.urbanaOpenVideo==='function'){window.urbanaNavigate?.('/',true);window.urbanaOpenVideo(id)}else location.assign('/?v='+encodeURIComponent(id))});list.append(btn)}
 const unread=entries.filter(x=>new Date(x.created_at).getTime()>seen).length;badge.hidden=!unread;badge.textContent=unread>9?'9+':String(unread);
}
function markRead(){seen=Date.now();if(userId)try{localStorage.setItem(key(userId),String(seen))}catch{};render()}
async function refresh(){
 if(document.hidden)return;
 try{
 const me=await fetch('/api/social?action=me',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json());
 if(!me.user){userId=null;entries=[];badge.hidden=true;if(!panel.hidden)err('Inicia sesión para ver comentarios nuevos.');return}
 if(userId!==String(me.user.id)){userId=String(me.user.id);try{const value=localStorage.getItem(key(userId));seen=value?Number(value):Date.now();if(!value)localStorage.setItem(key(userId),String(seen))}catch{seen=Date.now()}}
 const result=await fetch('/api/social?action=notifications',{credentials:'same-origin',cache:'no-store'});if(!result.ok)throw Error();const data=await result.json();entries=Array.isArray(data.notifications)?data.notifications:[];render();
 }catch{if(!panel.hidden)err('No se pudieron actualizar las notificaciones.')}
}
bell.addEventListener('click',()=>{panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)refresh()});
$('urbanNotifyClose').addEventListener('click',()=>{panel.hidden=true;bell.setAttribute('aria-expanded','false')});
$('urbanNotifyRead').addEventListener('click',markRead);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
window.addEventListener('urban-comment-published',refresh);
refresh();setInterval(refresh,60000);
})();
