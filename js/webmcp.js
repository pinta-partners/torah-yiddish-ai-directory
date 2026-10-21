/* WebMCP tools for the Torah + Yiddish AI Directory.
   Spec: https://github.com/webmachinelearning/webmcp (W3C Web Machine Learning CG draft):
     document.modelContext.registerTool({name, title, description, inputSchema, annotations, execute}, {signal})
   Tools return plain JSON objects (the spec serialises the result to JSON for the agent).
   Feature detection: native document.modelContext is used when present (Chrome/Edge origin trial or
   the about:flags "WebMCP for testing" flag). An older experimental navigator.modelContext is also accepted.
   Otherwise the vendored MCP-B polyfill (@mcp-b/global 6.0.3, MIT) is loaded lazily so MCP-B
   extension / in-page agents can still use the tools. If anything fails, the page keeps working. */
(function(){
  "use strict";
  const T = window.TYD; if (!T) return;
  const D = T.data;
  const pageUrl = id => location.origin + location.pathname + (id ? "#" + id : "");
  const CANONICAL = "https://pinta-partners.github.io/torah-yiddish-ai-directory/";
  const TABS = ["torah","yiddish"];
  const SECTION_IDS = Object.keys(T.sectionTab);
  const SUBCATS = T.subcatOrder.filter(Boolean);
  const STATUSES = ["active","beta","archived"];
  const OSS = ["yes","partial","no"];
  const KINDS = ["product","builder","all"];
  const TASKS = {asr:"ASR", tts:"TTS", ocr:"OCR", translation:"MT/LLM", mt:"MT/LLM", llm:"MT/LLM", "mt/llm":"MT/LLM"};

  // ---------- shaping helpers ----------
  const tabsOf = e => [...new Set(e.sections.map(s => T.sectionTab[s]))];
  function linkStatus(u){ const c = (D.link_checks||{})[u]; return c ? {url:u, http_status:c.code, checked:c.checked, ok: T.linkOk(u)} : {url:u, http_status:null, checked:null, ok:null}; }
  function summary(e){
    return {id:e.id, name:e.name, name_native:e.name_native||undefined, plain:e.plain||undefined, by:e.by, category:e.category, tab:tabsOf(e)[0], sections:e.sections,
      subcategory:e.subcat||undefined, kind:e.kind, kind_label:e.kind==="product"?"Ready-to-use app":"For builders (code, models, data, research)", cost:e.cost||undefined, status:e.status, open_source:e.open_source, dialect:e.dialect||undefined, metrics:e.metrics||undefined,
      unverified:e.unverified||undefined, url:e.url, repo:e.repo||undefined, description:e.description, page_url:pageUrl("e-"+e.id)};
  }
  function full(e){
    return Object.assign(summary(e), {kind_note:e.kind_note||undefined, license:e.license||undefined, notes:e.notes||undefined,
      section_titles:e.sections.map(s => T.sectionById[s].title), sources:(e.sources||[e.url]).map(linkStatus), checked:D.generated});
  }
  const strip = o => JSON.parse(JSON.stringify(o)); // drop undefined keys
  const err = (message, extra) => strip(Object.assign({error:message}, extra||{}));
  const normEnum = (v, list) => v == null || v === "" || v === "any" ? "" : String(v).toLowerCase().trim();
  function resolveSection(s){
    if (!s) return {};
    const k = String(s).toLowerCase().trim();
    if (T.sectionTab[k]) return {section:k};
    const bySub = SUBCATS.find(x => x.toLowerCase()===k || T.slug(x)===k || "yi-other-"+T.slug(x)===k);
    if (bySub) return {section:"yi-other", subcat:bySub};
    const byTitle = SECTION_IDS.find(id => T.sectionById[id].title.toLowerCase().includes(k));
    if (byTitle) return {section:byTitle};
    return {bad:true};
  }
  function findEntry(q){
    const k = String(q||"").trim().toLowerCase().replace(/^e-/,"");
    if (!k) return {matches:[]};
    const exact = D.entries.find(e => e.id===k) || D.entries.find(e => e.name.toLowerCase()===k || (e.name_native||"")===q.trim());
    if (exact) return {entry:exact};
    const t = k.split(/\s+/);
    const m = D.entries.filter(e => { const h=(e.id+" "+e.name+" "+(e.name_native||"")+" "+e.by).toLowerCase(); return t.every(x=>h.includes(x)); });
    return m.length===1 ? {entry:m[0]} : {matches:m};
  }

  // ---------- tools ----------
  const tools = [
  {
    name:"search_directory",
    title:"Search the Torah + Yiddish AI directory",
    description:"Search the sourced directory of AI tools for Torah study and for the Yiddish language (AI search & Q&A, seforim libraries, typesetting/nikud/OCR, Yiddish writing, translation, TTS, ASR, OCR, datasets, models, community, benchmark resources). Every entry has a kind: 'product' (a ready-to-use app, website or service a non-programmer can use, free or paid) or 'builder' (code, models, datasets, benchmarks or research for developers); filter with kind. Returns matching entries with id, name, plain description, kind, cost (free/paid note), organisation, status, open-source status, dialect, URL and a deep link. All query words must match. Use get_entry for full details and sources. Set apply_to_page=true to also show these filters in the visible page.",
    inputSchema:{type:"object", properties:{
      query:{type:"string", description:"Free-text words to match against name, organisation, category, description, dialect, metrics and notes, e.g. 'nikud', 'whisper', 'Hasidic TTS'. Empty = all entries."},
      tab:{type:"string", enum:TABS, description:"Restrict to the 'torah' or 'yiddish' half of the directory."},
      kind:{type:"string", enum:KINDS, description:"'product' = ready-to-use apps and services; 'builder' = code, models, data and research; 'all' (default) = both."},
      section:{type:"string", description:"Restrict to a section id (see list_sections), e.g. 'torah-search', 'torah-libraries', 'torah-typesetting', 'yi-writing', 'yi-translation', 'yi-other', 'yi-bench'; or a Yiddish sub-category: 'TTS', 'ASR', 'OCR & HTR', 'Datasets & corpora', 'Models & LLMs', 'Community & orgs'."},
      open_source:{type:"string", enum:OSS, description:"'yes' = open source, 'partial' = partly open, 'no' = closed."},
      status:{type:"string", enum:STATUSES, description:"Project status."},
      dialect:{type:"string", description:"Dialect filter. 'hasidic' matches Hasidic/heimish/Chabad-relevant entries; any other text is matched against the entry's dialect note (e.g. 'YIVO', 'Litvish')."},
      limit:{type:"integer", minimum:1, maximum:200, description:"Maximum number of entries to return (default 25)."},
      apply_to_page:{type:"boolean", description:"If true, also apply query/status/open_source/hasidic filters to the visible page so the user sees the same results."}
    }},
    annotations:{readOnlyHint:true},
    execute(a){
      a = a || {};
      const f = {q:a.query||"", status:normEnum(a.status), oss:normEnum(a.open_source), tab:normEnum(a.tab), kind:normEnum(a.kind)};
      if (f.kind && !KINDS.includes(f.kind)) return err(`kind must be one of ${KINDS.join(", ")}`);
      if (f.status && !STATUSES.includes(f.status)) return err(`status must be one of ${STATUSES.join(", ")}`);
      if (f.oss && !OSS.includes(f.oss)) return err(`open_source must be one of ${OSS.join(", ")}`);
      if (f.tab && !TABS.includes(f.tab)) return err("tab must be 'torah' or 'yiddish'");
      if (a.dialect){ if (/^hasid/i.test(a.dialect)) f.hasidic = true; else f.dialect = a.dialect; }
      const sec = resolveSection(a.section);
      if (sec.bad) return err(`Unknown section '${a.section}'.`, {valid_sections:SECTION_IDS, valid_subcategories:SUBCATS});
      Object.assign(f, sec);
      const limit = Math.max(1, Math.min(200, parseInt(a.limit,10) || 25));
      const all = D.entries.filter(e => T.entryMatches(e, f));
      const out = {query:a.query||"", filters:strip({tab:f.tab||undefined, kind:f.kind||undefined, section:f.section, subcategory:f.subcat, open_source:f.oss||undefined, status:f.status||undefined, dialect:a.dialect||undefined}),
        total_matches:all.length, returned:Math.min(limit, all.length), entries:all.slice(0,limit).map(summary)};
      if (f.q){ out.also_matching = {benchmark_rows: D.benchmarks.filter(b => T.benchMatch(b,{q:f.q})).length, people: D.people.filter(p => T.peopleMatch(p,f.q)).length,
        hint:"Use get_benchmarks(query) or list_collaborators(query) to see those."}; }
      if (a.apply_to_page) out.page = T.applyFilters({q:f.q, status:f.status, oss:f.oss, hasidic:!!f.hasidic, kind:f.kind||undefined, tab:f.tab || (f.section ? T.sectionTab[f.section] : undefined)});
      return strip(out);
    }
  },
  {
    name:"list_sections",
    title:"List directory tabs and sections",
    description:"List the two tabs (Torah, Yiddish) plus the 'All tools' list view, the two kinds of entry (ready-to-use apps vs tools for builders), their sections with ids, titles, descriptions and entry counts, the Yiddish sub-categories (TTS, ASR, OCR & HTR, datasets, models, community), and dataset totals. Use the ids with search_directory or navigate_to_section.",
    inputSchema:{type:"object", properties:{}},
    annotations:{readOnlyHint:true},
    execute(){
      const tabs = TABS.map(t => ({tab:t, page_url:pageUrl(t), sections:D.sections[t].map(s => {
        const o = {id:s.id, title:s.title, label:s.label, description:s.blurb, plain_description:s.plain, entries:D.entries.filter(e=>e.sections.includes(s.id)).length, ready_to_use_apps:D.entries.filter(e=>e.sections.includes(s.id) && e.kind==="product").length, page_url:pageUrl(s.id)};
        if (s.id==="yi-other"){ o.subcategories = SUBCATS.map(k => ({name:k, id:"yi-other-"+T.slug(k), entries:D.entries.filter(e=>e.sections.includes("yi-other") && e.subcat===k).length})); }
        if (s.id==="yi-bench") o.benchmark_rows = D.benchmarks.length;
        if (s.id==="yi-people") o.people = D.people.length;
        return o; })}));
      return {title:"Torah + Yiddish AI Directory", canonical_url:CANONICAL, data_checked:D.generated,
        kinds:{product:"Ready-to-use app, website or service a non-programmer can use (free or paid)", builder:"Code, AI models, datasets, benchmarks or research for developers"},
        all_tools_list:pageUrl("all"),
        totals:{entries:D.entries.length, ready_to_use_apps:D.entries.filter(e=>e.kind==="product").length, for_builders:D.entries.filter(e=>e.kind==="builder").length, benchmark_rows:D.benchmarks.length, people:D.people.length, links_checked:Object.keys(D.link_checks||{}).length},
        data_api:pageUrl("").replace(/#$/,"").replace(/index\.html$/,"") + "data.json", tabs};
    }
  },
  {
    name:"get_entry",
    title:"Get one directory entry with sources",
    description:"Get the full record for one directory entry by its id (e.g. 'dicta-iluy') or name (e.g. 'Sefaria Library Assistant'), including description, status, open-source status, repo, license, dialect, published metrics, notes and every source URL with its last link-check result. If the name is ambiguous, returns candidate ids.",
    inputSchema:{type:"object", properties:{
      id_or_name:{type:"string", description:"Entry id (from search_directory) or full/partial entry name."}
    }, required:["id_or_name"]},
    annotations:{readOnlyHint:true},
    execute(a){
      const q = a && (a.id_or_name || a.id || a.name);
      if (!q) return err("Provide id_or_name.");
      const r = findEntry(q);
      if (r.entry) return strip(full(r.entry));
      if (r.matches.length) return {error:`'${q}' matches ${r.matches.length} entries; call again with one id.`, candidates:r.matches.slice(0,20).map(e=>({id:e.id, name:e.name, tab:tabsOf(e)[0]}))};
      return err(`No entry found for '${q}'. Try search_directory.`);
    }
  },
  {
    name:"get_benchmarks",
    title:"Get Yiddish AI benchmark rows",
    description:"Return rows of the Yiddish benchmark comparison table: published metrics (WER/CER for ASR, CER for OCR, COMET for translation/LLM, listening tests for TTS) per system, with access type, Yiddish support, dialect, test set and source URL. 'not published' means no public number exists. Numbers are only comparable when the test set matches. Optionally filter by task and sort by the numeric value.",
    inputSchema:{type:"object", properties:{
      task:{type:"string", enum:["asr","tts","translation","llm","ocr","all"], description:"Task to filter by: asr (speech recognition), tts (text-to-speech), translation or llm (machine translation / language models), ocr. Default all."},
      query:{type:"string", description:"Optional free-text filter over all columns, e.g. 'whisper', 'Hasidic', 'FLORES'."},
      published_only:{type:"boolean", description:"If true, only return rows that have a published numeric value."},
      sort_by_value:{type:"string", enum:["asc","desc"], description:"Sort by the first number in the published value (rows without a number go last)."},
      show_in_page:{type:"boolean", description:"If true, switch the visible page to the benchmark table with this task filter."}
    }},
    annotations:{readOnlyHint:true},
    execute(a){
      a = a || {};
      const task = String(a.task||"all").toLowerCase();
      const type = task==="all" ? "All" : TASKS[task];
      if (!type) return err("task must be one of asr, tts, translation, llm, ocr, all");
      let rows = D.benchmarks.filter(b => T.benchMatch(b, {type, q:a.query||""}));
      if (a.published_only) rows = rows.filter(b => T.numOf(b.value) !== null);
      if (a.sort_by_value){ const dir = a.sort_by_value==="desc" ? -1 : 1; rows = rows.slice().sort((x,y)=>{ const p=T.numOf(x.value), q=T.numOf(y.value); if(p===null&&q===null) return 0; if(p===null) return 1; if(q===null) return -1; return (p-q)*dir; }); }
      if (a.show_in_page){ T.navigate("yi-bench"); const chip = document.querySelector(`[data-btype="${type}"]`); if (chip) chip.click(); }
      return {task:type, rows_returned:rows.length, total_rows:D.benchmarks.length, checked:D.generated,
        caveat:"Numbers are not comparable across rows unless the test set matches. WER/CER: lower is better; COMET: higher is better. No public Yiddish ASR or TTS leaderboard exists.",
        rows:rows.map(b => ({task:b.type, system:b.system, access:b.access, yiddish_support:b.yi, dialect:b.dialect, metric:b.metric, value:b.value, numeric_value:T.numOf(b.value), published:T.numOf(b.value)!==null, test_set:b.test, source:b.source, source_link_ok:T.linkOk(b.source)})),
        page_url:pageUrl("yi-bench")};
    }
  },
  {
    name:"list_collaborators",
    title:"List people & orgs working on Yiddish speech/NLP",
    description:"List the public profiles of people and organisations working on Yiddish speech (TTS/ASR) and text/NLP/OCR, with what they work on, why they fit the open-source Yiddish TTS effort, and public links only. Also returns what help the Yiddish TTS project is looking for.",
    inputSchema:{type:"object", properties:{
      focus:{type:"string", enum:["speech","text","all"], description:"'speech' = TTS/ASR people, 'text' = NLP/OCR/LLM people, 'all' (default)."},
      query:{type:"string", description:"Optional free-text filter, e.g. 'Whisper', 'OCR', 'Hasidic'."}
    }},
    annotations:{readOnlyHint:true},
    execute(a){
      a = a || {};
      const focus = String(a.focus||"all").toLowerCase();
      if (!["speech","text","all"].includes(focus)) return err("focus must be speech, text or all");
      const ppl = D.people.filter(p => (focus==="all" || (focus==="speech") === !!p.speech) && T.peopleMatch(p, a.query||""));
      return {focus, count:ppl.length,
        collaborators_wanted:{project:"Open-source Yiddish text-to-speech for a NotebookLM-style Yiddish podcast generator, plus Yiddish ASR to evaluate it.",
          most_needed:["Hasidic-accent speech data and speakers","G2P / loshn-koydesh pronunciation expertise","TTS model training (VibeVoice, F5, Chatterbox, Piper)","Help setting up a public Yiddish ASR/TTS benchmark modelled on ivrit.ai's leaderboards"],
          how_to_help:"Open an issue or PR on https://github.com/pinta-partners/torah-yiddish-ai-directory (see the README's Contribute section)."},
        people:ppl.map(p => ({name:p.name, role:p.role, works_on:p.works_on, plain:p.plain, fit:p.fit, focus:p.speech?"speech":"text", already_collaborating:!!p.existing, public_links:p.links})),
        note:"Public profile links only; reach people through the channels they publish.", page_url:pageUrl("yi-people")};
    }
  },
  {
    name:"switch_tab",
    title:"Switch the visible tab",
    description:"Switch the page between the Torah tab (AI search & Q&A, AI libraries, typesetting/nikud/OCR), the Yiddish tab (writing, translation, speech/OCR/data/models/community, benchmarks, people & collaborators) and the 'All tools' list (every entry in one table, grouped into ready-to-use apps and tools for builders). Optionally also choose which kind of tools to show. Changes what the user sees.",
    inputSchema:{type:"object", properties:{ tab:{type:"string", enum:[...TABS, "all"], description:"'torah', 'yiddish' or 'all' (the All tools list)."}, kind:{type:"string", enum:KINDS, description:"Optional: 'product' (ready-to-use apps, the default in the Torah/Yiddish tabs), 'builder' (code & models) or 'all'."} }, required:["tab"]},
    annotations:{readOnlyHint:false},
    execute(a){
      const tab = String(a && a.tab || "").toLowerCase();
      const r = T.setTab(tab);
      if (!r.ok) return err(r.error);
      const kind = a && a.kind ? String(a.kind).toLowerCase() : "";
      if (kind){ const k = T.setKind(kind); if (!k.ok) return err(k.error); }
      const v = T.viewSummary();
      return {ok:true, tab, kind:v.kind, visible_sections:v.sections.map(s=>({id:s.id, title:s.title, visible_entries:s.visible_entries})), page_url:pageUrl(tab)};
    }
  },
  {
    name:"navigate_to_section",
    title:"Scroll the page to a section or entry",
    description:"Show a section, Yiddish sub-category or single entry to the user: switches to the right tab, clears filters if they would hide the target, scrolls to it and updates the URL. Accepts section ids (e.g. 'yi-bench', 'yi-people', 'torah-typesetting'), sub-category ids (e.g. 'yi-other-tts', 'yi-other-asr') entry ids from search_directory (e.g. 'dicta-iluy'), 'all' for the All tools list, or 'all-products' / 'all-builders' for its two groups. Switches the kind filter if it would hide the target.",
    inputSchema:{type:"object", properties:{ target:{type:"string", description:"Section id, sub-category id, or entry id."} }, required:["target"]},
    annotations:{readOnlyHint:false},
    execute(a){
      let t = String(a && (a.target || a.section_id || a.section) || "").trim();
      if (!t) return err("Provide target.");
      const listTarget = /^(all|all-products|all-builders)$/i.test(t); if (listTarget) t = t.toLowerCase();
      const sec = listTarget ? {bad:true} : resolveSection(t); if (!sec.bad && !T.sectionTab[t]) t = sec.subcat ? "yi-other-"+T.slug(sec.subcat) : sec.section;
      if (!listTarget && !document.getElementById(t) && !T.sectionTab[t] && !/^yi-other-|^yi-bench-|^yi-people-/.test(t)){ const r = findEntry(t); if (r.entry) t = "e-"+r.entry.id; }
      const r = T.navigate(t);
      return r.ok ? {ok:true, tab:r.tab, target:r.id, found:r.found, page_url:pageUrl(r.id)} : err(r.error, {valid_sections:SECTION_IDS});
    }
  }];

  // ---------- registration ----------
  const status = document.getElementById("webmcp-status");
  const setStatus = (txt, on) => { if (status){ status.textContent = txt; status.classList.toggle("on", !!on); } };
  const reg = {mode:null, registered:[], errors:[]};
  window.TYD_WEBMCP = {tools, state:reg,
    /** Call a tool directly (handy for tests and in-page agents without WebMCP). */
    call: async (name, args) => { const t = tools.find(x=>x.name===name); if (!t) throw new Error("No tool "+name); return t.execute(args||{}, {signal:new AbortController().signal}); }};

  function wrap(t){ return Object.assign({}, t, { execute: async (args, opts) => { try { return await t.execute(args || {}, opts); } catch(e){ return err(String(e && e.message || e)); } } }); }

  async function registerWith(ctx, mode){
    reg.mode = mode;
    if (typeof ctx.registerTool === "function"){
      const ac = new AbortController(); reg.abort = () => ac.abort();
      for (const t of tools){
        try { await ctx.registerTool(wrap(t), {signal: ac.signal}); reg.registered.push(t.name); }
        catch(e){ reg.errors.push(t.name+": "+(e && e.message || e)); }
      }
    } else if (typeof ctx.provideContext === "function"){ // early experimental shape
      try { ctx.provideContext({tools: tools.map(wrap)}); reg.registered = tools.map(t=>t.name); } catch(e){ reg.errors.push(String(e)); }
    }
    const n = reg.registered.length;
    setStatus(n ? `${n} tools registered (${mode})` : "not available in this browser", n > 0);
    document.dispatchEvent(new CustomEvent("tyd:webmcp", {detail:{mode, registered:reg.registered.slice(), errors:reg.errors.slice()}}));
  }
  const nativeCtx = () => (document.modelContext && (document.modelContext.registerTool || document.modelContext.provideContext)) ? document.modelContext
    : (navigator.modelContext && (navigator.modelContext.registerTool || navigator.modelContext.provideContext)) ? navigator.modelContext : null;

  function start(){
    const ctx = nativeCtx();
    if (ctx){ registerWith(ctx, ctx === document.modelContext ? "native document.modelContext" : "navigator.modelContext"); return; }
    if (window.__TYD_NO_POLYFILL){ setStatus("not available in this browser", false); return; }
    // No native WebMCP: load the vendored MCP-B polyfill after the page has rendered.
    const s = document.createElement("script");
    s.src = "vendor/mcp-b-global-6.0.3.iife.js"; s.async = true;
    s.onload = () => { const c = nativeCtx(); if (c) registerWith(c, "MCP-B polyfill"); else setStatus("not available in this browser", false); };
    s.onerror = () => setStatus("not available in this browser", false);
    document.head.appendChild(s);
  }
  if (document.readyState === "complete") setTimeout(start, 0); else window.addEventListener("load", () => setTimeout(start, 0));
})();
