import React from "react";
import {
  Calendar,
  Smartphone,
  BarChart3,
  Eye,
  CheckCircle2,
  Briefcase,
  ClipboardList,
  Building2,
  Landmark,
  MapPin,
} from "lucide-react";
import { PayrollItem, AppData } from "./types";
import { ContactsSection } from "./ContactsSection";

interface TabPessoalProps {
  cooperadoCpf: string;
  payrolls: PayrollItem[];
  appData?: AppData | null;
  sicDetails: any;
  cooperadoData: any;
  detectedProfession: string;
  name: string;
  cpf: string;
  matricula: string;
  motherName: string;
  fatherName: string;
  birthDate: string;
  birthCity: string;
  birthState: string;
  admissionDate: string;
  associationDate: string;
  fullAddress: string;
  rua: string;
  numero: string;
  bairro: string;
  cep: string;
  bankName: string;
  bankCode: string;
  agency: string;
  accountNumber: string;
  accountDigit: string;
  accountType: string;
  pixKey: string;
  celular: string;
  email: string;
  isEditingContacts: boolean;
  setIsEditingContacts: (val: boolean) => void;
  editWhatsapp: string;
  setEditWhatsapp: (val: string) => void;
  editEmail: string;
  setEditEmail: (val: string) => void;
  editBirthDate: string;
  setEditBirthDate: (val: string) => void;
  saveLoading: boolean;
  saveSuccess: string;
  handleSaveContacts: (e: React.FormEvent) => Promise<void>;
  setResumoPayrollId: (id: string | null) => void;
  onOpenPdf: (cpf: string, payrollId: string, competence: string, docType?: "demonstrativo" | "comprovante") => void;
}

