export function createTaskElement(task, category) {
  const li = document.createElement("li");
  li.className = `task-card ${task.completed ? "is-completed" : ""}`;
  li.dataset.taskId = String(task.id);

  const h3 = document.createElement("h3");
  h3.className = "task-title";
  h3.textContent = task.title;
  li.append(h3);

  const meta = document.createElement("div");
  meta.className = "task-meta";

  const status = document.createElement("span");
  status.className = "task-status";
  status.textContent = task.completed ? "Выполнено" : "В работе";
  
  const prio = document.createElement("span");
  prio.textContent = `Приоритет: ${task.priority}`;

  const cat = document.createElement("span");
  cat.className = "task-category";
  cat.textContent = category ? category.name : "Без категории";

  meta.append(status, prio, cat);
  li.append(meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  
  for (const [action, label] of [["toggle", task.completed ? "Вернуть" : "Завершить"], ["edit", "Редактировать"], ["delete", "Удалить"]]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.action = action;
    const span = document.createElement("span");
    span.className = "action-label";
    span.textContent = label;
    btn.append(span);
    actions.append(btn);
  }
  
  li.append(actions);
  return li;
}

export function renderTaskList(list, tasks, categories) {
  list.replaceChildren();
  const catMap = new Map(categories.map((c) => [c.id, c]));
  for (const task of tasks) {
    list.append(createTaskElement(task, catMap.get(task.categoryId)));
  }
}