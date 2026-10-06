"use strict";

const result1= "8" + 2;
console.log("Результат:", result1);
console.log("Тип результата:", typeof result1);

const result2 = "8" - 2;
console.log("Результат:", result2);
console.log("Тип результата:", typeof result2);

const result3 = Number("8") + 2;
console.log("Результат:", result3);
console.log("Тип результата:", typeof result3);

const result4 = "12" > "3";
console.log("Результат:", result4);
console.log("Тип результата:", typeof result4);

const result5 = 12 === "12";
console.log("Результат:", result5);
console.log("Тип результата:", typeof result5);

const result6 = Number("");
console.log("Результат:", result6);
console.log("Тип результата:", typeof result6);

const result7 = Number("text");
console.log("Результат:", result7);
console.log("Тип результата:", typeof result7);

const result8 = Boolean("false");
console.log("Результат:", result8);
console.log("Тип результата:", typeof result8);

const result9 = typeof null;
console.log("Результат:", result9);
console.log("Тип результата:", typeof result9);

const result10 = typeof NaN;
console.log("Результат:", result10);
console.log("Тип результата:", typeof result10);

document.addEventListener("DOMContentLoaded", () => {
  const outputEl = document.getElementById("output");
  if (!outputEl) {
    console.error("#output не найден в DOM");
    return;
  }

  const data = window.studentData;
  if (!data) {
    console.error("studentData не найден — возможно, hello.js не загрузился до types.js");
    return;
  }

  outputEl.innerHTML = `
    <h2>Результаты практической работы</h2>
    <p><strong>Студент:</strong> ${data.studentName}</p>
    <p><strong>Группа:</strong> ${data.groupName}</p>
    <p><strong>Практическая работа:</strong> № ${data.practiceNumber}</p>
    <hr>
    <h3>Результаты вычислений</h3>
  `;

  const results = [
    { label: "result1 = \"8\" + 2", value: result1, type: typeof result1 },
    { label: "result2 = \"8\" - 2", value: result2, type: typeof result2 },
    { label: "result3 = Number(\"8\") + 2", value: result3, type: typeof result3 },
    { label: "result4 = \"12\" > \"3\"", value: result4, type: typeof result4 },
    { label: "result5 = 12 === \"12\"", value: result5, type: typeof result5 },
    { label: "result6 = Number(\"\")", value: result6, type: typeof result6 },
    { label: "result7 = Number(\"text\")", value: result7, type: typeof result7 },
    { label: "result8 = Boolean(\"false\")", value: result8, type: typeof result8 },
    { label: "result9 = typeof null", value: result9, type: typeof result9 },
    { label: "result10 = typeof NaN", value: result10, type: typeof result10 },
  ];

  const html = results
    .map(r => `
      <div class="result-item">
        <strong>${r.label}</strong>
        <br>
        Результат: <span class="value">${r.value}</span>
        <br>
        Тип: <span class="type">${r.type}</span>
      </div>
    `)
    .join("");

  outputEl.insertAdjacentHTML("beforeend", html);
});