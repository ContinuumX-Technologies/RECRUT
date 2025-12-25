import { exec } from "child_process";

export function executeInDocker(
  language: string,
  code: string,
  input: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cmd = `
docker run --rm --network none \
--memory=256m --cpus=0.5 \
code-runner-${language}
`;
    exec(cmd, { timeout: 5000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}
