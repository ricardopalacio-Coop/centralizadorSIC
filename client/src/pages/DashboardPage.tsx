import React, { useState, useEffect } from "react";
import { CooperadoSearch, Cooperado } from "../components/CooperadoSearch";
import { InlineCooperadoView } from "../components/InlineCooperadoView";
import { EasyCoopCooperadoDossier } from "../components/EasyCoopCooperadoDossier";
import { PdfViewerModal } from "../components/PdfViewerModal";
import { CabecalhoPagina } from "../components/CabecalhoPagina";
import { UserCheck, Search, Layers, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export const DashboardPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCpf, setSelectedCpf] = useState<string | null>(null);

  // Status de presença nas bases SIC e EasyCoop
  const [statusLoading, setStatusLoading] = useState(false);
  const [cooperadoStatus, setCooperadoStatus] = useState<{
    hasSicData: boolean;
    hasEasycoopData: boolean;
    cooperadoName?: string;
  } | null>(null);

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
      setCooperadoStatus(null);
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
          setSelectedCpf(list[0].document);
        } else {
          setSelectedCpf(null);
          setCooperadoStatus(null);
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

  // Consulta status de presença nas bases ao selecionar um CPF
  useEffect(() => {
    if (!selectedCpf) {
      setCooperadoStatus(null);
      return;
    }

    let isMounted = true;
    setStatusLoading(true);

    fetch(`/api/cooperados/${selectedCpf}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setCooperadoStatus({
          hasSicData: Boolean(data.hasSicData),
          hasEasycoopData: Boolean(data.hasEasycoopData),
          cooperadoName: data.cooperado?.name || "",
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Erro ao verificar bases do cooperado:", err);
        setCooperadoStatus({
          hasSicData: false,
          hasEasycoopData: false,
        });
      })
      .finally(() => {
        if (isMounted) setStatusLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCpf]);

  return (
    <div className="w-full max-w-[1700px] mx-auto space-y-6 animate-in fade-in duration-300">
      <CabecalhoPagina
        icone={UserCheck}
        titulo="Pesquisa Cooperado"
        descricao="Consulta unificada das bases SIC e EasyCoop por CPF, nome ou matrícula."
        contador={query.trim() ? `${cooperados.length} ${cooperados.length === 1 ? "resultado" : "resultados"}` : undefined}
      />

      {/* Campo Único de Pesquisa no Dashboard */}
      <CooperadoSearch
        query={query}
        setQuery={setQuery}
        cooperados={cooperados}
        loading={loading}
        selectedCpf={selectedCpf}
        onSelectCooperado={(c) => setSelectedCpf(c.document)}
      />

      {/* Exibição condicional com base na existência de dados no SIC e EasyCoop */}
      {selectedCpf ? (
        statusLoading ? (
          <div className="bg-white p-14 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center space-y-3 shadow-sm">
            <Loader2 className="h-8 w-8 text-sky-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-600">Verificando bases de dados oficiais...</p>
          </div>
        ) : !cooperadoStatus?.hasSicData && !cooperadoStatus?.hasEasycoopData ? (
          <div className="bg-white p-12 sm:p-16 rounded-2xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
              <AlertCircle className="h-10 w-10" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-lg font-extrabold text-slate-800">Cooperado não localizado nas bases</h3>
              <p className="text-xs text-slate-500 font-medium">
                Este cooperado não possui cadastro ativo no portal SIC nem alocações com matrícula registradas no banco de dados EasyCoop.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Badges de Origem dos Dados */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-500 mr-1">Bases Disponíveis:</span>
                {cooperadoStatus.hasSicData && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-sky-50 text-sky-700 border border-sky-200">
                    <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse"></span>
                    Base Oficial SIC
                  </span>
                )}
                {cooperadoStatus.hasEasycoopData && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Base EasyCoop Analytics
                  </span>
                )}
              </div>

              {!cooperadoStatus.hasSicData && cooperadoStatus.hasEasycoopData && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
                  Sem cadastro no portal SIC (exibindo exclusivamente dados EasyCoop)
                </span>
              )}
              {cooperadoStatus.hasSicData && !cooperadoStatus.hasEasycoopData && (
                <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
                  Sem alocações registradas no EasyCoop (exibindo exclusivamente dados SIC)
                </span>
              )}
            </div>

            {/* SEÇÃO SUPERIOR: SIC (Renderizado somente se tiver dados no SIC) */}
            {cooperadoStatus.hasSicData && (
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
            )}

            {/* SEÇÃO INFERIOR: DOSSIÊ INTEGRADO EASYCOOP (Renderizado somente se tiver dados no EasyCoop) */}
            {cooperadoStatus.hasEasycoopData && (
              <div className={cooperadoStatus.hasSicData ? "pt-6 border-t border-slate-200" : ""}>
                {cooperadoStatus.hasSicData && (
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20">
                      <Layers className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">Dossiê Integrado EasyCoop</h2>
                      <p className="text-xs text-slate-500 font-medium">Dados cadastrais, alocações, financeiro, folha de pagamento e e-Social</p>
                    </div>
                  </div>
                )}
                <EasyCoopCooperadoDossier key={selectedCpf} selectedCpf={selectedCpf} hideTopHeader={cooperadoStatus.hasSicData} />
              </div>
            )}
          </div>
        )
      ) : (
        <div className="bg-white p-12 sm:p-16 rounded-2xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
          <div className="p-4 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200">
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
