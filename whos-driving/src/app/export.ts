import { PROFILES } from "../content/profiles";
import { REBUILD } from "../content/rebuild";
import type { SaboteurId } from "../content/types";
import {
  type PersistedState,
  dateOfDay,
  dayStatus,
  todayLocal,
} from "./state";

export function buildMirrorText(state: PersistedState, dominant: SaboteurId): string {
  const profile = PROFILES[dominant];
  const days = REBUILD[dominant];
  const start = state.rebuild.startDate;
  const lines: string[] = [];
  lines.push("WHO'S DRIVING — MIRROR LOG");
  lines.push(`Dominant saboteur: ${profile.name} (${profile.register})`);
  if (start) lines.push(`Day 1: ${start}`);
  lines.push(`Exported: ${todayLocal()}`);
  lines.push("");
  lines.push("------------------------------------------");

  if (!start) {
    lines.push("");
    lines.push("The rebuild has not started yet.");
    return lines.join("\n");
  }

  for (const day of days) {
    const status = dayStatus(state, day.day);
    if (status === "locked") continue;
    const log = state.rebuild.days[day.day];
    const date = dateOfDay(start, day.day);
    lines.push("");
    lines.push(`DAY ${String(day.day).padStart(2, "0")} — ${date}`);
    if (status === "missed") {
      lines.push("Missed. No entry.");
      lines.push("");
      lines.push("------------------------------------------");
      continue;
    }
    if (log?.intention?.trim()) {
      lines.push(`Intention: ${log.intention.trim()}`);
    }
    if (log?.constraint) {
      lines.push(`Constraint: ${log.constraint === "held" ? "held" : "broken — logged honestly"}`);
    }
    lines.push(`Muhasabah: ${day.muhasabah}`);
    if (log?.muhasabah?.trim()) {
      lines.push(log.muhasabah.trim());
    } else {
      lines.push("(not yet answered)");
    }
    lines.push("");
    lines.push("------------------------------------------");
  }
  return lines.join("\n");
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
