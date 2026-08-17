import React, { useState } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, Sparkles } from "lucide-react";

interface UploadStats {
  filename: string;
  totalRows: number;
  validCpfsCount: number;
  foundSic: number;
  createdOrUpdated: number;
  errorsCount: number;
}

interface ExcelUploadProps {
  onSuccess: () => void;
}

export const ExcelUpload: React.FC<ExcelUploadProps> = ({ onSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<UploadStats | null>(null);

  const handleFileChange = async (file: File) => {
    if (!file.name.match(/\.(xls|xlsx)$/i)) {
      setError("Por favor, selecione um arquivo válido no formato Excel (.xls ou .xlsx).");
      return;
    }

    setLoading(true);
    setError("");
    setStats(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/cooperados/upload-xls", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao processar planilha");
      }

      setStats(data.stats);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm mb-8">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            Importação de Cooperados via Excel (XLS / XLSX)
            <Sparkles className="h-4 w-4 text-amber-500" />
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Envie uma planilha com a coluna de CPFs para consultar a API do SIC e alimentar o sistema
          </p>
        </div>
      </div>

      {/* Zona de Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-sky-500 bg-sky-50"
            : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
        }`}
      >
        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={loading}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          {loading ? (
            <div className="flex flex-col items-center space-y-2 py-2">
              <Loader2 className="h-10 w-10 text-sky-600 animate-spin" />
              <p className="text-sm font-semibold text-sky-800">
                Processando planilha e consultando API do SIC...
              </p>
              <p className="text-xs text-slate-500">Isso pode levar alguns segundos dependendo da quantidade de CPFs</p>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-2xl bg-sky-100 text-sky-700 border border-sky-200">
                <UploadCloud className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  <span className="text-sky-700 font-bold">Clique para escolher</span> ou arraste o arquivo aqui
                </p>
                <p className="text-xs text-slate-500 mt-1 font-medium">Formato suportado: Microsoft Excel (.xls, .xlsx)</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mensagem de Erro */}
      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center space-x-2.5 font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Relatório de Sucesso */}
      {stats && (
        <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 animate-in fade-in duration-300">
          <div className="flex items-center space-x-2 text-emerald-700 font-bold text-sm mb-3">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span>Processamento de "{stats.filename}" Concluído!</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="block text-xs text-slate-500 font-medium">Total de Linhas</span>
              <span className="text-base font-bold text-slate-800">{stats.totalRows}</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="block text-xs text-slate-500 font-medium">CPFs Válidos</span>
              <span className="text-base font-bold text-sky-700">{stats.validCpfsCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="block text-xs text-slate-500 font-medium">Encontrados no SIC</span>
              <span className="text-base font-bold text-emerald-700">{stats.foundSic}</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="block text-xs text-slate-500 font-medium">Erros / Ausentes</span>
              <span className="text-base font-bold text-rose-600">{stats.errorsCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
