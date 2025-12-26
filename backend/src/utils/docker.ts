import { exec } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export function executeInDocker(
  language: string,
  code: string,
  input: string
): Promise<{ output: string; timeMs: number }> {
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const dir = path.join(process.cwd(), "tmp", id);
    mkdirSync(dir, { recursive: true });

    const file =
      language === "python" ? "main.py" : "main.js";
    const filePath = path.join(dir, file);

    // ⬇️ WRAPPER (LeetCode style)
    const wrapped =
      language === "python"
        ? `
import json, sys, time

${code}

start = time.time()
args = json.loads(sys.stdin.read())
result = solution(*args)
print(json.dumps(result))
print("TIME_MS=" + str(int((time.time()-start)*1000)))
`
        : `
${code}

const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();
const args = JSON.parse(input);

const start = Date.now();
const result = solution(...args);
console.log(JSON.stringify(result));
console.log("TIME_MS=" + (Date.now() - start));
`;

    writeFileSync(filePath, wrapped);

    const image =
      language === "python"
        ? "code-runner-python"
        : "code-runner-javascript";

    const cmd = `
docker run --rm --network none \
--memory=256m --cpus=0.5 \
-v ${dir}:/app \
${image} sh -c "cat | ${
      language === "python" ? "python3" : "node"
    } /app/${file}"
`;

    exec(
      cmd,
      { timeout: 5000 },
      (err, stdout) => {
        if (err) return reject(err);

        const lines = stdout.trim().split("\n");
        const timeLine = lines.find(l => l.startsWith("TIME_MS="));
        const timeMs = timeLine
          ? parseInt(timeLine.split("=")[1])
          : 0;

        resolve({
          output: lines[0],
          timeMs
        });
      }
    );
  });
}
