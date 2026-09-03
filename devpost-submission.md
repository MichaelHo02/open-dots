# Title

Open Dots

## One-line Summary

An agent-native pixel-art storybook where children and families turn their ideas into illustrated pages with an AI co-creator, then read, revise, and share the artwork together.

## Problem

Families want creative screen time that they can do together: a child imagines a character or scene, an adult helps shape the story, and both can see and change the result. But making a picture book takes drawing confidence, time, and specialized tools.

Many pixel-art products are either one-off image generators or professional editors. A generated image can be impressive, but it is often a paid, opaque endpoint: it does not teach a child how a scene is built, preserve reusable pieces, or make it easy for a family to revise a character across the next page. Traditional editors expose the craft, but can be intimidating for beginners.

People who already have access to an AI client such as ChatGPT need a more approachable middle ground: a shared canvas where they can learn by making, keep creative control, and ask an agent for help without handing the whole story to a black box.

## Solution

Open Dots gives a child and family a tactile pixel-storybook editor and gives an in-browser agent a small, structured WebMCP surface. Together they turn a story idea into a sequence of illustrated pages, add pixel text and shapes, review and revise each scene, then read the finished book page by page. The agent can read the storybook state, create reusable sprites, paint them in deliberate passes, stamp them into layered scenes, and inspect PNG results before the next pass. Individual pages can be exported as PNGs to share.

The result is a collaborative storymaking loop rather than a prompt-to-image handoff: a person directs the narrative and art direction; the agent performs precise, inspectable canvas work through `document.modelContext`.

## Why This Matters

Open Dots makes family story creation more accessible without taking authorship away from the people making the book. Structured tools let an agent work with the same durable primitives that make revision meaningful—pages, palettes, assets, layers, placements, and pixels—so the family can keep shaping the narrative instead of accepting a black-box image.

## How We Used AI

WebMCP is the product capability, not an add-on. Open Dots treats its 15 tools as an agent-quality harness, not a thin UI automation layer. An in-browser agent discovers them through `document.modelContext`, then follows a deliberate pixel-art workflow: load the pixel-art guide, set a named palette, create small assets, refine them in outline/fill/shade/highlight passes, compare inline PNG feedback, stamp assets back-to-front, and inspect the composed page.

This harness exists because an unconstrained agent is poor at pixel art: it may paint whole pages flatly, make oversized props, skip shading, or continue without looking at what it just made. Open Dots gives it the constraints and feedback that a careful pixel artist uses: reusable small sprites, palette tiers, bulk drawing primitives, inline visual inspection, and scene-quality hints. Mutating asset operations return inline PNG feedback and the required next comparison pass, preventing blind multi-step drawing.

Read tools expose the storybook, asset images, and page images; write tools create pages, assets, palettes, pixels, text, and placements. The tools use typed schemas, intent-rich descriptions, structured errors, and read/write annotations. Deterministic evals test the tool surface, input validation, error handling, and journey coverage; the live browser flow tests whether an agent can use that harness to make a coherent scene. Considerable iteration went into scoring agent output and turning the recurring failure modes into guide, feedback, and composition checks.

## How We Used Codex

Codex was used to implement and iterate on the editor, WebMCP registration layer, validation paths, visual editor workflows, and test documentation. The project’s verification notes record browser checks in Codex’s in-app browser, deterministic WebMCP checks, TypeScript checks, linting, and production builds.

## Key Features

- A light-mode pixel storybook editor where families create multiple illustrated pages, review them together, and read the finished story in Present mode.
- Human tools for drawing, erasing, fill, pixel text, shapes, selections, layers, and reusable assets.
- A persistent asset library and movable, layered stamps so agents can compose dense scenes from small reusable sprites.
- Named palette profiles and bulk pixel operations for deliberate outline, fill, shade, and highlight passes.
- 15 WebMCP tools that form an agent-quality harness: typed JSON schemas, intent-focused descriptions, `readOnlyHint` annotations, pixel-art workflow guidance, and visual quality feedback.
- Page-lifetime WebMCP registration that stays stable across React remounts and HMR, avoiding stale agent tool snapshots.
- Inline PNG feedback plus page/asset inspection tools and scene-quality hints for a draw–look–fix loop instead of blind image generation.
- Deterministic WebMCP tool/eval checks, including schema, validation, error handling, tool coverage, and quality-oriented agent workflow checks.

## Architecture

Open Dots is a Next.js and React web application. Storybook state, pages, layers, palettes, assets, and placements are modeled in the client-side store and persist in local storage.

