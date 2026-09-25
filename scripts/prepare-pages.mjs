import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const out = join(root, "pages");
const sources = [join(root, ".vercel/output/static"), join(root, "dist/client")].filter((dir) =>
  existsSync(dir),
);

if (sources.length === 0) {
  console.error("[pages] no client build found");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const source of sources) {
  cpSync(source, out, { recursive: true });
}

const index = join(out, "index.html");
if (!existsSync(index)) {
  console.error("[pages] index.html was not emitted");
  process.exit(1);
}

const html = readFileSync(index).filter((byte) => byte !== 0);
writeFileSync(index, html);
writeFileSync(join(out, "404.html"), html);
writeFileSync(join(out, ".nojekyll"), "");

const base = process.env.PAGES_BASE?.trim() || "/";
const scope = base.endsWith("/") ? base : `${base}/`;
mkdirSync(join(out, "__grok"), { recursive: true });
writeFileSync(
  join(out, "__grok/manifest.webmanifest"),
  JSON.stringify(
    {
      name: "Base",
      short_name: "Base",
      id: scope,
      start_url: scope,
      scope,
      display: "standalone",
      background_color: "#071018",
      theme_color: "#9eb8d0",
      icons: [
        {
          src: `${scope}__grok/icon-180.png`,
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    null,
    2,
  ),
);

console.log("[pages] ready");
