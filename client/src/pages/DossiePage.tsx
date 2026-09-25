import React, { useState, useEffect, useRef } from "react";
import { CabecalhoPagina } from "../components/CabecalhoPagina";
import * as XLSX from "xlsx";
import {
  Search,
  FolderArchive,
  UserCheck,
  Calendar,
  Briefcase,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  FileDown,
  Info,
  Layers,
  FileText,
  Clock,
  ShieldCheck,
  Building2,
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckSquare,
  Square,
  RefreshCw,
  Eye,
  Download,
} from "lucide-react";
import { PdfViewerModal } from "../components/PdfViewerModal";
import { exibirCpf } from "../lib/lgpd";

interface CooperadoSearchResult {
  id: number;
  document: string;
  registration_number?: number | string;
  name: string;
  contract_name?: string;
  position?: string;
  admission_date?: string;
  status: string;
}

interface DossierInfo {
  matricula: string | number;
  nome: string;
  cpf: string;
  contrato_principal: string;
  admission_date: string | null;
  termination_date: string | null;
  status: string;
  has_ficha: boolean;
  ficha_id?: string;
  ficha_filename?: string;
  total_competencias: number;
  total_contratos: number;
}

interface BatchCooperadoItem {
  id?: number;
  originalName: string;
  found: boolean;
  name: string;
  cpf: string | null;
  matricula: string | number | null;
  contractName: string | null;
  status: string | null;
  base: "SIC" | "EasyCoop" | "Ambas" | "Não Localizado";
  hasExtrato: boolean;
  hasDemonstrativo: boolean;
  hasFicha: boolean;
  hasMissingItems: boolean;
}

interface BatchCheckResult {
  items: BatchCooperadoItem[];
  total: number;
  foundCount: number;
  notFoundCount: number;
  completeCount: number;
  partialCount: number;
}

/**
 * Formata CPF para o padrão 000.000.000-00
 */
