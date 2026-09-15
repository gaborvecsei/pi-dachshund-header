# Pets

Pets are plain text files. Drop a `*.pet` file into one of these folders and restart pi:

| Folder | Scope |
|---|---|
| `<project>/.pi/pets/` | this project only |
| `~/.pi/agent/pets/` | all your sessions |
| this folder | bundled pets (the dachshund) |

The first folder that contains any pets wins. If it holds several, one is picked at random each session.

Start from [`dachshund.pet`](dachshund.pet):

```ini
[palette]
b = 139;90;60   # r;g;b
e = #522e20     # or hex
s = text        # or a pi theme color: text, dim, muted, accent, ...

[animation]
interval = 140      # ms per frame
loops = 3           # sequence plays this many times, then rests on frame 0
sequence = 0 1 0 2  # frame indices; default is all frames in order

[frame tail up]     # text after the section name is a free label
▄            ▄███▄
▀▄           █ ▀██▄▄
 ▀█████████████████▀
[colors]
b            bbbbb
bb           e sbbbn
 bbbsbbbbbbbbeebbbbb
```

Rules:

- `[frame]` is the shape, drawn with any single-width characters. Add as many frames as you like.
- `[colors]` is optional and mirrors the frame cell by cell. Each character is a palette key. Cells without a key use the terminal's default color.
- Theme colors (`text`, `dim`, ...) adapt to light and dark themes; use them for eyes and highlights.
- Frames of different heights are padded to the tallest one.

Got a good one? PRs adding pets to this folder are welcome.
