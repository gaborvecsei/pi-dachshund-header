import { VERSION, type ExtensionAPI, type Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { homedir } from "node:os";

const WAG_FRAMES = [1, 0, 1, 2] as const;
const WAG_INTERVAL_MS = 140;
const WAG_TICKS = WAG_FRAMES.length * 3;

function getDachshund(theme: Theme, tailPosition: number): string[] {
	const rgb = (text: string, color: string) => `\x1b[38;2;${color}m${text}\x1b[39m`;
	const body = (text: string) => rgb(text, "139;90;60");
	const head = body;
	const ear = (text: string) => rgb(text, "82;46;32");
	const spot = (text: string) => theme.fg("text", text);
	const eye = (text: string) => theme.fg("text", text);
	const nose = (text: string) => theme.fg("dim", text);
	const tails = [
		[`${body("▄")}            `, `${body("▀▄")}           `, ` ${body("▀")}`],
		["             ", ` ${body("▄")}           `, ` ${body("▀")}`],
		["             ", "             ", body("▄▀")],
	];
	const tail = tails[tailPosition] ?? tails[1];

	return [
		`${tail[0]}${head("▄███▄")}`,
		`${tail[1]}${ear("█")} ${eye("▀")}${head("██▄")}${nose("▄")}`,
		`${tail[2]}${body("██")}${spot("█")}${body("████████")}${ear("██")}${head("████▀")}`,
		`  ${body("███████")}${spot("█")}${body("███")}${ear("██")}${head("█▀")}`,
		`   ${body("▀█")}       ${head("▀█")}`,
	];
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

		const gitSummary = await getGitSummary(pi, ctx.cwd);
		const messageCount = ctx.sessionManager.getEntries().filter(
			(entry) => entry.type === "message" && (entry.message.role === "user" || entry.message.role === "assistant"),
		).length;
		const sessionState = event.reason === "new" || messageCount === 0
			? "new session"
			: `${event.reason === "fork" ? "forked" : event.reason === "reload" ? "reloaded" : "resumed"} · ${messageCount} messages`;

		ctx.ui.setHeader((tui, theme) => {
			let frame = 0;
			let ticks = 0;
			const timer = setInterval(() => {
				frame = (frame + 1) % WAG_FRAMES.length;
				if (++ticks >= WAG_TICKS) {
					clearInterval(timer);
					frame = 0;
				}
				tui.requestRender();
			}, WAG_INTERVAL_MS);
			timer.unref();

			return {
				render(width: number): string[] {
					const logo = getDachshund(theme, WAG_FRAMES[frame]);
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
