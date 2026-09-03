# Title

Open Dots

## One-line Summary

An agent-native pixel-art picture-book canvas where children’s story ideas become shared creations: people compose directly, while an in-browser agent uses WebMCP tools to build, inspect, and refine scenes alongside them.

## Problem

Picture-book creation tools tend to force a choice between manual drawing and opaque AI generation. A child or storyteller can describe a rich scene, but an agent usually has to guess through a visual interface or generate a single flat image that is difficult to revise, reuse, or understand.

## Solution

Open Dots gives the human a tactile pixel-book editor and gives an in-browser agent a small, structured WebMCP surface. The person can draw, write pixel text, place shapes, organize pages, and present the book. The agent can read the book state, create reusable sprites, paint them in deliberate passes, stamp them into layered scenes, and inspect PNG results before the next pass.

The result is a collaborative editing loop rather than a prompt-to-image handoff: a person directs the story and art direction; the agent performs precise, inspectable canvas work through `document.modelContext`.

## Why This Matters

Open Dots makes creative software more accessible without taking authorship away from the person making the book. Structured tools let an agent work with the same durable primitives that make revision meaningful—pages, palettes, assets, layers, placements, and pixels—so a creator can keep shaping the result instead of accepting a black-box image.

## How We Used AI

WebMCP is the product capability, not an add-on. An in-browser agent discovers 15 Open Dots tools through `document.modelContext`, then follows a visual creation workflow: load the pixel-art guide, set a named palette, create and refine small assets, compare inline PNG feedback, stamp assets back-to-front, and inspect the composed page.

The tools make the agent’s actions structured and recoverable. Read tools expose the film, asset images, and page images; write tools create pages, assets, palettes, pixels, text, and placements. Mutating asset operations return inline PNG feedback and guidance for the required next comparison pass, helping agents correct work rather than drawing blindly.

## How We Used Codex

Codex was used to implement and iterate on the editor, WebMCP registration layer, validation paths, visual editor workflows, and test documentation. The project’s verification notes record browser checks in Codex’s in-app browser, deterministic WebMCP checks, TypeScript checks, linting, and production builds.

## Key Features

- A light-mode pixel picture-book editor with multiple landscape pages and Present mode.
- Human tools for drawing, erasing, fill, pixel text, shapes, selections, layers, and reusable assets.
- A persistent asset library and movable, layered stamps so agents can compose dense scenes from small reusable sprites.
- Named palette profiles and bulk pixel operations for deliberate outline, fill, shade, and highlight passes.
- 15 WebMCP tools with typed JSON schemas, intent-focused descriptions, and `readOnlyHint` annotations.
- Page-lifetime WebMCP registration that stays stable across React remounts and HMR, avoiding stale agent tool snapshots.
- Inline PNG feedback plus page/asset inspection tools and scene-quality hints for a draw–look–fix loop.
- Deterministic WebMCP tool/eval checks, including schema, validation, error-handling, and tool-coverage checks.

## Architecture

Open Dots is a Next.js and React web application. Film state, pages, layers, palettes, assets, and placements are modeled in the client-side film store and persist in local storage.

`WebMCPBridge` registers the app-wide tool surface through `document.modelContext`. A small compatibility layer provides a spec-shaped API when native WebMCP is unavailable for local inspection. Tool definitions validate inputs, return structured errors, attach read-only/write annotations, and produce text plus PNG image results where visual comparison matters.

## Testing Instructions

Public demo: https://pixel-film-studio.vercel.app

1. Open the URL in ChatGPT’s in-app browser, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.
2. Start with a blank page and ask the agent to create a picture-book scene in Open Dots.
3. Confirm the agent calls `get_pixel_art_guide`, waits for `get_film.webmcp.ready`, defines a palette, creates small assets, refines them using returned PNG feedback, and stamps them into a page.
4. In the human UI, add/select a page, paint or add text, inspect layers, and open Present mode.
5. Reload once, then ask the agent to re-fetch tools and call `get_film`; film data should remain available while the agent refreshes its tool snapshot.

Local checks:

```bash
npm install
npm run test:webmcp
npm run lint
npm run build
```

The WebMCP evaluation runner validates tool schemas, annotations, declared arguments, structured error paths, and eval coverage. Browser verification documented on 2026-09-03 covered WebMCP asset creation and stamping, movable overlays, persistence after reload, editor controls, layers, and Present mode.

## Public Demo Link

https://pixel-film-studio.vercel.app

## Public Repository Link

https://github.com/MichaelHo02/pixel-film-studio

## Demo Video

TODO — record and upload a public YouTube video under three minutes. The video must include audio and clearly show the app working and how WebMCP is used.

Suggested 2:30 outline:

1. 0:00–0:20 — The creative problem: text-only prompting makes a picture book hard to edit together.
2. 0:20–0:45 — Show the human editor: page, pixel text, assets, layers, and Present mode.
3. 0:45–1:45 — In the WebMCP-enabled browser, ask an agent to create a scene. Show tool discovery, palette selection, a small asset, returned PNG feedback, and stamping/composition.
4. 1:45–2:10 — Show the human refining the same book and Present mode reading it.
5. 2:10–2:30 — Explain why structured tools make the agent a collaborative editor rather than an unreliable UI clicker.

## Screenshot Shot List

1. The Open Dots editor with a complete, layered pixel-art page and asset library visible.
2. An agent tool result returning the inline PNG comparison after an asset pass.
3. A composed page showing multiple stamped assets and the page-image inspection output.
4. The layers/inspector view demonstrating that the human can adjust the agent-created composition.
5. Present mode showing the finished picture-book page.

## Submission Readiness Notes

The live demo URL, public GitHub repository, and MIT license are present. The repository documents 15 WebMCP tools and includes a deterministic WebMCP evaluation command. Local/browser verification is documented, but the final public video and final screenshots still need to be captured.

Devpost currently contains an in-progress pre-draft project named “Untitled” for this challenge. Before final review, update it with the title, tagline, full description, technology list, links, and video URL from this draft.

## Known Limitations

- Film data is stored in browser local storage; it is not a multi-user cloud collaboration system.
- A browser refresh invalidates an agent’s previously discovered WebMCP tool handles; the agent must re-fetch tools and wait for readiness.
- The project’s deterministic WebMCP checks are complete, while a final live model/browser evaluation against the deployed site remains to be run and recorded.

## TODO Official Form Fields

- Submitter Type: TODO (Individual, Team of Individuals, or Organization).
- Country of residence of yourself and team members if applicable: TODO.
- App Status: New. The repository history shown for this project begins during the submission period; confirm this is accurate before finalizing.
- If Existing, explain what you updated during the submission period: N/A if App Status is New; otherwise document the WebMCP extension with dated commits.
- Live URL: https://pixel-film-studio.vercel.app
- Testing Instructions: use the section above; add credentials only if the live site later requires them.
- Public Code Repo: https://github.com/MichaelHo02/pixel-film-studio
- Which agent(s) or client(s) did you test your WebMCP tools with?: Codex in-app browser (browser verification documented 2026-09-03). Add ChatGPT in-app browser and/or Chrome only after testing them.
- Which AI tools have you leveraged while working on this project?: Codex for implementation, debugging, iterative UI work, verification, and documentation. Confirm any additional tools before adding them.
- Describe the level of learning you/your team derived from the project: TODO (suggested: Significant, if accurate).
- Did you gain AI value that you can use in your career?: TODO (Yes or No).
