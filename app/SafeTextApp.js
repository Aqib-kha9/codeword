"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encryptText, decryptText } from "../lib/crypto";
import Mascot from "./Mascot";
import {
  bubbleSupported,
  checkPermission,
  requestPermission,
  showBubble,
  hideBubble,
} from "../lib/floatingBubble";

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
  const inputRef = useRef(null);
  // Floating taala (khali native Android app me) ke haal.
  const [bubbleReady, setBubbleReady] = useState(false);
  const [bubbleOn, setBubbleOn] = useState(false);
  const [bubbleNote, setBubbleNote] = useState("");

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

  // Floating taala khali native Android app me chale — web/browser me luko.
  useEffect(() => {
    if (bubbleSupported()) setBubbleReady(true);
  }, []);

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

  // Floating taala chalu/band kare ke chhota kaam.
  async function toggleBubble() {
    try {
      if (bubbleOn) {
        await hideBubble();
        setBubbleOn(false);
        setBubbleNote("Taala hataa del bhaiya.");
        return;
      }
      let perm = await checkPermission();
      if (!perm || !perm.granted) {
        await requestPermission();
        perm = await checkPermission();
      }
      if (!perm || !perm.granted) {
        setBubbleNote(
          "Pahile permission de do bhaiya — settings me 'Display over other apps' chalu kar da, phir fer se daba."
        );
        return;
      }
      await showBubble();
      setBubbleOn(true);
      setBubbleNote(
        "Ho gel! Ab app band kar ke dekho — phone ke side me taala tik-tikai rahi."
      );
    } catch {
      setBubbleNote("Bubble na chalu ho paal — permission band ba ki na?");
    }
  }

  return (
    <main className="wrap">
      <header className="hero">
        <h1>SafeText</h1>
        <p>
          Tohar baat chori-chori rakhe ke ba? Likh de, taala laga de, phir chain
          se bhej de.
        </p>
      </header>

      <section className="card">
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

        {bubbleReady && (
          <div className="bubble-box">
            <div className="bubble-box-head">
              <strong>Floating taala</strong>
              <span className={`bubble-state${bubbleOn ? " on" : ""}`}>
                {bubbleOn ? "Chalu" : "Band"}
              </span>
            </div>
            <p className="bubble-help">
              Chalu kar de, phir app band kar — phone ke side me chhota taala
              tik-tikai rahi. Uhe dabawe SafeText khul jai.
            </p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={toggleBubble}
            >
              {bubbleOn ? "Floating taala band kar" : "Floating taala chalu kar"}
            </button>
            {bubbleNote && <p className="bubble-note">{bubbleNote}</p>}
          </div>
        )}
      </section>

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
