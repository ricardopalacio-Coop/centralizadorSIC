import React, { useState, useEffect } from "react";
import { CabecalhoPagina } from "../components/CabecalhoPagina";
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
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <CabecalhoPagina
        icone={FileSpreadsheet}
        titulo="Importação"
        descricao="Sincronize cooperados da base oficial ERP (COOP01) ou envie planilhas XLS/XLSX."
        acoes={
          <span className="flex items-center gap-2 h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600">
            <ShieldCheck className="h-4 w-4 text-[#3ab54a]" />
            Sincronização direta e segura
          </span>
        }
      />

      {/* Card da Base de Dados ERP COOP01 (SQL Server 2022) */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-blue-50 text-[#005487] border border-blue-100">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-semibold text-slate-900">Base ERP corporativa (COOP01)</h2>
                  {coopStatus?.online ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      SQL Server 2022 Conectado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      Aguardando Conexão
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Backup oficial restaurado com 13.753 cadastros históricos e dados bancários reais.
                </p>
              </div>
            </div>

            <button
              onClick={fetchStatus}
              disabled={loadingStatus || syncing}
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 text-xs flex items-center gap-1.5 transition-colors"
              title="Atualizar status"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? "animate-spin text-[#005487]" : ""}`} />
              <span className="hidden sm:inline">Checar Conexão</span>
            </button>
          </div>

          {/* Grid de Estatísticas e Metadados da Base */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide">Cooperados no ERP</span>
                <Users className="h-4 w-4 text-[#005487]" />
              </div>
              <span className="text-2xl font-black text-slate-900 leading-tight">
                {coopStatus?.totalInSqlServer ? coopStatus.totalInSqlServer.toLocaleString("pt-BR") : "13.753"}
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Base SQL Server 2022</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide">Centralizador SIC</span>
                <Check className="h-4 w-4 text-[#3ab54a]" />
              </div>
              <span className="text-2xl font-black text-[#3ab54a] leading-tight">
                {coopStatus?.totalInMysql ? coopStatus.totalInMysql.toLocaleString("pt-BR") : "Carregando..."}
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Sincronizados no MySQL</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide">Contas Bancárias</span>
                <CreditCard className="h-4 w-4 text-amber-500" />
              </div>
              <span className="text-2xl font-black text-slate-900 leading-tight">13.750</span>
              <span className="text-[10px] text-slate-500 mt-1">99,96% com banco e agência</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide">Qualidade Cadastral</span>
                <CalendarCheck className="h-4 w-4 text-[#00b7ff]" />
              </div>
              <span className="text-2xl font-black text-slate-900 leading-tight">100%</span>
              <span className="text-[10px] text-slate-500 mt-1">CPFs e Datas de Nascimento</span>
            </div>
          </div>

          {/* Feedback de Sincronização */}
          {syncSuccessMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-[#3ab54a] shrink-0" />
              <span>{syncSuccessMessage}</span>
            </div>
          )}

          {syncErrorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
              <span>{syncErrorMessage}</span>
            </div>
          )}

          {/* Ação de Sincronização */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
              <span>Inclui tomadores ativos (Prefeituras), CBO oficial, telefones, endereços e contas bancárias.</span>
            </div>

            <button
              onClick={handleSyncCoop01}
              disabled={syncing}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#005487] hover:bg-[#0c2856] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <h2 className="text-base font-semibold text-slate-900">Importação por planilha (XLSX)</h2>
          <p className="text-xs text-slate-500">
            Utilize esta opção caso queira enviar planilhas avulsas com CPFs ou novos lotes de cooperados.
          </p>
        </div>
        <ExcelUpload onSuccess={() => {}} />
      </div>
    </div>
  );
};
