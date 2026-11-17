import http from "node:http";
import { pathToFileURL } from "node:url";
import { categories as initialCategories, tasks as initialTasks } from "./data.js";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 5505;
const PRIORITIES = new Set(["low", "medium", "high"]);
const FILTER_NAMES = new Set(["completed", "priority", "categoryId", "q"]);

// Создаем изменяемые копии
let categories = JSON.parse(JSON.stringify(initialCategories));
let tasks = JSON.parse(JSON.stringify(initialTasks));
let nextTaskId = 35;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Max-Age": "600",
  };
}

function sendJson(res, status, payload, head = false, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store", ...corsHeaders(), ...extraHeaders });
  res.end(head ? undefined : body);
}

function sendError(res, status, code, message, details, head = false, headers = {}) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  sendJson(res, status, { error }, head, headers);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : null); } catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

// ... (тут должны быть функции parseFilters, selectTasks, parsePositiveId из ПР5) ...
function parseFilters(searchParams) {
  for (const name of searchParams.keys()) { if (!FILTER_NAMES.has(name)) throw new TypeError(`Неизвестный параметр: ${name}.`); }
  const filters = { completed: null, priority: null, categoryId: null, q: "" };
  const completed = searchParams.get("completed");
  if (completed !== null) { if (completed !== "true" && completed !== "false") throw new TypeError("completed должен быть true/false."); filters.completed = completed === "true"; }
  const priority = searchParams.get("priority");
  if (priority !== null) { if (!PRIORITIES.has(priority)) throw new TypeError("Неверный priority."); filters.priority = priority; }
  const categoryId = searchParams.get("categoryId");
  if (categoryId !== null) { const parsed = Number(categoryId); if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new TypeError("Неверный categoryId."); filters.categoryId = parsed; }
  const q = searchParams.get("q");
  if (q !== null) { const norm = q.trim(); if (norm.length > 100) throw new TypeError("q слишком длинный."); filters.q = norm; }
  return filters;
}

function selectTasks(filters) {
  const needle = filters.q.toLocaleLowerCase("ru-RU");
  return tasks.filter((task) => {
    if (filters.completed !== null && task.completed !== filters.completed) return false;
    if (filters.priority !== null && task.priority !== filters.priority) return false;
    if (filters.categoryId !== null && task.categoryId !== filters.categoryId) return false;
    if (needle && !task.title.toLocaleLowerCase("ru-RU").includes(needle)) return false;
    return true;
  });
}

function parsePositiveId(rawId) {
  if (!/^[1-9]\d*$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) ? id : null;
}

function validateTaskPayload(body, isPatch = false) {
  if (!body || typeof body !== "object") throw new TypeError("Ожидается объект.");
  if (!isPatch) {
    if (typeof body.title !== "string" || body.title.trim().length < 1 || body.title.trim().length > 100) throw new TypeError("Неверный title.");
    if (!PRIORITIES.has(body.priority)) throw new TypeError("Неверный priority.");
    if (!categories.some(c => c.id === body.categoryId)) throw new TypeError("Неверный categoryId.");
  } else {
    if (body.title !== undefined && (typeof body.title !== "string" || body.title.trim().length < 1 || body.title.trim().length > 100)) throw new TypeError("Неверный title.");
    if (body.priority !== undefined && !PRIORITIES.has(body.priority)) throw new TypeError("Неверный priority.");
    if (body.categoryId !== undefined && !categories.some(c => c.id === body.categoryId)) throw new TypeError("Неверный categoryId.");
    if (body.completed !== undefined && typeof body.completed !== "boolean") throw new TypeError("Неверный completed.");
  }
}

