import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type Call = {
  toolName: string;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  succeeded: boolean;
};
type Milestone = { name: string; score: number; weight: number; evidence: string };

const requiredAssets = ["tent", "campfire", "mira", "fox", "pine tree", "star cluster"];
const coreAssets = ["tent", "campfire", "mira", "fox"];
const mutations = new Set(["set_palette", "add_page", "paint_page", "add_asset", "paint_asset", "stamp_assets", "place_text"]);

function canonicalAsset(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.includes("star")) return "star cluster";
  if (normalized.includes("tree")) return "pine tree";
  return requiredAssets.find((asset) => normalized === asset.replace(/[^a-z]/g, "")) ?? normalized;
}

function callsFrom(report: unknown): Call[] {
  type RawCall = Call & { toolCallId?: string };
  type RawResult = { toolCallId?: string; output?: string };
  const root = report as { results?: { results?: Array<{ trajectory?: Array<{ toolCalls?: RawCall[]; toolResults?: RawResult[] }> }> } };
  return root.results?.results?.[0]?.trajectory?.flatMap((step) => {
    const outputs = new Map((step.toolResults ?? []).map((item) => [item.toolCallId, item.output]));
    return (step.toolCalls ?? []).map((call) => {
      let parsed: Record<string, unknown> | null = null;
      try {
        const value = JSON.parse(outputs.get(call.toolCallId) ?? "null") as unknown;
        if (value && typeof value === "object" && !Array.isArray(value)) parsed = value as Record<string, unknown>;
      } catch {}
      const succeeded = parsed !== null && parsed.isError !== true && parsed.error === undefined;
      const id = call.toolName === "add_asset" && succeeded ? parsed?.id : undefined;
      return { ...call, input: id ? { ...call.input, id } : call.input, result: parsed, succeeded };
    });
  }) ?? [];
}

function scoreJourney(calls: Call[]) {
  const index = (name: string) => calls.findIndex((call) => call.toolName === name && call.succeeded);
  const firstMutation = calls.findIndex((call) => mutations.has(call.toolName));
  const guide = index("get_pixel_art_guide");
  const storybook = index("get_storybook");
  const palette = calls.findIndex((call) => call.toolName === "set_palette" && call.succeeded
    && typeof call.input.name === "string" && call.input.name.trim().length > 0
    && Array.isArray(call.input.colors) && call.input.colors.length > 0);
  const addPage = calls.findIndex((call) => call.toolName === "add_page" && call.succeeded && call.input.width === 256
    && call.result?.size && (call.result.size as Record<string, unknown>).width === 256
    && (call.result.size as Record<string, unknown>).height === 144);
  const paintPage = calls.findIndex((call) => call.toolName === "paint_page" && call.succeeded
    && typeof call.result?.painted === "number" && call.result.painted > 0);
  const text = calls.findIndex((call) => call.toolName === "place_text" && call.succeeded
    && call.input.body === "Mira followed the little fox." && call.result?.body === call.input.body);
  const assets = calls.map((call, i) => ({ ...call, i })).filter((call) => call.toolName === "add_asset" && call.succeeded && typeof call.input.id === "string");
  const assetNames = new Set(assets.map((call) => canonicalAsset(String(call.input.name))));
  const assetIndexes = new Map(assets.map((call) => [call.input.id, call.i]));
  const assetNamesById = new Map(assets.map((call) => [call.input.id, canonicalAsset(String(call.input.name))]));
  const created = requiredAssets.filter((name) => assetNames.has(name)).length;
  const paints = calls.map((call, i) => ({ ...call, i })).filter((call) => call.toolName === "paint_asset" && call.succeeded
    && typeof call.result?.painted === "number" && call.result.painted > 0);
  const allCreatedPainted = assets.length > 0 && assets.every((asset) => paints.some((paint) => paint.input.id === asset.input.id && paint.i > asset.i));
  const approvedAssets = new Set(calls.filter((call) => call.toolName === "review_asset" && call.succeeded
    && call.input.verdict === "approved").map((call) => call.input.id));
  const allCreatedReviewed = assets.length > 0 && assets.every((asset) => approvedAssets.has(asset.input.id));
  const stamps: Array<Record<string, unknown> & { i: number }> = calls.map((call, i) => ({ ...call, i })).filter((call) => call.toolName === "stamp_assets" && call.succeeded
    && call.result?.stamped === (Array.isArray(call.input.stamps) ? call.input.stamps.length : -1)).flatMap((call) =>
    (Array.isArray(call.input.stamps) ? call.input.stamps as Array<Record<string, unknown>> : []).map((stamp) => ({ ...stamp, i: call.i })),
  );
  const stampIdsValid = stamps.length > 0 && stamps.every((stamp) => {
    const id = stamp.assetId ?? stamp.id;
    return assetIndexes.has(id) && assetIndexes.get(id)! < stamp.i;
  });
  const stampedNames = stamps.map((stamp) => assetNamesById.get(stamp.assetId ?? stamp.id));
  const coreStamped = coreAssets.every((name) => stampedNames.includes(name));
  const repeatedScenery = stampedNames.filter((name) => name === "pine tree").length >= 4
    && stampedNames.filter((name) => name === "star cluster").length >= 3;
  const compositionComplete = stampIdsValid && coreStamped && repeatedScenery;
  const finalImage = calls.findLastIndex((call) => call.toolName === "get_page_image" && call.succeeded
    && call.result?.width === 256 && call.result?.height === 144 && call.result?.empty === false
    && typeof call.result?.placementCount === "number" && call.result.placementCount >= stamps.length);
  const lastMutation = calls.reduce((last, call, i) => mutations.has(call.toolName) ? i : last, -1);
  const finalReview = calls.findLastIndex((call) => call.toolName === "review_page" && call.succeeded
    && call.input.verdict === "approved");

  const milestones: Milestone[] = [
    { name: "safe_start", weight: 10, score: guide >= 0 && storybook >= 0 && guide < firstMutation && storybook < firstMutation ? 10 : 0, evidence: "Guide and storybook before mutation" },
    { name: "palette_and_page", weight: 15, score: (palette >= 0 ? 5 : 0) + (addPage >= 0 ? 10 : 0), evidence: "Named palette and confirmed 256x144 page" },
    { name: "background", weight: 10, score: paintPage > addPage && addPage >= 0 ? 10 : 0, evidence: "Page background painted after page creation" },
    { name: "story_text", weight: 10, score: text >= 0 ? 10 : 0, evidence: "Exact rasterized sentence" },
    { name: "required_assets", weight: 25, score: Math.round(25 * created / requiredAssets.length), evidence: `${created}/${requiredAssets.length} named assets created` },
    { name: "asset_iteration", weight: 10, score: allCreatedPainted && allCreatedReviewed ? 10 : 0, evidence: "Every created asset was painted and approved at an inspected revision" },
    { name: "composition", weight: 10, score: compositionComplete ? 10 : coreStamped && stampIdsValid ? 5 : 0, evidence: `${stamps.length} valid stamps; core=${coreStamped}; repeated scenery=${repeatedScenery}` },
    { name: "final_verification", weight: 10, score: finalImage > lastMutation && finalReview > finalImage ? 10 : 0, evidence: "Successful 256x144 final page inspected and approved after composition" },
  ];
  const totalScore = milestones.reduce((sum, item) => sum + item.score, 0);
  const complete = coreAssets.every((name) => assetNames.has(name)) && allCreatedReviewed && compositionComplete
    && finalImage > lastMutation && finalReview > finalImage;
  return {
    scoreType: "semantic-workflow",
    visualScore: null,
    totalScore,
    verdict: complete && totalScore >= 75 ? "pass" : "incomplete",
    callCount: calls.length,
    milestones,
  };
}

