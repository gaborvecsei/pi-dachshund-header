import type { Theme } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * A pet is a plain-text sprite with optional per-cell colors and animation frames.
 *
 * ```
 * [palette]
 * b = 139;90;60      # rgb
 * e = #522e20        # hex
 * s = text           # pi theme color token
 *
 * [animation]
 * interval = 140     # ms per frame
 * loops = 3          # how many times the sequence plays before resting on frame 0
 * sequence = 0 1 0 2 # frame indices, defaults to all frames in order
 *
 * [frame tail up]     # anything after the section name is a free label
 * ▄███▄
 * [colors]
 * bbbbb
 *
 * [frame]
 * ...
 * ```
 */
export interface Pet {
	name: string;
	frames: string[][];
	colors: string[][];
	palette: Map<string, string>;
	interval: number;
	loops: number;
	sequence: number[];
}

const DEFAULT_INTERVAL_MS = 140;
const DEFAULT_LOOPS = 3;

export function parsePet(source: string, name = "pet"): Pet {
	const palette = new Map<string, string>();
	const frames: string[][] = [];
	const colors: string[][] = [];
	let interval = DEFAULT_INTERVAL_MS;
	let loops = DEFAULT_LOOPS;
	let sequence: number[] | undefined;
	let section = "";

	for (const rawLine of source.split(/\r?\n/)) {
		const header = /^\[(\w+)(?:\s[^\]]*)?\]\s*$/.exec(rawLine);
		if (header) {
			section = header[1].toLowerCase();
			if (section === "frame") frames.push([]);
			if (section === "colors") colors[frames.length - 1] = [];
			continue;
		}

		if (section === "frame" || section === "colors") {
			const target = section === "frame" ? frames[frames.length - 1] : colors[frames.length - 1];
			if (target) target.push(rawLine.trimEnd());
			continue;
		}

		const line = rawLine.replace(/\s+#.*$/, "").trim();
		if (!line || line.startsWith("#")) continue;
		const [key, ...rest] = line.split("=");
		const value = rest.join("=").trim();
		if (!key || !value) continue;

		if (section === "palette") {
			palette.set(key.trim(), value);
		} else if (section === "animation") {
			const k = key.trim();
			if (k === "interval") interval = Number(value) || DEFAULT_INTERVAL_MS;
			else if (k === "loops") loops = Number(value) || DEFAULT_LOOPS;
			else if (k === "sequence") sequence = value.split(/\s+/).map(Number).filter((n) => Number.isInteger(n));
		}
	}

	if (frames.length === 0) throw new Error(`${name}: no [frame] sections`);

	const trimmed = frames.map(trimTrailingBlankLines);
	const height = Math.max(...trimmed.map((f) => f.length));
	const padded = trimmed.map((f) => [...f, ...Array<string>(height - f.length).fill("")]);
	const validSequence = (sequence ?? padded.map((_, i) => i)).filter((i) => i >= 0 && i < padded.length);

	return {
		name,
		frames: padded,
		colors: padded.map((_, i) => trimTrailingBlankLines(colors[i] ?? [])),
		palette,
		interval,
		loops,
		sequence: validSequence.length ? validSequence : [0],
	};
}

function trimTrailingBlankLines(lines: string[]): string[] {
	let end = lines.length;
	while (end > 0 && lines[end - 1].trim() === "") end--;
	return lines.slice(0, end);
}

/** Render one frame to ANSI-colored lines. */
export function renderFrame(pet: Pet, frameIndex: number, theme: Theme): string[] {
	const shape = pet.frames[frameIndex] ?? pet.frames[0];
	const colorMap = pet.colors[frameIndex] ?? [];
	const paint = colorFns(pet.palette, theme);

	return shape.map((line, row) => {
		const colorRow = colorMap[row] ?? "";
		const chars = [...line];
		let out = "";
		let run = "";
		let runKey = "";
		const flush = () => {
			if (!run) return;
			const fn = paint.get(runKey);
			out += fn ? fn(run) : run;
			run = "";
		};
		chars.forEach((ch, col) => {
			const key = ch === " " ? "" : (colorRow[col] ?? " ").trim();
			if (key !== runKey) {
				flush();
				runKey = key;
			}
			run += ch;
		});
		flush();
		return out;
	});
}

function colorFns(palette: Map<string, string>, theme: Theme): Map<string, (text: string) => string> {
	const fns = new Map<string, (text: string) => string>();
	for (const [key, value] of palette) {
		const rgb = parseRgb(value);
		if (rgb) {
			fns.set(key, (text) => `\x1b[38;2;${rgb}m${text}\x1b[39m`);
			continue;
		}
		fns.set(key, (text) => {
			try {
				return theme.fg(value as Parameters<Theme["fg"]>[0], text);
			} catch {
				return text;
			}
		});
	}
	return fns;
}

function parseRgb(value: string): string | undefined {
	const hex = /^#?([0-9a-f]{6})$/i.exec(value);
	if (hex) {
		const n = parseInt(hex[1], 16);
		return `${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}`;
	}
	const triple = /^(\d{1,3})\s*[;,]\s*(\d{1,3})\s*[;,]\s*(\d{1,3})$/.exec(value);
	return triple ? `${triple[1]};${triple[2]};${triple[3]}` : undefined;
}

/** Load all `*.pet` files from a directory. Broken files are skipped. */
export function loadPetsFrom(dir: string): Pet[] {
	if (!existsSync(dir)) return [];
	const pets: Pet[] = [];
	for (const file of readdirSync(dir).filter((f) => f.endsWith(".pet")).sort()) {
		try {
			pets.push(parsePet(readFileSync(join(dir, file), "utf8"), basename(file, ".pet")));
		} catch {
			// ignore malformed pet
		}
	}
	return pets;
}

/** First directory that contains any pets wins. */
export function loadPets(dirs: string[]): Pet[] {
	for (const dir of dirs) {
		const pets = loadPetsFrom(dir);
		if (pets.length) return pets;
	}
	return [];
}
