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
