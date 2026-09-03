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

The next evidence run should attach `../fixtures/campsite-story-page.png` to a
browser agent, execute the prompt in `../campsite.challenge.json`, export its
256×144 page, and save the score with:

```bash
npm run eval:story-page -- --output evals/reports/agent-campsite.json path/to/agent-page.png
```
