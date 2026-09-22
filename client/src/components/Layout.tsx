import React, { ReactNode } from "react";
import { Sidebar, NavTabType } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
  activeTab: NavTabType;
  setActiveTab: (tab: NavTabType) => void;
  /** Tela cheia sem rolagem de pagina: painel arredondado alinhado a sidebar. */
  fullBleed?: boolean;
}

/**
 * Casca do sistema: sidebar arredondada flutuando sobre o fundo institucional.
 * Modo normal para paginas que rolam; fullBleed para telas de altura fixa.
 */
export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, fullBleed = false }) => {
  return (
    <div className="flex h-screen overflow-hidden app-shell-bg">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {fullBleed ? (
        <main className="flex-1 overflow-hidden py-3 pr-3">
          <div className="h-full rounded-3xl border border-slate-200 bg-slate-50 shadow-[0_18px_50px_rgba(15,23,42,0.10)] overflow-hidden">
            {children}
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto thin-scrollbar">
          <div className="w-full px-6 py-6">{children}</div>
        </main>
      )}
    </div>
  );
};

export default Layout;
