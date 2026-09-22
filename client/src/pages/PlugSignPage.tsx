import React, { useState, useRef } from "react";
import {
  FileCheck2,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  StopCircle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Zap,
  Search,
} from "lucide-react";

interface RowResult {
  rowNumber: number;
  name: string;
  cpf: string;
  contract: string;
  regional: string;
  contact: string;
  phoneStatus: string;
  url: string;
  isSigned: boolean;
  statusText: "Assinado" | "Não Assinado";
  details?: string;
  checkedAt: string;
}

export const PlugSignPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Métricas em tempo real
  const [totalRows, setTotalRows] = useState<number>(0);
  const [processedRows, setProcessedRows] = useState<number>(0);
  const [signedCount, setSignedCount] = useState<number>(0);
  const [unsignedCount, setUnsignedCount] = useState<number>(0);
  const [percent, setPercent] = useState<number>(0);
  const [results, setResults] = useState<RowResult[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        setErrorMessage("Por favor, selecione um arquivo válido do Excel (.xlsx ou .xls).");
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
      setIsCompleted(false);
      setJobId(null);
      setResults([]);
      setTotalRows(0);
      setProcessedRows(0);
      setSignedCount(0);
      setUnsignedCount(0);
      setPercent(0);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        setErrorMessage("Por favor, arraste um arquivo válido do Excel (.xlsx ou .xls).");
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
      setIsCompleted(false);
      setJobId(null);
      setResults([]);
      setTotalRows(0);
      setProcessedRows(0);
      setSignedCount(0);
      setUnsignedCount(0);
      setPercent(0);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setIsCompleted(false);
    setResults([]);
    setProcessedRows(0);
    setSignedCount(0);
    setUnsignedCount(0);
    setPercent(0);

    const formData = new FormData();
    formData.append("file", selectedFile);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/plugsign/analyze-stream", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${response.status}: Falha ao iniciar análise.`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Não foi possível estabelecer stream de eventos com o servidor.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            try {
              const eventData = JSON.parse(trimmed.replace(/^data:\s*/, ""));

              if (eventData.error) {
                setErrorMessage(eventData.error);
              }

              if (eventData.jobId && eventData.jobId !== "error") {
                setJobId(eventData.jobId);
              }

              if (eventData.totalRows !== undefined) setTotalRows(eventData.totalRows);
              if (eventData.processedRows !== undefined) setProcessedRows(eventData.processedRows);
              if (eventData.signedCount !== undefined) setSignedCount(eventData.signedCount);
              if (eventData.unsignedCount !== undefined) setUnsignedCount(eventData.unsignedCount);
              if (eventData.percent !== undefined) setPercent(eventData.percent);

              if (eventData.currentRow) {
                setResults((prev) => [eventData.currentRow, ...prev]);
              }

              if (eventData.isCompleted) {
                setIsCompleted(true);
              }
            } catch (parseErr) {
              console.error("Erro ao fazer parse do evento SSE:", parseErr);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setErrorMessage("Análise interrompida pelo usuário.");
      } else {
        setErrorMessage(err.message || "Erro desconhecido durante o processamento.");
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (jobId) {
      try {
        await fetch(`/api/plugsign/cancel/${jobId}`, { method: "POST" });
      } catch (e) {}
    }
    setIsProcessing(false);
  };

  const handleDownload = () => {
    if (!jobId) return;
    window.open(`/api/plugsign/download/${jobId}`, "_blank");
  };

  const handleReset = () => {
    setSelectedFile(null);
    setIsProcessing(false);
    setIsCompleted(false);
    setJobId(null);
    setErrorMessage(null);
    setResults([]);
    setTotalRows(0);
    setProcessedRows(0);
    setSignedCount(0);
    setUnsignedCount(0);
    setPercent(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full max-w-[1700px] mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2.5 bg-blue-50 rounded-xl text-[#005487]">
              <FileCheck2 className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">PlugSign</h1>
            {totalRows > 0 && (
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-50 text-[#005487] border border-blue-200 whitespace-nowrap">
                {processedRows.toLocaleString("pt-BR")} de {totalRows.toLocaleString("pt-BR")} linhas
              </span>
            )}
          </div>
          <p className="text-slate-500 text-lg">
            Inspeção automática dos links da coluna I e preenchimento da coluna J, com destaque para os assinados.
          </p>
        </div>

        <div className="flex items-center gap-2 h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 shrink-0">
          <ShieldCheck className="h-4 w-4 text-[#3ab54a]" />
          <span>Fechamento imediato de abas</span>
        </div>
      </div>

      {/* Regras Operacionais em Destaque */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 mt-0.5 shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div className="text-xs">
            <h3 className="font-bold text-slate-800">1. Leitura da Coluna I</h3>
            <p className="text-slate-500 mt-1">
              O robô lê todas as URLs do PlugSign presentes na coluna <strong>I</strong> da primeira aba da planilha.
            </p>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 mt-0.5 shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-xs">
            <h3 className="font-bold text-slate-800">2. Critério de Assinatura</h3>
            <p className="text-slate-500 mt-1">
              Página com botão superior direito <strong>"Opções"</strong> = <strong className="text-emerald-700">Assinado</strong>. Demais casos = <strong className="text-rose-600">Não Assinado</strong>.
            </p>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 mt-0.5 shrink-0">
            <Download className="h-5 w-5" />
          </div>
          <div className="text-xs">
            <h3 className="font-bold text-slate-800">3. Coluna J + Marcador Amarelo</h3>
            <p className="text-slate-500 mt-1">
              Preenche a coluna <strong>J</strong> e pinta com marcador de texto amarelo brilhante as linhas assinadas.
            </p>
          </div>
        </div>
      </div>

      {/* Seção de Upload & Controle */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-sky-600" />
          Upload da Planilha Excel
        </h2>

        {!selectedFile ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-50/30 transition-all rounded-2xl p-8 sm:p-12 text-center cursor-pointer flex flex-col items-center justify-center space-y-3 group"
          >
            <div className="p-4 rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform duration-200 border border-amber-100">
              <UploadCloud className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">
                Clique para selecionar ou arraste o arquivo do Excel aqui
              </p>
              <p className="text-xs text-slate-500">
                Formatos aceitos: <strong>.xlsx</strong> e <strong>.xls</strong>
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB • Pronto para análise
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              {!isProcessing && !isCompleted && (
                <button
                  onClick={handleStartAnalysis}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all"
                >
                  <Zap className="h-4 w-4" />
                  <span>Iniciar Análise PlugSign</span>
                </button>
              )}

              {isProcessing && (
                <button
                  onClick={handleCancel}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-all"
                >
                  <StopCircle className="h-4 w-4" />
                  <span>Interromper</span>
                </button>
              )}

              {!isProcessing && (
                <button
                  onClick={handleReset}
                  className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-all"
                  title="Trocar arquivo"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mensagem de Erro se houver */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-xs">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="font-bold">Atenção</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Painel de Progresso & Métricas */}
      {(isProcessing || isCompleted || results.length > 0) && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
                    Processando Links do PlugSign em Tempo Real...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Análise Concluída
                  </>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Progresso: {processedRows} de {totalRows} linhas verificadas ({percent}%)
              </p>
            </div>

            {/* Botão de Download em Destaque */}
            {jobId && (
              <button
                onClick={handleDownload}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg hover:shadow-xl transition-all"
              >
                <Download className="h-4.5 w-4.5" />
                <span>Baixar Planilha com Marcador Amarelo (.xlsx)</span>
              </button>
            )}
          </div>

          {/* Barra de Progresso Animada */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200">
              <div
                className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-500 shadow-xs"
                style={{ width: `${Math.max(percent, 2)}%` }}
              />
            </div>
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total de Links</span>
              <p className="text-2xl font-black text-slate-800 mt-1">{totalRows}</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Processados</span>
              <p className="text-2xl font-black text-slate-800 mt-1">{processedRows}</p>
            </div>

            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Assinados (Amarelo)</span>
              <p className="text-2xl font-black text-amber-600 mt-1">{signedCount}</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Não Assinados</span>
              <p className="text-2xl font-black text-slate-700 mt-1">{unsignedCount}</p>
            </div>
          </div>

          {/* Tabela de Resultados ao Vivo */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Feed de Verificação em Tempo Real ({results.length} itens)
              </h3>

              {results.length > 0 && (
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar por Nome, CPF, Contrato..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-amber-400 focus:outline-none transition-all"
                  />
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-x-auto overflow-y-auto max-h-[36rem] shadow-xs">
              <table className="w-full text-left text-xs text-slate-700 min-w-[1250px]">
                <thead className="bg-slate-100/90 sticky top-0 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200 z-10 backdrop-blur-xs">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-4 min-w-[180px]">Nome do Cooperado</th>
                    <th className="py-3 px-3 w-32">CPF</th>
                    <th className="py-3 px-4 min-w-[200px]">Contrato</th>
                    <th className="py-3 px-3 min-w-[140px]">Núcleo Regional</th>
                    <th className="py-3 px-3 w-36">Contato</th>
                    <th className="py-3 px-3 w-28 text-center">Status Telefone</th>
                    <th className="py-3 px-4 min-w-[200px]">Link PlugSign (Col. I)</th>
                    <th className="py-3 px-3 w-32 text-center">Status (Col. J)</th>
                    <th className="py-3 px-3 w-20 text-right">Horário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        Aguardando início do processamento...
                      </td>
                    </tr>
                  ) : (
                    results
                      .filter((res) => {
                        if (!searchTerm) return true;
                        const term = searchTerm.toLowerCase();
                        return (
                          (res.name && res.name.toLowerCase().includes(term)) ||
                          (res.cpf && res.cpf.toLowerCase().includes(term)) ||
                          (res.contract && res.contract.toLowerCase().includes(term)) ||
                          (res.regional && res.regional.toLowerCase().includes(term)) ||
                          (res.contact && res.contact.toLowerCase().includes(term)) ||
                          (res.phoneStatus && res.phoneStatus.toLowerCase().includes(term)) ||
                          (res.statusText && res.statusText.toLowerCase().includes(term))
                        );
                      })
                      .map((res, idx) => (
                        <tr
                          key={`${res.rowNumber}-${idx}`}
                          className={`transition-colors ${
                            res.isSigned ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                            {res.rowNumber}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {res.name || "-"}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                            {res.cpf || "-"}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="truncate block max-w-[240px]" title={res.contract}>
                              {res.contract || "-"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                            {res.regional || "-"}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                            {res.contact || "-"}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {res.phoneStatus || "Normal"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 hover:underline max-w-[240px] truncate font-medium"
                              title={res.url}
                            >
                              <span className="truncate">{res.url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {res.isSigned ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-black bg-yellow-300 text-slate-900 border border-yellow-400 shadow-xs">
                                <CheckCircle2 className="h-3.5 w-3.5 text-slate-900" />
                                Assinado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <XCircle className="h-3.5 w-3.5 text-slate-400" />
                                Não Assinado
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-[10px] text-slate-400 whitespace-nowrap">
                            {res.checkedAt}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
