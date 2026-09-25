import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { MarcaProduto } from "./MarcaProduto";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { SicConnectionModal } from "./SicConnectionModal";
import { LgpdModal } from "./LgpdModal";
import {
  UserCheck,
  FolderArchive,
  Layers,
  Users,
  FileCheck2,
  UploadCloud,
  Settings2,
  Briefcase,
  UserMinus,
  Code,
  KeyRound,
  Plug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
} from "lucide-react";

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

type Papel = "SUPER_ADMIN" | "MASTER" | "USER";

interface ItemNav {
  nome: string;
  aba?: NavTabType;
  /** Ação que não navega: abre um diálogo. */
  acao?: "senha" | "conexao-sic" | "lgpd";
  icone: React.ComponentType<{ className?: string }>;
  papeis: Papel[];
  submenu?: ItemNav[];
}

const TODOS: Papel[] = ["SUPER_ADMIN", "MASTER", "USER"];
const SO_SUPERADMIN: Papel[] = ["SUPER_ADMIN"];

/** Uso diário no topo, Configurações sempre por último. */
const navegacao: ItemNav[] = [
  { nome: "Pesquisa Cooperado", aba: "dashboard", icone: UserCheck, papeis: TODOS },
  { nome: "Dossiê do Cooperado", aba: "dossier", icone: FolderArchive, papeis: TODOS },
  {
    nome: "EasyCoop",
    icone: Layers,
    papeis: TODOS,
    submenu: [
      { nome: "Cooperado", aba: "easycoop-cooperado", icone: UserCheck, papeis: TODOS },
      { nome: "Contrato", aba: "easycoop-contrato", icone: Briefcase, papeis: TODOS },
    ],
  },
  { nome: "Cooperados", aba: "cooperados", icone: Users, papeis: TODOS },
  {
    nome: "Termos e Fichas",
    icone: FileCheck2,
    papeis: TODOS,
    submenu: [
      { nome: "Fichas cadastrais", aba: "fichas", icone: FolderArchive, papeis: TODOS },
      { nome: "Fichas de desligamento", aba: "fichas-desligamento", icone: FolderArchive, papeis: TODOS },
      { nome: "Adesão e desligamento", aba: "desligamento", icone: UserMinus, papeis: TODOS },
      { nome: "PlugSign — análise", aba: "plugsign", icone: FileCheck2, papeis: TODOS },
    ],
  },
  { nome: "Importação", aba: "importacao", icone: UploadCloud, papeis: TODOS },
  {
    nome: "Configurações",
    icone: Settings2,
    papeis: SO_SUPERADMIN,
    submenu: [
      { nome: "APIs e integrações", aba: "apis", icone: Code, papeis: SO_SUPERADMIN },
      { nome: "Usuários", aba: "users", icone: Users, papeis: SO_SUPERADMIN },
      { nome: "Conexão SIC", acao: "conexao-sic", icone: Plug, papeis: SO_SUPERADMIN },
      { nome: "Trocar minha senha", acao: "senha", icone: KeyRound, papeis: SO_SUPERADMIN },
      { nome: "LGPD", acao: "lgpd", icone: ShieldCheck, papeis: SO_SUPERADMIN },
    ],
  },
];

const rotuloPapel = (papel?: Papel) =>
  papel === "SUPER_ADMIN" ? "SuperAdmin" : papel === "MASTER" ? "Usuário Master" : "Operador";

/** Duas manchas desfocadas: assinatura da marca no shell. */
function BackgroundFX() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute -left-16 bottom-24 w-56 h-56 rounded-full bg-blue-500/10 blur-2xl" />
      <div className="absolute -right-20 top-1/2 w-60 h-60 rounded-full bg-[#7cc243]/15 blur-2xl" />
    </div>
  );
}

