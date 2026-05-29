"use client";

import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

const API_BASE = "/api/proxy";

type ContentBlock = { type: string; text?: string; [key: string]: unknown };

type Message = {
  role: string;
  content: string | ContentBlock | ContentBlock[];
  created_at?: string;
  [key: string]: unknown;
};

type UserChatResponse = {
  success: boolean;
  chat_id: number;
  total: number;
  messages: Message[];
};

function extractText(content: Message["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((b) => (typeof b.text === "string" ? b.text : "")).join("");
  }
  if (typeof content === "object" && content !== null) {
    return typeof content.text === "string" ? content.text : JSON.stringify(content);
  }
  return "";
}

function toPlainText(markdown: string): string {
  if (typeof document === "undefined") return markdown;
  const html = DOMPurify.sanitize(marked.parse(markdown) as string);
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

function roleLabel(role: string): string {
  if (role === "human" || role === "user") return "Usuario";
  if (role === "ai" || role === "assistant") return "Islamed";
  return role;
}

function roleIsUser(role: string): boolean {
  return role === "human" || role === "user";
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ResumenPage() {
  const [chat, setChat] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chatId = params.get("chat");
    const fechaParam = params.get("fecha");
    setChat(chatId);
    setFecha(fechaParam);

    if (!chatId || !fechaParam) {
      setError("URL inválida. Se requieren los parámetros ?chat=... y &fecha=...");
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/chat/user/${chatId}`)
      .then((r) => r.json())
      .then((data: UserChatResponse) => {
        if (data.success) {
          const filtered = data.messages.filter((m) =>
            m.created_at ? m.created_at.startsWith(fechaParam) : true
          );
          setMessages(filtered);
        } else {
          setError("Error al cargar la conversación.");
        }
      })
      .catch(() => setError("No se pudo conectar con la API."))
      .finally(() => setLoading(false));
  }, []);

  function buildPlainText(): string {
    if (!chat || !fecha) return "";
    const lines: string[] = [
      `CONVERSACIÓN — Islamed`,
      `Chat ID: ${chat}`,
      `Fecha: ${formatDate(fecha)}`,
      `Total de mensajes: ${messages.length}`,
      ``,
      `${"─".repeat(60)}`,
      ``,
    ];
    messages.forEach((m, i) => {
      const text = toPlainText(extractText(m.content).trim());
      if (!text) return;
      const ts = m.created_at
        ? new Date(m.created_at as string).toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;
      lines.push(`[${roleLabel(m.role)}${ts ? ` · ${ts}` : ""}]`);
      lines.push(text);
      if (i < messages.length - 1) lines.push("");
    });
    return lines.join("\n");
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(buildPlainText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const visibleMessages = messages.filter((m) => extractText(m.content).trim());
  const userCount = visibleMessages.filter((m) => roleIsUser(m.role)).length;
  const botCount = visibleMessages.filter((m) => !roleIsUser(m.role)).length;

  return (
    <div className=" bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-zinc-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500 text-white font-bold text-sm shrink-0">
            IS
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-zinc-900 truncate">
              Islamed — Conversación
            </h1>
            {fecha && (
              <p className="text-xs text-zinc-500 truncate capitalize">{formatDate(fecha)}</p>
            )}
          </div>
          {!loading && !error && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  ¡Copiado!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                  Copiar todo
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Meta bar */}
      {!loading && !error && (
        <div className="border-b border-zinc-200 bg-white">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-2.5 flex items-center gap-5 text-xs text-zinc-500">
            <span className="font-mono text-zinc-400">ID: {chat}</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {userCount} del usuario
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              {botCount} del bot
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 md:px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-zinc-400">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Cargando conversación…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
            <div className="text-3xl">⚠️</div>
            <p className="text-sm text-zinc-500 max-w-sm">{error}</p>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-zinc-400">
            <div className="text-3xl">💬</div>
            <p className="text-sm">Sin mensajes para esta fecha.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleMessages.map((msg, i) => {
              const isUser = roleIsUser(msg.role);
              const text = extractText(msg.content).trim();
              const botHtml = !isUser
                ? DOMPurify.sanitize(marked.parse(text) as string)
                : null;
              const ts = msg.created_at
                ? new Date(msg.created_at as string).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null;

              return (
                <div
                  key={i}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] flex flex-col gap-1 ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <span className="text-xs text-zinc-400 px-1 flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isUser ? "bg-emerald-400" : "bg-blue-400"
                        }`}
                      />
                      {roleLabel(msg.role)}
                      {ts && <span className="text-zinc-300">·</span>}
                      {ts && <span>{ts}</span>}
                    </span>

                    {botHtml ? (
                      <div
                        className="prose prose-sm prose-zinc max-w-none px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-zinc-200 shadow-sm
                        prose-p:text-zinc-700 prose-p:leading-relaxed prose-p:my-1.5
                        prose-headings:font-semibold prose-headings:text-zinc-800
                        prose-strong:text-zinc-800 prose-strong:font-semibold
                        prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline
                        prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                        prose-code:text-emerald-700 prose-code:bg-emerald-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                        prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-pre:rounded-xl prose-pre:text-xs
                        prose-blockquote:border-l-4 prose-blockquote:border-emerald-400 prose-blockquote:text-zinc-500 prose-blockquote:not-italic"
                        dangerouslySetInnerHTML={{ __html: botHtml }}
                      />
                    ) : (
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? "bg-emerald-500 text-white rounded-br-sm"
                            : "bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm shadow-sm"
                        }`}
                      >
                        {text}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      {!loading && !error && visibleMessages.length > 0 && (
        <footer className="border-t border-zinc-200 bg-white">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
            <p className="text-xs text-zinc-400">
              {visibleMessages.length} mensaje{visibleMessages.length !== 1 ? "s" : ""}
              {fecha && ` · ${formatDate(fecha)}`}
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors shrink-0"
            >
              {copied ? "¡Copiado!" : "Copiar conversación completa"}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
