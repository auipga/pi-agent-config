import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("system-prompt", {
    handler: async (_args, ctx) =>
      pi.sendMessage({
        customType: "system-prompt",
        content: ctx.getSystemPrompt(),
        display: true,
      }),
  });
}
