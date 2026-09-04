import React from "react";
import { User, FileText, Smartphone, Loader2, AlertCircle } from "lucide-react";
import { CooperadoProfileViewProps } from "./types";
import { useCooperadoProfile } from "./useCooperadoProfile";
import { CooperadoHeader } from "./CooperadoHeader";
import { TabPessoal } from "./TabPessoal";
import { TabFolhas } from "./TabFolhas";
import { TabApp } from "./TabApp";
import { ResumoFinanceiroModal } from "../ResumoFinanceiroModal";

export const CooperadoProfileView: React.FC<CooperadoProfileViewProps> = ({
  cooperadoCpf,
  onOpenPdf,
  onClose,
  variant = "inline",
}) => {
  const profile = useCooperadoProfile(cooperadoCpf);

  if (profile.loading) {
    if (variant === "modal") {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl rounded-3xl border border-slate-200 shadow-2xl p-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-10 w-10 text-sky-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-700">Obtendo dados detalhados no SIC...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-10 w-10 text-sky-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-700">Carregando informações reais do cooperado no SIC...</p>
      </div>
    );
  }

  if (profile.error) {
    if (variant === "modal") {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl border border-rose-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-700 text-sm font-semibold">
              <AlertCircle className="h-6 w-6 text-rose-600 shrink-0" />
              <span>{profile.error}</span>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white p-6 rounded-3xl border border-rose-200 bg-rose-50/50 flex items-center space-x-3 text-rose-700 text-sm font-semibold shadow-sm">
        <AlertCircle className="h-6 w-6 text-rose-600 shrink-0" />
        <span>{profile.error}</span>
      </div>
    );
  }

  const content = (
    <>
      <CooperadoHeader
        name={profile.name}
        status={profile.cooperadoData?.status || "Ativo"}
        cpf={profile.cpf}
        matricula={profile.matricula}
        variant={variant}
        onClose={onClose}
        appData={profile.appData}
        formatDateTime={profile.formatDateTime}
      />

      {/* Abas de Navegação */}
      <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 pt-3 overflow-x-auto space-x-2">
        <button
          onClick={() => profile.setActiveTab("pessoal")}
          className={`flex items-center space-x-2 px-4 py-3 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
            profile.activeTab === "pessoal"
              ? "border-sky-600 text-sky-700 bg-white shadow-sm"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <User className="h-4 w-4" />
          <span>Resumo do Cooperado</span>
        </button>

        <button
          onClick={() => profile.setActiveTab("folhas")}
          className={`flex items-center space-x-2 px-4 py-3 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
            profile.activeTab === "folhas"
              ? "border-sky-600 text-sky-700 bg-white shadow-sm"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Folhas de Pagamento ({profile.payrolls.length})</span>
        </button>

        <button
          onClick={() => profile.setActiveTab("app")}
          className={`flex items-center space-x-2 px-4 py-3 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
            profile.activeTab === "app"
              ? "border-sky-600 text-sky-700 bg-white shadow-sm"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Smartphone className="h-4 w-4 text-sky-600" />
          <span>Aplicativo Mobile & Produtividade</span>
        </button>
      </div>

      {/* Conteúdo da Aba */}
      <div className={variant === "modal" ? "p-6 overflow-y-auto flex-1 bg-white" : "p-6 bg-white"}>
        {profile.activeTab === "pessoal" && (
          <TabPessoal
            cooperadoCpf={cooperadoCpf}
            payrolls={profile.payrolls}
            appData={profile.appData}
            sicDetails={profile.sicDetails}
            cooperadoData={profile.cooperadoData}
            detectedProfession={profile.detectedProfession}
            name={profile.name}
            cpf={profile.cpf}
            matricula={profile.matricula}
            motherName={profile.motherName}
            fatherName={profile.fatherName}
            birthDate={profile.birthDate}
            birthCity={profile.birthCity}
            birthState={profile.birthState}
            admissionDate={profile.admissionDate}
            associationDate={profile.associationDate}
            fullAddress={profile.fullAddress}
            rua={profile.rua}
            numero={profile.numero}
            bairro={profile.bairro}
            cep={profile.cep}
            bankName={profile.bankName}
            bankCode={profile.bankCode}
            agency={profile.agency}
            accountNumber={profile.accountNumber}
            accountDigit={profile.accountDigit}
            accountType={profile.accountType}
            pixKey={profile.pixKey}
            celular={profile.celular}
            email={profile.email}
            isEditingContacts={profile.isEditingContacts}
            setIsEditingContacts={profile.setIsEditingContacts}
            editWhatsapp={profile.editWhatsapp}
            setEditWhatsapp={profile.setEditWhatsapp}
            editEmail={profile.editEmail}
            setEditEmail={profile.setEditEmail}
            editBirthDate={profile.editBirthDate}
            setEditBirthDate={profile.setEditBirthDate}
            saveLoading={profile.saveLoading}
            saveSuccess={profile.saveSuccess}
            handleSaveContacts={profile.handleSaveContacts}
            setResumoPayrollId={profile.setResumoPayrollId}
            onOpenPdf={onOpenPdf}
          />
        )}

        {profile.activeTab === "folhas" && (
          <TabFolhas
            cooperadoCpf={cooperadoCpf}
            payrolls={profile.payrolls}
            filteredPayrolls={profile.filteredPayrolls}
            selectedCompetence={profile.selectedCompetence}
            setSelectedCompetence={profile.setSelectedCompetence}
            competencesList={profile.competencesList}
            setResumoPayrollId={profile.setResumoPayrollId}
            onOpenPdf={onOpenPdf}
          />
        )}

        {profile.activeTab === "app" && (
          <TabApp
            appData={profile.appData}
            formatDateTime={profile.formatDateTime}
            selectedProdDate={profile.selectedProdDate}
            setSelectedProdDate={profile.setSelectedProdDate}
            todayYmd={profile.todayYmd}
            isTodaySelected={profile.isTodaySelected}
            formattedSelectedDateDisplay={profile.formattedSelectedDateDisplay}
            displayWorkedTime={profile.displayWorkedTime}
            recordsForSelectedDate={profile.recordsForSelectedDate}
          />
        )}
      </div>

      {profile.resumoPayrollId && (
        <ResumoFinanceiroModal
          cpf={cooperadoCpf}
          initialPayrollId={profile.resumoPayrollId}
          payrollsList={profile.payrolls}
          onClose={() => profile.setResumoPayrollId(null)}
        />
      )}
    </>
  );

  if (variant === "modal") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden relative">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
      {content}
    </div>
  );
};
