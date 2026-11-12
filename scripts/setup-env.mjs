// Copies each *.env.example to its local env file if the local file does not already exist.
// Never overwrites existing files. Values in examples are local-development-only.
import { copyFileSync, existsSync } from "node:fs";

const pairs = [
  ["apps/api/.env.example", "apps/api/.env"],
  ["apps/web/.env.example", "apps/web/.env.local"],
  ["packages/db/.env.example", "packages/db/.env"],
  ["infra/.env.example", "infra/.env"],
];

for (const [from, to] of pairs) {
  if (existsSync(to)) {
    console.log(`skip  ${to} (exists)`);
    continue;
  }
  copyFileSync(from, to);
  console.log(`wrote ${to}`);
}
