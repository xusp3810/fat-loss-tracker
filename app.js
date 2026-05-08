const STORAGE_KEY = "fat-loss-tracker.records";

const form = document.querySelector("#entryForm");
const dateInput = document.querySelector("#dateInput");
const weightInput = document.querySelector("#weightInput");
const waistInput = document.querySelector("#waistInput");
const recordsBody = document.querySelector("#recordsBody");
const saveNote = document.querySelector("#saveNote");
const fillTodayButton = document.querySelector("#fillTodayButton");
const clearButton = document.querySelector("#clearButton");
const emptyState = document.querySelector("#emptyState");
const chart = document.querySelector("#trendChart");
const ctx = chart.getContext("2d");

const todayDate = document.querySelector("#todayDate");
const latestWeight = document.querySelector("#latestWeight");
const latestWaist = document.querySelector("#latestWaist");
const weeklyWeightAvg = document.querySelector("#weeklyWeightAvg");
const weeklyWaistAvg = document.querySelector("#weeklyWaistAvg");
const weightDelta = document.querySelector("#weightDelta");
const waistDelta = document.querySelector("#waistDelta");
const overallTrend = document.querySelector("#overallTrend");
const lowestWeight = document.querySelector("#lowestWeight");

let records = loadRecords();

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((item) => item.date && Number.isFinite(item.weight) && Number.isFinite(item.waist))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function numberWithSign(value, unit) {
  if (!Number.isFinite(value)) return "--";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)} ${unit}`;
}

function formatMetric(value, unit) {
  if (!Number.isFinite(value)) return "--";
  return `${value.toFixed(2)} ${unit}`;
}

function average(values) {
  if (!values.length) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dateToTime(value) {
  return new Date(`${value}T00:00:00`).getTime();
}

function getWeeklyRecords() {
  const latest = records.at(-1);
  if (!latest) return [];
  const latestTime = dateToTime(latest.date);
  const weekStart = latestTime - 6 * 24 * 60 * 60 * 1000;
  return records.filter((item) => {
    const itemTime = dateToTime(item.date);
    return itemTime >= weekStart && itemTime <= latestTime;
  });
}

function getTrendLabel(first, latest) {
  if (!first || !latest) return "--";
  const weightChange = latest.weight - first.weight;
  const waistChange = latest.waist - first.waist;
  if (weightChange < 0 && waistChange < 0) return "双项下降";
  if (weightChange < 0 || waistChange < 0) return "部分下降";
  if (weightChange === 0 && waistChange === 0) return "保持稳定";
  return "尚未下降";
}

function setToday() {
  dateInput.value = localDateString();
}

function upsertRecord(nextRecord) {
  const existingIndex = records.findIndex((item) => item.date === nextRecord.date);
  if (existingIndex >= 0) {
    records[existingIndex] = nextRecord;
  } else {
    records.push(nextRecord);
  }
  records.sort((a, b) => a.date.localeCompare(b.date));
  saveRecords();
}

function deleteRecord(date) {
  records = records.filter((item) => item.date !== date);
  saveRecords();
  render();
}

function getRange(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { min: min - 1, max: max + 1 };
  const padding = (max - min) * 0.16;
  return { min: min - padding, max: max + padding };
}

function mapPoint(value, min, max, top, height) {
  return top + (1 - (value - min) / (max - min)) * height;
}

function drawLine(points, color, width) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const middleX = (previous.x + current.x) / 2;
    ctx.bezierCurveTo(middleX, previous.y, middleX, current.y, current.x, current.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = color === "#111111" ? "rgba(0, 0, 0, 0.16)" : "rgba(0, 0, 0, 0.08)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawChart() {
  const rect = chart.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  chart.width = Math.round(rect.width * ratio);
  chart.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  emptyState.hidden = records.length > 0;
  if (!records.length) return;

  const pad = {
    top: 34,
    right: width < 560 ? 24 : 46,
    bottom: 48,
    left: width < 560 ? 44 : 58,
  };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const weightRange = getRange(records.map((item) => item.weight));
  const waistRange = getRange(records.map((item) => item.waist));
  const step = records.length > 1 ? chartWidth / (records.length - 1) : 0;

  ctx.strokeStyle = "#ececf0";
  ctx.lineWidth = 1;
  ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = "#8e8e93";
  ctx.textBaseline = "middle";

  for (let index = 0; index <= 4; index += 1) {
    const y = pad.top + (chartHeight / 4) * index;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();

    const weightLabel = weightRange.max - ((weightRange.max - weightRange.min) / 4) * index;
    ctx.fillText(weightLabel.toFixed(2), 8, y);
  }

  const weightPoints = records.map((item, index) => ({
    x: pad.left + step * index,
    y: mapPoint(item.weight, weightRange.min, weightRange.max, pad.top, chartHeight),
  }));

  const waistPoints = records.map((item, index) => ({
    x: pad.left + step * index,
    y: mapPoint(item.waist, waistRange.min, waistRange.max, pad.top, chartHeight),
  }));

  drawLine(waistPoints, "#8e8e93", 2.5);
  drawLine(weightPoints, "#111111", 3);

  ctx.fillStyle = "#6e6e73";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const labelEvery = Math.max(1, Math.ceil(records.length / (width < 560 ? 4 : 7)));
  records.forEach((item, index) => {
    if (index % labelEvery !== 0 && index !== records.length - 1) return;
    const x = pad.left + step * index;
    ctx.fillText(item.date.slice(5).replace("-", "."), x, height - 31);
  });

  ctx.textAlign = "right";
  ctx.fillText("kg", width - pad.right, 14);
  ctx.fillText("cm", width - pad.right, 30);
}

function renderStats() {
  const latest = records.at(-1);
  const first = records.at(0);
  const week = getWeeklyRecords();
  const lowest = records.reduce((lowestItem, item) => {
    if (!lowestItem || item.weight < lowestItem.weight) return item;
    return lowestItem;
  }, null);

  todayDate.textContent = new Date().toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  latestWeight.textContent = latest ? formatMetric(latest.weight, "kg") : "-- kg";
  latestWaist.textContent = latest ? formatMetric(latest.waist, "cm") : "-- cm";

  weeklyWeightAvg.textContent = formatMetric(average(week.map((item) => item.weight)), "kg");
  weeklyWaistAvg.textContent = formatMetric(average(week.map((item) => item.waist)), "cm");
  weightDelta.textContent = latest && first ? numberWithSign(latest.weight - first.weight, "kg") : "--";
  waistDelta.textContent = latest && first ? numberWithSign(latest.waist - first.waist, "cm") : "--";
  overallTrend.textContent = getTrendLabel(first, latest);
  lowestWeight.textContent = lowest ? `${formatMetric(lowest.weight, "kg")} · ${lowest.date.slice(5).replace("-", ".")}` : "--";
}

function renderRecords() {
  recordsBody.innerHTML = "";

  if (!records.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4">暂无记录</td>`;
    recordsBody.append(row);
    return;
  }

  [...records].reverse().forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatDisplayDate(item.date)}</td>
      <td>${formatMetric(item.weight, "kg")}</td>
      <td>${formatMetric(item.waist, "cm")}</td>
      <td><button class="delete-button" type="button" data-date="${item.date}">删除</button></td>
    `;
    recordsBody.append(row);
  });
}

function render() {
  renderStats();
  renderRecords();
  drawChart();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const date = dateInput.value;
  const weight = Number.parseFloat(weightInput.value);
  const waist = Number.parseFloat(waistInput.value);

  if (!date || !Number.isFinite(weight) || !Number.isFinite(waist)) {
    saveNote.textContent = "请填写完整的日期、体重和腰围。";
    return;
  }

  upsertRecord({
    date,
    weight: Math.round(weight * 100) / 100,
    waist: Math.round(waist * 100) / 100,
  });
  saveNote.textContent = "已保存。";
  weightInput.value = "";
  waistInput.value = "";
  render();
});

recordsBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-date]");
  if (!button) return;
  deleteRecord(button.dataset.date);
});

fillTodayButton.addEventListener("click", setToday);

clearButton.addEventListener("click", () => {
  if (!records.length) return;
  const confirmed = window.confirm("确定清空所有记录吗？");
  if (!confirmed) return;
  records = [];
  saveRecords();
  render();
});

window.addEventListener("resize", drawChart);

setToday();
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // PWA registration can fail on file:// or unsupported browsers.
    });
  });
}
