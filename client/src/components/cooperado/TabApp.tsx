import React from "react";
import {
  Smartphone,
  ShieldCheck,
  Navigation,
  Globe,
  Activity,
  Sparkles,
  Clock,
  Timer,
  History,
  CheckSquare,
} from "lucide-react";
import { AppData, ProductivityRecord, AuditLogItem } from "./types";

interface TabAppProps {
  appData?: AppData | null;
  formatDateTime: (dateStr?: string) => string;
  selectedProdDate: string;
  setSelectedProdDate: (d: string) => void;
  todayYmd: string;
  isTodaySelected: boolean;
  formattedSelectedDateDisplay: string;
  displayWorkedTime: string;
  recordsForSelectedDate: ProductivityRecord[];
}

export const TabApp: React.FC<TabAppProps> = ({
  appData,
  formatDateTime,
  selectedProdDate,
  setSelectedProdDate,
  todayYmd,
  isTodaySelected,
  formattedSelectedDateDisplay,
  displayWorkedTime,
  recordsForSelectedDate,
}) => {
  return (
    <div className="space-y-6">
      {/* 1. CARD DE ÚLTIMO ACESSO E ONDE FOI */}
      <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-sky-600/30 text-sky-300 border border-sky-500/30">
              <Smartphone className="h-7 w-7" />
            </div>
            <div>
              <span className="text-xs text-sky-300 font-bold uppercase tracking-wider block">
                Último Acesso no Aplicativo Mobile
              </span>
              <h3 className="text-xl font-extrabold text-white">
                {appData?.lastAccess?.date ? formatDateTime(appData.lastAccess.date) : "Sem registro de acesso"}
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Sincronizado com App Mobile</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
            <span className="text-xs text-sky-200 font-semibold block flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-sky-400" />
              Onde Foi (Módulo / Tela do App)
            </span>
            <p className="text-base font-bold text-white">
              {appData?.lastAccess?.page || "Módulo de Registro de Produtividade Mobile"}
            </p>
            <span className="text-[11px] text-sky-300 font-medium block">
              Ação: {appData?.lastAccess?.action || "Acesso de Frequência"}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
            <span className="text-xs text-sky-200 font-semibold block flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-emerald-400" />
              Dispositivo & Conexão (IP)
            </span>
            <p className="text-base font-bold text-white">
              {appData?.lastAccess?.deviceInfo || "Aplicativo Mobile Coopedu"}
            </p>
            <span className="text-[11px] text-slate-300 font-mono block">
              IP: {appData?.lastAccess?.ipAddress || "Conexão Segura"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. REGISTRO DE PRODUTIVIDADE POR PERÍODO */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Activity className="h-4 w-4 text-sky-600" />
          Registros de Produtividade no Mobile por Período
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white shadow-md relative overflow-hidden space-y-2 border border-amber-400/40">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white/20 text-white tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Hoje (Destaque Principal)
              </span>
              <Clock className="h-5 w-5 text-amber-200" />
            </div>
            <h4 className="text-3xl font-black">{appData?.periodProductivity?.today || 0}</h4>
            <p className="text-xs font-bold text-amber-100">Registros de Produtividade Hoje</p>
          </div>

          <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider block">
              Últimos 7 Dias
            </span>
            <h4 className="text-2xl font-extrabold text-slate-900">
              {appData?.periodProductivity?.last7Days || 0}
            </h4>
            <p className="text-xs text-slate-500 font-medium">Registros na Semana</p>
          </div>

          <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider block">
              Últimos 30 Dias
            </span>
            <h4 className="text-2xl font-extrabold text-slate-900">
              {appData?.periodProductivity?.last30Days || 0}
            </h4>
            <p className="text-xs text-slate-500 font-medium">Registros no Mês</p>
          </div>

          <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider block">
              Total Histórico
            </span>
            <h4 className="text-2xl font-extrabold text-sky-700">
              {appData?.periodProductivity?.totalHistory || 0}
            </h4>
            <p className="text-xs text-slate-500 font-medium">Total de Apontamentos</p>
          </div>
        </div>
      </div>

      {/* 3. BLOCO DE TEMPO TRABALHADO & CONSULTA DE PRODUTIVIDADE POR DATA */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200 gap-3">
          <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            <Timer className="h-4 w-4 text-emerald-600" />
            <span>Produtividade por Data Selecionada</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-semibold">Consultar Data:</span>
            <input
              type="date"
              value={selectedProdDate}
              onChange={(e) => setSelectedProdDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
            />
            {!isTodaySelected && (
              <button
                onClick={() => setSelectedProdDate(todayYmd)}
                className="px-2.5 py-1.5 rounded-xl bg-sky-600 text-white font-bold text-xs hover:bg-sky-700 transition-all shadow-sm"
              >
                Ver Hoje
              </button>
            )}
          </div>
        </div>

        {/* Card destacado de tempo trabalhado */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white/20 text-white tracking-wider flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {isTodaySelected ? "Total de Hoje" : `Data ${formattedSelectedDateDisplay}`}
              </span>
              <span className="text-xs font-bold text-emerald-400">Dados do Aplicativo</span>
            </div>
            <h3 className="text-3xl font-black text-white">
              Tempo Trabalhado: <span className="text-amber-400">{displayWorkedTime}</span>
            </h3>
            <p className="text-xs text-slate-300 font-medium">
              Apontamentos Registrados:{" "}
              <strong className="text-white font-bold">
                {recordsForSelectedDate.length} registro(s) nesta data
              </strong>
            </p>
          </div>

          <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-right">
            <span className="text-[11px] text-slate-300 font-bold block uppercase tracking-wider">Total Apontado</span>
            <span className="text-xl font-extrabold text-amber-400">{displayWorkedTime}</span>
          </div>
        </div>

        {recordsForSelectedDate.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-xs font-medium">
            Nenhum registro de produtividade encontrado para a data {formattedSelectedDateDisplay}.
          </div>
        ) : (
          <div className="space-y-3">
            {recordsForSelectedDate.map((prod: ProductivityRecord) => (
              <div
                key={prod.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded bg-sky-50 text-sky-700 font-extrabold text-[10px] border border-sky-200">
                      {prod.competence}
                    </span>
                    <strong className="text-slate-900 font-bold text-sm">{prod.description}</strong>
                  </div>
                  <span className="text-slate-600 block">
                    Data: <strong>{formattedSelectedDateDisplay}</strong>
                  </span>
                </div>

                <div className="text-right self-start sm:self-center">
                  <span className="text-base font-extrabold text-emerald-700 block">
                    {prod.workedTimeFormatted || prod.amountOrHours}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {prod.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. HISTÓRICO DE AUDITORIA E LOGS */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <History className="h-4 w-4 text-sky-600" />
            Histórico de Auditoria & Atividades do App Mobile ({appData?.auditLogs?.length || 0})
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            Dados de audit_logs
          </span>
        </div>

        {!appData?.auditLogs || appData.auditLogs.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-xs font-medium">
            Nenhum registro de log de auditoria encontrado para este cooperado.
          </div>
        ) : (
          <div className="space-y-3">
            {appData.auditLogs.map((log: AuditLogItem) => (
              <div
                key={log.id}
                className={`p-4 rounded-2xl border transition-all space-y-2 ${
                  log.isToday
                    ? "bg-sky-50/50 border-sky-200 shadow-sm"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        log.actionRaw === "FINALIZAR_PRODUTIVIDADE"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : log.actionRaw === "INICIAR_PRODUTIVIDADE"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : log.actionRaw === "LOCKSESSION"
                          ? "bg-sky-100 text-sky-800 border border-sky-300"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {log.actionTitle}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{log.moduleName}</span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs font-mono font-semibold text-slate-500">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {log.isToday ? `Hoje, ${log.timeStr}` : `${log.formattedDate} às ${log.timeStr}`}
                    </span>
                  </div>
                </div>

                {log.detailsSummary && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 flex items-center space-x-2">
                    <CheckSquare className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{log.detailsSummary}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                  <span>
                    Dispositivo: <strong className="text-slate-600 font-semibold">{log.deviceInfo}</strong>
                  </span>
                  {log.ipAddress && (
                    <span>
                      IP: <strong className="text-slate-600 font-semibold">{log.ipAddress}</strong>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
