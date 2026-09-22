import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Download,
  ExternalLink,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderArchive,
  FileCheck,
  Building2,
  AlertCircle,
  X,
  KeyRound,
  Calendar,
  LogIn,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Fingerprint,
  ChevronDown,
  Zap,
  RotateCcw,
  UserX,
  FileMinus,
  Pencil,
} from "lucide-react";
import { EditFichaModal } from "../components/EditFichaModal";

export interface FichaDesligamentoItem {
  id: string;
  name: string;
  cooperadoName: string;
  cpf?: string | null;
  matricula?: string | null;
  birthDate?: string | null;
  terminationDate?: string | null;
  contractName?: string | null;
  modifiedTime: string;
  createdTime?: string;
  size?: number;
  mimeType: string;
  tipo: string;
  folderId: string;
  folderName: string;
  webViewLink?: string;
  webContentLink?: string;
  ocrStatus?: "PENDING" | "PROCESSING" | "SUCCESS" | "UNREADABLE" | "FAILED";
}

export interface FichasDesligamentoMetrics {
  total: number;
  desligamentos: number;
  desligamentos2: number;
  outros: number;
  comCpf: number;
  semCpf: number;
}

export interface ScanStatus {
  isScanning: boolean;
  totalFiles: number;
  processedFiles: number;
  successCount: number;
  unreadableCount: number;
  errorCount: number;
  startTime: string | null;
  lastFinishedTime: string | null;
  currentFileName?: string;
  progressPercentage: number;
  error?: string;
}

export interface DriveStatus {
  configured: boolean;
  authMethod: string;
  rootFolderId: string;
  foldersFound: { name: string; id: string; tipo: string }[];
  totalCached?: number;
  lastSync: string | null;
  isSyncing: boolean;
  error?: string;
}

