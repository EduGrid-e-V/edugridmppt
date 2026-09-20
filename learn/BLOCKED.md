# Blocked tasks

## T-2.3 through T-2.6 — Remaining MS2 dependency chain
**Blocked on:** T-2.4 consumes the T-2.2 algorithm map, T-2.5 freezes the resulting engine API, and T-2.6 migrates the dashboard to that API. T-2.3's live/simulation mismatch warning also needs the selected engine preset alongside a real hardware frame.
**Ready:** T-1.3 now makes `edugrid-kit` the 1.7064 W default and provides its provenance; T-1.5 now provides complete deterministic scenarios. Those prerequisites no longer block the engine.
**Need:** Resolve T-2.2. Then implement T-2.4, the rescheduled T-1.6 noise, T-2.3 integration, T-2.5 API freeze, and T-2.6 migration in that order.
