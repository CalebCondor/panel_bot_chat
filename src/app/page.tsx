"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

const API_BASE = "/api/proxy";

type ContentBlock = { type: string; text?: string;[key: string]: unknown };

type Message = {
  role: string;
  content: string | ContentBlock | ContentBlock[];
  created_at?: string;
  [key: string]: unknown;
};

function extractText(content: Message["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b.text === "string" ? b.text : ""))
      .join("");
  }
  if (typeof content === "object" && content !== null) {
    return typeof content.text === "string" ? content.text : JSON.stringify(content);
  }
  return "";
}


type UserEntry = { chat_id: string; fechas: string[] };

type UsersResponse = {
  success: boolean;
  total: number;
  user_ids: UserEntry[];
};

type UserChatResponse = {
  success: boolean;
  chat_id: number;
  total: number;
  messages: Message[];
};

function roleLabel(role: string): string {
  if (role === "human" || role === "user") return "Usuario";
  if (role === "ai" || role === "assistant") return "Dr. Recetas";
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
  });
}

export default function Home() {
  const [userIds, setUserIds] = useState<UserEntry[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);
  const [errorChat, setErrorChat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalMessages, setTotalMessages] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ chatId: string; fecha: string } | null>(null);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const chatTopRef = useRef<HTMLDivElement>(null);
  const [currentTab, setCurrentTab] = useState<"conversaciones" | "chat" | "aprendizaje">("conversaciones");
  const [simMessages, setSimMessages] = useState<{ role: "user" | "bot", text: string }[]>([
    { role: "bot", text: "¡Hola! Soy el simulador de Dr. Recetas. ¿En qué te puedo ayudar hoy?" }
  ]);
  const [simInput, setSimInput] = useState("");

  const toggleDate = (fecha: string) =>
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(fecha)) {
        next.delete(fecha);
      } else {
        next.add(fecha);
      }
      return next;
    });

  useEffect(() => {
    fetch(`${API_BASE}/chat/users`)
      .then((r) => r.json())
      .then((data: UsersResponse) => {
        if (data.success) setUserIds(data.user_ids);
        else setErrorUsers("Error al cargar usuarios");
      })
      .catch(() => setErrorUsers("No se pudo conectar con la API"))
      .finally(() => setLoadingUsers(false));
  }, []);

  const loadChat = useCallback((userId: string) => {
    setSelectedUser(userId);
    setShowSidebar(false);
    setMessages([]);
    setTotalMessages(0);
    setLoadingChat(true);
    setErrorChat(null);
    fetch(`${API_BASE}/chat/user/${userId}`)
      .then((r) => r.json())
      .then((data: UserChatResponse) => {
        if (data.success) {
          setMessages(data.messages);
          setTotalMessages(data.total);
        } else {
          setErrorChat("Error al cargar mensajes");
        }
      })
      .catch(() => setErrorChat("No se pudo cargar el chat"))
      .finally(() => setLoadingChat(false));
  }, []);

  useEffect(() => {
    if (!loadingChat) {
      chatTopRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages, loadingChat]);

  const deleteChat = useCallback(async (chatId: string, fecha: string) => {
    const key = `${chatId}|${fecha}`;
    setDeletingKey(key);
    setConfirmDelete(null);
    try {
      const res = await fetch(`${API_BASE}/chat/user/${chatId}/fecha/${fecha}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setUserIds((prev) =>
          prev
            .map((u) =>
              u.chat_id === chatId
                ? { ...u, fechas: u.fechas.filter((f) => f !== fecha) }
                : u
            )
            .filter((u) => u.fechas.length > 0)
        );
        if (selectedUser === chatId) {
          setSelectedUser(null);
          setMessages([]);
          setShowSidebar(true);
        }
      }
    } finally {
      setDeletingKey(null);
    }
  }, [selectedUser]);

  const groupedByDate = useMemo(() => {
    const filtered = userIds.filter((u) =>
      u.chat_id.includes(searchQuery.trim())
    );
    const map: Record<string, UserEntry[]> = {};
    for (const user of filtered) {
      for (const fecha of user.fechas) {
        if (!map[fecha]) map[fecha] = [];
        map[fecha].push(user);
      }
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [userIds, searchQuery]);

  const initializedCollapse = useRef(false);

  function buildSummary(): string {
    const userMsgs = messages.filter((m) => roleIsUser(m.role));
    const botMsgs = messages.filter((m) => !roleIsUser(m.role));
    const dates = messages
      .filter((m) => m.created_at)
      .map((m) => new Date(m.created_at as string));
    const first = dates.length ? dates[0].toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : null;
    const last = dates.length > 1 ? dates[dates.length - 1].toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : null;
    const lines: string[] = [
      `📋 Resumen de conversación`,
      `Chat ID: ${selectedUser}`,
      first ? `Inicio: ${first}` : "",
      last ? `Fin: ${last}` : "",
      `Mensajes del usuario: ${userMsgs.length}`,
      `Respuestas del bot: ${botMsgs.length}`,
      "",
      "─── Turnos ───",
      ...messages
        .filter((m) => extractText(m.content).trim())
        .map((m, i) => `${i + 1}. [${roleLabel(m.role)}] ${extractText(m.content).trim().slice(0, 150)}`),
    ];
    return lines.filter((l) => l !== undefined && !(lines.indexOf(l) > 0 && l === "")).join("\n");
  }
  useEffect(() => {
    if (!initializedCollapse.current && groupedByDate.length > 1) {
      initializedCollapse.current = true;
      setCollapsedDates(new Set(groupedByDate.slice(1).map(([fecha]) => fecha)));
    }
  }, [groupedByDate]);

  return (
    <div className="flex flex-col h-screen bg-zinc-100">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 md:px-6 py-4 bg-white border-b border-zinc-200 shrink-0 shadow-sm">
        {/* Mobile back button */}
        {selectedUser !== null && !showSidebar && (
          <button
            onClick={() => setShowSidebar(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-zinc-100 text-zinc-500 md:hidden shrink-0"
            aria-label="Volver"
          >
            &#8592;
          </button>
        )}
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500 text-white font-bold text-sm shrink-0">
          DR
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-zinc-900 leading-tight truncate">
            Dr. Recetas Bot
          </h1>
          <p className="text-xs text-zinc-500">Panel de conversaciones</p>
        </div>
        <div className="ml-auto shrink-0">
          {!loadingUsers && (
            <span className="text-xs text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200">
              {userIds.length} usuarios
            </span>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 px-4 md:px-6 bg-white border-b border-zinc-200 shrink-0 shadow-sm overflow-x-auto">
        <button
          onClick={() => setCurrentTab("conversaciones")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap mt-1 ${currentTab === "conversaciones" ? "border-emerald-500 text-emerald-600" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"}`}
        >
          Conversaciones
        </button>
        <button
          onClick={() => setCurrentTab("chat")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap mt-1 ${currentTab === "chat" ? "border-emerald-500 text-emerald-600" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"}`}
        >
          Chatear con el Bot
        </button>
        <button
          onClick={() => setCurrentTab("aprendizaje")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap mt-1 ${currentTab === "aprendizaje" ? "border-emerald-500 text-emerald-600" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"}`}
        >
          Aprendizaje
        </button>
      </div>

      {/* Body */}
      {currentTab === "conversaciones" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — Users List: always visible on md+, toggled on mobile */}
          <aside
            className={`flex flex-col shrink-0 bg-white border-r border-zinc-200 ${showSidebar ? "flex" : "hidden"
              } md:flex w-full md:w-72`}
          >
            <div className="p-3 border-b border-zinc-100">
              <input
                type="text"
                placeholder="Buscar usuario…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-100 text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-emerald-400 border border-zinc-200"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-16 text-zinc-400 text-sm">
                  Cargando usuarios…
                </div>
              ) : errorUsers ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 px-4 text-center">
                  <span className="text-zinc-400 text-sm">{errorUsers}</span>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-xs text-emerald-600 hover:underline"
                  >
                    Reintentar
                  </button>
                </div>
              ) : groupedByDate.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-zinc-400 text-sm">
                  Sin resultados
                </div>
              ) : (
                groupedByDate.map(([fecha, users]) => {
                  const isCollapsed = collapsedDates.has(fecha);
                  return (
                    <div key={fecha}>
                      <button
                        onClick={() => toggleDate(fecha)}
                        className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-zinc-500 capitalize bg-zinc-50 border-b border-zinc-100 sticky top-0 hover:bg-zinc-100 transition-colors"
                      >
                        <span>{formatDate(fecha)}</span>
                        <span className={`transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </button>
                      {!isCollapsed && users.map((user, idx) => (
                        <div
                          key={user.chat_id}
                          className={`flex items-center w-full border-l-2 transition-colors text-sm group ${selectedUser === user.chat_id
                            ? "bg-emerald-50 border-emerald-500"
                            : "border-transparent hover:bg-zinc-50"
                            }`}
                        >
                          <button
                            onClick={() => loadChat(user.chat_id)}
                            className={`flex items-center gap-3 flex-1 min-w-0 px-4 py-3 text-left ${selectedUser === user.chat_id
                              ? "text-emerald-700 font-medium"
                              : "text-zinc-700"
                              }`}
                          >
                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 text-xs font-semibold shrink-0">
                              {idx + 1}
                            </div>
                            <span className="truncate">Conversación {idx + 1}</span>
                          </button>
                          {confirmDelete?.chatId === user.chat_id && confirmDelete?.fecha === fecha ? (
                            <div className="flex items-center gap-1 pr-2 shrink-0">
                              <button
                                onClick={() => deleteChat(user.chat_id, fecha)}
                                disabled={deletingKey === `${user.chat_id}|${fecha}`}
                                className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                              >
                                {deletingKey === `${user.chat_id}|${fecha}` ? "…" : "Sí"}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="text-xs px-2 py-1 rounded bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete({ chatId: user.chat_id, fecha })}
                              className="opacity-0 group-hover:opacity-100 mr-2 p-1.5 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-opacity shrink-0"
                              aria-label="Eliminar"
                              title={`Eliminar mensajes del ${fecha}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Main — Chat View: hidden on mobile when sidebar is showing */}
          <main
            className={`flex-col flex-1 overflow-hidden bg-zinc-50 ${showSidebar ? "hidden md:flex" : "flex"
              }`}
          >
            {selectedUser === null ? (
              <div className="flex flex-col items-center justify-center flex-1 text-zinc-400 gap-3">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white border border-zinc-200 text-3xl shadow-sm">
                  💬
                </div>
                <p className="text-sm">Selecciona un usuario para ver su conversación</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 px-4 md:px-6 py-3 bg-white border-b border-zinc-200 shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold shrink-0">
                    {String(selectedUser).slice(-2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      Usuario {selectedUser}
                    </p>
                    {!loadingChat && (
                      <p className="text-xs text-zinc-500">
                        {totalMessages} mensaje{totalMessages !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  {!loadingChat && messages.length > 0 && (
                    <button
                      onClick={() => setShowSummary(true)}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                      Resumen
                    </button>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto py-4 md:py-6">
                  <div className="max-w-4xl mx-auto px-3 md:px-6 space-y-3">
                    <div ref={chatTopRef} />
                    {loadingChat ? (
                      <div className="flex items-center justify-center py-20 text-zinc-400 text-sm">
                        Cargando mensajes…
                      </div>
                    ) : errorChat ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
                        <span className="text-zinc-400 text-sm">{errorChat}</span>
                        <button
                          onClick={() => loadChat(selectedUser)}
                          className="text-xs text-emerald-600 hover:underline"
                        >
                          Reintentar
                        </button>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center py-20 text-zinc-400 text-sm">
                        Sin mensajes
                      </div>
                    ) : (
                      messages.map((msg, i) => {
                        const isUser = roleIsUser(msg.role);
                        const text = extractText(msg.content).trim();
                        if (!text) return null;
                        const botHtml = !isUser
                          ? DOMPurify.sanitize(marked.parse(text) as string)
                          : null;
                        return (
                          <div
                            key={i}
                            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] md:max-w-[75%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"
                                }`}
                            >
                              <span className="text-xs text-zinc-400 px-1">
                                {roleLabel(msg.role)}
                              </span>
                              {botHtml ? (
                                <div
                                  className="prose prose-sm prose-zinc max-w-none px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-zinc-200 shadow-sm
                                  prose-p:text-zinc-700 prose-p:leading-relaxed prose-p:my-1.5
                                  prose-headings:font-semibold prose-headings:text-zinc-800
                                  prose-strong:text-zinc-800 prose-strong:font-semibold
                                  prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
                                  prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                                  prose-code:text-emerald-700 prose-code:bg-emerald-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
                                  prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-pre:rounded-xl prose-pre:text-xs
                                  prose-blockquote:border-l-4 prose-blockquote:border-emerald-400 prose-blockquote:text-zinc-500 prose-blockquote:not-italic"
                                  dangerouslySetInnerHTML={{ __html: botHtml }}
                                />
                              ) : (
                                <div
                                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap wrap-break-word ${isUser
                                    ? "bg-emerald-500 text-white rounded-br-sm"
                                    : "bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm shadow-sm"
                                    }`}
                                >
                                  {text}
                                </div>
                              )}
                              {msg.created_at && (
                                <span className="text-xs text-zinc-400 px-1">
                                  {new Date(msg.created_at).toLocaleString("es-MX", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={undefined} />
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {currentTab === "chat" && (
        <div className="flex flex-1 flex-col bg-zinc-50 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {simMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] md:max-w-[75%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <span className="text-xs text-zinc-400 px-1">{msg.role === "user" ? "Tú" : "Bot (Simulador)"}</span>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "bg-emerald-500 text-white rounded-br-sm" : "bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm shadow-sm"}`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border-t border-zinc-200 p-4">
            <form
              className="max-w-3xl mx-auto flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!simInput.trim()) return;
                setSimMessages(prev => [...prev, { role: "user", text: simInput }]);
                setSimInput("");
                setTimeout(() => {
                  setSimMessages(prev => [...prev, { role: "bot", text: "Esta es una respuesta simulada. La conexión con la API se hará pronto." }]);
                }, 1000);
              }}
            >
              <textarea
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
                  }
                }}
                placeholder="Escribe un mensaje..."
                className="flex-1 max-h-32 min-h-[44px] resize-none overflow-y-auto rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 outline-none"
                rows={1}
              />
              <button
                type="submit"
                disabled={!simInput.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {currentTab === "aprendizaje" && (
        <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 p-6 text-center overflow-auto">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mb-4 shadow-sm">
            🧠
          </div>
          <h2 className="text-xl font-semibold text-zinc-800 mb-3">Conocimiento y Aprendizaje</h2>
          <p className="text-sm text-zinc-500 max-w-md mb-6">
            En esta sección visualizarás los datos que el bot está usando, su aprendizaje y su progreso. Se integrará con las APIs que proporciones.
          </p>
          <div className="w-full max-w-4xl bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-40 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center bg-zinc-50">
              <span className="text-zinc-400 text-xs font-semibold">Fuentes de Datos</span>
            </div>
            <div className="h-40 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center bg-zinc-50">
              <span className="text-zinc-400 text-xs font-semibold">Análisis de Entidades</span>
            </div>
            <div className="h-40 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center bg-zinc-50">
              <span className="text-zinc-400 text-xs font-semibold">Métricas de Rendimiento</span>
            </div>
          </div>
        </div>
      )}


      {/* Summary Modal */}
      {showSummary && (() => {
        const visibleMsgs = messages.filter((m) => extractText(m.content).trim());
        const userCount = visibleMsgs.filter((m) => roleIsUser(m.role)).length;
        const botCount = visibleMsgs.filter((m) => !roleIsUser(m.role)).length;
        const dates = visibleMsgs.filter((m) => m.created_at).map((m) => new Date(m.created_at as string));
        const first = dates.length ? dates[0] : null;
        const last = dates.length > 1 ? dates[dates.length - 1] : null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setShowSummary(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Diagrama de conversación</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Chat {selectedUser}</p>
                </div>
                <button
                  onClick={() => setShowSummary(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Stats bar */}
              <div className="flex items-center gap-4 px-5 py-3 bg-zinc-50 border-b border-zinc-100 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  {userCount} del usuario
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  {botCount} del bot
                </span>
                {first && <span>{first.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}{last ? ` → ${last.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}` : ""}</span>}
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="relative">
                  {/* Center axis line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-200 -translate-x-1/2" />

                  <div className="flex flex-col gap-3">
                    {visibleMsgs.map((msg, i) => {
                      const isUser = roleIsUser(msg.role);
                      const text = extractText(msg.content).trim();
                      const snippet = text.length > 120 ? text.slice(0, 120) + "…" : text;
                      const time = msg.created_at
                        ? new Date(msg.created_at as string).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                        : null;
                      return (
                        <div key={i} className={`flex items-start gap-3 relative ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                          {/* Spacer to push to side */}
                          <div className="flex-1" />
                          {/* Node */}
                          <div className={`relative z-10 w-3 h-3 mt-1.5 rounded-full border-2 shrink-0 ${isUser ? "bg-emerald-400 border-emerald-500" : "bg-blue-400 border-blue-500"
                            }`} />
                          {/* Card */}
                          <div className={`flex-1 max-w-[42%] rounded-xl border px-3 py-2 shadow-sm ${isUser
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-blue-50 border-blue-200"
                            }`}>
                            <div className="flex items-center justify-between mb-1 gap-2">
                              <span className={`text-[10px] font-semibold tracking-wide uppercase ${isUser ? "text-emerald-600" : "text-blue-600"
                                }`}>{roleLabel(msg.role)}</span>
                              {time && <span className="text-[10px] text-zinc-400 shrink-0">{time}</span>}
                            </div>
                            <p className="text-xs text-zinc-700 leading-relaxed">{snippet}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-zinc-100 flex justify-end">
                <button
                  onClick={() => navigator.clipboard.writeText(buildSummary())}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                  Copiar resumen
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
