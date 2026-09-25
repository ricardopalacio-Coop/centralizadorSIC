import { useState, useEffect, useCallback, useMemo } from "react";
import { PayrollItem, AppData } from "./types";
import { exibirCpf } from "../../lib/lgpd";

export function useCooperadoProfile(cooperadoCpf: string) {
  const [activeTab, setActiveTab] = useState<"pessoal" | "contrato" | "bancario" | "folhas" | "app">("pessoal");
  const [cooperadoData, setCooperadoData] = useState<any>(null);
  const [sicDetails, setSicDetails] = useState<any>(null);
  const [payrolls, setPayrolls] = useState<PayrollItem[]>([]);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [selectedCompetence, setSelectedCompetence] = useState<string>("TODAS");
  const [resumoPayrollId, setResumoPayrollId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");

  const todayYmd = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [selectedProdDate, setSelectedProdDate] = useState<string>(todayYmd);
  const [detectedProfession, setDetectedProfession] = useState<string>("");

  const fetchDetails = useCallback(async () => {
    if (!cooperadoCpf) return;
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
  }, [cooperadoCpf]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  useEffect(() => {
    if (cooperadoCpf && payrolls && payrolls.length > 0) {
      const latestPayrollId = payrolls[0].payrollId;
      if (latestPayrollId && !latestPayrollId.startsWith("fallback-")) {
        fetch(`/api/cooperados/${cooperadoCpf}/payrolls/${latestPayrollId}/resumo-financeiro`, { credentials: "include" })
          .then((res) => res.json())
          .then((data) => {
            if (data?.profissao) {
              setDetectedProfession(data.profissao);
            }
          })
          .catch(() => {});
      }
    } else {
      setDetectedProfession("");
    }
  }, [cooperadoCpf, payrolls]);

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
    return exibirCpf(digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"));
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

  const competencesList = useMemo(() => {
    return Array.from(new Set(payrolls.map((p) => p.competence || `${p.year}-${String(p.month).padStart(2, "0")}`)));
  }, [payrolls]);

  const filteredPayrolls = useMemo(() => {
    return selectedCompetence === "TODAS"
      ? payrolls
      : payrolls.filter((p) => (p.competence || `${p.year}-${String(p.month).padStart(2, "0")}`) === selectedCompetence);
  }, [selectedCompetence, payrolls]);

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

  const rawBankName = cooperadoData?.bank_name || "";
  const rawBankCode = cooperadoData?.bank_code || "";
  const isOwl = rawBankCode === "450" || rawBankCode === "770" || rawBankName.toUpperCase().includes("FITBANK") || rawBankName.toUpperCase().includes("OWL") || !rawBankName;
  const bankName = isOwl ? "BANCO OWL" : rawBankName.replace(/\s*\(\d+\)\s*$/, "").trim();
  const bankCode = isOwl ? "450" : rawBankCode;
  const agency = cooperadoData?.agency || "0001";
  const accountNumber = cooperadoData?.account_number || "N/I";
  const accountDigit = cooperadoData?.account_digit || "";
  const accountType = cooperadoData?.account_type || "Conta-Corrente";
  const pixKey = cooperadoData?.pix_key || formatCpf(cooperadoCpf);

  const recordsForSelectedDate = useMemo(() => {
    return (appData?.productivityRecords || []).filter((r) => {
      if (!r.date) return false;
      return r.date.split("T")[0] === selectedProdDate;
    });
  }, [appData?.productivityRecords, selectedProdDate]);

  const isTodaySelected = selectedProdDate === todayYmd;
  const formattedSelectedDateDisplay = useMemo(() => {
    return new Date(`${selectedProdDate}T12:00:00Z`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [selectedProdDate]);

  const displayWorkedTime = isTodaySelected
    ? appData?.todayWorkedTimeFormatted || "0h 00min"
    : recordsForSelectedDate.length > 0
    ? recordsForSelectedDate[0].workedTimeFormatted || "0h 00min"
    : "0h 00min";

  return {
    activeTab,
    setActiveTab,
    cooperadoData,
    sicDetails,
    payrolls,
    appData,
    selectedCompetence,
    setSelectedCompetence,
    resumoPayrollId,
    setResumoPayrollId,
    loading,
    error,
    isEditingContacts,
    setIsEditingContacts,
    editEmail,
    setEditEmail,
    editWhatsapp,
    setEditWhatsapp,
    editBirthDate,
    setEditBirthDate,
    saveLoading,
    saveSuccess,
    todayYmd,
    selectedProdDate,
    setSelectedProdDate,
    detectedProfession,
    fetchDetails,
    handleSaveContacts,
    formatCpf,
    formatDate,
    formatDateTime,
    competencesList,
    filteredPayrolls,
    name,
    cpf,
    matricula,
    motherName,
    fatherName,
    birthDate,
    admissionDate,
    associationDate,
    birthCity,
    birthState,
    email,
    celular,
    fullAddress,
    rua,
    numero,
    bairro,
    cep,
    bankName,
    bankCode,
    agency,
    accountNumber,
    accountDigit,
    accountType,
    pixKey,
    recordsForSelectedDate,
    isTodaySelected,
    formattedSelectedDateDisplay,
    displayWorkedTime,
  };
}
