import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const openLlama = async () => {
    await pi.sendUserMessage("/llama", { expandPromptTemplates: true });
  };

  pi.registerShortcut("alt+l", {
    description: "Open llama.cpp model manager",
    handler: openLlama,
  });

}
