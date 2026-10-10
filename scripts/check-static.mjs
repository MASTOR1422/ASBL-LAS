import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

const files = [
  "Auth.js",
  "supabase-client.js",
  "supabase/las-data.js",
  "supabase/las-media.js",
  "las-blog.js",
  "api/auth/recover.js",
  "api/auth/username-login.js",
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

const html = readFileSync("index.html", "utf8");
const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)];
if (!inlineScripts.length) {
  failed = true;
  process.stderr.write("No inline scripts found in index.html\n");
} else {
  inlineScripts.forEach((match, index) => {
    try {
      new vm.Script(match[1], { filename: "index.html:inline-script-" + (index + 1) });
      process.stdout.write("OK syntax: index.html inline script " + (index + 1) + "\n");
    } catch (error) {
      failed = true;
      process.stderr.write("\nSyntax error in index.html inline script " + (index + 1) + "\n" + error.stack + "\n");
    }
  });
}

if (failed) process.exit(1);
