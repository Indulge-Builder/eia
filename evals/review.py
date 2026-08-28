#!/usr/bin/env python3
"""The Elaya review console — the annotation workbench.

A local web app (stdlib server, no framework) that shows EVERY Elaya
conversation — real usage and eval runs alike — straight from the database:
user message → Elaya's reply → the tools she called, with args. Each reply can
be graded (Correct / Needs improvement) with a free-text remark.

Why it exists: human judgment recorded here is the raw material of everything
downstream — flagged exchanges become golden-set cases, remark patterns become
prompt fixes, and the accumulated labels become training data for our own
models (master-plan Step 9). Grade generously: every label compounds.

Annotations persist to evals/annotations.json (committed — team labels are
valuable). The service key never reaches the browser; the Python process is
the only thing that talks to Supabase, and the UI lives on localhost only.

Run:  cd evals && ./.venv/bin/python review.py     (opens the browser)
"""

from __future__ import annotations

import json
import subprocess
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests

from harness.config import load_config

PORT = 8901
EVALS_DIR = Path(__file__).resolve().parent
ANNOTATIONS_PATH = EVALS_DIR / "annotations.json"

CFG = load_config()
HEADERS = {
    "apikey": CFG.supabase_service_key,
    "Authorization": f"Bearer {CFG.supabase_service_key}",
}
REST = f"{CFG.supabase_url}/rest/v1"

_lock = threading.Lock()


def _rest(path: str, params: dict[str, str]) -> list[dict]:
    res = requests.get(f"{REST}/{path}", headers=HEADERS, params=params, timeout=20)
    res.raise_for_status()
    return res.json()


