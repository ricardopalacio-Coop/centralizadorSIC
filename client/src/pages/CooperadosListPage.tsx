import React, { useState, useEffect } from "react";
import { CabecalhoPagina } from "../components/CabecalhoPagina";
import { Search, Eye, Loader2, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, RefreshCw, Users, X, DatabaseZap } from "lucide-react";
import { CooperadoDetails } from "../components/CooperadoDetails";
import { PdfViewerModal } from "../components/PdfViewerModal";
import { MultiSelectFilter, MultiSelectOption } from "../components/MultiSelectFilter";
import { exibirCpf } from "../lib/lgpd";

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
  base?: "SIC" | "EASY" | "SIC/EASY" | "—";
}

type SortKey = "name" | "document" | "registration_number" | "contract_name" | "admission_date" | "status" | "base";

type ColumnFilters = {
  nome: string;
  cpf: string;
  matricula: string;
  contrato: string[];
  admissao: string;
  status: string;
  base: string;
};

const EMPTY_FILTERS: ColumnFilters = { nome: "", cpf: "", matricula: "", contrato: [], admissao: "", status: "", base: "" };

// Valor usado pelo servidor para "sem contrato" na combo
const SEM_CONTRATO = "__sem__";

type SicSyncState = { running: boolean; phase: "cadastro" | "contratos" | null; processed: number; total: number; finishedAt: string | null; error: string | null };

const BASE_BADGE: Record<string, string> = {
  SIC: "bg-sky-100 text-[#005487] border-sky-200",
  EASY: "bg-violet-100 text-violet-700 border-violet-200",
  "SIC/EASY": "bg-teal-100 text-teal-700 border-teal-200",
};

const SORT_COLUMNS: [SortKey, string][] = [
  ["name", "Cooperado"],
  ["document", "CPF"],
  ["registration_number", "Matrícula"],
  ["contract_name", "Contrato Principal"],
  ["admission_date", "Data Admissão"],
  ["status", "Status"],
  ["base", "Base"],
];

type TextFilterKey = "nome" | "cpf" | "matricula" | "admissao";

const TEXT_FILTERS_BEFORE_CONTRATO: [TextFilterKey, string][] = [
  ["nome", "Filtrar nome"],
  ["cpf", "Filtrar CPF"],
  ["matricula", "Filtrar matrícula"],
];

const STATUS_BADGE: Record<string, string> = {
  ativo: "bg-emerald-100 text-emerald-700 border-emerald-200",
  inativo: "bg-amber-100 text-amber-800 border-amber-300",
  desligado: "bg-red-100 text-red-700 border-red-200",
};

const statusBadgeClass = (status?: string) =>
  STATUS_BADGE[(status || "Ativo").trim().toLowerCase()] || "bg-slate-100 text-slate-700 border-slate-200";

