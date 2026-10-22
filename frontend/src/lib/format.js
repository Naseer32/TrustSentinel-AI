export function fmtTime(unix) {
  const n = Number(unix);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return new Date(n * 1000).toLocaleString();
}

export function fmtAgo(unix, nowMs = Date.now()) {
  const n = Number(unix);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = Math.round(nowMs / 1000 - n);
  const abs = Math.abs(d);
  const unit = abs < 60 ? [abs, "s"] : abs < 3600 ? [Math.round(abs / 60), "min"] : abs < 86400 ? [Math.round(abs / 3600), "h"] : [Math.round(abs / 86400), "d"];
  return d >= 0 ? unit[0] + " " + unit[1] + " ago" : "in " + unit[0] + " " + unit[1];
}

export function short(s, head = 6, tail = 4) {
  if (typeof s !== "string" || s.length <= head + tail + 1) return s || "";
  return s.slice(0, head) + "..." + s.slice(-tail);
}

export function cooldownRemaining(lastCheck, cooldown, nowMs = Date.now()) {
  const n = Number(lastCheck);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, n + cooldown - Math.floor(nowMs / 1000));
}

export function isHttps(url) {
  return typeof url === "string" && /^https:\/\//i.test(url);
}
