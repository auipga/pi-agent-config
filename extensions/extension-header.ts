import { VERSION, type ExtensionAPI, type Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, resolve } from "node:path";

type Kind = "skill" | "prompt" | "extension";
type Scope = "external" | "internal" | "project";

type Resource = {
	id: string;
	kind: Kind;
	label: string;
	scope: Scope;
	source: string;
	subgroup?: string;
};

type Inventory = {
	resources: Resource[];
	added: Resource[];
	removed: Resource[];
};

type PersistedHeaderState = {
	baseline: string[];
};

type PackageConfig = {
	source?: string;
	extensions?: string[];
	skills?: string[];
	prompts?: string[];
};

type Settings = {
	packages?: PackageConfig[];
	extensions?: string[];
	skills?: string[];
	prompts?: string[];
};

const AGENT_DIR = process.env.PI_AGENT_DIR ?? resolve(homedir(), ".pi/agent");
const STATE_PATH = process.env.PI_HEADER_STATE_PATH ?? resolve(homedir(), ".pi/header-state.json");
const SETTINGS_PATH = resolve(AGENT_DIR, "settings.json");

const KIND_LABEL: Record<Kind, string> = {
	skill: "skills",
	prompt: "prompts",
	extension: "extensions",
};

const KIND_ICON: Record<Kind, string> = {
	skill: "🧠",
	prompt: "💬",
	extension: "🧩",
};

function readJson<T>(path: string, fallback: T): T {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as T;
	} catch {
		return fallback;
	}
}

function enabledPath(value: string): string | undefined {
	if (value.startsWith("-")) return undefined;
	return value.startsWith("+") ? value.slice(1) : value;
}

function cleanName(value: string): string {
	let name = value.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? value;
	if (name === "index.ts" || name === "index.js") name = basename(dirname(value));
	name = name.replace(/\.(ts|tsx|js|jsx|md)$/, "");
	if (name === "SKILL") {
		const parent = basename(dirname(value));
		if (parent && parent !== ".") return parent;
	}
	return name;
}