async function main() {
  if (process.argv.includes("--self-test")) {
    const call = (toolName: string, input: Record<string, unknown> = {}, result: Record<string, unknown> = {}): Call => ({
      toolName, input, result, succeeded: !("error" in result) && result.isError !== true,
    });
    const complete = scoreJourney([
      call("get_pixel_art_guide"), call("get_storybook"), call("get_storybook"), call("set_palette", { name: "Night", colors: ["#000000"] }),
      call("add_page", { width: 256 }, { size: { width: 256, height: 144 } }), call("paint_page", {}, { painted: 1 }),
      call("place_text", { body: "Mira followed the little fox." }, { body: "Mira followed the little fox." }),
      ...requiredAssets.flatMap((name, i) => [
        call("add_asset", { name, id: `a${i}` }),
        call("paint_asset", { id: `a${i}`, pass: "outline" }, { painted: 1 }),
        call("get_asset_image", { id: `a${i}` }, { revision: 1 }),
        call("review_asset", { id: `a${i}`, revision: 1, verdict: "approved", observations: "Clear silhouette and material ramp." }),
      ]),
      call("stamp_assets", { stamps: [0, 1, 2, 3, 4, 4, 4, 4, 5, 5, 5].map((i) => ({ assetId: `a${i}` })) }, { stamped: 11 }),
      call("get_page_image", {}, { width: 256, height: 144, empty: false, placementCount: 11 }),
      call("review_page", { revision: 1, verdict: "approved", observations: "Readable hierarchy and correct stacking." }),
    ]);
    assert.equal(complete.verdict, "pass");
    assert.equal(complete.totalScore, 100);
    const failedStamp = scoreJourney([
      call("get_pixel_art_guide"), call("get_storybook"), call("set_palette", { name: "Night", colors: ["#000000"] }),
      call("add_page", { width: 256 }, { size: { width: 256, height: 144 } }),
      ...requiredAssets.map((name, i) => call("add_asset", { name, id: `a${i}` })),
      call("stamp_assets", { stamps: [{ assetId: "a0" }] }, { error: "failed" }),
      call("get_page_image", {}, { width: 256, height: 144, empty: false, placementCount: 0 }),
    ]);
    assert.equal(failedStamp.verdict, "incomplete");
    console.log("OK: semantic scorer accepts reasonable repeated calls and requires final outcomes.");
    return;
  }

  const reportArg = process.argv.find((arg) => arg.endsWith(".json"));
  if (!reportArg) throw new Error("Usage: npm run eval:layer3-score -- report.json [--output score.json]");
  const result = scoreJourney(callsFrom(JSON.parse(await readFile(resolve(reportArg), "utf8"))));
  const output = `${JSON.stringify(result, null, 2)}\n`;
  const outputFlag = process.argv.indexOf("--output");
  if (outputFlag >= 0) {
    const outputPath = process.argv[outputFlag + 1];
    if (!outputPath) throw new Error("--output requires a path");
    await mkdir(dirname(resolve(outputPath)), { recursive: true });
    await writeFile(resolve(outputPath), output);
  }
  console.log(output.trimEnd());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
