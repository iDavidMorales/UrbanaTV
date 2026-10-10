self.addEventListener('push',event=>{
 let data={title:'UrbanaTV',body:'Hay novedades en UrbanaTV.',url:'/'};
 try{if(event.data)data={...data,...event.data.json()}}catch{}
 event.waitUntil(self.registration.showNotification(data.title||'UrbanaTV',{
  body:data.body||'Hay novedades en UrbanaTV.',
  icon:'/assets/urbanatv-app-icon.svg',
  badge:'/assets/urbanatv-app-icon.svg',
  data:{url:data.url||'/'},
  tag:data.tag||'urbanatv-update'
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=new URL(event.notification.data?.url||'/',self.location.origin).href;
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
  for(const client of list){if(client.url.startsWith(self.location.origin)&&'focus' in client){client.navigate(url);return client.focus()}}
  return clients.openWindow(url);
 }));
});