// Converts every PNG/JPEG in public/birds to WebP (max 1600px, quality 82),
// deletes the originals, and rewrites filename references in src/.
// Safe to re-run. Usage: node scripts/compress-birds.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp"; // installed as a dependency of next

const dir = path.join(process.cwd(), "public", "birds");
const srcDir = path.join(process.cwd(), "src");
const MAX = 1600;
const renamed = [];
let before = 0;
let after = 0;

for (const file of fs.readdirSync(dir)) {
  if (!/\.(png|jpe?g)$/i.test(file)) continue;
  const input = path.join(dir, file);
  const output = path.join(dir, file.replace(/\.(png|jpe?g)$/i, ".webp"));
  before += fs.statSync(input).size;
  await sharp(input)
    .rotate() // respect EXIF orientation
    .resize(MAX, MAX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(output);
  after += fs.statSync(output).size;
  fs.unlinkSync(input);
  renamed.push([file, path.basename(output)]);
  console.log(`${file} -> ${path.basename(output)}`);
}

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
  );
}
for (const f of walk(srcDir).filter((f) => /\.(tsx?|jsx?|json)$/.test(f))) {
  let text = fs.readFileSync(f, "utf8");
  const orig = text;
  for (const [from, to] of renamed) text = text.split(from).join(to);
  if (text !== orig) fs.writeFileSync(f, text);
}

console.log(
  `\n${renamed.length} converted, ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`,
);
