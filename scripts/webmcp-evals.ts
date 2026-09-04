/**
 * Deterministic, LLM-free WebMCP eval runner for Open Dots.
 *
 * Chrome's WebMCP eval guidance (https://developer.chrome.com/docs/ai/webmcp/evals)
 * splits testing into three layers:
 *   1. Tool-in-isolation schema/description lint — can the model even understand
 *      the tool from its name, description, and inputSchema?
 *   2. Deterministic tests — does tool logic behave and report errors gracefully?
 *   3. Probabilistic (LLM) + browser evals — does the model pick the right tool?
 *
 * The probabilistic layer is run against a live page with the official CLI:
 *   npx webmcp-evals browser -u <deployed-url> -e evals/open-dots.evals.json
 * (see GoogleChromeLabs/webmcp-tools). That needs Chrome Canary + an API key, so
 * it is not suitable for headless CI. This runner covers layers 1 and 2 with no
 * browser, no network, and no API key, and validates that every functionName /
 * argument used by the eval suite actually exists on a tool. It also emits
 * evals/schema.json so the CLI's `local` mode can consume the same tool set.
 *
 * Run: npm run test:webmcp
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  buildFilmTools,
  registerFilmTools,
  unregisterFilmTools,
} from "../lib/register-tools";
import { inferSceneHint, pageSceneHintContext } from "../lib/agent-session";
import type { FilmApi } from "../lib/types";
import { getModelContext, type WebMCPTool } from "../lib/webmcp-polyfill";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const EVALS_PATH = resolve(ROOT, "evals/open-dots.evals.json");
const SCHEMA_OUT = resolve(ROOT, "evals/schema.json");

type ToolResult = { content?: unknown[]; isError?: boolean };

type FunctionCall = {
  functionName: string;
  arguments?: Record<string, unknown> | null;
  optional?: boolean;
};
type ExpectedCallNode =
  | FunctionCall
  | { ordered: ExpectedCallNode[] }
  | { unordered: ExpectedCallNode[] };
type Eval = {
  name?: string;
  messages: Array<{ role: string; type: string; content?: string }>;
  expectedCall: ExpectedCallNode[] | null;
};

const NAME_RE = /^[a-zA-Z0-9_.-]{1,128}$/;
const MIN_DESCRIPTION = 24;

let failures = 0;
let checks = 0;

function pass(label: string): void {
  checks += 1;
  console.log(`  \u2713 ${label}`);
}

function fail(label: string, detail: string): void {
  checks += 1;
  failures += 1;
  console.log(`  \u2717 ${label}\n      ${detail}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function getSchema(tool: WebMCPTool): {
  type?: unknown;
  properties?: Record<string, unknown>;
  required?: unknown;
} | null {
  const schema = tool.inputSchema as Record<string, unknown> | undefined;
  if (!schema) return null;
  return schema as {
    type?: unknown;
    properties?: Record<string, unknown>;
    required?: unknown;
  };
}

/** Layer 1: every tool is understandable and spec-compliant. */
function lintTools(tools: WebMCPTool[]): void {
  section("1. Tool schema + annotation lint (understandability)");

  if (tools.length === 0) {
    fail("tools registered", "buildFilmTools returned no tools");
    return;
  }
  pass(`${tools.length} tools built`);

  const seen = new Set<string>();
  for (const tool of tools) {
    const label = tool.name || "(unnamed)";

    if (!tool.name || !NAME_RE.test(tool.name)) {
      fail(`${label}: name`, `invalid tool name "${tool.name}"`);
    }
    if (seen.has(tool.name)) {
      fail(`${label}: name`, "duplicate tool name");
    }
    seen.add(tool.name);

    if (!tool.description || tool.description.length < MIN_DESCRIPTION) {
      fail(
        `${label}: description`,
        `description missing or too short (< ${MIN_DESCRIPTION} chars)`,
      );
    }

    // readOnlyHint is required: Cursor and other hosts classify tools as
    // read vs write from it; a missing hint drops write tools from the agent.
    const readOnly = tool.annotations?.readOnlyHint;
    if (typeof readOnly !== "boolean") {
      fail(`${label}: annotations.readOnlyHint`, "must be a boolean");
    }

    const schema = getSchema(tool);
    if (!schema) {
      fail(`${label}: inputSchema`, "missing inputSchema");
      continue;
    }
    if (schema.type !== "object") {
      fail(`${label}: inputSchema.type`, `expected "object", got ${schema.type}`);
    }
    const properties = schema.properties ?? {};
    if (typeof properties !== "object") {
      fail(`${label}: inputSchema.properties`, "must be an object");
    }
    if (schema.required !== undefined) {
      if (!Array.isArray(schema.required)) {
        fail(`${label}: inputSchema.required`, "must be an array");
      } else {
        for (const key of schema.required) {
          if (!(typeof key === "string" && key in properties)) {
            fail(
              `${label}: required`,
              `required key "${String(key)}" is not declared in properties`,
            );
          }
        }
      }
    }
  }

  const readCount = tools.filter((t) => t.annotations?.readOnlyHint === true).length;
  const writeCount = tools.length - readCount;
  pass(`annotations present: ${readCount} read-only, ${writeCount} write`);
}