def load_annotations() -> dict:
    if ANNOTATIONS_PATH.exists():
        try:
            return json.loads(ANNOTATIONS_PATH.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def api_conversations() -> list[dict]:
    convs = _rest(
        "elaya_conversations",
        {
            "select": "id,user_id,channel,title,created_at,last_message_at,archived_at",
            "order": "last_message_at.desc",
            "limit": "300",
        },
    )
    profiles = _rest("profiles", {"select": "id,full_name,role", "limit": "300"})
    names = {p["id"]: p for p in profiles}
    # message counts per conversation (one bulk read, counted here)
    counts: dict[str, int] = {}
    for row in _rest("elaya_messages", {"select": "conversation_id", "limit": "10000"}):
        counts[row["conversation_id"]] = counts.get(row["conversation_id"], 0) + 1
    out = []
    for c in convs:
        p = names.get(c["user_id"], {})
        out.append(
            {
                "id": c["id"],
                "user": p.get("full_name") or "Unknown",
                "role": p.get("role") or "",
                "channel": c["channel"],
                "kind": "eval" if (c.get("title") == "eval") else "real",
                "last": c["last_message_at"],
                "count": counts.get(c["id"], 0),
            }
        )
    return [c for c in out if c["count"] > 0]


def api_messages(conversation_id: str) -> list[dict]:
    rows = _rest(
        "elaya_messages",
        {
            "conversation_id": f"eq.{conversation_id}",
            "select": "id,role,content,tool_calls,channel,created_at",
            "order": "created_at.asc",
            "limit": "500",
        },
    )
    return rows


def save_annotation(payload: dict) -> dict:
    message_id = payload["message_id"]
    with _lock:
        anns = load_annotations()
        if payload.get("verdict") is None and not (payload.get("remark") or "").strip():
            anns.pop(message_id, None)  # cleared
        else:
            anns[message_id] = {
                "verdict": payload.get("verdict"),
                "remark": (payload.get("remark") or "").strip(),
                "conversation_id": payload.get("conversation_id"),
                "user_message": (payload.get("user_message") or "")[:400],
                "elaya_reply": (payload.get("elaya_reply") or "")[:400],
                "tools": payload.get("tools") or [],
                "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
        ANNOTATIONS_PATH.write_text(json.dumps(anns, indent=2, ensure_ascii=False))
    return {"ok": True, "total": len(load_annotations())}


PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Elaya Review Console</title><style>
  * { box-sizing:border-box; margin:0; }
  :root { --ink:#1f2328; --ink2:#59606a; --line:#e4e7eb; --bg:#f7f8fa; --card:#fff;
          --good:#1a7f37; --bad:#c93c37; --accent:#6841c7; --chip:#eef0f3; }
  body { font:14px/1.5 -apple-system,system-ui,sans-serif; color:var(--ink); background:var(--bg); height:100vh; display:flex; flex-direction:column; }
  header { padding:12px 20px; background:var(--card); border-bottom:1px solid var(--line); display:flex; gap:18px; align-items:center; }
  header h1 { font-size:16px; }
  header .tab { cursor:pointer; padding:5px 12px; border-radius:7px; color:var(--ink2); font-weight:500; }
  header .tab.on { background:var(--chip); color:var(--ink); }
  header .stats { margin-left:auto; color:var(--ink2); font-size:12.5px; }
  #app { flex:1; display:flex; min-height:0; }
  #list { width:320px; border-right:1px solid var(--line); background:var(--card); overflow-y:auto; }
  #list .filters { padding:10px 12px; border-bottom:1px solid var(--line); display:flex; gap:6px; flex-wrap:wrap; position:sticky; top:0; background:var(--card); }
  .fbtn { font-size:12px; padding:3px 9px; border-radius:20px; border:1px solid var(--line); background:var(--card); cursor:pointer; color:var(--ink2); }
  .fbtn.on { background:var(--ink); color:#fff; border-color:var(--ink); }
  .conv { padding:10px 14px; border-bottom:1px solid var(--line); cursor:pointer; }
  .conv:hover { background:var(--bg); } .conv.sel { background:#efeaf9; }
  .conv .who { font-weight:600; font-size:13.5px; }
  .conv .meta { color:var(--ink2); font-size:11.5px; margin-top:1px; display:flex; gap:8px; }
  .badge { padding:0 7px; border-radius:9px; background:var(--chip); font-size:10.5px; line-height:17px; }
  .badge.eval { background:#efeaf9; color:var(--accent); }
  .badge.wa { background:#e7f6ec; color:var(--good); }
  #main { flex:1; overflow-y:auto; padding:22px 26px; }
  .day { text-align:center; color:var(--ink2); font-size:11.5px; margin:14px 0 6px; }
  .row { display:flex; margin:8px 0; } .row.u { justify-content:flex-end; }
  .bub { max-width:68%; padding:9px 13px; border-radius:13px; background:var(--card); border:1px solid var(--line); white-space:pre-wrap; word-break:break-word; }
  .row.u .bub { background:#e9e4f5; border-color:#ddd3f0; }
  .tools { margin:4px 0 0; display:flex; gap:5px; flex-wrap:wrap; }
  .tool { font-size:11px; font-family:ui-monospace,monospace; background:var(--chip); border-radius:5px; padding:1px 7px; cursor:pointer; color:var(--ink2); }
  .targs { font-size:11px; font-family:ui-monospace,monospace; color:var(--ink2); background:var(--bg); border-radius:6px; padding:6px 8px; margin-top:4px; white-space:pre-wrap; display:none; }
  .grade { margin-top:7px; display:flex; gap:6px; align-items:flex-start; flex-wrap:wrap; }
  .gbtn { font-size:12px; padding:3px 10px; border-radius:7px; border:1px solid var(--line); background:var(--card); cursor:pointer; }
  .gbtn.good.on { background:var(--good); color:#fff; border-color:var(--good); }
  .gbtn.bad.on { background:var(--bad); color:#fff; border-color:var(--bad); }
  .remark { flex:1; min-width:180px; font:12.5px/1.4 inherit; padding:4px 8px; border:1px solid var(--line); border-radius:7px; }
  .save { font-size:12px; padding:3px 10px; border-radius:7px; border:none; background:var(--accent); color:#fff; cursor:pointer; }
  .saved { color:var(--good); font-size:12px; align-self:center; }
  .empty { color:var(--ink2); text-align:center; margin-top:60px; }
  /* queue */
  .qitem { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin-bottom:12px; }
  .qitem .v { font-weight:700; } .qitem .v.needs { color:var(--bad); } .qitem .v.ok { color:var(--good); }
  .qitem .msg { margin:6px 0 2px; } .qitem .rep { color:var(--ink2); }
  .qitem .rem { margin-top:6px; padding:7px 10px; background:#fff8e6; border-radius:7px; font-size:13px; }
  .qmeta { color:var(--ink2); font-size:11.5px; margin-top:6px; }
</style></head><body>
<header>
  <h1>Elaya Review<span style="color:var(--accent)">.</span></h1>
  <span class="tab on" data-tab="convs">Conversations</span>
  <span class="tab" data-tab="queue">Review queue</span>
  <span class="stats" id="stats"></span>
</header>
<div id="app">
  <div id="list">
    <div class="filters">
      <button class="fbtn on" data-f="all">All</button>
      <button class="fbtn" data-f="real">Real</button>
      <button class="fbtn" data-f="eval">Evals</button>
      <button class="fbtn" data-f="whatsapp">WhatsApp</button>
    </div>
    <div id="convs"></div>
  </div>
  <div id="main"><p class="empty">Pick a conversation ←</p></div>
</div>
<script>
let CONVS=[], ANNS={}, SEL=null, FILTER='all', TAB='convs';
const $=s=>document.querySelector(s);
const el=(t,c,txt)=>{const e=document.createElement(t); if(c)e.className=c; if(txt!==undefined)e.textContent=txt; return e;};
const fmtT=s=>new Date(s).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

async function boot(){
  [CONVS, ANNS] = await Promise.all([
    fetch('/api/conversations').then(r=>r.json()),
    fetch('/api/annotations').then(r=>r.json()),
  ]);
  renderList(); renderStats();
}
function renderStats(){
  const vals=Object.values(ANNS);
  const bad=vals.filter(a=>a.verdict==='needs_improvement').length;
  $('#stats').textContent=`${vals.length} reviewed · ${vals.filter(a=>a.verdict==='correct').length} correct · ${bad} need improvement`;
}
function renderList(){
  const box=$('#convs'); box.textContent='';
  CONVS.filter(c=>FILTER==='all'||c.kind===FILTER||c.channel===FILTER).forEach(c=>{
    const d=el('div','conv'+(SEL===c.id?' sel':''));
    d.appendChild(el('div','who',c.user));
    const m=el('div','meta');
    m.appendChild(el('span','badge'+(c.kind==='eval'?' eval':''),c.kind));
    if(c.channel==='whatsapp')m.appendChild(el('span','badge wa','whatsapp'));
    m.appendChild(el('span','',`${c.count} msgs`));
    m.appendChild(el('span','',fmtT(c.last)));
    d.appendChild(m);
    d.onclick=()=>{SEL=c.id; renderList(); openConv(c);};
    box.appendChild(d);
  });
}
async function openConv(c){
  const main=$('#main'); main.textContent='Loading…';
  const msgs=await fetch('/api/messages?conversation='+c.id).then(r=>r.json());
  main.textContent='';
  let lastUser='';
  msgs.forEach(m=>{
    if(m.role==='user'){ lastUser=m.content; }
    const row=el('div','row'+(m.role==='user'?' u':''));
    const bub=el('div','bub');
    bub.appendChild(el('div','',m.content||'(no text)'));
    if(m.role==='assistant'&&m.tool_calls&&m.tool_calls.length){
      const tl=el('div','tools');
      m.tool_calls.forEach(t=>{
        const chip=el('span','tool',t.name);
        const args=el('div','targs',JSON.stringify(t.input,null,1));
        chip.onclick=()=>{args.style.display=args.style.display==='block'?'none':'block';};
        tl.appendChild(chip); tl.appendChild(args);
      });
      bub.appendChild(tl);
    }
    if(m.role==='assistant'){
      bub.appendChild(gradeBar(m,c,lastUser));
    }
    row.appendChild(bub); main.appendChild(row);
  });
  main.scrollTop=main.scrollHeight;
}
function gradeBar(m,c,userMsg){
  const g=el('div','grade');
  const a=ANNS[m.id]||{};
  const good=el('button','gbtn good'+(a.verdict==='correct'?' on':''),'✓ Correct');
  const bad=el('button','gbtn bad'+(a.verdict==='needs_improvement'?' on':''),'✗ Needs improvement');
  const rem=el('input','remark'); rem.placeholder='remark — what should have happened?'; rem.value=a.remark||'';
  const save=el('button','save','Save');
  const okmsg=el('span','saved','');
  let verdict=a.verdict||null;
  good.onclick=()=>{verdict=verdict==='correct'?null:'correct'; good.classList.toggle('on',verdict==='correct'); bad.classList.remove('on');};
  bad.onclick=()=>{verdict=verdict==='needs_improvement'?null:'needs_improvement'; bad.classList.toggle('on',verdict==='needs_improvement'); good.classList.remove('on');};
  save.onclick=async()=>{
    const res=await fetch('/api/annotate',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message_id:m.id,conversation_id:c.id,verdict,remark:rem.value,
        user_message:userMsg,elaya_reply:m.content,tools:(m.tool_calls||[]).map(t=>t.name)})});
    if(res.ok){ANNS=await fetch('/api/annotations').then(r=>r.json()); renderStats(); okmsg.textContent='saved ✓'; setTimeout(()=>okmsg.textContent='',1500);}
  };
  g.append(good,bad,rem,save,okmsg);
  return g;
}
function renderQueue(){
  const main=$('#main'); main.textContent='';
  const items=Object.entries(ANNS).sort((x,y)=>(y[1].updated_at||'').localeCompare(x[1].updated_at||''));
  if(!items.length){ main.appendChild(el('p','empty','Nothing reviewed yet — grade replies in Conversations.')); return; }
  const order={needs_improvement:0, correct:1};
  items.sort((x,y)=>(order[x[1].verdict]??2)-(order[y[1].verdict]??2));
  items.forEach(([id,a])=>{
    const q=el('div','qitem');
    q.appendChild(el('div','v '+(a.verdict==='needs_improvement'?'needs':'ok'),
      a.verdict==='needs_improvement'?'✗ Needs improvement':'✓ Correct'));
    q.appendChild(el('div','msg','User: '+(a.user_message||'—')));
    q.appendChild(el('div','rep','Elaya: '+(a.elaya_reply||'—')+(a.tools&&a.tools.length?'   ['+a.tools.join(', ')+']':'')));
    if(a.remark)q.appendChild(el('div','rem','Remark: '+a.remark));
    q.appendChild(el('div','qmeta',(a.updated_at||'')+' · msg '+id.slice(0,8)));
    main.appendChild(q);
  });
}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  TAB=t.dataset.tab;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===t));
  $('#list').style.display=TAB==='convs'?'block':'none';
  if(TAB==='queue')renderQueue(); else $('#main').innerHTML='<p class="empty">Pick a conversation ←</p>';
});
document.querySelectorAll('.fbtn').forEach(b=>b.onclick=()=>{
  FILTER=b.dataset.f;
  document.querySelectorAll('.fbtn').forEach(x=>x.classList.toggle('on',x===b));
  renderList();
});
boot();
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # quiet
        pass

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlparse(self.path)
        try:
            if url.path == "/":
                body = PAGE.encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif url.path == "/api/conversations":
                self._json(api_conversations())
            elif url.path == "/api/messages":
                cid = parse_qs(url.query).get("conversation", [""])[0]
                self._json(api_messages(cid))
            elif url.path == "/api/annotations":
                self._json(load_annotations())
            else:
                self._json({"error": "not found"}, 404)
        except Exception as e:
            self._json({"error": str(e)}, 500)

    def do_POST(self):
        if urlparse(self.path).path != "/api/annotate":
            return self._json({"error": "not found"}, 404)
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))
            self._json(save_annotation(payload))
        except Exception as e:
            self._json({"error": str(e)}, 500)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://localhost:{PORT}"
    print(f"Elaya review console → {url}   (Ctrl+C to stop)")
    if sys.platform == "darwin":
        subprocess.run(["open", url], check=False)
    server.serve_forever()
