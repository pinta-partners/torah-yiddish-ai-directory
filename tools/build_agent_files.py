"""Generate agent-facing files from data.json:
  - the schema.org JSON-LD block (Dataset + ItemList of every entry) inside index.html
  - llms.txt (a plain-text guide to the site and its data for language models)
Run automatically by build_data.py / verify_links.py (via write()), or by hand:
  python3 tools/build_agent_files.py
"""
import json, os, re
SITE = "https://pinta-partners.github.io/torah-yiddish-ai-directory/"
REPO = "https://github.com/pinta-partners/torah-yiddish-ai-directory"

def jsonld(data):
    tab_of = {s["id"]: t for t, ss in data["sections"].items() for s in ss}
    items = []
    for i, e in enumerate(data["entries"], 1):
        thing = {"@type": "SoftwareApplication" if e["category"] and not re.search(r"essay|dataset|corpus|community|org|leaderboard|arena|benchmark|paper|library|index", e["category"], re.I) else "CreativeWork",
                 "name": e["name"], "url": e["url"], "description": e["description"],
                 "author": e["by"]}
        if e.get("name_native"): thing["alternateName"] = e["name_native"]
        thing["additionalProperty"] = [{"@type": "PropertyValue", "name": "kind", "value": "ready-to-use app" if e.get("kind") == "product" else "for builders"},
                                       {"@type": "PropertyValue", "name": "free or paid", "value": e.get("cost", "Not stated")}]
        if e.get("repo"): thing["codeRepository"] = e["repo"]
        if e.get("license"): thing["license"] = e["license"]
        if thing["@type"] == "SoftwareApplication": thing["applicationCategory"] = e["category"]
        else: thing["genre"] = e["category"]
        items.append({"@type": "ListItem", "position": i, "url": SITE + "#e-" + e["id"], "item": thing})
    graph = [
      {"@type": "WebSite", "@id": SITE + "#website", "name": "Torah + Yiddish AI Directory", "url": SITE,
       "description": "A sourced directory of AI tools for Torah study and for the Yiddish language.", "inLanguage": ["en", "yi", "he"]},
      {"@type": "Dataset", "@id": SITE + "#dataset", "name": "Torah + Yiddish AI Directory data",
       "description": f"{len(data['entries'])} sourced entries on AI for Torah study and for Yiddish (search, libraries, typesetting/nikud/OCR, writing, translation, TTS, ASR, OCR, datasets, models, community), {len(data['benchmarks'])} published Yiddish benchmark rows and {len(data['people'])} people/orgs. Every entry links to the source where it was verified.",
       "url": SITE, "sameAs": REPO, "dateModified": data["generated"], "isAccessibleForFree": True,
       "keywords": ["Torah", "Yiddish", "AI", "text-to-speech", "speech recognition", "OCR", "machine translation", "nikud", "benchmarks"],
       "creator": {"@type": "Person", "name": "Chezky Kohn"},
       "distribution": [{"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": SITE + "data.json"},
                        {"@type": "DataDownload", "encodingFormat": "text/plain", "contentUrl": SITE + "llms.txt"}]},
      {"@type": "ItemList", "@id": SITE + "#entries", "name": "Torah + Yiddish AI tools and resources", "numberOfItems": len(items), "itemListElement": items},
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, separators=(",", ":"))

