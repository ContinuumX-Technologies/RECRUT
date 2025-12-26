// backend/test-docker.ts
import { executeInDocker } from "./utils/docker";

(async () => {
  const res = await executeInDocker(
    "javascript",
    "console.log('Hello Judge')",
    ""
  );
  console.log(res);
})();
