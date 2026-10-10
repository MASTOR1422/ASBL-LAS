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

const mediaMigration = readFileSync("supabase/migrations/20261010193000_las_unified_media_policies.sql", "utf8");
for (const required of [
  "create policy media_read_active",
  "drop policy if exists media_insert_staff",
  "drop policy if exists media_update_staff",
  "on conflict (id) do update set public=false",
  "private.las_current_role",
  "private.las_is_active"
]) {
  if (!mediaMigration.includes(required)) {
    failed = true;
    process.stderr.write("Missing media migration safeguard: " + required + "\n");
  }
}
const blogMigration = readFileSync("supabase/migrations/20261010193001_las_unified_blog_discussions.sql", "utf8");
for (const required of [
  "drop policy if exists posts_insert_active",
  "drop policy if exists posts_update_author_admin",
  "drop policy if exists comments_update_author_admin",
  "private.las_current_role()='admin'",
  "private.las_is_active()"
]) {
  if (!blogMigration.includes(required)) {
    failed = true;
    process.stderr.write("Missing blog migration safeguard: " + required + "\n");
  }
}

const mediaClient = readFileSync("supabase/las-media.js", "utf8");
if (!mediaClient.includes("validLegacyId")) {
  failed = true;
  process.stderr.write("Media client must support legacy bigint IDs.\n");
}

if (failed) process.exit(1);
