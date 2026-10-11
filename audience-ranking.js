(()=> {
  const endpoint='/api/video-analytics';
  const modal=document.getElementById('watchModal');
  if(!modal)return;
  let video=null,lastTick=0,timer=null,sentView='';
  const title=()=>document.getElementById('watchTitle')?.textContent||'';
  function send(action,extra={}) {
    if(!video)return;
    fetch(endpoint+'?action='+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({video_id:video,title:title(),category:'UrbanaTV',...extra}),keepalive:true}).catch(()=>{});
  }
  function tick(){
    if(!video||!modal.classList.contains('open'))return;
    const now=Date.now();
    if(lastTick&&now-lastTick>=8000&&now-lastTick<=22000)send('watch',{seconds:Math.min(20,Math.round((now-lastTick)/1000))});
    lastTick=now;
  }
  function start(){
    const iframe=modal.querySelector('#player iframe');
    const match=iframe?.src.match(/\/embed\/([\w-]{11})/);
    if(!match)return;
    video=match[1];
    lastTick=Date.now();
    if(sentView!==video){send('view');sentView=video}
    if(timer)clearInterval(timer);
    timer=setInterval(tick,10000);
  }
  function stop(){tick();if(timer)clearInterval(timer);timer=null;video=null;lastTick=0}
  new MutationObserver(()=>{
    if(modal.classList.contains('open'))start();
    else stop();
  }).observe(modal,{attributes:true,attributeFilter:['class']});
  window.addEventListener('urban-video-start',()=>setTimeout(start,250));
  window.addEventListener('urban-video-end',stop);
})();