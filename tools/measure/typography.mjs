import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = process.argv[2] ?? '4321';

const harness = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" /><title>t</title>
<style>html,body{margin:0}iframe{width:100vw;height:900px;border:0;display:block}#out{font:12px/1.5 monospace;white-space:pre-wrap;padding:8px}</style>
</head><body><div id="out">pending</div>
<iframe id="f" src="/StaryFall/posts/mcp-protocol/"></iframe>
<script>
setTimeout(function(){
  var s='';
  try{
    var d=document.getElementById('f').contentDocument, w=document.getElementById('f').contentWindow;
    var md=d.querySelector('.sl-markdown-content');
    s+='=== .sl-markdown-content 的 reset 相关计算值 ===\\n';
    var mcs=w.getComputedStyle(md);
    s+='  marginTop='+mcs.marginTop+' marginBottom='+mcs.marginBottom+' paddingTop='+mcs.paddingTop+'\\n\\n';
    s+='=== 文章内各元素的前后间距 ===\\n';
    var sels=['p','h2','h3','pre','table','ul','blockquote','hr'];
    for(var i=0;i<sels.length;i++){
      var el=md.querySelector(sels[i]);
      if(!el){ s+='  '+sels[i].padEnd(12)+' (文章中没有)\\n'; continue; }
      var cs=w.getComputedStyle(el);
      var r=el.getBoundingClientRect();
      s+='  '+sels[i].padEnd(12)+' marginTop='+cs.marginTop.padEnd(9)+' marginBottom='+cs.marginBottom.padEnd(9)+
         ' paddingTop='+cs.paddingTop.padEnd(8)+' paddingLeft='+cs.paddingLeft.padEnd(8)+' w='+Math.round(r.width)+'\\n';
    }
    s+='\\n=== 代码块（pre）内部 ===\\n';
    var pre=md.querySelector('pre');
    if(pre){
      var pcs=w.getComputedStyle(pre);
      s+='  pre  background='+pcs.backgroundColor+' border='+pcs.borderTopWidth+' radius='+pcs.borderRadius+' padding='+pcs.padding+'\\n';
      var code=pre.querySelector('code');
      if(code){
        var ccs=w.getComputedStyle(code);
        s+='  code padding='+ccs.padding+' color='+ccs.color+'\\n';
        s+='  code span 数量（语法高亮 token）='+code.querySelectorAll('span').length+'\\n';
        s+='  code 前 120 字符 HTML: '+code.innerHTML.slice(0,120).replace(/</g,'&lt;')+'\\n';
      }
    }
    s+='\\n=== 表格 ===\\n';
    var tb=md.querySelector('table');
    if(tb){
      var tcs=w.getComputedStyle(tb);
      s+='  table width='+Math.round(tb.getBoundingClientRect().width)+' display='+tcs.display+' borderCollapse='+tcs.borderCollapse+'\\n';
      var th=tb.querySelector('th'), td=tb.querySelector('td');
      if(th){ var hcs=w.getComputedStyle(th); s+='  th padding='+hcs.padding+' border='+hcs.borderBottomWidth+' w='+Math.round(th.getBoundingClientRect().width)+'\\n'; }
      if(td){ var dcs=w.getComputedStyle(td); s+='  td padding='+dcs.padding+' border='+dcs.borderTopWidth+' w='+Math.round(td.getBoundingClientRect().width)+'\\n'; }
    }
  }catch(e){ s='ERR '+e.message; }
  document.getElementById('out').textContent=s;
},3000);
</script></body></html>`;

const targets = ['public', 'dist'].filter((x) => fs.existsSync(x)).map((x) => `${x}/__type.html`);
for (const t of targets) fs.writeFileSync(t, harness);
const dump = path.resolve('dist/__type_dump.html');
const out = fs.openSync(dump, 'w');
spawnSync(EDGE, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--user-data-dir=${process.env.TEMP}/e-type-${Date.now()}`, '--window-size=1600,1000',
  '--virtual-time-budget=9000', '--dump-dom', `http://localhost:${port}/StaryFall/__type.html`],
  { stdio: ['ignore', out, 'ignore'], timeout: 90000 });
fs.closeSync(out);

const html = fs.existsSync(dump) ? fs.readFileSync(dump, 'utf8') : '';
for (const t of targets) fs.rmSync(t, { force: true });
fs.rmSync(dump, { force: true });

const m = html.match(/<div id="out">([\s\S]*?)<\/div>/);
console.log(m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&') : 'NO OUTPUT\n' + html.slice(0, 400));
