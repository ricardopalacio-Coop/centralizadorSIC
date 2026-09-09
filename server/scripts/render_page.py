import sys
try:
    import pymupdf as fitz
except ImportError:
    import fitz

def main():
    try:
        # Lê PDF de arquivo se passado, senão de stdin
        if len(sys.argv) > 1 and sys.argv[1] != "-":
            pdf_path = sys.argv[1]
            doc = fitz.open(pdf_path)
        else:
            pdf_bytes = sys.stdin.buffer.read()
            if not pdf_bytes:
                sys.stderr.write("Nenhum dado recebido via stdin\n")
                sys.exit(1)
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        if len(doc) == 0:
            sys.stderr.write("PDF sem paginas\n")
            sys.exit(1)

        # Rotação adicional opcional via argumento 3 (ex: 0, 180, 90, 270)
        rotation = 0
        if len(sys.argv) > 3:
            try:
                rotation = int(sys.argv[3])
            except ValueError:
                rotation = 0

        # Renderiza estritamente a primeira página (página 0) em 200 DPI para precisão de OCR
        page = doc[0]
        if rotation != 0:
            page.set_rotation((page.rotation + rotation) % 360)

        pix = page.get_pixmap(dpi=200)
        png_bytes = pix.tobytes("png")

        # Se houver um segundo argumento para salvar em arquivo
        if len(sys.argv) > 2 and sys.argv[2] != "-":
            out_path = sys.argv[2]
            with open(out_path, "wb") as f:
                f.write(png_bytes)
        else:
            sys.stdout.buffer.write(png_bytes)

    except Exception as e:
        sys.stderr.write(f"Erro ao renderizar pagina 1 do PDF: {e}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
