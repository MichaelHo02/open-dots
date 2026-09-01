import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const INK = [0, 0, 0, 255];
const WHITE = [255, 255, 255, 255];
const LIME = [0xdc, 0xee, 0xb1, 255];
const NONE = [0, 0, 0, 0];

const SPRITES = {
  logo: [
    "................",
    "..####....####..",
    ".#wwww#..#wwww#.",
    ".#wggw#..#wwww#.",
    ".#wggw#..#w##w#.",
    ".#wwww#..#w##w#.",
    ".#wwww#..#wwww#.",
    ".#wwww####wwww#.",
    ".#wwwwwwwwwwww#.",
    ".#wwwwwwwwwwww#.",
    "..#wwwwwwwwww#..",
    "...#wwwwwwww#...",
    "....#wwwwww#....",
    ".....######.....",
    "................",
    "................",
  ],
  draw: [
    "............##..",
    "...........#.#..",
    "..........#.#...",
    ".........#.#....",
    "........#.#.....",
    ".......#.#......",
    "......#.#.......",
    ".....#.#........",
    "....###.........",
    "...#.#..........",
    "..###...........",
    "..#.#...........",
    ".##.............",
    ".#..............",
    "................",
    "................",
  ],
  erase: [
    "................",
    "........####....",
    ".......#....#...",
    "......#.####.#..",
    ".....#.#....#.#.",
    "....#.#......#.#",
    "...#.#......#.#.",
    "..#.#......#.#..",
    "..#.#....#.#....",
    "...#.####.#.....",
    "....#....#......",
    ".....####.......",
    "................",
    "................",
    "................",
    "................",
  ],
  fill: [
    "........##......",
    ".......#..#.....",
    "......#....#....",
    ".......#..#.....",
    "....##########..",
    "....#........#..",
    "....#........#..",
    "....#........#..",
    ".....#......#...",
    "......#....#....",
    ".......#..#.....",
    "........##......",
    ".........#......",
    "..........#.....",
    "...........#....",
    "................",
  ],
  text: [
    "................",
    "..############..",
    ".#............#.",
    ".#...##..##...#.",
    ".#...##..##...#.",
    ".#...######...#.",
    ".#...##..##...#.",
    ".#...##..##...#.",
    ".#............#.",
    "..############..",
    ".....##.........",
    "......##........",
    ".......##.......",
    "................",
    "................",
    "................",
  ],
  undo: [
    "................",
    "................",
    "......##........",
    ".....##.........",
    "....##..........",
    "...############.",
    "....##..........",
    ".....##.........",
    "......##........",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  clear: [
    "................",
    "..############..",
    "..#..........#..",
    "..#.##....##.#..",
    "..#..##..##..#..",
    "..#...####...#..",
    "..#...####...#..",
    "..#..##..##..#..",
    "..#.##....##.#..",
    "..#..........#..",
    "..############..",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  present: [
    "................",
    "..############..",
    "..#..........#..",
    "..#..##......#..",
    "..#..###.....#..",
    "..#..####....#..",
    "..#..#####...#..",
    "..#..####....#..",
    "..#..###.....#..",
    "..#..##......#..",
    "..#..........#..",
    "..############..",
    "................",
    "................",
    "................",
    "................",
  ],
  delete: [
    "................",
    ".....######.....",
    "....#......#....",
    "...##########...",
    "...#........#...",
    "...#.#....#.#...",
    "...#.#....#.#...",
    "...#.#....#.#...",
    "...#.#....#.#...",
    "...#........#...",
    "....########....",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  page: [
    "................",
    "..############..",
    "..#..........#..",
    "..#....##....#..",
    "..#....##....#..",
    "..#..######..#..",
    "..#..######..#..",
    "..#....##....#..",
    "..#....##....#..",
    "..#..........#..",
    "..############..",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
};

function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const from = (y * width + x) * 4;
      const to = row + 1 + x * 4;
      raw[to] = rgba[from];
      raw[to + 1] = rgba[from + 1];
      raw[to + 2] = rgba[from + 2];
      raw[to + 3] = rgba[from + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function pixel(ch) {
  switch (ch) {
    case "#":
      return INK;
    case "w":
      return WHITE;
    case "g":
      return LIME;
    default:
      return NONE;
  }
}

function rasterize(rows, scale) {
  const src = rows.length;
  const size = src * scale;
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < src; y += 1) {
    for (let x = 0; x < src; x += 1) {
      const color = pixel(rows[y][x] ?? ".");
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const i = ((y * scale + dy) * size + (x * scale + dx)) * 4;
          rgba[i] = color[0];
          rgba[i + 1] = color[1];
          rgba[i + 2] = color[2];
          rgba[i + 3] = color[3];
        }
      }
    }
  }
  return { size, rgba };
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../public/chrome");
mkdirSync(outDir, { recursive: true });

for (const [name, rows] of Object.entries(SPRITES)) {
  const { size, rgba } = rasterize(rows, 4);
  writeFileSync(join(outDir, `${name}.png`), encodePng(size, size, rgba));
}

console.log(`Wrote ${Object.keys(SPRITES).length} icons to ${outDir}`);