def llms_txt(data):
    secs = data["sections"]
    count = lambda sid: sum(1 for e in data["entries"] if sid in e["sections"])
    lines = [
      "# Torah + Yiddish AI Directory", "",
      f"> A sourced, static directory of AI for Torah study and for the Yiddish language: {len(data['entries'])} entries, "
      f"{len(data['benchmarks'])} published Yiddish benchmark rows and {len(data['people'])} people/orgs working on Yiddish speech & NLP. "
      "Every entry links to the source where it was checked; nothing is invented, and missing metrics are marked \"not published\". "
      f"Data last checked {data['generated']}.", "",
      "The site is maintained by Chezky Kohn, who is building open-source Yiddish text-to-speech (a NotebookLM-style Yiddish podcast generator) "
      "and Yiddish speech recognition. Collaborators are wanted (see the People & orgs section).", "",
      "## Data (stable JSON API)", "",
      f"- [data.json]({SITE}data.json): the whole dataset. Top-level keys: `generated` (date checked), `sections` "
      "(`torah`/`yiddish` -> list of {id,title,blurb}), `entries`, `benchmarks`, `people`, `link_checks` (url -> {code, checked, manual?}).",
      "- Entry fields: id, sections[], name, name_native, url, by, category, description, sources[], status (active|beta|archived), "
      "open_source (yes|partial|no), repo, dialect, metrics, unverified, notes, license, plain (one plain-language sentence shown on the site), "
      "kind (product = ready-to-use app, website or service a non-programmer can use, free or paid | builder = code, models, datasets, benchmarks or research for developers), "
      "kind_note (why a borderline entry got its kind), cost (short free/paid note from the entry's sources, or 'Not stated'), also_subcats (optional: other Yiddish sub-categories the entry also covers, e.g. TTS), subcat (TTS|ASR|OCR & HTR|Datasets & corpora|Models & LLMs|Community & orgs, Yiddish 'other' section only).",
      "- Benchmark fields: type (ASR|TTS|MT/LLM|OCR), system, access, yi (Yiddish support), dialect, metric, value (as published, or 'not published'/'n/a'), test, source.",
      "- People fields: name, role, works_on, plain, links[] (public profiles only), fit, speech (bool), existing (already collaborating).",
      "- Section fields: id, title (technical name), blurb, label (plain name shown on the site), plain (plain intro).",
      f"- Schema.org JSON-LD (Dataset + ItemList) is embedded in [{SITE}]({SITE}).", "",
      "## Sections (deep links)", "",
    ]
    for tab, ss in secs.items():
        for s in ss:
            n = count(s["id"])
            extra = f", {len(data['benchmarks'])} benchmark rows" if s["id"] == "yi-bench" else f", {len(data['people'])} people/orgs" if s["id"] == "yi-people" else ""
            lines.append(f"- [{tab.title()}: {s.get('label', s['title'])}]({SITE}#{s['id']}): {s['title']}. {s['blurb']} ({n} entries{extra})")
    lines += ["", f"- [All tools list]({SITE}#all): every entry in one table (name, plain description, Torah/Yiddish, kind, free or paid, link), "
              f"grouped into ready-to-use apps (`#all-products`) and tools for builders (`#all-builders`)."]
    lines += ["", "Any entry can be linked as `#e-<entry id>`; Yiddish sub-categories as `#yi-other-tts`, `#yi-other-asr`, `#yi-other-ocr-htr`, "
              "`#yi-other-datasets-corpora`, `#yi-other-models-llms`, `#yi-other-community-orgs`.", "",
      "## Ready-to-use apps (kind = product)", ""]
    for tab, ss in secs.items():
        ids = {s["id"] for s in ss}
        prods = [e for e in data["entries"] if e.get("kind") == "product" and ids & set(e["sections"])]
        lines.append(f"### {tab.title()} ({len(prods)})")
        lines += [f"- [{e['name']}]({e['url']}): {e['plain']} ({e['cost']})" for e in prods]
        lines.append("")
    nb = sum(1 for e in data["entries"] if e.get("kind") == "builder")
    lines += [f"The other {nb} entries are tools for builders (code, models, data, research); see data.json or `search_directory(kind='builder')`.", "",
      "## WebMCP tools (for in-browser agents)", "",
      "The page registers WebMCP tools with `document.modelContext.registerTool()` (W3C Web Machine Learning CG draft, "
      "https://github.com/webmachinelearning/webmcp). In browsers without native WebMCP it loads the MCP-B polyfill (@mcp-b/global). All tools return JSON.", "",
      "- `search_directory(query?, tab?, kind?, section?, open_source?, status?, dialect?, limit?, apply_to_page?)`: search entries; kind = product|builder|all; results include kind and cost.",
      "- `list_sections()`: tabs, sections, sub-categories and counts.",
      "- `get_entry(id_or_name)`: one full entry with sources and link-check results.",
      "- `get_benchmarks(task?, query?, published_only?, sort_by_value?, show_in_page?)`: Yiddish benchmark rows (asr|tts|translation|llm|ocr|all).",
      "- `list_collaborators(focus?, query?)`: people & orgs (speech|text|all) plus what help is wanted.",
      "- `switch_tab(tab, kind?)` (tab = torah|yiddish|all), `navigate_to_section(target)`: change what the user sees.",
      "- Declarative form tool `filter_directory_view` (the sidebar search form: q, status, open_source, hasidic).", "",
      "## Notes for agents", "",
      "- Metrics are copied as published. Benchmark numbers are only comparable when the test set matches.",
      "- No public Yiddish ASR or TTS leaderboard exists as of the check date.",
      "- Only public information is listed. Do not infer private contact details for people.",
      f"- Source code, corrections and contributions: {REPO}", ""]
    return "\n".join(lines)

def build(base, data):
    p = os.path.join(base, "index.html")
    html = open(p, encoding="utf-8").read()
    block = '<!-- JSONLD:START (generated by tools/build_agent_files.py) -->\n<script type="application/ld+json">' + jsonld(data).replace("</", "<\\/") + '</script>\n<!-- JSONLD:END -->'
    html2 = re.sub(r"<!-- JSONLD:START.*?<!-- JSONLD:END -->", lambda m: block, html, flags=re.S)
    if html2 != html: open(p, "w", encoding="utf-8").write(html2)
    open(os.path.join(base, "llms.txt"), "w", encoding="utf-8").write(llms_txt(data))

if __name__ == "__main__":
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    build(base, json.load(open(os.path.join(base, "data.json"), encoding="utf-8")))
    print("wrote JSON-LD into index.html and llms.txt")
