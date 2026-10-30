const {chromium}=require('playwright');const fs=require('fs');const http=require('http');const path=require('path');
const srv=http.createServer((q,r)=>{const p=path.join(__dirname,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.end(d)})}).listen(8123,async()=>{
  const b=await chromium.launch();const pg=await b.newPage();pg.on('console',m=>console.log(m.text()));
  await pg.goto('http://localhost:8123/bake.html');
  const files=fs.readdirSync(path.join(__dirname,'fbx')).map(f=>f.replace('.fbx',''));
  const out=await pg.evaluate(f=>bake(f),files);
  fs.writeFileSync(path.join(__dirname,'anims.json'),JSON.stringify(out));
  for(const k in out)if(out[k].t)console.log(k,out[k].d,out[k].t.length);
  await b.close();srv.close();
});
