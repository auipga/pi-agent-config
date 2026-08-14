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
			message: {
				customType: "manual-context-guard",
				display: false,
				content: `Readinge nothing more than the attached paths.`,
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
					reason: "blocked exploration outside referenced paths.",
				};
			}
		}

		if (isToolCallEventType("bash", event)) {
			const command = typeof event.input.command === "string" ? event.input.command : "";
			if (EXPLORATORY_BASH_PATTERN.test(command)) {
				return {
					block: true,
					reason: "blocked exploratory shell file inspection.",
				};
			}
		}
	});
}
