import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Challenge = {
  name: string;
  reference: string;
  target: { width: number; height: number };
  prompt: string;
  minimumScore: number;
  rubric: Array<{ name: string; weight: number; criteria: string }>;
};

type Score = {
  totalScore: number;
  verdict: "pass" | "fail";
  summary: string;
  categories: Array<{ name: string; score: number; evidence: string }>;
  nextFix: string;
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const challengePath = resolve(root, "evals/moon-garden.challenge.json");

function mimeType(path: string): string {
  if (extname(path).toLowerCase() !== ".png") throw new Error(`${path} must be a PNG`);
  return "image/png";
}

function pngDimensions(data: Buffer): { width: number; height: number } {
  if (data.length < 24 || data.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("Invalid PNG data");
  }
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

async function loadChallenge(): Promise<Challenge> {
  const challenge = JSON.parse(await readFile(challengePath, "utf8")) as Challenge;
  const totalWeight = challenge.rubric.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight !== 100) throw new Error(`Rubric weights total ${totalWeight}, expected 100`);
  return challenge;
}

function responseSchema(challenge: Challenge) {
  return {
    type: "OBJECT",
    properties: {
      totalScore: { type: "INTEGER" },
      verdict: { type: "STRING", enum: ["pass", "fail"] },
      summary: { type: "STRING" },
      categories: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", enum: challenge.rubric.map((item) => item.name) },
            score: { type: "INTEGER" },
            evidence: { type: "STRING" },
          },
          required: ["name", "score", "evidence"],
        },
      },
      nextFix: { type: "STRING" },
    },
    required: ["totalScore", "verdict", "summary", "categories", "nextFix"],
  };
}

function validateScore(score: Score, challenge: Challenge): Score {
  const weights = new Map(challenge.rubric.map((item) => [item.name, item.weight]));
  if (score.categories.length !== weights.size) throw new Error("Gemini returned an incomplete rubric");
  const names = new Set<string>();
  let total = 0;
  for (const category of score.categories) {
    const weight = weights.get(category.name);
    if (weight === undefined || names.has(category.name)) throw new Error("Gemini returned invalid rubric categories");
    if (!Number.isInteger(category.score) || category.score < 0 || category.score > weight) {
      throw new Error(`Gemini returned an invalid ${category.name} score`);
    }
    names.add(category.name);
    total += category.score;
  }
  const verdict = total >= challenge.minimumScore ? "pass" : "fail";
  if (score.totalScore !== total || score.verdict !== verdict) throw new Error("Gemini returned inconsistent totals");
  return score;
}

async function main() {
  const challenge = await loadChallenge();
  const candidateArg = process.argv.find((arg) => arg.endsWith(".png"));
  if (!candidateArg) {
    console.log(`${challenge.name}\n\nReference: ${resolve(dirname(challengePath), challenge.reference)}\n\n${challenge.prompt}`);
    return;
  }

  const candidatePath = resolve(candidateArg);
  const referencePath = resolve(dirname(challengePath), challenge.reference);
  const [reference, candidate] = await Promise.all([readFile(referencePath), readFile(candidatePath)]);
  mimeType(referencePath);
  mimeType(candidatePath);
  const dimensions = pngDimensions(candidate);
  if (dimensions.width !== challenge.target.width || dimensions.height !== challenge.target.height) {
    throw new Error(
      `Candidate is ${dimensions.width}×${dimensions.height}; expected ${challenge.target.width}×${challenge.target.height}`,
    );
  }

  if (process.argv.includes("--check")) {
    console.log(`OK: ${basename(candidatePath)}; rubric weights total 100; reference and candidate are readable PNG files.`);
    return;
  }

  const apiKey = process.env.GOOGLE_AI;
  if (!apiKey) throw new Error("GOOGLE_AI is required (run through npm run eval:story-page)");
  const rubric = challenge.rubric
    .map((item) => `${item.name} (${item.weight} points): ${item.criteria}`)
    .join("\n");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: `You are a strict pixel-art benchmark judge. Image 1 is a high-resolution composition reference; Image 2 is a ${challenge.target.width}×${challenge.target.height} pixel-art candidate. Score semantic composition, silhouettes, depth, text, palette, and deliberate pixel simplification—not literal resolution or pixel similarity. Do not penalize the candidate for omitting reference micro-detail that cannot remain legible at the target size. Score only visible evidence. Category scores must be within each category's weight and totalScore must equal their sum. verdict is pass only when totalScore >= ${challenge.minimumScore}.\n\n${rubric}` },
            { text: "Image 1 — reference" },
            { inlineData: { mimeType: mimeType(referencePath), data: reference.toString("base64") } },
            { text: "Image 2 — candidate" },
            { inlineData: { mimeType: mimeType(candidatePath), data: candidate.toString("base64") } },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema(challenge),
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini scoring failed (${response.status}): ${await response.text()}`);
  const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  if (!text) throw new Error("Gemini returned no score");
  const output = `${JSON.stringify(validateScore(JSON.parse(text) as Score, challenge), null, 2)}\n`;
  const outputFlag = process.argv.indexOf("--output");
  if (outputFlag >= 0) {
    const outputArg = process.argv[outputFlag + 1];
    if (!outputArg) throw new Error("--output requires a path");
    const outputPath = resolve(outputArg);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output);
    console.log(`Report saved to ${outputPath}`);
  }
  console.log(output.trimEnd());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
