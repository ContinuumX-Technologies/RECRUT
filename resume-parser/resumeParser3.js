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

const INPUT_PDF = "KomalTBehera_Resume_2025 (1).pdf";
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

function safeJsonParse(text) {
    if (!text) return null;

    // Remove markdown fences if present
    const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch (err) {
        console.error("❌ JSON parse failed");
        console.error("Raw text:", text);
        throw err;
    }
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
                } catch { }
            }
        });
    }
    return [...usernames];
}

async function isRepoMentionedInResume(repoName, resumeData) {
    const prompt = `
  You are validating whether a GitHub repository is referenced in a resume.
  
  Rules:
  - Match semantically, not exact text
  - Handle abbreviations, hyphens, underscores
  - Company names can map to repo names
  - Project titles can map to repo names
  - Return ONLY true or false (lowercase)
  
  Resume Data:
  ${JSON.stringify(resumeData)}
  
  Repository Name:
  ${repoName}
  `;

    const res = await openai.responses.create({
        model: MODEL,
        input: prompt
    });

    trackUsage(res.usage);

    const answer = res.output[0].content[0].text.trim().toLowerCase();
    return answer === "true";
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
    const raw = res.output[0].content[0].text;
    return safeJsonParse(raw);
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

async function matchRepoWithResume(repoName, repoSkills, resumeData) {
    const prompt = `
  You are an expert technical recruiter.
  
  Your task is to match this GitHub repository against resume experience and projects.
  
  STRICT RULES (DO NOT VIOLATE):
  - You may ONLY use skills that exist in this repo skill list
  - DO NOT introduce skills from the resume unless they ALSO appear in repo skills
  - matched_skills MUST be a subset of repo skills
  - Use semantic reasoning ONLY to select relevance, not to invent skills
  - Score from 0 to 100 based on real overlap
  
  Return ONLY valid JSON in this format:
  
  {
    "best_experience_match": {
      "title": "",
      "company": "",
      "score": 0,
      "matched_skills": [],
      "reason": ""
    },
    "best_project_match": {
      "title": "",
      "score": 0,
      "matched_skills": [],
      "reason": ""
    }
  }
  
  Resume Data:
  ${JSON.stringify(resumeData)}
  
  GitHub Repository:
  Name: ${repoName}
  ALLOWED SKILLS (DO NOT EXCEED THIS LIST):
  ${JSON.stringify(repoSkills)}
  `;
  
    const res = await openai.responses.create({
      model: MODEL,
      input: prompt
    });
  
    trackUsage(res.usage);
  
    return safeJsonParse(res.output[0].content[0].text);
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
            const mentioned = await isRepoMentionedInResume(
                repo.name,
                parsedResume
            );

            if (!mentioned) {
                console.log(`⏭️ Skipping repo (not in resume): ${repo.name}`);
                continue;
            }

            console.log(`✅ Matched repo from resume: ${repo.name}`);

            const files = await fetchRepoFiles(repo);
            if (!files.length) continue;

            const fileContents = [];
            for (const f of files) {
                const content = await fetchFileContent(repo, f.path);
                if (content) fileContents.push({ path: f.path, content });
            }

            const repoSkills = await inferSkillsFromCode(repo.name, fileContents);

            const matchResult = await matchRepoWithResume(
                repo.name,
                repoSkills,
                parsedResume
            );

            report.push({
                user,
                repository: repo.name,
                inferredSkills: repoSkills,
                resume_match: matchResult
            });
        }
    }

    fs.writeFileSync(GITHUB_OUTPUT, JSON.stringify(report, null, 2));
    console.log(`\n✅ Final matched repo analysis → ${GITHUB_OUTPUT}`);

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
