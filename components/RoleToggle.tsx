"use client";

import { useEffect, useState } from "react";

export type Role = "resident" | "officer";
const KEY = "civictrack-role";
const EVENT = "civictrack-role";

/** In-memory copy, so the toggle still works when localStorage is blocked. */
let current: Role | null = null;

function readRole(): Role {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "officer" || stored === "resident") return stored;
  } catch {
    // storage blocked: fall back to the in-memory value
  }
  return current ?? "resident";
}

export function setRole(next: Role) {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // storage blocked: the in-memory value still applies until reload
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Reads the demo role. There is no access control: the toggle only changes what the UI shows. */
export function useRole(): Role {
  const [role, setRoleState] = useState<Role>("resident");
  useEffect(() => {
    const read = () => setRoleState(readRole());
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);
  return role;
}

export function RoleToggle() {
  const role = useRole();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" title="Demo only: no access control">
      <span className="text-black/60">View as</span>
      {(["resident", "officer"] as const).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRole(r)}
          aria-pressed={role === r}
          className={`px-2 py-1 rounded border ${role === r ? "bg-black text-white border-black" : "border-black/20"}`}
        >
          {r === "resident" ? "Resident" : "Officer"}
        </button>
      ))}
      <span className="text-xs text-black/50">(demo only, no access control)</span>
    </div>
  );
}
