import React, { useState } from "react";
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
import { Navbar, NavTabType } from "./components/Navbar";
import { Loader2 } from "lucide-react";

const MainContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTabType>("dashboard");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 text-sky-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Verificando sessão segura...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col selection:bg-sky-500 selection:text-white">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 bg-slate-100">
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "easycoop-cooperado" && <EasyCoopPage initialMode="cooperado" />}
        {activeTab === "easycoop-contrato" && <EasyCoopPage initialMode="contrato" />}
        {activeTab === "cooperados" && <CooperadosListPage />}
        {activeTab === "fichas" && <FichasCadastraisPage />}
        {activeTab === "fichas-desligamento" && <FichasDesligamentoPage />}
        {activeTab === "importacao" && <ImportacaoPage />}
        {activeTab === "desligamento" && <DesligamentoPage />}
        {activeTab === "plugsign" && <PlugSignPage />}
        {activeTab === "apis" && <ApiManagementPage />}
        {activeTab === "users" && user.role === "SUPER_ADMIN" && <UsersPage />}
      </main>
    </div>
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
