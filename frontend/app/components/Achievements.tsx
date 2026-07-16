"use client";

// ============================================================
//  Achievements — grid de logros del perfil (GAM-3).
//  Todo se computa desde datos locales (lib/achievements). Los logros
//  recién desbloqueados desde la última visita reciben la
//  micro-celebración (pop + destello) una sola vez.
// ============================================================

import { useEffect, useState } from "react";
import {
  ACHIEVEMENT_ICONS,
  ACHIEVEMENT_IDS,
  computeAchievements,
  loadSeenAchievements,
  saveSeenAchievements,
  type AchievementId,
} from "../lib/achievements";
import { getRemoteAchievements, pushAchievements } from "../lib/progress";
import type { t } from "../lib/i18n";

export default function Achievements({ tr, playerId }: { tr: ReturnType<typeof t>; playerId?: string }) {
  const [unlocked, setUnlocked] = useState<Record<AchievementId, boolean> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<AchievementId>>(new Set());

  // El cómputo lee localStorage: solo en cliente, una vez por visita al perfil.
  // Con wallet conectada se fusiona con Supabase (cross-device): lo remoto
  // desbloquea aunque este navegador no tenga esas partidas, y lo local nuevo
  // se registra. Sin backend (o sin conexión) todo degrada al dato local.
  useEffect(() => {
    let alive = true;
    const local = computeAchievements();
    const apply = (u: Record<AchievementId, boolean>) => {
      if (!alive) return;
      const seen = loadSeenAchievements();
      setFresh(new Set(ACHIEVEMENT_IDS.filter((id) => u[id] && !seen.includes(id))));
      setUnlocked(u);
      saveSeenAchievements(ACHIEVEMENT_IDS.filter((id) => u[id]));
    };
    if (!playerId) {
      apply(local);
      return;
    }
    void getRemoteAchievements(playerId).then((remote) => {
      const merged = { ...local };
      for (const id of remote) merged[id] = true;
      apply(merged);
      const missing = ACHIEVEMENT_IDS.filter((id) => local[id] && !remote.includes(id));
      void pushAchievements(playerId, missing);
    });
    return () => {
      alive = false;
    };
  }, [playerId]);

  if (!unlocked) return null;

  return (
    <section className="panel p-4">
      <p className="text-[10px] uppercase tracking-widest text-neutral-300 mb-3">
        🎖️ {tr.achievements.title}
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {ACHIEVEMENT_IDS.map((id) => {
          const on = unlocked[id];
          const item = tr.achievements.items[id];
          const state = on ? tr.achievements.unlockedLabel : tr.achievements.lockedLabel;
          return (
            <li
              key={id}
              aria-label={`${item.title}: ${state}`}
              title={item.desc}
              className={`relative rounded-xl border px-2 py-3 text-center ${
                on
                  ? `border-[#fcff52]/40 bg-[#fcff52]/10${fresh.has(id) ? " award-pop" : ""}`
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div aria-hidden className={`text-2xl ${on ? "" : "opacity-40 grayscale"}`}>
                {ACHIEVEMENT_ICONS[id]}
              </div>
              <div className={`text-[10px] font-semibold mt-1 leading-tight ${on ? "text-white" : "text-neutral-400"}`}>
                {item.title}
              </div>
              {/* Candado: el estado no depende solo del color */}
              {!on && (
                <span aria-hidden className="absolute top-1 right-1.5 text-[10px] opacity-70">
                  🔒
                </span>
              )}
              <span className="sr-only">{item.desc}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
