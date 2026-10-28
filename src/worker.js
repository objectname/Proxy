import HOME from "./home.js";
const text = (message, status = 400) => new Response(message, {status, headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
function denied(u, list, ownHost) {
  const h=u.hostname.toLowerCase().replace(/\.$/, "");
  return u.protocol!=="https:" || u.username || u.password || (u.port && u.port!=="443") || h===ownHost || !h.includes(".") || h.includes(":") || /^[\d.]+$/.test(h) || ["localhost","local","internal","test","invalid"].some(d=>h===d||h.endsWith("."+d)) || list.some(d=>h===d||h.endsWith("."+d));
}
export default {
 async fetch(request, env) {
  const here=new URL(request.url);
  if(!env.ACCESS_PASSWORD) return text("Setup required: add the ACCESS_PASSWORD Worker Secret in Cloudflare Settings > Variables and Secrets.",503);
  let authorized=false;
  try {
   const header=request.headers.get("Authorization")||"";
   if(header.startsWith("Basic ")) {
    const pair=atob(header.slice(6));
    authorized=pair==="router:"+env.ACCESS_PASSWORD;
   }
  } catch {}
  if(!authorized) return new Response("Sign in with username router and your proxy password.",{status:401,headers:{"WWW-Authenticate":'Basic realm="Private Router", charset="UTF-8"',"Cache-Control":"no-store"}});
  if(!["GET","HEAD"].includes(request.method)) return text("Read-only proxy: form submissions and logins are not supported.",405);
  if(here.pathname==="/") return new Response(request.method==="HEAD"?null:HOME,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
  if(here.pathname!=="/proxy") return text("Use the input page at / to open a website.",404);
  let list;
  try {
   list=typeof env.BLOCKED_DOMAINS==="string"?JSON.parse(env.BLOCKED_DOMAINS):env.BLOCKED_DOMAINS||[];
   if(!Array.isArray(list)||list.some(d=>typeof d!=="string")) throw Error();
   list=list.map(d=>d.trim().toLowerCase().replace(/\.$/,"" )).filter(Boolean);
  } catch {return text("BLOCKED_DOMAINS must be an array of hostname strings.",500);}
  let target;
  try {target=new URL(here.searchParams.get("url"));} catch {return text("Enter a full HTTPS URL.");}
  if(denied(target,list,here.hostname)) return text("Destination blocked or unsupported. Only public HTTPS hostnames on port 443 are accepted.",403);
  const proxy=u=>{const p=new URL("/proxy",here.origin); p.searchParams.set("url",u.href); return p.href;};
  let upstream;
  try {upstream=await fetch(target.href,{method:request.method,redirect:"manual",headers:{Accept:request.headers.get("Accept")||"*/*","Accept-Encoding":"identity"}});} catch {return text("The upstream connection failed.",502);}
  if(upstream.status>=300&&upstream.status<400&&upstream.headers.has("Location")) {
   let next; try {next=new URL(upstream.headers.get("Location"),target);}catch{return text("Invalid upstream redirect.",502);}
   if(denied(next,list,here.hostname)) return text("Redirect destination blocked.",403);
   return new Response(null,{status:upstream.status,headers:{Location:proxy(next),"Cache-Control":"no-store"}});
  }
  const type=upstream.headers.get("Content-Type")||"application/octet-stream";
  const headers=new Headers({"Content-Type":type,"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'; img-src https: data:; style-src https: 'unsafe-inline'; font-src https: data:; media-src https:; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"});
  if(upstream.headers.has("Content-Encoding")) headers.set("Content-Encoding",upstream.headers.get("Content-Encoding"));
  const html=type.toLowerCase().includes("text/html");
  const asset=/^(image\/(?!svg\+xml)|text\/css|font\/|audio\/|video\/)/i.test(type)||/application\/(font|vnd\.ms-fontobject)/i.test(type);
  if(!html&&!asset) headers.set("Content-Disposition","attachment");
  const response=new Response(upstream.body,{status:upstream.status,headers});
  if(!html||request.method==="HEAD") return response;
  class Rewrite {
   constructor(attr){this.attr=attr;}
   element(el){
    const value=el.getAttribute(this.attr); if(!value)return;
    if(this.attr==="href"&&value.startsWith("#"))return;
    try{const dest=new URL(value,target);el.setAttribute(this.attr,denied(dest,list,here.hostname)?"#blocked":proxy(dest));}catch{el.removeAttribute(this.attr);}
   }
  }
  return new HTMLRewriter()
   .on("a[href]",new Rewrite("href"))
   .on("img[src]",new Rewrite("src"))
   .on("img[srcset],source[srcset]",{element(e){e.removeAttribute("srcset");}})
   .on('link[rel="stylesheet"][href]',new Rewrite("href"))
   .on("script,iframe,object,embed,base,meta[http-equiv]",{element(e){e.remove();}})
   .on("form",{element(e){e.setAttribute("action","#forms-disabled");}})
   .transform(response);
 }
};
