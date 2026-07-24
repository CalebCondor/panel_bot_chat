"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { WS_URL } from "@/lib/ws-url";

// ─── Mini Calendar ────────────────────────────────────────────────────────────
const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DAYS_ES = ["L","M","X","J","V","S","D"];

function MiniCalendar({
  year, month, datesWithChats, selected, onSelect, onPrev, onNext,
}: {
  year: number; month: number;
  datesWithChats: Set<string>;
  selected: string | null;
  onSelect: (d: string | null) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  let offset = new Date(year, month, 1).getDay() - 1;
  if (offset < 0) offset = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="px-4 py-3 select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span className="text-sm font-semibold text-slate-700 capitalize">{MONTHS_ES[month]} {year}</span>
        <button onClick={onNext} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_ES.map(d => <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const hasChats = datesWithChats.has(ds);
          const isSel = selected === ds;
          const isToday = ds === todayStr;
          return (
            <button
              key={i}
              onClick={() => hasChats && onSelect(isSel ? null : ds)}
              className={`relative mx-auto w-8 h-8 flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all
                ${isSel ? "bg-[#467173] text-white shadow-sm" : isToday && hasChats ? "bg-[#F2FAEC] text-[#467173] ring-1 ring-[#D9EFB5]" : isToday ? "bg-[#F2FAEC] text-slate-500 ring-1 ring-slate-200" : hasChats ? "text-slate-800 hover:bg-[#D9EFB5] hover:text-[#467173]" : "text-slate-300 cursor-default"}`}
            >
              {day}
              {hasChats && !isSel && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#467173]" />}
            </button>
          );
        })} 
      </div>
    </div>
  );
}

const API_BASE = "https://agente.apidoctorrecetas.com/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type ContentBlock = { type: string; text?: string; [key: string]: unknown };
type KnowledgeEntry = { id: number; pregunta: string; respuesta: string };
type Message = {
  role: string;
  content: string | ContentBlock | ContentBlock[];
  created_at?: string;
  [key: string]: unknown;
};
type UserEntry = { chat_id: string; fechas: string[] };
type UsersResponse = { success: boolean; total: number; user_ids: UserEntry[] };
type UserChatResponse = { success: boolean; chat_id: number; total: number; messages: Message[] };

// ─── Utilities ────────────────────────────────────────────────────────────────
function extractText(content: Message["content"]): string {
  if (typeof content === "string") return content;
  
  if (Array.isArray(content)) return content.map(b => typeof b.text === "string" ? b.text : "").join("");
  if (typeof content === "object" && content !== null) return typeof content.text === "string" ? content.text : JSON.stringify(content);
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
  if (role === "user") return "Usuario";
  if (role === "human") return "Soporte";
  if (role === "ai" || role === "assistant") return "Islandmed";
  return role;
}

function roleIsUser(role: string): boolean { return role === "user"; }
function roleIsHuman(role: string): boolean { return role === "human"; }
function roleIsBot(role: string): boolean { return role === "ai" || role === "assistant"; }

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


