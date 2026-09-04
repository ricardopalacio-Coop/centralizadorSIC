
import pypdf
reader = pypdf.PdfReader("test_full_report.pdf")
print("NUM_PAGES:", len(reader.pages))

cpf_target = "259" # 259.301.878-00
for i, page in enumerate(reader.pages):
    text = page.extract_text()
    if "259" in text or "PALACIO" in text or "RICARDO" in text:
        print(f"🎯 PÁGINA {i+1} CONTÉM O COOPERADO RICARDO!")
        print("Trecho da pagina:", text[:200].replace("\n", " "))
