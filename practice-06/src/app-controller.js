import { ApiError } from "./api-client.js";
import { validateTaskDraft } from "./form-validation.js";

export function messageForError(error) {
  if (!(error instanceof ApiError)) return "Не удалось выполнить операцию.";
  if (error.kind === "timeout") return "Сервер не ответил вовремя. Попробуйте ещё раз.";
  if (error.kind === "network") return "Нет соединения с учебным API. Проверьте, запущен ли npm start.";
  if (error.kind === "invalid-response") return "Сервер вернул ответ неожиданного формата.";
  if (error.kind === "http" && error.status === 404) return "Запись уже отсутствует на сервере. Обновите список.";
  if (error.kind === "http") return error.message || `Сервер вернул ошибку ${error.status}.`;
  return "Не удалось выполнить операцию.";
}

export function createAppController({ api, view, validateDraft = validateTaskDraft } = {}) {
  if (!api || typeof api.getTasks !== "function" || typeof api.loadInitialData !== "function") {
    throw new TypeError("api обязателен и должен содержать методы.");
  }
  if (!view || typeof view.setListState !== "function" || typeof view.setTasks !== "function") {
    throw new TypeError("view обязателен и должен содержать методы.");
  }

  let tasks = [];
  let categories = [];
  let filters = {};
  let editingId = null;
  let abortController = null;
  let readyResolve;
  const ready = new Promise((resolve) => { readyResolve = resolve; });

    async function fetchList(isInitial = false) {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    const { signal } = abortController;
    const currentRequest = abortController; // Запоминаем текущий контроллер

    view.setListState("loading");

    try {
      let result;
      if (isInitial || categories.length === 0) {
        result = await api.loadInitialData(filters, { signal });
        categories = result.categories;
        view.setCategories(categories);
      } else {
        result = await api.getTasks(filters, { signal });
      }
      
      // Если этот запрос был отменен, пока мы ждали ответ, игнорируем его!
      if (currentRequest.signal.aborted) return;

      tasks = result.tasks;
      view.setTasks(tasks, categories);
      view.setTotal(result.meta.total);
      view.setListState(tasks.length === 0 ? "empty" : "ready");
    } catch (error) {
      if (error.kind === "aborted" || currentRequest.signal.aborted) return;
      view.setListState("error", messageForError(error));
    }
  }

  async function mutate(action) {
    view.setMutationPending(true);
    try {
      await action();
      view.notify("Успешно", "success");
      await fetchList(false);
    } catch (error) {
      view.notify(messageForError(error), "error");
    } finally {
      view.setMutationPending(false);
    }
  }

  return {
    ready,
    async start(initialFilters = {}) {
      filters = { ...initialFilters };
      await fetchList(true);
      readyResolve();
    },
    async applyFilters(newFilters) {
      filters = { ...newFilters };
      await fetchList(false);
    },
    async refresh() {
      await fetchList(categories.length === 0);
    },
    async submit(draft) {
      const val = validateDraft(draft, categories);
      if (!val.valid) {
        view.showFormErrors(val.errors);
        return;
      }
      view.showFormErrors({});
      await mutate(async () => {
        if (editingId) await api.updateTask(editingId, val.value);
        else await api.createTask(val.value);
        editingId = null;
        view.setFormTask(null);
      });
    },
    beginEdit(id) {
      const t = tasks.find((x) => x.id === id);
      if (t) {
        editingId = id;
        view.setFormTask(t);
      }
    },
    cancelEdit() {
      editingId = null;
      view.setFormTask(null);
      view.showFormErrors({});
    },
    async toggleTask(id) {
      const t = tasks.find((x) => x.id === id);
      if (t) await mutate(() => api.setTaskCompleted(id, !t.completed));
    },
    async deleteTask(id) {
      await mutate(() => api.deleteTask(id));
    },
    async resetData() {
      view.setMutationPending(true);
      try {
        await api.resetDemoData();
        view.notify("Данные восстановлены", "success");
        await fetchList(false);
      } catch (e) {
        view.notify(messageForError(e), "error");
      } finally {
        view.setMutationPending(false);
      }
    },
    destroy() {
      if (abortController) abortController.abort();
    }
  };
}