interface SidebarProps {
  activeTab: NavTabType;
  setActiveTab: (tab: NavTabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const [expandida, setExpandida] = useState(true);
  const [abertos, setAbertos] = useState<string[]>([]);
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [sicAberta, setSicAberta] = useState(false);
  const [lgpdAberta, setLgpdAberta] = useState(false);
  const [sicConectado, setSicConectado] = useState(true);

  const papel = (user?.role ?? "USER") as Papel;

  const verificarSic = async () => {
    try {
      const res = await fetch("/api/sic/status", { credentials: "include" });
      const data = await res.json();
      setSicConectado(!!data.active);
    } catch {
      /* rede fora: mantém o último estado conhecido */
    }
  };

  useEffect(() => {
    verificarSic();
    const intervalo = setInterval(verificarSic, 60000);
    return () => clearInterval(intervalo);
  }, []);

  /** O pai abre sozinho quando a aba ativa está dentro dele. */
  useEffect(() => {
    const pai = navegacao.find((item) => item.submenu?.some((sub) => sub.aba === activeTab));
    if (pai && !abertos.includes(pai.nome)) {
      setAbertos((atuais) => [...atuais, pai.nome]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const visivel = (item: ItemNav) => item.papeis.includes(papel);
  const alternarSubmenu = (nome: string) =>
    setAbertos((atuais) => (atuais.includes(nome) ? atuais.filter((n) => n !== nome) : [...atuais, nome]));

  const executar = (item: ItemNav) => {
    if (item.acao === "senha") return setSenhaAberta(true);
    if (item.acao === "conexao-sic") return setSicAberta(true);
    if (item.acao === "lgpd") return setLgpdAberta(true);
    if (item.aba) setActiveTab(item.aba);
  };

  const baseItem =
    "relative group flex items-center py-2.5 px-3 my-1 font-medium rounded-xl cursor-pointer transition-all duration-300 ease-in-out";

  const iniciais = (user?.name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <aside
        className={cn(
          "relative flex flex-col text-slate-600 transition-all duration-300 ease-in-out overflow-hidden m-3 h-[calc(100%-24px)] rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-[#f4f8fb] shadow-[0_18px_50px_rgba(15,23,42,0.10)] shrink-0",
          expandida ? "w-72" : "w-20"
        )}
      >
        <BackgroundFX />

        {/* Cabeçalho: SiC acima, marca do produto abaixo */}
        <div className="relative h-32 flex items-center justify-center z-10 shrink-0">
          <div
            className={cn(
              "flex flex-col overflow-hidden transition-all duration-300 absolute left-5 top-1/2 -translate-y-1/2",
              expandida ? "opacity-100 w-[calc(100%-32px)] delay-100" : "opacity-0 w-0 pointer-events-none"
            )}
          >
            <img
              src="/logo-sic.png"
              alt="SiC - sistema integrado de cooperativas"
              className="h-[67px] object-contain self-start -ml-1"
            />
            <MarcaProduto altura={43} className="self-start -mt-2" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-[0.14em] whitespace-nowrap pl-0.5 mt-1">
              Cooperativas
            </span>
          </div>

          <div
            className={cn(
              "transition-all duration-300 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              !expandida ? "opacity-100 scale-100 delay-200" : "opacity-0 scale-0 w-0 pointer-events-none"
            )}
          >
            <img src="/favicon.png" alt="SiC" className="h-12 w-12 object-contain drop-shadow-sm" />
          </div>

          <button
            onClick={() => setExpandida((atual) => !atual)}
            className="p-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-600 transition-all absolute -right-3 top-1/2 -translate-y-1/2 shadow-md border border-slate-300 z-20 hover:scale-110"
            aria-label={expandida ? "Recolher menu" : "Expandir menu"}
            title={expandida ? "Recolher menu" : "Expandir menu"}
          >
            {expandida ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Navegação */}
        <nav className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-3 thin-scrollbar">
          <ul>
            {navegacao.filter(visivel).map((item) => {
              const temSubmenu = !!item.submenu?.length;
              const aberto = abertos.includes(item.nome);
              const ativo = item.aba
                ? activeTab === item.aba
                : !!item.submenu?.some((sub) => sub.aba === activeTab);

              return (
                <li key={item.nome}>
                  <button
                    onClick={() => (temSubmenu ? alternarSubmenu(item.nome) : executar(item))}
                    className={cn(
                      "w-full text-left cursor-pointer",
                      baseItem,
                      ativo
                        ? "bg-gradient-to-r from-blue-600 to-[#7cc243] text-white shadow-lg shadow-blue-600/30"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      !expandida && "justify-center"
                    )}
                    title={!expandida ? item.nome : undefined}
                  >
                    <span
                      className={cn(
                        ativo ? "text-white" : "text-slate-500 group-hover:text-blue-600",
                        "transition-colors duration-200"
                      )}
                    >
                      <item.icone className="h-5 w-5" />
                    </span>
                    <span
                      className={cn(
                        "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                        expandida ? "w-44 ml-3 opacity-100" : "w-0 ml-0 opacity-0"
                      )}
                    >
                      {item.nome}
                    </span>

                    {expandida && temSubmenu && (
                      <div className="absolute right-3 flex items-center gap-2">
                        <ChevronDown
                          size={14}
                          className={cn(
                            "transition-transform duration-300",
                            aberto && "rotate-180",
                            ativo ? "text-white" : aberto ? "text-blue-600" : "text-slate-400"
                          )}
                        />
                      </div>
                    )}
                  </button>

                  {temSubmenu && (
                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        expandida && aberto ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                      )}
                    >
                      <ul className="pl-4 ml-3 border-l-2 border-slate-200 space-y-1 my-1 pb-2">
                        {item.submenu!.filter(visivel).map((sub) => {
                          const subAtivo = sub.aba === activeTab;
                          return (
                            <li key={sub.nome}>
                              <button
                                onClick={() => executar(sub)}
                                className={cn(
                                  "w-full flex items-center justify-between p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer text-sm transition-colors group",
                                  subAtivo && "bg-blue-50 text-blue-700"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className={cn(
                                      "transition-colors group-hover:text-blue-600",
                                      subAtivo ? "text-blue-600" : "text-slate-400"
                                    )}
                                  >
                                    <sub.icone className="h-4 w-4" />
                                  </span>
                                  <span className="whitespace-nowrap">{sub.nome}</span>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Rodapé: estado do SIC, usuário e saída */}
        <div
          className={cn(
            "relative z-10 border-t border-slate-200 p-3 transition-all duration-300 space-y-2 shrink-0",
            expandida ? "" : "flex flex-col items-center"
          )}
        >
          <button
            onClick={() => setSicAberta(true)}
            title={sicConectado ? "SIC conectado — clique para gerenciar" : "SIC desconectado — clique para autenticar"}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors hover:bg-slate-100",
              expandida ? "w-full" : "justify-center",
              sicConectado ? "text-slate-500" : "text-amber-600"
            )}
          >
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                sicConectado ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"
              )}
            />
            {expandida && <span>{sicConectado ? "SIC conectado" : "SIC desconectado"}</span>}
          </button>

          <div className={cn("rounded-2xl transition-all", expandida ? "border border-slate-200 bg-white/70 p-2 space-y-2" : "space-y-2")}>
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl p-2 transition-colors group",
                expandida ? "" : "justify-center"
              )}
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full border-2 border-slate-200 shadow-sm bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                  {iniciais}
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
              </div>
              <div
                className={cn(
                  "flex justify-between items-center overflow-hidden transition-all duration-300",
                  expandida ? "w-40 opacity-100 ml-1" : "w-0 opacity-0"
                )}
              >
                <div className="leading-4 min-w-0">
                  <h4 className="font-semibold text-slate-800 text-sm truncate">{user?.name}</h4>
                  <div className="text-xs text-slate-500 leading-tight flex flex-col">
                    <span className="truncate">{rotuloPapel(papel)}</span>
                    <span className="truncate">Coopedu</span>
                  </div>
                </div>
                <button
                  onClick={() => setSenhaAberta(true)}
                  title="Trocar minha senha"
                  className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                >
                  <KeyRound size={16} />
                </button>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sair"
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 px-3 py-2 transition-all",
                expandida ? "" : "p-2 w-10 h-10"
              )}
            >
              <LogOut className="h-4 w-4" />
              {expandida && <span className="text-sm font-medium">Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      <ChangePasswordModal isOpen={senhaAberta} onClose={() => setSenhaAberta(false)} />

      <LgpdModal isOpen={lgpdAberta} onClose={() => setLgpdAberta(false)} />

      <SicConnectionModal isOpen={sicAberta} onClose={() => setSicAberta(false)} onSessionUpdated={verificarSic} />
    </>
  );
};

export default Sidebar;
