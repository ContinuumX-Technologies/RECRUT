import sys
import json
import re
import pdfplumber
import pytesseract
from pdf2image import convert_from_path
from pathlib import Path

# ==============================
# CONFIG
# ==============================
OCR_DPI = 300
MIN_TEXT_LENGTH = 100   # threshold to trigger OCR

# Common Tech Keywords for Analysis (Expand as needed)
TECH_KEYWORDS = {

    # =====================
    # PROGRAMMING LANGUAGES
    # =====================
    "javascript", "typescript", "python", "java", "c", "c++", "c#",
    "go", "golang", "rust", "php", "ruby", "swift", "kotlin",
    "scala", "dart", "r", "matlab", "bash", "shell", "powershell",
    "objective-c", "perl", "groovy", "haskell", "lua", "solidity",

    # =====================
    # FRONTEND
    # =====================
    "html", "html5", "css", "css3", "sass", "scss", "less",
    "react", "react.js", "next.js", "vue", "vue.js", "nuxt",
    "angular", "svelte",
    "redux", "zustand", "mobx", "recoil",
    "tailwind", "tailwindcss", "bootstrap", "mui", "material ui",
    "chakra ui", "ant design",
    "webpack", "vite", "parcel",
    "three.js", "react three fiber",
    "d3.js", "chart.js",

    # =====================
    # BACKEND
    # =====================
    "node.js", "node", "express", "nestjs", "fastify",
    "django", "flask", "fastapi",
    "spring", "spring boot",
    "laravel", "codeigniter",
    "rails", "ruby on rails",
    "asp.net", ".net", ".net core",
    "gin", "fiber", "phoenix",

    # =====================
    # DATABASES
    # =====================
    "sql", "nosql",
    "mysql", "postgres", "postgresql", "sqlite",
    "oracle", "sql server",
    "mongodb", "cassandra", "couchdb",
    "redis", "dynamodb", "firebase", "firestore",
    "neo4j", "elasticsearch", "opensearch",
    "influxdb", "timescaledb",

    # =====================
    # CLOUD & PLATFORMS
    # =====================
    "aws", "amazon web services",
    "azure", "microsoft azure",
    "gcp", "google cloud",
    "vercel", "netlify", "heroku",
    "digitalocean", "linode",
    "cloudflare", "firebase", "supabase",
    "railway", "render",

    # =====================
    # DEVOPS / INFRA
    # =====================
    "docker", "docker compose",
    "kubernetes", "k8s",
    "helm",
    "terraform", "ansible", "pulumi",
    "jenkins", "github actions", "gitlab ci",
    "circleci", "travis ci",
    "nginx", "apache",
    "istio", "prometheus", "grafana",
    "ci/cd", "infrastructure as code",

    # =====================
    # VERSION CONTROL & TOOLS
    # =====================
    "git", "github", "gitlab", "bitbucket",
    "jira", "confluence", "notion",
    "postman", "insomnia",
    "swagger", "openapi",
    "eslint", "prettier",
    "storybook",

    # =====================
    # TESTING
    # =====================
    "unit testing", "integration testing", "e2e testing",
    "jest", "mocha", "chai",
    "cypress", "playwright", "selenium",
    "pytest", "unittest", "nose",
    "junit", "testng",
    "k6", "locust",

    # =====================
    # DATA / ML / AI
    # =====================
    "data analysis", "data science",
    "numpy", "pandas", "scipy",
    "scikit-learn",
    "tensorflow", "pytorch", "keras",
    "xgboost", "lightgbm",
    "opencv", "mediapipe",
    "spacy", "nltk",
    "huggingface", "transformers",
    "llm", "large language models",
    "openai api", "langchain",
    "vector database", "faiss", "pinecone", "weaviate",

    # =====================
    # SYSTEM DESIGN / CS
    # =====================
    "data structures", "algorithms",
    "object oriented programming", "oop",
    "design patterns",
    "system design",
    "distributed systems",
    "operating systems",
    "computer networks",
    "dbms",
    "low latency systems",
    "scalability",

    # =====================
    # SECURITY
    # =====================
    "authentication", "authorization",
    "oauth", "oauth2", "jwt", "sso",
    "owasp", "owasp top 10",
    "xss", "csrf", "sql injection",
    "penetration testing",
    "mitm", "man in the middle",
    "encryption", "hashing",
    "tls", "ssl", "https",
    "security auditing", "web security",

    # =====================
    # MOBILE
    # =====================
    "android", "ios",
    "react native", "flutter",
    "swiftui", "jetpack compose",
    "expo",

    # =====================
    # EMBEDDED / IOT
    # =====================
    "embedded systems",
    "embedded c",
    "arduino", "raspberry pi",
    "esp32", "stm32",
    "rtos",
    "uart", "spi", "i2c",
    "firmware development",

    # =====================
    # BLOCKCHAIN / WEB3
    # =====================
    "blockchain",
    "ethereum", "solidity",
    "web3", "web3.js", "ethers.js",
    "smart contracts",
    "hardhat", "truffle",
    "ipfs",
    "defi", "nft"
}


