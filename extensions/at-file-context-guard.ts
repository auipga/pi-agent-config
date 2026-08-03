import {
	CONFIG_DIR_NAME,
	isToolCallEventType,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { resolve } from "node:path";

const FILE_BLOCK_PATTERN = /<file name="([^"]+)">[\s\S]*?<\/file>/g;
const RAW_AT_PATH_PATTERN = /(?:^|\s)@((?:"[^"]+"|'[^']+'|\S+))/g;
const EXPLORATORY_BASH_PATTERN = /(^|[\s;|&()])(?:ls|find|fd|rg|grep|cat|sed|awk|head|tail|tree|bat|less|more)\b/;

type GuardState = {
	active: boolean;
	allowedPaths: Set<string>;
};

function normalizeAtToken(token: string): string {
	const trimmed = token.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1);
	}
	return trimmed.replace(/[),.;:]+$/, "");
}

function extractReferencedPaths(prompt: string, cwd: string): Set<string> {
	const paths = new Set<string>();

	for (const match of prompt.matchAll(FILE_BLOCK_PATTERN)) {
		paths.add(resolve(match[1]));
	}

	for (const match of prompt.matchAll(RAW_AT_PATH_PATTERN)) {
		paths.add(resolve(cwd, normalizeAtToken(match[1])));
	}

	return paths;
}

function pathFromToolInput(input: unknown): string | undefined {
	if (typeof input !== "object" || input === null || !("path" in input)) return undefined;
	const value = (input as { path?: unknown }).path;
	return typeof value === "string" ? value : undefined;
}

function isAllowedPath(path: string, cwd: string, allowedPaths: Set<string>): boolean {
	return allowedPaths.has(resolve(cwd, path));
}

function buildInstructions(): string {
	return `@ file context guard is active for this turn.

Rules:
- Treat the referenced @ files as the complete intended context.
- Do not inspect files outside the referenced paths with read, ls, grep, find, bash, or other tools.
- If you are really sure other file context is required, stop and ask the user in normal text. Include a concise justification and the exact files or context needed.
- Do not access additional files until the user explicitly approves.
- Prefer answering from the provided file context when possible.`;
}

export default function (pi: ExtensionAPI) {
	const state: GuardState = {
		active: false,
		allowedPaths: new Set<string>(),
	};

	pi.on("before_agent_start", (event, ctx) => {
		const referencedPaths = extractReferencedPaths(event.prompt, ctx.cwd);
		state.active = referencedPaths.size > 0;
		state.allowedPaths = referencedPaths;

		if (!state.active) return;

		return {
			systemPrompt: `${event.systemPrompt}\n\n${buildInstructions()}`,
			message: {
				customType: "at-file-context-guard",
				display: true,
				content: `@ file context guard active. Allowed referenced paths:\n${[...referencedPaths]
					.map((path) => `- ${path}`)
					.join("\n")}\n\nProject-local extension: ${CONFIG_DIR_NAME}/extensions/at-file-context-guard.ts`,
			},
		};
	});

	pi.on("tool_call", (event, ctx) => {
		if (!state.active) return;

		if (
			isToolCallEventType("read", event) ||
			isToolCallEventType("grep", event) ||
			isToolCallEventType("find", event) ||
			isToolCallEventType("ls", event)
		) {
			const inputPath = pathFromToolInput(event.input);
			if (!inputPath || !isAllowedPath(inputPath, ctx.cwd, state.allowedPaths)) {
				return {
					block: true,
					reason:
						"@ file context guard blocked file exploration outside referenced paths. Ask the user in normal text for approval, with a concise justification and exact requested context.",
				};
			}
		}

		if (isToolCallEventType("bash", event)) {
			const command = typeof event.input.command === "string" ? event.input.command : "";
			if (EXPLORATORY_BASH_PATTERN.test(command)) {
				return {
					block: true,
					reason:
						"@ file context guard blocked exploratory shell file inspection. Ask the user in normal text for approval, with a concise justification and exact requested context.",
				};
			}
		}
	});
}
