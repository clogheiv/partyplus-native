import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../web-dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+requested);
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}
  try{let selected=file;let bytes;try{bytes=await fs.readFile(selected);}catch{selected=path.join(root,'index.html');bytes=await fs.readFile(selected);}res.writeHead(200,{'Content-Type':types[path.extname(selected)]??'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(503).end('Run npm run build:web first.');}
});
server.listen(8091,'127.0.0.1',()=>console.log('PartyPlus preview http://127.0.0.1:8091'));
