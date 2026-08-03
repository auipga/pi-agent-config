import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function currentDate(): string {
	return new Date().toISOString().slice(0, 10);
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("date", {
		description: "Inject current date",
		handler: async () => {
			pi.sendUserMessage(`Current date: ${currentDate()}`);
		},
		// in case you want to edit it before sending:
		// handler: async (_args, ctx) => {
		//   ctx.ui.pasteToEditor(`Current date: ${currentDate()}`);
		// },
	});
}
