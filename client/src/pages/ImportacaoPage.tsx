import React from "react";
import { ExcelUpload } from "../components/ExcelUpload";
import { UploadCloud, FileSpreadsheet, ShieldCheck } from "lucide-react";

export const ImportacaoPage: React.FC = () => {
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
              <h1 className="text-2xl font-extrabold text-slate-900">Importação de Cooperados</h1>
              <p className="text-xs text-slate-500 font-medium">
                Envie planilhas XLS / XLSX para buscar e sincronizar cadastros em massa no SIC.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Sincronização Segura via API M2M</span>
        </div>
      </div>

      {/* Componente de Upload de Planilha */}
      <ExcelUpload onSuccess={() => {}} />
    </div>
  );
};
