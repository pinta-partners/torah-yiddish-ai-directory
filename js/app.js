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
  function srcLinks(list){
    return list.map(u => {
      const ok = linkOk(u);
      const mark = ok === null ? "" : ok ? `<span class="ok" title="Link checked ${esc(D.generated)}" aria-label="link checked">✓</span>` : `<span class="bad" title="Link check failed" aria-label="link check failed">✗</span>`;
      return `<a href="${esc(u)}" target="_blank" rel="noopener">${mark} ${esc(host(u))}</a>`;
    }).join("");
  }
  const EXT = `<svg class="ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>`;
  const shortDialect = d => { const s = d.split(/[;(]/)[0].trim(); return s.length > 30 ? s.slice(0,28)+"…" : s; };

  function card(e, i){
    const own = /directory author/i.test(e.by);
    const native = e.name_native ? `<span class="native" dir="rtl" lang="${/ייִ|אידיש|פאר|שרייבער|וואָרט|גערעדט/.test(e.name_native)?"yi":"he"}">${esc(e.name_native)}</span>` : "";
    const oss = e.open_source === "yes" ? `<span class="badge oss">open source</span>` : e.open_source === "partial" ? `<span class="badge oss">partly open</span>` : `<span class="badge closed">closed</span>`;
    const kv = [];
    if (e.repo) kv.push(["Repo", `<a href="${esc(e.repo)}" target="_blank" rel="noopener">${esc(host(e.repo))}</a>`]);
    if (e.license) kv.push(["License", esc(e.license)]);
    if (e.dialect) kv.push(["Dialect", `<span dir="auto">${esc(e.dialect)}</span>`]);
    if (e.metrics) kv.push(["Metrics", esc(e.metrics)]);
    if (e.notes) kv.push(["Note", esc(e.notes)]);
    return `<article class="card${e.unverified?" flagged":""}${own?" own":""}" id="e-${esc(e.id)}" style="--i:${i}" aria-labelledby="t-${esc(e.id)}">
      <div class="card-head"><h4 id="t-${esc(e.id)}"><a href="${esc(e.url)}" target="_blank" rel="noopener" dir="auto">${esc(e.name)}${EXT}</a>${native}</h4></div>
      <div class="by" dir="auto">${esc(e.by)} · <span class="cat">${esc(e.category)}</span></div>
      <div class="badges"><span class="badge ${esc(e.status)}"><span class="dot" aria-hidden="true"></span>${esc(e.status)}</span>${oss}${e.dialect?`<span class="badge dialect" title="Dialect: ${esc(e.dialect)}">${esc(shortDialect(e.dialect))}</span>`:""}${e.subcat?`<span class="badge sub">${esc(e.subcat)}</span>`:""}${e.unverified?'<span class="badge warn">unverified / unclear</span>':""}${own?'<span class="badge own">author\'s own project</span>':""}</div>
      <p class="desc" dir="auto">${esc(e.description)}</p>
      ${kv.length?`<dl class="kv">${kv.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`:""}
      <div class="sources"><span class="lbl">Sources</span>${srcLinks(e.sources||[e.url])}</div>
    </article>`;
  }
  const grid = list => `<div class="grid">${list.map(card).join("")}</div>`;
  function secHead(sec, metaText){
    return `<div class="sec-head"><div><p class="sec-kicker">${esc(TAB_LABEL[SECTION_TAB[sec.id]])}</p><h2 id="h-${sec.id}">${esc(sec.title)}<a class="anchor" href="#${sec.id}" aria-label="Link to this section">#</a></h2><p>${esc(sec.blurb)}</p></div>${metaText?`<span class="meta">${esc(metaText)}</span>`:""}</div>`;
  }

  function renderEntriesSection(sec){
    const list = entriesFor(sec.id); let body;
    if (sec.id === "yi-other"){
      const groups = {}; list.forEach(e => (groups[e.subcat||""] ||= []).push(e));
      body = SUBCAT_ORDER.filter(k => groups[k]).map(k => `<h3 class="subcat" id="${sec.id}-${slug(k||"other")}">${esc(k||"Other")} <small>${groups[k].length}</small></h3>${grid(groups[k])}`).join("");
    } else body = grid(list);
    if (!list.length) body = `<p class="empty">No entries match the current filters.</p>`;
    return {html:`<section id="${sec.id}" aria-labelledby="h-${sec.id}" tabindex="-1">${secHead(sec, `${list.length} ${list.length===1?"entry":"entries"}`)}${body}</section>`, n:list.length};
  }

  // ---------- benchmarks ----------
  const COLS = [["type","Type"],["system","System"],["access","Access"],["yi","Yiddish support"],["dialect","Dialect"],["metric","Metric"],["value","Published value"],["test","Test set"],["source","Source"]];
  const typeClass = t => "t-" + (t==="MT/LLM" ? "mt" : slug(t));
  function benchRows(){
    let rows = D.benchmarks.filter(b => benchMatch(b, {type:state.benchType, q:state.q, hasidic:state.hasidic}) && benchMatch(b, {q:state.benchQ}));
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
    if (!rows.length) return `<tr><td colspan="${COLS.length}" class="empty">No benchmark rows match.</td></tr>`;
    return rows.map(b=>`<tr>${COLS.map(([k])=>{
      if (k==="type") return `<td><span class="type-pill ${typeClass(b.type)}">${esc(b.type)}</span></td>`;
      if (k==="source") return `<td><a href="${esc(b.source)}" target="_blank" rel="noopener">${linkOk(b.source)?'<span class="ok" aria-label="link checked">✓</span> ':""}${esc(host(b.source))}</a></td>`;
      if (k==="value") return `<td class="val${NP.test(b.value)?" np":""}">${esc(b.value)}</td>`;
      return `<td dir="auto"${k==="system"?' class="sys"':k==="test"?' class="test"':""}>${esc(b[k])}</td>`; }).join("")}</tr>`).join("");
  }
  function benchTable(){
    const types = ["All", ...new Set(D.benchmarks.map(b=>b.type))];
    const cnt = t => t==="All" ? D.benchmarks.length : D.benchmarks.filter(b=>b.type===t).length;
    return `<div class="table-tools">
      <div class="chips" role="group" aria-label="Filter benchmark rows by task">${types.map(t=>`<button type="button" class="chip" data-btype="${esc(t)}" aria-pressed="${state.benchType===t}">${esc(t)}<span class="n">${cnt(t)}</span></button>`).join("")}</div>
      <div class="table-meta"><label class="table-filter"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="sr-only">Filter table rows</span><input id="bench-q" type="search" placeholder="Filter rows…" value="${esc(state.benchQ)}" autocomplete="off"></label><span id="bench-count" role="status" aria-live="polite"></span></div>
    </div>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Benchmark comparison table (scrollable)"><table id="bench"><caption class="sr-only">Published Yiddish AI metrics with sources. Use the column header buttons to sort.</caption>
    <thead><tr>${COLS.map(([k,l])=>`<th scope="col" data-col="${k}" aria-sort="none"><button type="button" class="sort" data-sort="${k}">${l}<span class="arrow" aria-hidden="true">▲</span></button></th>`).join("")}</tr></thead>
    <tbody></tbody></table></div>
    <p class="legend">Numbers are not comparable across rows unless the test set matches. Each vendor/author used a different evaluation set. WER/CER: lower is better; COMET: higher is better.</p>`;
  }
  function updateBench(){
    const tb = $("#bench tbody"); if (!tb) return;
    const rows = benchRows(); tb.innerHTML = benchBody(rows);
    $("#bench-count").textContent = `${rows.length} of ${D.benchmarks.length} rows`;
    $$("#bench th").forEach(th => th.setAttribute("aria-sort", state.sort.col===th.dataset.col ? (state.sort.dir>0?"ascending":"descending") : "none"));
    $$("[data-btype]").forEach(b => b.setAttribute("aria-pressed", String(state.benchType===b.dataset.btype)));
  }
  function renderBench(sec){
    const list = entriesFor(sec.id);
    const html = `<section id="${sec.id}" aria-labelledby="h-${sec.id}" tabindex="-1">${secHead(sec, `${D.benchmarks.length} rows · ${list.length} resources`)}
      <div class="callout info"><h3>State of play (checked ${esc(D.generated)})</h3>
      <p><b>No public Yiddish ASR or TTS leaderboard exists on Hugging Face.</b> The only Yiddish benchmark suite found is <a href="https://huggingface.co/datasets/Yiddish-NLP/Kashes" target="_blank" rel="noopener">Kashes</a> (text: MT, POS, NER, QA…). ivrit.ai's Hebrew transcription leaderboard and Hebrew TTS arena are ready-made templates.</p>
      <p>Published Yiddish ASR numbers are sparse and use incompatible test sets; no commercial Yiddish speech vendor publishes WER/CER, and no Yiddish TTS system publishes MOS.</p></div>
      ${benchTable()}
      <h3 class="subcat" id="${sec.id}-resources">Benchmark resources <small>${list.length}</small></h3>${list.length?grid(list):'<p class="empty">No entries match the current filters.</p>'}</section>`;
    return {html, n:list.length + D.benchmarks.length};
  }

  // ---------- people ----------
  const initials = n => n.replace(/\(.*?\)/g,"").split(/[\s/.-]+/).filter(w=>/^[A-Za-z]/.test(w)).slice(0,2).map(w=>w[0].toUpperCase()).join("") || "•";
  function renderPeople(sec){
    const ppl = D.people.filter(p => peopleMatch(p, state.q));
    const speech = ppl.filter(p=>p.speech), other = ppl.filter(p=>!p.speech);
    const pc = (p,i) => `<article class="card${p.existing?" own":""}" style="--i:${i}" id="p-${slug(p.name)}">
      <div class="card-head" style="justify-content:flex-start"><span class="person-avatar" aria-hidden="true">${esc(initials(p.name))}</span><div><h4>${esc(p.name)}</h4><div class="by">${esc(p.role)}</div></div></div>
      <div class="badges">${p.speech?'<span class="badge oss">speech (TTS/ASR)</span>':'<span class="badge sub">text / NLP / OCR</span>'}${p.existing?'<span class="badge own">already collaborating</span>':""}</div>
      <p class="desc">${esc(p.works_on)}</p><div class="fit"><b>Fit</b>${esc(p.fit)}</div>
      <div class="links sources"><span class="lbl">Public links</span>${srcLinks(p.links)}</div></article>`;
    const html = `<section id="${sec.id}" class="people" aria-labelledby="h-${sec.id}" tabindex="-1">${secHead(sec, `${ppl.length} people/orgs`)}
      <div class="callout"><h3>Collaborators wanted: open-source Yiddish TTS</h3>
      <p>We are building an open Yiddish text-to-speech stack aimed at a <b>NotebookLM-style Yiddish podcast generator</b> (two natural voices discussing a document), plus Yiddish ASR to evaluate it. Most needed: Hasidic-accent speech data and speakers, G2P / loshn-koydesh pronunciation expertise, TTS model training (VibeVoice, F5, Chatterbox, Piper), and help setting up a public Yiddish ASR/TTS benchmark modelled on ivrit.ai's leaderboards.</p>
      <p>If you work on Yiddish speech, see the README's “Contribute” section. Only public profile links are listed below; reach people through the channels they publish.</p></div>
      <h3 class="subcat" id="${sec.id}-speech">Speech (TTS / ASR) <small>${speech.length}</small></h3>${speech.length?`<div class="grid">${speech.map(pc).join("")}</div>`:'<p class="empty">No match.</p>'}
      <h3 class="subcat" id="${sec.id}-text">Text, NLP &amp; OCR <small>${other.length}</small></h3>${other.length?`<div class="grid">${other.map(pc).join("")}</div>`:'<p class="empty">No match.</p>'}</section>`;
    return {html, n:ppl.length};
  }

  // ---------- page ----------
  function renderStatic(){
    const torahN = D.entries.filter(e => e.sections.some(s=>SECTION_TAB[s]==="torah")).length;
    const yiN = D.entries.filter(e => e.sections.some(s=>SECTION_TAB[s]==="yiddish")).length;
    const ossN = D.entries.filter(e => e.open_source==="yes").length;
    const stats = [[D.entries.length,"sourced entries"],[torahN,"Torah AI tools"],[yiN,"Yiddish AI tools"],[ossN,"open source"],[D.benchmarks.length,"benchmark rows"],[D.people.length,"people & orgs"],[Object.keys(D.link_checks||{}).length,"links checked"]];
    $("#stats").innerHTML = stats.map(([n,l]) => `<li><b>${n}</b><span>${l}</span></li>`).join("");
    $$("[data-count=torah]").forEach(x => x.textContent = torahN);
    $$("[data-count=yiddish]").forEach(x => x.textContent = yiN);
    $$(".gen").forEach(x => x.textContent = D.generated);
    $("#meta").textContent = `${D.entries.length} entries · ${D.benchmarks.length} benchmark rows · ${D.people.length} people/orgs · ${Object.keys(D.link_checks||{}).length} links checked`;
  }

  function render({animate=false}={}){
    const secs = D.sections[state.tab];
    const parts = secs.map(s => s.id==="yi-bench" ? renderBench(s) : s.id==="yi-people" ? renderPeople(s) : renderEntriesSection(s));
    const main = $("#main");
    main.innerHTML = parts.map(p=>p.html).join("");
    main.setAttribute("aria-labelledby", "tab-"+state.tab);
    if (animate && !reduceMotion()){ main.classList.remove("anim"); void main.offsetWidth; main.classList.add("anim"); setTimeout(()=>main.classList.remove("anim"), 900); }
    $("#section-nav").innerHTML = `<p class="nav-h">On this tab</p>` + secs.map((s,i) => {
      let sub = "";
      if (s.id==="yi-other"){ const g={}; entriesFor(s.id).forEach(e=>g[e.subcat||""]=(g[e.subcat||""]||0)+1);
        sub = SUBCAT_ORDER.filter(k=>g[k]).map(k=>`<a class="sub" href="#${s.id}-${slug(k||"other")}">${esc(k||"Other")}<span class="count">${g[k]}</span></a>`).join(""); }
      return `<a href="#${s.id}" data-sec="${s.id}">${esc(s.title)}<span class="count">${parts[i].n}</span></a>${sub}`;
    }).join("");
    $$(".tab").forEach(t => { const on = t.dataset.tab===state.tab; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; });
    moveIndicator();
    const shown = D.entries.filter(e => e.sections.some(s=>SECTION_TAB[s]===state.tab) && matches(e)).length;
    const all = D.entries.filter(e => e.sections.some(s=>SECTION_TAB[s]===state.tab)).length;
    $("#result-count").textContent = (state.q||state.status||state.oss||state.hasidic) ? `${shown} of ${all} ${TAB_LABEL[state.tab]} entries match` : `${all} ${TAB_LABEL[state.tab]} entries`;
    updateBench(); spy();
    document.dispatchEvent(new CustomEvent("tyd:render", {detail:{tab:state.tab}}));
  }
  function keepScroll(fn){ const y = window.scrollY; fn(); window.scrollTo({top:y, behavior:"instant"}); }

  function moveIndicator(){
    const sel = $(".tab[aria-selected=true]"), ind = $(".tab-indicator"); if (!sel || !ind) return;
    ind.style.width = sel.offsetWidth+"px"; ind.style.transform = `translateX(${sel.offsetLeft}px)`;
  }

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
    if (el.classList.contains("card")){ el.classList.add("flash"); setTimeout(()=>el.classList.remove("flash"), 2200); }
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
  });
  $("#main").addEventListener("input", ev => { if (ev.target.id==="bench-q"){ state.benchQ = ev.target.value.trim(); updateBench(); } });

  const form = $("#filters");
  function readForm(){ state.q = $("#q").value.trim(); state.status = $("#f-status").value; state.oss = $("#f-oss").value; state.hasidic = $("#f-hasidic").checked; }
  let deb; $("#q").addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(()=>{ readForm(); keepScroll(render); }, 120); });
  ["#f-status","#f-oss","#f-hasidic"].forEach(s => $(s).addEventListener("change", () => { readForm(); keepScroll(render); }));
  form.addEventListener("reset", () => setTimeout(() => { readForm(); keepScroll(render); }, 0));
  // Declarative WebMCP (form toolname=...): when an agent submits, respond with the visible result summary.
  form.addEventListener("submit", ev => {
    ev.preventDefault(); readForm(); keepScroll(render);
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
  window.addEventListener("resize", moveIndicator);
  if (document.fonts) document.fonts.ready.then(moveIndicator);

  function viewSummary(){
    const secs = D.sections[state.tab].map(s => ({id:s.id, title:s.title, visible_entries: entriesFor(s.id).length}));
    return {tab:state.tab, filters:{q:state.q, status:state.status||null, open_source:state.oss||null, hasidic:state.hasidic}, sections:secs,
      visible_entry_ids: D.entries.filter(e => e.sections.some(s=>SECTION_TAB[s]===state.tab) && matches(e)).map(e=>e.id)};
  }
  /** Apply filters to the visible page (used by WebMCP tools). */
  function applyFilters(f){
    if ("q" in f) state.q = String(f.q||""); if ("status" in f) state.status = f.status||""; if ("oss" in f) state.oss = f.oss||""; if ("hasidic" in f) state.hasidic = !!f.hasidic;
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
