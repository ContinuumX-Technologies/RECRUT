import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import axios from "axios";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// ==========================================
// CONFIGURATION
// ==========================================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const INPUT_PDF = "Yash_Behera_Resume (1).pdf";
const RESUME_OUTPUT = "parsed_resume.json";
const GITHUB_OUTPUT = "github_repo_skills.json";
const MODEL = "gpt-4.1-mini";

const tokenUsage = {
    input: 0,
    output: 0,
    total: 0
  };
  
  function trackUsage(usage) {
    if (!usage) return;
    tokenUsage.input += usage.input_tokens || 0;
    tokenUsage.output += usage.output_tokens || 0;
    tokenUsage.total += usage.total_tokens || 0;
  }
  
const MAX_FILES_PER_REPO = 40;
const MAX_FILE_SIZE = 50_000; // chars

const ALLOWED_EXT = [
  ".js", ".ts", ".jsx", ".tsx",
  ".py", ".java", ".kt",
  ".go", ".rs",
  ".sol",
  ".yml", ".yaml",
  ".tf",
  ".sh",
];

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ==========================================
// PDF TEXT EXTRACTION
// ==========================================
async function extractPdfText(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const data = await pdfParse(buffer);
  return data.text || "";
}

// ==========================================
// GITHUB USER EXTRACTION
// ==========================================
async function extractGithubUsernamesFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const usernames = new Set();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const text = (await page.getTextContent()).items.map(i => i.str).join(" ");

    const matches =
      text.match(/https?:\/\/github\.com\/([A-Za-z0-9_-]+)/gi) || [];
    matches.forEach(m => usernames.add(m.split("/").pop()));

    const annots = await page.getAnnotations();
    annots.forEach(a => {
      if (a.url?.includes("github.com")) {
        try {
          usernames.add(new URL(a.url).pathname.split("/")[1]);
        } catch {}
      }
    });
  }
  return [...usernames];
}

// ==========================================
// OPENAI: RESUME PARSER
// ==========================================
async function parseResumeWithOpenAI(resumeText) {
  const prompt = `
Extract structured resume data as JSON.

Include:
- Experience
- Projects
- Global_Skills

Rules:
- Technical skills only
- No markdown
- JSON only

Resume:
${resumeText}
`;

  const res = await openai.responses.create({
    model: MODEL,
    input: prompt
  });

  trackUsage(res.usage);
  return JSON.parse(res.output[0].content[0].text);
}

// ==========================================
// GITHUB API
// ==========================================
const github = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: GITHUB_TOKEN ? `token ${GITHUB_TOKEN}` : undefined,
    Accept: "application/vnd.github.v3+json"
  }
});

async function fetchAllRepos(username) {
  const repos = [];
  let page = 1;

  while (true) {
    const res = await github.get(`/users/${username}/repos`, {
      params: { per_page: 100, page }
    });
    if (!res.data.length) break;
    repos.push(...res.data);
    page++;
  }
  return repos;
}

// ==========================================
// REPO TREE → SOURCE FILES
// ==========================================
async function fetchRepoFiles(repo) {
  const treeRes = await github.get(
    `/repos/${repo.full_name}/git/trees/${repo.default_branch}`,
    { params: { recursive: 1 } }
  );

  return treeRes.data.tree
    .filter(
      f =>
        f.type === "blob" &&
        ALLOWED_EXT.some(ext => f.path.endsWith(ext))
    )
    .slice(0, MAX_FILES_PER_REPO);
}

async function fetchFileContent(repo, path) {
  try {
    const res = await github.get(
      `/repos/${repo.full_name}/contents/${path}`,
      { headers: { Accept: "application/vnd.github.raw" } }
    );
    return res.data.slice(0, MAX_FILE_SIZE);
  } catch {
    return "";
  }
}

// ==========================================
// OPENAI: CODE → SKILLS
// ==========================================
async function inferSkillsFromCode(repoName, files) {
  const codeContext = files
    .map(f => `FILE: ${f.path}\n${f.content}`)
    .join("\n\n")
    .slice(0, 12000);

  const prompt = `
You are a senior software architect.

Infer REAL resume-level skills from this repository's codebase.

Rules:
- High-level skills only
- No libraries unless they imply a skill
- Examples: React, Node.js, Spring Boot, MongoDB, AWS, Docker, Kubernetes
- Return ONLY a JSON array

Repository: ${repoName}

Code:
${codeContext}
`;

  const res = await openai.responses.create({
    model: MODEL,
    input: prompt
  });

  const text = res.output[0].content[0].text;
  const match = text.match(/\[[\s\S]*\]/);
  
  trackUsage(res.usage);
  return match ? JSON.parse(match[0]) : [];
}

// ==========================================
// MAIN
// ==========================================
async function main() {
  console.log(`📄 Reading resume: ${INPUT_PDF}`);

  const resumeText = await extractPdfText(INPUT_PDF);
  const parsedResume = await parseResumeWithOpenAI(resumeText);

  fs.writeFileSync(RESUME_OUTPUT, JSON.stringify(parsedResume, null, 2));
  console.log(`✅ Resume parsed → ${RESUME_OUTPUT}`);

  const users = await extractGithubUsernamesFromPDF(INPUT_PDF);
  if (!users.length) {
    console.log("⚠️ No GitHub users found.");
    return;
  }

  const report = [];

  for (const user of users) {
    console.log(`\n👤 GitHub User: ${user}`);
    const repos = await fetchAllRepos(user);

    for (const repo of repos) {
      console.log(`📁 Scanning repo: ${repo.name}`);

      const files = await fetchRepoFiles(repo);
      if (!files.length) continue;

      const fileContents = [];
      for (const f of files) {
        const content = await fetchFileContent(repo, f.path);
        if (content) fileContents.push({ path: f.path, content });
      }

      const skills = await inferSkillsFromCode(repo.name, fileContents);

      report.push({
        user,
        repository: repo.name,
        inferredSkills: skills
      });
    }
  }

  fs.writeFileSync(GITHUB_OUTPUT, JSON.stringify(report, null, 2));
  console.log(`\n✅ GitHub repo skills saved → ${GITHUB_OUTPUT}`);

  console.log("\n📊 TOKEN USAGE SUMMARY");
  console.log("────────────────────────");
  console.log(`Input Tokens : ${tokenUsage.input}`);
  console.log(`Output Tokens: ${tokenUsage.output}`);
  console.log(`Total Tokens : ${tokenUsage.total}`);

  const COST_PER_1M_INPUT = 0.15;
  const COST_PER_1M_OUTPUT = 0.60;

  const cost =
    (tokenUsage.input / 1_000_000) * COST_PER_1M_INPUT +
    (tokenUsage.output / 1_000_000) * COST_PER_1M_OUTPUT;

  console.log(`Estimated Cost: $${cost.toFixed(6)}`);
}

main();
