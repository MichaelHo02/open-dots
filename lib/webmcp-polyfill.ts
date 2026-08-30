/**
 * Spec-shaped polyfill for document.modelContext.
 * Native Chrome 149+ (chrome://flags/#enable-webmcp-testing) and ChatGPT's
 * in-app browser provide this API. The polyfill only installs when missing
 * so judges can inspect tools locally without the flag.
 *
 * @see https://webmachinelearning.github.io/webmcp/
 */

export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
}

export interface RegisteredToolView {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMCPTool["annotations"];
  origin: string;
}

type ExecuteFn = (input: Record<string, unknown>) => unknown | Promise<unknown>;

interface StoredTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMCPTool["annotations"];
  origin: string;
  execute: ExecuteFn;
}

class ModelContext extends EventTarget {
  readonly isPolyfill = true;
  #tools = new Map<string, StoredTool>();
  #ontoolchange: ((event: Event) => void) | null = null;

  get ontoolchange() {
    return this.#ontoolchange;
  }

  set ontoolchange(handler: ((event: Event) => void) | null) {
    if (this.#ontoolchange) {
      this.removeEventListener("toolchange", this.#ontoolchange);
    }
    this.#ontoolchange = handler;
    if (handler) {
      this.addEventListener("toolchange", handler);
    }
  }

  async registerTool(
    tool: WebMCPTool,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    if (!tool?.name || typeof tool.name !== "string") {
      throw new DOMException("Invalid tool name", "InvalidStateError");
    }
    if (!tool.description || typeof tool.description !== "string") {
      throw new DOMException("Invalid tool description", "InvalidStateError");
    }
    if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(tool.name)) {
      throw new DOMException("Invalid tool name format", "InvalidStateError");
    }
    if (typeof tool.execute !== "function") {
      throw new DOMException("Tool execute is required", "InvalidStateError");
    }
    if (this.#tools.has(tool.name)) {
      this.#tools.delete(tool.name);
    }
    if (options.signal?.aborted) {
      throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
    }

    const stored: StoredTool = {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      origin: window.location.origin,
      execute: tool.execute,
    };
    this.#tools.set(tool.name, stored);

    const onAbort = () => {
      if (this.#tools.delete(tool.name)) {
        this.dispatchEvent(new Event("toolchange"));
      }
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });
    this.dispatchEvent(new Event("toolchange"));
  }

  async getTools(): Promise<RegisteredToolView[]> {
    return [...this.#tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      origin: tool.origin,
    }));
  }

  async executeTool(
    tool: { name: string } | string,
    args: unknown,
  ): Promise<unknown> {
    const name = typeof tool === "string" ? tool : tool.name;
    const stored = this.#tools.get(name);
    if (!stored) {
      throw new Error(`Tool ${name} not found`);
    }
    let parsed: Record<string, unknown> = {};
    if (typeof args === "string") {
      try {
        parsed = JSON.parse(args) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    } else if (args && typeof args === "object") {
      parsed = args as Record<string, unknown>;
    }
    return stored.execute(parsed);
  }
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

export function ensureWebMCPPolyfill(): ModelContext {
  const existing = document.modelContext;
  if (existing) {
    return existing;
  }
  const context = new ModelContext();
  Object.defineProperty(document, "modelContext", {
    value: context,
    configurable: true,
  });
  return context;
}

export function getModelContext(): ModelContext | null {
  if (typeof document === "undefined") {
    return null;
  }
  return document.modelContext ?? null;
}
