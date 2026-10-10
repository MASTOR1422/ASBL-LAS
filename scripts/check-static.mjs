import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const files = [
  "Auth.js",
  "supabase-client.js",
  "supabase/las-data.js",
  "supabase/las-media.js",
  "las-blog.js",
  "api/supabase-config.js"
];

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write("\nSyntax error in " + file + "\n" + (result.stderr || result.stdout || ""));
  } else {
    process.stdout.write("OK syntax: " + file + "\n");
  }
}

for (const htmlFile of ["index.html", "login.html"]) {
  const html = readFileSync(htmlFile, "utf8");
  if (!/<script\b/i.test(html)) {
    failed = true;
    process.stderr.write("No script tags found in " + htmlFile + "\n");
  }
}

const index = readFileSync("index.html", "utf8");
for (const required of [
  'src="supabase/las-data.js"',
  'src="supabase/las-media.js"',
  'src="las-blog.js"',
  'id="community-blog"',
  'id="media-grid"',
  'LASBlog.load()',
  'LASBlog.startRealtime()',
  'refreshMedia()'
]) {
  if (!index.includes(required)) {
    failed = true;
    process.stderr.write("Missing integration marker in index.html: " + required + "\n");
  }
}

if (failed) process.exit(1);


const mediaMigration = readFileSync("supabase/migrations/20261010193000_las_unified_media_policies.sql", "utf8");
for (const required of [
  "create policy media_read_active",
  "drop policy if exists media_insert_staff",
  "drop policy if exists media_update_staff",
  "on conflict (id) do update set public=false"
]) {
  if (!mediaMigration.includes(required)) {
    failed = true;
    process.stderr.write("Missing media migration safeguard: " + required + "\\n");
  }
}
if (/as\\s+\\$(?:\\s|\\n)/.test(mediaMigration)) {
  failed = true;
  process.stderr.write("Invalid/untagged SQL function delimiter in media migration.\\n");
}
const functionTagCount = (mediaMigration.match(/\\$func\\$/g) || []).length;
if (functionTagCount === 0 || functionTagCount % 2 !== 0) {
  failed = true;
  process.stderr.write("Unbalanced $func$ delimiters in media migration.\\n");
}

const mediaClient = readFileSync("supabase/las-media.js", "utf8");
if (!mediaClient.includes("validLegacyId")) {
  failed = true;
  process.stderr.write("Media client must support legacy bigint IDs.\\n");
}
