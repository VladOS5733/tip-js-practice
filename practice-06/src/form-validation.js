const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

export function validateTaskDraft(draft, categories) {
  const errors = {};
  const title = String(draft.title ?? "").trim();
  
  if (!title || title.length > 100) {
    errors.title = "Название должно содержать от 1 до 100 символов.";
  }
  
  if (!ALLOWED_PRIORITIES.has(draft.priority)) {
    errors.priority = "Выберите корректный приоритет.";
  }
  
  const categoryId = Number(draft.categoryId);
  if (!categories.some((c) => c.id === categoryId)) {
    errors.categoryId = "Выберите существующую категорию.";
  }

  const valid = Object.keys(errors).length === 0;
  return {
    valid,
    value: valid ? { title, priority: draft.priority, categoryId } : null,
    errors,
  };
}