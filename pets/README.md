# Pets

Pets are plain text files. Drop a `*.pet` file into one of these folders and restart pi:

| Folder                | Scope                        |
| --------------------- | ---------------------------- |
| `<project>/.pi/pets/` | this project only            |
| `~/.pi/agent/pets/`   | all your sessions            |
| this folder           | bundled pets (the dachshund) |

The first folder that contains any pets wins. If it holds several, one is picked at random each session.

Start from [`dachshund.pet`](dachshund.pet):

```ini
[palette]
b = 139;90;60   # body
e = 82;46;32    # ears
s = text        # spots and eye follow the theme
n = dim         # nose

[animation]
interval = 140
loops = 3
sequence = 0 1 0 2

[frame tail neutral]
             ▄███▄
 ▄           █ ▀██▄▄
 ▀█████████████████▀
  ██████████████▀
   ▀█       ▀█
[colors]
             bbbbb
 b           e sbbbn
 bbbsbbbbbbbbeebbbbb
  bbbbbbbsbbbeebb
   bb       bb

```

Rules:

- `[frame]` is the shape, drawn with any single-width characters. Add as many frames as you like.
- `[colors]` is optional and mirrors the frame cell by cell. Each character is a palette key. Cells without a key use the terminal's default color.
- Theme colors (`text`, `dim`, ...) adapt to light and dark themes; use them for eyes and highlights.
- Frames of different heights are padded to the tallest one.

Got a good one? PRs adding pets to this folder are welcome.
