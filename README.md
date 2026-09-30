# Sokoban

A standalone browser puzzle with an easy level 0 (three crates) and 50 classic levels. Serve this directory with any static HTTP server; no build is required.

Use arrows / WASD, the touch pad, or swipes to move. Z undoes, Y redoes, R restarts with confirmation. Every level is available from the level selector. Completing a level triggers a brief gold-and-green celebration before the result dialog; Enter, Space or Escape skips it. Reduced-motion preferences show the result immediately. Progress is saved before the animation starts.

Completed levels and best move/push records are stored in `sokoban_completed_v2`, a persistent first-party cookie with a one-year lifetime renewed while playing, `SameSite=Lax`, and `Secure` on HTTPS. The compact cookie supports all 51 levels. Local storage (`sokoban_progress_v2`) additionally preserves the current level and move history. Either store can preserve completion independently; the interface reports unavailable storage. Clearing site data removes saves.

Legacy `sokoban_progress_v1` saves migrate automatically: original level numbers and records stay associated with the same puzzles after adding level 0.

Tests:

```sh
node sokoban/tests/engine.cjs
# From repository root, in another terminal:
python3 -m http.server 8766 --bind 127.0.0.1
# Requires Playwright and Chromium in the development environment:
node sokoban/tests/browser.cjs
```

See [THIRD_PARTY.md](THIRD_PARTY.md) for puzzle attribution.
