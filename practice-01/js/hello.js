"use strict";

const studentName = "Пряхин Владислав";
const groupName = "ЭФБО-05-25";
const practiceNumber = 1;

function init() {
  console.log(`Студент: ${studentName}`);
  console.log(`Группа: ${groupName}`);
  console.log(`Практическая работа: ${practiceNumber}`);
  console.log("JavaScript успешно запущен");
  console.log("Тип document:", typeof document);

  const outputEl = document.getElementById("output");
  if (!outputEl) {
    console.error('Элемент #output не найден в DOM');
    return;
  }

  outputEl.innerHTML = `
    <h2>Результаты практической работы</h2>
    <p><strong>Студент:</strong> ${studentName}</p>
    <p><strong>Группа:</strong> ${groupName}</p>
    <p><strong>Практическая работа:</strong> № ${practiceNumber}</p>
  `;
}

document.addEventListener("DOMContentLoaded", init);