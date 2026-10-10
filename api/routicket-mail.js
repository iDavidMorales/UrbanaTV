// Server-only mail transport. Reuses the Google Apps Script send_info channel
// configured by Routicket's rtk_mail.php, with no SendGrid dependency.
const fallbackUrl='https://script.google.com/macros/s/AKfycbxMmLYaL9Q5h2uzYDw-GgxrQiZ6eqC0XyZGf8fcGHvWQ59Hn8u7SJ2AdpI-0ihTd5Id/exec';
export async function sendRouticketEmail(to,subject,body){
 const endpoint=process.env.ROUTICKET_MAIL_URL||fallbackUrl;
 const url=new URL(endpoint);
 if(url.protocol!=='https:')throw new Error('Invalid mail endpoint');
 url.searchParams.set('to',to);url.searchParams.set('subject',subject);url.searchParams.set('content',body);url.searchParams.set('type','alert');url.searchParams.set('from_name','UrbanaTV');
 const response=await fetch(url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(15000),cache:'no-store'});
 let result;try{result=await response.json()}catch{throw new Error('Routicket mail returned a non-JSON response')}
 if(!response.ok||result.ok!==true)throw new Error('Routicket mail service rejected the message');
 return true;
}
