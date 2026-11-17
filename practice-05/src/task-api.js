import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_FILTERS = new Set(["completed", "priority", "categoryId", "q"]);

function invalidResponse(message) {
  return new ApiError(message, { kind: "invalid-response" });
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isTask(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.title === "string"
    && value.title.trim().length >= 1
    && value.title.trim().length <= 100
    && typeof value.completed === "boolean"
    && ALLOWED_PRIORITIES.has(value.priority)
    && isPositiveSafeInteger(value.categoryId),
  );
}

function isCategory(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.name === "string"
    && value.name.trim().length >= 1
    && value.name.trim().length <= 100,
  );
}

function normalizeFilters(rawFilters) {
  if (rawFilters === undefined) rawFilters = {};
  if (rawFilters === null || typeof rawFilters !== "object" || Array.isArray(rawFilters)) {
    throw new TypeError("Фильтры должны быть объектом.");
  }
  for (const key of Object.keys(rawFilters)) {
    if (!ALLOWED_FILTERS.has(key)) {
      throw new TypeError(`Неизвестный фильтр: ${key}.`);
    }
  }
  const result = {};
  if (rawFilters.completed !== undefined) {
    if (typeof rawFilters.completed !== "boolean") {
      throw new TypeError("completed должен быть boolean.");
    }
    result.completed = rawFilters.completed;
  }
  if (rawFilters.priority !== undefined) {
    if (!ALLOWED_PRIORITIES.has(rawFilters.priority)) {
      throw new TypeError("priority должен быть low, medium или high.");
    }
    result.priority = rawFilters.priority;
  }
  if (rawFilters.categoryId !== undefined) {
    if (!isPositiveSafeInteger(rawFilters.categoryId)) {
      throw new TypeError("categoryId должен быть положительным целым числом.");
    }
    result.categoryId = rawFilters.categoryId;
  }
  if (rawFilters.q !== undefined) {
    if (typeof rawFilters.q !== "string") {
      throw new TypeError("q должен быть строкой.");
    }
    const trimmed = rawFilters.q.trim();
    if (trimmed.length > 100) {
      throw new TypeError("q не должен быть длиннее 100 символов.");
    }
    result.q = trimmed;
  }
  return result;
}

function validateTaskCollection(payload) {
  if (!payload || typeof payload !== "object") {
    throw invalidResponse("Ответ не является объектом.");
  }
  if (!Array.isArray(payload.data)) {
    throw invalidResponse("Поле data должно быть массивом.");
  }
  if (!payload.meta || typeof payload.meta !== "object") {
    throw invalidResponse("Поле meta отсутствует или неверно.");
  }
  const seenIds = new Set();
  for (const task of payload.data) {
    if (!isTask(task)) throw invalidResponse("Задача не соответствует контракту.");
    if (seenIds.has(task.id)) throw invalidResponse("Повторяющийся id задачи.");
    seenIds.add(task.id);
  }
  if (typeof payload.meta.total !== "number"
      || payload.meta.total !== payload.data.length) {
    throw invalidResponse("meta.total не совпадает с количеством задач.");
  }
  return { tasks: payload.data, meta: payload.meta };
}

function validateCategoryCollection(payload) {
  if (!payload || typeof payload !== "object") {
    throw invalidResponse("Ответ не является объектом.");
  }
  if (!Array.isArray(payload.data)) {
    throw invalidResponse("Поле data должно быть массивом.");
  }
  if (!payload.meta || typeof payload.meta !== "object") {
    throw invalidResponse("Поле meta отсутствует или неверно.");
  }
  const seenIds = new Set();
  for (const category of payload.data) {
    if (!isCategory(category)) throw invalidResponse("Категория не соответствует контракту.");
    if (seenIds.has(category.id)) throw invalidResponse("Повторяющийся id категории.");
    seenIds.add(category.id);
  }
  if (typeof payload.meta.total !== "number"
      || payload.meta.total !== payload.data.length) {
    throw invalidResponse("meta.total не совпадает с количеством категорий.");
  }
  return payload.data;
}

export function createTaskApi(client) {
  if (!client || typeof client.requestJson !== "function") {
    throw new TypeError("createTaskApi: требуется client с методом requestJson.");
  }

  async function getTasks(filters) {
    const query = normalizeFilters(filters);
    const payload = await client.requestJson("/tasks", { query });
    return validateTaskCollection(payload);
  }

  async function getTaskById(id) {
    if (!isPositiveSafeInteger(id)) {
      throw new TypeError("id должен быть положительным целым числом.");
    }
    const payload = await client.requestJson(`/tasks/${id}`);
    if (!payload || typeof payload !== "object") {
      throw invalidResponse("Ответ не является объектом.");
    }
    if (!isTask(payload.data)) {
      throw invalidResponse("Задача не соответствует контракту.");
    }
    return payload.data;
  }

  async function getCategories() {
    const payload = await client.requestJson("/categories");
    return validateCategoryCollection(payload);
  }

  async function loadInitialData(filters) {
    const [tasksResult, categories] = await Promise.all([
      getTasks(filters),
      getCategories(),
    ]);
    return {
      tasks: tasksResult.tasks,
      categories,
      meta: tasksResult.meta,
    };
  }

  return { getTasks, getTaskById, getCategories, loadInitialData };
}