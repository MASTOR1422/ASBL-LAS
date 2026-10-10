import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

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
  const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!inlineScripts.length) {
    failed = true;
    process.stderr.write("No inline scripts found in " + htmlFile + "\n");
  } else {
    inlineScripts.forEach((match, index) => {
      try {
        new vm.Script(match[1], { filename: htmlFile + ":inline-script-" + (index + 1) });
        process.stdout.write("OK syntax: " + htmlFile + " inline script " + (index + 1) + "\n");
      } catch (error) {
        failed = true;
        process.stderr.write("\nSyntax error in " + htmlFile + " inline script " + (index + 1) + "\n" + error.stack + "\n");
      }
    });
  }
}

const index = readFileSync("index.html", "utf8");
for (const required of [
  'src="supabase/las-data.js"',
  'src="supabase/las-media.js"',
  'src="las-blog.js"',
  'id="community-blog"',
  'id="media-grid"'
]) {
  if (!index.includes(required)) {
    failed = true;
    process.stderr.write("Missing integration marker in index.html: " + required + "\n");
  }
}

if (failed) process.exit(1);
