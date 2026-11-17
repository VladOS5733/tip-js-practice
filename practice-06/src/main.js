import { createApiClient } from "./api-client.js";
import { createTaskApi } from "./task-api.js";
import { createDomView } from "./dom-app.js";
import { createAppController } from "./app-controller.js";
import { variantFilters } from "./variant.js";

const urlParams = new URLSearchParams(window.location.search);
const baseUrl = urlParams.get("api") || "http://127.0.0.1:5505/api";

const client = createApiClient({ baseUrl, timeoutMs: 5000 });
const api = createTaskApi(client);
const view = createDomView(document);
const controller = createAppController({ api, view });

view.setApiUrl(baseUrl);
view.connect({
  submit: (draft) => controller.submit(draft),
  filters: (f) => controller.applyFilters(f),
  refresh: () => controller.refresh(),
  cancelEdit: () => controller.cancelEdit(),
  resetData: () => controller.resetData(),
  taskAction: (action, id) => {
    if (action === "edit") controller.beginEdit(id);
    else if (action === "toggle") controller.toggleTask(id);
    else if (action === "delete") controller.deleteTask(id);
  },
});

// Применяем фильтры варианта ТОЛЬКО если в ссылке есть ?dataset=variant
const isVariant = urlParams.get("dataset") === "variant";
const initialFilters = isVariant ? variantFilters : {};

controller.start(initialFilters);
window.practice06 = { ready: controller.ready };