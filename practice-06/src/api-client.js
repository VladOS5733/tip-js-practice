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
  if (typeof raw !== "string" || raw.length === 0) throw new TypeError("baseUrl должен быть строкой.");
  let parsed;
  try { parsed = new URL(raw); } catch { throw new TypeError("baseUrl должен быть абсолютным URL."); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new TypeError("baseUrl должен использовать http/https.");
  if (parsed.search !== "" || parsed.hash !== "") throw new TypeError("baseUrl не должен содержать query или hash.");
  return parsed.toString().replace(/\/+$/, "");
}

export function createApiClient({
  baseUrl,
  fetchFn = globalThis.fetch,
  timeoutMs = 2000,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (typeof fetchFn !== "function") throw new TypeError("fetchFn должен быть функцией.");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError("timeoutMs должен быть > 0.");

  async function requestJson(path, { query, signal, timeoutMs: perCallTimeout, method = "GET", body } = {}) {
    const safeMethod = String(method).toUpperCase();
    if (!["GET", "POST", "PATCH", "DELETE"].includes(safeMethod)) {
      throw new TypeError(`Метод ${method} не поддерживается.`);
    }
    if (safeMethod === "GET" && body !== undefined) {
      throw new TypeError("GET-запрос не может содержать body.");
    }

    let effectiveTimeout = timeoutMs;
    if (perCallTimeout !== undefined) {
      if (!Number.isSafeInteger(perCallTimeout) || perCallTimeout <= 0) throw new TypeError("timeoutMs должен быть > 0.");
      effectiveTimeout = perCallTimeout;
    }

    const url = buildUrl(normalizedBaseUrl, path, query);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, effectiveTimeout);

    let externalAborted = false;
    const onAbort = () => { externalAborted = true; controller.abort(); };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }

    const options = {
      method: safeMethod,
      headers: { Accept: "application/json" },
      signal: controller.signal,
    };

    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetchFn(url, options);
    } catch (cause) {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
      if (externalAborted) throw new ApiError("Запрос отменён.", { kind: "aborted", url, cause });
      if (timedOut) throw new ApiError("Превышено время ожидания.", { kind: "timeout", url, cause });
      throw new ApiError("Не удалось выполнить сетевой запрос.", { kind: "network", url, cause });
    }
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);

    if (!(response instanceof Response)) throw new ApiError("Ответ не является Response.", { kind: "invalid-response", url });

    if (!response.ok) {
      let code = null, details = null, message = `HTTP ${response.status}`;
      try {
        const text = await response.text();
        const contentType = response.headers.get("content-type") ?? "";
        if (/^application\/json\b/i.test(contentType) && text.length > 0) {
          const payload = JSON.parse(text);
          if (payload?.error) {
            if (typeof payload.error.code === "string") code = payload.error.code;
            if (typeof payload.error.message === "string") message = payload.error.message;
            if (payload.error.details !== undefined) details = payload.error.details;
          }
        }
      } catch { /* ignore */ }
      throw new ApiError(message, { kind: "http", status: response.status, code, details, url });
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!/^application\/json\b/i.test(contentType)) throw new ApiError("Ответ не содержит JSON.", { kind: "invalid-response", url });

    let text;
    try { text = await response.text(); } catch (cause) { throw new ApiError("Не удалось прочитать тело.", { kind: "invalid-response", url, cause }); }
    if (text.length === 0) return null;
    try { return JSON.parse(text); } catch (cause) { throw new ApiError("Ошибка парсинга JSON.", { kind: "invalid-response", url, cause }); }
  }

  return { requestJson };
}