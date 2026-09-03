import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type Call = { toolName: string; input: Record<string, unknown> };
type Milestone = { name: string; score: number; weight: number; evidence: string };

const requiredAssets = ["tent", "campfire", "mira", "fox", "pine tree", "star cluster"];
const coreAssets = ["tent", "campfire", "mira", "fox"];
const mutations = new Set(["set_palette", "add_page", "paint_page", "add_asset", "paint_asset", "stamp_assets", "place_text"]);

function canonicalAsset(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.includes("star") && normalized.includes("cluster")) return "star cluster";
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
      if (call.toolName !== "add_asset" || call.input.id) return call;
      try {
        const id = JSON.parse(outputs.get(call.toolCallId) ?? "{}").id;
        return id ? { ...call, input: { ...call.input, id } } : call;
      } catch {
        return call;
      }
    });
  }) ?? [];
}

function scoreJourney(calls: Call[]) {
  const index = (name: string) => calls.findIndex((call) => call.toolName === name);
  const firstMutation = calls.findIndex((call) => mutations.has(call.toolName));
  const guide = index("get_pixel_art_guide");
  const storybook = index("get_storybook");
  const addPage = calls.findIndex((call) => call.toolName === "add_page" && call.input.width === 256);
  const paintPage = index("paint_page");
  const text = calls.findIndex((call) => call.toolName === "place_text" && call.input.body === "Mira followed the little fox.");
  const assets = calls.map((call, i) => ({ ...call, i })).filter((call) => call.toolName === "add_asset");
  const assetNames = new Set(assets.map((call) => canonicalAsset(String(call.input.name))));
  const assetIndexes = new Map(assets.map((call) => [call.input.id, call.i]));
  const created = requiredAssets.filter((name) => assetNames.has(name)).length;
  const paints = calls.map((call, i) => ({ ...call, i })).filter((call) => call.toolName === "paint_asset");
  const allCreatedPainted = assets.length > 0 && assets.every((asset) => paints.some((paint) => paint.input.id === asset.input.id && paint.i > asset.i));
  const stamps: Array<Record<string, unknown> & { i: number }> = calls.map((call, i) => ({ ...call, i })).filter((call) => call.toolName === "stamp_assets").flatMap((call) =>
    (Array.isArray(call.input.stamps) ? call.input.stamps as Array<Record<string, unknown>> : []).map((stamp) => ({ ...stamp, i: call.i })),
  );
  const stampIdsValid = stamps.length > 0 && stamps.every((stamp) => {
    const id = stamp.assetId ?? stamp.id;
    return assetIndexes.has(id) && assetIndexes.get(id)! < stamp.i;
  });
  const finalImage = calls.map((call) => call.toolName).lastIndexOf("get_page_image");
  const lastMutation = calls.reduce((last, call, i) => mutations.has(call.toolName) ? i : last, -1);

  const milestones: Milestone[] = [
    { name: "safe_start", weight: 10, score: guide >= 0 && storybook >= 0 && guide < firstMutation && storybook < firstMutation ? 10 : 0, evidence: "Guide and storybook before mutation" },
    { name: "palette_and_page", weight: 15, score: (index("set_palette") >= 0 ? 5 : 0) + (addPage >= 0 ? 10 : 0), evidence: "Named palette and 256x144 page" },
    { name: "background", weight: 10, score: paintPage > addPage && addPage >= 0 ? 10 : 0, evidence: "Page background painted after page creation" },
    { name: "story_text", weight: 10, score: text >= 0 ? 10 : 0, evidence: "Exact rasterized sentence" },
    { name: "required_assets", weight: 25, score: Math.round(25 * created / requiredAssets.length), evidence: `${created}/${requiredAssets.length} named assets created` },
    { name: "asset_iteration", weight: 10, score: allCreatedPainted ? 10 : 0, evidence: "Every created asset painted after creation; extra inspections are neutral" },
    { name: "composition", weight: 10, score: stamps.length > 0 && stampIdsValid ? 10 : 0, evidence: `${stamps.length} valid stamps` },
    { name: "final_verification", weight: 10, score: finalImage > lastMutation ? 10 : 0, evidence: "Final page inspected after composition" },
  ];
  const totalScore = milestones.reduce((sum, item) => sum + item.score, 0);
  const complete = coreAssets.every((name) => assetNames.has(name)) && stamps.length > 0 && finalImage > lastMutation;
  return { totalScore, verdict: complete && totalScore >= 75 ? "pass" : "incomplete", callCount: calls.length, milestones };
}

async function main() {
  if (process.argv.includes("--self-test")) {
    const call = (toolName: string, input: Record<string, unknown> = {}): Call => ({ toolName, input });
    const complete = scoreJourney([
      call("get_pixel_art_guide"), call("get_storybook"), call("get_storybook"), call("set_palette", { name: "Night" }),
      call("add_page", { width: 256 }), call("paint_page"), call("place_text", { body: "Mira followed the little fox." }),
      ...requiredAssets.flatMap((name, i) => [call("add_asset", { name, id: `a${i}` }), call("paint_asset", { id: `a${i}` }), call("get_asset_image", { id: `a${i}` })]),
      call("stamp_assets", { stamps: requiredAssets.map((_, i) => ({ assetId: `a${i}` })) }), call("get_page_image"),
    ]);
    assert.equal(complete.verdict, "pass");
    assert.equal(complete.totalScore, 100);
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
