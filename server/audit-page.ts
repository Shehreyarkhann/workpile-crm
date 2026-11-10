export const AUDIT_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Free Backlog Audit — Workpile</title><style>
body{font-family:Inter,system-ui,sans-serif;background:#f6f8f7;color:#0f241a;margin:0;padding:32px 16px}
.wrap{max-width:760px;margin:0 auto}h1{font-size:30px;margin:0 0 6px}.sub{color:#5b6b62;margin:0 0 22px}
.card{background:#fff;border:1px solid #e3eae6;border-radius:14px;padding:20px;margin-bottom:16px}
textarea{width:100%;min-height:150px;border:1px solid #cfd8d2;border-radius:10px;padding:10px;font-family:ui-monospace,monospace;font-size:12.5px;box-sizing:border-box}
button{background:#0b6e3f;color:#fff;border:0;border-radius:10px;padding:11px 18px;font-weight:700;cursor:pointer}
input[type=email]{width:100%;padding:10px;border:1px solid #cfd8d2;border-radius:10px;box-sizing:border-box;margin:10px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.stat b{font-size:26px;display:block}
table{width:100%;border-collapse:collapse;font-size:13.5px}td,th{padding:6px 4px;border-bottom:1px solid #eef2f0;text-align:left}
.mut{color:#5b6b62;font-size:12.5px}.err{color:#b3261e}
</style></head><body><div class="wrap">
<h1>🧹 The free Backlog Audit</h1>
<p class="sub">Export your leads from whatever you're using now, paste them below, and see what the pile is hiding: never-contacted leads, gone-stale opportunities, duplicates, and a dollar figure for the recoverable work — scored the way Workpile scores it live. Your rows are analyzed in this request and not stored.</p>
<div class="card"><b>Paste CSV</b> (headers help: name, phone, email, service, value, created, last contact, status) — or drop a .csv file here.
<textarea id="csv" placeholder="name,phone,email,service,value,created,last contact,status&#10;Harborview Realty,(631) 555-0142,m@example.com,Phase I ESA,3200,2026-08-14,,New"></textarea>
<input type="file" id="file" accept=".csv">
<input type="email" id="email" placeholder="Email (optional — only the aggregate report stats are kept with it)">
<button id="go">Run my audit</button> <span id="msg"></span></div>
<div id="out"></div>
<p class="mut">Workpile — the Revenue Execution OS for service businesses. <a href="/app">Open the app →</a></p>
</div><script>
function parseCSV(t){const lines=t.split(/\\r?\\n/).filter(l=>l.trim());if(lines.length<2)return[];const head=split(lines[0]);return lines.slice(1).map(l=>{const c=split(l);const o={};head.forEach((h,i)=>o[h.trim()]=c[i]||"");return o;});}
function split(line){const out=[];let cur="",q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(q){if(ch=='"'){if(line[i+1]=='"'){cur+='"';i++;}else q=false;}else cur+=ch;}else if(ch=='"')q=true;else if(ch==','){out.push(cur);cur="";}else cur+=ch;}out.push(cur);return out;}
document.getElementById("file").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{document.getElementById("csv").value=String(r.result||"");};r.readAsText(f);});
document.getElementById("go").addEventListener("click",async()=>{const msg=document.getElementById("msg");msg.textContent="Analyzing…";msg.className="";
const rows=parseCSV(document.getElementById("csv").value);if(!rows.length){msg.textContent="No rows found — include a header row.";msg.className="err";return;}
try{const res=await fetch("/api/public/backlog-audit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows,email:document.getElementById("email").value})});
const r=await res.json();if(!res.ok)throw new Error(r.error&&r.error.message||"failed");
const money=n=>"$"+Math.round(n).toLocaleString();
document.getElementById("out").innerHTML='<div class="card"><h2 style="margin-top:0">Your backlog, honestly</h2><div class="grid">'+
'<div class="stat"><b>'+r.recoverable_count+'</b>recoverable leads</div>'+
'<div class="stat"><b>'+money(r.recoverable_value)+'</b>in the pile</div>'+
'<div class="stat"><b>'+r.untouched_count+'</b>never contacted</div>'+
'<div class="stat"><b>'+r.stale_count+'</b>gone stale (14d+)</div>'+
'<div class="stat"><b>'+r.duplicate_rows+'</b>duplicate rows</div>'+
'<div class="stat"><b>'+r.rows+'</b>rows analyzed</div></div>'+
(r.top_opportunities.length?'<h3>Work these first</h3><table><tr><th>Lead</th><th>Service</th><th>Value</th><th>Score</th><th>Issue</th></tr>'+r.top_opportunities.map(o=>'<tr><td>'+o.name+'</td><td>'+o.service+'</td><td>'+money(o.value)+'</td><td>'+o.score+' · '+o.temperature+'</td><td>'+o.issue+'</td></tr>').join("")+'</table>':"")+
'<p class="mut">'+r.method+'</p><p><a href="/app"><button>Work this pile in Workpile →</button></a></p></div>';
msg.textContent="";}catch(e){msg.textContent=String(e.message||e);msg.className="err";}});
</script></body></html>`;
