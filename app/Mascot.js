"use client";

import { useEffect, useState } from "react";

/**
 * Chotu — a friendly little padlock who talks.
 * The mood prop drives the face + the CSS animation:
 *   "idle"    -> gentle bobbing
 *   "think"   -> wiggling while work is going on
 *   "happy"   -> a happy hop + blush cheeks
 *   "worried" -> a worried shake
 */
export default function Mascot({ mood = "idle", message = "", tone = "" }) {
  const [blink, setBlink] = useState(false);

  // Random, natural-looking blinking.
  useEffect(() => {
    let closeTimer;
    let loopTimer;
    const schedule = () => {
      loopTimer = setTimeout(() => {
        setBlink(true);
        closeTimer = setTimeout(() => {
          setBlink(false);
          schedule();
        }, 140);
      }, 2200 + Math.random() * 2600);
    };
    schedule();
    return () => {
      clearTimeout(loopTimer);
      clearTimeout(closeTimer);
    };
  }, []);

  const eyeColor = "#0f2a22";

  return (
    <div className={`mascot mascot-${mood}`}>
      {message ? (
        <div
          className={`speech${tone ? ` speech-${tone}` : ""}`}
          key={message}
          role="status"
          aria-live="polite"
        >
          <span className="speech-tail" aria-hidden="true" />
          {message}
        </div>
      ) : null}

      <svg
        className="mascot-svg"
        viewBox="0 0 120 120"
        width="96"
        height="96"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="mascotBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3c8674" />
            <stop offset="1" stopColor="#25604f" />
          </linearGradient>
        </defs>

        {/* shackle */}
        <path
          d="M38 58 V40 a22 22 0 0 1 44 0 V58"
          fill="none"
          stroke="#2b6a5a"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* body */}
        <rect x="26" y="52" width="68" height="60" rx="17" fill="url(#mascotBody)" />
        <ellipse cx="45" cy="65" rx="16" ry="8" fill="#ffffff" opacity="0.1" />

        {/* shy blush when happy */}
        {mood === "happy" && (
          <>
            <ellipse cx="40" cy="93" rx="7" ry="4" fill="#f4a7a1" opacity="0.75" />
            <ellipse cx="80" cy="93" rx="7" ry="4" fill="#f4a7a1" opacity="0.75" />
          </>
        )}

        {/* eyes */}
        {mood === "happy" ? (
          <>
            <path
              d="M41 82 q6 -7 12 0"
              fill="none"
              stroke={eyeColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M67 82 q6 -7 12 0"
              fill="none"
              stroke={eyeColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        ) : blink ? (
          <>
            <line x1="42" y1="80" x2="52" y2="80" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" />
            <line x1="68" y1="80" x2="78" y2="80" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="47" cy="80" r="9" fill="#ffffff" />
            <circle cx="73" cy="80" r="9" fill="#ffffff" />
            <circle
              cx={mood === "worried" ? 45 : mood === "think" ? 49 : 48}
              cy={mood === "worried" ? 83 : mood === "think" ? 77 : 81}
              r="4.4"
              fill={eyeColor}
            />
            <circle
              cx={mood === "worried" ? 71 : mood === "think" ? 75 : 72}
              cy={mood === "worried" ? 83 : mood === "think" ? 77 : 81}
              r="4.4"
              fill={eyeColor}
            />
          </>
        )}

        {/* eyebrows */}
        {mood === "worried" ? (
          <>
            <path d="M40 69 l11 4" fill="none" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" />
            <path d="M80 69 l-11 4" fill="none" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" />
          </>
        ) : mood === "think" ? (
          <>
            <path d="M41 71 h11" fill="none" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" />
            <path d="M69 66 l11 3" fill="none" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" />
          </>
        ) : null}

        {/* mouth */}
        {mood === "happy" ? (
          <path d="M51 91 q9 10 18 0" fill="none" stroke={eyeColor} strokeWidth="3.2" strokeLinecap="round" />
        ) : mood === "worried" ? (
          <path d="M52 97 q8 -8 16 0" fill="none" stroke={eyeColor} strokeWidth="3.2" strokeLinecap="round" />
        ) : mood === "think" ? (
          <circle cx="60" cy="95" r="3.4" fill={eyeColor} />
        ) : (
          <path d="M53 92 q7 6 14 0" fill="none" stroke={eyeColor} strokeWidth="3.2" strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
}
