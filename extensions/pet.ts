import type { Theme } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Plain-text sprite. Format documented in pets/README.md. */
export interface Pet {
	frames: string[][];
	colors: string[][];
	palette: Map<string, string>;
	interval: number;
	loops: number;
	sequence: number[];
}

export function parsePet(source: string): Pet {
	const pet: Pet = { frames: [], colors: [], palette: new Map(), interval: 140, loops: 3, sequence: [] };
	let section = "";

	for (const raw of source.split(/\r?\n/)) {
		const header = /^\[(\w+)(?:\s[^\]]*)?\]\s*$/.exec(raw);
		if (header) {
			section = header[1].toLowerCase();
			if (section === "frame") pet.frames.push([]);
			if (section === "colors") pet.colors[pet.frames.length - 1] = [];
			continue;
		}
		if (section === "frame" || section === "colors") {
			pet[section === "frame" ? "frames" : "colors"][pet.frames.length - 1]?.push(raw.trimEnd());
			continue;
		}
		const [key, value] = raw.replace(/\s+#(\s.*)?$/, "").split("=").map((s) => s.trim());
		if (!key || !value || key.startsWith("#")) continue;
		if (section === "palette") pet.palette.set(key, value);
		if (section === "animation" && key === "interval") pet.interval = Number(value) || pet.interval;
		if (section === "animation" && key === "loops") pet.loops = Number(value) || pet.loops;
		if (section === "animation" && key === "sequence") pet.sequence = value.split(/\s+/).map(Number);
	}

	if (!pet.frames.length) throw new Error("no [frame] sections");
	const trim = (lines: string[]) => {
		while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
		return lines;
	};
	pet.frames.forEach(trim);
	const height = Math.max(...pet.frames.map((f) => f.length));
	pet.frames = pet.frames.map((f) => [...f, ...Array<string>(height - f.length).fill("")]);
	pet.colors = pet.frames.map((_, i) => trim(pet.colors[i] ?? []));
	pet.sequence = pet.sequence.filter((i) => Number.isInteger(i) && i >= 0 && i < pet.frames.length);
	if (!pet.sequence.length) pet.sequence = pet.frames.map((_, i) => i);
	return pet;
}

/** Render one frame to ANSI-colored lines. */
export function renderFrame(pet: Pet, frameIndex: number, theme: Theme): string[] {
	const paint = (key: string, text: string): string => {
		const value = pet.palette.get(key);
		if (!value) return text;
		const rgb = toRgb(value);
		if (rgb) return `\x1b[38;2;${rgb}m${text}\x1b[39m`;
		try {
			return theme.fg(value as Parameters<Theme["fg"]>[0], text);
		} catch {
			return text;
		}
	};
	const colorRows = pet.colors[frameIndex] ?? [];
	// ponytail: one escape per cell; merge same-color runs if header rendering ever shows up in a profile
	return pet.frames[frameIndex].map((line, row) =>
		[...line].map((ch, col) => (ch === " " ? ch : paint((colorRows[row] ?? "")[col] ?? "", ch))).join(""),
	);
}

function toRgb(value: string): string | undefined {
	const hex = /^#([0-9a-f]{6})$/i.exec(value);
	if (hex) return [0, 8, 16].map((shift) => (parseInt(hex[1], 16) >> (16 - shift)) & 255).join(";");
	return /^\d{1,3};\d{1,3};\d{1,3}$/.test(value) ? value : undefined;
}

/** All `*.pet` files from the first directory that has any. Malformed files are skipped. */
export function loadPets(dirs: string[]): Pet[] {
	for (const dir of dirs) {
		if (!existsSync(dir)) continue;
		const pets: Pet[] = [];
		for (const file of readdirSync(dir).filter((f) => f.endsWith(".pet"))) {
			try {
				pets.push(parsePet(readFileSync(join(dir, file), "utf8")));
			} catch {}
		}
		if (pets.length) return pets;
	}
	return [];
}
