import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const SERVER_URL = "http://127.0.0.1:9931";
const API_KEY = "dummy";
const POLL_INTERVAL_MS = 250;
const IDLE_POLL_INTERVAL_MS = 2_000;
const STATUS_KEY = "llama-footer";
const READY = "✓";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface ModelInfo {
  id: string;
  status?: { value?: string; progress?: number };
  meta?: { n_ctx_train?: number; n_ctx?: number };
}

interface SlotInfo {
  id: number;
  n_ctx?: number;
  is_processing?: boolean;
  n_prompt_tokens?: number;
  n_prompt_tokens_processed?: number;
  n_prompt_tokens_cache?: number;
  n_decoded?: number;
  n_past?: number;
}

interface Metrics {
  promptTokens: number;
  promptCachedTokens: number;
  promptSeconds: number;
  predictedTokens: number;
  predictedSeconds: number;
  requestsProcessing: number;
  requestsDeferred: number;
}

class FooterState {
  model = "";
  modelReady = false;
  loadingProgress?: number;
  contextUsed = 0;
  contextSize = 0;
  slots: SlotInfo[] = [];
  metrics?: Metrics;
  promptStartedAt?: number;
  promptTotal = 0;
  promptCached = 0;
  promptProcessed = 0;
  promptFinishedAt?: number;
  promptDuration?: number;
  promptTokens?: number;
  promptSpeed?: number;
  generationStartedAt?: number;
  generationFinishedAt?: number;
  generationTokens = 0;
  generationDuration?: number;
  generationSpeed?: number;
  waitingStartedAt?: number;
  waitingCount = 0;
  waitingFinishedAt?: number;
  waitingFinalCount?: number;
  waitingFinalDuration?: number;
  requestActive = false;
  requestSeenQueued = false;
  stage: "idle" | "prompt" | "generation" = "idle";
  spinner = 0;
}

