import React from "react";
import { X, Smartphone } from "lucide-react";
import { AppData } from "./types";

interface CooperadoHeaderProps {
  name: string;
  status?: string;
  cpf: string;
  matricula: string;
  variant?: "inline" | "modal";
  onClose?: () => void;
  appData?: AppData | null;
  formatDateTime: (dateStr?: string) => string;
}

export const CooperadoHeader: React.FC<CooperadoHeaderProps> = ({
  name,
  status = "Ativo",
  cpf,
  matricula,
  variant = "inline",
  onClose,
  appData,
  formatDateTime,
}) => {
  if (variant === "modal") {
    return (
      <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center space-x-4">
          <div className="h-14 w-14 rounded-2xl bg-sky-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-md shadow-sky-600/20 shrink-0">
            {name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              {name}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                {status}
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5 font-medium">
              CPF: <strong className="text-sky-700">{cpf}</strong> | Matrícula:{" "}
              <strong className="text-slate-800">{matricula}</strong>
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all"
          >
            <X className="h-6 w-6" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center space-x-4">
        <div className="h-16 w-16 rounded-2xl bg-sky-600 flex items-center justify-center text-white font-extrabold text-3xl shadow-md shadow-sky-600/20 shrink-0">
          {name.charAt(0)}
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            {name}
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
              {status}
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-1 font-medium">
            CPF: <strong className="text-sky-700 text-sm">{cpf}</strong> | Matrícula:{" "}
            <strong className="text-slate-800 text-sm">{matricula}</strong>
          </p>
        </div>
      </div>

      {appData && (
        <div className="flex flex-col items-end space-y-1">
          <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-800 font-bold">
            <Smartphone className="h-4 w-4 text-sky-600" />
            <span>
              Último Acesso Mobile:{" "}
              <strong>
                {appData.lastAccess?.date ? formatDateTime(appData.lastAccess.date) : "Sem registro"}
              </strong>
            </span>
          </div>
          {appData.lastAccess?.page && (
            <span className="text-[11px] text-slate-500 font-medium">
              Onde foi: <strong className="text-slate-700 font-semibold">{appData.lastAccess.page}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
