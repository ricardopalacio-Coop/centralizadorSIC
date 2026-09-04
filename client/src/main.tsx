import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Remove acentos de textos na interface visual (exceto inputs, código e PDFs)
const IGNORED_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE"]);

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function processNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || IGNORED_TAGS.has(parent.tagName)) return;
    if (parent.closest(".preserve-text, .preserve-case, .pdf-viewer-modal, [data-preserve-case]")) return;

    const val = node.nodeValue || "";
    if (val.trim()) {
      const cleaned = removeAccents(val);
      if (cleaned !== val) {
        node.nodeValue = cleaned;
      }
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    if (IGNORED_TAGS.has(el.tagName)) return;
    if (el.closest(".preserve-text, .preserve-case, .pdf-viewer-modal, [data-preserve-case]")) return;
    for (let i = 0; i < el.childNodes.length; i++) {
      processNode(el.childNodes[i]);
    }
  }
}

if (typeof window !== "undefined") {
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        m.addedNodes.forEach(processNode);
      } else if (m.type === "characterData") {
        processNode(m.target);
      }
    }
  });

  const rootEl = document.getElementById("root");
  if (rootEl) {
    observer.observe(rootEl, { childList: true, subtree: true, characterData: true });
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