type PathRule = {
	pattern: RegExp;
	replacement: string;
};

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PATH_RULES: PathRule[] = [
	{ pattern: new RegExp(`^${escapeRegExp(homedir())}`), replacement: "~" },
	{ pattern: /^~\/git\/auipga\//, replacement: "My " },
	{ pattern: /^~\/git\/me\//, replacement: "My " },
	{ pattern: /^~\/git\//, replacement: " " },
	{ pattern: /(^|[ /])nixos-config(?=[/ ]|$)/g, replacement: "$1" },
	{ pattern: /(^|[ /])pi-agent-config(?=[ /]|$)/g, replacement: "$1π" },
];

function shortPath(path: string): string {
	for (const rule of PATH_RULES) path = path.replace(rule.pattern, rule.replacement);
	return path;
}

function repoFromPath(path: string): string | undefined {
	const normalized = path.replace(/\\/g, "/");
	const match = normalized.match(/(?:^|\/)git\/([^/]+)\/([^/]+)/);
	return match ? `${match[1]}/${match[2]}` : undefined;
}

function sourceLabel(source: string, resolvedSource?: string): string {
	if (source.startsWith("npm:")) return ` ${source.slice(4)}`;
	if (source.startsWith("git:github.com/")) return ` ${source.slice("git:github.com/".length)}`;
	const repo = repoFromPath(resolvedSource ?? source);
	return repo ? ` ${repo}` : cleanName(source);
}

function skillSubgroup(value: string): string | undefined {
	const parts = value.replace(/\\/g, "/").split("/").filter(Boolean);
	const skillsIndex = parts.lastIndexOf("skills");
	const subgroup = skillsIndex >= 0 ? parts[skillsIndex + 1] : undefined;
	const skillDirectory = parts.length >= 2 ? parts[parts.length - 2] : undefined;
	if (subgroup === skillDirectory) return undefined;
	return subgroup && subgroup !== "SKILL.md" ? subgroup : undefined;
}

function packageDisplayName(source: string): string {
	if (source.startsWith("git:github.com/")) return source.slice("git:github.com/".length).split("/").pop() ?? source;
	if (source.startsWith("npm:")) return source.slice(4);
	return basename(resolveConfiguredPath(source, AGENT_DIR));
}

function resourceDisplayName(value: string, source: string): string {
	const name = cleanName(value);
	const isIndexEntry = /(?:^|\/)index\.(?:ts|tsx|js|jsx)$/.test(value);
	return isIndexEntry && (name === "." || name === "src") ? packageDisplayName(source) : name;
}

function classify(path: string, cwd: string): Scope {
	const resolvedPath = resolve(path);
	if (resolvedPath === cwd || resolvedPath.startsWith(`${cwd}/`)) return "project";
	if (resolvedPath === AGENT_DIR || resolvedPath.startsWith(`${AGENT_DIR}/`)) return "internal";
	return "external";
}

function resolveConfiguredPath(value: string, base: string): string {
	if (value.startsWith("~")) return resolve(homedir(), value.slice(2));
	return resolve(isAbsolute(value) ? value : resolve(base, value));
}

function packageRoot(source: string): string | undefined {
	if (source.startsWith("git:github.com/")) {
		const repo = source.slice("git:github.com/".length);
		return resolve(homedir(), "git", repo);
	}
	if (source.startsWith("npm:")) return undefined;
	return resolveConfiguredPath(source, AGENT_DIR);
}

function addResource(resources: Resource[], resource: Resource): void {
	if (!resources.some((item) => item.id === resource.id)) resources.push(resource);
}

function collectSettingsResources(settings: Settings, cwd: string): Resource[] {
	const resources: Resource[] = [];

	const addConfigured = (kind: Kind, value: string, source = value): void => {
		const path = resolveConfiguredPath(value, AGENT_DIR);
		const scope = classify(path, cwd);
		addResource(resources, {
			id: `${kind}:${path}`,
			kind,
			label: cleanName(path),
			scope,
			source: scope === "external" ? sourceLabel(source, path) : "local",
			subgroup: kind === "skill" ? skillSubgroup(path) : undefined,
		});
	};

	for (const value of settings.extensions ?? []) {
		const enabled = enabledPath(value);
		if (enabled) addConfigured("extension", enabled);
	}
	for (const value of settings.skills ?? []) {
		const enabled = enabledPath(value);
		if (enabled) addConfigured("skill", enabled);
	}
	for (const value of settings.prompts ?? []) {
		const enabled = enabledPath(value);
		if (enabled) addConfigured("prompt", enabled);
	}

	for (const pkg of settings.packages ?? []) {
		if (!pkg.source) continue;
		const root = packageRoot(pkg.source);
		const addPackageEntries = (kind: Kind, entries: string[] | undefined): void => {
			for (const value of entries ?? []) {
				const enabled = enabledPath(value);
				if (!enabled) continue;
				addResource(resources, {
					id: `${kind}:${pkg.source}:${enabled}`,
					kind,
					label: resourceDisplayName(enabled, pkg.source),
					scope: "external",
					source: sourceLabel(pkg.source, root),
					subgroup: kind === "skill" ? skillSubgroup(enabled) : undefined,
				});
			}
		};
		addPackageEntries("extension", pkg.extensions);
		addPackageEntries("skill", pkg.skills);
		addPackageEntries("prompt", pkg.prompts);
	}

	// Project-local skills are discovered by Pi even when they are not listed in
	// the global settings file. Pi's project convention is one directory per skill.
	const projectSkills = resolve(cwd, ".agents/skills");
	if (existsSync(projectSkills)) {
		for (const entry of readdirSync(projectSkills)) {
			const skillDir = resolve(projectSkills, entry);
			if (!statSync(skillDir).isDirectory()) continue;
			const skillFile = resolve(skillDir, "SKILL.md");
			if (!existsSync(skillFile)) continue;
			addResource(resources, {
				id: `skill:${skillFile}`,
				kind: "skill",
				label: entry,
				scope: "project",
				source: "project",
			});
		}
	}

	return resources;
}

function loadInventory(cwd: string): Resource[] {
	return collectSettingsResources(readJson<Settings>(SETTINGS_PATH, {}), cwd).sort((a, b) =>
		a.id.localeCompare(b.id),
	);
}

function loadState(): PersistedHeaderState {
	return readJson<PersistedHeaderState>(STATE_PATH, { baseline: [] });
}

function trackedResources(resources: Resource[]): Resource[] {
	return resources.filter((resource) => resource.scope !== "project");
}

function isProjectResourceId(id: string): boolean {
	return id.replace(/\\/g, "/").includes("/.agents/skills/");
}

function saveState(resources: Resource[]): void {
	const tracked = trackedResources(resources);
	writeFileSync(STATE_PATH, `${JSON.stringify({ baseline: tracked.map((resource) => resource.id).sort() }, null, 2)}\n`);
}

function diffInventory(resources: Resource[]): Inventory {
	if (!existsSync(STATE_PATH)) {
		saveState(resources);
		return { resources, added: [], removed: [] };
	}
	const previous = new Set(loadState().baseline.filter((id) => !isProjectResourceId(id)));
	const current = new Set(trackedResources(resources).map((resource) => resource.id));
	const added = trackedResources(resources).filter((resource) => !previous.has(resource.id));
	const removed = [...previous].filter((id) => !current.has(id)).map((id) => {
		const [kind, ...parts] = id.split(":");
		return {
			id,
			kind: (kind as Kind) || "extension",
			label: cleanName(parts.join(":")),
			scope: "external" as Scope,
			source: "previous startup",
		};
	});
	return { resources, added, removed };
}

function groupResources(resources: Resource[]): Map<string, Resource[]> {
	const groups = new Map<string, Resource[]>();
	for (const resource of resources) {
		const key = resource.scope === "external" ? resource.source : resource.scope;
		const group = groups.get(key) ?? [];
		group.push(resource);
		groups.set(key, group);
	}

	const ordered = new Map<string, Resource[]>();
	const project = groups.get("project");
	if (project) ordered.set("project", project);
	const internal = groups.get("internal");
	if (internal) ordered.set("internal", internal);
	for (const [key, group] of groups) {
		if (key !== "internal" && key !== "project") ordered.set(key, group);
	}
	return ordered;
}

function countKinds(resources: Resource[]): string {
	const counts = new Map<Kind, number>();
	for (const resource of resources) counts.set(resource.kind, (counts.get(resource.kind) ?? 0) + 1);
	return [...counts.entries()]
		.map(([kind, count]) => `${count} ${KIND_LABEL[kind].replace(/s$/, count === 1 ? "" : "s")}`)
		.join(" · ");
}

function displayGroupName(key: string): string {
	if (key === "internal") return "User";
	if (key === "project") return "Project";
	return key;
}

class HeaderComponent {
	private expanded = false;
	private inventory: Inventory;
	private readonly tui: { requestRender(): void };
	private readonly theme: Theme;
	private readonly session: { getSessionFile(): string | undefined };
	private readonly cwd: string;

	constructor(
		tui: { requestRender(): void },
		theme: Theme,
		inventory: Inventory,
		session: { getSessionFile(): string | undefined },
		cwd: string,
	) {
		this.tui = tui;
		this.theme = theme;
		this.inventory = inventory;
		this.session = session;
		this.cwd = cwd;
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		this.tui.requestRender();
	}

	refresh(inventory: Inventory): void {
		this.inventory = inventory;
		this.tui.requestRender();
	}

	private color(color: Parameters<Theme["fg"]>[0], text: string): string {
		return this.theme.fg(color, text);
	}

	private boxLine(content: string, width: number): string {
		const innerWidth = Math.max(1, width - 4);
		const fitted = truncateToWidth(content, innerWidth, "…");
		return this.color("border", `│ ${fitted}${" ".repeat(Math.max(0, innerWidth - visibleWidth(fitted)))} │`);
	}

	private box(title: string, body: string[], width: number): string[] {
		const heading = `╭─ ${title} `;
		const top = truncateToWidth(this.color("border", heading), width - 1, "") + this.color("border", "─".repeat(Math.max(0, width - visibleWidth(heading) - 1)) + "╮");
		const bottom = this.color("border", `╰${"─".repeat(Math.max(0, width - 2))}╯`);
		return [top, ...body.map((line) => this.boxLine(line, width)), bottom];
	}

	private summaryBody(): string[] {
		const { added, removed } = this.inventory;
		const body: string[] = [];
		if (added.length > 0) {
			body.push(this.color("warning", `⚠️ +${added.length} added`));
			for (const [key, group] of groupResources(added)) {
				const title = key === "internal" || key === "project" ? displayGroupName(key) : key;
				body.push(this.color("mdHeading", `[${title}]`));
				for (const resource of group) body.push(`  ${KIND_ICON[resource.kind]} ${resource.label}`);
			}
		}
		if (removed.length > 0) {
			body.push(this.color("warning", `⚠️ +${removed.length} removed`));
			for (const [key, group] of groupResources(removed)) {
				const title = key === "internal" || key === "project" ? displayGroupName(key) : key;
				body.push(this.color("mdHeading", `[${title}]`));
				for (const resource of group) body.push(`  ${KIND_ICON[resource.kind]} ${resource.label}`);
			}
		}
		return body;
	}

	private expandedBody(): string[] {
		const { resources, added, removed } = this.inventory;
		const addedIds = new Set(added.map((resource) => resource.id));
		const body: string[] = [];
		if (removed.length > 0) {
			body.push(this.color("warning", "[⚠️ Removed since acknowledged startup]"));
			for (const resource of removed) body.push(`− ${KIND_ICON[resource.kind]} ${resource.label}`);
		}
		for (const [key, group] of groupResources(resources)) {
			const only = group[0];
			const sourceName = key.replace(/^[^ ]+ /, "").split("/").pop();
			const resourceName = only?.label.split("/").pop();
			if (group.length === 1 && only && sourceName === resourceName) {
				const marker = addedIds.has(only.id) ? " ⚠️" : "";
				const kind = only.kind === "extension" ? "" : ` ${KIND_LABEL[only.kind].replace(/s$/, "")}`;
				body.push(this.color("mdHeading", `[${KIND_ICON[only.kind]} · ${key}${kind}]${marker}`));
				continue;
			}
			const title = `${displayGroupName(key)}`;
			body.push(this.color("mdHeading", `${title}`));
			const subgroups = new Map<string, Resource[]>();
			for (const resource of group) {
				const subgroup = resource.kind === "skill" && resource.subgroup ? resource.subgroup : "";
				const subgroupResources = subgroups.get(subgroup) ?? [];
				subgroupResources.push(resource);
				subgroups.set(subgroup, subgroupResources);
			}
			for (const [subgroup, subgroupResources] of subgroups) {
				if (!subgroup) {
					for (const resource of subgroupResources) {
						const marker = addedIds.has(resource.id) ? " ⚠️" : "";
						body.push(`  ${KIND_ICON[resource.kind]} ${resource.label}${marker}`);
					}
					continue;
				}
				body.push(`  ${subgroup}/`);
				for (const resource of subgroupResources) {
					const marker = addedIds.has(resource.id) ? " ⚠️" : "";
					body.push(`  ${KIND_ICON[resource.kind]} ${resource.label}${marker}`);
				}
			}
		}
		return body;
	}

	render(width: number): string[] {
		return this.box(
			shortPath(this.cwd) + ` · ${this.session.getSessionFile() ? "💾" : "⚡"} Pi ${VERSION}`,
			this.expanded ? this.expandedBody() : this.summaryBody(),
			width
		);
	}

	invalidate(): void {}
}

export default function (pi: ExtensionAPI) {
	let currentHeader: HeaderComponent | undefined;
	let currentInventory: Inventory | undefined;

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		currentInventory = diffInventory(loadInventory(ctx.cwd));
		ctx.ui.setHeader((tui, theme) => {
			currentHeader = new HeaderComponent(tui, theme, currentInventory!, ctx.sessionManager, ctx.cwd);
			return currentHeader;
		});
	});

	pi.registerCommand("header-acknowledge", {
		description: "Acknowledge the custom header startup inventory diff",
		handler: async (args, ctx) => {
			if (!currentInventory) return;
			saveState(currentInventory.resources);
			currentInventory = { resources: currentInventory.resources, added: [], removed: [] };
			currentHeader?.refresh(currentInventory);
			ctx.ui.notify("Header startup diff acknowledged", "info");
		},
	});
}