export const FichasDesligamentoPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("Todos");
  const [cpfFilter, setCpfFilter] = useState<"all" | "with_cpf" | "without_cpf">("all");
  const [sortBy, setSortBy] = useState<"cooperadoName" | "modifiedTime" | "tipo" | "cpf">("modifiedTime");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [items, setItems] = useState<FichaDesligamentoItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [metrics, setMetrics] = useState<FichasDesligamentoMetrics>({
    total: 0,
    desligamentos: 0,
    desligamentos2: 0,
    outros: 0,
    comCpf: 0,
    semCpf: 0,
  });
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [startingScan, setStartingScan] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showScanMenu, setShowScanMenu] = useState(false);
  const [editingItem, setEditingItem] = useState<FichaDesligamentoItem | null>(null);
  const [isUpdatingEasy, setIsUpdatingEasy] = useState(false);

  const handleAtualizarEasy = async () => {
    setIsUpdatingEasy(true);
    try {
      const res = await fetch("/api/drive/desligamento/atualizar-easy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`${data.message}`);
        fetchFichas();
      } else {
        alert(`${data.error || "Falha ao atualizar dados com a base Easy."}`);
      }
    } catch (err: any) {
      alert(`Erro ao comunicar com o servidor: ${err.message}`);
    } finally {
      setIsUpdatingEasy(false);
    }
  };

  const fetchFichas = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/drive/desligamento/fichas?search=${encodeURIComponent(
        search
      )}&tipo=${encodeURIComponent(tipoFilter)}&cpfStatus=${encodeURIComponent(
        cpfFilter
      )}&sortBy=${sortBy}&sortOrder=${sortOrder}&page=${page}&pageSize=${pageSize}`;

      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();

      if (res.ok) {
        setItems(data.items || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
        if (data.metrics) setMetrics(data.metrics);
        if (data.scanStatus) setScanStatus(data.scanStatus);
        if (data.status) setDriveStatus(data.status);
      } else {
        if (data.status) setDriveStatus(data.status);
      }
    } catch (err) {
      console.error("Erro ao carregar fichas de desligamento:", err);
    } finally {
      setLoading(false);
    }
  }, [search, tipoFilter, cpfFilter, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFichas();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchFichas]);

  // Polling global para acompanhar progresso da varredura em tempo real (para todos os usuários)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const pollInterval = scanStatus?.isScanning ? 1500 : 7000;

    interval = setInterval(async () => {
      try {
        const res = await fetch("/api/drive/desligamento/scan-status", { credentials: "include" });
        const data = await res.json();
        
        // Se a varredura terminou no servidor, atualiza a lista globalmente
        if (scanStatus?.isScanning && !data.isScanning) {
          fetchFichas();
        }
        setScanStatus(data);
      } catch (e) {
        // silencioso
      }
    }, pollInterval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scanStatus?.isScanning, fetchFichas]);

  const handleStartScan = async (forceFullRescan = false) => {
    setStartingScan(true);
    try {
      const res = await fetch("/api/drive/desligamento/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ forceFullRescan }),
      });
      const data = await res.json();
      if (res.ok && data.scanStatus) {
        setScanStatus(data.scanStatus);
      } else {
        alert(data.error || "Erro ao iniciar varredura profunda.");
      }
    } catch (err: any) {
      console.error("Erro ao iniciar varredura:", err);
      alert("Falha ao iniciar varredura: " + err.message);
    } finally {
      setStartingScan(false);
    }
  };

  const handleStopScan = async () => {
    try {
      await fetch("/api/drive/desligamento/stop-scan", {
        method: "POST",
        credentials: "include",
      });
      setScanStatus((prev) => (prev ? { ...prev, isScanning: false } : null));
      fetchFichas();
    } catch (err) {
      console.error("Erro ao parar varredura:", err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/drive/desligamento/sync", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.result) {
        setItems(data.result.items || []);
        setTotalCount(data.result.totalCount || 0);
        setTotalPages(data.result.totalPages || 1);
        if (data.result.metrics) setMetrics(data.result.metrics);
        if (data.result.scanStatus) setScanStatus(data.result.scanStatus);
        if (data.result.status) setDriveStatus(data.result.status);
      } else {
        if (data.status) setDriveStatus(data.status);
      }
    } catch (err) {
      console.error("Erro na sincronização de Desligamentos do Google Drive:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    setDownloadingId(fileId);
    try {
      const response = await fetch(`/api/drive/desligamento/download/${fileId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Falha ao baixar arquivo");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName || `desligamento_${fileId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Erro no download:", err);
      window.open(`https://drive.google.com/uc?export=download&id=${fileId}`, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/I";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const formatBirthDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    try {
      const clean = String(dateStr).split("T")[0];
      const parts = clean.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getTipoBadge = (tipo: string) => {
    if (tipo.includes("2")) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1.5 w-fit">
          <FileMinus className="h-3.5 w-3.5 text-rose-600" />
          <span>Desligamentos 2</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1.5 w-fit">
        <UserX className="h-3.5 w-3.5 text-amber-600" />
        <span>Desligamentos</span>
      </span>
    );
  };

  return (
    <div className="w-full max-w-[1700px] mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2.5 bg-blue-50 rounded-xl text-[#005487]">
              <FolderArchive className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight whitespace-nowrap">Fichas de desligamento</h1>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-50 text-[#005487] border border-blue-200 whitespace-nowrap">
              {metrics.total.toLocaleString("pt-BR")} arquivos
            </span>
          </div>
          <p className="text-slate-500 text-lg">
            Consulta, leitura por OCR, extração de CPF e download de termos de desligamento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Botão Split de Varredura Profunda */}
          <div className="relative inline-flex rounded-xl shadow-sm">
            <button
              onClick={() => handleStartScan(false)}
              disabled={startingScan || scanStatus?.isScanning}
              className="px-3.5 py-2.5 rounded-l-xl bg-[#005487] hover:bg-[#0c2856] disabled:opacity-50 text-white font-extrabold text-xs flex items-center space-x-2 transition-all"
              title="Lê somente os arquivos pendentes que ainda não têm CPF identificado"
            >
              {startingScan || scanStatus?.isScanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-amber-200" />
              )}
              <span>
                {scanStatus?.isScanning
                  ? "Varrendo PDFs..."
                  : metrics.semCpf > 0
                  ? `Varrer Pendentes (${metrics.semCpf.toLocaleString("pt-BR")})`
                  : "Varrer e Identificar"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowScanMenu((prev) => !prev)}
              disabled={startingScan || scanStatus?.isScanning}
              className="px-2 py-2.5 rounded-r-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white border-l border-rose-500 flex items-center justify-center transition-all"
              title="Opções de Varredura (Pendentes ou Todos)"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showScanMenu ? "rotate-180" : ""}`} />
            </button>

            {/* Menu Dropdown de Opções */}
            {showScanMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                onMouseLeave={() => setShowScanMenu(false)}
              >
                <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Modo de Varredura
                  </span>
                </div>

                {/* Opção 1: Somente Pendentes */}
                <button
                  type="button"
                  onClick={() => {
                    setShowScanMenu(false);
                    handleStartScan(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-rose-50/80 transition-colors flex items-start space-x-3 group"
                >
                  <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 mt-0.5 group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-black text-slate-900 group-hover:text-rose-700">
                        Varrer Somente Pendentes
                      </span>
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800">
                        Rápido
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      Processa apenas os <strong>{metrics.semCpf.toLocaleString("pt-BR")}</strong> arquivos que ainda não têm CPF ou falharam.
                    </p>
                  </div>
                </button>

                {/* Opção 2: Forçar Todos */}
                <button
                  type="button"
                  onClick={() => {
                    setShowScanMenu(false);
                    if (
                      window.confirm(
                        `Deseja forçar a re-leitura de TODOS os ${metrics.total.toLocaleString("pt-BR")} PDFs de desligamento do zero? Isso pode levar mais tempo.`
                      )
                    ) {
                      handleStartScan(true);
                    }
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-amber-50/80 transition-colors flex items-start space-x-3 group border-t border-slate-100 mt-1"
                >
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 mt-0.5 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                    <RotateCcw className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 group-hover:text-amber-800 block">
                      Forçar Re-leitura Total
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      Re-escaneia todos os <strong>{metrics.total.toLocaleString("pt-BR")}</strong> PDFs desde o início.
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Botão Atualizar Easy */}
          <button
            onClick={handleAtualizarEasy}
            disabled={isUpdatingEasy || scanStatus?.isScanning}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-xs flex items-center space-x-2 transition-all"
            title="Preenche Matrícula, Data de Nascimento e Contrato Principal cruzando com a base de cooperados do EasyCoop"
          >
            {isUpdatingEasy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 text-emerald-200" />
            )}
            <span>{isUpdatingEasy ? "Atualizando..." : "Atualizar Easy"}</span>
          </button>

          {/* Sincronizar Metadados */}
          <button
            onClick={handleSync}
            disabled={syncing || loading || scanStatus?.isScanning}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-xs flex items-center space-x-2 transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Sincronizando..." : "Sincronizar Catálogo"}</span>
          </button>

          {/* Link para o Google Drive */}
          <a
            href="https://drive.google.com/drive/folders/1Htt4v5GBm23RYuSaoJ6b6LqpobC1NMfb?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-xs flex items-center space-x-2 transition-all"
            title="Abrir pasta de Desligamentos diretamente no Google Drive"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Abrir no Drive</span>
          </a>
        </div>
      </div>

      {/* Banner de Varredura em Andamento */}
      {scanStatus && scanStatus.isScanning && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border border-rose-200 p-5 rounded-2xl shadow-sm space-y-3 animate-pulse">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-rose-600 text-white animate-spin">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider flex items-center space-x-2">
                  <span>Varredura Global no Servidor em Execução...</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black tracking-normal">
                    GRAVANDO NO BANCO CENTRAL
                  </span>
                </h4>
                <p className="text-[11px] text-rose-700 font-medium">
                  Extraindo CPF/dados e gravando no MySQL central para todos os usuários • Arquivo atual:{" "}
                  <span className="font-mono font-bold text-rose-900">
                    {scanStatus.currentFileName || "Processando..."}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs font-bold text-rose-900 shrink-0">
              <span className="px-3 py-1 bg-white/80 rounded-xl border border-rose-200">
                Processados: <strong>{scanStatus.processedFiles}</strong> / {scanStatus.totalFiles}
              </span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-300">
                Sucessos: <strong>{scanStatus.successCount}</strong>
              </span>
              <button
                onClick={handleStopScan}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold transition-all"
              >
                Interromper
              </button>
            </div>
          </div>

          <div className="w-full bg-rose-200/60 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-rose-500 to-amber-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${scanStatus.progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total de Termos</span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-black text-slate-800">
              {metrics.total.toLocaleString("pt-BR")}
            </span>
            <span className="text-xs font-medium text-slate-400">arquivos</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600">Com CPF</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-black text-emerald-700">
              {metrics.comCpf.toLocaleString("pt-BR")}
            </span>
            <span className="text-xs font-semibold text-emerald-600">
              {metrics.total > 0 ? Math.round((metrics.comCpf / metrics.total) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-600">Pendentes OCR</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-black text-amber-700">
              {metrics.semCpf.toLocaleString("pt-BR")}
            </span>
            <span className="text-xs font-semibold text-amber-600">
              {metrics.total > 0 ? Math.round((metrics.semCpf / metrics.total) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Desligamentos</span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-black text-slate-800">
              {metrics.desligamentos.toLocaleString("pt-BR")}
            </span>
            <span className="text-xs font-medium text-slate-400">pasta principal</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Desligamentos 2</span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-black text-slate-800">
              {metrics.desligamentos2.toLocaleString("pt-BR")}
            </span>
            <span className="text-xs font-medium text-slate-400">pasta secundária</span>
          </div>
        </div>
      </div>

      {/* Painel de Filtros e Busca */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Busca por Nome, CPF ou Arquivo */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por Nome do Cooperado, CPF ou Arquivo..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtros em Linha */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Filtro de Pasta / Tipo */}
            <select
              value={tipoFilter}
              onChange={(e) => {
                setTipoFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-500"
            >
              <option value="Todos">Todas as Pastas</option>
              <option value="Desligamentos">Desligamentos</option>
              <option value="Desligamentos 2">Desligamentos 2</option>
            </select>

            {/* Filtro de CPF */}
            <select
              value={cpfFilter}
              onChange={(e) => {
                setCpfFilter(e.target.value as any);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-500"
            >
              <option value="all">Status do CPF: Todos</option>
              <option value="with_cpf">Somente Com CPF Identificado</option>
              <option value="without_cpf">Pendentes de OCR / Sem CPF</option>
            </select>

            {/* Ordenação */}
            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split("_");
                setSortBy(sb as any);
                setSortOrder(so as any);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-500"
            >
              <option value="modifiedTime_desc">Mais Recentes Primeiro</option>
              <option value="modifiedTime_asc">Mais Antigos Primeiro</option>
              <option value="cooperadoName_asc">Nome do Cooperado (A-Z)</option>
              <option value="cooperadoName_desc">Nome do Cooperado (Z-A)</option>
              <option value="cpf_desc">CPF</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Arquivos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-6">Nome do Cooperado / Arquivo</th>
                <th className="py-3.5 px-4">CPF Identificado</th>
                <th className="py-3.5 px-4">Matrícula</th>
                <th className="py-3.5 px-4">Data Nasc.</th>
                <th className="py-3.5 px-4">Data Desligamento</th>
                <th className="py-3.5 px-4">Contrato Principal</th>
                <th className="py-3.5 px-4">Pasta / Tipo</th>
                <th className="py-3.5 px-4">Última Modificação</th>
                <th className="py-3.5 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-rose-600 mb-2" />
                    <span>Carregando termos de desligamento...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <AlertCircle className="h-6 w-6 mx-auto text-slate-300 mb-2" />
                    <span>Nenhum termo de desligamento encontrado com os filtros aplicados.</span>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="py-3.5 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 group-hover:bg-rose-100 transition-colors">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="max-w-md">
                          <span className="font-extrabold text-slate-900 block truncate">
                            {item.cooperadoName || item.name}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate block font-mono">
                            {item.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {item.cpf ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1.5 w-fit">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>{item.cpf}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1 w-fit">
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          <span>Pendente OCR</span>
                        </span>
                      )}
                    </td>

                    {/* Matrícula */}
                    <td className="py-3.5 px-4">
                      {item.matricula ? (
                        <span className="font-mono font-bold text-rose-900 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 inline-block whitespace-nowrap">
                          {item.matricula}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Data de Nascimento */}
                    <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                      {item.birthDate ? (
                        <span className="font-mono text-xs">
                          {formatBirthDate(item.birthDate)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Data de Desligamento */}
                    <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                      {item.terminationDate ? (
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100 font-semibold inline-block">
                          {formatBirthDate(item.terminationDate)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Contrato Principal */}
                    <td className="py-3.5 px-4">
                      {item.contractName ? (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-block max-w-[200px] truncate" title={item.contractName}>
                          {item.contractName}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {getTipoBadge(item.tipo || item.folderName)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {formatDate(item.modifiedTime)}
                    </td>

                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Editar Nome / CPF Manualmente */}
                        <button
                          onClick={() => setEditingItem(item)}
                          title="Editar Nome do Cooperado / CPF"
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-200"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {item.webViewLink && (
                          <a
                            href={item.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-200"
                            title="Visualizar no Google Drive"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}

                        <button
                          onClick={() => handleDownload(item.id, item.name)}
                          disabled={downloadingId === item.id}
                          className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-200 disabled:opacity-50"
                          title="Baixar Arquivo PDF"
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé de Paginação */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500">
          <div className="flex items-center space-x-2">
            <span>
              Exibindo{" "}
              <strong>{items.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> a{" "}
              <strong>{Math.min(page * pageSize, totalCount)}</strong> de{" "}
              <strong>{totalCount.toLocaleString("pt-BR")}</strong> termos
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-600 border border-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-extrabold">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-600 border border-slate-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Edição Manual de Cooperado / CPF */}
      {editingItem && (
        <EditFichaModal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          item={editingItem}
          endpointUrl={`/api/drive/desligamento/fichas/${editingItem.id}`}
          title="Editar Termo de Desligamento"
          onSuccess={(updated) => {
            setItems((prev) =>
              prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
            );
            fetchFichas();
          }}
        />
      )}
    </div>
  );
};
