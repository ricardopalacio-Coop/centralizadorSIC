import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  FolderArchive,
  UserCheck,
  Calendar,
  Briefcase,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileDown,
  Info,
  Layers,
  FileText,
  Clock,
  ShieldCheck,
  Building2,
  X,
} from "lucide-react";
import { PdfViewerModal } from "../components/PdfViewerModal";

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

/**
 * Formata CPF para o padrão 000.000.000-00
 */
function formatCpf(val?: string) {
  if (!val) return "-";
  const digits = val.replace(/\D/g, "");
  if (digits.length !== 11) return val;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CooperadoSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [selectedCpf, setSelectedCpf] = useState<string | null>(null);
  const [dossierInfo, setDossierInfo] = useState<DossierInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Estados de Geração do Dossiê
  const [isGenerating, setIsGenerating] = useState(false);
  const [showMissingFichaModal, setShowMissingFichaModal] = useState(false);

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

  // Dispara a geração do PDF
  const handleTriggerGenerate = () => {
    if (!dossierInfo || !selectedCpf) return;

    // Se o cooperado não possui Ficha de Adesão, alertar antes de gerar conforme requisito
    if (!dossierInfo.has_ficha) {
      setShowMissingFichaModal(true);
    } else {
      executeGenerateDossier(false);
    }
  };

  // Execução final da montagem do Dossiê
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

    // Abre o visualizador integrado
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/20 to-slate-100/60 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* CABEÇALHO DO MÓDULO */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-500/20">
              <FolderArchive className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Dossiê do Cooperado
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-sky-100 text-sky-700 border border-sky-200">
                  EasyCoop Analytics
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Geração consolidada em documento único PDF (Extrato de Repasses + Demonstrativo de Produtividade + Ficha de Adesão)
              </p>
            </div>
          </div>
        </div>

        {/* CAMPO DE PESQUISA INTELIGENTE (CPF OU NOME) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
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
          <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            <p className="text-sm font-medium">Localizando dados completos e documentos do cooperado...</p>
          </div>
        )}

        {/* ESTADO DE ERRO */}
        {infoError && !infoLoading && (
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-rose-800 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Não foi possível carregar o cooperado</h3>
              <p className="text-xs mt-1 text-rose-600">{infoError}</p>
            </div>
          </div>
        )}

        {/* CARD DO COOPERADO SELECIONADO */}
        {dossierInfo && !infoLoading && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
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
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
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
    </div>
  );
};
export default DossiePage;
