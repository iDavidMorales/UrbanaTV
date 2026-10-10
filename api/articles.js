import {neon} from '@neondatabase/serverless';
import {createHmac,timingSafeEqual} from 'node:crypto';
const sql=process.env.DATABASE_URL?neon(process.env.DATABASE_URL):null;
const reply=(res,n,data)=>res.status(n).json(data);
const slugify=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,75);
function session(req){try{const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('urbanatv_session='))?.slice('urbanatv_session='.length);const [payload,mac]=token.split('.');const a=createHmac('sha256',process.env.AUTH_SECRET).update(payload).digest(),b=Buffer.from(mac,'base64url');if(a.length!==b.length||!timingSafeEqual(a,b))return null;const x=JSON.parse(Buffer.from(payload,'base64url').toString());return x.exp>Date.now()?x.id:null}catch{return null}}
const hiddenSlugs=new Set(['evento-1-de-noviembre-de-2026-mv22sqzz']);
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
async function renderArticle(req,res,slug){
 if(!/^[a-z0-9-]{1,140}$/.test(slug))return reply(res,404,{error:'Noticia no encontrada'});
 const rows=await sql`SELECT slug,title,description,image_url,article_type,created_at FROM urbana_tv.articles WHERE slug=${slug} LIMIT 1`;
 if(!rows.length)return reply(res,404,{error:'Noticia no encontrada'});
 const a=rows[0],canonical='https://urbanatv.vercel.app/noticias/'+encodeURIComponent(a.slug);
 let image='';
 if(a.image_url){try{const u=new URL(a.image_url);if(u.protocol==='https:')image=u.href}catch{}}
 const meta=[
 '<meta property="og:type" content="article">',
 '<meta property="og:site_name" content="UrbanaTV">',
 '<meta property="og:locale" content="es_MX">',
 '<meta property="og:title" content="'+escapeHtml(a.title)+'">',
 '<meta property="og:description" content="'+escapeHtml(a.description)+'">',
 '<meta property="og:url" content="'+escapeHtml(canonical)+'">',
 '<meta name="twitter:card" content="'+(image?'summary_large_image':'summary')+'">',
 '<meta name="twitter:title" content="'+escapeHtml(a.title)+'">',
 '<meta name="twitter:description" content="'+escapeHtml(a.description)+'">',
 '<meta name="twitter:url" content="'+escapeHtml(canonical)+'">',
 '<meta property="article:published_time" content="'+escapeHtml(new Date(a.created_at).toISOString())+'">',
 '<link rel="canonical" href="'+escapeHtml(canonical)+'">',
 ...(image?['<meta property="og:image" content="'+escapeHtml(image)+'">','<meta property="og:image:alt" content="'+escapeHtml(a.title)+'">','<meta name="twitter:image" content="'+escapeHtml(image)+'">']:[])
 ].join('');
 const page=await fetch('https://urbanatv.vercel.app/index.html',{headers:{'accept':'text/html'},signal:AbortSignal.timeout(9000)});
 if(!page.ok)throw Error('No se pudo cargar la portada');
 let html=await page.text();
 html=html.replace(/<title>[^<]*<\/title>/,'<title>'+escapeHtml(a.title)+' | UrbanaTV</title>');
 html=html.replace(/<meta name="description"[^>]*>/,'<meta name="description" content="'+escapeHtml(a.description)+'">');
 html=html.replace('</head>',meta+'</head>');
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=600');
 return res.status(200).send(html);
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');if(!sql)return reply(res,503,{error:'Base de datos no disponible'});
 try{
 const slug=String(req.query.slug||'');
 if(req.method==='GET'&&String(req.query.render||'')==='1'){if(hiddenSlugs.has(slug))return reply(res,404,{error:'Publicación retirada'});return await renderArticle(req,res,slug)}
 if(req.method==='GET'){
 if(slug){if(hiddenSlugs.has(slug))return reply(res,404,{error:'Publicación retirada'});const a=await sql`SELECT a.id,a.slug,a.title,a.description,a.content,a.image_url,a.article_type,a.display_date,a.created_at,u.name AS author,COALESCE(ROUND(AVG(r.stars)::numeric,1),0) AS rating,COUNT(r.id)::int AS review_count FROM urbana_tv.articles a LEFT JOIN urbana_tv.users u ON u.id=a.author_id LEFT JOIN urbana_tv.article_reviews r ON r.article_id=a.id WHERE a.slug=${slug} GROUP BY a.id,u.name LIMIT 1`;if(!a.length)return reply(res,404,{error:'No se encontró la nota'});const reviews=await sql`SELECT r.id,r.stars,r.body,r.created_at,u.name FROM urbana_tv.article_reviews r JOIN urbana_tv.users u ON u.id=r.user_id WHERE r.article_id=${a[0].id} ORDER BY r.created_at DESC LIMIT 80`;return reply(res,200,{article:a[0],reviews})}
 const articles=await sql`SELECT a.slug,a.title,a.description,a.image_url,a.article_type,a.display_date,a.created_at,u.name AS author,COALESCE(ROUND(AVG(r.stars)::numeric,1),0) AS rating,COUNT(r.id)::int AS review_count FROM urbana_tv.articles a LEFT JOIN urbana_tv.users u ON u.id=a.author_id LEFT JOIN urbana_tv.article_reviews r ON r.article_id=a.id WHERE a.slug <> 'evento-1-de-noviembre-de-2026-mv22sqzz' GROUP BY a.id,u.name ORDER BY a.created_at DESC LIMIT 100`;return reply(res,200,{articles});
 }
 if(req.method!=='POST')return reply(res,405,{error:'Método no permitido'});if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return reply(res,403,{error:'Origen no permitido'});
 const id=session(req);if(!id)return reply(res,401,{error:'Inicia sesión para participar'});
 const data=req.body||{},action=String(req.query.action||'');
 if(action==='create'){
 const title=String(data.title||'').trim(),description=String(data.description||'').trim(),content=String(data.content||'').trim();
 if(title.length<8||title.length>160||description.length<15||description.length>400||content.length<50||content.length>20000)return reply(res,400,{error:'Revisa el título, descripción y contenido de la nota'});
 const imageUrl=String(data.image_url||'').trim(),articleType=String(data.article_type||'articulo'),displayDate=String(data.display_date||'');
 if(imageUrl&&(!/^https:\/\//.test(imageUrl)||imageUrl.length>1500)||!['articulo','evento'].includes(articleType)||displayDate&&!/^\d{4}-\d{2}-\d{2}$/.test(displayDate)||articleType==='evento'&&!displayDate)return reply(res,400,{error:'Revisa portada, tipo y fecha'});
 const base=slugify(title);if(!base)return reply(res,400,{error:'Título inválido'});
 const slug=base+'-'+Date.now().toString(36);
 await sql`INSERT INTO urbana_tv.articles(slug,title,description,content,author_id,image_url,article_type,display_date) VALUES(${slug},${title},${description},${content},${id},${imageUrl||null},${articleType},${displayDate||null})`;return reply(res,201,{ok:true,slug});
 }
 if(action==='review'){
 const slug=String(data.slug||''),stars=Number(data.stars),body=String(data.body||'').trim();
 if(!Number.isInteger(stars)||stars<1||stars>5||body.length>1500)return reply(res,400,{error:'Estrellas o comentario inválido'});
 const a=await sql`SELECT id FROM urbana_tv.articles WHERE slug=${slug} LIMIT 1`;if(!a.length)return reply(res,404,{error:'Nota no encontrada'});
 await sql`INSERT INTO urbana_tv.article_reviews(article_id,user_id,stars,body) VALUES(${a[0].id},${id},${stars},${body}) ON CONFLICT(article_id,user_id) DO UPDATE SET stars=EXCLUDED.stars,body=EXCLUDED.body,created_at=now()`;return reply(res,200,{ok:true});
 }
 return reply(res,404,{error:'Acción desconocida'});
 }catch(e){console.error('articles API',e);return reply(res,500,{error:'No se pudo procesar la solicitud'})}
}