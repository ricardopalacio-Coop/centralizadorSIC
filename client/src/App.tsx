import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CooperadosListPage } from "./pages/CooperadosListPage";
import { ImportacaoPage } from "./pages/ImportacaoPage";
import { DesligamentoPage } from "./pages/DesligamentoPage";
import { UsersPage } from "./pages/UsersPage";
import { ApiManagementPage } from "./pages/ApiManagementPage";
import { PlugSignPage } from "./pages/PlugSignPage";
import { FichasCadastraisPage } from "./pages/FichasCadastraisPage";
import { FichasDesligamentoPage } from "./pages/FichasDesligamentoPage";
import { EasyCoopPage } from "./pages/EasyCoopPage";
import { DossiePage } from "./pages/DossiePage";
import { Layout } from "./components/Layout";
import { NavTabType } from "./components/Sidebar";
import { Loader2 } from "lucide-react";

const MainContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTabType>("dashboard");

  // Bloqueio de seguranca: so o SuperAdmin abre as telas de configuracao.
  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN" && (activeTab === "apis" || activeTab === "users")) {
      setActiveTab("dashboard");
    }
  }, [user, activeTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen app-shell-bg flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 text-[#005487] animate-spin" />
        <p className="text-sm font-medium text-slate-600">Verificando sessão segura...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === "dashboard" && <DashboardPage />}
      {activeTab === "dossier" && <DossiePage />}
      {activeTab === "easycoop-cooperado" && <EasyCoopPage initialMode="cooperado" />}
      {activeTab === "easycoop-contrato" && <EasyCoopPage initialMode="contrato" />}
      {activeTab === "cooperados" && <CooperadosListPage />}
      {activeTab === "fichas" && <FichasCadastraisPage />}
      {activeTab === "fichas-desligamento" && <FichasDesligamentoPage />}
      {activeTab === "importacao" && <ImportacaoPage />}
      {activeTab === "desligamento" && <DesligamentoPage />}
      {activeTab === "plugsign" && <PlugSignPage />}
      {activeTab === "apis" && user.role === "SUPER_ADMIN" && <ApiManagementPage />}
      {activeTab === "users" && user.role === "SUPER_ADMIN" && <UsersPage />}
    </Layout>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
};

export default App;
