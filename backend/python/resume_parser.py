import sys
import json
import pdfplumber
import pytesseract
from pdf2image import convert_from_path
from pathlib import Path

# ==============================
# CONFIG
# ==============================
OCR_DPI = 300
MIN_TEXT_LENGTH = 100   # threshold to trigger OCR

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
# MASTER PARSER
# ==============================
def parse_any_pdf(pdf_path):
    pdf_path = Path(pdf_path)

    if not pdf_path.exists():
        # Return empty if file not found, or raise error handled by main
        raise FileNotFoundError(f"PDF not found at {pdf_path}")

    # 1️⃣ Try native extraction
    text = extract_text_native(pdf_path)

    # 2️⃣ Fallback to OCR if needed
    if len(text) < MIN_TEXT_LENGTH:
        sys.stderr.write("⚠️ Low text detected — switching to OCR\n")
        ocr_text = extract_text_ocr(pdf_path)
        # Only use OCR if it actually got something
        if len(ocr_text) > len(text):
            text = ocr_text

    return text

# ==============================
# RUN
# ==============================
if __name__ == "__main__":
    # Integration: Read file path from command line arguments
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No PDF path provided"}))
        sys.exit(1)
        
    target_file = sys.argv[1]
    
    try:
        extracted_text = parse_any_pdf(target_file)
        
        # Output JSON so backend/src/services/resume.service.ts can parse it
        result = {
            "full_resume_text": extracted_text,
            "char_count": len(extracted_text)
        }
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)