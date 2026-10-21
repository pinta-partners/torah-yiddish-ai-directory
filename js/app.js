(function(){
  "use strict";
  const D = window.DIRECTORY_DATA;
  const $ = (s, el=document) => el.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const SUBCAT_ORDER = ["TTS","ASR","OCR & HTR","Datasets & corpora","Models & LLMs","Community & orgs",""];
  const state = { tab:"torah", q:"", status:"", oss:"", hasidic:false, benchType:"All", sort:{col:null,dir:1} };

  const hasRTL = s => /[\u0590-\u05FF]/.test(s||"");
  const linkOk = u => { const c = (D.link_checks||{})[u]; return c ? /^[23]/.test(c.code) || c.manual : null; };
  const host = u => { try { const x = new URL(u); return x.hostname.replace(/^www\./,"") + (x.pathname.length>1 ? x.pathname.replace(/\/$/,"").slice(0,38) : ""); } catch(e){ return u; } };
  const isHasidic = e => /hasid|heimish|chabad|williamsburg|unterland/i.test([e.dialect,e.description,e.name].join(" "));

  function matches(e){
    if (state.status && e.status !== state.status) return false;
    if (state.oss && e.open_source !== state.oss) return false;
    if (state.hasidic && !isHasidic(e)) return false;
    if (!state.q) return true;
    const hay = [e.name,e.name_native,e.by,e.category,e.description,e.dialect,e.metrics,e.notes,e.subcat,e.url,e.repo,e.license].join(" ").toLowerCase();
    return state.q.toLowerCase().split(/\s+/).every(t => hay.includes(t));
  }

  function srcLinks(list){
    return list.map(u => {
      const ok = linkOk(u);
      const mark = ok === null ? "" : ok ? '<span class="ok" title="Link checked '+esc(D.generated)+'">✓</span>' : '<span class="bad" title="Link check failed">✗</span>';
      return `<a href="${esc(u)}" target="_blank" rel="noopener">${mark} ${esc(host(u))}</a>`;
    }).join("");
  }

  function card(e){
    const own = /directory author/i.test(e.by);
    const native = e.name_native ? `<span class="native" dir="rtl" lang="${/ייִ|אידיש|פאר|שרייבער|וואָרט|גערעדט/.test(e.name_native)?"yi":"he"}">${esc(e.name_native)}</span>` : "";
    const oss = e.open_source === "yes" ? `<span class="badge oss">open source</span>` : e.open_source === "partial" ? `<span class="badge oss">partly open</span>` : `<span class="badge closed">closed</span>`;
    const kv = [];
    if (e.repo) kv.push(["Repo", `<a href="${esc(e.repo)}" target="_blank" rel="noopener">${esc(host(e.repo))}</a>`]);
    if (e.license) kv.push(["License", esc(e.license)]);
    if (e.dialect) kv.push(["Dialect", `<span dir="auto">${esc(e.dialect)}</span>`]);
    if (e.metrics) kv.push(["Metrics", esc(e.metrics)]);
    if (e.notes) kv.push(["Note", esc(e.notes)]);
    return `<article class="card${e.unverified?" flagged":""}${own?" own":""}" id="e-${esc(e.id)}">
      <h4><a href="${esc(e.url)}" target="_blank" rel="noopener" dir="auto">${esc(e.name)}</a>${native}</h4>
      <div class="by" dir="auto">${esc(e.by)} · ${esc(e.category)}</div>
      <div class="badges"><span class="badge ${esc(e.status)}">${esc(e.status)}</span>${oss}${e.subcat?`<span class="badge">${esc(e.subcat)}</span>`:""}${e.unverified?'<span class="badge warn">unverified / unclear</span>':""}${own?'<span class="badge own">author\'s own project</span>':""}</div>
      <p class="desc" dir="auto">${esc(e.description)}</p>
      ${kv.length?`<dl class="kv">${kv.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`:""}
      <div class="sources">Sources: ${srcLinks(e.sources||[e.url])}</div>
    </article>`;
  }

  function entriesFor(sec){ return D.entries.filter(e => e.sections.includes(sec) && matches(e)); }

  function renderEntriesSection(sec){
    let list = entriesFor(sec.id), body;
    if (sec.id === "yi-other"){
      const groups = {};
      list.forEach(e => (groups[e.subcat||""] ||= []).push(e));
      body = SUBCAT_ORDER.filter(k => groups[k]).map(k => `<h3 class="subcat" id="${sec.id}-${slug(k)}">${esc(k||"Other")} <small>(${groups[k].length})</small></h3><div class="grid">${groups[k].map(card).join("")}</div>`).join("");
    } else body = `<div class="grid">${list.map(card).join("")}</div>`;
    if (!list.length) body = `<p class="empty">No entries match the current filters.</p>`;
    return {html:`<section id="${sec.id}"><div class="sec-head"><div><h2>${esc(sec.title)}</h2><p>${esc(sec.blurb)}</p></div><span class="meta">${list.length} entries</span></div>${body}</section>`, n:list.length};
  }
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"-");

  // ---------- benchmarks ----------
  const COLS = [["type","Type"],["system","System"],["access","Access"],["yi","Yiddish support"],["dialect","Dialect"],["metric","Metric"],["value","Published value"],["test","Test set"],["source","Source"]];
  const NP = /not published|n\/a|^—$/i;
  function numOf(v){ if (NP.test(v)) return null; const m = String(v).replace(",",".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
  function benchRows(){
    let rows = D.benchmarks.filter(b => state.benchType==="All" || b.type===state.benchType);
    if (state.q){ const t = state.q.toLowerCase().split(/\s+/); rows = rows.filter(b => { const h = Object.values(b).join(" ").toLowerCase(); return t.every(x => h.includes(x)); }); }
    if (state.hasidic) rows = rows.filter(b => /hasid|heimish|chabad/i.test(b.dialect+" "+b.system));
    const {col,dir} = state.sort;
    if (col){
      rows = rows.slice().sort((a,b) => {
        if (col==="value"){ const x=numOf(a.value), y=numOf(b.value); if (x===null && y===null) return 0; if (x===null) return 1; if (y===null) return -1; return (x-y)*dir; }
        return String(a[col]).localeCompare(String(b[col]))*dir;
      });
    }
    return rows;
  }
  function benchTable(){
    const rows = benchRows();
    const types = ["All", ...new Set(D.benchmarks.map(b=>b.type))];
    return `<div class="table-tools">${types.map(t=>`<button data-btype="${esc(t)}" class="${state.benchType===t?"on":""}">${esc(t)}</button>`).join("")}<span class="meta">${rows.length} rows · click a column to sort</span></div>
    <div class="table-wrap"><table id="bench"><thead><tr>${COLS.map(([k,l])=>`<th data-col="${k}" aria-sort="${state.sort.col===k?(state.sort.dir>0?"ascending":"descending"):"none"}">${l}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(b=>`<tr>${COLS.map(([k])=>{
      if (k==="source") return `<td><a href="${esc(b.source)}" target="_blank" rel="noopener">${linkOk(b.source)?'<span class="ok">✓</span> ':""}${esc(host(b.source))}</a></td>`;
      if (k==="value") return `<td class="val${NP.test(b.value)?" np":""}">${esc(b.value)}</td>`;
      return `<td dir="auto">${esc(b[k])}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="legend">Numbers are not comparable across rows unless the test set matches — each vendor/author used a different evaluation set. WER/CER: lower is better; COMET: higher is better.</p>`;
  }
  function renderBench(sec){
    const list = entriesFor(sec.id);
    const html = `<section id="${sec.id}"><div class="sec-head"><div><h2>${esc(sec.title)}</h2><p>${esc(sec.blurb)}</p></div></div>
      <div class="callout"><h3>State of play (checked ${esc(D.generated)})</h3>
      <p><b>No public Yiddish ASR or TTS leaderboard exists on Hugging Face.</b> The only Yiddish benchmark suite found is <a href="https://huggingface.co/datasets/Yiddish-NLP/Kashes" target="_blank" rel="noopener">Kashes</a> (text: MT, POS, NER, QA…). ivrit.ai's Hebrew transcription leaderboard and Hebrew TTS arena are ready-made templates.</p>
      <p>Published Yiddish ASR numbers are sparse and use incompatible test sets; no commercial Yiddish speech vendor publishes WER/CER, and no Yiddish TTS system publishes MOS.</p></div>
      ${benchTable()}
      <h3 class="subcat">Benchmark resources</h3><div class="grid">${list.map(card).join("")}</div></section>`;
    return {html, n:list.length + D.benchmarks.length};
  }

  // ---------- people ----------
  function renderPeople(sec){
    let ppl = D.people;
    if (state.q){ const t=state.q.toLowerCase().split(/\s+/); ppl = ppl.filter(p => { const h=[p.name,p.role,p.works_on,p.fit,...p.links].join(" ").toLowerCase(); return t.every(x=>h.includes(x)); }); }
    const speech = ppl.filter(p=>p.speech), other = ppl.filter(p=>!p.speech);
    const pc = p => `<article class="card${p.existing?" own":""}"><h4>${esc(p.name)}</h4><div class="by">${esc(p.role)}</div>
      <div class="badges">${p.speech?'<span class="badge oss">speech (TTS/ASR)</span>':'<span class="badge">text / NLP / OCR</span>'}${p.existing?'<span class="badge own">already collaborating</span>':""}</div>
      <p class="desc">${esc(p.works_on)}</p><dl class="kv"><dt>Fit</dt><dd>${esc(p.fit)}</dd></dl>
      <div class="links sources">${srcLinks(p.links)}</div></article>`;
    const html = `<section id="${sec.id}" class="people"><div class="sec-head"><div><h2>${esc(sec.title)}</h2><p>${esc(sec.blurb)}</p></div><span class="meta">${ppl.length} people/orgs</span></div>
      <div class="callout"><h3>Collaborators wanted: open-source Yiddish TTS</h3>
      <p>We are building an open Yiddish text-to-speech stack aimed at a <b>NotebookLM-style Yiddish podcast generator</b> (two natural voices discussing a document), plus Yiddish ASR to evaluate it. Most needed: Hasidic-accent speech data and speakers, G2P / loshn-koydesh pronunciation expertise, TTS model training (VibeVoice, F5, Chatterbox, Piper), and help setting up a public Yiddish ASR/TTS benchmark modelled on ivrit.ai's leaderboards.</p>
      <p>If you work on Yiddish speech, see the README's “Contribute” section. Only public profile links are listed below; reach people through the channels they publish.</p></div>
      <h3 class="subcat">Speech (TTS / ASR)</h3><div class="grid">${speech.map(pc).join("")||'<p class="empty">No match.</p>'}</div>
      <h3 class="subcat">Text, NLP & OCR</h3><div class="grid">${other.map(pc).join("")||'<p class="empty">No match.</p>'}</div></section>`;
    return {html, n:ppl.length};
  }

  function render(){
    const secs = D.sections[state.tab];
    const parts = secs.map(s => s.id==="yi-bench" ? renderBench(s) : s.id==="yi-people" ? renderPeople(s) : renderEntriesSection(s));
    $("#main").innerHTML = parts.map(p=>p.html).join("");
    const nav = secs.map((s,i) => {
      let sub = "";
      if (s.id==="yi-other"){ const g={}; entriesFor(s.id).forEach(e=>g[e.subcat||""]=(g[e.subcat||""]||0)+1);
        sub = SUBCAT_ORDER.filter(k=>g[k]).map(k=>`<a class="sub" href="#${s.id}-${slug(k)}">${esc(k||"Other")}<span class="count">${g[k]}</span></a>`).join(""); }
      return `<a href="#${s.id}" data-sec="${s.id}">${esc(s.title)}<span class="count">${parts[i].n}</span></a>${sub}`;
    }).join("");
    $("#section-nav").innerHTML = nav;
    document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.tab===state.tab));
    const total = D.entries.length;
    $("#meta").textContent = `${total} entries · ${D.benchmarks.length} benchmark rows · ${D.people.length} people/orgs · ${Object.keys(D.link_checks||{}).length} links checked`;
    bindDynamic(); spy();
  }

  function bindDynamic(){
    document.querySelectorAll("[data-btype]").forEach(b => b.onclick = () => { state.benchType=b.dataset.btype; keepScroll(render); });
    document.querySelectorAll("#bench th").forEach(th => th.onclick = () => {
      const c = th.dataset.col; state.sort = {col:c, dir: state.sort.col===c ? -state.sort.dir : 1}; keepScroll(render); });
  }
  function keepScroll(fn){ const y = window.scrollY; fn(); window.scrollTo(0,y); }

  let observer;
  function spy(){
    if (observer) observer.disconnect();
    const links = [...document.querySelectorAll("#section-nav a[data-sec]")];
    observer = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting){ links.forEach(l=>l.classList.toggle("active", l.dataset.sec===en.target.id)); } }), {rootMargin:"-20% 0px -70% 0px"});
    document.querySelectorAll("main section").forEach(s => observer.observe(s));
  }

  function setTab(tab, push=true){
    state.tab = tab; render();
    if (push) history.replaceState(null,"","#"+tab);
    window.scrollTo(0,0);
  }
  document.querySelectorAll(".tab").forEach(t => t.onclick = () => setTab(t.dataset.tab));
  let deb; $("#q").addEventListener("input", e => { clearTimeout(deb); deb = setTimeout(()=>{ state.q = e.target.value.trim(); render(); }, 120); });
  $("#f-status").onchange = e => { state.status = e.target.value; render(); };
  $("#f-oss").onchange = e => { state.oss = e.target.value; render(); };
  $("#f-hasidic").onchange = e => { state.hasidic = e.target.checked; render(); };
  $("#gen").textContent = D.generated;

  // initial route: #yiddish, #torah, or a section id
  const h = location.hash.slice(1);
  const secTab = Object.entries(D.sections).find(([t,ss]) => ss.some(s => h.startsWith(s.id)));
  state.tab = (h==="yiddish"||h==="torah") ? h : secTab ? secTab[0] : "torah";
  render();
  if (secTab){ const go=()=>{ const el=document.getElementById(h); if (el) el.scrollIntoView(); }; requestAnimationFrame(go); (document.fonts?document.fonts.ready:Promise.resolve()).then(()=>setTimeout(go,50)); }
})();
