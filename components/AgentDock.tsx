"use client";

import { useMemo, useState } from "react";
import { buildStudioTools } from "@/lib/register-tools";
import { useStudio } from "@/lib/studio-store";
import { getModelContext } from "@/lib/webmcp-polyfill";

export function AgentDock() {
  const api = useStudio();
  const tools = useMemo(() => buildStudioTools({ current: api }), [api]);
  const [toolName, setToolName] = useState("search_assets");
  const [args, setArgs] = useState('{\n  "query": "black stand"\n}');
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = tools.find((tool) => tool.name === toolName) ?? tools[0];

  async function runTool() {
    const context = getModelContext();
    if (!context || !selected) {
      setOutput("WebMCP is not ready yet.");
      return;
    }
    setBusy(true);
    try {
      const parsed = args.trim() ? JSON.parse(args) : {};
      const [tool] = (await context.getTools()).filter((item) => item.name === selected.name);
      const result = tool
        ? await context.executeTool(tool, parsed)
        : await selected.execute(parsed);
      setOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="agent-dock">
      <header>
        <p className="kicker">Agent dock</p>
        <h2>Call the same tools</h2>
        <p className="lede">
          ChatGPT and Chrome invoke these through{" "}
          <code>document.modelContext</code>. You can fire them here too.
        </p>
      </header>

      <label>
        Tool
        <select
          value={selected?.name ?? ""}
          onChange={(event) => {
            const next = tools.find((tool) => tool.name === event.target.value);
            setToolName(event.target.value);
            if (next?.name === "search_assets") {
              setArgs('{\n  "query": "black stand"\n}');
            } else if (next?.name === "paint_pixel_frame") {
              const shot = api.active?.shots.find((item) => !item.frame);
              setArgs(
                JSON.stringify(
                  {
                    shotId: shot?.id ?? api.active?.shots[0]?.id ?? "",
                    prompt: "night black stand two figures rain neon",
                  },
                  null,
                  2,
                ),
              );
            } else if (next?.inputSchema && "required" in (next.inputSchema as object)) {
              setArgs("{}");
            }
          }}
        >
          {tools.map((tool) => (
            <option key={tool.name} value={tool.name}>
              {tool.name}
            </option>
          ))}
        </select>
      </label>
      <p className="tool-help">{selected?.description}</p>
      <label>
        Arguments (JSON)
        <textarea value={args} onChange={(event) => setArgs(event.target.value)} rows={7} />
      </label>
      <button type="button" className="run" onClick={() => void runTool()} disabled={busy}>
        {busy ? "Running…" : "Execute tool"}
      </button>
      {output ? <pre className="output">{output}</pre> : null}

      <div className="log">
        <p className="kicker">Floor log</p>
        {api.snapshot.logs.length === 0 ? (
          <p className="muted">No agent calls yet.</p>
        ) : (
          <ul>
            {api.snapshot.logs.map((entry) => (
              <li key={entry.id} data-ok={entry.ok}>
                <strong>{entry.tool}</strong>
                <span>{entry.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
