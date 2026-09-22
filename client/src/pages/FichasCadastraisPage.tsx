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
  Pencil,
} from "lucide-react";
import { EditFichaModal } from "../components/EditFichaModal";

export type FichaTipo = "Ficha Manual" | "EasyCoop" | "Coopedu Interno" | "Outro";

export interface FichaItem {
  id: string;
  name: string;
  cooperadoName: string;
  cpf?: string | null;
  matricula?: string | null;
  birthDate?: string | null;
  contractName?: string | null;
  modifiedTime: string;
  createdTime?: string;
  size?: number;
  mimeType: string;
  tipo: FichaTipo;
  folderId: string;
  folderName: string;
  webViewLink?: string;
  webContentLink?: string;
  ocrStatus?: "PENDING" | "PROCESSING" | "SUCCESS" | "UNREADABLE" | "FAILED";
}

export interface FichasMetrics {
  total: number;
  fichaManual: number;
  easyCoop: number;
  coopeduInterno: number;
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
  foldersFound: { name: string; id: string; tipo: FichaTipo }[];
  totalCached: number;
  lastSync: string | null;
  isSyncing: boolean;
  error?: string;
}

export const FichasCadastraisPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("Todos");
  const [cpfFilter, setCpfFilter] = useState<"all" | "with_cpf" | "without_cpf">("all");
  const [sortBy, setSortBy] = useState<"cooperadoName" | "modifiedTime" | "tipo" | "cpf">("modifiedTime");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [items, setItems] = useState<FichaItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [metrics, setMetrics] = useState<FichasMetrics>({
    total: 0,
    fichaManual: 0,
    easyCoop: 0,
    coopeduInterno: 0,
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
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [showScanMenu, setShowScanMenu] = useState(false);
  const [editingItem, setEditingItem] = useState<FichaItem | null>(null);
  const [isUpdatingEasy, setIsUpdatingEasy] = useState(false);

  const handleAtualizarEasy = async () => {
    setIsUpdatingEasy(true);
    try {
      const res = await fetch("/api/drive/fichas/atualizar-easy", {
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
      const url = `/api/drive/fichas?search=${encodeURIComponent(
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
      console.error("Erro ao carregar fichas cadastrais:", err);
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
        const res = await fetch("/api/drive/fichas/scan-status", { credentials: "include" });
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
      const res = await fetch("/api/drive/fichas/scan", {
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/drive/sync", {
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
      console.error("Erro na sincronização do Google Drive:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectGoogle = async () => {
    setConnectingOAuth(true);
    try {
      const res = await fetch("/api/drive/auth/url");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        alert(data.error || "Não foi possível gerar a URL de autorização.");
      }
    } catch (err: any) {
      console.error("Erro ao iniciar login Google:", err);
      alert("Erro ao conectar com Google Drive: " + err.message);
    } finally {
      setConnectingOAuth(false);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    setDownloadingId(fileId);
    try {
      const response = await fetch(`/api/drive/download/${fileId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Falha ao baixar arquivo");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName || `ficha_${fileId}.pdf`;
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

  const getTipoBadge = (tipo: FichaTipo) => {
    switch (tipo) {
      case "Ficha Manual":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1.5 w-fit">
            <FileText className="h-3.5 w-3.5" />
            <span>Ficha Manual</span>
          </span>
        );
      case "EasyCoop":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1.5 w-fit">
            <FileCheck className="h-3.5 w-3.5" />
            <span>EasyCoop</span>
          </span>
        );
      case "Coopedu Interno":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1.5 w-fit">
            <Building2 className="h-3.5 w-3.5" />
            <span>Coopedu Interno</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <span>{tipo}</span>
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-[1700px] mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2.5 bg-blue-50 rounded-xl text-[#005487]">
              <FolderArchive className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight whitespace-nowrap">Fichas cadastrais</h1>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-50 text-[#005487] border border-blue-200 whitespace-nowrap">
              {metrics.total.toLocaleString("pt-BR")} arquivos
            </span>
          </div>
          <p className="text-slate-500 text-lg">
            Consulta, leitura por OCR e download de fichas do Google Drive (Arquivo, assinacoop e Gravatá).
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
                <Sparkles className="h-4 w-4 text-amber-300" />
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
              className="px-2 py-2.5 rounded-r-xl bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white border-l border-indigo-500 flex items-center justify-center transition-all"
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
                  className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-50/80 transition-colors flex items-start space-x-3 group"
                >
                  <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-black text-slate-900 group-hover:text-indigo-700">
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
                        `Deseja forçar a re-leitura de TODOS os ${metrics.total.toLocaleString("pt-BR")} PDFs do zero? Isso pode levar mais tempo.`
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

          {/* Conectar Drive */}
          <button
            onClick={handleConnectGoogle}
            disabled={connectingOAuth}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-xs flex items-center space-x-2 transition-all"
          >
            {connectingOAuth ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            <span>Conectar Google Drive</span>
          </button>

          <button
            onClick={() => setShowHelpModal(true)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-xs flex items-center space-x-2 transition-all"
          >
            <KeyRound className="h-4 w-4 text-slate-500" />
            <span>Credenciais</span>
          </button>
        </div>
      </div>

      {/* Banner de Varredura em Andamento */}
      {scanStatus && scanStatus.isScanning && (
        <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-blue-50 border border-indigo-200 p-5 rounded-2xl shadow-sm space-y-3 animate-pulse">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white animate-spin">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center space-x-2">
                  <span>Varredura Global no Servidor em Execução...</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-black tracking-normal">
                    GRAVANDO NO BANCO CENTRAL
                  </span>
                </h4>
                <p className="text-[11px] text-indigo-700 font-medium">
                  Extraindo CPF/dados e gravando no MySQL central para todos os usuários • Arquivo atual:{" "}
                  <span className="font-mono font-bold text-indigo-900">
                    {scanStatus.currentFileName || "Processando..."}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs font-bold text-indigo-900 shrink-0">
              <span className="px-3 py-1 bg-white/80 rounded-xl border border-indigo-200">
                Processados: <strong>{scanStatus.processedFiles}</strong> / {scanStatus.totalFiles}
              </span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-300">
                Sucessos: <strong>{scanStatus.successCount}</strong>
              </span>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="w-full bg-white rounded-full h-3 overflow-hidden border border-indigo-200">
            <div
              className="bg-gradient-to-r from-indigo-600 to-sky-500 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${scanStatus.progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200">
            <FolderArchive className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
              Total de Fichas
            </span>
            <span className="text-2xl font-black text-slate-900">
              {metrics.total.toLocaleString("pt-BR")}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 block">
              Com CPF Identificado
            </span>
            <span className="text-2xl font-black text-emerald-900">
              {metrics.comCpf.toLocaleString("pt-BR")}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 block">
              Pendentes / Sem CPF
            </span>
            <span className="text-2xl font-black text-amber-900">
              {metrics.semCpf.toLocaleString("pt-BR")}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200">
            <Fingerprint className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 block">
              Distribuição por Pasta
            </span>
            <div className="text-xs font-bold text-slate-700 mt-1 flex items-center space-x-2">
              <span title="Arquivo">Man: {metrics.fichaManual}</span>
              <span>•</span>
              <span title="EasyCoop">Assina: {metrics.easyCoop}</span>
              <span>•</span>
              <span title="Gravatá">Int: {metrics.coopeduInterno}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta se credenciais não estiverem configuradas */}
      {driveStatus && !driveStatus.configured && (
        <div className="p-5 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-bold">Atenção: Google Drive aguardando conexão</p>
              <p className="mt-0.5 text-amber-800">
                {driveStatus.error || "Clique em Conectar Google Drive para autorizar o acesso à pasta FICHAS."}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleConnectGoogle}
              disabled={connectingOAuth}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center space-x-1.5 shadow-sm"
            >
              <LogIn className="h-4 w-4" />
              <span>Conectar com 1 Clique</span>
            </button>
            <button
              onClick={() => setShowHelpModal(true)}
              className="px-3 py-2 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold text-xs"
            >
              Ver Guia
            </button>
          </div>
        </div>
      )}

      {/* Barra de Filtros, Pesquisa e Controles */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Busca por Nome ou CPF */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Pesquisar por Nome Completo ou CPF..."
            className="w-full pl-11 pr-10 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 font-medium"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-3.5 top-3.5 p-0.5 rounded-full hover:bg-slate-200 text-slate-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Filtro por Status do CPF */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600">CPF:</span>
            <select
              value={cpfFilter}
              onChange={(e) => {
                setCpfFilter(e.target.value as any);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 shadow-sm"
            >
              <option value="all">Todos os Status</option>
              <option value="with_cpf">Com CPF Identificado</option>
              <option value="without_cpf">Sem CPF / Pendente</option>
            </select>
          </div>

          {/* Filtro por Tipo */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600">Tipo:</span>
            <select
              value={tipoFilter}
              onChange={(e) => {
                setTipoFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 shadow-sm"
            >
              <option value="Todos">Todas as Pastas</option>
              <option value="Ficha Manual">Ficha Manual (Arquivo)</option>
              <option value="EasyCoop">EasyCoop (assinacoop)</option>
              <option value="Coopedu Interno">Coopedu Interno (Gravatá)</option>
            </select>
          </div>

          {/* Ordenação */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600">Ordem:</span>
            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [selSort, dir] = e.target.value.split("_");
                setSortBy(selSort as any);
                setSortOrder(dir as any);
              }}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 shadow-sm"
            >
              <option value="modifiedTime_desc">Mais Recentes</option>
              <option value="modifiedTime_asc">Mais Antigas</option>
              <option value="cooperadoName_asc">Nome (A - Z)</option>
              <option value="cooperadoName_desc">Nome (Z - A)</option>
              <option value="cpf_asc">CPF (Crescente)</option>
            </select>
          </div>

          {/* Itens por Página */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600">Exibir:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 shadow-sm"
            >
              <option value={30}>30 por página</option>
              <option value={100}>100 por página</option>
              <option value={300}>300 por página</option>
              <option value={500}>500 por página</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Fichas Cadastrais */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 text-center flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 text-sky-600 animate-spin" />
            <p className="text-xs font-medium text-slate-600">Consultando fichas e dados cadastrais...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileText className="h-12 w-12 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">
              Nenhuma ficha cadastral encontrada com os critérios informados.
            </p>
            <p className="text-[11px] text-slate-400">
              Clique em <strong>Varrer e Identificar PDFs</strong> para ler e extrair nomes e CPFs das fichas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-4">Nome Completo</th>
                  <th className="p-4">CPF</th>
                  <th className="p-4">Matrícula</th>
                  <th className="p-4">Data Nasc.</th>
                  <th className="p-4">Contrato Principal</th>
                  <th className="p-4">Data da Modificação</th>
                  <th className="p-4">Tipo / Pasta</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-sky-50/50 transition-colors group"
                  >
                    {/* Nome Completo */}
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-9.5 w-9.5 rounded-2xl bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center font-extrabold text-sm shrink-0">
                          {item.cooperadoName.charAt(0) || "F"}
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-900 group-hover:text-sky-700 transition-colors block">
                            {item.cooperadoName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 line-clamp-1" title={item.name}>
                            Arquivo: {item.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* CPF */}
                    <td className="p-4">
                      {item.cpf ? (
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 whitespace-nowrap">
                            {item.cpf}
                          </span>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" title="CPF Identificado com Sucesso" />
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center space-x-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          <span>Pendente / Não localizado</span>
                        </span>
                      )}
                    </td>

                    {/* Matrícula */}
                    <td className="p-4">
                      {item.matricula ? (
                        <span className="font-mono font-bold text-[#0c2856] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-block whitespace-nowrap">
                          {item.matricula}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Data de Nascimento */}
                    <td className="p-4 text-slate-700 font-medium whitespace-nowrap">
                      {item.birthDate ? (
                        <span className="font-mono text-xs">
                          {formatBirthDate(item.birthDate)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Contrato Principal */}
                    <td className="p-4">
                      {item.contractName ? (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block max-w-[200px] truncate" title={item.contractName}>
                          {item.contractName}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Data Modificação */}
                    <td className="p-4 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium">{formatDate(item.modifiedTime)}</span>
                      </div>
                    </td>

                    {/* Tipo / Pasta */}
                    <td className="p-4">{getTipoBadge(item.tipo)}</td>

                    {/* Ações */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Editar Nome / CPF Manualmente */}
                        <button
                          onClick={() => setEditingItem(item)}
                          title="Editar Nome do Cooperado / CPF"
                          className="p-2 rounded-xl bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-600 border border-slate-200 hover:border-sky-200 transition-all"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        {/* Download Direto */}
                        <button
                          onClick={() => handleDownload(item.id, item.name)}
                          disabled={downloadingId === item.id}
                          title="Baixar Ficha"
                          className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white border border-sky-200 hover:border-transparent font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          <span>Download</span>
                        </button>

                        {/* Abrir no Google Drive */}
                        {item.webViewLink && (
                          <a
                            href={item.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Visualizar no Google Drive"
                            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-all"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé de Paginação */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-medium">
          <div>
            Página <strong className="text-slate-900">{page}</strong> de <strong className="text-slate-900">{totalPages}</strong> ({totalCount} fichas encontradas)
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1 || loading}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="px-3 py-1 font-bold text-slate-800">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page >= totalPages || loading}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-sm"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Instruções de Credenciais */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 p-6 relative space-y-5">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute right-5 top-5 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200">
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Configuração do Google Drive</h3>
                <p className="text-xs text-slate-500">Conexão via OAuth 2.0 Web ou Desktop</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-700 font-medium">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                <p className="font-bold text-emerald-900">Opção Web (1 Clique)</p>
                <p className="text-emerald-800">
                  Cadastre no Google Cloud Console em <strong>URIs de redirecionamento autorizados</strong>:
                </p>
                <code className="block p-2 bg-white rounded-xl border border-emerald-300 font-mono text-[11px] text-emerald-900 break-all select-all">
                  http://localhost:3005/api/drive/auth/callback
                </code>
                <button
                  onClick={handleConnectGoogle}
                  className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center space-x-1.5 shadow-sm"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Conectar Agora</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição Manual de Cooperado / CPF */}
      {editingItem && (
        <EditFichaModal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          item={editingItem}
          endpointUrl={`/api/drive/fichas/${editingItem.id}`}
          title="Editar Ficha Cadastral"
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

export default FichasCadastraisPage;
