# Open Dots evaluation evidence — 2026-09-04

## Live Layer 3 browser run

- Target: `https://opendots.thach.app`
- Runner: `webmcp-evals` 0.0.4, browser mode
- Backend/model: Vercel AI SDK / `google:gemini-3.1-flash-lite`
- Browser: stable Chrome
- Cases: 16 completed, 0 runtime errors
- Strict matcher: 7 passed steps, 36 failed steps (7/43, 16.3%)
- Full report: [layer3-gemini-3.1-flash-lite-2026-09-04.html](./layer3-gemini-3.1-flash-lite-2026-09-04.html)
- Report SHA-256: `2c5a999458a006b4df6dccd25ac25999f80a6ea7be136b8cdc019359c6172464`

The report preserves the actual model trajectories and tool results. Several
strict matcher failures are ordering failures rather than missing capability:
the model often read `get_storybook` before the requested mutation, so the
requested tool appeared one step later and was then counted as unexpected.

## Story-page visual benchmark

The earlier Moon Garden benchmark and its calibration were removed because
they required too many detailed assets for a fair first agent run. The current
challenge uses a simpler campsite reference with two characters, six reusable
visual groups, repeated trees/stars, three depth bands, and one line of text.

Its mechanical 256×144 downscale scored **95/100**. This is calibration
evidence that the composition survives the target resolution, not an agent
result:

- Candidate: [campsite-256x144-calibration.png](./campsite-256x144-calibration.png)
- Full score: [campsite-downscale-calibration.json](./campsite-downscale-calibration.json)
- Candidate SHA-256: `90480d1ad8724fd3db39f7c5f4de9370e53ca66d24171554da5a0fa2d846c4ad`

| Category | Score |
| --- | ---: |
| Composition | 19/20 |
| Characters | 20/20 |
| Asset reuse and layout | 20/20 |
| Pixel craft | 18/20 |
| Story text | 10/10 |
| Palette and lighting | 8/10 |

## Campsite Layer 3 browser run

The campsite prompt was run through the live browser harness against the
deployed site with Gemini 3.1 Flash-Lite. The model made 20 successful WebMCP
calls and correctly started with the guide, storybook, named palette, 256×144
page, background, and rasterized story text. It began the tent, campfire, and
Mira assets, including intermediate image inspections.

The run stopped after outlining Mira. It did not create the fox, trees, or
stars; stamp any assets; or call `get_page_image`. Therefore this run has no
valid visual score. The CLI's strict ordered matcher shows **7/20 steps**
because useful intermediate inspection and repeated paint calls are counted as
unexpected after the first matched paint step.

The milestone scorer gives the trajectory **68/100, incomplete**. It allows
repeated reads, inspections, and paint passes, while checking only meaningful
dependencies and outcomes. The run earned full credit for safe startup,
palette/page setup, background, exact story text, and asset iteration. It lost
points for creating only 3/6 required assets, making no stamps, and skipping
the final page inspection.

- Full report: [campsite-layer3-gemini-3.1-flash-lite-2026-09-04.html](./campsite-layer3-gemini-3.1-flash-lite-2026-09-04.html)
- Semantic score: [campsite-layer3-semantic-score.json](./campsite-layer3-semantic-score.json)
- Report SHA-256: `15656340e2a4222822b052f3e762af3c8bbb45402c50e3ca94d423cd1cb1b6c9`
- Runner/model: `webmcp-evals` 0.0.4 / `google:gemini-3.1-flash-lite`
- Configured ceiling: 80 steps; observed trajectory: 20 calls

The official runner currently accepts text-only messages and does not attach
the reference PNG. A future visual run needs an image-capable browser harness,
then the exported 256×144 page can be scored with:

```bash
npm run eval:story-page -- --output evals/reports/agent-campsite.json path/to/agent-page.png
```
