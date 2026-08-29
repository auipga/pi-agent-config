import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const SERVER_URL = "http://127.0.0.1:9931";
const API_KEY = "dummy";
const POLL_INTERVAL_MS = 250;
const IDLE_POLL_INTERVAL_MS = 2_000;
const STATUS_KEY = "llama-footer";
const READY = "✓";
const ERROR_BG = "\x1b[48;5;160m";
const ERROR_FG = "\x1b[38;5;255m";
const ANSI_RESET = "\x1b[0m";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/*
 * TODO inventory — keep these visible until explicitly checked off:
 *
 * API/data:
 * - Verify all SlotInfo fields against the deployed llama.cpp version.
 * - Confirm whether next_token.n_decoded and legacy n_decoded have identical
 *   semantics across supported server versions.
 * - Decide whether additional /metrics values are needed.
 * - Compare /v1/models loading progress with /models/sse progress.
 * - Confirm /props is authoritative for context size.
 *
 * Request/state:
 * - Correlate the active slot using id_task when requests can overlap.
 * - Determine whether requests_deferred can provide a request-specific queue
 *   position rather than only a global deferred count.
 * - Verify that idle-slot transitions and transient polling errors preserve
 *   the correct request snapshot in every lifecycle case.
 * - Verify that input is the correct pre-queue reset event.
 *
 * Timing/performance:
 * - Decide whether instantaneous prompt/generation samples should become a
 *   moving average.
 * - Independently compare final PP/TG timings with llama.cpp timings.
 * - Decide whether polling/status updates need debouncing.
 *
 * Rendering:
 * - Decide whether completed/total or remaining/total is the right PP label.
 * - Confirm fractional glyphs and context percentage in the compact footer.
 * - Add distinct cached/processed/remaining prompt segments to the bar.
 * - Add width-aware truncation for narrow terminals.
 *
 * Configuration/errors:
 * - Decide whether hardcoded server URL/API key should remain first-version
 *   configuration.
 * - Decide whether unavailable /metrics should fall back fully to /slots.
 * - Decide whether polling errors need an explicit visible state.
 */

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
  next_token?: {
    n_decoded?: number;
  } | Array<{
    n_decoded?: number;
  }>;
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
  requestPredictedTokensStart?: number;
  lastPromptSample?: number;
  lastPromptEvaluatedSample?: number;
  lastPromptSampleAt?: number;
  lastGenerationSample?: number;
  lastGenerationSampleAt?: number;
  waitingStartedAt?: number;
  waitingCount = 0; // wait list number
  waitingFinalCount?: number;
  waitingFinalDuration?: number;
  requestActive = false;
  requestSeenQueued = false;
  stage: "idle" | "prompt" | "generation" = "idle";
  spinner = 0;
  serverErrorCount = 0;
  errorFade = 1;
  idleSince?: number;
}

function formatNumber(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}k`;
  return `${Math.round(value)}`;
}

function formatDuration(milliseconds: number): string {
  let seconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, "0")}`;
  return `${seconds}s`;
}

function formatBar(value: number, width = 20): string {
  const fraction = Math.max(0, Math.min(1, value)) * width;
  const filled = Math.floor(fraction);
  const partial = Math.round((fraction - filled) * 8);
  const partialGlyphs = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];
  const partialText = filled < width ? partialGlyphs[partial] : "";
  const remaining = width - filled - (partialText ? 1 : 0);
  return "█".repeat(filled) + partialText + "░".repeat(Math.max(0, remaining));
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

function getDecodedTokens(slot: SlotInfo): number {
  // The documented/current location is next_token.n_decoded. Prefer it so
  // a legacy top-level value cannot keep an old generation count alive.
  const nextToken = Array.isArray(slot.next_token) ? slot.next_token[0] : slot.next_token;
  if (typeof nextToken?.n_decoded === "number") return nextToken.n_decoded;
  return slot.n_decoded ?? 0;
}

