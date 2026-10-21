"""Check every URL in data.json with curl; store results in data.json['link_checks'] and regenerate data.js."""
import json, os, subprocess, concurrent.futures as cf, datetime, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import write
base=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data=json.load(open(os.path.join(base,"data.json")))
urls=set()
for e in data["entries"]:
    urls.add(e["url"]); urls.update(e.get("sources",[]))
    if e.get("repo"): urls.add(e["repo"])
for b in data["benchmarks"]: urls.add(b["source"])
for p in data["people"]: urls.update(p["links"])
def check(u):
    for extra in ([],["-r","0-2048"]):
        p=subprocess.run(["curl","-sL","-o","/dev/null","-A","Mozilla/5.0 (X11; Linux x86_64) Chrome/120","--max-time","30","-w","%{http_code}",*extra,u],capture_output=True,text=True)
        code=p.stdout.strip() or "000"
        if code.startswith(("2","3")): break
    return u,code
res={}
with cf.ThreadPoolExecutor(12) as ex:
    for u,c in ex.map(check,sorted(urls)): res[u]={"code":c,"checked":datetime.date.today().isoformat()}
# URLs that block curl (bot protection) but were read successfully with a browser-like fetcher on this date
MANUAL={"https://help.sefaria.org/hc/en-us/articles/24882474364316-Quick-Guide-Meet-the-Sefaria-MCPs":"2026-10-20",
        "https://help.sefaria.org/hc/en-us/articles/26006423836828-How-to-Use-the-Sefaria-Library-Assistant":"2026-10-20"}
for u,d in MANUAL.items():
    if u in res and not res[u]["code"].startswith(("2","3")):
        res[u]={"code":res[u]["code"]+" (curl blocked; read OK via web fetch)","checked":d,"manual":True}
data["link_checks"]=res
write(base,data)
bad={u:r["code"] for u,r in res.items() if not r["code"].startswith(("2","3")) and not r.get("manual")}
print(len(res),"urls checked;",len(bad),"non-2xx/3xx")
for u,c in sorted(bad.items()): print(c,u)
