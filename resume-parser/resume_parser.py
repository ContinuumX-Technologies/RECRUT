import pdfplumber
import requests
import base64
import json
import re
import time
import xml.etree.ElementTree as ET
from tomllib import loads as toml_loads

# ==========================================
# CONFIGURATION
# ==========================================
GITHUB_TOKEN = ""  # 🔐 Strongly recommended
HEADERS = {"Accept": "application/vnd.github.v3+json"}
if GITHUB_TOKEN:
    HEADERS["Authorization"] = f"token {GITHUB_TOKEN}"

GITHUB_API = "https://api.github.com"
OUTPUT_FILE = "github_deep_scan.txt"

EXCLUDED_DIRS = {
    "node_modules", ".git", "dist", "build", ".next",
    "out", "coverage", "__pycache__", ".venv" ,"vendor",
    ".pnpm-store", ".yarn", ".cache"
}

# ==========================================
# LOGGING
# ==========================================
def log(msg, f=None):
    print(msg)
    if f:
        f.write(msg + "\n")

# ==========================================
# PDF → GITHUB
# ==========================================
def extract_github_links(pdf_path):
    links = set()
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            if page.annots:
                for a in page.annots:
                    uri = a.get("uri")
                    if uri and "github.com" in uri:
                        links.add(uri)

            text = page.extract_text() or ""
            matches = re.findall(r"(?:https?://)?github\.com/[A-Za-z0-9_.-]+", text)
            links.update(matches)

    return list({
        ("https://" + l if not l.startswith("http") else l).rstrip("/.,)")
        for l in links
    })

# ==========================================
# GITHUB API HELPERS
# ==========================================
def paginated_get(url):
    data = []
    while url:
        r = requests.get(url, headers=HEADERS)
        if r.status_code != 200:
            break
        data.extend(r.json())
        url = r.links.get("next", {}).get("url")
    return data


def get_username_from_url(url):
    parts = url.replace("https://", "").split("/")
    return parts[1] if len(parts) > 1 else None


def fetch_all_repos(username):
    url = f"{GITHUB_API}/users/{username}/repos?per_page=100"
    repos = paginated_get(url)
    return [
        {
            "name": r["name"],
            "full_name": r["full_name"],
            "default_branch": r["default_branch"]
        }
        for r in repos
    ]


def get_branch_sha(repo, branch):
    r = requests.get(
        f"{GITHUB_API}/repos/{repo}/git/refs/heads/{branch}",
        headers=HEADERS
    )
    return r.json()["object"]["sha"] if r.status_code == 200 else None

# ==========================================
# PARSERS (DEPENDENCIES ONLY)
# ==========================================
def parse_package_json(data):
    deps = {}
    for s in ["dependencies", "devDependencies", "peerDependencies"]:
        deps.update(data.get(s, {}))
    return deps


def parse_requirements_txt(text):
    return {
        re.split(r"[=<>!~]+", l, 1)[0]: l
        for l in text.splitlines()
        if l.strip() and not l.startswith("#")
    }


def parse_pyproject(text):
    data = toml_loads(text)
    return data.get("tool", {}).get("poetry", {}).get("dependencies", {})


def parse_pom(text):
    deps = {}
    try:
        root = ET.fromstring(text)
        ns = {"m": "http://maven.apache.org/POM/4.0.0"}
        for d in root.findall(".//m:dependency", ns):
            gid = d.find("m:groupId", ns)
            aid = d.find("m:artifactId", ns)
            ver = d.find("m:version", ns)
            deps[f"{gid.text}:{aid.text}"] = ver.text if ver is not None else "managed"
    except Exception:
        pass
    return deps


def parse_go_mod(text):
    return {
        l.split()[0]: l.split()[1]
        for l in text.splitlines()
        if l.strip() and not l.startswith(("module", "require", "//"))
        and len(l.split()) >= 2
    }


def parse_cargo(text):
    return toml_loads(text).get("dependencies", {})


def parse_composer(data):
    return data.get("require", {})


def parse_csproj(text):
    deps = {}
    try:
        root = ET.fromstring(text)
        for p in root.findall(".//PackageReference"):
            deps[p.attrib.get("Include")] = p.attrib.get("Version", "managed")
    except Exception:
        pass
    return deps

