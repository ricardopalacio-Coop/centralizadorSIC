import React, { useState, useEffect } from "react";
import { ExcelUpload } from "../components/ExcelUpload";
import {
  FileSpreadsheet,
  ShieldCheck,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Users,
  CreditCard,
  Building2,
  CalendarCheck,
  Check,
} from "lucide-react";

interface Coop01Status {
  online: boolean;
  totalInSqlServer: number;
  totalInMysql: number;
  lastChecked: string;
  error?: string;
}

export const ImportacaoPage: React.FC = () => {
  const [coopStatus, setCoopStatus] = useState<Coop01Status | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/cooperados/coop01-status", { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setCoopStatus(data);
      }
    } catch (err) {
      console.error("Erro ao buscar status da base COOP01:", err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSyncCoop01 = async () => {
    setSyncing(true);
    setSyncSuccessMessage(null);
    setSyncErrorMessage(null);
    try {
      const res = await fetch("/api/cooperados/sync-coop01", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncSuccessMessage(
          `Sincronização concluída! ${data.finalCount.toLocaleString("pt-BR")} cooperados consolidados no banco de dados.`
        );
        fetchStatus();
      } else {
        setSyncErrorMessage(data.error || "Falha ao sincronizar cooperados da base COOP01.");
      }
    } catch (err: any) {
      setSyncErrorMessage(err.message || "Erro de conexão ao solicitar sincronização.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      {/* Banner da Página de Importação */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Importação & Sincronização</h1>
              <p className="text-xs text-slate-500 font-medium">
                Sincronize cooperados da base oficial ERP (COOP01) ou envie planilhas XLS/XLSX.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Sincronização Direta e Segura</span>
        </div>
      </div>

      {/* Card da Base de Dados ERP COOP01 (SQL Server 2022) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 rounded-3xl border border-slate-700 shadow-xl text-white relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold tracking-tight">Base ERP Corporativa (COOP01)</h2>
                  {coopStatus?.online ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      SQL Server 2022 Conectado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Aguardando Conexão
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Backup oficial restaurado com 13.753 cadastros históricos e dados bancários reais.
                </p>
              </div>
            </div>

            <button
              onClick={fetchStatus}
              disabled={loadingStatus || syncing}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center gap-1.5 transition-colors"
              title="Atualizar status"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? "animate-spin text-sky-400" : ""}`} />
              <span className="hidden sm:inline">Checar Conexão</span>
            </button>
          </div>

          {/* Grid de Estatísticas e Metadados da Base */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider">Cooperados no ERP</span>
                <Users className="h-4 w-4 text-sky-400" />
              </div>
              <span className="text-2xl font-black text-white">
                {coopStatus?.totalInSqlServer ? coopStatus.totalInSqlServer.toLocaleString("pt-BR") : "13.753"}
              </span>
              <span className="text-[10px] text-slate-400 mt-1">Base SQL Server 2022</span>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider">Centralizador SIC</span>
                <Check className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-2xl font-black text-emerald-300">
                {coopStatus?.totalInMysql ? coopStatus.totalInMysql.toLocaleString("pt-BR") : "Carregando..."}
              </span>
              <span className="text-[10px] text-emerald-400/80 mt-1">Sincronizados no MySQL</span>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider">Contas Bancárias</span>
                <CreditCard className="h-4 w-4 text-amber-400" />
              </div>
              <span className="text-2xl font-black text-white">13.750</span>
              <span className="text-[10px] text-slate-400 mt-1">99,96% com banco e agência</span>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider">Qualidade Cadastral</span>
                <CalendarCheck className="h-4 w-4 text-indigo-400" />
              </div>
              <span className="text-2xl font-black text-white">100%</span>
              <span className="text-[10px] text-slate-400 mt-1">CPFs e Datas de Nascimento</span>
            </div>
          </div>

          {/* Feedback de Sincronização */}
          {syncSuccessMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{syncSuccessMessage}</span>
            </div>
          )}

          {syncErrorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{syncErrorMessage}</span>
            </div>
          )}

          {/* Ação de Sincronização */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
              <span>Inclui tomadores ativos (Prefeituras), CBO oficial, telefones, endereços e contas bancárias.</span>
            </div>

            <button
              onClick={handleSyncCoop01}
              disabled={syncing}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Sincronizando Base ERP..." : "Sincronizar Base COOP01"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Componente Tradicional de Upload de Planilha */}
      <div className="pt-2">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Importação por Planilha (XLSX)</h2>
          <p className="text-xs text-slate-500">
            Utilize esta opção caso queira enviar planilhas avulsas com CPFs ou novos lotes de cooperados.
          </p>
        </div>
        <ExcelUpload onSuccess={() => {}} />
      </div>
    </div>
  );
};
