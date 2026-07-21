const $ = (s) => document.querySelector(s);
const DEFAULT_FN_BASE = "https://amhszfvqruzpydqyjlya.supabase.co/functions/v1";
function resolveApiBase() {
  try {
    const fromUrl = new URLSearchParams(location.search).get("api");
    if (fromUrl) {
      localStorage.setItem("api_base", fromUrl);
      return fromUrl.replace(/\/+$/, "");
    }
    const stored = localStorage.getItem("api_base");
    if (stored) return stored.replace(/\/+$/, "");
  } catch {}
  return DEFAULT_FN_BASE;
}
const API_BASE = resolveApiBase();
window.addEventListener("error", (e) => {
  try {
    alert("JS ошибка: " + (e.message || e.error || e));
  } catch {}
});
let initData = "";
const inTelegram = !!(window.Telegram && window.Telegram.WebApp);
if (inTelegram) {
  window.Telegram.WebApp.ready();
  initData = window.Telegram.WebApp.initData || "";
}

let currentAdminId = "";
function authBody() {
  return inTelegram && initData
    ? { init_data: initData }
    : { user_id: currentAdminId };
}
async function pjson(action, extra) {
  const body = Object.assign(authBody(), { action }, extra || {});
  const res = await fetch(API_BASE + "/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

// --- Theme (admin) ---
function applyAdminTheme(t) {
  document.documentElement.setAttribute("data-theme", t || "dark");
  document
    .querySelectorAll("#adminThemeToggle .theme-dot")
    .forEach((d) => d.classList.toggle("active", d.dataset.t === t));
  try {
    localStorage.setItem("admin_theme", t || "dark");
  } catch {}
}
let adminTheme = "dark";
try {
  const saved = localStorage.getItem("admin_theme");
  if (
    saved &&
    ["dark", "light", "midnight", "aurora", "sunset"].includes(saved)
  ) {
    adminTheme = saved;
  } else if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    adminTheme = "light";
  }
} catch {}
applyAdminTheme(adminTheme);
document.getElementById("adminThemeToggle").addEventListener("click", (e) => {
  const dot = e.target.closest(".theme-dot");
  if (!dot) return;
  adminTheme = dot.dataset.t || "dark";
  applyAdminTheme(adminTheme);
});

async function doLogin() {
  $("#login_err").textContent = "запрос к серверу…";
  let data;
  try {
    data = await pjson("summary");
  } catch (e) {
    $("#login_err").textContent = "⚠️ сетевая ошибка: " + String(e);
    return;
  }
  if (!data.ok) {
    $("#login_err").textContent = "⛔ " + (data.error || JSON.stringify(data));
    return;
  }
  if (data.admin_id) currentAdminId = String(data.admin_id);
  $("#login").style.display = "none";
  $("#app").style.display = "block";
  loadAll();
}
async function boot() {
  if (!inTelegram && !initData) {
    $("#login_err").textContent =
      "⛔ Откройте админ-панель внутри Telegram (через бота).";
    return;
  }
  await doLogin();
}
boot();

async function loadAll() {
  const [s, u, w] = await Promise.all([
    pjson("summary"),
    pjson("users"),
    pjson("whitelist", { sub_action: "list" }).catch(() => ({ ok: false })),
  ]);
  if (s.ok) renderSummary(s);
  if (u.ok) renderUsers(u.users);
  if (w.ok) renderWhitelist(w.whitelist);
}

function renderSummary(s) {
  const cards = [
    ["Пользователей", s.users_total],
    ["В белом списке", s.whitelisted],
    ["Всего сообщений", s.messages_total],
    ["Всего токенов", s.tokens_total],
  ];
  $("#summary").innerHTML = cards
    .map(
      ([l, n]) =>
        `<div class="card"><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`,
    )
    .join("");
  const line = (title, arr) =>
    `<span class="muted">${title}: ${arr && arr.length ? arr.length + " актив." : "нет"}</span>`;
  $("#statsExtra").innerHTML =
    line("24ч", s.stats_24h) + " &nbsp; " + line("7д", s.stats_7d);
}

function keysHtml(keys) {
  if (!keys) return '<span class="muted">—</span>';
  const order = ["openrouter", "gemini", "venice"];
  const entries = order
    .filter((p) => keys[p])
    .map((p) => [p, keys[p]])
    .concat(Object.entries(keys).filter(([p]) => !order.includes(p)));
  if (!entries.length) return '<span class="muted">—</span>';
  return entries
    .map(
      ([prov, v]) =>
        `<span class="pill prov">${esc(prov)} ${v && v.has ? "✅" : "—"}</span>`,
    )
    .join(" ");
}

function renderUsers(users) {
  const tb = $("#users tbody");
  tb.innerHTML = users
    .map(
      (u) => `
        <tr>
          <td>${u.is_admin ? '<span class="pill adm">админ</span>' : ""}<span class="mono">${esc(u.user_id)}</span></td>
          <td>${esc(u.provider)}</td>
          <td>${esc(u.model) || "—"}</td>
          <td>${esc(u.context_limit) || "—"}</td>
          <td>${esc(u.message_count) || "0"}</td>
          <td>${esc(u.tokens_total) || "0"}</td>
          <td>${keysHtml(u.keys)}</td>
          <td><div class="btns">
            <button class="btn ghost sm" onclick="usrAction('clear',${u.user_id})">🗑 история</button>
            <button class="btn danger sm" onclick="usrAction('reset',${u.user_id})">♻ сброс</button>
          </div></td>
        </tr>`,
    )
    .join("");
}

async function usrAction(action, uid) {
  if (action === "reset" && !confirm(`Сбросить пользователя ${uid}?`)) return;
  const d = await pjson("user", { sub_action: action, user_id: uid });
  flash(d.ok ? d.message : d.error || "ошибка");
  if (d.ok) loadAll();
}

function renderWhitelist(list) {
  const tb = $("#whitelist tbody");
  if (!list || !list.length) {
    tb.innerHTML = `<tr><td colspan="4" class="muted" style="text-align:center;padding:16px">список пуст</td></tr>`;
    return;
  }
  tb.innerHTML = list
    .map((e) => {
      const isAdmin = e.user_id == ADMIN();
      const type =
        e.access_type === "temporary"
          ? `<span class="pill temp">⏳ временный</span>`
          : `<span class="pill perm">♾️ вечный</span>`;
      let expInfo = "";
      if (e.access_type === "temporary") {
        const ms = expToMs(e.access_expires_at);
        if (ms) {
          const daysLeft = Math.max(0, Math.ceil((ms - Date.now()) / 86400000));
          const d = new Date(ms);
          expInfo = `<div class="muted" style="margin-top:3px">осталось ${daysLeft} дн. (до ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()})</div>`;
        }
      }
      return `<tr>
          <td>${isAdmin ? '<span class="pill adm">админ</span>' : ""}<span class="mono">${esc(e.user_id)}</span></td>
          <td>${type}${expInfo}</td>
          <td>${esc(e.note) || "—"}</td>
          <td><div class="btns">
            <button class="btn ghost sm" onclick="wlNote(${e.user_id})">✏️ пометка</button>
            ${e.access_type === "temporary" && !isAdmin ? `<button class="btn ghost sm" onclick="wlAddDays(${e.user_id})">➕ дни</button>` : ""}
            ${isAdmin ? "" : `<button class="btn danger sm" onclick="wlRemove(${e.user_id})">✕ удалить</button>`}
          </div></td>
        </tr>`;
    })
    .join("");
}
function ADMIN() {
  return Number(currentAdminId);
}
function expToMs(v) {
  if (v == null) return null;
  if (typeof v === "number") return v * 1000;
  const t = Date.parse(v);
  return isNaN(t) ? null : t;
}

async function wlAdd() {
  const user_id = $("#wl_id").value.trim();
  const access_type = $("#wl_type").value;
  const days = access_type === "temporary" ? $("#wl_days").value : null;
  const note = $("#wl_note").value.trim();
  if (!user_id) {
    flash("введи ID", true);
    return;
  }
  const d = await pjson("whitelist", {
    sub_action: "add",
    user_id,
    access_type,
    days,
    note,
  });
  flash(d.ok ? "добавлено" : d.error || "ошибка");
  if (d.ok) {
    $("#wl_id").value = "";
    $("#wl_note").value = "";
    loadAll();
  }
}
async function wlAddDays(uid) {
  const days = prompt("Сколько дней добавить?");
  if (days === null) return;
  const d = Number(days);
  if (isNaN(d) || d <= 0) {
    flash("введи положительное число дней", true);
    return;
  }
  const r = await pjson("whitelist", {
    sub_action: "add_days",
    user_id: uid,
    days: d,
  });
  flash(r.ok ? `добавлено ${d} дн.` : r.error || "ошибка");
  if (r.ok) loadAll();
}
async function wlRemove(uid) {
  if (!confirm(`Удалить ${uid} из белого списка?`)) return;
  const d = await pjson("whitelist", { sub_action: "remove", user_id: uid });
  flash(d.ok ? d.message : d.error || "ошибка");
  if (d.ok) loadAll();
}
async function wlNote(uid) {
  const note = prompt("Новая пометка:");
  if (note === null) return;
  const d = await pjson("whitelist", {
    sub_action: "note",
    user_id: uid,
    note,
  });
  flash(d.ok ? "сохранено" : d.error || "ошибка");
  if (d.ok) loadAll();
}
async function resetAll() {
  if (!confirm("Сбросить ВСЕХ пользователей? Белый список сохранится.")) return;
  const d = await pjson("reset_all", {});
  flash(d.ok ? d.message : d.error || "ошибка");
  if (d.ok) loadAll();
}

$("#wl_type").addEventListener("change", (e) => {
  $("#wl_days").style.display =
    e.target.value === "temporary" ? "inline" : "none";
});

function flash(t, isErr) {
  const m = $("#msg");
  m.textContent = t;
  m.className = isErr ? "err flash" : "ok flash";
  setTimeout(() => {
    m.textContent = "";
    m.className = "muted";
  }, 2500);
}