# ==========================================
# MANIFEST REGISTRY (ALL ECOSYSTEMS)
# ==========================================
MANIFESTS = {
    # Programming Languages
    "package.json": ("Node.js", parse_package_json),
    "requirements.txt": ("Python", parse_requirements_txt),
    "pyproject.toml": ("Python", parse_pyproject),
    "pom.xml": ("Java / Spring", parse_pom),
    "go.mod": ("Go", parse_go_mod),
    "Cargo.toml": ("Rust", parse_cargo),
    "composer.json": ("PHP", parse_composer),
    ".csproj": (".NET", parse_csproj),

    # Mobile / Desktop
    "AndroidManifest.xml": ("Android", None),
    "Package.swift": ("iOS / Swift", None),
    "pubspec.yaml": ("Flutter / Dart", None),
    "project.godot": ("Godot", None),
    "Packages/manifest.json": ("Unity", None),

    # Web
    "build.gradle": ("Gradle", None),
    "build.gradle.kts": ("Gradle Kotlin DSL", None),

    # DevOps / Infra
    "Dockerfile": ("Docker", None),
    "docker-compose.yml": ("Docker Compose", None),
    "Chart.yaml": ("Helm", None),
    "kustomization.yaml": ("Kubernetes", None),
    ".tf": ("Terraform", None),
    "serverless.yml": ("Serverless", None),

    # Lock files (truth)
    "package-lock.json": ("npm lock", None),
    "yarn.lock": ("Yarn lock", None),
    "pnpm-lock.yaml": ("pnpm lock", None),
    "poetry.lock": ("Poetry lock", None),
    "Pipfile.lock": ("Pipenv lock", None),
    "go.sum": ("Go lock", None),
    "Cargo.lock": ("Rust lock", None),
    "composer.lock": ("Composer lock", None),
    "Gemfile.lock": ("Bundler lock", None),
}

# ==========================================
# DISCOVERY
# ==========================================
def is_valid_path(path):
    parts = path.split("/")
    return not any(p in EXCLUDED_DIRS for p in parts)


def find_manifests(repo, branch):
    sha = get_branch_sha(repo, branch)
    if not sha:
        return []

    r = requests.get(
        f"{GITHUB_API}/repos/{repo}/git/trees/{sha}?recursive=1",
        headers=HEADERS
    )
    if r.status_code != 200:
        return []

    found = []
    for item in r.json().get("tree", []):
        name = item["path"].split("/")[-1]
        if item["type"] == "blob" and is_valid_path(item["path"]):
            if name in MANIFESTS or any(name.endswith(k) for k in MANIFESTS if k.startswith(".")):
                found.append(item["path"])
    return found

# ==========================================
# FETCH + PARSE
# ==========================================
def fetch_and_parse(repo, path, branch):
    r = requests.get(
        f"{GITHUB_API}/repos/{repo}/contents/{path}?ref={branch}",
        headers=HEADERS
    )
    if r.status_code != 200:
        return None, None, None

    raw = base64.b64decode(r.json()["content"]).decode(errors="ignore")
    name = path.split("/")[-1]

    for key, (ecosystem, parser) in MANIFESTS.items():
        if name == key or (key.startswith(".") and name.endswith(key)):
            deps = None
            if parser:
                deps = parser(json.loads(raw)) if name.endswith(".json") else parser(raw)
            return ecosystem, name, deps

    return None, None, None

# ==========================================
# MAIN
# ==========================================
def analyze_resume(pdf):
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        log(f"📄 SCANNING: {pdf}", f)
        log("=" * 80, f)

        for link in extract_github_links(pdf):
            user = get_username_from_url(link)
            if not user:
                continue

            log(f"\n👤 USER: {user}", f)
            for repo in fetch_all_repos(user):
                log(f"\n📁 REPO: {repo['name']}", f)

                manifests = find_manifests(repo["full_name"], repo["default_branch"])
                if not manifests:
                    log("   └── ❌ No manifests found", f)
                    continue

                for path in manifests:
                    eco, fname, deps = fetch_and_parse(
                        repo["full_name"], path, repo["default_branch"]
                    )

                    log(f"   📄 {path} [{eco}]", f)
                    if deps:
                        log(f"      ├── Dependencies: {len(deps)}", f)
                        for d, v in deps.items():
                            log(f"      │    - {d}: {v}", f)

                if not GITHUB_TOKEN:
                    time.sleep(1)

        log("\n✅ SCAN COMPLETE", f)

# ==========================================
# RUN
# ==========================================
if __name__ == "__main__":
    analyze_resume("Yash_Behera_Resume (1).pdf")  # Change to your PDF file
