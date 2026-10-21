/* Torah + Yiddish AI Directory: rendering, filtering, hash routing, sortable benchmark table.
   Exposes a small query/UI API on window.TYD that js/webmcp.js turns into WebMCP tools. */
(function(){
  "use strict";
  const D = window.DIRECTORY_DATA;
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const SUBCAT_ORDER = ["TTS","ASR","OCR & HTR","Datasets & corpora","Models & LLMs","Community & orgs",""];
  const TAB_LABEL = {torah:"Torah", yiddish:"Yiddish", all:"All"};
  const KINDS = ["product","builder","all"];
  const KIND_LABEL = {product:"Ready-to-use apps", builder:"For builders: code & models", all:"All"};
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = { tab:"torah", kind:"product", listKind:"all", q:"", status:"", oss:"", hasidic:false, benchType:"All", benchQ:"", sort:{col:null,dir:1} };

  // ---------- helpers ----------
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const linkOk = u => { const c = (D.link_checks||{})[u]; return c ? /^[23]/.test(c.code) || !!c.manual : null; };
  const host = u => { try { const x = new URL(u); return x.hostname.replace(/^www\./,"") + (x.pathname.length>1 ? x.pathname.replace(/\/$/,"").slice(0,38) : ""); } catch(e){ return u; } };
  const isHasidic = e => /hasid|heimish|chabad|williamsburg|unterland/i.test([e.dialect,e.description,e.name].join(" "));
  const tokens = q => String(q||"").toLowerCase().split(/\s+/).filter(Boolean);
  const entryHay = e => [e.name,e.plain,e.name_native,e.by,e.category,e.description,e.dialect,e.metrics,e.notes,e.subcat,e.url,e.repo,e.license].join(" ").toLowerCase();
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
    if (f.kind && f.kind !== "all" && e.kind !== f.kind) return false;
    const t = tokens(f.q); if (!t.length) return true;
    const hay = entryHay(e); return t.every(x => hay.includes(x));
  }
  const curKind = () => state.tab === "all" ? state.listKind : state.kind;
  const uiFilter = (kind=curKind()) => ({q:state.q, status:state.status, oss:state.oss, hasidic:state.hasidic, kind});
  const matches = e => entryMatches(e, uiFilter());
  const entriesFor = sec => D.entries.filter(e => e.sections.includes(sec) && matches(e));
  /** Entries in a section that are hidden only because of the kind switch. */
  const hiddenByKind = sec => curKind()==="all" ? 0 : D.entries.filter(e => e.sections.includes(sec) && e.kind !== curKind() && entryMatches(e, uiFilter("all"))).length;
  const NP = /not published|n\/a|^—$/i;
  function numOf(v){ if (NP.test(v)) return null; const m = String(v).replace(",",".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
  function benchMatch(b, f){
    if (f.type && f.type !== "All" && b.type !== f.type) return false;
    if (f.hasidic && !/hasid|heimish|chabad/i.test(b.dialect+" "+b.system)) return false;
    const t = tokens(f.q); if (!t.length) return true;
    const h = Object.values(b).join(" ").toLowerCase(); return t.every(x => h.includes(x));
  }
  function peopleMatch(p, q){ const t = tokens(q); if (!t.length) return true; const h=[p.name,p.role,p.works_on,p.plain,p.fit,...p.links].join(" ").toLowerCase(); return t.every(x=>h.includes(x)); }

  // ---------- rendering ----------
  const CHEV = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  const friendlyDate = d => { try { return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}); } catch(e){ return d; } };
  function srcList(list){
    return `<ul class="sources">${list.map(u => {
      const ok = linkOk(u);
      const mark = ok === null ? "" : ok ? `<span class="ok" title="Link checked ${esc(D.generated)}" aria-label="link checked">✓</span> ` : `<span class="bad" title="Link check failed" aria-label="link check failed">✗</span> `;
      return `<li>${mark}<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a></li>`;
    }).join("")}</ul>`;
  }
  const nativeLang = s => /ייִ|אידיש|פאר|שרייבער|וואָרט|גערעדט/.test(s) ? "yi" : "he";
  // Strict test for the visible "Hasidic Yiddish" tag (the broader isHasidic() is kept for filtering).
  const hasidicTag = e => /^(hasidic|chabad|claims 'heimish)|(→|↔) hasidic/i.test(e.dialect||"");
  /** At most two plain-word tags; everything technical lives under Details. */
  function tagsFor(e){
    const t = [];
    if (e.unverified) t.push(["Not yet confirmed","warn"]);
    if (e.status === "beta") t.push(["In testing",""]); else if (e.status === "archived") t.push(["No longer updated",""]);
    if (hasidicTag(e)) t.push(["Hasidic Yiddish",""]);
    if (e.open_source === "yes") t.push(["Free & open",""]); else if (e.open_source === "partial") t.push(["Partly open",""]);
    if (/directory author/i.test(e.by)) t.push(["Our own project",""]);
    return t.slice(0,2).map(([l,c]) => `<span class="tag${c?" "+c:""}">${esc(l)}</span>`).join("");
  }
  function card(e){
    const kv = [["Made by", `<span dir="auto">${esc(e.by)}</span>`], ["Type", esc(e.category)]];
    if (e.repo) kv.push(["Code", `<a href="${esc(e.repo)}" target="_blank" rel="noopener">${esc(host(e.repo))}</a>`]);
    if (e.license) kv.push(["License", esc(e.license)]);
    if (e.dialect) kv.push(["Dialect", `<span dir="auto">${esc(e.dialect)}</span>`]);
    if (e.metrics) kv.push(["Results", esc(e.metrics)]);
    if (e.notes) kv.push(["Note", esc(e.notes)]);
    kv.push(["Status", (e.status==="active"?"working now":e.status==="beta"?"in testing":"no longer updated") + " · " + (e.open_source==="yes" ? "open source" : e.open_source==="partial" ? "partly open source" : "closed source")]);
    if (e.unverified) kv.push(["Flag", "not yet confirmed (unverified / unclear)"]);
    kv.push(["Kind", (e.kind==="product" ? "Ready-to-use app" : "For builders (code, models, data or research)") + (e.kind_note ? " – " + esc(e.kind_note) : "")]);
    kv.push(["Free or paid", esc(e.cost)]);
    return `<article class="card" id="e-${esc(e.id)}" aria-labelledby="t-${esc(e.id)}">
      <h3 id="t-${esc(e.id)}"><a href="${esc(e.url)}" target="_blank" rel="noopener" dir="auto">${esc(e.name)}</a>${e.name_native?`<span class="native" dir="rtl" lang="${nativeLang(e.name_native)}">${esc(e.name_native)}</span>`:""}</h3>
      <p class="desc" dir="auto">${esc(e.plain || e.description)}</p>
      <details class="more"><summary>${curKind()==="all" ? `<span class="kind-tag k-${e.kind}">${e.kind==="product"?"App":"Code"}</span>` : ""}${tagsFor(e)}${e.kind==="product" && e.cost && e.cost!=="Not stated" ? `<span class="cost">${esc(e.cost)}</span>` : ""}<span class="toggle">Details${CHEV}</span></summary>
        <div class="detail"><p class="orig" dir="auto">${esc(e.description)}</p>
        <dl class="kv">${kv.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
        <p class="sources-h">Sources</p>${srcList(e.sources||[e.url])}</div>
      </details>
    </article>`;
  }
  const grid = list => `<div class="grid">${list.map(card).join("")}</div>`;
  function emptyNote(n, quiet=false){
    if (!n) return quiet ? "" : `<p class="empty">No entries match the current filters.</p>`;
    const k = curKind(), other = k==="product" ? "builder" : "product";
    return `<p class="empty">${quiet ? "" : k==="product" ? "No ready-to-use apps here yet." : "No builder tools here."} <button type="button" class="linkish" data-kind="${other}">Show ${n} ${other==="product" ? (n===1?"ready-to-use app":"ready-to-use apps") : (n===1?"tool for builders":"tools for builders")} →</button></p>`;
  }
  const moreNote = n => n ? `<p class="more-kind"><button type="button" class="linkish" data-kind="all">+ ${n} more ${curKind()==="product" ? (n===1?"tool for builders":"tools for builders") : (n===1?"ready-to-use app":"ready-to-use apps")} in this section →</button></p>` : "";
  function secHead(sec){
    return `<div class="sec-head"><h2 id="h-${sec.id}">${esc(sec.label||sec.title)}<a class="anchor" href="#${sec.id}" aria-label="Link to this section">#</a></h2><p>${esc(sec.plain||sec.blurb)}</p></div>`;
  }
  // The big "speech, scanning, data & community" section is shown as five everyday groups.
  // Group ids keep the old sub-category deep links (#yi-other-tts, #yi-other-asr, ...).
  const GROUPS = [
    {id:"yi-other-tts", subs:["TTS"], label:"Read aloud (text-to-speech)", pill:"Read aloud", plain:"Voices that read Yiddish text out loud."},
    {id:"yi-other-asr", subs:["ASR"], label:"Transcribe audio", pill:"Transcribe audio", plain:"Turn Yiddish recordings into written text."},
    {id:"yi-other-ocr-htr", subs:["OCR & HTR"], label:"Scanning old books (OCR)", pill:"Scanning old books", plain:"Turn scanned pages and handwriting into text you can search."},
    {id:"yi-other-data", subs:["Datasets & corpora","Models & LLMs"], label:"Data & models (for builders)", pill:"Data & models", plain:"Recordings, text collections and AI models for people building new tools.",
     subLabels:{"Datasets & corpora":"Recordings & text collections","Models & LLMs":"AI models"}},
    {id:"yi-other-community-orgs", subs:["Community & orgs"], label:"Community", pill:"Community", plain:"Organizations, archives, forums and other services."}];

  function renderEntriesSection(sec){
    const list = entriesFor(sec.id);
    if (sec.id === "yi-other"){
      const by = {}; list.forEach(e => (by[e.subcat||""] ||= []).push(e));
      // Entries in the same group that only the kind switch hides.
      const anyKind = D.entries.filter(e => e.sections.includes("yi-other") && entryMatches(e, uiFilter("all")));
      const body = GROUPS.map(g => {
        const total = anyKind.filter(e => g.subs.includes(e.subcat)).length;
        if (!total) return "";
        const shown = g.subs.reduce((n,k) => n + (by[k]||[]).length, 0), hidden = total - shown;
        // Entries filed under another group that also do this job (e.g. a transcription app that also reads aloud).
        const also = list.filter(e => (e.also_subcats||[]).some(k => g.subs.includes(k)) && !g.subs.includes(e.subcat));
        const alsoHtml = also.length ? `<p class="also">${shown ? "Also does this:" : "Apps that also do this (listed under another heading):"} ${also.map(e => `<a href="#e-${esc(e.id)}">${esc(e.name)}</a>`).join(", ")}.</p>` : "";
        const inner = !shown ? alsoHtml + emptyNote(hidden, !!also.length) : alsoHtml + (g.subs.length > 1
          ? g.subs.filter(k => by[k]).map(k => `<h3 class="subcat" id="yi-other-${slug(k)}">${esc(g.subLabels[k])}</h3>${grid(by[k])}`).join("")
          : grid(by[g.subs[0]])) + moreNote(hidden);
        return `<div class="group" id="${g.id}" data-spy tabindex="-1" aria-labelledby="h-${g.id}"><div class="sec-head"><h2 id="h-${g.id}">${esc(g.label)}<a class="anchor" href="#${g.id}" aria-label="Link to this section">#</a></h2><p>${esc(g.plain)}</p></div>${inner}</div>`;
      }).join("") || `<p class="empty">No entries match the current filters.</p>`;
      return {html:`<section id="${sec.id}" aria-label="${esc(sec.label)}" tabindex="-1" class="groups">${body}</section>`, n:list.length};
    }
    const hidden = hiddenByKind(sec.id);
    const body = list.length ? grid(list) + moreNote(hidden) : emptyNote(hidden);
    return {html:`<section id="${sec.id}" data-spy aria-labelledby="h-${sec.id}" tabindex="-1">${secHead(sec)}${body}</section>`, n:list.length};
  }


  // ---------- benchmarks ("How the tools compare") ----------
  const TASK_PLAIN = {"ASR":"Transcribes speech","TTS":"Reads text aloud","MT/LLM":"Translates","OCR":"Reads scanned pages"};
  const CHIP_PLAIN = {"All":"All","ASR":"Transcription","TTS":"Reading aloud","MT/LLM":"Translation","OCR":"Scanning"};
  const direction = b => numOf(b.value) === null ? "—" : /WER|CER/i.test(b.metric) ? "Lower is better" : /COMET/i.test(b.metric) ? "Higher is better" : "—";
  // Visible columns in plain words; acronyms (metric names) only appear in the expanded row.
  const COLS = [["system","Tool","h-sys"],["type","What it does","h-task"],["value","Score","h-val"],["dir","Lower or higher is better","h-metric"],["source","Source","h-src"]];
  const MORE = [["metric","Measured as"],["access","How to get it"],["yi","Supports Yiddish?"],["dialect","Dialect"],["test","Tested on"],["source","Source"]];
  const openRows = new Set();
  function benchRows(){
    let rows = D.benchmarks.map((b,i)=>Object.assign({_i:i}, b)).filter(b => benchMatch(b, {type:state.benchType, q:state.q, hasidic:state.hasidic}) && benchMatch(b, {q:state.benchQ}));
    const {col,dir} = state.sort;
    if (col){
      rows = rows.slice().sort((a,b) => {
        if (col==="value"){ const x=numOf(a.value), y=numOf(b.value); if (x===null && y===null) return 0; if (x===null) return 1; if (y===null) return -1; return (x-y)*dir; }
        if (col==="type") return String(TASK_PLAIN[a.type]).localeCompare(String(TASK_PLAIN[b.type]))*dir;
        return String(a[col]).localeCompare(String(b[col]))*dir;
      });
    }
    return rows;
  }
  function benchBody(rows){
    if (!rows.length) return `<tr><td colspan="${COLS.length+1}" class="empty">No tools match.</td></tr>`;
    return rows.map(b=>{
      const open = openRows.has(b._i), rid = "bm-"+b._i;
      return `<tr class="row"><td class="x"><button type="button" class="expand" data-expand="${b._i}" aria-expanded="${open}" aria-controls="${rid}" aria-label="More about ${esc(b.system)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></td>${COLS.map(([k])=>{
        if (k==="source") return `<td class="src"><a href="${esc(b.source)}" target="_blank" rel="noopener" title="${esc(b.source)}">${esc(host(b.source).split("/")[0])}</a></td>`;
        if (k==="value") return `<td class="val${NP.test(b.value)?" np":""}">${esc(b.value)}</td>`;
        if (k==="type") return `<td class="task">${esc(TASK_PLAIN[b.type]||b.type)}</td>`;
        if (k==="dir") return `<td class="metric">${direction(b)}</td>`;
        return `<td dir="auto" class="sys">${esc(b.system)}</td>`; }).join("")}</tr>
        <tr class="more-row" id="${rid}"${open?"":" hidden"}><td colspan="${COLS.length+1}"><dl>${MORE.map(([k,l])=>`<dt>${l}</dt><dd dir="auto">${k==="source"?`${linkOk(b.source)?'<span class="ok" aria-label="link checked">✓</span> ':""}<a href="${esc(b.source)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(host(b.source))}</a>`:esc(b[k])}</dd>`).join("")}</dl></td></tr>`;
    }).join("");
  }
  function benchTable(){
    const types = ["All", ...new Set(D.benchmarks.map(b=>b.type))];
    const cnt = t => t==="All" ? D.benchmarks.length : D.benchmarks.filter(b=>b.type===t).length;
    return `<div class="table-tools">
      <div class="chips" role="group" aria-label="Show tools that">${types.map(t=>`<button type="button" class="chip" data-btype="${esc(t)}" aria-pressed="${state.benchType===t}">${esc(CHIP_PLAIN[t]||t)}<span class="n">${cnt(t)}</span></button>`).join("")}</div>
      <div class="table-meta"><label class="table-filter"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="sr-only">Find a tool in the table</span><input id="bench-q" type="search" placeholder="Find a tool" value="${esc(state.benchQ)}" autocomplete="off"></label><span id="bench-count" role="status" aria-live="polite"></span></div>
    </div>
    <div class="table-wrap"><table id="bench"><caption class="sr-only">Published scores for Yiddish AI tools, with sources. Sort with the column header buttons; open a row to see how each score was measured.</caption>
    <thead><tr><th scope="col" style="width:40px"><span class="sr-only">More</span></th>${COLS.map(([k,l,c])=> k==="dir" ? `<th scope="col" class="${c}"><span class="th-plain">${l}</span></th>` : `<th scope="col" class="${c}" data-col="${k}" aria-sort="none"><button type="button" class="sort" data-sort="${k}">${l}<span class="arrow" aria-hidden="true">▲</span></button></th>`).join("")}</tr></thead>
    <tbody></tbody></table></div>`;
  }
  function updateBench(){
    const tb = $("#bench tbody"); if (!tb) return;
    const rows = benchRows(); tb.innerHTML = benchBody(rows);
    $("#bench-count").textContent = `${rows.length} of ${D.benchmarks.length}`;
    $$("#bench th[data-col]").forEach(th => th.setAttribute("aria-sort", state.sort.col===th.dataset.col ? (state.sort.dir>0?"ascending":"descending") : "none"));
    $$("[data-btype]").forEach(b => b.setAttribute("aria-pressed", String(state.benchType===b.dataset.btype)));
  }
  function renderBench(sec){
    const list = entriesFor(sec.id);
    const html = `<section id="${sec.id}" data-spy aria-labelledby="h-${sec.id}" tabindex="-1">${secHead(sec)}
      <div class="explain"><p><b>How to read the scores.</b> For transcription and scanning tools, the score is an error rate, so lower is better: 8% means about 8 words (or letters) in 100 come out wrong. Some scores are written as decimals, so 0.08 is the same as 8%. For translation, the score is a quality rating, and higher is better. When two numbers are shown, open the row to see what each one measures.</p>
      <p>Scores only compare fairly when tools were tested on the same recordings or pages, and most were not. We found no public scoreboard for Yiddish speech tools; companies selling Yiddish transcription don't publish error rates, and no Yiddish read-aloud voice publishes a listening score. The only public set of Yiddish tests we found, <a href="https://huggingface.co/datasets/Yiddish-NLP/Kashes" target="_blank" rel="noopener">Kashes</a>, covers written tasks like translation. ivrit.ai's Hebrew scoreboards could serve as a model.</p></div>
      ${benchTable()}
      <h3 class="subcat" id="${sec.id}-resources">Scoreboards and test sets</h3>${list.length ? grid(list) + moreNote(hiddenByKind(sec.id)) : emptyNote(hiddenByKind(sec.id))}</section>`;
    return {html, n:list.length + D.benchmarks.length};
  }

  // ---------- people ----------
  function renderPeople(sec){
    const ppl = D.people.filter(p => peopleMatch(p, state.q));
    const speech = ppl.filter(p=>p.speech), other = ppl.filter(p=>!p.speech);
    const pc = p => `<article class="card" id="p-${slug(p.name)}">
      <h3>${esc(p.name)}</h3><p class="person-role">${esc(p.role)}</p>
      <p class="desc">${esc(p.plain || p.works_on)}</p>
      <details class="more"><summary>${p.existing?'<span class="tag">Already working with us</span>':""}<span class="toggle">Details${CHEV}</span></summary>
        <div class="detail"><dl class="kv"><dt>Works on</dt><dd>${esc(p.works_on)}</dd><dt>Focus</dt><dd>${p.speech?"Speech (voices & transcription)":"Text, translation & scanning"}</dd><dt>Fit</dt><dd>${esc(p.fit)}</dd></dl>
        <p class="sources-h">Public links</p>${srcList(p.links)}</div></details></article>`;
    const html = `<section id="${sec.id}" data-spy class="people" aria-labelledby="h-${sec.id}" tabindex="-1">${secHead(sec)}
      <div class="callout"><h3>Want to help build a free Yiddish voice?</h3>
      <p>We're building a free, open Yiddish voice that can read text aloud and turn a document into a podcast-style conversation between two voices, plus a Yiddish transcriber to check how well it works. We'd especially love help with recordings of Hasidic Yiddish speakers, knowing how words are pronounced (including Hebrew and Aramaic words in Yiddish), training voice models, and setting up a fair public scoreboard for Yiddish speech tools.</p>
      <p>If that's you, see the <a href="https://github.com/pinta-partners/torah-yiddish-ai-directory#contribute--collaborate-on-yiddish-tts" target="_blank" rel="noopener">“Contribute” notes</a>. Below are people already working in this area. We only list links they have made public, so please contact them that way.</p></div>
      <h3 class="subcat" id="${sec.id}-speech">Speech: voices &amp; transcription<small>${speech.length}</small></h3>${speech.length?`<div class="grid">${speech.map(pc).join("")}</div>`:'<p class="empty">No match.</p>'}
      <h3 class="subcat" id="${sec.id}-text">Text, translation &amp; scanning<small>${other.length}</small></h3>${other.length?`<div class="grid">${other.map(pc).join("")}</div>`:'<p class="empty">No match.</p>'}</section>`;
    return {html, n:ppl.length};
  }

  // ---------- page ----------
  function renderStatic(){
    const np = D.entries.filter(e=>e.kind==="product").length, nb = D.entries.length - np;
    $("#stats").textContent = `${D.entries.length} tools and resources (${np} ready-to-use apps, ${nb} for builders) · last checked ${friendlyDate(D.generated)}`;
    $$(".gen").forEach(x => x.textContent = D.generated);
    $$(".gen-plain").forEach(x => x.textContent = friendlyDate(D.generated));
  }

  // ---------- "All tools" list view (#all) ----------
  const tabsLabel = e => [...new Set(e.sections.map(s => TAB_LABEL[SECTION_TAB[s]]))].join(" & ");
  function listTable(list, caption){
    if (!list.length) return `<p class="empty">No tools match the current filters.</p>`;
    return `<div class="table-wrap"><table class="list"><caption class="sr-only">${esc(caption)}</caption>
      <thead><tr><th scope="col" class="l-name">Name</th><th scope="col" class="l-what">What it does</th><th scope="col" class="l-tab">Torah / Yiddish</th><th scope="col" class="l-kind">Kind</th><th scope="col" class="l-cost">Free or paid</th><th scope="col" class="l-link">Link</th></tr></thead>
      <tbody>${list.map(e => `<tr id="l-${esc(e.id)}"><td class="l-name"><a href="#e-${esc(e.id)}" dir="auto">${esc(e.name)}</a></td><td class="l-what" dir="auto">${esc(e.plain)}</td><td class="l-tab">${esc(tabsLabel(e))}</td><td class="l-kind">${e.kind==="product"?"App":"Code"}</td><td class="l-cost">${esc(e.cost)}</td><td class="l-link"><a href="${esc(e.url)}" target="_blank" rel="noopener" title="${esc(e.url)}">${esc(host(e.url).split("/")[0])}</a></td></tr>`).join("")}</tbody></table></div>`;
  }
  const LIST_SECS = [
    {id:"all-products", kind:"product", label:"Ready-to-use apps", plain:"Websites, apps and services you can use today, free or paid."},
    {id:"all-builders", kind:"builder", label:"For builders: code & models", plain:"Code, AI models, data collections, scoreboards and research for people making new tools."}];
  function renderList(){
    const list = D.entries.filter(matches);
    const head = `<div class="list-intro"><h2 id="h-all">All tools</h2><p>Every tool in this guide in one list. Click a name to see its card with details and sources.</p></div>`;
    const secs = LIST_SECS.filter(g => state.listKind==="all" || state.listKind===g.kind).map(g => {
      const l = list.filter(e => e.kind===g.kind);
      return `<section id="${g.id}" data-spy aria-labelledby="h-${g.id}" tabindex="-1"><div class="sec-head"><h2 id="h-${g.id}">${esc(g.label)} <span class="count">${l.length}</span><a class="anchor" href="#${g.id}" aria-label="Link to this section">#</a></h2><p>${esc(g.plain)}</p></div>${listTable(l, g.label)}</section>`;
    }).join("");
    return head + secs;
  }

  function pills(secs){
    if (state.tab === "all") return LIST_SECS.filter(g => state.listKind==="all" || state.listKind===g.kind).map(g => `<a href="#${g.id}" data-sec="${g.id}">${esc(g.label)}</a>`).join("");
    return secs.flatMap(s => s.id==="yi-other" ? GROUPS.map(g => [g.id, g.pill]) : [[s.id, s.label||s.title]])
      .map(([id,l]) => `<a href="#${id}" data-sec="${id}">${esc(l)}</a>`).join("");
  }
  const inTab = e => state.tab==="all" || e.sections.some(s=>SECTION_TAB[s]===state.tab);
  function renderKindSwitch(){
    const k = curKind();
    $$("#kind-switch [data-kind]").forEach(b => {
      b.setAttribute("aria-pressed", String(b.dataset.kind===k));
      b.querySelector(".n").textContent = D.entries.filter(e => inTab(e) && entryMatches(e, uiFilter(b.dataset.kind))).length;
    });
    $("#kind-hint").textContent = k==="product" ? "Websites, apps and services you can use today, free or paid." : k==="builder" ? "Code, AI models, data and research for people making new tools." : "Everything: ready-to-use apps and tools for builders.";
  }
  function render({animate=false}={}){
    const secs = state.tab==="all" ? [] : D.sections[state.tab];
    const main = $("#main");
    main.innerHTML = state.tab==="all" ? renderList() : secs.map(s => s.id==="yi-bench" ? renderBench(s) : s.id==="yi-people" ? renderPeople(s) : renderEntriesSection(s)).map(p=>p.html).join("");
    main.setAttribute("aria-labelledby", "tab-"+state.tab);
    main.classList.toggle("list-view", state.tab==="all");
    if (animate && !reduceMotion()){ main.classList.remove("anim"); void main.offsetWidth; main.classList.add("anim"); }
    $("#section-nav").innerHTML = pills(secs);
    $("#section-nav").setAttribute("aria-label", state.tab==="all" ? "Groups in the list" : "Sections in this tab");
    $$(".tab").forEach(t => { const on = t.dataset.tab===state.tab; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; });
    renderKindSwitch();
    const active = [state.q, state.status, state.oss, state.hasidic].filter(Boolean).length;
    const shown = D.entries.filter(e => inTab(e) && matches(e)).length;
    const all = D.entries.filter(e => inTab(e) && entryMatches(e, {kind:curKind()})).length;
    const what = state.tab==="all" ? "" : TAB_LABEL[state.tab]+" ";
    $("#result-count").textContent = active ? `${shown} of ${all} ${what}${curKind()==="all" ? "tools" : KIND_LABEL[curKind()].toLowerCase()} match` : "";
    const fa = [state.status, state.oss, state.hasidic].filter(Boolean).length, fn = $("#filter-n");
    fn.hidden = !fa; fn.textContent = fa || "";
    updateBench(); spy();
    document.dispatchEvent(new CustomEvent("tyd:render", {detail:{tab:state.tab, kind:curKind()}}));
  }
  /** Show ready-to-use apps, builder tools or both (in the current tab or the All tools list). */
  function setKind(kind){
    if (!KINDS.includes(kind)) return {ok:false, error:"kind must be 'product', 'builder' or 'all'"};
    if (state.tab==="all") state.listKind = kind; else state.kind = kind;
    keepScroll(render);
    return Object.assign({ok:true}, viewSummary());
  }
  function keepScroll(fn){ const y = window.scrollY; fn(); window.scrollTo({top:y, behavior:"instant"}); }

  let observer;
  function spy(){
    if (observer) observer.disconnect();
    const links = $$("#section-nav a[data-sec]");
    observer = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting){ links.forEach(l=>{ const on = l.dataset.sec===en.target.id; l.classList.toggle("active", on); if (on) l.setAttribute("aria-current","location"); else l.removeAttribute("aria-current"); }); } }), {rootMargin:"-20% 0px -70% 0px"});
    $$("main [data-spy]").forEach(s => observer.observe(s));
  }

  // ---------- routing ----------
  /** Resolve a hash/target id to {tab, id}. Accepts tab names, section ids, sub-ids (yi-other-tts), entry ids (e-<id> or <id>). */
  function resolveTarget(raw){
    const h = decodeURIComponent(String(raw||"").replace(/^#/,""));
    if (!h) return null;
    if (h==="torah"||h==="yiddish"||h==="all") return {tab:h, id:null};
    if (h==="all-products"||h==="all-builders") return {tab:"all", id:h};
    if (/^l-/.test(h)){ const e = D.entries.find(x => "l-"+x.id===h); if (e) return {tab:"all", id:h, entry:e}; }
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
    if (r.id && !el && r.entry){ // shown under the other kind? switch kinds before clearing filters
      if (r.tab==="all"){ if (state.listKind!=="all" && state.listKind!==r.entry.kind) state.listKind = "all"; }
      else if (state.kind!=="all" && state.kind!==r.entry.kind) state.kind = r.entry.kind;
      render(); el = document.getElementById(r.id);
    }
    if (r.id && !el && r.tab==="all" && /^all-/.test(r.id)){ state.listKind = "all"; render(); el = document.getElementById(r.id); }
    if (r.id && !el && !r.entry && r.tab!=="all" && state.kind!=="all"){ state.kind = "all"; render(); el = document.getElementById(r.id); }
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
    if (!["torah","yiddish","all"].includes(tab)) return {ok:false, error:"tab must be 'torah', 'yiddish' or 'all'"};
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
  // Kind switch (top) and the "show N more" buttons inside sections.
  document.addEventListener("click", ev => { const b = ev.target.closest("[data-kind]"); if (b) setKind(b.dataset.kind); });
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
    const secs = state.tab==="all" ? LIST_SECS.map(g => ({id:g.id, title:g.label, visible_entries: D.entries.filter(e => e.kind===g.kind && matches(e)).length}))
      : D.sections[state.tab].map(s => ({id:s.id, title:s.title, label:s.label, visible_entries: entriesFor(s.id).length}));
    return {tab:state.tab, kind:curKind(), filters:{q:state.q, status:state.status||null, open_source:state.oss||null, hasidic:state.hasidic}, sections:secs,
      visible_entry_ids: D.entries.filter(e => inTab(e) && matches(e)).map(e=>e.id)};
  }
  /** Apply filters to the visible page (used by WebMCP tools). */
  function applyFilters(f){
    if (f.kind && KINDS.includes(f.kind)){ if ((f.tab||state.tab)==="all") state.listKind = f.kind; else state.kind = f.kind; }
    if ("q" in f) state.q = String(f.q||""); if ("status" in f) state.status = f.status||""; if ("oss" in f) state.oss = f.oss||""; if ("hasidic" in f) state.hasidic = !!f.hasidic;
    if (state.status || state.oss || state.hasidic) showFilters(true);
    $("#q").value = state.q; $("#f-status").value = state.status; $("#f-oss").value = state.oss; $("#f-hasidic").checked = state.hasidic;
    if (f.tab && f.tab !== state.tab){ state.tab = f.tab; render({animate:true}); } else keepScroll(render);
    return viewSummary();
  }

  // ---------- boot ----------
  renderStatic(); syncThemeButton();
  { const k = new URLSearchParams(location.search).get("kind"); if (KINDS.includes(k)){ state.kind = k; state.listKind = k; } }
  const initial = resolveTarget(location.hash);
  state.tab = initial ? initial.tab : "torah";
  render();
  if (initial && initial.id) navigate(location.hash, {push:false, initial:true});

  window.TYD = Object.freeze({
    data: D, sectionTab: SECTION_TAB, sectionById: SECTION_BY_ID, subcatOrder: SUBCAT_ORDER,
    entryMatches, benchMatch, peopleMatch, numOf, isHasidic, linkOk, tabOfEntry, slug, NP,
    navigate, setTab, setKind, applyFilters, kinds: KINDS, viewSummary, setTheme, effectiveTheme,
    getState: () => JSON.parse(JSON.stringify(state))
  });
  document.dispatchEvent(new CustomEvent("tyd:ready"));
})();
