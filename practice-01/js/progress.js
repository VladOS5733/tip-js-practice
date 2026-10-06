"use strict";

const totalTasks = 12;
const completedTasks = 5;
const output = document.getElementById("output");

function printResult(message) {
  console.log(message);

  if (output) {
    output.innerHTML += `<p>${message}</p>`;
  }
}

if (!Number.isInteger(totalTasks) || !Number.isInteger(completedTasks)) {
  printResult("Ошибка: недопустимое числовое значение.");
} else if (totalTasks <= 0 || totalTasks > 1000) {
  printResult("Ошибка: превышена верхняя граница.");
} else if (completedTasks < 0 || completedTasks > totalTasks) {
  if (completedTasks > totalTasks) {
    printResult("Ошибка: выполнено больше, чем существует.");
  } else {
    printResult("Ошибка: отрицательное количество.");
  }
} else if (totalTasks === 0 || completedTasks === 0) {
  if (totalTasks === 0) {
    printResult("Ошибка: не происходит деления на ноль.");
  } else {
    printResult("Задачи пока нет. Без расчёта процента.");
  }
} else {
  const remainingTasks = totalTasks - completedTasks;
  const progressPercent = (completedTasks / totalTasks) * 100;

  let status = "";

  if (completedTasks === 0) {
    status = "Не начато";
  } else if (remainingTasks === 0) {
    status = "Завершено";
  } else {
    status = "В работе";
  }

  printResult(`Всего задач: ${totalTasks}`);
  printResult(`Выполнено: ${completedTasks}`);
  printResult(`Осталось: ${remainingTasks}`);
  printResult(`Прогресс: ${progressPercent.toFixed(1)}%`);
  printResult(`Статус: ${status}`);
}