export const TabPessoal: React.FC<TabPessoalProps> = ({
  cooperadoCpf,
  payrolls,
  appData,
  sicDetails,
  cooperadoData,
  detectedProfession,
  name,
  cpf,
  matricula,
  motherName,
  fatherName,
  birthDate,
  birthCity,
  birthState,
  admissionDate,
  associationDate,
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
  celular,
  email,
  isEditingContacts,
  setIsEditingContacts,
  editWhatsapp,
  setEditWhatsapp,
  editEmail,
  setEditEmail,
  editBirthDate,
  setEditBirthDate,
  saveLoading,
  saveSuccess,
  handleSaveContacts,
  setResumoPayrollId,
  onOpenPdf,
}) => {
  const latestPayroll = payrolls.length > 0 ? payrolls[0] : null;
  const compLabel = latestPayroll
    ? latestPayroll.competence || `${latestPayroll.year}-${String(latestPayroll.month).padStart(2, "0")}`
    : "";
  const workedTimeStr = appData?.worked_time_today || appData?.total_worked_time || "0h 00min";

  const resolvedProfession = (() => {
    const contractsArr = sicDetails?.contractCooperativeUser || sicDetails?.contratos || [];
    if (Array.isArray(contractsArr) && contractsArr.length > 0) {
      const active =
        contractsArr.find(
          (c: any) => c.contractCooperativeUserStatus === "ATIVO" || c.statusContratoUsuario === "ATIVO" || c.isActive
        ) || contractsArr[0];
      const pName = active?.profession?.name || active?.professionName || active?.cargo || active?.funcao;
      if (pName) return pName;
    }
    if (detectedProfession) return detectedProfession;
    if (cooperadoData?.position) return cooperadoData.position;
    if (cooperadoData?.profession) return cooperadoData.profession;
    const profInfo =
      sicDetails?.professionalInformation?.profession ||
      sicDetails?.informacoesProfissionais?.profissao ||
      sicDetails?.profissao ||
      sicDetails?.cargo;
    if (profInfo && !["outro", "outros", "nenhum"].includes(String(profInfo).trim().toLowerCase())) {
      return profInfo;
    }
    return "NÃO INFORMADO";
  })();

  const contractsList = sicDetails?.contractCooperativeUser || sicDetails?.contratos || [];
  const activeContracts = contractsList.filter(
    (c: any) => c.contractCooperativeUserStatus === "ATIVO" || c.statusContratoUsuario === "ATIVO" || c.isActive
  );
  const isUserInactive = String(cooperadoData?.status || sicDetails?.status || "").toLowerCase() === "inativo";
  const validDbContract =
    !isUserInactive &&
    (cooperadoData?.contract_name || cooperadoData?.contrato_atual?.tomador_nome || cooperadoData?.contrato_atual?.contrato_descricao) &&
    !String(cooperadoData?.contract_name || "").toLowerCase().includes("sem contrato")
      ? (cooperadoData?.contract_name || cooperadoData?.contrato_atual?.tomador_nome || cooperadoData?.contrato_atual?.contrato_descricao)
      : null;
  const hasActiveContract = activeContracts.length > 0 || Boolean(validDbContract);

  return (
    <div className="space-y-6">
      {/* SEÇÃO 1: ÚLTIMA COMPETÊNCIA & INFO DO APP */}
      {latestPayroll && (
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
      )}

      {/* SEÇÃO 2: DADOS PESSOAIS & CARGO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-xs text-slate-500 font-semibold block">Nome Completo</span>
          <p className="text-sm font-bold text-slate-900">{name}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-xs text-slate-500 font-semibold block">CPF (Documento)</span>
          <p className="text-sm font-mono font-bold text-sky-700">{cpf}</p>
        </div>

        <div className="p-4 rounded-2xl bg-violet-50/70 border border-violet-200 space-y-1">
          <span className="text-xs text-violet-800 font-bold flex items-center gap-1.5 uppercase tracking-wider">
            <Briefcase className="h-3.5 w-3.5 text-violet-600" />
            Cargo / Profissão
          </span>
          <p className="text-sm font-black text-violet-950 uppercase">{resolvedProfession}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-xs text-slate-500 font-semibold block">Matrícula</span>
          <p className="text-sm font-mono font-bold text-slate-800">{matricula}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-xs text-slate-500 font-semibold block">Nome da Mãe</span>
          <p className="text-sm font-semibold text-slate-800">{motherName}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-xs text-slate-500 font-semibold block">Nome do Pai</span>
          <p className="text-sm font-semibold text-slate-800">{fatherName}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-xs text-slate-500 font-semibold block">Data de Nascimento</span>
          <p className="text-sm font-semibold text-slate-800">{birthDate}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-xs text-slate-500 font-semibold block">Naturalidade</span>
          <p className="text-sm font-semibold text-slate-800">
            {birthCity ? `${birthCity}${birthState ? ` / ${birthState}` : ""}` : "Não informada"}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-xs text-slate-500 font-semibold block">Gênero / Estado Civil</span>
          <p className="text-sm font-semibold text-slate-800">
            {(sicDetails?.genero || (cooperadoData?.gender === 'M' ? 'MASCULINO' : cooperadoData?.gender === 'F' ? 'FEMININO' : cooperadoData?.gender) || "NÃO INFORMADO")} - {sicDetails?.estadoCivil || "NÃO INFORMADO"}
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

      {/* SEÇÃO 2.5: HISTÓRICO DE MATRÍCULAS NO SIC */}
      {sicDetails?.allRegistrations && sicDetails.allRegistrations.length > 0 && (
        <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Histórico de Cadastros e Matrículas no SIC
                </h4>
                <p className="text-[11px] text-slate-600 font-semibold">
                  {sicDetails.allRegistrations.length} registro(s) associado(s) a este CPF
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                {sicDetails.allRegistrations.filter((r: any) => String(r.status).toLowerCase() === "ativo").length} Ativo(s)
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                {sicDetails.allRegistrations.filter((r: any) => String(r.status).toLowerCase() !== "ativo").length} Inativo(s)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sicDetails.allRegistrations.map((reg: any, idx: number) => {
              const isAtivo = String(reg.status).toLowerCase() === "ativo";
              return (
                <div
                  key={reg.id || idx}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isAtivo
                      ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm"
                      : "bg-white border-slate-200 opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">Matrícula</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isAtivo ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {isAtivo ? "🟢 Ativo" : "⚪ Inativo"}
                    </span>
                  </div>
                  <p className="text-base font-black font-mono text-slate-900">#{reg.registration || "N/I"}</p>
                  {reg.profession && (
                    <span className="text-[11px] font-bold text-sky-800 block truncate mt-1">{reg.profession}</span>
                  )}
                  {reg.createdTime && (
                    <span className="text-[10px] text-slate-600 font-semibold block mt-1">
                      Criado em: {new Date(reg.createdTime).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SEÇÃO 3: CONTRATOS ATIVOS */}
      {hasActiveContract ? (
        <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              CONTRATO ATIVO NO SIC
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-600 text-white uppercase">
              VINCULO ATIVO
            </span>
          </div>

          {activeContracts.length > 0 ? (
            <div className="space-y-2.5">
              {activeContracts.map((item: any, idx: number) => {
                const cObj = item.contract || item.contrato;
                const contractName =
                  cObj?.description ||
                  cObj?.descricao ||
                  cObj?.costCenter ||
                  cObj?.centroDeCusto ||
                  cooperadoData?.contract_name ||
                  "CONTRATO SEM DESCRICAO";
                const clientName = cObj?.client?.name || cObj?.cliente?.nome || cObj?.costCenter || "";
                const regionalNucleus = cObj?.regionalNucleus || cObj?.nucleoRegional || "";
                const statusStr =
                  item.contractCooperativeUserStatus || item.statusContratoUsuario || (item.isActive ? "ATIVO" : "INATIVO");

                return (
                  <div key={idx} className="p-3.5 rounded-xl bg-white border border-emerald-200 space-y-1 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-xs font-black text-slate-900 uppercase">{contractName}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase shrink-0">
                        {statusStr}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-semibold">
                      {clientName && <>CLIENTE: <strong className="text-slate-800">{clientName}</strong></>}
                      {regionalNucleus && <> | NUCLEO: <strong className="text-slate-800">{regionalNucleus}</strong></>}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-sm">
              <p className="text-sm font-bold text-emerald-950 uppercase">{validDbContract}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
          <div className="flex items-center justify-between border-b border-rose-200/80 pb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-rose-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-rose-600" />
              CONTRATO ATIVO NO SIC
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-700 border border-rose-300 uppercase">
              SEM VINCULO ATIVO
            </span>
          </div>

          <div className="p-4 rounded-xl bg-rose-100/60 border border-rose-200 flex items-center justify-between shadow-sm">
            <span className="text-sm font-black text-rose-600 uppercase tracking-wider">
              SEM CONTRATO VINCULADO
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-200/80 text-rose-800 text-[10px] font-black uppercase tracking-wider border border-rose-300">
              NAO VINCULADO
            </span>
          </div>
        </div>
      )}

      {/* SEÇÃO 4: DADOS BANCÁRIOS */}
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
            <strong className="text-emerald-700 font-mono block">
              {accountNumber}{accountDigit ? `-${accountDigit}` : ""} ({accountType})
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
            <span className="text-[11px] text-slate-500 font-semibold block">Chave PIX Cadastrada</span>
            <strong className="text-sky-700 font-mono block break-all text-[11px] leading-tight select-all">
              {pixKey}
            </strong>
          </div>
        </div>
      </div>

      {/* SEÇÃO 5: ENDEREÇO RESIDENCIAL */}
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

      {/* SEÇÃO 6: CONTATOS / EDIÇÃO */}
      <ContactsSection
        celular={celular}
        email={email}
        birthDate={birthDate}
        isEditingContacts={isEditingContacts}
        setIsEditingContacts={setIsEditingContacts}
        editWhatsapp={editWhatsapp}
        setEditWhatsapp={setEditWhatsapp}
        editEmail={editEmail}
        setEditEmail={setEditEmail}
        editBirthDate={editBirthDate}
        setEditBirthDate={setEditBirthDate}
        saveLoading={saveLoading}
        saveSuccess={saveSuccess}
        handleSaveContacts={handleSaveContacts}
      />
    </div>
  );
};