`WebMCPBridge` registers the app-wide tool surface through `document.modelContext`. A small compatibility layer provides a spec-shaped API when native WebMCP is unavailable for local inspection. Tool definitions validate inputs, return structured errors, attach read-only/write annotations, and produce text plus PNG image results where visual comparison matters.

## Testing Instructions

Public demo: https://opendots.thach.app

1. Open the URL in ChatGPT’s in-app browser, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.
2. Start with a blank page and ask the agent to create a picture-book scene in Open Dots.
3. Confirm the agent calls `get_pixel_art_guide`, waits for `get_storybook.webmcp.ready`, defines a palette, creates small assets, refines them using returned PNG feedback, and stamps them into a page.
4. In the human UI, add/select a page, paint or add text, inspect layers, and open Present mode.
5. Reload once, then ask the agent to re-fetch tools and call `get_storybook`; storybook data should remain available while the agent refreshes its tool snapshot.

Local checks:

```bash
npm install
npm run test:webmcp
npm run lint
npm run build
```

The WebMCP evaluation runner validates tool schemas, annotations, declared arguments, structured error paths, and eval coverage. Browser verification documented on 2026-09-03 covered WebMCP asset creation and stamping, movable overlays, persistence after reload, editor controls, layers, and Present mode.

## Public Demo Link

https://opendots.thach.app

## Public Repository Link

https://github.com/MichaelHo02/open-dots

## Demo Video

TODO — record and upload a public YouTube video under three minutes. The video must include audio and clearly show the app working and how WebMCP is used.

Suggested 2:30 outline:

1. 0:00–0:20 — The creative problem: text-only prompting makes a storybook hard to author and revise together.
2. 0:20–0:45 — Show a family story idea becoming illustrated pages: pixel text, assets, layers, page order, review/revision, and Present mode.
3. 0:45–1:45 — In the WebMCP-enabled browser, ask an agent to create a scene for one story page. Show tool discovery, palette selection, a small asset, returned PNG feedback, and stamping/composition.
4. 1:45–2:10 — Add or select the next page, then show the family refining the storybook, reading it in Present mode, and exporting a page PNG to share.
5. 2:10–2:30 — Explain why structured tools make the agent a collaborative storybook editor rather than an unreliable UI clicker.

## Screenshot Shot List

1. The Open Dots editor with a complete, layered pixel-art story page and asset library visible.
2. An agent tool result returning the inline PNG comparison after an asset pass.
3. A composed story page showing multiple stamped assets and the page-image inspection output.
4. The layers/inspector view demonstrating that the human can adjust the agent-created composition.
5. Present mode showing the finished multi-page picture book.

## Submission Readiness Notes

The live demo URL, public GitHub repository, and MIT license are present. The repository documents 15 WebMCP tools and includes a deterministic WebMCP evaluation command. Local/browser verification is documented, but the final public video and final screenshots still need to be captured.

Devpost currently contains an in-progress pre-draft project named “Untitled” for this challenge. Before final review, update it with the title, tagline, full description, technology list, links, and video URL from this draft.

## Known Limitations

- Storybook data is stored in browser local storage; it is not a multi-user cloud collaboration system.
- A browser refresh invalidates an agent’s previously discovered WebMCP tool handles; the agent must re-fetch tools and wait for readiness.
- The project’s deterministic WebMCP checks are complete, while a final live model/browser evaluation against the deployed site remains to be run and recorded.

## TODO Official Form Fields

- Submitter Type: TODO (Individual, Team of Individuals, or Organization).
- Country of residence of yourself and team members if applicable: TODO.
- App Status: New. The repository history shown for this project begins during the submission period; confirm this is accurate before finalizing.
- If Existing, explain what you updated during the submission period: N/A if App Status is New; otherwise document the WebMCP extension with dated commits.
- Live URL: https://opendots.thach.app
- Testing Instructions: use the section above; add credentials only if the live site later requires them.
- Public Code Repo: https://github.com/MichaelHo02/open-dots
- Which agent(s) or client(s) did you test your WebMCP tools with?: Codex in-app browser (browser verification documented 2026-09-03). Add ChatGPT in-app browser and/or Chrome only after testing them.
- Which AI tools have you leveraged while working on this project?: Codex for implementation, debugging, iterative UI work, verification, and documentation. Confirm any additional tools before adding them.
- Describe the level of learning you/your team derived from the project: TODO (suggested: Significant, if accurate).
- Did you gain AI value that you can use in your career?: TODO (Yes or No).