function formatNumber(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}k`;
  return `${Math.round(value)}`;
}

function formatDuration(milliseconds: number): string {
  return `${Math.max(0, Math.round(milliseconds / 1000))}s`;
}

function formatBar(value: number, width = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round(value * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function parseMetrics(text: string): Metrics {
  const read = (name: string) => {
    const match = text.match(new RegExp(`^llamacpp:${name}\\s+([0-9.eE+-]+)$`, "m"));
    return match ? Number(match[1]) : 0;
  };
  return {
    promptTokens: read("prompt_tokens_total"),
    promptCachedTokens: read("prompt_tokens_cached_total"),
    promptSeconds: read("prompt_seconds_total"),
    predictedTokens: read("tokens_predicted_total"),
    predictedSeconds: read("tokens_predicted_seconds_total"),
    requestsProcessing: read("requests_processing"),
    requestsDeferred: read("requests_deferred"),
  };
}

function modelQuery(url: string, model: string): string {
  const query = new URLSearchParams({ model });
  return `${url}?${query}`;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

async function getText(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    signal,
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function getModelId(ctx: ExtensionContext): string | undefined {
  if (ctx.model?.provider !== "llama.cpp") return undefined;
  return ctx.model.id;
}

function updateFinishedPrompt(state: FooterState, now: number) {
  if (state.promptFinishedAt || state.promptStartedAt === undefined) return;
  if (state.stage === "prompt" || state.requestActive) return;
  state.promptFinishedAt = now;
  state.promptDuration = Math.max(0, now - state.promptStartedAt);
  state.promptTokens = state.promptTotal;
  state.promptSpeed = state.promptDuration > 0
    ? state.promptTokens / (state.promptDuration / 1000)
    : undefined;
}

function updateFinishedGeneration(state: FooterState, now: number) {
  if (state.generationFinishedAt || state.generationStartedAt === undefined) return;
  if (state.stage === "generation" || state.requestActive) return;
  state.generationFinishedAt = now;
  state.generationDuration = Math.max(0, now - state.generationStartedAt);
  state.generationSpeed = state.generationDuration > 0
    ? state.generationTokens / (state.generationDuration / 1000)
    : undefined;
}

function renderStatus(state: FooterState, now: number): string {
  if (!state.modelReady) {
    const progress = state.loadingProgress === undefined ? "" : ` ${Math.round(state.loadingProgress * 100)}%`;
    return `${SPINNER[state.spinner % SPINNER.length]} │ Model [${formatBar(state.loadingProgress ?? 0)}]${progress}`;
  }

  const context = state.contextSize > 0
    ? `Ctx [${formatBar(state.contextUsed / state.contextSize)}] ${formatNumber(state.contextUsed)}/${formatNumber(state.contextSize)}`
    : "Ctx [??????????]";
  const parts = [READY, context];

  if (state.requestSeenQueued) {
    if (state.waitingStartedAt !== undefined && state.waitingFinalDuration === undefined) {
      parts.push(`󰇚${state.waitingCount} ⏱ ${formatDuration(now - state.waitingStartedAt)}`);
    } else {
      parts.push(`󰇚${state.waitingFinalCount ?? 0} in ${formatDuration(state.waitingFinalDuration ?? 0)}`);
    }
  }

  if (state.stage === "prompt") {
    const remaining = Math.max(0, state.promptTotal - state.promptProcessed);
    const ratio = state.promptTotal > 0 ? state.promptProcessed / state.promptTotal : 0;
    const elapsed = state.promptStartedAt === undefined ? 0 : now - state.promptStartedAt;
    parts.push(`${SPINNER[state.spinner % SPINNER.length]} PP [${formatBar(ratio)}] ⏱ ${formatDuration(elapsed)} ${formatNumber(remaining)}/${formatNumber(state.promptTotal)} left ${Math.round(ratio * 100)}%`);
    if (state.promptSpeed !== undefined) parts.push(`${Math.round(state.promptSpeed)} t/s`);
  } else if (state.promptFinishedAt && state.promptDuration !== undefined) {
    const speed = state.promptSpeed === undefined ? "" : ` ≈ ${Math.round(state.promptSpeed)} t/s`;
    parts.push(`✓ PP ${formatDuration(state.promptDuration)} for ${formatNumber(state.promptTokens ?? 0)}${speed}`);
  }

  if (state.stage === "generation") {
    const elapsed = state.generationStartedAt === undefined ? 0 : now - state.generationStartedAt;
    const speed = state.generationDuration && state.generationTokens > 0
      ? ` ≈ ${Math.round(state.generationTokens / (state.generationDuration / 1000))} t/s`
      : "";
    parts.push(`${SPINNER[state.spinner % SPINNER.length]} TG ⏱ ${formatDuration(elapsed)} ${state.generationTokens}t${speed}`);
  } else if (state.generationFinishedAt && state.generationDuration !== undefined) {
    const speed = state.generationSpeed === undefined ? "" : ` ≈ ${Math.round(state.generationSpeed)} t/s`;
    parts.push(`✓ TG ${formatDuration(state.generationDuration)} for ${state.generationTokens}t${speed}`);
  }

  return parts.join(" │ ");
}

export default function (pi: ExtensionAPI) {
  const state = new FooterState();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let context: ExtensionContext | undefined;
  let lastMetrics: Metrics | undefined;

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const resetRequest = () => {
    state.requestActive = true;
    state.requestSeenQueued = false;
    state.waitingStartedAt = undefined;
    state.waitingFinalDuration = undefined;
    state.waitingFinalCount = undefined;
    state.promptStartedAt = undefined;
    state.promptFinishedAt = undefined;
    state.promptDuration = undefined;
    state.promptSpeed = undefined;
    state.generationStartedAt = undefined;
    state.generationFinishedAt = undefined;
    state.generationDuration = undefined;
    state.generationSpeed = undefined;
    state.promptTotal = 0;
    state.promptCached = 0;
    state.promptProcessed = 0;
    state.generationTokens = 0;
    state.stage = "idle";
  };

  const refreshStatus = () => {
    if (context?.hasUI) context.ui.setStatus(STATUS_KEY, renderStatus(state, Date.now()));
  };

  const poll = async () => {
    timer = undefined;
    if (!context || !context.hasUI) return;
    const model = getModelId(context);
    if (!model) {
      state.modelReady = false;
      state.model = "";
      refreshStatus();
      return;
    }

    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    try {
      const models = await getJson<{ data?: ModelInfo[] }>(`${SERVER_URL}/v1/models`, signal);
      const modelInfo = models.data?.find((item) => item.id === model);
      const modelStatus = modelInfo?.status?.value;
      state.model = model;
      state.modelReady = modelStatus === "loaded" || modelStatus === undefined;
      state.loadingProgress = modelInfo?.status?.progress;

      if (state.modelReady) {
        const [props, slots, metricsText] = await Promise.all([
          getJson<{ n_ctx?: number; total_slots?: number }>(modelQuery(`${SERVER_URL}/props`, model), signal),
          getJson<SlotInfo[]>(modelQuery(`${SERVER_URL}/slots`, model), signal),
          getText(modelQuery(`${SERVER_URL}/metrics`, model), signal),
        ]);
        state.slots = slots;
        state.metrics = parseMetrics(metricsText);
        state.contextSize = props.n_ctx ?? slots.find((slot) => slot.n_ctx)?.n_ctx ?? 0;
        const activeSlot = slots.find((slot) => slot.is_processing) ?? slots.find((slot) => slot.n_prompt_tokens !== undefined);
        if (activeSlot) {
          state.promptTotal = activeSlot.n_prompt_tokens ?? state.promptTotal;
          state.promptCached = activeSlot.n_prompt_tokens_cache ?? state.promptCached;
          state.promptProcessed = activeSlot.n_prompt_tokens_processed ?? state.promptProcessed;
          const decoded = activeSlot.n_decoded ?? 0;
          state.contextUsed = activeSlot.n_past ?? state.promptProcessed + decoded + state.promptCached;
          if (activeSlot.is_processing) {
            const processingPrompt = state.promptProcessed < state.promptTotal;
            state.stage = processingPrompt ? "prompt" : "generation";
            state.requestActive = true;
            if (processingPrompt && state.promptStartedAt === undefined) state.promptStartedAt = Date.now();
            if (!processingPrompt && state.generationStartedAt === undefined) state.generationStartedAt = Date.now();
            if (!processingPrompt) state.generationTokens = Math.max(state.generationTokens, decoded);
          }
        }
        const metrics = state.metrics;
        if (state.stage === "prompt" && lastMetrics && metrics.promptTokens > lastMetrics.promptTokens) {
          state.promptSpeed = (metrics.promptTokens - lastMetrics.promptTokens) / Math.max(0.001, metrics.promptSeconds - lastMetrics.promptSeconds);
        }
        if (state.stage === "generation" && lastMetrics && metrics.predictedTokens > lastMetrics.predictedTokens) {
          state.generationSpeed = (metrics.predictedTokens - lastMetrics.predictedTokens) / Math.max(0.001, metrics.predictedSeconds - lastMetrics.predictedSeconds);
        }
        state.waitingCount = metrics.requestsDeferred;
        if (state.requestActive && metrics.requestsDeferred > 0 && state.waitingStartedAt === undefined) {
          state.requestSeenQueued = true;
          state.waitingStartedAt = Date.now();
        }
        if (state.requestSeenQueued && state.waitingStartedAt !== undefined && metrics.requestsDeferred === 0 && state.stage !== "idle") {
          state.waitingFinalCount = Math.max(1, state.waitingFinalCount ?? 1);
          state.waitingFinalDuration = Date.now() - state.waitingStartedAt;
        }
        lastMetrics = metrics;
      }
    } catch {
      state.modelReady = false;
    }

    if (!state.requestActive && state.modelReady) {
      state.stage = "idle";
    }
    refreshStatus();
    timer = setTimeout(poll, state.requestActive ? POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS);
  };

  const startPolling = (ctx: ExtensionContext) => {
    context = ctx;
    clearTimer();
    void poll();
  };

  pi.on("session_start", async (_event, ctx) => {
    context = ctx;
    state.model = getModelId(ctx) ?? "";
    startPolling(ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    state.modelReady = false;
    state.loadingProgress = undefined;
    startPolling(ctx);
  });

  pi.on("input", async (_event, ctx) => {
    resetRequest();
    context = ctx;
    refreshStatus();
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    resetRequest();
    context = ctx;
    refreshStatus();
    startPolling(ctx);
  });

  pi.on("agent_settled", async (_event, ctx) => {
    state.requestActive = false;
    updateFinishedPrompt(state, Date.now());
    updateFinishedGeneration(state, Date.now());
    state.stage = "idle";
    context = ctx;
    refreshStatus();
    clearTimer();
    void poll();
  });

  pi.on("session_shutdown", async () => {
    clearTimer();
    controller?.abort();
    controller = undefined;
    context?.ui.setStatus(STATUS_KEY, undefined);
    context = undefined;
  });
}
