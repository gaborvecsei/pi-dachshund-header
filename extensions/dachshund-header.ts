import { VERSION, getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPets, renderFrame, type Pet } from "./pet.ts";

const BUNDLED_PETS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "pets");

/** Project pets win over user pets, user pets win over bundled ones. One random pet from the first non-empty folder. */
function pickPet(cwd: string): Pet | undefined {
	const pets = loadPets([join(cwd, ".pi", "pets"), join(getAgentDir(), "pets"), BUNDLED_PETS_DIR]);
	return pets[Math.floor(Math.random() * pets.length)];
}

function displayPath(path: string): string {
	const home = homedir();
	return home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path;
}

async function getGitSummary(pi: ExtensionAPI, cwd: string): Promise<string> {
	try {
		const result = await pi.exec("git", ["status", "--short", "--branch"], { cwd, timeout: 1_000 });
		if (result.code !== 0) return "not a git repository";

		const [head = "", ...changes] = result.stdout.trimEnd().split("\n");
		const branch = head
			.replace(/^## /, "")
			.replace(/^No commits yet on /, "")
			.split("...")[0];
		return `${branch || "detached"} · ${changes.length ? `${changes.length} changed` : "clean"}`;
	} catch {
		return "git unavailable";
	}
}

export default function dachshundHeader(pi: ExtensionAPI) {
	pi.on("session_start", async (event, ctx) => {
		if (ctx.mode !== "tui") return;

		const pet = pickPet(ctx.cwd);
		if (!pet) return;

		const gitSummary = await getGitSummary(pi, ctx.cwd);
		const messageCount = ctx.sessionManager.getEntries().filter(
			(entry) => entry.type === "message" && (entry.message.role === "user" || entry.message.role === "assistant"),
		).length;
		const sessionState = event.reason === "new" || messageCount === 0
			? "new session"
			: `${event.reason === "fork" ? "forked" : event.reason === "reload" ? "reloaded" : "resumed"} · ${messageCount} messages`;

		ctx.ui.setHeader((tui, theme) => {
			let step = 0;
			let ticks = 0;
			const totalTicks = pet.sequence.length * pet.loops;
			const timer = setInterval(() => {
				step = (step + 1) % pet.sequence.length;
				if (++ticks >= totalTicks) {
					clearInterval(timer);
					step = 0;
				}
				tui.requestRender();
			}, pet.interval);
			timer.unref();

			return {
				render(width: number): string[] {
					const logo = renderFrame(pet, pet.sequence[step], theme);
					const logoWidth = Math.max(...logo.map(visibleWidth));
					const model = ctx.model?.name || ctx.model?.id || "no model";
					const details = [
						`${theme.bold("Pi Coding Agent")} ${theme.fg("dim", `v${VERSION}`)}`,
						theme.fg("muted", displayPath(ctx.cwd)),
						theme.fg("muted", `${model} · ${ctx.thinkingLevel ?? "off"}`),
						theme.fg("muted", gitSummary),
						theme.fg("dim", sessionState),
					];

					return [
						"",
						...logo.map((line, index) =>
							truncateToWidth(
								`${line}${" ".repeat(logoWidth - visibleWidth(line) + 3)}${details[index] ?? ""}`,
								width,
								"…",
							),
						),
						"",
					];
				},
				invalidate() {},
				dispose() {
					clearInterval(timer);
				},
			};
		});
	});
}
