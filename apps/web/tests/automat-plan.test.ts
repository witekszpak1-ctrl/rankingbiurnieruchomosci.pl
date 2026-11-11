import { describe, expect, it } from "vitest";

import { buildDayPlan, hhmm, slotSummary, warsawAt } from "../lib/automat-plan";

describe("plan dnia automatu", () => {
  const day = "2026-11-11"; // zima: UTC+1
  it("ma 9 sesji Claude, 8 przebiegów GitHub i dane firm o 6:07", () => {
    const plan = buildDayPlan(day, [], new Date("2026-11-10T00:00:00Z"));
    expect(plan.filter((s) => s.kind === "claude").map((s) => hhmm(s.at))).toEqual([
      "06:41", "08:41", "10:41", "12:41", "14:41", "16:41", "18:41", "20:41", "22:41",
    ]);
    expect(plan.filter((s) => s.kind === "pipeline").map((s) => hhmm(s.at))).toEqual([
      "01:17", "04:17", "07:17", "10:17", "13:17", "16:17", "19:17", "22:17",
    ]);
    expect(plan.filter((s) => s.kind === "offers").map((s) => hhmm(s.at))).toEqual(["06:07"]);
    expect(plan.every((s) => s.state === "planned")).toBe(true);
  });

  it("przypisuje przebiegi do pozycji planu i ustala stan", () => {
    const now = warsawAt(day, 11, 0);
    const runs = [
      { id: "1", stage: "probe", status: "ok", counts: { official: 12 }, startedAt: warsawAt(day, 10, 30), finishedAt: warsawAt(day, 10, 50) },
      { id: "2", stage: "verify", status: "running", counts: {}, startedAt: warsawAt(day, 10, 51), finishedAt: null },
      { id: "3", stage: "claude_session", status: "ok", counts: { described: 40, city_list: "Kraków", new_domains: 90 }, startedAt: warsawAt(day, 8, 42), finishedAt: warsawAt(day, 9, 30) },
    ];
    const plan = buildDayPlan(day, runs, now);
    const at = (h: string, kind: string) => plan.find((s) => hhmm(s.at) === h && s.kind === kind)!;
    expect(at("10:17", "pipeline").state).toBe("running");
    expect(at("08:41", "claude").state).toBe("done");
    expect(slotSummary(at("08:41", "claude"))).toBe("opisał 40 firm, szukał w: Kraków (90 stron)");
    expect(at("10:41", "claude").state).toBe("plan_running");
    expect(at("06:41", "claude").state).toBe("waiting_report");
    expect(at("07:17", "pipeline").state).toBe("missed");
    expect(at("13:17", "pipeline").state).toBe("planned");
  });
});
