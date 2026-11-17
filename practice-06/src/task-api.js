import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_FILTERS = new Set(["completed", "priority", "categoryId", "q"]);

function invalidResponse(message) {
  return new ApiError(message, { kind: "invalid-response" });
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function isTask(value) {
  return Boolean(
    value && typeof value === "object" && isPositiveSafeInteger(value.id) &&
    typeof value.title === "string" && value.title.trim().length >= 1 && value.title.trim().length <= 100 &&
    typeof value.completed === "boolean" && ALLOWED_PRIORITIES.has(value.priority) &&
    isPositiveSafeInteger(value.categoryId)
  );
}

export function isCategory(value) {
  return Boolean(
    value && typeof value === "object" && isPositiveSafeInteger(value.id) &&
    typeof value.name === "string" && value.name.trim().length >= 1 && value.name.trim().length <= 100
  );
}

export function createTaskApi(client) {
  if (!client || typeof client.requestJson !== "function") {
    throw new TypeError("createTaskApi: требуется client с методом requestJson.");
  }

  async function getTasks(filters = {}, { signal } = {}) {
    const payload = await client.requestJson("/tasks", { query: filters, signal });
    if (!Array.isArray(payload.data) || typeof payload.meta?.total !== "number") throw invalidResponse("Неверный формат.");
    const seen = new Set();
    for (const t of payload.data) {
      if (!isTask(t)) throw invalidResponse("Задача не по схеме.");
      if (seen.has(t.id)) throw invalidResponse("Повтор id.");
      seen.add(t.id);
    }
    if (payload.meta.total !== payload.data.length) throw invalidResponse("meta.total не совпадает.");
    return { tasks: payload.data, meta: payload.meta };
  }

  async function getTaskById(id, { signal } = {}) {
    if (!isPositiveSafeInteger(id)) throw new TypeError("id должен быть целым > 0");
    const payload = await client.requestJson(`/tasks/${id}`, { signal });
    if (!isTask(payload.data)) throw invalidResponse("Задача не по схеме.");
    return payload.data;
  }

  async function getCategories({ signal } = {}) {
    const payload = await client.requestJson("/categories", { signal });
    if (!Array.isArray(payload.data)) throw invalidResponse("Не массив.");
    for (const c of payload.data) if (!isCategory(c)) throw invalidResponse("Категория не по схеме.");
    return payload.data;
  }

  async function loadInitialData(filters = {}, { signal } = {}) {
    const [tasksResult, categories] = await Promise.all([
      getTasks(filters, { signal }),
      getCategories({ signal })
    ]);
    return { tasks: tasksResult.tasks, categories, meta: tasksResult.meta };
  }

  async function createTask(draft, { signal } = {}) {
    const payload = await client.requestJson("/tasks", { method: "POST", body: draft, signal });
    if (!isTask(payload.data)) throw invalidResponse("Ответ не по схеме.");
    return payload.data;
  }

  async function updateTask(id, changes, { signal } = {}) {
    if (!isPositiveSafeInteger(id)) throw new TypeError("id неверный.");
    const payload = await client.requestJson(`/tasks/${id}`, { method: "PATCH", body: changes, signal });
    if (!isTask(payload.data)) throw invalidResponse("Ответ не по схеме.");
    return payload.data;
  }

  async function setTaskCompleted(id, completed, { signal } = {}) {
    return updateTask(id, { completed }, { signal });
  }

  async function deleteTask(id, { signal } = {}) {
    if (!isPositiveSafeInteger(id)) throw new TypeError("id неверный.");
    await client.requestJson(`/tasks/${id}`, { method: "DELETE", signal });
    return null;
  }

  async function resetDemoData({ signal } = {}) {
    const payload = await client.requestJson("/debug/reset", { method: "POST", signal });
    if (!payload?.data?.reset) throw invalidResponse("Неверный ответ сброса.");
    return payload.data;
  }

  return { getTasks, getTaskById, getCategories, loadInitialData, createTask, updateTask, setTaskCompleted, deleteTask, resetDemoData };
}