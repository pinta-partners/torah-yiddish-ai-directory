/* Torah + Yiddish AI Directory: rendering, filtering, hash routing, sortable benchmark table.
   Exposes a small query/UI API on window.TYD that js/webmcp.js turns into WebMCP tools. */
(function(){
  "use strict";
  const D = window.DIRECTORY_DATA;
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const SUBCAT_ORDER = ["TTS","ASR","OCR & HTR","Datasets & corpora","Models & LLMs","Community & orgs",""];
  const TAB_LABEL = {torah:"Torah", yiddish:"Yiddish"};
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = { tab:"torah", q:"", status:"", oss:"", hasidic:false, benchType:"All", benchQ:"", sort:{col:null,dir:1} };

  // ---------- helpers ----------
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const linkOk = u => { const c = (D.link_checks||{})[u]; return c ? /^[23]/.test(c.code) || !!c.manual : null; };
  const host = u => { try { const x = new URL(u); return x.hostname.replace(/^www\./,"") + (x.pathname.length>1 ? x.pathname.replace(/\/$/,"").slice(0,38) : ""); } catch(e){ return u; } };
  const isHasidic = e => /hasid|heimish|chabad|williamsburg|unterland/i.test([e.dialect,e.description,e.name].join(" "));
  const tokens = q => String(q||"").toLowerCase().split(/\s+/).filter(Boolean);
  const entryHay = e => [e.name,e.name_native,e.by,e.category,e.description,e.dialect,e.metrics,e.notes,e.subcat,e.url,e.repo,e.license].join(" ").toLowerCase();
  const SECTION_TAB = {}; const SECTION_BY_ID = {};
  Object.entries(D.sections).forEach(([t,ss]) => ss.forEach(s => { SECTION_TAB[s.id] = t; SECTION_BY_ID[s.id] = s; }));
  const tabOfEntry = e => SECTION_TAB[e.sections[0]];

  /** Generic entry filter shared by the UI and the WebMCP tools. */
  function entryMatches(e, f){
    if (f.status && e.status !== f.status) return false;
    if (f.oss && e.open_source !== f.oss) return false;
    if (f.hasidic && !isHasidic(e)) return false;
    if (f.dialect){ const d = String(f.dialect).toLowerCase(); if (/^hasid/.test(d) ? !isHasidic(e) : !String(e.dialect||"").toLowerCase().includes(d)) return false; }
    if (f.section && !e.sections.includes(f.section)) return false;
    if (f.tab && !e.sections.some(s => SECTION_TAB[s] === f.tab)) return false;
    if (f.subcat && String(e.subcat||"").toLowerCase() !== String(f.subcat).toLowerCase()) return false;
    const t = tokens(f.q); if (!t.length) return true;
    const hay = entryHay(e); return t.every(x => hay.includes(x));
  }
  const uiFilter = () => ({q:state.q, status:state.status, oss:state.oss, hasidic:state.hasidic});
  const matches = e => entryMatches(e, uiFilter());
  const entriesFor = sec => D.entries.filter(e => e.sections.includes(sec) && matches(e));
  const NP = /not published|n\/a|^—$/i;
  function numOf(v){ if (NP.test(v)) return null; const m = String(v).replace(",",".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
  function benchMatch(b, f){
    if (f.type && f.type !== "All" && b.type !== f.type) return false;
    if (f.hasidic && !/hasid|heimish|chabad/i.test(b.dialect+" "+b.system)) return false;
    const t = tokens(f.q); if (!t.length) return true;
    const h = Object.values(b).join(" ").toLowerCase(); return t.every(x => h.includes(x));
  }
  function peopleMatch(p, q){ const t = tokens(q); if (!t.length) return true; const h=[p.name,p.role,p.works_on,p.fit,...p.links].join(" ").toLowerCase(); return t.every(x=>h.includes(x)); }

  // ---------- rendering ----------
  const CHEV = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  function srcList(list){
    return `<ul class="sources">${list.map(u => {
      const ok = linkOk(u);
      const mark = ok === null ? "" : ok ? `<span class="ok" title="Link checked ${esc(D.generated)}" aria-label="link checked">✓</span> ` : `<span class="bad" title="Link check failed" aria-label="link check failed">✗</span> `;
      return `<li>${mark}<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a></li>`;
    }).join("")}</ul>`;
  }
  const nativeLang = s => /ייִ|אידיש|פאר|שרייבער|וואָרט|גערעדט/.test(s) ? "yi" : "he";
  /** At most two quiet tags; everything else lives in the expandable detail. */
  function tagsFor(e){
    const t = [];
    if (e.open_source === "yes") t.push(["Open source",""]); else if (e.open_source === "partial") t.push(["Partly open",""]);
    if (e.unverified) t.push(["Unverified","warn"]);
    else if (e.status !== "active") t.push([e.status[0].toUpperCase()+e.status.slice(1),""]);
    else if (/directory author/i.test(e.by)) t.push(["Author's project",""]);
    return t.slice(0,2).map(([l,c]) => `<span class="tag${c?" "+c:""}">${esc(l)}</span>`).join("");
  }
  function card(e){
    const kv = [];
    if (e.repo) kv.push(["Repo", `<a href="${esc(e.repo)}" target="_blank" rel="noopener">${esc(host(e.repo))}</a>`]);
    if (e.license) kv.push(["License", esc(e.license)]);
    if (e.dialect) kv.push(["Dialect", `<span dir="auto">${esc(e.dialect)}</span>`]);
    if (e.metrics) kv.push(["Metrics", esc(e.metrics)]);
    if (e.notes) kv.push(["Note", esc(e.notes)]);
    kv.push(["Status", esc(e.status) + " · " + (e.open_source==="yes" ? "open source" : e.open_source==="partial" ? "partly open" : "closed")]);
    if (e.subcat) kv.push(["Category", esc(e.subcat)]);
    if (e.unverified) kv.push(["Flag", "unverified / unclear"]);
    return `<article class="card" id="e-${esc(e.id)}" aria-labelledby="t-${esc(e.id)}">
      <h3 id="t-${esc(e.id)}"><a href="${esc(e.url)}" target="_blank" rel="noopener" dir="auto">${esc(e.name)}</a>${e.name_native?`<span class="native" dir="rtl" lang="${nativeLang(e.name_native)}">${esc(e.name_native)}</span>`:""}</h3>
      <p class="desc" dir="auto">${esc(e.description)}</p>
      <details class="more"><summary>${tagsFor(e)}<span class="toggle">Details${CHEV}</span></summary>
        <div class="detail"><p class="by" dir="auto">${esc(e.by)} · ${esc(e.category)}</p>
        <dl class="kv">${kv.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
        <p class="sources-h">Sources</p>${srcList(e.sources||[e.url])}</div>
      </details>
    </article>`;
  }
  const grid = list => `<div class="grid">${list.map(card).join("")}</div>`;
  function secHead(sec){
    return `<div class="sec-head"><h2 id="h-${sec.id}">${esc(sec.title)}<a class="anchor" href="#${sec.id}" aria-label="Link to this section">#</a></h2><p>${esc(sec.blurb)}</p></div>`;
  }

  function renderEntriesSection(sec){
    const list = entriesFor(sec.id); let body;
    if (sec.id === "yi-other"){
      const groups = {}; list.forEach(e => (groups[e.subcat||""] ||= []).push(e));
      const keys = SUBCAT_ORDER.filter(k => groups[k]);
      body = (keys.length > 1 ? `<p class="jump">${keys.map(k=>`<a href="#${sec.id}-${slug(k||"other")}">${esc(k||"Other")}</a>`).join("")}</p>` : "")
        + keys.map(k => `<h3 class="subcat" id="${sec.id}-${slug(k||"other")}">${esc(k||"Other")}<small>${groups[k].length}</small></h3>${grid(groups[k])}`).join("");
    } else body = grid(list);
    if (!list.length) body = `<p class="empty">No entries match the current filters.</p>`;
    return {html:`<section id="${sec.id}" aria-labelledby="h-${sec.id}" tabindex="-1">${secHead(sec)}${body}</section>`, n:list.length};
  }

  // ---------- benchmarks ----------
  // Visible columns; the rest (access, Yiddish support, dialect, test set) sit in an expandable row.
  const COLS = [["system","Tool","h-sys"],["type","Task","h-task"],["metric","Metric","h-metric"],["value","Value","h-val"],["source","Source","h-src"]];
  const MORE = [["access","Access"],["yi","Yiddish support"],["dialect","Dialect"],["test","Test set"],["metric","Metric"],["source","Source"]];
  const openRows = new Set();
  function benchRows(){
    let rows = D.benchmarks.map((b,i)=>Object.assign({_i:i}, b)).filter(b => benchMatch(b, {type:state.benchType, q:state.q, hasidic:state.hasidic}) && benchMatch(b, {q:state.benchQ}));
    const {col,dir} = state.sort;
    if (col){
      rows = rows.slice().sort((a,b) => {
        if (col==="value"){ const x=numOf(a.value), y=numOf(b.value); if (x===null && y===null) return 0; if (x===null) return 1; if (y===null) return -1; return (x-y)*dir; }
        return String(a[col]).localeCompare(String(b[col]))*dir;
      });
    }
    return rows;
  }
  function benchBody(rows){
    if (!rows.length) return `<tr><td colspan="${COLS.length+1}" class="empty">No benchmark rows match.</td></tr>`;
    return rows.map(b=>{
      const open = openRows.has(b._i), rid = "bm-"+b._i;
      return `<tr class="row"><td class="x"><button type="button" class="expand" data-expand="${b._i}" aria-expanded="${open}" aria-controls="${rid}" aria-label="More about ${esc(b.system)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></td>${COLS.map(([k])=>{
        if (k==="source") return `<td class="src"><a href="${esc(b.source)}" target="_blank" rel="noopener" title="${esc(b.source)}">${esc(host(b.source).split("/")[0])}</a></td>`;
        if (k==="value") return `<td class="val${NP.test(b.value)?" np":""}">${esc(b.value)}</td>`;
        if (k==="type") return `<td class="task">${esc(b.type)}</td>`;
        return `<td dir="auto" class="${k==="system"?"sys":k}">${esc(b[k])}</td>`; }).join("")}</tr>
        <tr class="more-row" id="${rid}"${open?"":" hidden"}><td colspan="${COLS.length+1}"><dl>${MORE.map(([k,l])=>`<dt>${l}</dt><dd dir="auto">${k==="source"?`${linkOk(b.source)?'<span class="ok" aria-label="link checked">✓</span> ':""}<a href="${esc(b.source)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(host(b.source))}</a>`:esc(b[k])}</dd>`).join("")}</dl></td></tr>`;
    }).join("");
  }
  function benchTable(){
    const types = ["All", ...new Set(D.benchmarks.map(b=>b.type))];
    const cnt = t => t==="All" ? D.benchmarks.length : D.benchmarks.filter(b=>b.type===t).length;
    return `<div class="table-tools">
      <div class="chips" role="group" aria-label="Filter benchmark rows by task">${types.map(t=>`<button type="button" class="chip" data-btype="${esc(t)}" aria-pressed="${state.benchType===t}">${esc(t)}<span class="n">${cnt(t)}</span></button>`).join("")}</div>
      <div class="table-meta"><label class="table-filter"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="sr-only">Filter table rows</span><input id="bench-q" type="search" placeholder="Filter rows" value="${esc(state.benchQ)}" autocomplete="off"></label><span id="bench-count" role="status" aria-live="polite"></span></div>
    </div>
    <div class="table-wrap"><table id="bench"><caption class="sr-only">Published Yiddish AI metrics with sources. Sort with the column header buttons; expand a row for access, Yiddish support, dialect and test set.</caption>
    <thead><tr><th scope="col" style="width:40px"><span class="sr-only">Details</span></th>${COLS.map(([k,l,c])=>`<th scope="col" class="${c}" data-col="${k}" aria-sort="none"><button type="button" class="sort" data-sort="${k}">${l}<span class="arrow" aria-hidden="true">▲</span></button></th>`).join("")}</tr></thead>
    <tbody></tbody></table></div>
    <p class="legend">Numbers are only comparable when the test set matches; each vendor/author used a different evaluation set. WER/CER: lower is better; COMET: higher is better.</p>`;
  }
  function updateBench(){
    const tb = $("#bench tbody"); if (!tb) return;
    const rows = benchRows(); tb.innerHTML = benchBody(rows);
    $("#bench-count").textContent = `${rows.length} of ${D.benchmarks.length} rows`;
    $$("#bench th[data-col]").forEach(th => th.setAttribute("aria-sort", state.sort.col===th.dataset.col ? (state.sort.dir>0?"ascending":"descending") : "none"));
    $$("[data-btype]").forEach(b => b.setAttribute("aria-pressed", String(state.benchType===b.dataset.btype)));
  }
  function renderBench(sec){
    const list = entriesFor(sec.id);
    const html = `<section id="${sec.id}" aria-labelledby="h-${sec.id}" tabindex="-1">${secHead(sec)}
      <div class="callout"><h3>State of play (checked ${esc(D.generated)})</h3>
      <p><b>No public Yiddish ASR or TTS leaderboard exists on Hugging Face.</b> The only Yiddish benchmark suite found is <a href="https://huggingface.co/datasets/Yiddish-NLP/Kashes" target="_blank" rel="noopener">Kashes</a> (text: MT, POS, NER, QA…). ivrit.ai's Hebrew transcription leaderboard and Hebrew TTS arena are ready-made templates.</p>
      <p>Published Yiddish ASR numbers are sparse and use incompatible test sets; no commercial Yiddish speech vendor publishes WER/CER, and no Yiddish TTS system publishes MOS.</p></div>
      ${benchTable()}
      <h3 class="subcat" id="${sec.id}-resources">Benchmark resources<small>${list.length}</small></h3>${list.length?grid(list):'<p class="empty">No entries match the current filters.</p>'}</section>`;
    return {html, n:list.length + D.benchmarks.length};
  }

  // ---------- people ----------
  function renderPeople(sec){
    const ppl = D.people.filter(p => peopleMatch(p, state.q));
    const speech = ppl.filter(p=>p.speech), other = ppl.filter(p=>!p.speech);
    const pc = p => `<article class="card" id="p-${slug(p.name)}">
      <h3>${esc(p.name)}</h3><p class="person-role">${esc(p.role)}</p>
      <p class="desc">${esc(p.works_on)}</p>
      <details class="more"><summary>${p.existing?'<span class="tag">Already collaborating</span>':""}<span class="toggle">Details${CHEV}</span></summary>
        <div class="detail"><dl class="kv"><dt>Focus</dt><dd>${p.speech?"Speech (TTS / ASR)":"Text / NLP / OCR"}</dd><dt>Fit</dt><dd>${esc(p.fit)}</dd></dl>
        <p class="sources-h">Public links</p>${srcList(p.links)}</div></details></article>`;
    const html = `<section id="${sec.id}" class="people" aria-labelledby="h-${sec.id}" tabindex="-1">${secHead(sec)}
      <div class="callout"><h3>Collaborators wanted: open-source Yiddish TTS</h3>
      <p>We are building an open Yiddish text-to-speech stack aimed at a <b>NotebookLM-style Yiddish podcast generator</b> (two natural voices discussing a document), plus Yiddish ASR to evaluate it. Most needed: Hasidic-accent speech data and speakers, G2P / loshn-koydesh pronunciation expertise, TTS model training (VibeVoice, F5, Chatterbox, Piper), and help setting up a public Yiddish ASR/TTS benchmark modelled on ivrit.ai's leaderboards.</p>
      <p>If you work on Yiddish speech, see the README's “Contribute” section. Only public profile links are listed below; reach people through the channels they publish.</p></div>
      <h3 class="subcat" id="${sec.id}-speech">Speech (TTS / ASR)<small>${speech.length}</small></h3>${speech.length?`<div class="grid">${speech.map(pc).join("")}</div>`:'<p class="empty">No match.</p>'}
      <h3 class="subcat" id="${sec.id}-text">Text, NLP &amp; OCR<small>${other.length}</small></h3>${other.length?`<div class="grid">${other.map(pc).join("")}</div>`:'<p class="empty">No match.</p>'}</section>`;
    return {html, n:ppl.length};
  }

  // ---------- page ----------
  function renderStatic(){
    $("#stats").textContent = `${D.entries.length} sourced entries · ${D.benchmarks.length} benchmark rows · ${D.people.length} people & orgs · ${Object.keys(D.link_checks||{}).length} links checked · updated ${D.generated}`;
    $$(".gen").forEach(x => x.textContent = D.generated);
  }

  function render({animate=false}={}){
    const secs = D.sections[state.tab];
    const parts = secs.map(s => s.id==="yi-bench" ? renderBench(s) : s.id==="yi-people" ? renderPeople(s) : renderEntriesSection(s));
    const main = $("#main");
    main.innerHTML = parts.map(p=>p.html).join("");
    main.setAttribute("aria-labelledby", "tab-"+state.tab);
    if (animate && !reduceMotion()){ main.classList.remove("anim"); void main.offsetWidth; main.classList.add("anim"); }
    $("#section-nav").innerHTML = secs.map(s => `<a href="#${s.id}" data-sec="${s.id}">${esc(SHORT[s.id]||s.title)}</a>`).join("");
    $$(".tab").forEach(t => { const on = t.dataset.tab===state.tab; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; });
    const active = [state.q, state.status, state.oss, state.hasidic].filter(Boolean).length;
    const shown = D.entries.filter(e => e.sections.some(s=>SECTION_TAB[s]===state.tab) && matches(e)).length;
    const all = D.entries.filter(e => e.sections.some(s=>SECTION_TAB[s]===state.tab)).length;
    $("#result-count").textContent = active ? `${shown} of ${all} ${TAB_LABEL[state.tab]} entries match` : `${all} ${TAB_LABEL[state.tab]} entries`;
    const fa = [state.status, state.oss, state.hasidic].filter(Boolean).length, fn = $("#filter-n");
    fn.hidden = !fa; fn.textContent = fa || "";
    updateBench(); spy();
    document.dispatchEvent(new CustomEvent("tyd:render", {detail:{tab:state.tab}}));
  }
  const SHORT = {"torah-search":"AI search & Q&A","torah-libraries":"Libraries","torah-typesetting":"Typesetting, nikud & OCR","yi-writing":"Writing","yi-translation":"Translation","yi-other":"Speech, OCR, data & models","yi-bench":"Benchmarks","yi-people":"People & collaborators"};
  function keepScroll(fn){ const y = window.scrollY; fn(); window.scrollTo({top:y, behavior:"instant"}); }

  let observer;
  function spy(){
    if (observer) observer.disconnect();
    const links = $$("#section-nav a[data-sec]");
    observer = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting){ links.forEach(l=>{ const on = l.dataset.sec===en.target.id; l.classList.toggle("active", on); if (on) l.setAttribute("aria-current","location"); else l.removeAttribute("aria-current"); }); } }), {rootMargin:"-20% 0px -70% 0px"});
    $$("main section").forEach(s => observer.observe(s));
  }

  // ---------- routing ----------
  /** Resolve a hash/target id to {tab, id}. Accepts tab names, section ids, sub-ids (yi-other-tts), entry ids (e-<id> or <id>). */
  function resolveTarget(raw){
    const h = decodeURIComponent(String(raw||"").replace(/^#/,""));
    if (!h) return null;
    if (h==="torah"||h==="yiddish") return {tab:h, id:null};
    if (SECTION_TAB[h]) return {tab:SECTION_TAB[h], id:h};
    const sec = Object.keys(SECTION_TAB).find(s => h.startsWith(s+"-"));
    if (sec) return {tab:SECTION_TAB[sec], id:h, section:sec};
    const eid = h.replace(/^e-/,""); const e = D.entries.find(x => x.id===eid);
    if (e) return {tab:tabOfEntry(e), id:"e-"+e.id, entry:e};
    if (/^p-/.test(h)) return {tab:"yiddish", id:h};
    return null;
  }
  function clearFilters(){
    state.q=""; state.status=""; state.oss=""; state.hasidic=false;
    $("#q").value=""; $("#f-status").value=""; $("#f-oss").value=""; $("#f-hasidic").checked=false;
  }
  function scrollToEl(el, smooth){
    el.scrollIntoView({behavior: smooth && !reduceMotion() ? "smooth" : "instant", block:"start"});
    const focusable = el.matches("section,article") ? el : el.closest("section");
    if (focusable){ if (!focusable.hasAttribute("tabindex")) focusable.setAttribute("tabindex","-1"); focusable.focus({preventScroll:true}); }
    if (el.classList.contains("card")){ const d = el.querySelector("details"); if (d) d.open = true; el.classList.add("flash"); setTimeout(()=>el.classList.remove("flash"), 2200); }
  }
  /** Go to a tab / section / entry. Returns {ok, tab, id} for the WebMCP tools. */
  function navigate(target, {push=true, smooth=true, initial=false}={}){
    const r = resolveTarget(target);
    if (!r) return {ok:false, error:`Unknown section or entry: ${target}`};
    const tabChanged = r.tab !== state.tab;
    if (tabChanged){ state.tab = r.tab; render({animate:true}); }
    let el = r.id ? document.getElementById(r.id) : null;
    if (r.id && !el){ clearFilters(); render(); el = document.getElementById(r.id); }
    const url = "#" + (r.id || r.tab);
    if (push && location.hash !== url) history.pushState(null, "", url);
    else if (!push) history.replaceState(null, "", url);
    if (el){
      scrollToEl(el, smooth && !initial);
      if (initial){ const again = () => el.isConnected && el.scrollIntoView({behavior:"instant", block:"start"}); requestAnimationFrame(again); (document.fonts ? document.fonts.ready : Promise.resolve()).then(()=>setTimeout(again,60)); }
    } else if (tabChanged || !r.id){
      const main = $("#main"); if (window.scrollY > main.offsetTop - 80) window.scrollTo({top: main.offsetTop - 80, behavior: reduceMotion()?"auto":"smooth"});
    }
    return {ok:true, tab:r.tab, id:r.id || r.tab, found: r.id ? !!el : true};
  }
  function setTab(tab, {focus=false}={}){
    if (tab!=="torah" && tab!=="yiddish") return {ok:false, error:"tab must be 'torah' or 'yiddish'"};
    const res = navigate(tab, {push:false});
    if (focus) $("#tab-"+tab).focus();
    return res;
  }

  // ---------- events ----------
  $$(".tab").forEach(t => {
    t.addEventListener("click", () => setTab(t.dataset.tab));
    t.addEventListener("keydown", ev => {
      const tabs = $$(".tab"); const i = tabs.indexOf(t); let j = null;
      if (ev.key==="ArrowRight"||ev.key==="ArrowDown") j = (i+1)%tabs.length;
      else if (ev.key==="ArrowLeft"||ev.key==="ArrowUp") j = (i-1+tabs.length)%tabs.length;
      else if (ev.key==="Home") j = 0; else if (ev.key==="End") j = tabs.length-1;
      if (j!==null){ ev.preventDefault(); setTab(tabs[j].dataset.tab, {focus:true}); }
    });
  });
  // In-page links (section nav, hero buttons, anchors, cross-tab links) go through the router.
  document.addEventListener("click", ev => {
    const a = ev.target.closest('a[href^="#"]'); if (!a || ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
    const href = a.getAttribute("href"); if (href==="#" ) return;
    if (href==="#main"){ return; }
    if (resolveTarget(href)){ ev.preventDefault(); navigate(href); }
  });
  window.addEventListener("hashchange", () => navigate(location.hash, {push:false}));
  window.addEventListener("popstate", () => navigate(location.hash || "#torah", {push:false}));

  // Main delegated handlers for re-rendered content (benchmark chips, sort buttons, table filter).
  $("#main").addEventListener("click", ev => {
    const chip = ev.target.closest("[data-btype]");
    if (chip){ state.benchType = chip.dataset.btype; updateBench(); return; }
    const sb = ev.target.closest("[data-sort]");
    if (sb){ const c = sb.dataset.sort; state.sort = {col:c, dir: state.sort.col===c ? -state.sort.dir : 1}; updateBench(); }
    const ex = ev.target.closest("[data-expand]");
    if (ex){ const i = +ex.dataset.expand, open = !openRows.has(i); if (open) openRows.add(i); else openRows.delete(i);
      ex.setAttribute("aria-expanded", String(open)); const row = document.getElementById("bm-"+i); if (row) row.hidden = !open; }
  });
  $("#main").addEventListener("input", ev => { if (ev.target.id==="bench-q"){ state.benchQ = ev.target.value.trim(); updateBench(); } });

  const form = $("#filters");
  const ftog = $("#filters-toggle"), fpanel = $("#filter-panel");
  function showFilters(open){ fpanel.hidden = !open; ftog.setAttribute("aria-expanded", String(open)); }
  ftog.addEventListener("click", () => { const open = fpanel.hidden; showFilters(open); if (open) $("#f-status").focus(); });
  function readForm(){ state.q = $("#q").value.trim(); state.status = $("#f-status").value; state.oss = $("#f-oss").value; state.hasidic = $("#f-hasidic").checked; }
  let deb; $("#q").addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(()=>{ readForm(); keepScroll(render); }, 120); });
  ["#f-status","#f-oss","#f-hasidic"].forEach(s => $(s).addEventListener("change", () => { readForm(); keepScroll(render); }));
  form.addEventListener("reset", () => setTimeout(() => { readForm(); keepScroll(render); }, 0));
  // Declarative WebMCP (form toolname=...): when an agent submits, respond with the visible result summary.
  form.addEventListener("submit", ev => {
    ev.preventDefault(); readForm(); if (state.status || state.oss || state.hasidic) showFilters(true); keepScroll(render);
    if (ev.agentInvoked && typeof ev.respondWith === "function") ev.respondWith(Promise.resolve(viewSummary()));
  });
  document.addEventListener("keydown", ev => {
    if (ev.key==="/" && !/input|select|textarea/i.test(document.activeElement.tagName) && !ev.metaKey && !ev.ctrlKey){ ev.preventDefault(); $("#q").focus(); }
    if (ev.key==="Escape" && document.activeElement.id==="q" && $("#q").value){ $("#q").value=""; readForm(); keepScroll(render); }
  });

  // Theme: html[data-theme] overrides prefers-color-scheme; saved in localStorage.
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const effectiveTheme = () => document.documentElement.dataset.theme || (mq.matches ? "dark" : "light");
  function syncThemeButton(){ const dark = effectiveTheme()==="dark"; const b = $("#theme-toggle"); b.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme"); b.setAttribute("aria-pressed", String(dark)); }
  function setTheme(t){ document.documentElement.dataset.theme = t; try { localStorage.setItem("tyd-theme", t); } catch(e){} syncThemeButton(); return t; }
  $("#theme-toggle").addEventListener("click", () => setTheme(effectiveTheme()==="dark" ? "light" : "dark"));
  mq.addEventListener && mq.addEventListener("change", syncThemeButton);

  function viewSummary(){
    const secs = D.sections[state.tab].map(s => ({id:s.id, title:s.title, visible_entries: entriesFor(s.id).length}));
    return {tab:state.tab, filters:{q:state.q, status:state.status||null, open_source:state.oss||null, hasidic:state.hasidic}, sections:secs,
      visible_entry_ids: D.entries.filter(e => e.sections.some(s=>SECTION_TAB[s]===state.tab) && matches(e)).map(e=>e.id)};
  }
  /** Apply filters to the visible page (used by WebMCP tools). */
  function applyFilters(f){
    if ("q" in f) state.q = String(f.q||""); if ("status" in f) state.status = f.status||""; if ("oss" in f) state.oss = f.oss||""; if ("hasidic" in f) state.hasidic = !!f.hasidic;
    if (state.status || state.oss || state.hasidic) showFilters(true);
    $("#q").value = state.q; $("#f-status").value = state.status; $("#f-oss").value = state.oss; $("#f-hasidic").checked = state.hasidic;
    if (f.tab && f.tab !== state.tab){ state.tab = f.tab; render({animate:true}); } else keepScroll(render);
    return viewSummary();
  }

  // ---------- boot ----------
  renderStatic(); syncThemeButton();
  const initial = resolveTarget(location.hash);
  state.tab = initial ? initial.tab : "torah";
  render();
  if (initial && initial.id) navigate(location.hash, {push:false, initial:true});

  window.TYD = Object.freeze({
    data: D, sectionTab: SECTION_TAB, sectionById: SECTION_BY_ID, subcatOrder: SUBCAT_ORDER,
    entryMatches, benchMatch, peopleMatch, numOf, isHasidic, linkOk, tabOfEntry, slug, NP,
    navigate, setTab, applyFilters, viewSummary, setTheme, effectiveTheme,
    getState: () => JSON.parse(JSON.stringify(state))
  });
  document.dispatchEvent(new CustomEvent("tyd:ready"));
})();