function isResult(value: unknown): value is ToolResult {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as ToolResult).content)
  );
}

/**
 * Layer 2: deterministic behavior + graceful error reporting, with no DOM.
 * These paths validate input before touching the (null) editor API, or exercise
 * the withSafeExecute backstop that turns a runtime throw into an isError result.
 */
async function testDeterministic(tools: WebMCPTool[]): Promise<void> {
  section("2. Deterministic execution (validation + graceful errors, no DOM)");

  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  const paintAssetProperties = getSchema(byName.get("paint_asset")!)?.properties ?? {};
  if ("frameIndex" in paintAssetProperties && "frameDuration" in paintAssetProperties) {
    pass("paint_asset exposes animation frame and timing controls");
  } else {
    fail("paint_asset animation schema", "frameIndex and frameDuration are required");
  }
  const getAssetProperties = getSchema(byName.get("get_asset_image")!)?.properties ?? {};
  if ("frameIndex" in getAssetProperties) {
    pass("get_asset_image can inspect a specific animation frame");
  } else {
    fail("get_asset_image animation schema", "frameIndex is required");
  }

  const guide = byName.get("get_pixel_art_guide");
  if (!guide) {
    fail("get_pixel_art_guide present", "tool missing");
  } else {
    const result = (await guide.execute({ topic: "tools" })) as ToolResult;
    const guideText = JSON.stringify(result);
    if (isResult(result) && !result.isError && guideText.includes("multiple reusable") && guideText.includes("100+")) {
      pass("get_pixel_art_guide returns content without a browser");
    } else {
      fail("get_pixel_art_guide", `unexpected result: ${JSON.stringify(result)}`);
    }
  }

  const emptyHint = inferSceneHint(
    {
      width: 8,
      height: 8,
      paintedCount: 0,
      transparentCount: 64,
      coverage: 0,
      bounds: null,
      colorHistogram: {},
      colorCount: 0,
    },
    pageSceneHintContext({ width: 8, height: 8, placements: [] }, 0, 0),
  );
  if (emptyHint.includes("empty")) {
    pass("sceneHint flags an empty page");
  } else {
    fail("sceneHint empty page", emptyHint);
  }
  const fewHint = inferSceneHint(
    {
      width: 128,
      height: 72,
      paintedCount: 2000,
      transparentCount: 7216,
      coverage: 0.22,
      bounds: { minX: 0, minY: 0, maxX: 40, maxY: 40, width: 41, height: 41 },
      colorHistogram: { "#ff0000": 2000 },
      colorCount: 4,
    },
    pageSceneHintContext(
      {
        width: 128,
        height: 72,
        placements: [
          { assetId: "a", width: 16, height: 16 },
          { assetId: "a", width: 16, height: 16 },
        ],
      },
      12,
      0.1,
    ),
  );
  if (fewHint.toLowerCase().includes("placement")) {
    pass("sceneHint flags few overlay placements");
  } else {
    fail("sceneHint few placements", fewHint);
  }
  const richColorHint = inferSceneHint(
    {
      width: 128,
      height: 72,
      paintedCount: 8000,
      transparentCount: 1216,
      coverage: 0.87,
      bounds: { minX: 0, minY: 0, maxX: 127, maxY: 71, width: 128, height: 72 },
      colorHistogram: {},
      colorCount: 120,
    },
    pageSceneHintContext(
      {
        width: 128,
        height: 72,
        placements: Array.from({ length: 12 }, (_, i) => ({
          assetId: `a${i}`,
          width: 16,
          height: 16,
        })),
      },
      20,
      0.2,
    ),
  );
  if (!richColorHint.toLowerCase().includes("noisy")) {
    pass("sceneHint accepts 100+ purposeful composed colors");
  } else {
    fail("sceneHint rich color count", richColorHint);
  }

  // Tools that must reject missing required args BEFORE touching the editor API.
  const missingRequired: Array<[string, Record<string, unknown>]> = [
    ["set_palette", {}],
    ["select_page", {}],
    ["place_text", {}],
    ["add_asset", {}],
    ["paint_asset", {}],
    ["get_asset_image", {}],
    ["stamp_assets", {}],
  ];
  for (const [name, input] of missingRequired) {
    const tool = byName.get(name);
    if (!tool) {
      fail(`${name} present`, "tool missing");
      continue;
    }
    const result = (await tool.execute(input)) as ToolResult;
    if (isResult(result) && result.isError === true) {
      pass(`${name} reports isError for missing required args (never throws)`);
    } else {
      fail(
        `${name} missing-arg handling`,
        `expected isError result, got ${JSON.stringify(result)}`,
      );
    }
  }

  // withSafeExecute backstop: get_storybook throws internally (null editor API) and
  // must surface as a structured isError, not a rejected promise.
  const getFilm = byName.get("get_storybook");
  if (!getFilm) {
    fail("get_storybook present", "tool missing");
  } else {
    let result: ToolResult | undefined;
    try {
      result = (await getFilm.execute({})) as ToolResult;
    } catch (error) {
      fail(
        "get_storybook graceful error",
        `execute threw instead of returning isError: ${String(error)}`,
      );
    }
    if (result && isResult(result) && result.isError === true) {
      pass("get_storybook surfaces runtime failure as isError (withSafeExecute backstop)");
    } else if (result) {
      fail(
        "get_storybook graceful error",
        `expected isError result, got ${JSON.stringify(result)}`,
      );
    }
  }
}

