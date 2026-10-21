# Torah + Yiddish AI Directory

A static, sourced map of AI tools for **Torah study** and for **Yiddish** (writing, translation,
speech, OCR, datasets, models, benchmarks), plus a list of people and orgs working on Yiddish
speech/NLP who might want to collaborate.

**Ground rules:** every entry links to a source that was actually fetched and checked
(curl or WebFetch, see `link_checks` in `data.json`). Nothing is invented. If a metric isn't
published, the site says "not published". Anything unclear carries an **unverified / unclear** badge.
Only public information is listed, with no private contact details.

## Structure

```
index.html                 page shell: hero, tabs, sidebar filters (also a declarative WebMCP form), JSON-LD
css/style.css              styles: light/dark themes, RTL-aware, responsive, reduced-motion aware
js/app.js                  rendering, search/filter, hash routing + deep links, sortable benchmark table, theme
js/webmcp.js               WebMCP tools (document.modelContext.registerTool) for in-browser AI agents
vendor/mcp-b-global-6.0.3.iife.js   MCP-B WebMCP polyfill (MIT), loaded only when the browser has no native WebMCP
data.js                    window.DIRECTORY_DATA = {...}  (generated; loaded by index.html)
data.json                  same data as JSON (generated): the public, stable data API
llms.txt                   plain-text guide to the site and data for language models (generated)
tools/build_data.py        SOURCE OF TRUTH: entries, benchmark rows, people -> data.json + data.js (+ llms.txt, JSON-LD)
tools/build_agent_files.py writes the schema.org JSON-LD block in index.html and llms.txt from data.json
tools/verify_links.py      checks every URL with curl, records status in link_checks
screenshot.png             headless-Chrome screenshot of the Yiddish tab
```

There's no build step for the site itself. Open `index.html` directly, or serve it with
`python3 -m http.server` and go to http://localhost:8000/.

Tabs:
- **Torah:** AI search & Q&A · AI-assisted libraries · typesetting, nikud & OCR
- **Yiddish:** writing tools · translation · speech/OCR/data/models/community (sub-grouped) ·
  benchmarks (sortable, filterable table of published metrics with sources) · people & orgs / collaborators wanted

Deep links switch to the right tab and scroll to the target, on first load, on `hashchange`, and with back/forward:
`#torah`, `#yiddish`, any section id (`#yi-bench`, `#yi-people`, `#torah-typesetting`, ...), Yiddish sub-categories
(`#yi-other-tts`, `#yi-other-asr`, `#yi-other-ocr-htr`, `#yi-other-datasets-corpora`, `#yi-other-models-llms`,
`#yi-other-community-orgs`) and single entries (`#e-<entry id>`, e.g. `#e-dicta-iluy`).

Two kinds of entry: every entry has `kind` = `product` (a **ready-to-use app**, website or service a
non-programmer can use today, free or paid) or `builder` (**for builders**: code repos, AI models, datasets, libraries,
benchmarks and research). A model with a demo website counts as `builder` unless the website is its main form;
borderline calls carry a `kind_note`. `cost` is a short free/paid note taken from the entry's own sources ("Not stated"
when we could not find one). The Torah and Yiddish tabs open on **Ready-to-use apps**, with a switch to
**For builders: code & models** or **All** (`?kind=builder|all` preselects it). The third tab, **All tools** (`#all`),
is one compact table of every entry (Name, What it does, Torah/Yiddish, Kind, Free or paid, Link), grouped into
`#all-products` and `#all-builders`; the same switch and search filter it. Kinds and prices live in
`tools/build_data.py` (`PRODUCTS`, `KIND_NOTE`); the build fails if an id is unknown.