function formatCpf(val?: string | null) {
  if (!val) return "-";
  const digits = val.replace(/\D/g, "");
  if (digits.length !== 11) return val;
  return exibirCpf(digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"));
}

/**
 * Formata data ISO para DD/MM/AAAA
 */
function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Gera a string de data atual DDMMAAAA para o nome do arquivo
 */
function getCurrentDateDDMMAAAA(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

export const DossiePage: React.FC = () => {
  // Controle de Abas no Topo
  const [activeTab, setActiveTab] = useState<"individual" | "lote">("individual");

  // ==========================================
  // ESTADOS DA ABA: CONSULTA INDIVIDUAL
  // ==========================================
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CooperadoSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [selectedCpf, setSelectedCpf] = useState<string | null>(null);
  const [dossierInfo, setDossierInfo] = useState<DossierInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [showMissingFichaModal, setShowMissingFichaModal] = useState(false);

  // ==========================================
  // ESTADOS DA ABA: PROCESSAMENTO EM LOTE
  // ==========================================
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [batchParsing, setBatchParsing] = useState(false);
  const [batchCheckResult, setBatchCheckResult] = useState<BatchCheckResult | null>(null);
  const [selectedItemIndices, setSelectedItemIndices] = useState<number[]>([]);
  const [batchProgress, setBatchProgress] = useState<{
    isRunning: boolean;
    current: number;
    total: number;
    currentName: string;
    completed: boolean;
  }>({
    isRunning: false,
    current: 0,
    total: 0,
    currentName: "",
    completed: false,
  });

  // Visualizador de PDF
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    subtitle?: string;
    filename?: string;
  }>({
    isOpen: false,
    url: "",
    title: "",
  });

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fecha o dropdown se clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounce na busca de cooperados
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/dossie/search?q=${encodeURIComponent(searchQuery.trim())}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.cooperados)) {
          setSearchResults(data.cooperados);
          setIsDropdownOpen(true);
        }
      } catch (err) {
        console.error("Erro na busca do Dossiê:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Carrega informações do cooperado selecionado
  const loadCooperado = async (cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, "");
    setSelectedCpf(cleanCpf);
    setIsDropdownOpen(false);
    setInfoLoading(true);
    setInfoError(null);

    try {
      const res = await fetch(`/api/dossie/info/${cleanCpf}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setDossierInfo(data);
      } else {
        setInfoError(data.error || "Não foi possível carregar os dados do cooperado.");
      }
    } catch (err: any) {
      setInfoError(err.message || "Erro de conexão ao buscar dados do cooperado.");
    } finally {
      setInfoLoading(false);
    }
  };

  // Dispara a geração individual
  const handleTriggerGenerate = () => {
    if (!dossierInfo || !selectedCpf) return;

    if (!dossierInfo.has_ficha) {
      setShowMissingFichaModal(true);
    } else {
      executeGenerateDossier(false);
    }
  };

  // Execução final da montagem do Dossiê individual
  const executeGenerateDossier = (semFicha: boolean) => {
    if (!selectedCpf || !dossierInfo) return;
    setShowMissingFichaModal(false);
    setIsGenerating(true);

    const safeName = (dossierInfo.nome || "COOPERADO")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .toUpperCase();

    const dateStr = getCurrentDateDDMMAAAA();
    const finalFilename = `${safeName}_${dateStr}.pdf`;

    const pdfUrl = `/api/dossie/pdf/${selectedCpf}${semFicha ? "?semFicha=true" : ""}`;

    setTimeout(() => {
      setIsGenerating(false);
      setPdfModal({
        isOpen: true,
        url: pdfUrl,
        title: `Dossiê Completo • ${dossierInfo.nome}`,
        subtitle: `Extrato de Repasses + Demonstrativo de Produtividade ${dossierInfo.has_ficha && !semFicha ? "+ Ficha de Adesão Easy" : "(Sem Ficha de Adesão)"}`,
        filename: finalFilename,
      });
    }, 600);
  };

  // ==========================================
  // FUNÇÕES DE PROCESSAMENTO EM LOTE
  // ==========================================
  const handleFileUpload = async (file: File) => {
    if (!file.name.match(/\.(csv|xls|xlsx)$/i)) {
      alert("Por favor, selecione um arquivo válido no formato CSV ou Excel (.xls ou .xlsx).");
      return;
    }

    setBatchFile(file);
    setBatchParsing(true);
    setBatchCheckResult(null);
    setSelectedItemIndices([]);
    setBatchProgress({ isRunning: false, current: 0, total: 0, currentName: "", completed: false });

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (!json || json.length === 0) {
        throw new Error("A planilha enviada está vazia.");
      }

      // Detecta a coluna que possui os nomes
      let nameColIndex = 0;
      if (json.length > 0 && Array.isArray(json[0])) {
        const headerIdx = json[0].findIndex(
          (cell: any) =>
            typeof cell === "string" &&
            /nome|cooperado|funcionario|pessoa|colaborador/i.test(cell.trim())
        );
        if (headerIdx !== -1) {
          nameColIndex = headerIdx;
        }
      }

      const extractedNames: string[] = [];
      for (let i = 0; i < json.length; i++) {
        const row = json[i];
        if (!Array.isArray(row)) continue;
        const val = String(row[nameColIndex] || "").trim();
        if (!val) continue;
        if (i <= 1 && /^(nome|nome completo|cooperado|colaborador)$/i.test(val)) continue;
        if (val.length >= 3) {
          extractedNames.push(val);
        }
      }

      if (extractedNames.length === 0) {
        throw new Error("Nenhum nome de cooperado válido foi identificado na planilha.");
      }

      // Envia lista para checagem em lote no backend
      const res = await fetch("/api/dossie/batch/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ names: extractedNames }),
      });

      const result: BatchCheckResult = await res.json();
      if (!res.ok) {
        throw new Error((result as any).error || "Falha ao analisar cooperados em lote.");
      }

      setBatchCheckResult(result);

      // Pré-seleciona todos os itens que foram localizados
      const foundIndices = result.items
        .map((item, idx) => (item.found ? idx : -1))
        .filter((idx) => idx !== -1);
      setSelectedItemIndices(foundIndices);
    } catch (err: any) {
      console.error("Erro ao processar arquivo em lote:", err);
      alert(err.message || "Erro ao processar o arquivo.");
    } finally {
      setBatchParsing(false);
    }
  };

  // Alterna seleção de todos os itens encontrados
  const toggleSelectAll = () => {
    if (!batchCheckResult) return;
    const foundIndices = batchCheckResult.items
      .map((item, idx) => (item.found ? idx : -1))
      .filter((idx) => idx !== -1);

    if (selectedItemIndices.length === foundIndices.length) {
      setSelectedItemIndices([]);
    } else {
      setSelectedItemIndices(foundIndices);
    }
  };

  // Alterna seleção de um item individual
  const toggleSelectItem = (index: number) => {
    setSelectedItemIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  // Gera um Dossiê individual a partir da tabela do lote
  const handleGenerateSingleFromBatch = (item: BatchCooperadoItem) => {
    if (!item.cpf) return;
    const cleanCpf = item.cpf.replace(/\D/g, "");
    const safeName = (item.name || "COOPERADO")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .toUpperCase();

    const dateStr = getCurrentDateDDMMAAAA();
    const finalFilename = `${safeName}_${dateStr}.pdf`;
    const pdfUrl = `/api/dossie/pdf/${cleanCpf}?semFicha=${!item.hasFicha}`;

    setPdfModal({
      isOpen: true,
      url: pdfUrl,
      title: `Dossiê Completo • ${item.name}`,
      subtitle: `Extrato de Repasses + Demonstrativo de Produtividade ${item.hasFicha ? "+ Ficha de Adesão Easy" : "(Sem Ficha de Adesão)"}`,
      filename: finalFilename,
    });
  };

  // Disparo sequencial dos downloads dos Dossiês selecionados
  const handleGenerateBatchSelected = async () => {
    if (!batchCheckResult || selectedItemIndices.length === 0) return;

    const itemsToProcess = selectedItemIndices
      .map((idx) => batchCheckResult.items[idx])
      .filter((item) => item && item.cpf);

    if (itemsToProcess.length === 0) {
      alert("Nenhum cooperado válido selecionado para geração.");
      return;
    }

    setBatchProgress({
      isRunning: true,
      current: 0,
      total: itemsToProcess.length,
      currentName: "",
      completed: false,
    });

    const dateStr = getCurrentDateDDMMAAAA();

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      const cleanCpf = item.cpf!.replace(/\D/g, "");

      setBatchProgress((prev) => ({
        ...prev,
        current: i + 1,
        currentName: item.name,
      }));

      const safeName = (item.name || "COOPERADO")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .toUpperCase();

      const finalFilename = `${safeName}_${dateStr}.pdf`;
      const downloadUrl = `/api/dossie/pdf/${cleanCpf}?download=true&semFicha=${!item.hasFicha}`;

      try {
        const res = await fetch(downloadUrl, { credentials: "include" });
        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = finalFilename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }, 1000);
        } else {
          console.error(`Falha ao baixar dossiê de ${item.name}`);
        }
      } catch (err) {
        console.error(`Erro ao gerar PDF de ${item.name}:`, err);
      }

      // Pequena pausa entre downloads para o navegador gerenciar tranquilamente
      await new Promise((r) => setTimeout(r, 600));
    }

    setBatchProgress((prev) => ({
      ...prev,
      isRunning: false,
      completed: true,
    }));
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <CabecalhoPagina
        icone={FolderArchive}
        titulo="Dossiê do Cooperado"
        descricao="Extrato de repasses, demonstrativo de produtividade e ficha de adesão em um único PDF."
        acoes={
          <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("individual")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "individual" ? "bg-white text-[#005487] shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Search className="h-4 w-4" />
              <span>Consulta individual</span>
            </button>
            <button
              onClick={() => setActiveTab("lote")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "lote" ? "bg-white text-[#005487] shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Em lote (CSV/XLS)</span>
            </button>
          </div>
        }
      />

        {/* ========================================================================= */}
        {/* CONTEÚDO DA ABA 1: CONSULTA INDIVIDUAL                                    */}
        {/* ========================================================================= */}
        {activeTab === "individual" && (
          <>
            {/* CAMPO DE PESQUISA INTELIGENTE (CPF OU NOME) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Localizar Cooperado para Geração do Dossiê
              </label>

              <div className="relative" ref={searchContainerRef}>
                <div className="relative flex items-center">
                  <Search className="absolute left-4 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0) setIsDropdownOpen(true);
                    }}
                    placeholder="Digite o CPF ou Nome do cooperado..."
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-inner"
                  />
                  {searchLoading ? (
                    <div className="absolute right-4">
                      <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
                    </div>
                  ) : searchQuery ? (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                        setIsDropdownOpen(false);
                      }}
                      className="absolute right-4 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                {/* DROPDOWN DE RESULTADOS */}
                {isDropdownOpen && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl max-h-80 overflow-y-auto z-50 divide-y divide-slate-100">
                    {searchResults.map((coop) => (
                      <div
                        key={coop.id}
                        onClick={() => {
                          setSearchQuery(coop.name);
                          loadCooperado(coop.document);
                        }}
                        className="p-3.5 sm:p-4 hover:bg-sky-50/70 cursor-pointer transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-2.5 rounded-xl bg-slate-100 group-hover:bg-sky-100 group-hover:text-sky-700 text-slate-600 transition-colors">
                            <UserCheck className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 group-hover:text-sky-900">
                                {coop.name}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-bold">
                                Matrícula #{coop.registration_number || "-"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                              <span className="font-mono">CPF: {formatCpf(coop.document)}</span>
                              <span>•</span>
                              <span className="truncate max-w-xs">{coop.contract_name || "Sem contrato definido"}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                              coop.status === "Ativo"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {coop.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ESTADO DE CARREGAMENTO */}
            {infoLoading && (
              <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-3 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                <p className="text-sm font-medium">Localizando dados completos e documentos do cooperado...</p>
              </div>
            )}

            {/* ESTADO DE ERRO */}
            {infoError && !infoLoading && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800 flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold">Não foi possível carregar o cooperado</h3>
                  <p className="text-xs mt-1 text-rose-600">{infoError}</p>
                </div>
              </div>
            )}

            {/* CARD DO COOPERADO SELECIONADO */}
            {dossierInfo && !infoLoading && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* TOPO DO CARD */}
                <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-sky-600/30 border border-sky-400/40 flex items-center justify-center text-sky-300 font-extrabold text-xl shadow-inner">
                      {dossierInfo.nome.substring(0, 2)}
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-black tracking-tight">{dossierInfo.nome}</h2>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs font-mono bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10 text-sky-200">
                          CPF: {formatCpf(dossierInfo.cpf)}
                        </span>
                        <span className="text-xs font-mono bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10 text-slate-300">
                          Matrícula #{dossierInfo.matricula}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm ${
                        dossierInfo.status === "Ativo"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full mr-2 ${dossierInfo.status === "Ativo" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                      {dossierInfo.status}
                    </span>
                  </div>
                </div>

                {/* GRID DE DADOS CADASTRADAIS EXIGIDOS */}
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-b border-slate-100 bg-slate-50/50">
                  {/* Matrícula */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start space-x-3">
                    <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700 shrink-0">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Matrícula</span>
                      <span className="text-sm font-black text-slate-800 font-mono">#{dossierInfo.matricula}</span>
                    </div>
                  </div>

                  {/* Nome Completo */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start space-x-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Nome Completo</span>
                      <span className="text-sm font-black text-slate-800 truncate block" title={dossierInfo.nome}>
                        {dossierInfo.nome}
                      </span>
                    </div>
                  </div>

                  {/* CPF */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start space-x-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">CPF</span>
                      <span className="text-sm font-black text-slate-800 font-mono">{formatCpf(dossierInfo.cpf)}</span>
                    </div>
                  </div>

                  {/* Contrato Principal */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start space-x-3">
                    <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Contrato Principal</span>
                      <span className="text-sm font-extrabold text-slate-800 truncate block" title={dossierInfo.contrato_principal}>
                        {dossierInfo.contrato_principal}
                      </span>
                    </div>
                  </div>

                  {/* Data de Admissão */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start space-x-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Data de Admissão</span>
                      <span className="text-sm font-extrabold text-emerald-800">
                        {formatDate(dossierInfo.admission_date)}
                      </span>
                    </div>
                  </div>

                  {/* Data de Desligamento */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start space-x-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${dossierInfo.termination_date ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Data de Desligamento</span>
                      <span className={`text-sm font-extrabold ${dossierInfo.termination_date ? "text-rose-700" : "text-slate-600"}`}>
                        {dossierInfo.termination_date ? formatDate(dossierInfo.termination_date) : "Ativo (Sem desligamento)"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* STATUS DOS 3 DOCUMENTOS DO DOSSIÊ */}
                <div className="p-6 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-sky-600" />
                    Documentos Que Farão Parte do Dossiê Unificado:
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Documento 1 */}
                    <div className="p-4 rounded-2xl border border-sky-200 bg-sky-50/50 flex flex-col justify-between space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="text-[11px] font-black text-sky-900 leading-tight">
                          1. EXTRATO DE REPASSES E LANÇAMENTOS SELECIONADOS
                        </span>
                        <CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0" />
                      </div>
                      <p className="text-[11px] text-sky-700">
                        Consolidado de todos os contratos e lançamentos do cooperado.
                      </p>
                      <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded w-fit">
                        {dossierInfo.total_contratos} Contrato(s) Vinculado(s)
                      </span>
                    </div>

                    {/* Documento 2 */}
                    <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 flex flex-col justify-between space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="text-[11px] font-black text-indigo-900 leading-tight">
                          2. DEMONSTRATIVO DE PRODUTIVIDADE E REPASSE
                        </span>
                        <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                      </div>
                      <p className="text-[11px] text-indigo-700">
                        Histórico completo com todos os anos e meses registrados.
                      </p>
                      <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded w-fit">
                        {dossierInfo.total_competencias} Competência(s) Analítica(s)
                      </span>
                    </div>

                    {/* Documento 3 - Ficha de Adesão Easy */}
                    <div
                      className={`p-4 rounded-2xl border flex flex-col justify-between space-y-2 transition-all ${
                        dossierInfo.has_ficha
                          ? "border-emerald-200 bg-emerald-50/60"
                          : "border-amber-200 bg-amber-50/60"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span
                          className={`text-[11px] font-black leading-tight ${
                            dossierInfo.has_ficha ? "text-emerald-900" : "text-amber-900"
                          }`}
                        >
                          3. FICHA DE ADESÃO EASY
                        </span>
                        {dossierInfo.has_ficha ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        )}
                      </div>
                      <p
                        className={`text-[11px] ${
                          dossierInfo.has_ficha ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {dossierInfo.has_ficha
                          ? `Arquivo localizado: ${dossierInfo.ficha_filename || "Ficha Cadastral Oficial"}`
                          : "Ficha de Adesão não localizada nos arquivos digitais."}
                      </p>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded w-fit uppercase ${
                          dossierInfo.has_ficha
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {dossierInfo.has_ficha ? "Disponível no Drive" : "Ficha Ausente"}
                      </span>
                    </div>
                  </div>

                  {/* BOTÃO PRINCIPAL: GERAR DOSSIÊ */}
                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Info className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>
                        O PDF será unificado na ordem exata (Extrato + Demonstrativos + Ficha) com o nome:{" "}
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono font-bold text-[11px]">
                          {dossierInfo.nome.split(" ")[0].toUpperCase()}_..._{getCurrentDateDDMMAAAA()}.pdf
                        </code>
                      </span>
                    </div>

                    <button
                      onClick={handleTriggerGenerate}
                      disabled={isGenerating}
                      className="w-full sm:w-auto px-7 py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-700 hover:from-sky-700 hover:to-indigo-700 shadow-lg shadow-sky-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2.5 cursor-pointer"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Compilando Dossiê Completo...</span>
                        </>
                      ) : (
                        <>
                          <FileDown className="h-5 w-5" />
                          <span>Gerar Dossiê</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL DE CONFIRMAÇÃO: FICHA DE ADESÃO AUSENTE */}
            {showMissingFichaModal && dossierInfo && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 rounded-2xl bg-amber-100 text-amber-700 shrink-0">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Ficha de Adesão Não Localizada
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        O cooperado <strong className="text-slate-800">{dossierInfo.nome}</strong> não possui a Ficha de Adesão Easy vinculada no arquivo digital.
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-xs text-amber-800 space-y-1">
                    <p className="font-bold">O que será gerado no Dossiê:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-900">
                      <li>Extrato de Repasses e Lançamentos (todos os contratos)</li>
                      <li>Demonstrativo de Produtividade (todas as competências)</li>
                    </ul>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-2">
                    <button
                      onClick={() => setShowMissingFichaModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => executeGenerateDossier(true)}
                      className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/20 transition-all cursor-pointer"
                    >
                      Prosseguir e Gerar Dossiê
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* CONTEÚDO DA ABA 2: PROCESSAMENTO EM LOTE (CSV / XLS / XLSX)              */}
        {/* ========================================================================= */}
        {activeTab === "lote" && (
          <div className="space-y-6">
            {/* DROPZONE / ÁREA DE UPLOAD */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className={`bg-white rounded-2xl p-8 border-2 border-dashed transition-all text-center flex flex-col items-center justify-center space-y-4 shadow-sm ${
                isDragging
                  ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xls, .xlsx"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />

              <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <UploadCloud className="h-8 w-8" />
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">
                  Arraste e solte o arquivo CSV ou Excel (XLS / XLSX)
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Suba a planilha contendo apenas a coluna de <strong>Nome Completo</strong> dos cooperados. O sistema buscará os CPFs, identificará a base e checará os 3 relatórios automaticamente.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={batchParsing || batchProgress.isRunning}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#005487] hover:bg-[#0c2856] text-white shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {batchParsing ? "Analisando Planilha..." : "Selecionar Arquivo"}
                </button>
                {batchFile && (
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    {batchFile.name}
                  </span>
                )}
              </div>
            </div>

            {/* ESTADO DE PARSING / AUDITORIA */}
            {batchParsing && (
              <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-3 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-sm font-bold text-slate-800">Auditando cooperados nas bases SIC e EasyCoop...</p>
                <p className="text-xs text-slate-400">Verificando CPFs, Extratos, Demonstrativos e Fichas de Adesão...</p>
              </div>
            )}

            {/* BARRA DE PROGRESSO DE DOWNLOAD EM LOTE */}
            {batchProgress.isRunning && (
              <div className="bg-white rounded-2xl p-6 border border-indigo-200 shadow-lg space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Gerando e Baixando Dossiês em Lote
                      </h4>
                      <p className="text-xs text-indigo-700 font-bold mt-0.5">
                        Processando {batchProgress.current} de {batchProgress.total}:{" "}
                        <span className="underline">{batchProgress.currentName}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-indigo-700">
                    {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                  </span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-sky-500 h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* ALERTA DE SUCESSO DE GERAÇÃO EM LOTE */}
            {batchProgress.completed && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between animate-in fade-in duration-200">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-800">
                    Downloads concluídos! {batchProgress.total} Dossiês individuais foram gerados e enviados para o seu navegador.
                  </span>
                </div>
                <button
                  onClick={() => setBatchProgress((prev) => ({ ...prev, completed: false }))}
                  className="text-emerald-700 hover:text-emerald-900 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* TABELA DE RESULTADOS DO LOTE */}
            {batchCheckResult && !batchParsing && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* CARDS DE RESUMO DE AUDITORIA */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Total na Planilha</span>
                    <span className="text-xl font-black text-slate-800 font-mono">{batchCheckResult.total}</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Localizados</span>
                    <span className="text-xl font-black text-sky-700 font-mono">{batchCheckResult.foundCount}</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">100% Completos (Verdes)</span>
                    <span className="text-xl font-black text-emerald-600 font-mono">{batchCheckResult.completeCount}</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Com Pendências (Vermelhos)</span>
                    <span className="text-xl font-black text-rose-600 font-mono">
                      {batchCheckResult.partialCount + batchCheckResult.notFoundCount}
                    </span>
                  </div>
                </div>

                {/* BARRA DE AÇÕES DA TABELA */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center space-x-2 text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
                    >
                      {selectedItemIndices.length > 0 &&
                      selectedItemIndices.length ===
                        batchCheckResult.items.filter((i) => i.found).length ? (
                        <CheckSquare className="h-4 w-4 text-indigo-600" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400" />
                      )}
                      <span>
                        Selecionar Todos ({selectedItemIndices.length} de {batchCheckResult.foundCount})
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => {
                        setBatchCheckResult(null);
                        setBatchFile(null);
                        setSelectedItemIndices([]);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer flex items-center space-x-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Limpar Planilha</span>
                    </button>

                    <button
                      onClick={handleGenerateBatchSelected}
                      disabled={selectedItemIndices.length === 0 || batchProgress.isRunning}
                      className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white shadow-md shadow-sky-600/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center space-x-2 cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      <span>Gerar Dossiês Selecionados ({selectedItemIndices.length})</span>
                    </button>
                  </div>
                </div>

                {/* TABELA DE COOPERADOS EM LOTE */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        <tr>
                          <th className="p-3.5 text-center w-10">#</th>
                          <th className="p-3.5">Nome do Cooperado</th>
                          <th className="p-3.5">CPF</th>
                          <th className="p-3.5">Base</th>
                          <th className="p-3.5 text-center">1. Extrato</th>
                          <th className="p-3.5 text-center">2. Demonstrativo</th>
                          <th className="p-3.5 text-center">3. Ficha Easy</th>
                          <th className="p-3.5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {batchCheckResult.items.map((item, idx) => {
                          const isSelected = selectedItemIndices.includes(idx);
                          return (
                            <tr
                              key={idx}
                              className={`transition-colors ${
                                !item.found
                                  ? "bg-rose-50/40 hover:bg-rose-50/70"
                                  : isSelected
                                  ? "bg-indigo-50/40 hover:bg-indigo-50/70"
                                  : "hover:bg-slate-50/80"
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="p-3.5 text-center">
                                {item.found ? (
                                  <button
                                    onClick={() => toggleSelectItem(idx)}
                                    className="cursor-pointer text-slate-600 hover:text-indigo-600"
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="h-4 w-4 text-indigo-600" />
                                    ) : (
                                      <Square className="h-4 w-4 text-slate-300" />
                                    )}
                                  </button>
                                ) : (
                                  <X className="h-4 w-4 text-rose-300 mx-auto" />
                                )}
                              </td>

                              {/* Nome */}
                              <td className="p-3.5">
                                <div className="font-bold text-slate-900">{item.name}</div>
                                {item.name !== item.originalName && (
                                  <div className="text-[10px] text-slate-400 italic">
                                    Na planilha: {item.originalName}
                                  </div>
                                )}
                              </td>

                              {/* CPF */}
                              <td className="p-3.5 font-mono">
                                {item.cpf ? (
                                  <span className="font-bold text-slate-800">{formatCpf(item.cpf)}</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700 border border-rose-200">
                                    Não Localizado
                                  </span>
                                )}
                              </td>

                              {/* Base */}
                              <td className="p-3.5">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                                    item.base === "Ambas"
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : item.base === "EasyCoop"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : item.base === "SIC"
                                      ? "bg-sky-50 text-sky-700 border-sky-200"
                                      : "bg-rose-50 text-rose-700 border-rose-200"
                                  }`}
                                >
                                  {item.base}
                                </span>
                              </td>

                              {/* 1. Extrato */}
                              <td className="p-3.5 text-center">
                                {item.hasExtrato ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="h-3 w-3" />
                                    OK
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <AlertCircle className="h-3 w-3" />
                                    Ausente
                                  </span>
                                )}
                              </td>

                              {/* 2. Demonstrativo */}
                              <td className="p-3.5 text-center">
                                {item.hasDemonstrativo ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="h-3 w-3" />
                                    OK
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <AlertCircle className="h-3 w-3" />
                                    Ausente
                                  </span>
                                )}
                              </td>

                              {/* 3. Ficha de Adesão */}
                              <td className="p-3.5 text-center">
                                {item.hasFicha ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="h-3 w-3" />
                                    OK
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <AlertCircle className="h-3 w-3" />
                                    Ausente
                                  </span>
                                )}
                              </td>

                              {/* Ação individual */}
                              <td className="p-3.5 text-right">
                                {item.found && item.cpf ? (
                                  <button
                                    onClick={() => handleGenerateSingleFromBatch(item)}
                                    className="px-3 py-1.5 rounded-xl font-bold text-[11px] bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 hover:border-sky-300 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    <span>Gerar</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">Indisponível</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL INTEGRADO DE VISUALIZAÇÃO DO PDF */}
        <PdfViewerModal
          isOpen={pdfModal.isOpen}
          onClose={() => setPdfModal({ isOpen: false, url: "", title: "" })}
          customUrl={pdfModal.url}
          customTitle={pdfModal.title}
          customSubtitle={pdfModal.subtitle}
          customFilename={pdfModal.filename}
          docType="ficha"
        />
    </div>
  );
};
export default DossiePage;
