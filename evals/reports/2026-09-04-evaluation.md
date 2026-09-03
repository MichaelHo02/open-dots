# Open Dots evaluation evidence — 2026-09-04

## Live Layer 3 browser run

- Target: `https://opendots.thach.app`
- Runner: `webmcp-evals` 0.0.4, browser mode
- Backend/model: Vercel AI SDK / `google:gemini-3.1-flash-lite`
- Browser: stable Chrome
- Cases: 16 completed, 0 runtime errors
- Strict matcher: 7 passed steps, 36 failed steps (7/43, 16.3%)
- Full report: [layer3-gemini-3.1-flash-lite-2026-09-04.html](./layer3-gemini-3.1-flash-lite-2026-09-04.html)
- Report SHA-256: `4a96517e88f2bcac52bc1570539af277e858c47d69699973788a7d3921fc22aa`

The report preserves the actual model trajectories and tool results. Several
strict matcher failures are ordering failures rather than missing capability:
the model often read `get_storybook` before the requested mutation, so the
requested tool appeared one step later and was then counted as unexpected.

## 256×144 visual-scorer calibration

The generated reference was mechanically reduced to exactly 256×144 and
scored against the original with the committed visual rubric. This checks that
the target composition remains legible and that the scorer penalizes soft
downsampling. It is not presented as agent-created artwork.

- Score: **76/100 — pass** (threshold 75)
- Candidate: [moon-garden-256x144-calibration.png](./moon-garden-256x144-calibration.png)
- Full score: [moon-garden-downscale-calibration.json](./moon-garden-downscale-calibration.json)
- Candidate SHA-256: `3fc548197f37357d58e9547189c412ea56807e61d850761678980cff33829093`

| Category | Score |
| --- | ---: |
| Composition | 20/25 |
| Characters | 15/20 |
| Assets and density | 15/20 |
| Pixel craft | 12/20 |
| Story text | 9/10 |
| Palette and mood | 5/5 |

The next evidence run should attach the reference to a browser agent, execute
the challenge prompt, export its 256×144 page, and save the score with:

```bash
npm run eval:story-page -- --output evals/reports/agent-moon-garden.json path/to/agent-page.png
```
