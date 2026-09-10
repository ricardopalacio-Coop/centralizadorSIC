import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  LogOut,
  KeyRound,
  Users,
  LayoutDashboard,
  ListFilter,
  UploadCloud,
  UserMinus,
  Code,
  FileCheck2,
  FolderArchive,
  Layers,
  ChevronDown,
  UserCheck,
  Briefcase,
  FileSpreadsheet,
} from "lucide-react";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { SicConnectionModal } from "./SicConnectionModal";
import { Key } from "lucide-react";

export type NavTabType =
  | "dashboard"
  | "easycoop-cooperado"
  | "easycoop-contrato"
  | "dossier"
  | "cooperados"
  | "importacao"
  | "desligamento"
  | "plugsign"
  | "apis"
  | "users"
  | "fichas"
  | "fichas-desligamento";

interface NavbarProps {
  activeTab: NavTabType;
  setActiveTab: (tab: NavTabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSicModalOpen, setIsSicModalOpen] = useState(false);
  const [sicStatusActive, setSicStatusActive] = useState<boolean>(true);
  const [isEasyCoopOpen, setIsEasyCoopOpen] = useState(false);
  const [isTermosAntigosOpen, setIsTermosAntigosOpen] = useState(false);
  const [isTermosSicOpen, setIsTermosSicOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  const easyCoopRef = useRef<HTMLDivElement>(null);
  const termosAntigosRef = useRef<HTMLDivElement>(null);
  const termosSicRef = useRef<HTMLDivElement>(null);
  const setupRef = useRef<HTMLDivElement>(null);

  const checkSicStatus = async () => {
    try {
      const res = await fetch("/api/sic/status", { credentials: "include" });
      const data = await res.json();
      setSicStatusActive(!!data.active);
    } catch {}
  };

  useEffect(() => {
    checkSicStatus();
    const interval = setInterval(checkSicStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fecha os dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (easyCoopRef.current && !easyCoopRef.current.contains(target)) {
        setIsEasyCoopOpen(false);
      }
      if (termosAntigosRef.current && !termosAntigosRef.current.contains(target)) {
        setIsTermosAntigosOpen(false);
      }
      if (termosSicRef.current && !termosSicRef.current.contains(target)) {
        setIsTermosSicOpen(false);
      }
      if (setupRef.current && !setupRef.current.contains(target)) {
        setIsSetupOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isEasyCoopActive = activeTab === "easycoop-cooperado" || activeTab === "easycoop-contrato";
  const isTermosAntigosActive = activeTab === "fichas" || activeTab === "fichas-desligamento";
  const isTermosSicActive = activeTab === "desligamento" || activeTab === "plugsign";
  const isSetupActive = activeTab === "apis" || activeTab === "users";

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-2.5 shadow-sm">
        <div className="w-full max-w-[98%] 2xl:max-w-[1850px] mx-auto flex items-center justify-between">
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
          <div className="flex items-center space-x-1 sm:space-x-2">
            {/* 1.1 PESQUISA COOPERADO (ANTIGO DASHBOARD) */}
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <UserCheck className="h-4 w-4 text-sky-600" />
              <span className="hidden sm:inline">Pesquisa Cooperado</span>
            </button>

            {/* 1.2 MENU DOSSIÊ DO COOPERADO */}
            <button
              onClick={() => {
                setActiveTab("dossier");
                setIsEasyCoopOpen(false);
                setIsTermosAntigosOpen(false);
                setIsTermosSicOpen(false);
                setIsSetupOpen(false);
              }}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dossier"
                  ? "bg-gradient-to-r from-sky-50 to-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm ring-1 ring-indigo-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FolderArchive className={`h-4 w-4 ${activeTab === "dossier" ? "text-indigo-600" : "text-slate-500"}`} />
              <span className="font-extrabold tracking-tight">Dossiê</span>
            </button>

            {/* MENU EASYCOOP (DROPDOWN COOPERADO OU CONTRATO) */}
            <div className="relative" ref={easyCoopRef}>
              <button
                onClick={() => {
                  setIsEasyCoopOpen((prev) => !prev);
                  setIsTermosAntigosOpen(false);
                  setIsTermosSicOpen(false);
                  setIsSetupOpen(false);
                }}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isEasyCoopActive
                    ? "bg-gradient-to-r from-sky-50 to-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm ring-1 ring-indigo-200"
                    : "text-slate-700 hover:text-indigo-600 hover:bg-slate-100"
                }`}
              >
                <Layers className={`h-4 w-4 ${isEasyCoopActive ? "text-indigo-600" : "text-slate-500"}`} />
                <span className="font-extrabold tracking-tight">EasyCoop</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                    isEasyCoopOpen ? "rotate-180 text-indigo-600" : ""
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isEasyCoopOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setActiveTab("easycoop-cooperado");
                      setIsEasyCoopOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center space-x-3 transition-colors ${
                      activeTab === "easycoop-cooperado"
                        ? "bg-sky-50 text-sky-800"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs block">Cooperado</span>
                      <span className="text-[10px] text-slate-400 block">Pesquisa CPF e Nome</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("easycoop-contrato");
                      setIsEasyCoopOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center space-x-3 transition-colors ${
                      activeTab === "easycoop-contrato"
                        ? "bg-indigo-50 text-indigo-800"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs block">Contrato</span>
                      <span className="text-[10px] text-slate-400 block">Gestão e Alocações</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 1.2 TERMOS/FICHAS (ANTIGOS) - DROPDOWN */}
            <div className="relative" ref={termosAntigosRef}>
              <button
                onClick={() => {
                  setIsTermosAntigosOpen((prev) => !prev);
                  setIsEasyCoopOpen(false);
                  setIsTermosSicOpen(false);
                  setIsSetupOpen(false);
                }}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isTermosAntigosActive
                    ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-sm ring-1 ring-sky-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <FolderArchive className="h-4 w-4 text-sky-600" />
                <span className="hidden sm:inline font-bold">Termos/Fichas (Easy)</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                    isTermosAntigosOpen ? "rotate-180 text-sky-600" : ""
                  }`}
                />
              </button>

              {isTermosAntigosOpen && (
                <div className="absolute left-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setActiveTab("fichas");
                      setIsTermosAntigosOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center space-x-3 transition-colors ${
                      activeTab === "fichas"
                        ? "bg-sky-50 text-sky-800"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                      <FolderArchive className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs block">Fichas Cadastrais</span>
                      <span className="text-[10px] text-slate-400 block">Arquivos Google Drive</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("fichas-desligamento");
                      setIsTermosAntigosOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center space-x-3 transition-colors ${
                      activeTab === "fichas-desligamento"
                        ? "bg-rose-50 text-rose-800"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                      <FolderArchive className="h-4 w-4 text-rose-600" />
                    </div>
                    <div>
                      <span className="font-bold text-xs block">Fichas de Desligamento</span>
                      <span className="text-[10px] text-slate-400 block">Arquivos Google Drive</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 1.3 TERMOS/FICHAS (SIC) - DROPDOWN */}
            <div className="relative" ref={termosSicRef}>
              <button
                onClick={() => {
                  setIsTermosSicOpen((prev) => !prev);
                  setIsEasyCoopOpen(false);
                  setIsTermosAntigosOpen(false);
                  setIsSetupOpen(false);
                }}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isTermosSicActive
                    ? "bg-amber-50 text-amber-900 border border-amber-300 shadow-sm ring-1 ring-amber-300"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <FileCheck2 className="h-4 w-4 text-amber-600" />
                <span className="hidden sm:inline font-bold">Termos/Fichas (SIC)</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                    isTermosSicOpen ? "rotate-180 text-amber-600" : ""
                  }`}
                />
              </button>

              {isTermosSicOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setActiveTab("desligamento");
                      setIsTermosSicOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center space-x-3 transition-colors ${
                      activeTab === "desligamento"
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                      <UserMinus className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs block">Adesão / Desligamento</span>
                      <span className="text-[10px] text-slate-400 block">Gestão de Termos SIC</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("plugsign");
                      setIsTermosSicOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center space-x-3 transition-colors ${
                      activeTab === "plugsign"
                        ? "bg-amber-50 text-amber-900"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                      <FileCheck2 className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs block">PlugSign Analisador</span>
                      <span className="text-[10px] text-slate-400 block">Assinaturas e Conformidade</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 1.4 SETUP - DROPDOWN (APIs, Usuários, Trocar Minha Senha) */}
            <div className="relative" ref={setupRef}>
              <button
                onClick={() => {
                  setIsSetupOpen((prev) => !prev);
                  setIsEasyCoopOpen(false);
                  setIsTermosAntigosOpen(false);
                  setIsTermosSicOpen(false);
                }}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSetupActive
                    ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-sm ring-1 ring-sky-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Code className="h-4 w-4 text-sky-600" />
                <span className="hidden sm:inline font-bold">Setup</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                    isSetupOpen ? "rotate-180 text-sky-600" : ""
                  }`}
                />
              </button>

              {isSetupOpen && (
                <div className="absolute right-0 sm:left-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setActiveTab("apis");
                      setIsSetupOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center space-x-3 transition-colors ${
                      activeTab === "apis"
                        ? "bg-sky-50 text-sky-800"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                      <Code className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs block">APIs</span>
                      <span className="text-[10px] text-slate-400 block">Integrações e Webhooks</span>
                    </div>
                  </button>

                  {user?.role === "SUPER_ADMIN" && (
                    <button
                      onClick={() => {
                        setActiveTab("users");
                        setIsSetupOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center space-x-3 transition-colors ${
                        activeTab === "users"
                          ? "bg-sky-50 text-sky-800"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs block">Usuários</span>
                        <span className="text-[10px] text-slate-400 block">Gestão de Acessos</span>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsSetupOpen(false);
                      setIsSicModalOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 flex items-center space-x-3 transition-colors text-slate-700 hover:bg-sky-50 hover:text-sky-900"
                  >
                    <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                      <Key className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs block">Conexão SIC</span>
                      <span className="text-[10px] text-slate-400 block">Status e Token do Portal</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsSetupOpen(false);
                      setIsPasswordModalOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 flex items-center space-x-3 transition-colors text-slate-700 hover:bg-amber-50 hover:text-amber-900"
                  >
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs block">Trocar Minha Senha</span>
                      <span className="text-[10px] text-slate-400 block">Segurança da Conta</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Status Conexão SIC */}
            <button
              onClick={() => setIsSicModalOpen(true)}
              title={sicStatusActive ? "SIC Conectado (Clique para gerenciar)" : "SIC Desconectado (Clique para autenticar)"}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                sicStatusActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 animate-pulse"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${sicStatusActive ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className="hidden xl:inline text-[11px] font-black">
                {sicStatusActive ? "SIC Conectado" : "SIC Desconectado"}
              </span>
            </button>

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

      {/* Modal de Conexão com o SIC */}
      <SicConnectionModal
        isOpen={isSicModalOpen}
        onClose={() => setIsSicModalOpen(false)}
        onSessionUpdated={checkSicStatus}
      />
    </>
  );
};
