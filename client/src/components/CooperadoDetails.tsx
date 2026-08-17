import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Building2,
  Landmark,
  FileText,
  Calendar,
  Eye,
  Download,
  Loader2,
  MapPin,
  Phone,
  Briefcase,
  CheckCircle2,
  Edit2,
  Save,
  Check,
  Smartphone,
  Activity,
  Clock,
  ShieldCheck,
  Sparkles,
  Navigation,
  Globe,
  ClipboardList,
  History,
  CheckSquare,
  Timer,
  BarChart3,
} from "lucide-react";
import { ResumoFinanceiroModal } from "./ResumoFinanceiroModal";

interface PayrollItem {
  payrollId: string;
  contractId: string;
  month: number;
  year: number;
  competence: string;
  payrollType: string;
  payrollStatus: string;
  contractDescription?: string;
  clientName?: string;
  payDayTime?: string;
}

interface CooperadoDetailsProps {
  cooperadoCpf: string;
  onClose: () => void;
  onOpenPdf: (cpf: string, payrollId: string, competence: string, docType?: "demonstrativo" | "comprovante") => void;
}

export const CooperadoDetails: React.FC<CooperadoDetailsProps> = ({
  cooperadoCpf,
  onClose,
  onOpenPdf,
}) => {
  const [activeTab, setActiveTab] = useState<"pessoal" | "contrato" | "bancario" | "folhas" | "app">("pessoal");
  const [cooperadoData, setCooperadoData] = useState<any>(null);
  const [sicDetails, setSicDetails] = useState<any>(null);
  const [payrolls, setPayrolls] = useState<PayrollItem[]>([]);
  const [appData, setAppData] = useState<any>(null);
  const [selectedCompetence, setSelectedCompetence] = useState<string>("TODAS");
  const [resumoPayrollId, setResumoPayrollId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Estado para Edição de E-mail, WhatsApp e Data de Nascimento
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");

  // Estado do Seletor de Data de Produtividade (Padrão: Hoje YYYY-MM-DD)
  const todayYmd = new Date().toISOString().split("T")[0];
  const [selectedProdDate, setSelectedProdDate] = useState<string>(todayYmd);

  const [detectedProfession, setDetectedProfession] = useState<string>("");

  useEffect(() => {
    if (cooperadoCpf && payrolls && payrolls.length > 0) {
      const latestPayrollId = payrolls[0].payrollId;
      fetch(`/api/cooperados/${cooperadoCpf}/payrolls/${latestPayrollId}/resumo-financeiro`, { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.profissao) {
            setDetectedProfession(data.profissao);
          }
        })
        .catch(() => {});
    }
  }, [cooperadoCpf, payrolls]);

  const fetchDetails = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/cooperados/${cooperadoCpf}`, { credentials: "include" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Falha ao carregar dados do cooperado");
      }

      setCooperadoData(data.cooperado);
      setSicDetails(data.sicDetails || null);
      setPayrolls(data.payrolls || []);
      setAppData(data.appData || null);

      const existingEmail = data.cooperado?.email || data.sicDetails?.email || "";
      const existingPhone = data.cooperado?.whatsapp_number || data.sicDetails?.celular || data.sicDetails?.telefone || "";
      const rawBirth = data.cooperado?.birth_date || data.sicDetails?.dataNascimento || data.sicDetails?.birthDate || "";
      const existingBirth = rawBirth ? String(rawBirth).split("T")[0] : "";

      setEditEmail(existingEmail);
      setEditWhatsapp(existingPhone);
      setEditBirthDate(existingBirth);
    } catch (err: any) {
      setError(err.message === "Failed to fetch" ? "Erro de conexão com o servidor. Verifique se o servidor backend está ativo." : err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cooperadoCpf) {
      fetchDetails();
    }
  }, [cooperadoCpf]);

  const handleSaveContacts = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess("");
    setError("");
    try {
      const res = await fetch(`/api/cooperados/${cooperadoCpf}/contatos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: editEmail,
          whatsapp_number: editWhatsapp,
          birth_date: editBirthDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao salvar dados do cooperado");
      }

      setSaveSuccess("Dados atualizados com sucesso no Centralizador e no SIC!");
      setIsEditingContacts(false);
      fetchDetails();
    } catch (err: any) {
      setError(err.message === "Failed to fetch" ? "Erro de conexão com o servidor. Tentando reconectar..." : err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const formatCpf = (val?: string) => {
    if (!val) return "N/I";
    const digits = val.replace(/\D/g, "");
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Não informada";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "Sem registro no app";
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

  const competencesList = Array.from(
    new Set(payrolls.map((p) => p.competence || `${p.year}-${String(p.month).padStart(2, "0")}`))
  );

  const filteredPayrolls =
    selectedCompetence === "TODAS"
      ? payrolls
      : payrolls.filter((p) => (p.competence || `${p.year}-${String(p.month).padStart(2, "0")}`) === selectedCompetence);

  const name = sicDetails?.nome || cooperadoData?.name || "NOME NÃO INFORMADO";
  const cpf = formatCpf(cooperadoData?.document || sicDetails?.documentos?.cpfCnpj || cooperadoCpf);
  const matricula = sicDetails?.matricula || cooperadoData?.registration_number || "N/I";

  const motherName = sicDetails?.nomeMae || cooperadoData?.mother_name || "Não informado";
  const fatherName = sicDetails?.nomePai || cooperadoData?.father_name || "Não informado";
  const birthDate = formatDate(sicDetails?.dataNascimento || cooperadoData?.birth_date);
  const admissionDateRaw = sicDetails?.dataAdmissao || sicDetails?.admissionDate || cooperadoData?.admission_date;
  const associationDateRaw = sicDetails?.dataAssociacao || sicDetails?.associationDate || cooperadoData?.association_date || admissionDateRaw;
  const admissionDate = formatDate(admissionDateRaw);
  const associationDate = formatDate(associationDateRaw);
  const birthCity = sicDetails?.cidadeNascimento || cooperadoData?.birth_city || "";
  const birthState = sicDetails?.estadoNascimento || cooperadoData?.birth_state || "";

  const emailValue = (cooperadoData?.email || sicDetails?.email || "").trim();
  const email = emailValue ? emailValue : "Vazio";

  const celularValue = (cooperadoData?.whatsapp_number || sicDetails?.celular || sicDetails?.telefone || "").trim();
  const celular = celularValue ? celularValue : "Vazio";

  const rua = sicDetails?.endereco?.rua || cooperadoData?.street || "Não informado";
  const numero = sicDetails?.endereco?.numero || cooperadoData?.number || "S/N";
  const complemento = sicDetails?.endereco?.complemento || cooperadoData?.complement || "";
  const bairro = sicDetails?.endereco?.bairro || cooperadoData?.neighborhood || "Não informado";
  const cidade = sicDetails?.endereco?.cidade || cooperadoData?.city || "Não informado";
  const estado = sicDetails?.endereco?.estado === "23" ? "Ceará" : sicDetails?.endereco?.estado || cooperadoData?.state || "";
  const cep = sicDetails?.endereco?.cep || cooperadoData?.zip_code || "Não informado";

  const fullAddress = `${rua}, Nº ${numero}${complemento ? ` (${complemento})` : ""}, Bairro ${bairro}, ${cidade}${estado ? ` - ${estado}` : ""} | CEP: ${cep}`;

  const bankName = cooperadoData?.bank_name || "FitBank (Banco 450)";
  const bankCode = cooperadoData?.bank_code || "450";
  const agency = cooperadoData?.agency || "0001";
  const accountNumber = cooperadoData?.account_number || "N/I";
  const accountDigit = cooperadoData?.account_digit || "";
  const accountType = cooperadoData?.account_type || "Conta-Corrente";
  const pixKey = cooperadoData?.pix_key || formatCpf(cooperadoCpf);

  const rgNumber = sicDetails?.documentos?.rg?.numero || "Não informado";
  const rgEmissor = sicDetails?.documentos?.rg?.emissor || "";
  const rgEstado = sicDetails?.documentos?.rg?.estado || "";

  const recordsForSelectedDate = (appData?.productivityRecords || []).filter((r: any) => {
    if (!r.date) return false;
    const rYmd = r.date.split("T")[0];
    return rYmd === selectedProdDate;
  });

  const isTodaySelected = selectedProdDate === todayYmd;
  const formattedSelectedDateDisplay = new Date(`${selectedProdDate}T12:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

  const displayWorkedTime = isTodaySelected
    ? appData?.todayWorkedTimeFormatted || "0h 00min"
    : recordsForSelectedDate.length > 0
    ? recordsForSelectedDate[0].workedTimeFormatted || "0h 00min"
    : "0h 00min";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden relative">
        {/* Cabeçalho do Modal */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-4">
            <div className="h-14 w-14 rounded-2xl bg-sky-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-md shadow-sky-600/20 shrink-0">
              {name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                {name}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                  {cooperadoData?.status || "Ativo"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5 font-medium">
                CPF: <strong className="text-sky-700">{cpf}</strong> | Matrícula:{" "}
                <strong className="text-slate-800">{matricula}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Abas de Navegação */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 pt-3 overflow-x-auto space-x-2">
          <button
            onClick={() => setActiveTab("pessoal")}
            className={`flex items-center space-x-2 px-4 py-3 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === "pessoal"
                ? "border-sky-600 text-sky-700 bg-white shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <User className="h-4 w-4" />
            <span>Resumo do Cooperado</span>
          </button>

          <button
            onClick={() => setActiveTab("folhas")}
            className={`flex items-center space-x-2 px-4 py-3 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === "folhas"
                ? "border-sky-600 text-sky-700 bg-white shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Folhas de Pagamento ({payrolls.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("app")}
            className={`flex items-center space-x-2 px-4 py-3 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === "app"
                ? "border-sky-600 text-sky-700 bg-white shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Smartphone className="h-4 w-4 text-sky-600" />
            <span>Aplicativo Mobile & Produtividade</span>
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-10 w-10 text-sky-600 animate-spin" />
              <p className="text-sm font-medium text-slate-600">Obtendo dados detalhados no SIC...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium">{error}</div>
          ) : (
            <>
              {/* Aba 1: Resumo do Cooperado */}
              {activeTab === "pessoal" && (
                <div className="space-y-6">
                  {/* SEÇÃO 1: ÚLTIMA COMPETÊNCIA & INFORMAÇÃO DO APLICATIVO */}
                  {payrolls.length > 0 && (() => {
                    const latestPayroll = payrolls[0];
                    const compLabel = latestPayroll.competence || `${latestPayroll.year}-${String(latestPayroll.month).padStart(2, "0")}`;
                    const workedTimeStr = appData?.worked_time_today || appData?.total_worked_time || "0h 00min";

                    return (
                      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white shadow-md border border-slate-700/50 space-y-4">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
                          <div className="flex items-center space-x-3">
                            <div className="p-2.5 rounded-2xl bg-sky-600/30 text-sky-300 border border-sky-500/30">
                              <Calendar className="h-6 w-6" />
                            </div>
                            <div>
                              <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400 block">
                                Última Folha Processada no SIC
                              </span>
                              <h3 className="text-xl font-black text-white flex items-center gap-2">
                                Competência: <span className="font-mono text-sky-300">{compLabel}</span>
                              </h3>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase">
                              Status: {latestPayroll.payrollStatus || "Pago"}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                          {/* INFORMAÇÃO DO APLICATIVO MOBILE */}
                          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-1.5">
                            <div className="flex items-center space-x-2 text-xs font-extrabold text-sky-300 uppercase tracking-wider">
                              <Smartphone className="h-4 w-4 text-sky-400" />
                              <span>Produtividade / Registro no Aplicativo</span>
                            </div>
                            <div className="flex items-baseline space-x-2">
                              <span className="text-2xl font-black text-white font-mono">{workedTimeStr}</span>
                              <span className="text-xs text-slate-300 font-semibold">trabalhadas registradas</span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium">
                              Histórico sincronizado em tempo real com o banco de dados do App Mobile.
                            </p>
                          </div>

                          {/* AÇÕES DA ÚLTIMA COMPETÊNCIA (3 BOTÕES) */}
                          <div className="flex flex-wrap items-center gap-2.5 justify-start md:justify-end">
                            <button
                              onClick={() => setResumoPayrollId(latestPayroll.payrollId)}
                              className="px-3.5 py-2.5 rounded-xl text-xs font-black bg-violet-600 hover:bg-violet-500 text-white flex items-center space-x-1.5 shadow-md transition-all border border-violet-400/30"
                            >
                              <BarChart3 className="h-4 w-4" />
                              <span>Resumo Financeiro</span>
                            </button>

                            <button
                              onClick={() => onOpenPdf(cooperadoCpf, latestPayroll.payrollId, compLabel, "demonstrativo")}
                              className="px-3.5 py-2.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white flex items-center space-x-1.5 shadow-md transition-all border border-sky-400/30"
                            >
                              <Eye className="h-4 w-4" />
                              <span>Demonstrativo</span>
                            </button>

                            <button
                              onClick={() => onOpenPdf(cooperadoCpf, latestPayroll.payrollId, compLabel, "comprovante")}
                              className="px-3.5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 shadow-md transition-all border border-emerald-400/30"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Comprovante</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* SEÇÃO 2: DADOS PESSOAIS & CARGO DA FOLHA */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-xs text-slate-500 font-semibold block">Nome Completo</span>
                      <p className="text-sm font-bold text-slate-900">{name}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-xs text-slate-500 font-semibold block">CPF (Documento)</span>
                      <p className="text-sm font-mono font-bold text-sky-700">{cpf}</p>
                    </div>

                    {/* CARGO / PROFISSÃO DA FOLHA */}
                    <div className="p-4 rounded-2xl bg-violet-50/70 border border-violet-200 space-y-1">
                      <span className="text-xs text-violet-800 font-bold block flex items-center gap-1.5 uppercase tracking-wider">
                        <Briefcase className="h-3.5 w-3.5 text-violet-600" />
                        Cargo / Profissão
                      </span>
                      <p className="text-sm font-black text-violet-950 uppercase">
                        {detectedProfession ||
                          cooperadoData?.position ||
                          cooperadoData?.profession ||
                          sicDetails?.informacoesProfissionais?.profissao ||
                          sicDetails?.informacoesProfissionais?.cargo ||
                          sicDetails?.profissao ||
                          sicDetails?.cargo ||
                          sicDetails?.funcao ||
                          "OUVIDOR"}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-xs text-slate-500 font-semibold block">Matrícula</span>
                      <p className="text-sm font-mono font-bold text-slate-800">{matricula}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-xs text-slate-500 font-semibold block">Gênero / Estado Civil</span>
                      <p className="text-sm font-semibold text-slate-800">
                        {sicDetails?.genero || "NÃO INFORMADO"} - {sicDetails?.estadoCivil || "NÃO INFORMADO"}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-xs text-slate-500 font-semibold block">Data de Associação</span>
                      <p className="text-sm font-semibold text-slate-800">{associationDate}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-xs text-slate-500 font-semibold block">Data de Admissão</span>
                      <p className="text-sm font-semibold text-slate-800">{admissionDate}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-1">
                      <span className="text-xs text-rose-800 font-bold block">Data do Desligamento</span>
                      <p className="text-sm font-black text-rose-600">----</p>
                    </div>
                  </div>

                  {/* SEÇÃO 3: CONTRATOS ATIVOS */}
                  <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-emerald-600" />
                        Contrato Ativo no SIC
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-600 text-white uppercase">
                        VÍNCULO ATIVO
                      </span>
                    </div>

                    {sicDetails?.contratos && sicDetails.contratos.length > 0 ? (
                      <div className="space-y-2.5">
                        {sicDetails.contratos.map((item: any, idx: number) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-white border border-emerald-200 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">
                                {item.contrato?.descricao || item.contrato?.centroDeCusto || "COOPEDU GESTORES"}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                                {item.statusContratoUsuario || "ATIVO"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 font-medium">
                              Cliente: <strong>{item.contrato?.cliente?.nome || "COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA EDUCA"}</strong> | Núcleo: <strong>{item.contrato?.nucleoRegional || "REGIONAL"}</strong>
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-emerald-950">
                        {cooperadoData?.contract_name || "PREFEITURA MUNICIPAL DE SANTAREM / COOPEDU GESTORES (ATIVO)"}
                      </p>
                    )}
                  </div>

                  {/* SEÇÃO 4: DADOS BANCÁRIOS & PIX */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-sky-600" />
                        Dados Bancários de Recebimento & PIX
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                        <span className="text-[11px] text-slate-500 font-semibold block">Nome do Banco</span>
                        <strong className="text-slate-900 block">{bankName} ({bankCode})</strong>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                        <span className="text-[11px] text-slate-500 font-semibold block">Agência</span>
                        <strong className="text-slate-900 block">{agency}</strong>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                        <span className="text-[11px] text-slate-500 font-semibold block">Número da Conta</span>
                        <strong className="text-emerald-700 font-mono block">{accountNumber}{accountDigit ? `-${accountDigit}` : ""} ({accountType})</strong>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                        <span className="text-[11px] text-slate-500 font-semibold block">Chave PIX Cadastrada</span>
                        <strong className="text-sky-700 font-mono block">{pixKey}</strong>
                      </div>
                    </div>
                  </div>

                  {/* ENDEREÇO RESIDENCIAL */}
                  <div className="p-5 rounded-2xl bg-sky-50/60 border border-sky-200 space-y-2">
                    <div className="flex items-center space-x-2 text-xs font-extrabold text-sky-800 uppercase tracking-wider">
                      <MapPin className="h-4 w-4 text-sky-600" />
                      <span>Endereço Residencial</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{fullAddress}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs text-slate-600 border-t border-sky-100 font-medium">
                      <div>Rua: <strong className="text-slate-900 font-semibold">{rua}</strong></div>
                      <div>Número: <strong className="text-slate-900 font-semibold">{numero}</strong></div>
                      <div>Bairro: <strong className="text-slate-900 font-semibold">{bairro}</strong></div>
                      <div>CEP: <strong className="text-slate-900 font-semibold">{cep}</strong></div>
                    </div>
                  </div>

                  {/* CONTATOS DO COOPERADO */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <Phone className="h-4 w-4 text-emerald-600" />
                        Dados Cadastrais (WhatsApp, E-mail & Data de Nascimento)
                      </span>

                      {!isEditingContacts ? (
                        <button
                          onClick={() => setIsEditingContacts(true)}
                          className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-sm"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Editar Dados Cadastrais</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsEditingContacts(false)}
                          className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-all"
                        >
                          Cancelar Edição
                        </button>
                      )}
                    </div>

                    {saveSuccess && (
                      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center space-x-2">
                        <Check className="h-4 w-4 text-emerald-600" />
                        <span>{saveSuccess}</span>
                      </div>
                    )}

                    {!isEditingContacts ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
                          <span className="text-xs text-slate-500 font-semibold block">Celular / WhatsApp</span>
                          <span className={`text-sm font-bold ${celular === "Vazio" ? "text-amber-600 italic font-medium" : "text-slate-900"}`}>
                            {celular}
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
                          <span className="text-xs text-slate-500 font-semibold block">E-mail de Contato</span>
                          <span className={`text-sm font-bold ${email === "Vazio" ? "text-amber-600 italic font-medium" : "text-slate-900"}`}>
                            {email}
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
                          <span className="text-xs text-slate-500 font-semibold block">Data de Nascimento</span>
                          <span className="text-sm font-bold text-slate-900">
                            {birthDate}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveContacts} className="space-y-4 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                              Número do WhatsApp / Celular
                            </label>
                            <input
                              type="text"
                              value={editWhatsapp}
                              onChange={(e) => setEditWhatsapp(e.target.value)}
                              placeholder="Digite o WhatsApp do cooperado"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-none focus:border-sky-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                              E-mail do Cooperado
                            </label>
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="Digite o e-mail do cooperado"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-none focus:border-sky-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                              Data de Nascimento
                            </label>
                            <input
                              type="date"
                              value={editBirthDate}
                              onChange={(e) => setEditBirthDate(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-none focus:border-sky-500"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end space-x-2 pt-2">
                          <button
                            type="submit"
                            disabled={saveLoading}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-50"
                          >
                            {saveLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            <span>Salvar Alterações no SIC</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {/* Aba Folhas de Pagamento */}
              {activeTab === "folhas" && (
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
                      {filteredPayrolls.map((payroll) => (
                        <div
                          key={payroll.payrollId}
                          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-2">
                              <span className="px-2.5 py-0.5 rounded bg-sky-50 text-sky-700 text-xs font-bold font-mono border border-sky-200">
                                {payroll.competence || `${payroll.year}-${String(payroll.month).padStart(2, "0")}`}
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
                            {/* Resumo Financeiro (NOVO BOTÃO - ANTES DE DEMONSTRATIVO) */}
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
                                onClick={() =>
                                  onOpenPdf(
                                    cooperadoCpf,
                                    payroll.payrollId,
                                    payroll.competence || `${payroll.year}-${payroll.month}`,
                                    "demonstrativo"
                                  )
                                }
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
                                onClick={() =>
                                  onOpenPdf(
                                    cooperadoCpf,
                                    payroll.payrollId,
                                    payroll.competence || `${payroll.year}-${payroll.month}`,
                                    "comprovante"
                                  )
                                }
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
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Aba 5: Aplicativo Mobile & Registro de Produtividade */}
              {activeTab === "app" && (
                <div className="space-y-6">
                  {/* 1. CARD DE ÚLTIMO ACESSO E ONDE FOI */}
                  <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-md space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-3 rounded-2xl bg-sky-600/30 text-sky-300 border border-sky-500/30">
                          <Smartphone className="h-7 w-7" />
                        </div>
                        <div>
                          <span className="text-xs text-sky-300 font-bold uppercase tracking-wider block">Último Acesso no Aplicativo Mobile</span>
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

                  {/* 2. REGISTRO DE PRODUTIVIDADE POR PERÍODO (COM HOJE EM DESTAQUE) */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <Activity className="h-4 w-4 text-sky-600" />
                      Registros de Produtividade no Mobile por Período
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      {/* 🌟 CARD DESTAQUE: HOJE */}
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

                      {/* 📅 ÚLTIMOS 7 DIAS */}
                      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider block">
                          Últimos 7 Dias
                        </span>
                        <h4 className="text-2xl font-extrabold text-slate-900">
                          {appData?.periodProductivity?.last7Days || 0}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">Registros na Semana</p>
                      </div>

                      {/* 📆 ÚLTIMOS 30 DIAS */}
                      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider block">
                          Últimos 30 Dias
                        </span>
                        <h4 className="text-2xl font-extrabold text-slate-900">
                          {appData?.periodProductivity?.last30Days || 0}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">Registros no Mês</p>
                      </div>

                      {/* 🗂️ HISTÓRICO TOTAL */}
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

                    {/* CARD DESTACADO DE TEMPO TOTAL TRABALHADO DINÂMICO */}
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
                          Apontamentos Registrados: <strong className="text-white font-bold">{recordsForSelectedDate.length} registro(s) nesta data</strong>
                        </p>
                      </div>

                      <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-right">
                        <span className="text-[11px] text-slate-300 font-bold block uppercase tracking-wider">Total Apontado</span>
                        <span className="text-xl font-extrabold text-amber-400">{displayWorkedTime}</span>
                      </div>
                    </div>

                    {/* Lista dos registros da data selecionada */}
                    {recordsForSelectedDate.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-xs font-medium">
                        Nenhum registro de produtividade encontrado para a data {formattedSelectedDateDisplay}.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recordsForSelectedDate.map((prod: any) => (
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

                  {/* 4. HISTÓRICO LEGÍVEL DE AUDITORIA E LOGS DO APLICATIVO MOBILE (GET /api/auditoria/logs) */}
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
                        {appData.auditLogs.map((log: any) => (
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
                              <span>Dispositivo: <strong className="text-slate-600 font-semibold">{log.deviceInfo}</strong></span>
                              {log.ipAddress && <span>IP: <strong className="text-slate-600 font-semibold">{log.ipAddress}</strong></span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de Resumo Financeiro */}
      {resumoPayrollId && (
        <ResumoFinanceiroModal
          cpf={cooperadoCpf}
          initialPayrollId={resumoPayrollId}
          payrollsList={payrolls}
          onClose={() => setResumoPayrollId(null)}
        />
      )}
    </div>
  );
};
