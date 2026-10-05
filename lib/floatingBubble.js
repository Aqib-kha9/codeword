// Capacitor ke native "FloatingBubble" plugin se baat kare ke chhota bridge.
//
// Ii file jaan-boojh ke `@capacitor/core` import NAHI karela — taaki web build
// (Next.js static export) me kouno extra dependency na pade. Jab app Capacitor
// ke Android WebView me chale, tab `window.Capacitor` khud-ba-khud maujood
// rahela, aur native plugin `window.Capacitor.Plugins.FloatingBubble` pe mil
// jaala.

function capacitor() {
  if (typeof window === "undefined") return null;
  return window.Capacitor || null;
}

function plugins() {
  const cap = capacitor();
  if (!cap) return null;
  return cap.Plugins || null;
}

// Native app (Android/iOS) me chal rahal ba ki na — web browser me false.
export function isNative() {
  const cap = capacitor();
  if (!cap) return false;
  try {
    if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
    return cap.isNative === true;
  } catch {
    return false;
  }
}

export function platform() {
  const cap = capacitor();
  if (!cap) return "web";
  try {
    if (typeof cap.getPlatform === "function") return cap.getPlatform();
    return cap.platform || "web";
  } catch {
    return "web";
  }
}

// Floating bubble sirf Android pe ba — iOS pe Apple allow na kare.
export function bubbleSupported() {
  const p = plugins();
  return !!(isNative() && platform() === "android" && p && p.FloatingBubble);
}

async function call(method, fallback) {
  const p = plugins();
  if (!p || !p.FloatingBubble) {
    throw new Error("FloatingBubble plugin na milal — ii feature khali Android app me chale.");
  }
  if (typeof p.FloatingBubble[method] !== "function") {
    return fallback;
  }
  return p.FloatingBubble[method]();
}

// "Display over other apps" permission ba ki na.
export async function checkPermission() {
  try {
    return await call("hasPermission", { granted: false });
  } catch {
    return { granted: false };
  }
}

// Permission mange ke settings screen khol de.
export async function requestPermission() {
  try {
    return await call("requestPermission", { granted: false });
  } catch {
    return { granted: false };
  }
}

// Side ke tairta bubble chalu kar de (foreground service ke saath).
export async function showBubble() {
  return call("show", { showing: true });
}

// Bubble band kar de.
export async function hideBubble() {
  return call("hide", { showing: false });
}
