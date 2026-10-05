"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encryptText, decryptText } from "../lib/crypto";
import Mascot from "./Mascot";

// Chotu ke pehlaa line. Ii fix rakhal baakir server aur client ke pehlaa
// render ekke rakhe — hydration mismatch na ho.
const INTRO =
  "Ka haal ba bhaiya? Ham Chotu bani — tohar raaz ke rakhwala. Chithhi likh, ham taala laga deb.";

export default function SafeTextApp() {
  const [input, setInput] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState("");
  const [busyAction, setBusyAction] = useState("");
  // mood: idle | busy | ok | err — ii se Chotu ke chehra aur boli badlela.
  const [mood, setMood] = useState("idle");
  const [speak, setSpeak] = useState(INTRO);
  // Konsa khaana me gadbad ba — uhe laal karke dikha de.
  const [alertField, setAlertField] = useState("");
  // Chhota popup khula ba ki band.
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const busy = !!busyAction;

  // Register the service worker so the app is installable / works offline.
  // Only in production — a service worker during `next dev` can serve a stale
  // page and cause a hydration mismatch.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js?v=4").catch(() => {});
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // Restore a remembered password (kept only in this browser).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("safetext:password");
      if (saved) {
        setPassword(saved);
        setRemember(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Popup khulal to seedha text box me cursor chala jai; Esc dabawe to band.
  useEffect(() => {
    if (open) {
      setTimeout(() => document.getElementById("input")?.focus(), 220);
    }
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const persistPassword = useCallback((value, shouldRemember) => {
    try {
      if (shouldRemember && value) {
        window.localStorage.setItem("safetext:password", value);
      } else {
        window.localStorage.removeItem("safetext:password");
      }
    } catch {
      /* ignore */
    }
  }, []);

  function onRememberChange(checked) {
    setRemember(checked);
    persistPassword(password, checked);
  }

  function onPasswordChange(value) {
    setPassword(value);
    if (remember) persistPassword(value, true);
    if (alertField === "password") setAlertField("");
  }

  function onInputChange(value) {
    setInput(value);
    if (alertField === "input") setAlertField("");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function focusInput() {
    setTimeout(() => document.getElementById("input")?.focus(), 60);
  }

  async function run(action) {
    if (!input.trim()) {
      setSpeak("Arre bhaiya! Pehle text to likh do. Khaali baksaa me ham ka karab?");
      setMood("err");
      setAlertField("input");
      focusInput();
      return;
    }
    if (!password) {
      setSpeak("Ee kaise ho? Password ke bina taala ke chabi kahan se aai? Chabi de do bhaiya!");
      setMood("err");
      setAlertField("password");
      setTimeout(() => document.getElementById("password")?.focus(), 60);
      return;
    }
    setAlertField("");

    setBusyAction(action);
    setMood("busy");
    setSpeak(
      action === "encrypt"
        ? "Ruk bhaiya, taala laga tani…"
        : "Sabari kar bhaiya… taala khol tani…"
    );

    try {
      const output =
        action === "encrypt"
          ? await encryptText(input, password)
          : await decryptText(input, password);

      setResult(output);
      const copied = await copyText(output);
      const line =
        action === "encrypt"
          ? copied
            ? "Ho gel bhaiya! Taala lag gel, copy bhi ho gel. Ja ke paste kar — kehu na khol payi!"
            : "Taala lag gel bhaiya! Niche se copy kar lo."
          : copied
          ? "Khul gel! Password sahi raha bhaiya. Copy bhi ho gel — le ja."
          : "Khul gel bhaiya! Niche se copy kar lo.";
      setSpeak(line);
      setMood("ok");
    } catch (err) {
      setResult("");
      setAlertField("input");
      const line =
        action === "decrypt"
          ? "Hmm… taala na khulal. Password galat ba ki text bigarr gel lagela."
          : err?.message || "Uff! Kuchh gadbad ho gel. Fer se koshish kar bhaiya.";
      setSpeak(line);
      setMood("err");
      focusInput();
    } finally {
      setBusyAction("");
    }
  }

  async function copyResult() {
    if (!result) return;
    const ok = await copyText(result);
    setSpeak(
      ok
        ? "Copy ho gel bhaiya — ab jahan chaaho chipka de."
        : "Copy na bhail. Hath se copy kar lo bhaiya."
    );
  }

  function clearAll() {
    setInput("");
    setResult("");
    setMood("idle");
    setAlertField("");
    setSpeak("Sab saaf! Aagla message le aawa bhaiya.");
    focusInput();
  }

  return (
    <main className="wrap">
      <header className="hero">
        <h1>SafeText</h1>
        <p>
          Tohar baat chori-chori rakhe ke ba? Side ke chhota button daba, taala
          laga de, phir chain se bhej de.
        </p>
      </header>

      {/* Peeche ka dhundhla pardaa — dabawe to popup band. */}
      <div
        className={`drawer-backdrop${open ? " show" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Side me tairta chhota button. Ii dabawe popup khul jai. */}
      <button
        type="button"
        className={`launcher${open ? " hide" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="SafeText khol"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <rect x="4" y="10.5" width="16" height="10" rx="2.4" fill="currentColor" />
          <path
            d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="15.4" r="1.5" fill="#ffffff" />
        </svg>
      </button>

      {/* Side se nikalta chhota popup. */}
      <aside className={`drawer${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="drawer-head">
          <span className="drawer-title">SafeText</span>
          <button
            type="button"
            className="drawer-close"
            onClick={() => setOpen(false)}
            aria-label="Band kar"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="drawer-body">
          <Mascot
            mood={mood}
            message={speak}
            tone={mood === "err" ? "error" : mood === "ok" ? "ok" : ""}
          />

          <div className={`field${alertField === "input" ? " field-error" : ""}`}>
            <label htmlFor="input">Text</label>
            <textarea
              id="input"
              ref={inputRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Hian text chipka de…"
              aria-invalid={alertField === "input"}
            />
          </div>

          <div
            className={`field${alertField === "password" ? " field-error" : ""}`}
          >
            <label htmlFor="password">Password</label>
            <div className="password-row">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="Password likh de…"
                autoComplete="off"
                aria-invalid={alertField === "password"}
              />
              <button
                type="button"
                className="toggle-eye"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Lukaa" : "Dekha"}
              </button>
            </div>
            <label className="remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => onRememberChange(e.target.checked)}
              />
              <span>Browser me yaad rakh</span>
            </label>
          </div>

          <div className="actions actions-main">
            <button
              type="button"
              className="btn btn-primary btn-big"
              onClick={() => run("encrypt")}
              disabled={busy}
            >
              {busyAction === "encrypt"
                ? "Taala laga tani…"
                : "Taala laga (Encrypt)"}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-big"
              onClick={() => run("decrypt")}
              disabled={busy}
            >
              {busyAction === "decrypt"
                ? "Taala khol tani…"
                : "Taala khol (Decrypt)"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={clearAll}>
              Mitaa
            </button>
          </div>

          {result && (
            <div className="field" style={{ marginTop: 18 }}>
              <label htmlFor="output">Result</label>
              <textarea id="output" value={result} readOnly />
              <div className="actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={copyResult}
                >
                  Copy kar
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <footer className="footer">
        <p>
          <strong>Bharosa kar:</strong> AES-256-GCM + PBKDF2 (250k) — puri
          taakat wala taala. Sab kuchh tohar browser me hi hola, kuchh bhi
          bahar na jai.
        </p>
      </footer>
    </main>
  );
}
