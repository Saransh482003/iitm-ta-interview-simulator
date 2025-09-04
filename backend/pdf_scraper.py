import os
import re
import fitz
import json
from pathlib import Path
from unidecode import unidecode

def extract_text_by_page(folder_path: str, pdf_file: str):
    """
        Extracts text page by page from a PDF.
        Returns: list of {"page": int, "text": str}
    """
    doc = fitz.open(os.path.join(folder_path, pdf_file))
    week = folder_path.split("/")[-1]
    extraction = {}
    all_text = ""
    for i, page in enumerate(doc):
        text = page.get_text("text")
        text = unidecode(text)
        text = re.sub(r'[\u0000-\u001F\u007F]', '', text)
        text = text.encode().decode("unicode_escape")
        text = text.replace('\"', '\'')
        text = re.sub(r'\.{5,}\s*\d*', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        cleaned_text = ' '.join(text.split())
        all_text += cleaned_text + "\n"
        print(f"Extracted page {i + 1} from {pdf_file}")
    doc.close()
    with open(f"./extracted_pdfs/{week}_extracted.txt", "w", encoding="utf-16") as f:
        f.write(all_text)
    return extraction

for folders in os.listdir("./Transcripts"):
    files = os.listdir(f"./Transcripts/{folders}")
    pdf_files = [f for f in files if f.endswith(".pdf")]

    for pdf_file in pdf_files:
        extract_text_by_page(f"./Transcripts/{folders}", pdf_file)