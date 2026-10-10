"use client";

import { useEffect, useState } from "react";

export type Role = "resident" | "officer";
const KEY = "civictrack-role";

/** Reads the demo role. There is no access control: the toggle only changes what the UI shows. */
export function useRole(): Role {
  const [role, setRole] = useState<Role>("resident");
  useEffect(() => {
    const read = () => {
      try {
        setRole(localStorage.getItem(KEY) === "officer" ? "officer" : "resident");
      } catch {
        // storage blocked: stay in resident view
      }
    };
    read();
    window.addEventListener("civictrack-role", read);
    return () => window.removeEventListener("civictrack-role", read);
  }, []);
  return role;
}

export function RoleToggle() {
  const role = useRole();
  const set = (next: Role) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event("civictrack-role"));
  };
  return (
    <div className="flex items-center gap-2 text-sm" title="Demo only: no access control">
      <span className="text-black/60">View as</span>
      {(["resident", "officer"] as const).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => set(r)}
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