export const CooperadosListPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [cooperados, setCooperados] = useState<CooperadoListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedCpf, setSelectedCpf] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const hasFilters = Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  const [contratoOptions, setContratoOptions] = useState<MultiSelectOption[]>([]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
    setPageNumber(1);
  };

  const updateFilter = <K extends keyof ColumnFilters>(key: K, value: ColumnFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageNumber(1);
  };

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
      const params = new URLSearchParams({
        search,
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
        sortBy,
        sortDir,
      });
      Object.entries(filters).forEach(([k, v]) => {
        if (Array.isArray(v)) v.forEach((item) => params.append(k, item));
        else if (v) params.set(k, v);
      });
      const url = `/api/cooperados/listar?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();

      if (res.ok) {
        setCooperados(data.cooperados || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
        setContratoOptions(
          (data.contratoOptions || []).map((o: { value: string; count: number }) => ({
            value: o.value,
            label: o.value === SEM_CONTRATO ? "Sem contrato" : o.value,
            count: o.count,
          }))
        );
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
  }, [search, pageNumber, pageSize, sortBy, sortDir, filters]);

  // Sincronização completa com a API do SIC (roda no servidor em segundo plano)
  const [sicSync, setSicSync] = useState<SicSyncState | null>(null);

  const pollSicSync = async () => {
    try {
      const res = await fetch("/api/cooperados/sincronizar-sic", { credentials: "include" });
      if (res.ok) setSicSync(await res.json());
    } catch {}
  };

  const startSicSync = async () => {
    const res = await fetch("/api/cooperados/sincronizar-sic", { method: "POST", credentials: "include" });
    if (res.ok) setSicSync(await res.json());
  };

  useEffect(() => {
    pollSicSync();
  }, []);

  useEffect(() => {
    if (!sicSync?.running) return;
    const timer = setInterval(pollSicSync, 3000);
    return () => {
      clearInterval(timer);
      fetchCooperadosList();
    };
  }, [sicSync?.running]);

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
    <div className="w-full max-w-[1700px] mx-auto space-y-6 animate-in fade-in duration-300">
      <CabecalhoPagina
        icone={Users}
        titulo="Cooperados"
        descricao="Lista completa integrada pela API do Core Coopedu."
        contador={`${totalCount.toLocaleString("pt-BR")} cooperados`}
        acoes={
          <div className="flex items-center gap-2">
            <button
              onClick={startSicSync}
              disabled={sicSync?.running}
              title="Buscar todos os cooperados da API do SIC"
              className="h-11 px-4 rounded-xl bg-[#005487] hover:bg-[#0c2856] disabled:opacity-70 text-white font-semibold text-sm flex items-center gap-2 transition-all"
            >
              <DatabaseZap className={`h-4 w-4 ${sicSync?.running ? "animate-pulse" : ""}`} />
              <span>
                {sicSync?.running
                  ? `SIC: ${sicSync.phase === "contratos" ? "contratos" : "cadastro"} ${sicSync.total ? Math.round((sicSync.processed / sicSync.total) * 100) : 0}%`
                  : "Sincronizar SIC"}
              </span>
            </button>
            <button
              onClick={() => fetchCooperadosList()}
              className="h-11 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center gap-2 transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span>Atualizar</span>
            </button>
          </div>
        }
      />

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
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
            <option value={20000}>Ver Todos</option>
          </select>
        </div>
      </div>

      {/* Tabela de Cooperados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  {SORT_COLUMNS.map(([key, label]) => (
                    <th key={key} className="p-4 pb-2">
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-[#005487] transition-colors ${sortBy === key ? "text-[#005487]" : ""}`}
                        title={`Ordenar por ${label}`}
                      >
                        {label}
                        {sortBy !== key ? (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        ) : sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                  ))}
                  <th className="p-4 pb-2 text-right">Ação</th>
                </tr>
                <tr className="normal-case tracking-normal font-medium">
                  {TEXT_FILTERS_BEFORE_CONTRATO.map(([key, placeholder]) => (
                    <th key={key} className="px-4 pb-3">
                      <input
                        type="text"
                        value={filters[key]}
                        onChange={(e) => updateFilter(key, e.target.value)}
                        placeholder={placeholder}
                        className="w-full min-w-[90px] px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-[11px] font-medium focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                      />
                    </th>
                  ))}
                  <th className="px-4 pb-3">
                    <MultiSelectFilter
                      options={contratoOptions}
                      selected={filters.contrato}
                      onChange={(values) => updateFilter("contrato", values)}
                      placeholder="Todos os contratos"
                      searchPlaceholder="Pesquisar contrato..."
                    />
                  </th>
                  <th className="px-4 pb-3">
                    <input
                      type="text"
                      value={filters.admissao}
                      onChange={(e) => updateFilter("admissao", e.target.value)}
                      placeholder="dd/mm/aaaa"
                      className="w-full min-w-[90px] px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-[11px] font-medium focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    />
                  </th>
                  <th className="px-4 pb-3">
                    <select
                      value={filters.status}
                      onChange={(e) => updateFilter("status", e.target.value)}
                      className="w-full min-w-[100px] px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-[11px] font-medium focus:outline-none focus:border-sky-500"
                    >
                      <option value="">Todos</option>
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                      <option value="Desligado">Desligado</option>
                    </select>
                  </th>
                  <th className="px-4 pb-3">
                    <select
                      value={filters.base}
                      onChange={(e) => updateFilter("base", e.target.value)}
                      className="w-full min-w-[90px] px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-[11px] font-medium focus:outline-none focus:border-sky-500"
                    >
                      <option value="">Todas</option>
                      <option value="SIC">SIC</option>
                      <option value="EASY">EASY</option>
                      <option value="SIC/EASY">SIC/EASY</option>
                    </select>
                  </th>
                  <th className="px-4 pb-3 text-right">
                    {hasFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilters(EMPTY_FILTERS);
                          setPageNumber(1);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold"
                      >
                        <X className="h-3 w-3" />
                        Limpar
                      </button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-24">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <Loader2 className="h-8 w-8 text-sky-600 animate-spin" />
                        <p className="text-sm font-medium text-slate-600">Carregando lista de cooperados...</p>
                      </div>
                    </td>
                  </tr>
                ) : cooperados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-500 text-sm font-medium">
                      Nenhum cooperado encontrado com os critérios pesquisados.
                    </td>
                  </tr>
                ) : cooperados.map((item) => (
                  <tr
                    key={item.id || item.document}
                    className="hover:bg-sky-50/50 transition-colors group cursor-pointer"
                    onClick={() => setSelectedCpf(item.document)}
                  >
                    <td className="p-4 font-bold text-slate-900 min-w-[260px]"><div className="flex items-center space-x-3">
                      <div className="h-9 w-9 rounded-xl bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center font-extrabold text-sm shrink-0">
                        {item.name.trim().charAt(0)}
                      </div>
                      <span className="group-hover:text-[#005487] transition-colors line-clamp-1">
                        {item.name}
                      </span>
                      </div>
                    </td>

                    <td className="p-4 font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {exibirCpf(formatCpf(item.document))}
                    </td>

                    <td className="p-4 font-mono text-slate-600 whitespace-nowrap">
                      {item.registration_number || "N/I"}
                    </td>

                    <td className="p-4 text-slate-800 max-w-[240px]">
                      <span className="block truncate" title={item.contract_name || ""}>
                        {item.contract_name || <span className="text-slate-400 italic">Sem contrato</span>}
                      </span>
                    </td>

                    <td className="p-4 text-slate-600 whitespace-nowrap">
                      {formatDate(item.admission_date)}
                    </td>

                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClass(item.status)}`}>
                        {item.status || "Ativo"}
                      </span>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${BASE_BADGE[item.base || ""] || "bg-slate-100 text-slate-500 border-slate-200"}`}>
                        {item.base || "—"}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCpf(item.document);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#005487] hover:bg-[#0c2856] text-white font-bold text-xs flex items-center space-x-1.5 ml-auto shadow-sm transition-all"
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