# ==============================
# TEXT CLEANER
# ==============================
def clean_text(text: str) -> str:
    lines = [line.strip() for line in text.splitlines()]
    lines = [l for l in lines if l]
    return "\n".join(lines)

# ==============================
# EXTRACT TEXT (NATIVE)
# ==============================
def extract_text_native(pdf_path):
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        sys.stderr.write(f"Native extraction warning: {e}\n")
    return clean_text(text)

# ==============================
# EXTRACT TEXT (OCR)
# ==============================
def extract_text_ocr(pdf_path):
    try:
        images = convert_from_path(pdf_path, dpi=OCR_DPI)
        ocr_text = ""

        for img in images:
            ocr_text += pytesseract.image_to_string(img) + "\n"

        return clean_text(ocr_text)
    except Exception as e:
        sys.stderr.write(f"OCR extraction warning: {e}\n")
        return ""

# ==============================
# SECTION PARSER
# ==============================
def parse_sections(text):
    # Define regex patterns for headers
    patterns = {
        "education": r"(?i)^(education|academic background|qualifications)",
        "experience": r"(?i)^(experience|work experience|employment|history|professional experience)",
        "skills": r"(?i)^(skills|technical skills|technologies|stack|competencies)",
        "projects": r"(?i)^(projects|personal projects|academic projects)",
        "certifications": r"(?i)^(certifications|courses|achievements|awards)",
        "contact": r"(?i)^(contact|personal info|profile|summary|about)"
    }
    
    sections = {
        "contact": [],
        "experience": [],
        "education": [],
        "skills": [],
        "projects": [],
        "certifications": [],
        "other": []
    }
    
    current_section = "contact" # Default start
    
    lines = text.splitlines()
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Check if line matches a header
        found_header = False
        for section_name, pattern in patterns.items():
            # If line is short (header-like) and matches pattern
            if len(line) < 50 and re.match(pattern, line):
                current_section = section_name
                found_header = True
                break
        
        if not found_header:
            sections[current_section].append(line)
            
    # Join lists back to strings
    return {k: "\n".join(v) for k, v in sections.items()}

# ==============================
# SKILL EXTRACTOR
# ==============================
def extract_tech_stack(text):
    found = {}
    lower_text = text.lower()
    # Simple word boundary check
    for tech in TECH_KEYWORDS:
        # escapes symbols like c++ -> c\+\+
        pattern = r"\b" + re.escape(tech) + r"\b"
        if re.search(pattern, lower_text):
            found[tech] = True
    return found

# ==============================
# MASTER PARSER
# ==============================
def parse_any_pdf(pdf_path):
    pdf_path = Path(pdf_path)

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found at {pdf_path}")

    # 1. Try native extraction
    text = extract_text_native(pdf_path)

    # 2. Fallback to OCR if needed
    if len(text) < MIN_TEXT_LENGTH:
        sys.stderr.write("⚠️ Low text detected — switching to OCR\n")
        ocr_text = extract_text_ocr(pdf_path)
        if len(ocr_text) > len(text):
            text = ocr_text
            
    return text

# ==============================
# RUN
# ==============================
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No PDF path provided"}))
        sys.exit(1)
        
    target_file = sys.argv[1]
    
    try:
        # 1. Get raw text
        full_text = parse_any_pdf(target_file)
        
        # 2. Structure the data
        sections = parse_sections(full_text)
        tech_stack = extract_tech_stack(full_text)
        
        # 3. Construct Ordered Result
        # We manually order the dict keys for "proper ordered fashion"
        result = {
            "parsed_at": "now",
            "meta": {
                "char_count": len(full_text),
                "tech_keywords_found": len(tech_stack)
            },
            "contact_info": sections["contact"], # Usually at top
            "skills_detected": list(tech_stack.keys()), # List format for readability
            "tech_stack_found": tech_stack, # Dict format for Backend compatibility
            "sections": {
                "education": sections["education"],
                "experience": sections["experience"],
                "projects": sections["projects"],
                "skills_text": sections["skills"],
                "certifications": sections["certifications"]
            },
            "full_resume_text": full_text
        }
        
        # Output formatted JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        # Return error JSON so backend can handle it gracefully
        print(json.dumps({"error": str(e)}))
        sys.exit(1)