UI notes: a minimal layout (Inter, plus Noto Sans Hebrew for Hebrew/Yiddish) written in plain language for a general
audience. Section names are everyday words (`label` in `data.json`, e.g. "Ask & search", "Writing help", "How the tools
compare"); the Yiddish speech/scanning/data section is shown as five groups (Read aloud, Transcribe audio, Scanning old
books, Data & models, Community) whose ids are the old sub-category ids, plus `#yi-other-data`. Each card shows the name,
a one-sentence plain description (`plain`) and at most two plain-word tags (Free & open, In testing, Hasidic Yiddish, ...).
The original description, repo, license, dialect, metrics, notes and sources are under **Details**. The comparison table
shows Tool, What it does, Score, Lower or higher is better and Source, with a short "how to read the scores" note; expand
a row for the measure (WER, CER, COMET, ...), access, Yiddish support, dialect and test set. Plain texts live in
`tools/build_data.py` (`SECTION_PLAIN`, `PLAIN`, `PEOPLE_PLAIN`); the build fails if an entry lacks one. Light and dark
themes follow `prefers-color-scheme` until you use the toggle (saved in `localStorage`). The tabs are ARIA tabs (arrow
keys, Home/End). Press `/` to jump to search and `Esc` to clear it.
Deep links to an entry (`#e-<id>`) open its details.

## Adding or editing entries

1. Edit `tools/build_data.py`:
   - Tools go in `ENTRIES`, using `E(id, sections, name, url, by, category, desc, ...)`. Optional
     keyword args are `status` (`active|beta|archived`), `open_source`, `repo`, `dialect`
     (for speech tools: Hasidic vs YIVO/standard, if known), `metrics`, `license`, `sources`,
     `unverified=True`, `notes`, `name_native`, `subcat` (for `yi-other`).
   - Benchmark rows go in `BENCH`. Use `value="not published"` when no number exists.
   - People and orgs go in `PEOPLE`, with public profile links only.
2. Rebuild and re-check links:
   ```
   python3 tools/build_data.py && python3 tools/verify_links.py
   ```
   Both scripts also regenerate `llms.txt` and the JSON-LD block in `index.html`.
   `verify_links.py` rewrites `data.json`/`data.js` with fresh `link_checks`. Some sites block curl.
   If you have checked a page by hand, add it to the `MANUAL` dict with a note.
3. Open the page and check your entry.

## Deploying to GitHub Pages

Push the folder to a repo, then go to Settings → Pages → "Deploy from a branch" → `main` / root.
All paths are relative, so it also works under `https://<user>.github.io/<repo>/`.
Live: https://pinta-partners.github.io/torah-yiddish-ai-directory/ (served from `main`, root; `.nojekyll` is set).

## For developers

