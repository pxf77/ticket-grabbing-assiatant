import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["apps", "packages"];
const bannedPatterns = [
  /captchaSolver/i,
  /queueBypass/i,
  /proxyPool/i,
  /deviceFingerprint/i,
  /autoPay/i,
  /submitOrder/i,
  /selenium/i,
  /playwright/i,
  /frida/i,
  /xposed/i,
  /adb\s+shell/i
];

const ignored = new Set(["node_modules", "dist", ".git", ".vite"]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (ignored.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) return [];
    return [full];
  });
}

const files = scanRoots
  .map((item) => path.join(root, item))
  .filter((item) => fs.existsSync(item))
  .flatMap(walk);

const violations = [];
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of bannedPatterns) {
    if (pattern.test(content)) {
      violations.push(`${path.relative(root, file)} matches ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Compliance boundary check failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Compliance boundary check passed for ${files.length} source files.`);