function forEachExpectedCall(
  nodes: ExpectedCallNode[] | null,
  visit: (call: FunctionCall) => void,
): void {
  for (const node of nodes ?? []) {
    if ("ordered" in node) {
      forEachExpectedCall(node.ordered, visit);
    } else if ("unordered" in node) {
      forEachExpectedCall(node.unordered, visit);
    } else {
      visit(node);
    }
  }
}

/** Layer 1b: the eval suite only references real tools + declared properties. */
function checkEvalCoverage(tools: WebMCPTool[]): void {
  section("3. Eval suite coverage (functionName + arguments exist)");

  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  let suite: Eval[];
  try {
    suite = JSON.parse(readFileSync(EVALS_PATH, "utf8")) as Eval[];
  } catch (error) {
    fail("load evals/open-dots.evals.json", String(error));
    return;
  }
  if (!Array.isArray(suite) || suite.length === 0) {
    fail("eval suite", "must be a non-empty array");
    return;
  }
  pass(`${suite.length} eval cases loaded`);

  const referenced = new Set<string>();
  for (const evalCase of suite) {
    forEachExpectedCall(evalCase.expectedCall, (call) => {
      const tool = byName.get(call.functionName);
      if (!tool) {
        fail(
          `${evalCase.name ?? "case"}: ${call.functionName}`,
          "references a tool that is not registered",
        );
        return;
      }
      referenced.add(call.functionName);
      if (call.arguments && typeof call.arguments === "object") {
        const schema = getSchema(tool);
        const properties = (schema?.properties ?? {}) as Record<string, unknown>;
        for (const key of Object.keys(call.arguments)) {
          if (!(key in properties)) {
            fail(
              `${evalCase.name ?? "case"}: ${call.functionName}.${key}`,
              "argument is not a declared inputSchema property",
            );
          }
        }
      }
    });
  }

  const uncovered = tools
    .map((tool) => tool.name)
    .filter((name) => !referenced.has(name));
  if (uncovered.length > 0) {
    // Coverage gap is a warning, not a hard failure — surfaced so the suite grows.
    console.log(
      `  ! ${uncovered.length} tool(s) not covered by the eval suite: ${uncovered.join(", ")}`,
    );
  } else {
    pass("every tool is exercised by at least one eval case");
  }
}

/** Emit a schema.json compatible with `webmcp-evals local`. */
function writeSchema(tools: WebMCPTool[]): void {
  section("4. Emit evals/schema.json for the webmcp-evals CLI");
  const schema = {
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
    })),
  };
  writeFileSync(SCHEMA_OUT, `${JSON.stringify(schema, null, 2)}\n`);
  pass(`wrote ${tools.length} tool schemas to evals/schema.json`);
}

async function checkRegistrationLifecycle(apiRef: { current: FilmApi }): Promise<void> {
  section("5. Route-scoped registration lifecycle");
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "https://example.test" } },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {},
  });

  try {
    const first = await registerFilmTools(apiRef);
    const context = getModelContext();
    const registered = await context?.getTools();
    if (first.count === 12 && registered?.length === 12) {
      pass("editor mount registers 12 tools");
    } else {
      fail("editor mount registration", `expected 12 tools, got ${registered?.length ?? 0}`);
    }

    unregisterFilmTools();
    const afterUnmount = await context?.getTools();
    if (afterUnmount?.length === 0) {
      pass("editor unmount aborts every tool registration");
    } else {
      fail("editor unmount cleanup", `expected 0 tools, got ${afterUnmount?.length ?? 0}`);
    }

    const second = await registerFilmTools(apiRef);
    if (second.count === 12 && (await context?.getTools())?.length === 12) {
      pass("returning to the editor registers a fresh tool set");
    } else {
      fail("editor remount registration", "tools did not register again after cleanup");
    }
  } catch (error) {
    fail("registration lifecycle", String(error));
  } finally {
    unregisterFilmTools();
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete (globalThis as { window?: unknown }).window;
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete (globalThis as { document?: unknown }).document;
  }
}

async function main(): Promise<void> {
  console.log("WebMCP eval runner \u2014 Open Dots (deterministic, no browser/LLM)");
  const apiRef = { current: null as unknown as FilmApi };
  const tools = buildFilmTools(apiRef);

  lintTools(tools);
  await testDeterministic(tools);
  checkEvalCoverage(tools);
  writeSchema(tools);
  await checkRegistrationLifecycle(apiRef);

  console.log(
    `\n${failures === 0 ? "PASS" : "FAIL"} \u2014 ${checks - failures}/${checks} checks passed`,
  );
  if (failures > 0) {
    process.exitCode = 1;
  }
}

void main();