async function request(url: string, signal: AbortSignal): Promise<Response> {
  const response = await fetch(url, {
    signal,
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  return (await (await request(url, signal)).json()) as T;
}

async function getText(url: string, signal: AbortSignal): Promise<string> {
  return (await request(url, signal)).text();
}

function getModelId(ctx: ExtensionContext): string | undefined {
  if (ctx.model?.provider !== "llama.cpp") return undefined;
  return ctx.model.id;
}

function finishPrompt(state: FooterState, now: number) {
  if (state.promptFinishedAt || state.promptStartedAt === undefined) return;
  state.promptFinishedAt = now;
  state.promptDuration = Math.max(0, now - state.promptStartedAt);
  // Prompt processing excludes tokens reused from the cache. Prefer the
  // observed processed count, with total-minus-cache as a fallback.
  state.promptTokens = Math.max(0, state.promptTotal - state.promptCached);
  state.promptSpeed = state.promptDuration > 0
    ? state.promptTokens / (state.promptDuration / 1000)
    : undefined;
}

function updateFinishedPrompt(state: FooterState, now: number) {
  if (state.promptFinishedAt || state.promptStartedAt === undefined) return;
  if (state.stage === "prompt" || state.requestActive) return;
  finishPrompt(state, now);
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

function renderErrorBadge(state: FooterState): string {
  if (state.serverErrorCount <= 0 || state.errorFade <= 0) return "";
  const slide = " ".repeat(Math.round((1 - state.errorFade) * 3));
  return `${slide}${ERROR_BG}${ERROR_FG}\x1b[1m ${state.serverErrorCount} ${ANSI_RESET}`;
}

function renderStatus(state: FooterState, now: number): string {
  if (!state.modelReady) {
    const progress = state.loadingProgress === undefined ? "" : ` ${Math.round(state.loadingProgress * 100)}%`;
    return `${SPINNER[state.spinner % SPINNER.length]} │ Model [${formatBar(state.loadingProgress ?? 0)}]${progress}`;
  }

  const contextRatio = state.contextSize > 0 ? state.contextUsed / state.contextSize : 0;
  const context = state.contextSize > 0
    ? `Ctx [${formatBar(contextRatio)}] ${formatNumber(state.contextUsed)}/${formatNumber(state.contextSize)} ${Math.round(contextRatio * 100)}%`
    : "Ctx [???]";
  const errorBadge = renderErrorBadge(state);
  const parts = [`${READY}${errorBadge}`, context];

  if (state.requestSeenQueued) {
    if (state.waitingStartedAt !== undefined && state.waitingFinalDuration === undefined) {
      parts.push(`󰇚${state.waitingCount} ⏱ ${formatDuration(now - state.waitingStartedAt)}`);
    } else {
      parts.push(`󰇚${state.waitingFinalCount ?? 0} in ${formatDuration(state.waitingFinalDuration ?? 0)}`);
    }
  }

  if (state.stage === "prompt") {
    const completed = Math.min(state.promptTotal, state.promptProcessed);
    const ratio = state.promptTotal > 0 ? completed / state.promptTotal : 0;
    const elapsed = state.promptStartedAt === undefined ? 0 : now - state.promptStartedAt;
    parts.push(`${SPINNER[state.spinner % SPINNER.length]} PP [${formatBar(ratio)}] ⏱ ${formatDuration(elapsed)} ${formatNumber(completed)}/${formatNumber(state.promptTotal)} ${Math.round(ratio * 100)}%`);
    if (state.promptSpeed !== undefined) parts.push(`${Math.round(state.promptSpeed)} tps`);
  } else if (state.promptFinishedAt && state.promptDuration !== undefined) {
    const speed = state.promptSpeed === undefined ? "" : ` ≈ ${Math.round(state.promptSpeed)} tps`;
    parts.push(`✓ PP ${formatDuration(state.promptDuration)} for ${formatNumber(state.promptTokens ?? 0)}${speed}`);
  }

  if (state.stage === "generation") {
    const elapsed = state.generationStartedAt === undefined ? 0 : now - state.generationStartedAt;
    const speed = state.generationSpeed !== undefined
      ? ` ≈ ${Math.round(state.generationSpeed)} tps`
      : "";
    parts.push(`${SPINNER[state.spinner % SPINNER.length]} TG ⏱ ${formatDuration(elapsed)} ${state.generationTokens}t${speed}`);
  } else if (state.generationFinishedAt && state.generationDuration !== undefined) {
    const speed = state.generationSpeed === undefined ? "" : ` ≈ ${Math.round(state.generationSpeed)} tps`;
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
    state.idleSince = undefined;
    state.serverErrorCount = 0;
    state.errorFade = 1;
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
    state.requestPredictedTokensStart = undefined;
    state.lastPromptSample = undefined;
    state.lastPromptEvaluatedSample = undefined;
    state.lastPromptSampleAt = undefined;
    state.lastGenerationSample = undefined;
    state.lastGenerationSampleAt = undefined;
    lastMetrics = undefined;
    state.promptTotal = 0;
    state.promptCached = 0;
    state.promptProcessed = 0;
    state.generationTokens = 0;
    state.stage = "idle";
  };

  let fadeTimer: ReturnType<typeof setTimeout> | undefined;

  const refreshStatus = () => {
    if (context?.hasUI) context.ui.setStatus(STATUS_KEY, renderStatus(state, Date.now()));
  };

  const fadeErrorBadge = () => {
    if (fadeTimer !== undefined || state.serverErrorCount <= 0) return;
    const frames = [0.75, 0.5, 0.25, 0];
    const advance = () => {
      state.errorFade = frames.shift() ?? 0;
      if (state.errorFade === 0) state.serverErrorCount = 0;
      refreshStatus();
      if (state.errorFade > 0) fadeTimer = setTimeout(advance, 125);
      else fadeTimer = undefined;
    };
    fadeTimer = setTimeout(advance, 125);
  };

  const poll = async () => {
    timer = undefined;
    state.spinner++;
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
        const metrics = state.metrics;
        if (state.requestPredictedTokensStart === undefined) {
          state.requestPredictedTokensStart = metrics.predictedTokens;
        }
        const predictedThisRequest = Math.max(
          0,
          metrics.predictedTokens - state.requestPredictedTokensStart,
        );
        const generationStartedSinceLastPoll =
          lastMetrics !== undefined && metrics.predictedTokens > lastMetrics.predictedTokens;
        state.contextSize = props.n_ctx ?? modelInfo?.meta?.n_ctx ?? 0;
        // Only an actively processing slot belongs to the current request.
        // Idle slots retain old prompt metadata and must never overwrite the
        // request snapshot or reset the context display.
        const activeSlot = slots.find((slot) => slot.is_processing);
        if (activeSlot) {
          state.promptTotal = activeSlot.n_prompt_tokens ?? state.promptTotal;
          state.promptCached = activeSlot.n_prompt_tokens_cache ?? state.promptCached;
          const decoded = getDecodedTokens(activeSlot);
          // The deployed server reports cached prompt tokens separately from
          // the newly evaluated batch. Together they are the prompt position;
          // n_prompt_tokens_processed alone is not cumulative.
          const evaluated = activeSlot.n_prompt_tokens_processed ?? 0;
          const promptPosition = activeSlot.n_past ??
            Math.min(state.promptTotal, state.promptCached + evaluated);
          const sampleAt = Date.now();
          if (state.stage === "prompt" &&
              state.lastPromptEvaluatedSample !== undefined &&
              state.lastPromptSampleAt !== undefined &&
              evaluated > state.lastPromptEvaluatedSample) {
            const elapsed = (sampleAt - state.lastPromptSampleAt) / 1000;
            if (elapsed > 0) state.promptSpeed =
              (evaluated - state.lastPromptEvaluatedSample) / elapsed;
          }
          state.promptProcessed = promptPosition;
          state.lastPromptSample = promptPosition;
          state.lastPromptEvaluatedSample = evaluated;
          state.lastPromptSampleAt = sampleAt;
          state.contextUsed = activeSlot.n_past ??
            state.promptProcessed + decoded;
          if (activeSlot.is_processing) {
            // Current llama.cpp versions expose this as next_token.n_decoded;
            // older versions exposed a top-level n_decoded field. Prompt
            // progress takes precedence: decoded can be stale/non-zero while
            // the server is still filling the context.
            const hasPromptProgress = state.promptTotal > 0;
            const promptComplete = hasPromptProgress && state.promptProcessed >= state.promptTotal;
            // n_prompt_tokens can continue changing around the PP/TG
            // boundary. A decoded token is direct evidence that generation
            // has begun; the metric catches generations between slot polls.
            const generating = decoded > 0 || generationStartedSinceLastPoll ||
              (hasPromptProgress && promptComplete);
            const now = Date.now();
            const wasGenerating = state.stage === "generation";
            if (generating) {
              // Close PP before starting TG so PP timing excludes generation.
              finishPrompt(state, now);
              state.stage = "generation";
              state.requestActive = true;
              if (state.generationStartedAt === undefined) state.generationStartedAt = now;
              state.generationTokens = Math.max(state.generationTokens, decoded, predictedThisRequest);
              if (wasGenerating && state.lastGenerationSample !== undefined &&
                  state.lastGenerationSampleAt !== undefined && decoded > state.lastGenerationSample) {
                const elapsed = (now - state.lastGenerationSampleAt) / 1000;
                if (elapsed > 0) state.generationSpeed =
                  (decoded - state.lastGenerationSample) / elapsed;
              }
              state.lastGenerationSample = Math.max(decoded, predictedThisRequest);
              state.lastGenerationSampleAt = now;
            } else {
              state.stage = "prompt";
              state.requestActive = true;
              if (state.promptStartedAt === undefined) state.promptStartedAt = now;
            }
          }
        }
        if (state.stage === "generation" && lastMetrics && metrics.predictedTokens > lastMetrics.predictedTokens) {
          state.generationSpeed = (metrics.predictedTokens - lastMetrics.predictedTokens) /
            Math.max(0.001, metrics.predictedSeconds - lastMetrics.predictedSeconds);
        }
        state.waitingCount = metrics.requestsDeferred;
        if (state.requestActive && metrics.requestsDeferred > 0 && state.waitingStartedAt === undefined) {
          state.requestSeenQueued = true;
          state.waitingStartedAt = Date.now();
        }
        if (state.requestSeenQueued && state.waitingStartedAt !== undefined &&
            metrics.requestsDeferred === 0 && state.waitingFinalDuration === undefined) {
          state.waitingFinalCount = Math.max(1, state.waitingCount);
          state.waitingFinalDuration = Date.now() - state.waitingStartedAt;
        }
        lastMetrics = metrics;
      }
    } catch {
      // Keep the last good request snapshot during transient polling errors,
      // but expose each failed polling cycle through the connection badge.
      state.serverErrorCount++;
      state.errorFade = 1;
    }

    if (!state.requestActive && state.modelReady) {
      if (state.idleSince === undefined) state.idleSince = Date.now();
      if (state.serverErrorCount > 0 && Date.now() - state.idleSince >= 30_000) {
        fadeErrorBadge();
      }
    } else {
      state.idleSince = undefined;
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

  pi.on("message_update", async (_event, ctx) => {
    // Pi may display "Thinking..." before llama.cpp has finished prompt
    // evaluation. Do not use this event as the PP/TG boundary.
    context = ctx;
    refreshStatus();
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role !== "assistant") return;
    const outputTokens = event.message.usage?.output ?? 0;
    if (outputTokens > 0) {
      state.generationTokens = Math.max(state.generationTokens, outputTokens);
      // Fallback for providers that emit message_end without updates.
      if (state.generationStartedAt === undefined) {
        state.generationStartedAt = Date.now();
        state.stage = "generation";
      }
    }
    context = ctx;
    refreshStatus();
  });

  pi.on("agent_settled", async (_event, ctx) => {
    state.requestActive = false;
    state.idleSince = Date.now();
    state.stage = "idle";
    updateFinishedPrompt(state, Date.now());
    updateFinishedGeneration(state, Date.now());
    context = ctx;
    refreshStatus();
    clearTimer();
    void poll();
  });

  pi.on("session_shutdown", async () => {
    clearTimer();
    if (fadeTimer !== undefined) clearTimeout(fadeTimer);
    controller?.abort();
    controller = undefined;
    context?.ui.setStatus(STATUS_KEY, undefined);
    context = undefined;
  });
}
