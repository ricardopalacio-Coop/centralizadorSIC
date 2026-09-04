import React from "react";
import { X, Download, FileText, ExternalLink, CheckCircle2 } from "lucide-react";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cpf?: string;
  payrollId?: string;
  competence?: string;
  docType?: "demonstrativo" | "comprovante" | "recibo" | "ficha" | "grafico" | "lancamentos" | "folha-lote" | "esocial";
  customUrl?: string;
  customTitle?: string;
  customSubtitle?: string;
  customFilename?: string;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  cpf,
  payrollId,
  competence,
  docType = "demonstrativo",
  customUrl,
  customTitle,
  customSubtitle,
  customFilename,
}) => {
  if (!isOpen) return null;

  const isComprovante = docType === "comprovante" || docType === "recibo";
  let pdfUrl = customUrl;
  if (!pdfUrl && cpf && payrollId) {
    pdfUrl = `/api/cooperados/${cpf}/payrolls/${payrollId}/pdf?type=${isComprovante ? "comprovante" : "demonstrativo"}`;
  }

  const title = customTitle || (isComprovante ? "Comprovante de Pagamento" : "Demonstrativo de Pagamento");
  const subtitle = customSubtitle || "Documento Oficial emitido via Core Coopedu";
  const filename = customFilename || `${docType}-${cpf || "documento"}-${competence || "oficial"}.pdf`;

  const downloadUrl = pdfUrl ? (pdfUrl.includes("?") ? `${pdfUrl}&download=true` : `${pdfUrl}?download=true`) : "#";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 pdf-viewer-modal">
      <div className="bg-white w-full max-w-5xl h-[92vh] rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden relative">
        {/* Topbar do Leitor */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl border ${isComprovante ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-sky-50 text-sky-700 border-sky-200"}`}>
              {isComprovante ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {title}
                {competence && (
                  <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-700 font-mono text-xs font-bold border border-sky-200">
                    Competência {competence}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {pdfUrl && (
              <>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">Abrir em Nova Aba</span>
                </a>

                <a
                  href={downloadUrl}
                  download={filename}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 flex items-center space-x-1.5 transition-all shadow-md shadow-sky-600/20 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Download PDF</span>
                </a>
              </>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Visualizador de PDF */}
        <div className="flex-1 bg-slate-100 p-2 relative">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full rounded-2xl border border-slate-200 bg-white"
              title={title}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              Carregando visualizador de documento...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
