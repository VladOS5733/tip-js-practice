export class ApiError extends Error {
  constructor(message, {
    kind,
    status = null,
    code = null,
    details = null,
    url = null,
    cause,
  } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.details = details;
    this.url = url;
  }
}

// Создаёт URL относительно baseUrl и добавляет непустые параметры query.
// Значения кодируются средствами URL и URLSearchParams, а не вручную.
export function buildUrl(baseUrl, path, query = {}) {
  const base = String(baseUrl).replace(/\/+$/, "");
  const suffix = String(path).replace(/^\/+/, "");
  const url = new URL(`${base}/${suffix}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function normalizeBaseUrl(raw) {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new TypeError("baseUrl должен быть непустой строкой.");
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new TypeError("baseUrl должен быть абсолютным URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TypeError("baseUrl должен использовать http или https.");
  }
  if (parsed.search !== "" || parsed.hash !== "") {
    throw new TypeError("baseUrl не должен содержать query или hash.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

// fetchFn передаётся явно, чтобы модуль можно было проверить без реальной сети.
// Возвращаемый объект: { requestJson(path, { query, signal, timeoutMs } = {}) }.
export function createApiClient({
  baseUrl,
  fetchFn = globalThis.fetch,
  timeoutMs = 2000,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (typeof fetchFn !== "function") {
    throw new TypeError("fetchFn должен быть функцией.");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs должен быть положительным целым числом.");
  }

  async function requestJson(path, { query, signal, timeoutMs: perCallTimeout } = {}) {
    let effectiveTimeout = timeoutMs;
    if (perCallTimeout !== undefined) {
      if (!Number.isSafeInteger(perCallTimeout) || perCallTimeout <= 0) {
        throw new TypeError("timeoutMs запроса должен быть положительным целым числом.");
      }
      effectiveTimeout = perCallTimeout;
    }

    const url = buildUrl(normalizedBaseUrl, path, query);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, effectiveTimeout);

    let externalAborted = false;
    const onAbort = () => {
      externalAborted = true;
      controller.abort();
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }

    let response;
    try {
      response = await fetchFn(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (cause) {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
      if (externalAborted) {
        throw new ApiError("Запрос отменён.", { kind: "aborted", url, cause });
      }
      if (timedOut) {
        throw new ApiError("Превышено время ожидания ответа.", {
          kind: "timeout",
          url,
          cause,
        });
      }
      throw new ApiError("Не удалось выполнить сетевой запрос.", {
        kind: "network",
        url,
        cause,
      });
    }
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);

    if (!(response instanceof Response)) {
      throw new ApiError("Ответ не является объектом Response.", {
        kind: "invalid-response",
        url,
      });
    }

    if (!response.ok) {
      let code = null;
      let details = null;
      let message = `HTTP ${response.status}`;
      try {
        const text = await response.text();
        const contentType = response.headers.get("content-type") ?? "";
        if (/^application\/json\b/i.test(contentType) && text.length > 0) {
          const payload = JSON.parse(text);
          if (payload && typeof payload === "object"
              && payload.error && typeof payload.error === "object") {
            if (typeof payload.error.code === "string") code = payload.error.code;
            if (typeof payload.error.message === "string") message = payload.error.message;
            if (payload.error.details !== undefined) details = payload.error.details;
          }
        }
      } catch {
        // Игнорируем — используем сообщение на основе статуса.
      }
      throw new ApiError(message, {
        kind: "http",
        status: response.status,
        code,
        details,
        url,
      });
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!/^application\/json\b/i.test(contentType)) {
      throw new ApiError("Ответ не содержит JSON.", { kind: "invalid-response", url });
    }

    let text;
    try {
      text = await response.text();
    } catch (cause) {
      throw new ApiError("Не удалось прочитать тело ответа.", {
        kind: "invalid-response",
        url,
        cause,
      });
    }
    if (text.length === 0) return null;
    try {
      return JSON.parse(text);
    } catch (cause) {
      throw new ApiError("Не удалось разобрать JSON ответа.", {
        kind: "invalid-response",
        url,
        cause,
      });
    }
  }

  return { requestJson };
}