Everything a program or AI agent needs: the [data API](#data-api-for-agents-and-scripts) (`data.json`), a plain-text
guide for language models (`llms.txt`), schema.org JSON-LD embedded in the page, and [WebMCP tools](#webmcp-tools-for-ai-agents)
that in-browser AI agents can call. The site's visible text is written for a general audience; each entry's original
technical description, repo, license, metrics and sources are kept in the data and shown under "Details".

## Data API for agents and scripts

- **`data.json`** (https://pinta-partners.github.io/torah-yiddish-ai-directory/data.json) is the stable, public API.
  Top-level keys: `generated`, `sections`, `entries`, `benchmarks`, `people`, `link_checks`. Field names are kept stable;
  new fields may be added. Entry fields: `id, sections[], name, name_native, url, by, category, description, sources[],
  status (active|beta|archived), open_source (yes|partial|no), repo, dialect, metrics, unverified, notes, license, subcat, plain, kind (product|builder), kind_note, cost, also_subcats`.
- **`llms.txt`** describes the site, data fields, deep links and tools in plain text for language models.
- **JSON-LD**: `index.html` embeds schema.org `WebSite` + `Dataset` (with `DataDownload` links) + an `ItemList` of every entry.

## WebMCP tools for AI agents

The page implements [WebMCP](https://github.com/webmachinelearning/webmcp) (W3C Web Machine Learning Community Group
draft), so an AI agent running in the browser can call the site's own functions instead of scraping it.
Following the current draft, tools are registered with
`document.modelContext.registerTool({name, title, description, inputSchema, annotations, execute}, {signal})`, and each
`execute` returns a plain JSON object, which the browser serialises for the agent.

Feature detection in `js/webmcp.js`:
1. If the browser has native `document.modelContext` (the Chrome 149 / Edge 150 origin trials, or Chrome's
   `about:flags#enable-webmcp-testing`), the tools are registered there. An older experimental `navigator.modelContext`
   (`registerTool` or `provideContext`) is also accepted.
2. If not, the vendored [MCP-B](https://docs.mcp-b.ai/) polyfill [`@mcp-b/global` 6.0.3](https://www.npmjs.com/package/@mcp-b/global)
   (MIT) is loaded after page load. It installs `document.modelContext`, so the MCP-B browser extension and in-page agents can
   use the tools.
3. If that fails, nothing breaks. The footer shows the WebMCP status.

| Tool | Inputs (all optional unless noted) | Returns |
|---|---|---|
| `search_directory` | `query`, `tab` (torah\|yiddish), `kind` (product\|builder\|all), `section` (section id or Yiddish sub-category such as `TTS`, `ASR`), `open_source` (yes\|partial\|no), `status` (active\|beta\|archived), `dialect` (`hasidic` or free text such as `YIVO`), `limit`, `apply_to_page` | matching entries (id, name, plain description, kind, cost, org, status, open source, dialect, URL, deep link), plus counts of matching benchmark rows and people |
| `list_sections` | none | tabs, sections, sub-categories, counts, deep links, data API URL |
| `get_entry` | `id_or_name` (required) | the full entry with every source URL and its link-check result, or candidate ids if the name is ambiguous |
| `get_benchmarks` | `task` (asr\|tts\|translation\|llm\|ocr\|all), `query`, `published_only`, `sort_by_value` (asc\|desc), `show_in_page` | benchmark rows with `numeric_value`, the source and the comparability caveat |
| `list_collaborators` | `focus` (speech\|text\|all), `query` | people & orgs (public links only) and what help the Yiddish TTS project needs |
| `switch_tab` | `tab` (required: torah\|yiddish\|all), `kind` (product\|builder\|all) | switches the visible tab (all = the All tools list) and optionally the kind of tools shown |
| `navigate_to_section` | `target` (required): section id, sub-category id or entry id | switches tab, scrolls to the target, updates the URL |

Read-only tools carry `annotations: {readOnlyHint: true}`. Bad arguments return `{error, ...}` with the valid values,
so an agent can retry.

**Declarative tool (proposal).** The sidebar search form carries the
[declarative WebMCP](https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md) attributes
(`toolname="filter_directory_view"`, `tooldescription`, `toolparamdescription`, `toolautosubmit`). On an agent-invoked
submit it calls `SubmitEvent.respondWith()` with a summary of the visible results. The MCP-B polyfill already supports
this; native browsers will pick it up as the proposal lands.

Try it in DevTools (polyfill or native):
```js
const tools = await document.modelContext.getTools();
await document.modelContext.executeTool(tools.find(t => t.name === "get_benchmarks"), {task: "asr", published_only: true});
// or, without WebMCP plumbing:
await TYD_WEBMCP.call("search_directory", {query: "whisper", tab: "yiddish"});
```

## Contribute / collaborate on Yiddish TTS

I'm building **open-source Yiddish text-to-speech** (the goal is a NotebookLM-style Yiddish podcast
generator: natural two-speaker conversation, Hasidic *and* standard/YIVO pronunciation) and
**Yiddish speech recognition**. Today the open landscape is thin. There's REYD (FastSpeech2,
2022), a Piper VITS voice built from it, a few early experiments, and commercial apps that
publish no metrics. There is also **no public Yiddish ASR/TTS leaderboard**.

Help is especially welcome with:
- **Data:** licensed or public-domain Yiddish audio with transcripts, especially Hasidic
  (Satmar/Hungarian, Polish/Central) speakers, multi-speaker conversation, and read seforim/shiurim
- **Text front-end:** Hasidic orthography → phonemes, loshn-koydesh words, nikud/phonikud for Yiddish
- **Modeling:** multi-speaker/expressive TTS, voice cloning, fine-tuning Whisper/w2v-BERT/OmniASR for Yiddish
- **Evaluation:** an open test set and leaderboard (WER/CER for ASR, MOS/intelligibility for TTS),
  modeled on ivrit.ai's Hebrew leaderboards
- **Native-speaker listeners** for MOS tests

If you work in this space (see the "People & orgs" section), open an issue or PR on this
directory, or reach out through the public profiles linked on my GitHub.
Corrections to any entry are welcome. Please include a source URL.
