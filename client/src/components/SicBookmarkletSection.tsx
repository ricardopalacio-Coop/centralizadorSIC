import React, { useState } from "react";
import { Bookmark, Copy, Check, Sparkles, ExternalLink, ShieldCheck, Zap } from "lucide-react";

export const SicBookmarkletSection: React.FC = () => {
  const [copied, setCopied] = useState(false);

  // Script completo do Bookmarklet em linha única
  const bookmarkletCode = `javascript:(async function(){const showToast=(msg,isErr)=>{const el=document.createElement('div');el.style.cssText='position:fixed;top:20px;right:20px;z-index:9999999;padding:16px 22px;background:'+(isErr?'#ef4444':'#10b981')+';color:#fff;border-radius:12px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,0.35);display:flex;align-items:center;gap:10px;';el.innerHTML='<span>⚡ <strong>Centralizador SIC:</strong> '+msg+'</span>';document.body.appendChild(el);setTimeout(()=>{el.remove();},6000);};try{showToast('Lendo sessão oficial do SIC...',false);let token='';try{const res=await fetch('/api/decode-jwt');const data=await res.json();if(data&&data.rawToken)token=data.rawToken;}catch(e){}if(!token){const m=document.cookie.match(/coopedu-auth-prod=([^;]+)/);if(m)token=decodeURIComponent(m[1]);}if(!token){showToast('Nenhuma sessão encontrada. Faça login no portal e tente novamente.',true);return;}try{await navigator.clipboard.writeText(token);}catch(e){}const origins=[window.location.origin,'http://localhost:3005','http://localhost:3001','http://34.31.226.186'];let synced=false;for(const origin of origins){try{const r=await fetch(origin+'/api/sic/sync-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tokenOrCookie:token}),mode:'cors'});if(r.ok){synced=true;break;}}catch(e){}}if(synced){showToast('Sessão sincronizada com o Centralizador SIC! Auto-refresh ativo.',false);}else{showToast('Token copiado com sucesso! Basta colar no Centralizador SIC.',false);}}catch(err){showToast('Erro: '+err.message,true);}})();`;

  const handleCopy = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-sky-50 to-blue-50 border border-indigo-100 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              Sincronização em 1 Clique (Zero F12)
              <span className="px-2 py-0.5 text-[10px] uppercase font-extrabold bg-indigo-100 text-indigo-700 rounded-full">
                Recomendado
              </span>
            </h4>
            <p className="text-xs text-slate-600">
              Nunca mais abra o DevTools F12. Sincronize o portal oficial com 1 único clique.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <a
          href={bookmarkletCode}
          onClick={(e) => {
            e.preventDefault();
            alert("Como usar:\n\n1. Arraste este botão até a Barra de Favoritos do seu navegador (Ctrl+Shift+B)!\n2. Acesse o portal https://ui.coopedu.app.br\n3. Clique no favorito para sincronizar em 1 segundo!");
          }}
          draggable
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all cursor-grab active:cursor-grabbing border border-indigo-500/30 select-none"
          title="Arraste este botão para a Barra de Favoritos do seu navegador"
        >
          <Bookmark className="h-4 w-4 fill-white/20" />
          <span className="flex items-center gap-1.5"><Zap className="h-4 w-4" /> Arraste para os Favoritos: Sincronizar SIC</span>
        </a>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-sm transition-all"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-600" />
              <span className="text-emerald-700">Código Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 text-slate-500" />
              <span>Copiar Código do Favorito</span>
            </>
          )}
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-indigo-100 text-[11px] text-slate-600 space-y-1.5">
        <p className="font-semibold text-slate-700 flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
          Como usar no dia a dia:
        </p>
        <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-600 leading-relaxed">
          <li>
            Arraste o botão roxo acima para a sua <strong>Barra de Favoritos</strong> (pressione <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-800 font-mono">Ctrl + Shift + B</kbd> no Chrome/Edge para exibir a barra).
          </li>
          <li>
            Abra o portal{" "}
            <a
              href="https://ui.coopedu.app.br"
              target="_blank"
              rel="noreferrer"
              className="text-sky-600 font-semibold hover:underline inline-flex items-center gap-0.5"
            >
              ui.coopedu.app.br <ExternalLink className="h-2.5 w-2.5" />
            </a>{" "}
            e faça login normalmente.
          </li>
          <li>
            Clique no favorito <strong>Sincronizar SIC</strong> na barra. O token é lido e sincronizado instantaneamente.
          </li>
          <li>
            O <strong>Auto-Refresh</strong> do servidor manterá a sessão renovada a cada 25 minutos automaticamente enquanto estiver ativo!
          </li>
        </ol>
      </div>
    </div>
  );
};
