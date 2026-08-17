import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { LogOut, KeyRound, Users, LayoutDashboard, ListFilter, UploadCloud, UserMinus, Code } from "lucide-react";
import { ChangePasswordModal } from "./ChangePasswordModal";

interface NavbarProps {
  activeTab: "dashboard" | "cooperados" | "importacao" | "desligamento" | "apis" | "users";
  setActiveTab: (tab: "dashboard" | "cooperados" | "importacao" | "desligamento" | "apis" | "users") => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo Oficial do SIC */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab("dashboard")}>
            <img
              src="/logo_sic.svg"
              alt="SIC Logo"
              className="h-10 w-auto object-contain"
            />
            <div className="hidden md:block pl-3 border-l border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Centralizador</span>
              <span className="text-sm font-extrabold text-slate-800">Core Coopedu</span>
            </div>
          </div>

          {/* Navegação e Ações */}
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "dashboard"
                  ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <LayoutDashboard className="h-4 w-4 text-sky-600" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            {/* MENU: ADESÃO / DESLIGAMENTO */}
            <button
              onClick={() => setActiveTab("desligamento")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "desligamento"
                  ? "bg-slate-100 text-slate-900 border border-slate-300 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center space-x-1">
                <UserMinus className="h-4 w-4 text-rose-600" />
              </div>
              <span className="hidden sm:inline">
                <strong className="text-sky-600 font-black">Adesão</strong>
                <span className="text-slate-400 font-normal"> / </span>
                <strong className="text-rose-600 font-black">Desligamento</strong>
              </span>
            </button>

            {/* NOVO MENU: APIs */}
            <button
              onClick={() => setActiveTab("apis")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "apis"
                  ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Code className="h-4 w-4 text-sky-600" />
              <span className="hidden sm:inline">APIs</span>
            </button>

            {user?.role === "SUPER_ADMIN" && (
              <button
                onClick={() => setActiveTab("users")}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "users"
                    ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Users className="h-4 w-4 text-sky-600" />
                <span className="hidden sm:inline">Usuários</span>
              </button>
            )}

            <div className="h-6 w-px bg-slate-200 my-auto mx-1" />

            {/* Perfil & Ações de Segurança */}
            <div className="flex items-center space-x-2">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-bold text-slate-800">{user?.name}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-sky-700 border border-slate-200">
                  {user?.role === "SUPER_ADMIN" ? "SuperAdmin" : "Operador"}
                </span>
              </div>

              <button
                onClick={() => setIsPasswordModalOpen(true)}
                title="Alterar Minha Senha"
                className="p-2 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-all border border-transparent hover:border-amber-200"
              >
                <KeyRound className="h-4.5 w-4.5" />
              </button>

              <button
                onClick={logout}
                title="Sair do Sistema"
                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all border border-transparent hover:border-rose-200"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Modal de Alteração de Senha */}
      {isPasswordModalOpen && (
        <ChangePasswordModal onClose={() => setIsPasswordModalOpen(false)} />
      )}
    </>
  );
};
