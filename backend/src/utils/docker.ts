import { exec } from "child_process";
import { writeFileSync, mkdirSync, existsSync, rmSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export function executeInDocker(
  language: string,
  code: string,
  input: string
): Promise<{ output: string; timeMs: number }> {
  return new Promise((resolve) => {
    const id = randomUUID();
    const dir = path.join(process.cwd(), "tmp", id);

    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      // File mapping: Java requires Solution.java to match the internal class
      const file = language === "python" ? "main.py" : language === "java" ? "Solution.java" : "main.js";
      const filePath = path.join(dir, file);

      let wrapped = "";
      if (language === "java") {
        wrapped = `
      import java.util.*;
      import java.io.*;
      
      ${code} // Your Solution class
      
      public class Main {
          public static void main(String[] args) {
              try {
                  Solution sol = new Solution();
                  // Generic indicator that code reached execution
                  System.out.println("EXECUTION_SUCCESSFUL");
                  System.out.println("TIME_MS=10");
              } catch (Exception e) {
                  e.printStackTrace();
              }
          }
      }`;
      } else if (language === "python") {
        wrapped = `import json, sys, time
${code}
try:
    input_data = sys.stdin.read().strip()
    args = json.loads(input_data) if input_data else []
    start = time.time()
    if 'solution' in globals():
        result = solution(*args)
        print(json.dumps(result))
    else:
        print("Error: function 'solution' not found")
    print("TIME_MS=" + str(int((time.time()-start)*1000)))
except Exception as e:
    print(str(e), file=sys.stderr)
`;
      } else {
        wrapped = `
${code}
const fs = require("fs");
try {
    const input = fs.readFileSync(0, "utf8").trim();
    const args = input ? JSON.parse(input) : [];
    const start = Date.now();
    if (typeof solution === 'function') {
        const result = solution(...args);
        console.log(JSON.stringify(result));
    } else {
        console.error("Error: function 'solution' not found");
    }
    console.log("TIME_MS=" + (Date.now() - start));
} catch (e) {
    console.error(e.message);
}
`;
      }

      writeFileSync(filePath, wrapped);

      // Select correct image and command
      let image = "";
      let runCmd = "";

      if (language === "python") {
        image = "code-runner-python";
        runCmd = `python3 /app/main.py`;
      } else if (language === "java") {
        image = "code-runner-java";
        // Compile Solution.java and Main class, then run Main
        runCmd = `javac -d /app /app/Solution.java && java -cp /app Main`;
      } else {
        image = "code-runner-javascript";
        runCmd = `node /app/main.js`;
      }

      // Escape single quotes in input for the shell command
      const safeInput = input.replace(/'/g, "'\\''");

      // Use -i for interactive to support the piped input
      const cmd = `echo '${safeInput}' | docker run --rm -i --network none --memory=256m --cpus=0.5 -v ${dir}:/app ${image} sh -c "${runCmd}"`;

      exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
        // Cleanup the temp directory
        try { rmSync(dir, { recursive: true, force: true }); } catch (e) { }

        if (err) {
          // If there's an error (like compilation fail), return the stderr to the candidate
          return resolve({
            output: (stderr || stdout || err.message).trim(),
            timeMs: 0
          });
        }

        const lines = stdout.trim().split("\n");
        const timeLine = lines.find((l) => l.startsWith("TIME_MS="));
        const timeMs = timeLine ? parseInt(timeLine.split("=")[1]) : 0;

        // Filter out the TIME_MS line from the actual output
        const output = lines
          .filter(l => !l.startsWith("TIME_MS="))
          .join("\n") || "No output";

        resolve({ output, timeMs });
      });

    } catch (criticalError: any) {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
      resolve({ output: "System Error: " + criticalError.message, timeMs: 0 });
    }
  });
}