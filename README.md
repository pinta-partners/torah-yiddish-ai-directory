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
index.html            page shell (tabs, sidebar filters, section nav)
css/style.css         styles (RTL-aware, responsive)
js/app.js             rendering, search/filter, hash routing, sortable benchmark table
data.js               window.DIRECTORY_DATA = {...}  (generated; loaded by index.html)
data.json             same data as JSON (generated)
tools/build_data.py   SOURCE OF TRUTH: entries, benchmark rows, people -> data.json + data.js
tools/verify_links.py checks every URL with curl, records status in link_checks
screenshot.png        headless-Chrome screenshot of the Yiddish tab
```

There's no build step for the site itself. Open `index.html` directly, or serve it with
`python3 -m http.server` and go to http://localhost:8000/.

Tabs:
- **Torah:** AI search & Q&A · AI-assisted libraries · typesetting, nikud & OCR
- **Yiddish:** writing tools · translation · speech/OCR/data/models/community (sub-grouped) ·
  benchmarks (sortable table of published metrics with sources) · people & orgs / collaborators wanted

You can deep-link to a tab or section, e.g. `#yiddish`, `#yi-bench`, `#yi-people`, `#torah-typesetting`.

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
   `verify_links.py` rewrites `data.json`/`data.js` with fresh `link_checks`. Some sites block curl.
   If you have checked a page by hand, add it to the `MANUAL` dict with a note.
3. Open the page and check your entry.

## Deploying to GitHub Pages

Push the folder to a repo, then go to Settings → Pages → "Deploy from a branch" → `main` / root.
All paths are relative, so it also works under `https://<user>.github.io/<repo>/`.
(This repo has only been initialised locally. Nothing has been pushed.)

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
directory once it's public, or reach out through the public profiles linked on my GitHub.
Corrections to any entry are welcome. Please include a source URL.