export function createApiServer() {
  return http.createServer(async (req, res) => {
    let url;
    try { url = new URL(req.url ?? "/", `http://${HOST}`); } catch { sendError(res, 400, "BAD_REQUEST", "Неверный URL"); return; }

    if (req.method === "OPTIONS") { res.writeHead(204, { "Cache-Control": "no-store", ...corsHeaders() }); res.end(); return; }
    const head = req.method === "HEAD";

    try {
      // --- GET МАРШРУТЫ ---
      if (req.method === "GET" || head) {
        if (url.pathname === "/api/health") return sendJson(res, 200, { data: { status: "ok" } }, head);
        if (url.pathname === "/api/tasks") {
          const filters = parseFilters(url.searchParams);
          const selected = selectTasks(filters);
          return sendJson(res, 200, { data: selected, meta: { total: selected.length, filters } }, head);
        }
        const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
        if (taskMatch) {
          const id = parsePositiveId(taskMatch[1]);
          if (!id) return sendError(res, 400, "INVALID_ID", "Неверный id", undefined, head);
          const task = tasks.find(t => t.id === id);
          if (!task) return sendError(res, 404, "TASK_NOT_FOUND", "Задача не найдена", { id }, head);
          return sendJson(res, 200, { data: task }, head);
        }
        if (url.pathname === "/api/categories") return sendJson(res, 200, { data: categories, meta: { total: categories.length } }, head);
        if (url.pathname === "/api/debug/delay") {
          const ms = Number(url.searchParams.get("ms") ?? "1000");
          await new Promise(r => setTimeout(r, ms));
          return sendJson(res, 200, { data: { delayedMs: ms } }, head);
        }
        if (url.pathname === "/api/debug/error") return sendError(res, 503, "SERVICE_UNAVAILABLE", "Недоступно", undefined, head);
        return sendError(res, 404, "ROUTE_NOT_FOUND", "Маршрут не найден", undefined, head);
      }

      // --- POST / PATCH / DELETE ---
      if (["POST", "PATCH", "DELETE"].includes(req.method)) {
        
        // Специальный маршрут для сброса тестов
        if (url.pathname === "/api/debug/reset" && req.method === "POST") {
          categories = JSON.parse(JSON.stringify(initialCategories));
          tasks = JSON.parse(JSON.stringify(initialTasks));
          nextTaskId = 35;
          return sendJson(res, 200, { data: { reset: true, total: tasks.length } });
        }

        if (url.pathname === "/api/tasks" && req.method === "POST") {
          const body = await readBody(req);
          validateTaskPayload(body);
          const newTask = {
            id: nextTaskId++,
            title: body.title.trim(),
            completed: false,
            priority: body.priority,
            categoryId: Number(body.categoryId)
          };
          tasks.push(newTask);
          return sendJson(res, 201, { data: newTask });
        }

        const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
        if (taskMatch) {
          const id = parsePositiveId(taskMatch[1]);
          if (!id) return sendError(res, 400, "INVALID_ID", "Неверный id");
          const task = tasks.find(t => t.id === id);
          if (!task) return sendError(res, 404, "TASK_NOT_FOUND", "Задача не найдена", { id });

          if (req.method === "PATCH") {
            const body = await readBody(req);
            validateTaskPayload(body, true);
            if (body.title !== undefined) task.title = body.title.trim();
            if (body.priority !== undefined) task.priority = body.priority;
            if (body.categoryId !== undefined) task.categoryId = Number(body.categoryId);
            if (body.completed !== undefined) task.completed = body.completed;
            return sendJson(res, 200, { data: task });
          }

          if (req.method === "DELETE") {
            tasks = tasks.filter(t => t.id !== id);
            res.writeHead(204, corsHeaders());
            return res.end();
          }
        }
      }

      sendError(res, 405, "METHOD_NOT_ALLOWED", "Метод не поддерживается");
    } catch (error) {
      if (error.message === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Ошибка формата JSON");
      if (error instanceof TypeError) return sendError(res, 400, "INVALID_BODY", error.message);
      console.error(error);
      sendError(res, 500, "INTERNAL_ERROR", "Внутренняя ошибка");
    }
  });
}

function readPort(raw) {
  const port = Number(raw ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new TypeError("Неверный порт");
  return port;
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryUrl) {
  const port = readPort(process.argv[2]);
  const server = createApiServer();
  server.listen(port, HOST, () => {
    console.log(`Учебный API: http://${HOST}:${port}/api`);
  });
}