export default function Home() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (sessionStorage.getItem("dr_panel_auth") === "1") setIsAuthenticated(true);
      else router.replace("/login");
    }
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem("dr_panel_auth");
    router.replace("/login");
  };

  // ── Data state ──
  const [userIds, setUserIds] = useState<UserEntry[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);
  const [errorChat, setErrorChat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalMessages, setTotalMessages] = useState(0);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ chatId: string; fecha: string } | null>(null);
  const [selectedFecha, setSelectedFecha] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [pauseLoading, setPauseLoading] = useState(false);
  const [pauseStatus, setPauseStatus] = useState<{ paused: boolean; pausado_en?: string; reanudado_en?: string } | null>(null);
  const [pauseError, setPauseError] = useState<string | null>(null);

  const [humanInput, setHumanInput] = useState("");
  const [humanSending, setHumanSending] = useState(false);
  const [humanError, setHumanError] = useState<string | null>(null);

  const [newMessageNotice, setNewMessageNotice] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatTopRef = useRef<HTMLDivElement>(null);
  const urlParamsHandled = useRef(false);

  // ── UI state ──
  const [currentTab, setCurrentTab] = useState<"conversaciones" | "chat" | "aprendizaje">("conversaciones");
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exportingBulk, setExportingBulk] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  // ── Calendar state ──
  const todayInit = new Date();
  const [calYear, setCalYear] = useState(todayInit.getFullYear());
  const [calMonth, setCalMonth] = useState(todayInit.getMonth());
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);

  // ── Chat simulator state ──
  const [simMessages, setSimMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "¡Hola! Soy el simulador de Dr. Recetas. ¿En qué te puedo ayudar hoy?" },
  ]);
  const [simInput, setSimInput] = useState("");
  const [simIsLoading, setSimIsLoading] = useState(false);

  // ── Knowledge state ──
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeEntry[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [newPregunta, setNewPregunta] = useState("");
  const [newRespuesta, setNewRespuesta] = useState("");
  const [savingKnowledge, setSavingKnowledge] = useState(false);

  // ── Derived state ──
  const datesWithChats = useMemo(() => {
    const s = new Set<string>();
    for (const u of userIds) for (const f of u.fechas) s.add(f);
    return s;
  }, [userIds]);

  const totalConversations = useMemo(
    () => userIds.reduce((sum, u) => sum + u.fechas.length, 0),
    [userIds]
  );

  const chatListEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = [...datesWithChats].sort((a, b) => b.localeCompare(a));
    const entries: { chatId: string; fecha: string; idx: number }[] = [];
    let n = 0;
    for (const fecha of sorted) {
      if (selectedCalDate && fecha !== selectedCalDate) continue;
      const users = userIds.filter(
        u => u.fechas.includes(fecha) && (!q || u.chat_id.toLowerCase().includes(q))
      );
      for (const u of users) {
        n++;
        entries.push({ chatId: u.chat_id, fecha, idx: n });
      }
    }
    return entries;
  }, [userIds, searchQuery, selectedCalDate, datesWithChats]);

  const groupedEntries = useMemo(() => {
    if (selectedCalDate) return null;
    const map = new Map<string, typeof chatListEntries>();
    for (const e of chatListEntries) {
      if (!map.has(e.fecha)) map.set(e.fecha, []);
      map.get(e.fecha)!.push(e);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [chatListEntries, selectedCalDate]);

  // ── Calendar navigation ──
  const prevMonth = useCallback(() => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }, [calMonth]);

  const nextMonth = useCallback(() => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }, [calMonth]);

  // ── Data fetching ──
  useEffect(() => {
    fetch(`${API_BASE}/chat/users`)
      .then(r => r.json())
      .then((data: UsersResponse) => {
        if (data.success) setUserIds(data.user_ids);
        else setErrorUsers("Error al cargar usuarios");
      })
      .catch(() => setErrorUsers("No se pudo conectar con la API"))
      .finally(() => setLoadingUsers(false));
  }, []);

  const loadPauseStatus = useCallback(async (chatId: string) => {
    setPauseError(null);
    try {
      const r = await fetch(`${API_BASE}/chat/user/${chatId}/pause-status`);
      const data = await r.json();
      if (data?.success) {
        setPauseStatus({ paused: !!data.paused, pausado_en: data.pausado_en, reanudado_en: data.reanudado_en });
      } else {
        setPauseStatus({ paused: false });
      }
    } catch {
      setPauseStatus({ paused: false });
    }
  }, []);

  const togglePause = useCallback(async () => {
    if (!selectedUser || pauseLoading) return;
    const isPaused = pauseStatus?.paused === true;
    const action = isPaused ? "resume" : "pause";
    const verb = isPaused ? "Devolver al bot" : "Tomar la conversación";
    const desc = isPaused
      ? "La IA volverá a responderle a este usuario."
      : "Tú te harás cargo de responderle a este usuario. La IA no intervendrá hasta que la devuelvas.";
    if (!confirm(`¿${verb} con #${selectedUser.slice(-8)}?\n\n${desc}`)) return;
    setPauseLoading(true);
    setPauseError(null);
    try {
      const r = await fetch(`${API_BASE}/chat/user/${selectedUser}/${action}`, { method: "POST" });
      const data = await r.json();
      if (data?.success) {
        await loadPauseStatus(selectedUser);
      } else {
        setPauseError(data?.error || `No se pudo ${action === "pause" ? "tomar" : "devolver"} la conversación`);
      }
    } catch {
      setPauseError("Error de conexión con la API");
    } finally {
      setPauseLoading(false);
    }
  }, [selectedUser, pauseLoading, pauseStatus, loadPauseStatus]);

  const loadChat = useCallback((userId: string, fecha: string) => {
    setSelectedUser(userId);
    setSelectedFecha(fecha);
    setShowDetailOnMobile(true);
    setMessages([]);
    setTotalMessages(0);
    setLoadingChat(true);
    setErrorChat(null);
    setLinkCopied(false);
    setPauseStatus(null);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `?chat=${encodeURIComponent(userId)}&fecha=${encodeURIComponent(fecha)}`);
    }
    fetch(`${API_BASE}/chat/user/${userId}`)
      .then(r => r.json())
      .then((data: UserChatResponse) => {
        if (data.success) {
          const filtered = data.messages.filter(m => m.created_at ? m.created_at.startsWith(fecha) : true);
          setMessages(filtered);
          setTotalMessages(filtered.length);
        } else setErrorChat("Error al cargar mensajes");
      })
      .catch(() => setErrorChat("No se pudo cargar el chat"))
      .finally(() => setLoadingChat(false));
    loadPauseStatus(userId);
  }, [loadPauseStatus]);

  const sendHumanMessage = useCallback(async () => {
    if (!selectedUser || !humanInput.trim() || humanSending) return;
    setHumanSending(true);
    setHumanError(null);
    const text = humanInput.trim();
    try {
      const r = await fetch(`${API_BASE}/chat/user/${selectedUser}/human-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await r.json();
      if (data?.success) {
        setHumanInput("");
        if (selectedFecha) loadChat(selectedUser, selectedFecha);
      } else {
        setHumanError(data?.error || "No se pudo enviar el mensaje");
      }
    } catch {
      setHumanError("Error de conexión con la API");
    } finally {
      setHumanSending(false);
    }
  }, [selectedUser, selectedFecha, humanInput, humanSending, loadChat]);

  // WebSocket en tiempo real: user-message, human-message, pause-status
  useEffect(() => {
    if (!selectedUser) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    let mounted = true;
    let ws: WebSocket | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        return;
      }
      wsRef.current = ws;

      
      ws.onopen = () => {
        ws?.send(JSON.stringify({ event: "subscribe", data: { chat_id: selectedUser } }));
      };

      ws.onmessage = (ev) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(ev.data) as {
            event?: string;
            data?: { role?: string; content?: unknown; paused?: boolean };
          };
          if (msg.event === "user-message") {
            if (selectedFecha) loadChat(selectedUser, selectedFecha);
            const preview =
              typeof msg.data?.content === "string"
                ? msg.data.content.slice(0, 60)
                : "Nuevo mensaje del usuario";
            setNewMessageNotice(`💬 Usuario: ${preview}${preview.length >= 60 ? "…" : ""}`);
            setTimeout(() => setNewMessageNotice(null), 5000);
          } else if (msg.event === "human-message") {
            if (selectedFecha) loadChat(selectedUser, selectedFecha);
          } else if (msg.event === "pause-status") {
            loadPauseStatus(selectedUser);
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (!mounted) return;
        wsReconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      mounted = false;
      if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current);
      try {
        ws?.send(JSON.stringify({ event: "unsubscribe", data: { chat_id: selectedUser } }));
      } catch {
        /* ignore */
      }
      ws?.close();
    };
  }, [selectedUser, selectedFecha, loadChat, loadPauseStatus]);

  useEffect(() => {
    if (isAuthenticated && !urlParamsHandled.current) {
      urlParamsHandled.current = true;
      const params = new URLSearchParams(window.location.search);
      const chat = params.get("chat");
      const fecha = params.get("fecha");
      if (chat && fecha) loadChat(chat, fecha);
    }
  }, [isAuthenticated, loadChat]);

  useEffect(() => {
    if (!loadingChat) chatTopRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages, loadingChat]);

  const deleteChat = useCallback(async (chatId: string, fecha: string) => {
    const key = `${chatId}|${fecha}`;
    setDeletingKey(key);
    setConfirmDelete(null);
    try {
      const res = await fetch(`${API_BASE}/chat/user/${chatId}/fecha/${fecha}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setUserIds(prev =>
          prev.map(u => u.chat_id === chatId ? { ...u, fechas: u.fechas.filter(f => f !== fecha) } : u)
            .filter(u => u.fechas.length > 0)
        );
        if (selectedUser === chatId && selectedFecha === fecha) {
          setSelectedUser(null);
          setSelectedFecha(null);
          setMessages([]);
          setShowDetailOnMobile(false);
          if (typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname);
        }
      }
    } finally { setDeletingKey(null); }
  }, [selectedUser, selectedFecha]);

  // ── Knowledge ──
  const loadKnowledge = useCallback(() => {
    setLoadingKnowledge(true);
    fetch(`${API_BASE}/chat/conocimiento`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setKnowledgeList(data);
        else if (data.data && Array.isArray(data.data)) setKnowledgeList(data.data);
      })
      .catch(console.error)
      .finally(() => setLoadingKnowledge(false));
  }, []);

  useEffect(() => {
    if (currentTab === "aprendizaje") loadKnowledge();
  }, [currentTab, loadKnowledge]);

  const handleAddKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPregunta.trim() || !newRespuesta.trim()) return;
    setSavingKnowledge(true);
    try {
      const res = await fetch(`${API_BASE}/chat/conocimiento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: newPregunta.trim(), respuesta: newRespuesta.trim() }),
      });
      if (res.ok) { setShowKnowledgeModal(false); setNewPregunta(""); setNewRespuesta(""); loadKnowledge(); }
      else alert("Error al guardar conocimiento");
    } catch (err) { console.error(err); alert("Error de conexión"); }
    finally { setSavingKnowledge(false); }
  };

  // ── Export functions ──
  const exportCurrentChat = useCallback(() => {
    if (!messages.length || !selectedUser || !selectedFecha) return;
    const lines = [
      `╔═══════════════════════════════════════╗`,
      `   EXPORTACIÓN DE CHAT — Islanmed   `,
      `╚═══════════════════════════════════════╝`,
      ``,
      `Chat ID  : ${selectedUser}`,
      `Fecha    : ${selectedFecha}`,
      `Mensajes : ${messages.length}`,
      `Generado : ${new Date().toLocaleString("es-MX")}`,
      ``,
      `────────────────────────────────────────`,
      ``,
    ];
    for (const msg of messages) {
      const text = toPlainText(extractText(msg.content).trim());
      if (!text) continue;
      const time = msg.created_at ? ` [${new Date(msg.created_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}]` : "";
      lines.push(`▸ ${roleLabel(msg.role)}${time}`, text, ``);
    }
    downloadFile(`chat_${selectedUser}_${selectedFecha}.txt`, lines.join("\n"));
    setExportDropdownOpen(false);
  }, [messages, selectedUser, selectedFecha]);

  const exportByDate = useCallback(async (fecha: string) => {
    const users = userIds.filter(u => u.fechas.includes(fecha));
    if (!users.length) return;
    setExportingBulk(true);
    setExportDropdownOpen(false);
    const lines = [
      `╔═══════════════════════════════════════╗`,
      `   EXPORTACIÓN POR FECHA — Islanmed   `,
      `╚═══════════════════════════════════════╝`,
      ``,
      `Fecha          : ${formatDate(fecha)} (${fecha})`,
      `Conversaciones : ${users.length}`,
      `Generado       : ${new Date().toLocaleString("es-MX")}`,
      ``,
      `════════════════════════════════════════`,
    ];
    for (let i = 0; i < users.length; i++) {
      setExportProgress(`Exportando ${i + 1} / ${users.length}…`);
      try {
        const r = await fetch(`${API_BASE}/chat/user/${users[i].chat_id}`);
        const data: UserChatResponse = await r.json();
        if (!data.success) continue;
        const msgs = data.messages.filter(m => m.created_at?.startsWith(fecha));
        lines.push(``, `━━━ Conversación #${i + 1} — ID: ${users[i].chat_id} ━━━`, `Mensajes: ${msgs.length}`, ``);
        for (const msg of msgs) {
          const text = toPlainText(extractText(msg.content).trim());
          if (!text) continue;
          const time = msg.created_at ? ` [${new Date(msg.created_at).toLocaleString("es-MX", { timeStyle: "short" })}]` : "";
          lines.push(`▸ ${roleLabel(msg.role)}${time}`, text, ``);
        }
      } catch { /* skip */ }
    }
    downloadFile(`chats_${fecha}.txt`, lines.join("\n"));
    setExportingBulk(false);
    setExportProgress(null);
  }, [userIds]);

  const exportAllChats = useCallback(async () => {
    setExportingBulk(true);
    setExportDropdownOpen(false);
    const lines = [
      `╔═══════════════════════════════════════╗`,
      `     EXPORTACIÓN TOTAL — Dr. Recetas    `,
      `╚═══════════════════════════════════════╝`,
      ``,
      `Total usuarios  : ${userIds.length}`,
      `Total sesiones  : ${totalConversations}`,
      `Generado        : ${new Date().toLocaleString("es-MX")}`,
      ``,
      `════════════════════════════════════════`,
    ];
    for (let i = 0; i < userIds.length; i++) {
      setExportProgress(`Exportando ${i + 1} / ${userIds.length}…`);
      try {
        const r = await fetch(`${API_BASE}/chat/user/${userIds[i].chat_id}`);
        const data: UserChatResponse = await r.json();
        if (!data.success) continue;
        lines.push(``, `━━━ Chat ${userIds[i].chat_id} ━━━`, `Fechas: ${userIds[i].fechas.join(", ")}`, ``);
        for (const msg of data.messages) {
          const text = toPlainText(extractText(msg.content).trim());
          if (!text) continue;
          const time = msg.created_at ? ` [${new Date(msg.created_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}]` : "";
          lines.push(`▸ ${roleLabel(msg.role)}${time}`, text, ``);
        }
      } catch { /* skip */ }
    }
    downloadFile(`todos_los_chats_${new Date().toISOString().slice(0, 10)}.txt`, lines.join("\n"));
    setExportingBulk(false);
    setExportProgress(null);
  }, [userIds, totalConversations]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-6 h-6 border-2 border-[#467173] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Chat list row (reusable render) ──
  const renderChatRow = (entry: { chatId: string; fecha: string; idx: number }, showDate = false) => {
    const isActive = selectedUser === entry.chatId && selectedFecha === entry.fecha;
    const delKey = `${entry.chatId}|${entry.fecha}`;
    return (
      <div
        key={delKey}
        className={`group flex items-center border-b border-slate-100 transition-colors
          ${isActive ? "bg-[#F2FAEC] border-l-[3px] border-l-emerald-500" : "hover:bg-[#F2FAEC] border-l-[3px] border-l-transparent"}`}
      >
        <button onClick={() => loadChat(entry.chatId, entry.fecha)} className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3.5 text-left">
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl text-xs font-bold shrink-0
            ${isActive ? "bg-[#467173] text-white shadow-sm shadow-[#D9EFB5]" : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600"}`}>
            {entry.idx}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p className={`text-sm font-semibold truncate ${isActive ? "text-[#2d4f51]" : "text-slate-800"}`}>
                Conversación {entry.idx}
              </p>
              {showDate && <span className="text-[10px] text-slate-400 shrink-0">{formatDateShort(entry.fecha)}</span>}
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">#{entry.chatId.slice(-8)}</p>
          </div>
        </button>
        {confirmDelete?.chatId === entry.chatId && confirmDelete?.fecha === entry.fecha ? (
          <div className="flex items-center gap-1 pr-3 shrink-0">
            <button onClick={() => deleteChat(entry.chatId, entry.fecha)} disabled={deletingKey === delKey}
              className="text-[10px] px-2 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 font-medium">
              {deletingKey === delKey ? "…" : "Sí"}
            </button>
            <button onClick={() => setConfirmDelete(null)}
              className="text-[10px] px-2 py-1 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium">
              No
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete({ chatId: entry.chatId, fecha: entry.fecha })}
            className="opacity-0 group-hover:opacity-100 mr-3 p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-all shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#F2FAEC]">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 md:px-6 py-3 bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <img
            src="https://islandmedpr.com/assets/images/logo-islandmed.png"
            alt="Islandmed"
            className="h-9 w-auto object-contain select-none"
          />
        </div>
        {!loadingUsers && (
          <div className="hidden md:flex items-center gap-2 ml-4">
          </div>
        )}
        <div className="ml-auto">
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h7a1 1 0 100-2H4V5h6a1 1 0 100-2H3zm11.707 4.293a1 1 0 010 1.414L13.414 10l1.293 1.293a1 1 0 01-1.414 1.414l-2-2a1 1 0 010-1.414l2-2a1 1 0 011.414 0z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M13 10a1 1 0 011-1h4a1 1 0 110 2h-4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="flex items-center justify-center bg-white border-b border-slate-200 shrink-0 overflow-x-auto px-2">
        {([
          {
            id: "conversaciones",
            label: "Conversaciones",
            icon: (
              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
              </svg>
            ),
          },
          {
            id: "chat",
            label: "Chat con el Bot",
            icon: (
              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 7.5h-9v9h9v-9z" />
                <path fillRule="evenodd" d="M8.25 2.25A.75.75 0 019 3v.75h2.25V3a.75.75 0 011.5 0v.75H15V3a.75.75 0 011.5 0v.75h.75a3 3 0 013 3v.75H21A.75.75 0 0121 9h-.75v2.25H21a.75.75 0 010 1.5h-.75V15H21a.75.75 0 010 1.5h-.75v.75a3 3 0 01-3 3h-.75V21a.75.75 0 01-1.5 0v-.75h-2.25V21a.75.75 0 01-1.5 0v-.75H9V21a.75.75 0 01-1.5 0v-.75h-.75a3 3 0 01-3-3v-.75H3A.75.75 0 013 15h.75v-2.25H3a.75.75 0 010-1.5h.75V9H3a.75.75 0 010-1.5h.75v-.75a3 3 0 013-3h.75V3a.75.75 0 01.75-.75zM6 6.75A.75.75 0 016.75 6h10.5a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V6.75z" clipRule="evenodd" />
              </svg>
            ),
          },
          {
            id: "aprendizaje",
            label: "Aprendizaje",
            icon: (
              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
              </svg>
            ),
          },
        ] as const).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setCurrentTab(id)}
            className={`relative flex items-center gap-2 px-6 py-3.5 text-sm font-semibold transition-all whitespace-nowrap
              ${currentTab === id
                ? "text-[#467173] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-[#467173] after:rounded-full"
                : "text-slate-400 hover:text-slate-600"
              }`}
          >
            <span className={`transition-colors ${currentTab === id ? "text-[#467173]" : "text-slate-400"}`}>
              {icon}
            </span>
            {label}
            {currentTab === id && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#467173]" />
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════ TAB: CONVERSACIONES ══════════════════════ */}
      {currentTab === "conversaciones" && (
        <div className="flex flex-1 overflow-hidden">

          {/* ── Col 1: Calendar + Stats ── */}
          <aside className="hidden lg:flex flex-col w-60 xl:w-64 shrink-0 bg-white border-r border-slate-200 overflow-y-auto">
            <div className="px-4 pt-4 pb-1 flex items-center justify-between">
              <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Calendario</h2>
              {selectedCalDate && (
                <button onClick={() => setSelectedCalDate(null)} className="text-[10px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors">
                  Limpiar
                </button>
              )}
            </div>

            <MiniCalendar
              year={calYear}
              month={calMonth}
              datesWithChats={datesWithChats}
              selected={selectedCalDate}
              onSelect={setSelectedCalDate}
              onPrev={prevMonth}
              onNext={nextMonth}
            />

            {/* Stats */}
            <div className="mx-3 my-2 p-3 rounded-xl bg-[#F2FAEC] border border-slate-100 space-y-2.5">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Estadísticas</h3>
              {[
                { label: "Usuarios únicos", value: userIds.length, color: "text-slate-800" },
                { label: "Sesiones totales", value: totalConversations, color: "text-slate-800" },
                { label: "Días con actividad", value: datesWithChats.size, color: "text-slate-800" },
                ...(selectedCalDate ? [{ label: "Chats en fecha", value: chatListEntries.length, color: "text-[#467173]" }] : []),
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{s.label}</span>
                  <span className={`text-xs font-bold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* Bulk export */}
            <div className="px-3 pb-4 space-y-1.5">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-1 mb-2 mt-1">Exportar</h3>
              {selectedCalDate && (
                <button onClick={() => exportByDate(selectedCalDate)} disabled={exportingBulk}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#467173] bg-[#F2FAEC] hover:bg-[#c8e49a] border border-[#D9EFB5] rounded-xl transition-colors disabled:opacity-50">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <span className="truncate">Exportar {formatDateShort(selectedCalDate)}</span>
                </button>
              )}
              <button onClick={exportAllChats} disabled={exportingBulk}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 bg-[#F2FAEC] hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors disabled:opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Exportar todo
              </button>
              {exportingBulk && exportProgress && (
                <p className="text-[10px] text-slate-400 text-center pt-1 animate-pulse">{exportProgress}</p>
              )}
            </div>
          </aside>

          {/* ── Col 2: Chat List ── */}
          <div className={`flex flex-col shrink-0 bg-white border-r border-slate-200
            ${showDetailOnMobile ? "hidden md:flex" : "flex"}
            w-full md:w-80 xl:w-96`}>

            {/* List header */}
            <div className="px-4 pt-3.5 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-800">Conversaciones</h2>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                    ${selectedCalDate ? "bg-[#D9EFB5] text-[#467173]" : "bg-slate-100 text-slate-600"}`}>
                    {chatListEntries.length}
                  </span>
                </div>

                {/* Export dropdown */}
                <div className="relative">
                  <button onClick={() => setExportDropdownOpen(o => !o)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-[#F2FAEC] hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden sm:inline">Exportar</span>
                  </button>
                  {exportDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setExportDropdownOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1 overflow-hidden">
                        {selectedUser && selectedFecha && (
                          <button onClick={exportCurrentChat} className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-[#F2FAEC] transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#467173] mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                            <div>
                              <p className="text-xs font-semibold text-slate-700">Chat actual</p>
                              <p className="text-[10px] text-slate-400">Exportar como .txt</p>
                            </div>
                          </button>
                        )}
                        {selectedCalDate && (
                          <button onClick={() => exportByDate(selectedCalDate)} disabled={exportingBulk}
                            className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-[#F2FAEC] transition-colors disabled:opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                            </svg>
                            <div>
                              <p className="text-xs font-semibold text-slate-700">Por fecha</p>
                              <p className="text-[10px] text-slate-400">{formatDateShort(selectedCalDate)} · {chatListEntries.length} chats</p>
                            </div>
                          </button>
                        )}
                        <div className="my-1 border-t border-slate-100" />
                        <button onClick={exportAllChats} disabled={exportingBulk}
                          className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-[#F2FAEC] transition-colors disabled:opacity-50">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                          </svg>
                          <div>
                            <p className="text-xs font-semibold text-slate-700">Exportar todo</p>
                            <p className="text-[10px] text-slate-400">{totalConversations} sesiones</p>
                          </div>
                        </button>
                        {exportingBulk && exportProgress && (
                          <p className="px-4 py-2 text-[10px] text-slate-400 animate-pulse border-t border-slate-100">{exportProgress}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <input type="text" placeholder="Buscar por ID…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-[#F2FAEC] border border-slate-200 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#467173] focus:border-transparent transition" />
              </div>

              {/* Active date filter chip */}
              {selectedCalDate && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F2FAEC] border border-[#D9EFB5] rounded-full">
                    <svg className="w-3 h-3 text-[#467173]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-medium text-[#467173] capitalize">{formatDateShort(selectedCalDate)}</span>
                    <button onClick={() => setSelectedCalDate(null)} className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-emerald-200 text-[#467173] font-bold text-xs leading-none transition-colors">×</button>
                  </div>
                </div>
              )}
            </div>

            {/* List body */}
            <div className="flex-1 overflow-y-auto">
              {loadingUsers ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <div className="w-5 h-5 border-2 border-[#467173] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Cargando conversaciones…</span>
                </div>
              ) : errorUsers ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-500">{errorUsers}</p>
                  <button onClick={() => window.location.reload()} className="text-xs text-[#467173] hover:underline font-medium">Reintentar</button>
                </div>
              ) : chatListEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">💬</div>
                  <span className="text-xs">Sin resultados</span>
                </div>
              ) : selectedCalDate ? (
                // Flat list when date filter active
                <div>{chatListEntries.map(e => renderChatRow(e, false))}</div>
              ) : (
                // Grouped by date
                groupedEntries!.map(([fecha, entries]) => (
                  <div key={fecha}>
                    <div className="sticky top-0 bg-white/90 backdrop-blur-sm px-4 py-2 border-b border-slate-100 z-10 flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 capitalize">{formatDate(fecha)}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{entries.length}</span>
                    </div>
                    {entries.map(e => renderChatRow(e, false))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Col 3: Chat Detail (email-style) ── */}
          <main className={`flex-1 flex flex-col overflow-hidden bg-[#F2FAEC] ${showDetailOnMobile ? "flex" : "hidden md:flex"}`}>
            {selectedUser === null ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-5 text-slate-400 px-8">
                <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                  <svg className="w-10 h-10 text-slate-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-600 mb-1">Ninguna conversación seleccionada</p>
                  <p className="text-xs text-slate-400 max-w-xs">Selecciona una fecha en el calendario y elige una conversación de la lista</p>
                </div>
                {datesWithChats.size > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                    {[...datesWithChats].sort((a, b) => b.localeCompare(a)).slice(0, 5).map(d => (
                      <button key={d} onClick={() => setSelectedCalDate(d)}
                        className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full text-slate-600 hover:bg-[#D9EFB5] hover:border-[#D9EFB5] hover:text-[#467173] transition-colors capitalize">
                        {formatDateShort(d)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Email-style detail header */}
                <div className="bg-white border-b border-slate-200 px-5 py-4 shrink-0">
                  <div className="flex items-start gap-3">
                    {/* Mobile back */}
                    <button onClick={() => setShowDetailOnMobile(false)}
                      className="md:hidden mt-1 p-1.5 -ml-1 rounded-lg hover:bg-slate-100 text-slate-500 shrink-0 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    {/* Avatar */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-sm font-bold shrink-0 shadow-sm">
                      {String(selectedUser).slice(-2)}
                    </div>
                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold text-slate-900 truncate">Conversación con #{selectedUser.slice(-8)}</h2>
                        {!loadingChat && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">{totalMessages} mensajes</span>
                        )}
                      </div>
                      {selectedFecha && (
                        <p className="text-xs text-slate-500 mt-0.5 capitalize">{formatDate(selectedFecha)}</p>
                      )}
                    </div>
                    {/* Action buttons */}
                    {!loadingChat && (
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        <button
                          onClick={togglePause}
                          disabled={pauseLoading}
                          title={pauseStatus?.paused ? "Devolver la conversación al bot" : "Tomar la conversación (la IA dejará de responder)"}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors disabled:opacity-60
                            ${pauseStatus?.paused
                              ? "bg-slate-100 border-slate-400 text-slate-700 hover:bg-slate-200"
                              : "bg-white border-slate-200 text-slate-500 hover:bg-[#F2FAEC]"}`}>
                          {pauseLoading ? (
                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : pauseStatus?.paused ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                            </svg>
                          )}
                          <span className="hidden sm:inline">{pauseStatus?.paused ? "Devolver al Agente" : "Tomar conversación"}</span>
                        </button>
                        {messages.length > 0 && (
                        <>
                        <button
                          onClick={() => { navigator.clipboard.writeText(window.location.href); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors
                            ${linkCopied ? "bg-[#F2FAEC] border-[#D9EFB5] text-[#467173]" : "bg-white border-slate-200 text-slate-500 hover:bg-[#F2FAEC]"}`}>
                          {linkCopied
                            ? <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            : <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" /></svg>
                          }
                          <span className="hidden sm:inline">{linkCopied ? "¡Copiado!" : "Enlace"}</span>
                        </button>
                        <button onClick={exportCurrentChat}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#467173] bg-[#F2FAEC] border border-[#D9EFB5] rounded-lg hover:bg-[#c8e49a] transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586L7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                          </svg>
                          <span className="hidden sm:inline">Exportar</span>
                        </button>
                        <button onClick={() => window.open(`/resumen?chat=${encodeURIComponent(selectedUser!)}&fecha=${encodeURIComponent(selectedFecha!)}`, "_blank")}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-[#F2FAEC] transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                          </svg>
                          <span className="hidden sm:inline">Resumen</span>
                        </button>
                        </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {newMessageNotice && (
                  <div className="fixed top-20 right-4 z-50 max-w-xs bg-[#467173] text-white text-xs font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
                    <span className="truncate">{newMessageNotice}</span>
                  </div>
                )}

                {/* Paused banner */}
                {pauseStatus?.paused && (
                  <div className="bg-slate-100 border-b border-slate-300 px-5 py-2.5 shrink-0 flex items-center gap-2 text-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                    </svg>
                    <span className="text-xs font-medium">
                      <strong>Tú estás a cargo</strong> de esta conversación{pauseStatus.pausado_en ? ` desde ${new Date(pauseStatus.pausado_en).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}` : ""}. La IA no responderá hasta que la devuelvas.
                    </span>
                    <button onClick={togglePause} disabled={pauseLoading}
                      className="ml-auto text-xs font-semibold text-[#467173] hover:text-[#355759] underline underline-offset-2 disabled:opacity-50 whitespace-nowrap">
                      Devolver al bot
                    </button>
                  </div>
                )}
                {pauseError && (
                  <div className="bg-red-50 border-b border-red-200 px-5 py-2 shrink-0 text-xs text-red-700">
                    {pauseError}
                  </div>
                )}

                {/* Messages thread */}
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
                    <div ref={chatTopRef} />
                    {loadingChat ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                        <div className="w-6 h-6 border-2 border-[#467173] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Cargando mensajes…</span>
                      </div>
                    ) : errorChat ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                        <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                          <svg className="w-6 h-6 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-sm text-slate-500">{errorChat}</p>
                        <button onClick={() => selectedUser && selectedFecha && loadChat(selectedUser, selectedFecha)}
                          className="text-xs text-[#467173] hover:underline font-medium">Reintentar</button>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Sin mensajes en esta fecha</div>
                    ) : (
                      messages.map((msg, i) => {
                        const isUser = roleIsUser(msg.role);
                        const isHuman = roleIsHuman(msg.role);
                        const isBot = roleIsBot(msg.role);
                        const text = extractText(msg.content).trim();
                        if (!text) return null;
                        const botHtml = isBot ? DOMPurify.sanitize(marked.parse(text) as string) : null;
                        return (
                          <div key={i} className={`flex items-end gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
                            {!isUser && (
                              <div className={`w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 mb-0.5 shadow-sm ${
                                isHuman ? "bg-slate-700" : "bg-gradient-to-br from-emerald-400 to-teal-500"
                              }`}>
                                {isHuman ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  "IS"
                                )}
                              </div>
                            )}
                            <div className={`max-w-[80%] md:max-w-[70%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                              {(isHuman || isBot) && (
                                <span className={`text-[10px] font-semibold uppercase tracking-wider px-1 ${
                                  isHuman ? "text-slate-600" : "text-emerald-600"
                                }`}>
                                  {roleLabel(msg.role)}
                                </span>
                              )}
                              {botHtml ? (
                                <div
                                  className="prose prose-sm prose-slate max-w-none px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-slate-200 shadow-sm
                                    prose-p:text-slate-700 prose-p:leading-relaxed prose-p:my-1.5
                                    prose-headings:font-semibold prose-headings:text-slate-800
                                    prose-strong:text-slate-800
                                    prose-a:text-[#467173] prose-a:no-underline hover:prose-a:underline
                                    prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                                    prose-code:text-[#467173] prose-code:bg-[#F2FAEC] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                                    prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl prose-pre:text-xs
                                    prose-blockquote:border-l-4 prose-blockquote:border-[#a8d08d] prose-blockquote:text-slate-500"
                                  dangerouslySetInnerHTML={{ __html: botHtml }}
                                />
                              ) : (
                                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                                  isUser
                                    ? "bg-[#467173] text-white rounded-br-sm shadow-sm"
                                    : isHuman
                                    ? "bg-slate-700 text-white rounded-bl-sm shadow-sm"
                                    : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                                }`}>
                                  {text}
                                </div>
                              )}
                              {msg.created_at && (
                                <span className="text-[10px] text-slate-400 px-1">
                                  {new Date(msg.created_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                                </span>
                              )}
                            </div>
                            {isUser && (
                              <div className="w-7 h-7 rounded-full bg-[#467173] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mb-0.5">U</div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Human takeover input — visible solo cuando el humano tomó la conversación */}
                {pauseStatus?.paused && (
                  <div className="bg-slate-50 border-t border-slate-200 px-4 md:px-6 py-3 shrink-0">
                    <form
                      className="max-w-3xl mx-auto"
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendHumanMessage();
                      }}
                    >
                      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-300 focus-within:ring-2 focus-within:ring-[#467173] focus-within:border-transparent transition">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0 select-none">
                          Humano
                        </span>
                        <span className="w-px h-5 bg-slate-200 shrink-0" />
                        <textarea
                          value={humanInput}
                          onChange={(e) => { setHumanInput(e.target.value); setHumanError(null); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (humanInput.trim() && !humanSending) sendHumanMessage();
                            }
                          }}
                          disabled={humanSending}
                          placeholder="Escribe una respuesta…"
                          rows={1}
                          className="flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none border-none focus:ring-0 focus:outline-none px-1 py-2 disabled:opacity-60"
                          style={{ minHeight: 0 }}
                        />
                        <button
                          type="submit"
                          disabled={humanSending || !humanInput.trim()}
                          className="h-8 w-8 rounded-full flex items-center justify-center text-white bg-[#467173] hover:bg-[#355759] disabled:bg-slate-300 disabled:cursor-not-allowed transition-all active:scale-90 shrink-0"
                        >
                          {humanSending ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25H10a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.897 28.897 0 0015.293-7.155.75.75 0 000-1.114A28.897 28.897 0 003.105 2.289z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {humanError && (
                        <p className="mt-1.5 text-xs text-red-600 text-center">{humanError}</p>
                      )}
                    </form>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}

      {/* ══════════════════════ TAB: CHAT SIMULATOR ══════════════════════ */}
      {currentTab === "chat" && (
        <div className="flex flex-1 flex-col bg-[#F2FAEC] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 md:px-6 py-4 bg-white border-b border-slate-200 shrink-0 gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Simulador de Chat</h2>
              <p className="text-xs text-slate-500">Prueba cómo responde tu bot en tiempo real.</p>
            </div>
            <button
              onClick={() => { setSimMessages([{ role: "bot", text: "¡Hola! Soy el simulador de Dr. Recetas. ¿En qué te puedo ayudar hoy?" }]); localStorage.removeItem("dr-recetas-sim-id"); setSimInput(""); }}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-[#F2FAEC] transition-colors shadow-sm w-full sm:w-auto shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Limpiar Conversación
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {simMessages.map((msg, i) => {
                const isUser = msg.role === "user";
                const botHtml = !isUser ? DOMPurify.sanitize(marked.parse(msg.text) as string) : null;
                return (
                  <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] md:max-w-[75%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                      <span className="text-xs text-slate-400 px-1">{isUser ? "Tú" : "Bot (Simulador)"}</span>
                      {botHtml ? (
                        <div className="prose prose-sm prose-slate max-w-none px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-slate-200 shadow-sm prose-p:text-slate-700 prose-p:leading-relaxed prose-p:my-1.5 prose-headings:font-semibold prose-headings:text-slate-800 prose-strong:text-slate-800 prose-a:text-[#467173] prose-a:no-underline hover:prose-a:underline prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:text-[#467173] prose-code:bg-[#F2FAEC] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none"
                          dangerouslySetInnerHTML={{ __html: botHtml }} />
                      ) : (
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${isUser ? "bg-[#467173] text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"}`}>{msg.text}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {simIsLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] flex flex-col gap-1 items-start">
                    <span className="text-xs text-slate-400 px-1">Bot (Simulador)</span>
                    <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-slate-200 shadow-sm flex items-center gap-1.5">
                      {[0, 150, 300].map(delay => (
                        <div key={delay} className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white border-t border-slate-200 p-4">
            <form className="max-w-3xl mx-auto flex items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!simInput.trim() || simIsLoading) return;
                const text = simInput;
                setSimMessages(prev => [...prev, { role: "user", text }]);
                setSimInput("");
                setSimIsLoading(true);
                try {
                  let anonId = localStorage.getItem("dr-recetas-sim-id");
                  if (!anonId) { anonId = `${Math.floor(Math.random() * 1000000000)}_${Date.now()}`; localStorage.setItem("dr-recetas-sim-id", anonId); }
                  const rawAnonId = anonId.replace(/[^0-9]/g, "").substring(0, 10);
                  const response = await fetch(`${API_BASE}/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: Number(rawAnonId), message: text.trim() }),
                  });
                  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
                  const data = await response.json();
                  setSimMessages(prev => [...prev, { role: "bot", text: data.success === true && data.response ? data.response : "Lo siento, hubo un error." }]);
                } catch (error) {
                  console.error(error);
                  setSimMessages(prev => [...prev, { role: "bot", text: "Error de conexión." }]);
                } finally { setSimIsLoading(false); }
              }}>
              <textarea value={simInput} onChange={e => setSimInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); } }}
                disabled={simIsLoading} placeholder="Escribe un mensaje..."
                className="flex-1 max-h-32 min-h-[44px] resize-none overflow-y-auto rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base md:text-sm text-slate-900 focus:border-[#467173] focus:outline-none focus:ring-1 focus:ring-[#467173] outline-none disabled:bg-[#F2FAEC] disabled:text-slate-400"
                rows={1} />
              <button type="submit" disabled={!simInput.trim() || simIsLoading}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#467173] text-white transition-colors hover:bg-[#467173] disabled:opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB: APRENDIZAJE ══════════════════════ */}
      {currentTab === "aprendizaje" && (
        <div className="flex flex-1 flex-col bg-[#F2FAEC] overflow-hidden relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 md:px-6 py-4 bg-white border-b border-slate-200 shrink-0 gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Base de Conocimiento</h2>
              <p className="text-xs text-slate-500">Administra la información manual que usa el bot.</p>
            </div>
            <button onClick={() => setShowKnowledgeModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm w-full sm:w-auto shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Añadir Conocimiento
            </button>
          </div>
          <div className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto p-4 md:p-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[600px]">
                <thead className="bg-[#F2FAEC] border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium w-16 text-center">ID</th>
                    <th className="px-5 py-3 font-medium w-1/3">Pregunta</th>
                    <th className="px-5 py-3 font-medium">Respuesta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingKnowledge ? (
                    <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">Cargando conocimiento...</td></tr>
                  ) : knowledgeList.length === 0 ? (
                    <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">No hay elementos aún.</td></tr>
                  ) : (
                    knowledgeList.map(k => (
                      <tr key={k.id} className="hover:bg-[#F2FAEC] transition-colors">
                        <td className="px-5 py-4 text-center text-slate-400 font-medium">#{k.id}</td>
                        <td className="px-5 py-4 text-slate-800 font-medium align-top leading-relaxed">{k.pregunta}</td>
                        <td className="px-5 py-4 text-slate-600 align-top leading-relaxed">{k.respuesta}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showKnowledgeModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#F2FAEC]/50">
                  <h3 className="text-base font-semibold text-slate-900">Añadir Nuevo Conocimiento</h3>
                  <button onClick={() => setShowKnowledgeModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleAddKnowledge} className="flex flex-col p-6 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Pregunta (Regla o Concepto)</label>
                    <textarea value={newPregunta} onChange={e => setNewPregunta(e.target.value)} required rows={2}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Ej. ¿De dónde debo obtener los productos disponibles...?" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Respuesta (Indicación para el Bot)</label>
                    <textarea value={newRespuesta} onChange={e => setNewRespuesta(e.target.value)} required rows={5}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Ej. SIEMPRE debo consultar los productos reales disponibles..." />
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100 pt-5">
                    <button type="button" onClick={() => setShowKnowledgeModal(false)}
                      className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-[#F2FAEC] transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" disabled={savingKnowledge}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                      {savingKnowledge && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      Guardar Conocimiento
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="shrink-0 bg-white border-t border-slate-200 py-2.5">
        <p className="text-center text-[11px] text-slate-400">
          <span className="font-semibold text-[#467173]">Islanmed</span>
          <span className="mx-1.5 text-slate-300">·</span>
          Agente IA · Panel CRM
          <span className="mx-2 text-slate-300">|</span>
          © {new Date().getFullYear()} Online Health. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
