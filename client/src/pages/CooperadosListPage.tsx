import React, { useState, useEffect } from "react";
import { Search, UserCheck, CreditCard, Building2, Eye, Loader2, ArrowUpDown, ChevronLeft, ChevronRight, RefreshCw, Users, FileText } from "lucide-react";
import { CooperadoDetails } from "../components/CooperadoDetails";
import { PdfViewerModal } from "../components/PdfViewerModal";

export interface CooperadoListItem {
  id: number;
  document: string;
  registration_number?: number;
  name: string;
  contract_name?: string;
  admission_date?: string;
  status: string;
  email?: string;
  whatsapp_number?: string;
  city?: string;
  state?: string;
}

export const CooperadosListPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [cooperados, setCooperados] = useState<CooperadoListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedCpf, setSelectedCpf] = useState<string | null>(null);

  // Estado do Modal de Exibição de PDF
  const [pdfModalState, setPdfModalState] = useState<{
    isOpen: boolean;
    cpf: string;
    payrollId: string;
    competence: string;
    docType: "demonstrativo" | "comprovante";
  }>({
    isOpen: false,
    cpf: "",
    payrollId: "",
    competence: "",
    docType: "demonstrativo",
  });

  const fetchCooperadosList = async () => {
    setLoading(true);
    try {
      const url = `/api/cooperados/listar?search=${encodeURIComponent(search)}&pageNumber=${pageNumber}&pageSize=${pageSize}`;
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();

      if (res.ok) {
        setCooperados(data.cooperados || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error("Erro ao carregar lista de cooperados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCooperadosList();
    }, 300);

    return () => clearTimeout(timer);
  }, [search, pageNumber, pageSize]);

  const formatCpf = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return val;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/I";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-[98%] 2xl:max-w-[1850px] mx-auto px-2 sm:px-4 md:px-6 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200">
            <Users className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Lista Completa de Cooperados</h1>
            <p className="text-xs text-slate-500 font-medium">
              Consulta integrada via API (<span className="font-mono text-sky-700">/api/cooperado/listar</span>)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchCooperadosList()}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center space-x-2 transition-all shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Atualizar</span>
          </button>

          <span className="px-3.5 py-2 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 font-bold text-xs">
            Total: {totalCount.toLocaleString("pt-BR")} Cooperados
          </span>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageNumber(1);
            }}
            placeholder="Pesquisar por Nome, CPF ou Matrícula..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 font-medium"
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end text-xs font-semibold text-slate-600">
          <span>Itens por página:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPageNumber(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 shadow-sm"
          >
            <option value={10}>10 por página</option>
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
            <option value={500}>500 por página</option>
            <option value={12000}>Ver Todos (12.000)</option>
          </select>
        </div>
      </div>

      {/* Tabela de Cooperados */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 text-center flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 text-sky-600 animate-spin" />
            <p className="text-sm font-medium text-slate-600">Carregando lista de cooperados...</p>
          </div>
        ) : cooperados.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm font-medium">
            Nenhum cooperado encontrado com os critérios pesquisados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-4">Cooperado</th>
                  <th className="p-4">CPF</th>
                  <th className="p-4">Matrícula</th>
                  <th className="p-4">Contrato Principal</th>
                  <th className="p-4">Data Admissão</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {cooperados.map((item) => (
                  <tr
                    key={item.id || item.document}
                    className="hover:bg-sky-50/50 transition-colors group cursor-pointer"
                    onClick={() => setSelectedCpf(item.document)}
                  >
                    <td className="p-4 font-bold text-slate-900 flex items-center space-x-3">
                      <div className="h-9 w-9 rounded-xl bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center font-extrabold text-sm shrink-0">
                        {item.name.charAt(0)}
                      </div>
                      <span className="group-hover:text-sky-700 transition-colors line-clamp-1">
                        {item.name}
                      </span>
                    </td>

                    <td className="p-4 font-mono font-semibold text-slate-700">
                      {formatCpf(item.document)}
                    </td>

                    <td className="p-4 font-mono text-slate-600">
                      {item.registration_number || "N/I"}
                    </td>

                    <td className="p-4 text-slate-800 line-clamp-1 max-w-[220px]">
                      {item.contract_name || "COOPEDU GESTORES"}
                    </td>

                    <td className="p-4 text-slate-600">
                      {formatDate(item.admission_date)}
                    </td>

                    <td className="p-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        {item.status || "Ativo"}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCpf(item.document);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center space-x-1.5 ml-auto shadow-sm transition-all"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Ver Ficha</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé com Paginação */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-medium">
          <div>
            Página <strong className="text-slate-900">{pageNumber}</strong> de <strong className="text-slate-900">{totalPages}</strong> ({totalCount} registros)
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
              disabled={pageNumber === 1 || loading}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="px-3 py-1 font-bold text-slate-800">
              {pageNumber} / {totalPages}
            </span>

            <button
              onClick={() => setPageNumber((prev) => Math.min(prev + 1, totalPages))}
              disabled={pageNumber >= totalPages || loading}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-sm"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Ficha do Cooperado Selecionado */}
      {selectedCpf && (
        <CooperadoDetails
          cooperadoCpf={selectedCpf}
          onClose={() => setSelectedCpf(null)}
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

      {/* Modal de Exibição de PDF (Demonstrativo ou Comprovante) */}
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
