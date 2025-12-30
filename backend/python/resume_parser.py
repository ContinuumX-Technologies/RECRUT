import sys
import pdfplumber
import requests
import base64
import json
import re
import os
import time
import xml.etree.ElementTree as ET

# TOML Support (Python 3.11+ or 'tomli' package)
try:
    from tomllib import loads as toml_loads
except ImportError:
    try:
        from tomli import loads as toml_loads
    except ImportError:
        toml_loads = None

# ==========================================
# CONFIGURATION
# ==========================================
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN") 
HEADERS = {"Accept": "application/vnd.github.v3+json"}
if GITHUB_TOKEN:
    HEADERS["Authorization"] = f"token {GITHUB_TOKEN}"

GITHUB_API = "https://api.github.com"

EXCLUDED_DIRS = {
    "node_modules", ".git", "dist", "build", ".next",
    "out", "coverage", "__pycache__", ".venv" ,"vendor",
    ".pnpm-store", ".yarn", ".cache"
}

# ==========================================
# LOGGING (To stderr so it doesn't break JSON)
# ==========================================
def log(msg):
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()

# ==========================================
# PDF → GITHUB
# ==========================================
def extract_github_links(pdf_path):
    links = set()
    full_text = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                full_text.append(text)
                
                if page.annots:
                    for a in page.annots:
                        uri = a.get("uri")
                        if uri and "github.com" in uri:
                            links.add(uri)

                matches = re.findall(r"(?:https?://)?github\.com/[A-Za-z0-9_.-]+", text)
                links.update(matches)
    except Exception as e:
        log(f"Error reading PDF: {e}")

    return "\n".join(full_text), list({
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
    # Sort by recent push
    repos.sort(key=lambda x: x.get("pushed_at", ""), reverse=True)
    # Limit to top 15 active repos to prevent timeouts
    return [
        {
            "name": r["name"],
            "full_name": r["full_name"],
            "default_branch": r["default_branch"]
        }
        for r in repos[:15] 
    ]

def get_branch_sha(repo, branch):
    r = requests.get(
        f"{GITHUB_API}/repos/{repo}/git/refs/heads/{branch}",
        headers=HEADERS
    )
    return r.json()["object"]["sha"] if r.status_code == 200 else None

# ==========================================
# PARSERS
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
    if not toml_loads: return {}
    try:
        data = toml_loads(text)
        return data.get("tool", {}).get("poetry", {}).get("dependencies", {})
    except: return {}

def parse_pom(text):
    deps = {}
    try:
        root = ET.fromstring(text)
        ns = {"m": "http://maven.apache.org/POM/4.0.0"}
        for d in root.findall(".//m:dependency", ns):
            gid = d.find("m:groupId", ns)
            aid = d.find("m:artifactId", ns)
            deps[f"{gid.text}:{aid.text}"] = "managed"
    except: pass
    return deps

def parse_go_mod(text):
    return {
        l.split()[0]: l.split()[1]
        for l in text.splitlines()
        if l.strip() and not l.startswith(("module", "require", "//")) and len(l.split()) >= 2
    }

def parse_cargo(text):
    if not toml_loads: return {}
    try:
        return toml_loads(text).get("dependencies", {})
    except: return {}

def parse_composer(data):
    return data.get("require", {})

def parse_csproj(text):
    deps = {}
    try:
        root = ET.fromstring(text)
        for p in root.findall(".//PackageReference"):
            deps[p.attrib.get("Include")] = p.attrib.get("Version", "managed")
    except: pass
    return deps

# ==========================================
# MANIFEST REGISTRY
# ==========================================
MANIFESTS = {
    "package.json": ("Node.js", parse_package_json),
    "requirements.txt": ("Python", parse_requirements_txt),
    "pyproject.toml": ("Python", parse_pyproject),
    "pom.xml": ("Java", parse_pom),
    "go.mod": ("Go", parse_go_mod),
    "Cargo.toml": ("Rust", parse_cargo),
    "composer.json": ("PHP", parse_composer),
    ".csproj": (".NET", parse_csproj),
    "Dockerfile": ("Docker", None),
    "docker-compose.yml": ("Docker Compose", None),
}

# ==========================================
# DISCOVERY
# ==========================================
def is_valid_path(path):
    parts = path.split("/")
    return not any(p in EXCLUDED_DIRS for p in parts)

def find_manifests(repo, branch):
    sha = get_branch_sha(repo, branch)
    if not sha: return []

    r = requests.get(
        f"{GITHUB_API}/repos/{repo}/git/trees/{sha}?recursive=1",
        headers=HEADERS
    )
    if r.status_code != 200: return []

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
    
    # [FIX] Always return 3 values
    if r.status_code != 200:
        return None, None, None

    try:
        raw = base64.b64decode(r.json()["content"]).decode(errors="ignore")
        name = path.split("/")[-1]

        for key, (ecosystem, parser) in MANIFESTS.items():
            if name == key or (key.startswith(".") and name.endswith(key)):
                deps = None
                if parser:
                    if name.endswith(".json"):
                        deps = parser(json.loads(raw))
                    else:
                        deps = parser(raw)
                return ecosystem, name, deps
    except Exception as e:
        log(f"Error parsing {path}: {e}")

    return None, None, None

# ==========================================
# MAIN
# ==========================================
def main(pdf_path):
    log(f"📄 Processing PDF: {pdf_path}")
    full_text, links = extract_github_links(pdf_path)

    # Structure required by Frontend/AIShadow
    result = {
        "raw_text_snippet": full_text[:500],
        "github_users": [],
        "tech_stack_found": {} 
    }

    for link in links:
        user = get_username_from_url(link)
        if not user: continue
        
        log(f"👤 Found User: {user}")
        user_data = {"username": user, "repos": []}
        
        repos = fetch_all_repos(user)
        for repo in repos:
            log(f"   Scanner repo: {repo['name']}")
            repo_data = {"name": repo["name"], "ecosystems": []}
            
            manifests = find_manifests(repo["full_name"], repo["default_branch"])
            
            for path in manifests:
                # [FIX] Unpack 3 values as expected by this function
                eco, fname, deps = fetch_and_parse(
                    repo["full_name"], path, repo["default_branch"]
                )

                if eco:
                    log(f"     ✅ Found {eco} in {path}")
                    if eco not in repo_data["ecosystems"]:
                        repo_data["ecosystems"].append(eco)
                    
                    # Add to global stats
                    result["tech_stack_found"][eco] = result["tech_stack_found"].get(eco, 0) + 1
            
            if repo_data["ecosystems"]:
                user_data["repos"].append(repo_data)
        
        result["github_users"].append(user_data)

    # Final Output to Stdout for Node.js
    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Fallback for testing without args
        print(json.dumps({"error": "No PDF path provided"}))
        sys.exit(1)
    
    main(sys.argv[1])