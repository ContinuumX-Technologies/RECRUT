import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

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

// =========================================
// CONFIG
// =========================================
const RESUME_FILE = "parsed_resume.json";
const GITHUB_FILE = "github_deep_scan.txt";
const MODEL = "gpt-4.1-mini"; // cost-efficient & strong reasoning

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// =========================================
// LOAD INPUTS
// =========================================
const resume = JSON.parse(fs.readFileSync(RESUME_FILE, "utf8"));
const githubText = fs.readFileSync(GITHUB_FILE, "utf8");

// =========================================
// PARSE GITHUB REPOS → DEPENDENCIES
// =========================================
function parseGithubRepos(text) {
  const repos = {};
  let currentRepo = null;

  text.split("\n").forEach(line => {
    const repoMatch = line.match(/📁 REPO:\s*(.+)/);
    if (repoMatch) {
      currentRepo = repoMatch[1].trim();
      repos[currentRepo] = [];
    }

    const depMatch = line.match(/-\s+([@a-zA-Z0-9\-_/]+)/);
    if (depMatch && currentRepo) {
      repos[currentRepo].push(depMatch[1]);
    }
  });

  return repos;
}

const githubRepos = parseGithubRepos(githubText);

// =========================================
// OPENAI: MATCH RESUME ENTRY → REPO
// =========================================
async function matchRepoWithAI(title, company, repoNames) {
  const prompt = `
Match a resume entry to the correct GitHub repository.

Resume:
- Title: ${title}
- Company: ${company ?? "N/A"}

GitHub repositories:
${repoNames.join("\n")}

Rules:
- Match semantically (product names, abbreviations, casing)
- Do NOT guess
- If nothing matches, return "NO_MATCH"

Return ONLY the repository name or NO_MATCH.
`;

  const res = await client.responses.create({
    model: MODEL,
    input: prompt
  });

  trackUsage(res.usage);
  return res.output_text.trim();
}

// =========================================
// OPENAI: DEPENDENCIES → SKILLS
// =========================================
async function inferSkillsFromDependencies(deps) {
  const prompt = `
You are a senior software architect.

Infer HIGH-LEVEL SKILLS from these GitHub dependencies.

Dependencies:
${deps.join(", ")}

Rules:
- Convert packages into resume-level skills
- Example: react, react-dom → React
- Example: spring-boot-starter-* → Spring Boot
- Example: mongoose → MongoDB
- Return ONLY valid JSON array

Output example:
["React", "Node.js", "MongoDB"]
`;

  const res = await client.responses.create({
    model: MODEL,
    input: prompt
  });

  const text = res.output_text;
  trackUsage(res.usage);
  const match = text.match(/\[[\s\S]*\]/);
  return match ? JSON.parse(match[0]) : [];
}

// =========================================
// OPENAI: SKILL COMPARISON
// =========================================
async function compareSkills(resumeSkills, githubSkills) {
  const prompt = `
Compare resume skills with GitHub-inferred skills.

Resume skills:
${resumeSkills.join(", ")}

GitHub skills:
${githubSkills.join(", ")}

Return ONLY valid JSON:
{
  "matchedSkills": [],
  "missingSkills": [],
  "extraSkills": [],
  "alignmentScore": 0
}

Scoring:
- 100 = perfect
- Penalize missing claimed skills heavily
- Penalize extra skills lightly
`;

  const res = await client.responses.create({
    model: MODEL,
    input: prompt
  });

  const text = res.output_text;
  trackUsage(res.usage);
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

// =========================================
// MAIN
// =========================================
async function run() {
  const results = [];
  const entries = [...resume.Experience, ...resume.Projects];

  for (const entry of entries) {
    const repo = await matchRepoWithAI(
      entry.Title,
      entry.Company,
      Object.keys(githubRepos)
    );

    if (repo === "NO_MATCH" || !githubRepos[repo]) continue;

    const inferredSkills = await inferSkillsFromDependencies(
      githubRepos[repo]
    );

    const comparison = await compareSkills(
      entry.Skills,
      inferredSkills
    );

    results.push({
      resumeTitle: entry.Title,
      company: entry.Company,
      matchedRepo: repo,
      inferredGithubSkills: inferredSkills,
      ...comparison
    });
  }

  fs.writeFileSync(
    "ai_skill_mismatch_report.json",
    JSON.stringify(results, null, 2)
  );

  console.log("✅ AI Skill Mismatch Report Generated (OpenAI)");
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

run();

