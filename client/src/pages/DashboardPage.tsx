import React, { useState, useEffect } from "react";
import { CooperadoSearch, Cooperado } from "../components/CooperadoSearch";
import { InlineCooperadoView } from "../components/InlineCooperadoView";
import { PdfViewerModal } from "../components/PdfViewerModal";
import { UserCheck, Search } from "lucide-react";

export const DashboardPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCpf, setSelectedCpf] = useState<string | null>(null);

  const [pdfModalState, setPdfModalState] = useState<{
    isOpen: boolean;
    cpf: string;
    payrollId: string;
    competence: string;
    docType: "demonstrativo" | "comprovante" | "recibo";
  }>({
    isOpen: false,
    cpf: "",
    payrollId: "",
    competence: "",
    docType: "demonstrativo",
  });

  const fetchCooperados = async (searchQuery: string = "") => {
    if (!searchQuery.trim()) {
      setCooperados([]);
      setSelectedCpf(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/cooperados/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        const list: Cooperado[] = data.cooperados || [];
        setCooperados(list);
        if (list.length > 0) {
          // Seleciona automaticamente o primeiro cooperado encontrado para exibir todas as suas informações
          setSelectedCpf(list[0].document);
        } else {
          setSelectedCpf(null);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar cooperados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCooperados(query);
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      {/* Campo Único de Pesquisa no Dashboard */}
      <CooperadoSearch
        query={query}
        setQuery={setQuery}
        cooperados={cooperados}
        loading={loading}
        selectedCpf={selectedCpf}
        onSelectCooperado={(c) => setSelectedCpf(c.document)}
      />

      {/* Exibição embutida de TODAS AS INFORMAÇÕES do Cooperado pesquisado */}
      {selectedCpf ? (
        <InlineCooperadoView
          key={selectedCpf}
          cooperadoCpf={selectedCpf}
          onOpenPdf={(cpf, payrollId, competence, docType = "demonstrativo") =>
            setPdfModalState({
              isOpen: true,
              cpf,
              payrollId,
              competence,
              docType,
            })
          }
        />
      ) : (
        <div className="bg-white p-12 sm:p-16 rounded-3xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
          <div className="p-4 rounded-3xl bg-sky-50 text-sky-600 border border-sky-200">
            <Search className="h-10 w-10" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-lg font-extrabold text-slate-800">Pesquisa de Cooperado</h3>
            <p className="text-xs text-slate-500 font-medium">
              Digite o CPF ou Nome no campo acima para carregar imediatamente a ficha completa, dados cadastrais, contatos e demonstrativos em PDF do cooperado.
            </p>
          </div>
        </div>
      )}

      {/* Modal de Exibição de PDF (Demonstrativo ou Comprovante Oficial Fitbank) */}
      {pdfModalState.isOpen && (
        <PdfViewerModal
          isOpen={pdfModalState.isOpen}
          onClose={() => setPdfModalState({ ...pdfModalState, isOpen: false })}
          cpf={pdfModalState.cpf}
          payrollId={pdfModalState.payrollId}
          competence={pdfModalState.competence}
          docType={pdfModalState.docType}
        />
      )}
    </div>
  );
};
