"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("dr_panel_auth") === "1") {
      router.replace("/");
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Simula un pequeño delay para mejor UX
    setTimeout(() => {
      if (usuario === "admin" && contrasena === "pr@2026") {
        sessionStorage.setItem("dr_panel_auth", "1");
        router.replace("/");
      } else {
        setError("Usuario o contraseña incorrectos.");
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EFF6FF] px-4">
      {/* Card */}
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Top brand band */}
        <div className="flex flex-col items-center justify-center gap-2 bg-[#075aa3] px-6 py-5">
          <img
            src="https://tetrapr.com/wp-content/uploads/2024/10/Logo_TETRA-White.svg"
            alt="Doctor Recetas"
            className="h-10 w-auto object-contain select-none brightness-0 invert"
          />
          <p className="text-[#BFDBFE] text-[10px] font-semibold tracking-widest uppercase">
            Agente IA · Panel de Administración
          </p>
        </div>

        {/* Form area */}
        <div className="px-6 py-5">
          <h2 className="text-base font-bold text-slate-800 mb-0.5">Bienvenido</h2>
          <p className="text-xs text-slate-400 mb-5">Ingresa tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Usuario */}
            <div className="space-y-1">
              <label htmlFor="usuario" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Usuario
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
                  <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </span>
                <input
                  id="usuario"
                  type="text"
                  autoComplete="username"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#075aa3] focus:border-transparent transition text-sm"
                  placeholder="admin"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-1">
              <label htmlFor="contrasena" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
                  <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </span>
                <input
                  id="contrasena"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  required
                  className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#075aa3] focus:border-transparent transition text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-[#075aa3] transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clipRule="evenodd" />
                      <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs">
                <svg className="w-3.5 h-3.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#075aa3] hover:bg-[#355759] disabled:opacity-70 text-white font-semibold rounded-lg transition-colors shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#075aa3] focus:ring-offset-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando…
                </>
              ) : (
                <>
                  Ingresar
                  <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer inside card */}
        <div className="px-6 pb-4 text-center">
          <p className="text-[10px] text-slate-300">
            © {new Date().getFullYear()} Online Health. All Rights Reserved.
          </p>
        </div>

        {/* Bottom accent strip */}
        <div className="h-1 bg-gradient-to-r from-[#BFDBFE] via-[#075aa3] to-[#BFDBFE]" />
      </div>
    </div>
  );
}
