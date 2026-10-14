/**
 * Sent to the client on initialize. Short on purpose: it is read on every session.
 */
export const SERVER_INSTRUCTIONS = `Three.js devtools: inspect and tweak a live Three.js / React Three Fiber scene in the browser.

Every tool is labelled with one mode:
- [INSPECT] read-only.
- [LIVE PREVIEW] changes the scene in the browser only. Not saved to source code, lost on reload. Every change is recorded.
- [DEBUG VISUAL] temporary helpers (wireframe, boxes, overlay). Never goes into code.
- [FOR CODE] output to write into the project's source files.

Choosing between "show it now" and "change the code":
- User wants to SEE / TRY / COMPARE ("try red", "what if", "show me") → use LIVE PREVIEW tools, take a screenshot. Say clearly that nothing is saved yet.
- User wants it CHANGED / FIXED / KEPT ("make it red", "fix the shadows") → edit the source code. A live preview first is optional, to verify.
- After a preview the user likes ("keep it", "save") → pending_changes gives the before/after values and code; edit the source, then pending_changes clear=true.
- Unclear → ask once: "preview only, or change the code?"
- Remote apps (set_dev_url) have no source code: previews only.

Tips: start with scene_tree (compact) and targeted *_details tools; use web_audit for websites and capture_frames for videos.`;
