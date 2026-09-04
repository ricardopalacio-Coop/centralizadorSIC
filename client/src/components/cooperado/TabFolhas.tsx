import React from "react";
import { Calendar, BarChart3, Eye, Download, CheckCircle2 } from "lucide-react";
import { PayrollItem } from "./types";

interface TabFolhasProps {
  cooperadoCpf: string;
  payrolls: PayrollItem[];
  filteredPayrolls: PayrollItem[];
  selectedCompetence: string;
  setSelectedCompetence: (comp: string) => void;
  competencesList: string[];
  setResumoPayrollId: (id: string | null) => void;
  onOpenPdf: (cpf: string, payrollId: string, competence: string, docType?: "demonstrativo" | "comprovante") => void;
}

export const TabFolhas: React.FC<TabFolhasProps> = ({
  cooperadoCpf,
  payrolls,
  filteredPayrolls,
  selectedCompetence,
  setSelectedCompetence,
  competencesList,
  setResumoPayrollId,
  onOpenPdf,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
        <div className="flex items-center space-x-2 text-xs text-slate-700 font-bold">
          <Calendar className="h-4 w-4 text-sky-600" />
          <span>Filtrar Competência:</span>
        </div>

        <select
          value={selectedCompetence}
          onChange={(e) => setSelectedCompetence(e.target.value)}
          className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-sky-500 shadow-sm"
        >
          <option value="TODAS">Todas as Competências ({payrolls.length})</option>
          {competencesList.map((comp) => (
            <option key={comp} value={comp}>
              Competência {comp}
            </option>
          ))}
        </select>
      </div>

      {filteredPayrolls.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm font-medium">
          Nenhuma folha de pagamento encontrada para esta competência.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPayrolls.map((payroll) => {
            const compLabel = payroll.competence || `${payroll.year}-${String(payroll.month).padStart(2, "0")}`;
            return (
              <div
                key={payroll.payrollId}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded bg-sky-50 text-sky-700 text-xs font-bold font-mono border border-sky-200">
                      {compLabel}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {payroll.contractDescription || payroll.clientName || "SEM NOME DE CONTRATO"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 font-medium">
                    Tipo: <strong className="text-slate-800">{payroll.payrollType}</strong> | Status:{" "}
                    <strong className="text-emerald-700 font-semibold">{payroll.payrollStatus}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
                  {/* Resumo Financeiro */}
                  <div className="flex items-center space-x-1 bg-violet-50/80 p-1.5 rounded-xl border border-violet-200">
                    <button
                      onClick={() => setResumoPayrollId(payroll.payrollId)}
                      title="Visualizar Resumo Financeiro em Tela"
                      className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-violet-600 text-white hover:bg-violet-700 flex items-center space-x-1.5 transition-all shadow-sm"
                    >
                      <BarChart3 className="h-3.5 w-3.5 text-violet-100" />
                      <span>Resumo Financeiro</span>
                    </button>
                  </div>

                  {/* Demonstrativo */}
                  <div className="flex items-center space-x-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <button
                      onClick={() => onOpenPdf(cooperadoCpf, payroll.payrollId, compLabel, "demonstrativo")}
                      title="Visualizar Demonstrativo de Pagamento"
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 flex items-center space-x-1 transition-all shadow-sm"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Demonstrativo</span>
                    </button>

                    <a
                      href={`/api/cooperados/${cooperadoCpf}/payrolls/${payroll.payrollId}/pdf?type=demonstrativo`}
                      target="_blank"
                      rel="noreferrer"
                      title="Baixar PDF do Demonstrativo"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {/* Comprovante */}
                  <div className="flex items-center space-x-1 bg-emerald-50/70 p-1.5 rounded-xl border border-emerald-200">
                    <button
                      onClick={() => onOpenPdf(cooperadoCpf, payroll.payrollId, compLabel, "comprovante")}
                      title="Visualizar Comprovante de Pagamento"
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center space-x-1 transition-all shadow-sm"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Comprovante</span>
                    </button>

                    <a
                      href={`/api/cooperados/${cooperadoCpf}/payrolls/${payroll.payrollId}/pdf?type=comprovante`}
                      target="_blank"
                      rel="noreferrer"
                      title="Baixar PDF do Comprovante de Pagamento"
                      className="p-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
