const STORAGE_KEY = "fat-loss-tracker.records";

const form = document.querySelector("#entryForm");
const dayInput = document.querySelector("#dayInput");
const dateInput = document.querySelector("#dateInput");
const weightInput = document.querySelector("#weightInput");
const waistInput = document.querySelector("#waistInput");
const pauseMetricsInput = document.querySelector("#pauseMetricsInput");
const trainingPartInput = document.querySelector("#trainingPartInput");
const trainingActionsInput = document.querySelector("#trainingActionsInput");
const restDayInput = document.querySelector("#restDayInput");
const recordsBody = document.querySelector("#recordsBody");
const recordCards = document.querySelector("#recordCards");
const saveNote = document.querySelector("#saveNote");
const fillTodayButton = document.querySelector("#fillTodayButton");
const clearButton = document.querySelector("#clearButton");
const importButton = document.querySelector("#importButton");
const importModal = document.querySelector("#importModal");
const closeImportButton = document.querySelector("#closeImportButton");
const cancelImportButton = document.querySelector("#cancelImportButton");
const parseImportButton = document.querySelector("#parseImportButton");
const confirmImportButton = document.querySelector("#confirmImportButton");
const importText = document.querySelector("#importText");
const importNote = document.querySelector("#importNote");
const previewWrap = document.querySelector("#previewWrap");
const previewBody = document.querySelector("#previewBody");
const skippedBox = document.querySelector("#skippedBox");
const skippedList = document.querySelector("#skippedList");
const failedBox = document.querySelector("#failedBox");
const failedList = document.querySelector("#failedList");
const duplicateOptions = document.querySelector("#duplicateOptions");
const recordModal = document.querySelector("#recordModal");
const recordEditForm = document.querySelector("#recordEditForm");
const closeRecordButton = document.querySelector("#closeRecordButton");
const cancelRecordButton = document.querySelector("#cancelRecordButton");
const deleteRecordButton = document.querySelector("#deleteRecordButton");
const editRecordKey = document.querySelector("#editRecordKey");
const editDayInput = document.querySelector("#editDayInput");
const editDateInput = document.querySelector("#editDateInput");
const editWeightInput = document.querySelector("#editWeightInput");
const editWaistInput = document.querySelector("#editWaistInput");
const editTrainingPartInput = document.querySelector("#editTrainingPartInput");
const editCardioInput = document.querySelector("#editCardioInput");
const editTrainingActionsInput = document.querySelector("#editTrainingActionsInput");
const editRestDayInput = document.querySelector("#editRestDayInput");
const editPausedInput = document.querySelector("#editPausedInput");
const recordEditNote = document.querySelector("#recordEditNote");
const authModal = document.querySelector("#authModal");
const authForm = document.querySelector("#authForm");
const authOpenButton = document.querySelector("#authOpenButton");
const closeAuthButton = document.querySelector("#closeAuthButton");
const signupButton = document.querySelector("#signupButton");
const uploadLocalButton = document.querySelector("#uploadLocalButton");
const pullCloudButton = document.querySelector("#pullCloudButton");
const logoutButton = document.querySelector("#logoutButton");
const authEmailInput = document.querySelector("#authEmailInput");
const authPasswordInput = document.querySelector("#authPasswordInput");
const authNote = document.querySelector("#authNote");
const syncStatus = document.querySelector("#syncStatus");
const accountEmail = document.querySelector("#accountEmail");
const syncHint = document.querySelector("#syncHint");
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
let importPreviewRecords = [];
let importSkippedLines = [];
let importFailedLines = [];
let supabaseClient = null;
let currentUser = null;
let cloudReady = false;
let syncInFlight = false;
let isApplyingCloudRecords = false;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  if (!value) return "--";
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function sortRecords(nextRecords) {
  return nextRecords.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.day && b.day && a.day !== b.day) return a.day - b.day;
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return 0;
  });
}

function getRecordKey(item) {
  if (item.day) return `day:${item.day}`;
  return `date:${item.date}`;
}

function getMaxDay(items = records) {
  return items.reduce((maxDay, item) => {
    if (!Number.isFinite(item.day)) return maxDay;
    return Math.max(maxDay, item.day);
  }, 0);
}

function getNextDay() {
  return getMaxDay() + 1;
}

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return sortRecords(
      saved.filter((item) => {
        const hasIdentity = item.date || Number.isFinite(item.day);
        return hasIdentity;
      })
    );
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function setSyncStatus(status, hint = "") {
  syncStatus.textContent = status;
  syncHint.textContent = hint;
}

function getSupabaseConfig() {
  const config = window.SUPABASE_CONFIG || {};
  return {
    url: config.url || window.SUPABASE_URL || "",
    anonKey: config.anonKey || window.SUPABASE_ANON_KEY || "",
  };
}

function isSupabaseConfigured() {
  const config = getSupabaseConfig();
  return Boolean(window.supabase && config.url && config.anonKey);
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncateText(value, maxLength = 28) {
  if (!value || value === "--") return "--";
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function isValidUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getCloudId(record) {
  if (isValidUuid(record.cloudId)) return record.cloudId;
  if (isValidUuid(record.id)) return record.id;
  return "";
}

function toCloudRecord(record, options = {}) {
  const { includeId = false } = options;
  const payload = {
    user_id: currentUser?.id,
    day: Number.isFinite(record.day) ? record.day : null,
    date: record.date || null,
    weight: Number.isFinite(record.weight) ? record.weight : null,
    waist: Number.isFinite(record.waist) ? record.waist : null,
    training_part: record.trainingPart || null,
    training_actions: record.trainingActions || null,
    cardio: record.cardio || null,
    is_rest_day: Boolean(record.isRestDay),
    is_paused: Boolean(record.isPaused),
    note: record.note || record.sourceText || null,
    updated_at: new Date().toISOString(),
  };
  const cloudId = getCloudId(record);
  if (includeId && cloudId) payload.id = cloudId;
  return payload;
}

function fromCloudRecord(row) {
  return {
    cloudId: row.id,
    day: row.day,
    date: row.date || "",
    weight: Number.isFinite(row.weight) ? row.weight : row.weight === null ? null : Number(row.weight),
    waist: Number.isFinite(row.waist) ? row.waist : row.waist === null ? null : Number(row.waist),
    trainingPart: row.training_part || "",
    trainingActions: row.training_actions || "",
    cardio: row.cardio || "",
    isRestDay: Boolean(row.is_rest_day),
    isPaused: Boolean(row.is_paused),
    note: row.note || "",
    updatedAt: row.updated_at || row.created_at || "",
  };
}

function getMigrationKey() {
  return currentUser ? `fat-loss-tracker.migrated.${currentUser.id}` : "";
}

function average(values) {
  if (!values.length) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dateToTime(value) {
  if (!value) return Number.NaN;
  return new Date(`${value}T00:00:00`).getTime();
}

function getWeeklyRecords() {
  const datedRecords = records.filter((item) => {
    return item.date && Number.isFinite(item.weight) && Number.isFinite(item.waist);
  });
  const latest = datedRecords.at(-1);
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

function updateMetricInputsState() {
  const shouldSkipMetrics = pauseMetricsInput.checked || restDayInput.checked;
  weightInput.disabled = shouldSkipMetrics;
  waistInput.disabled = shouldSkipMetrics;
  if (shouldSkipMetrics) {
    weightInput.value = "";
    waistInput.value = "";
  }
}

function upsertRecord(nextRecord) {
  const recordToSave = {
    ...nextRecord,
    updatedAt: new Date().toISOString(),
  };
  const existingIndex = records.findIndex((item) => {
    if (recordToSave.day) return item.day === recordToSave.day;
    return item.date === recordToSave.date;
  });
  if (existingIndex >= 0) {
    records[existingIndex] = { ...records[existingIndex], ...recordToSave };
  } else {
    records.push(recordToSave);
  }
  sortRecords(records);
  saveRecords();
  syncRecordToCloud(recordToSave);
}

function deleteRecord(key) {
  const existing = findRecordByKey(key);
  records = records.filter((item) => getRecordKey(item) !== key);
  saveRecords();
  deleteCloudRecord(existing);
  render();
}

function findRecordByKey(key) {
  return records.find((item) => getRecordKey(item) === key);
}

function replaceRecordByKey(key, nextRecord) {
  const recordToSave = {
    ...nextRecord,
    updatedAt: new Date().toISOString(),
  };
  records = records.map((item) => {
    if (getRecordKey(item) !== key) return item;
    return recordToSave;
  });
  sortRecords(records);
  saveRecords();
  syncRecordToCloud(recordToSave);
  render();
}

async function syncRecordToCloud(record) {
  if (!cloudReady || !currentUser || isApplyingCloudRecords) return;
  syncInFlight = true;
  setSyncStatus("同步中", "正在保存到云端");

  try {
    const payload = toCloudRecord(record);
    const cloudId = getCloudId(record);
    const query = cloudId
      ? supabaseClient
          .from("records")
          .update(payload)
          .eq("id", cloudId)
          .select()
          .single()
      : supabaseClient
          .from("records")
          .upsert(payload, { onConflict: "user_id,day" })
          .select()
          .single();
    const { data, error } = await query;
    if (error) throw error;

    if (data) {
      const key = record.day ? `day:${record.day}` : `date:${record.date}`;
      const local = findRecordByKey(key);
      if (local) {
        local.cloudId = data.id;
        saveRecords();
      }
    }
    setSyncStatus("云同步已开启", currentUser.email);
  } catch (error) {
    setSyncStatus("同步失败", error.message || "云端保存失败");
  } finally {
    syncInFlight = false;
  }
}

async function deleteCloudRecord(record) {
  if (!cloudReady || !currentUser || !record) return;
  setSyncStatus("同步中", "正在删除云端记录");

  try {
    let query = supabaseClient.from("records").delete();
    const cloudId = getCloudId(record);
    if (cloudId) {
      query = query.eq("id", cloudId);
    } else if (record.day) {
      query = query.eq("user_id", currentUser.id).eq("day", record.day);
    } else {
      return;
    }
    const { error } = await query;
    if (error) throw error;
    setSyncStatus("云同步已开启", currentUser.email);
  } catch (error) {
    setSyncStatus("同步失败", error.message || "云端删除失败");
  }
}

function mergeRecordsByDay(localRecords, cloudRecords) {
  const merged = new Map();
  [...localRecords, ...cloudRecords].forEach((record) => {
    const key = record.day ? `day:${record.day}` : getRecordKey(record);
    const previous = merged.get(key);
    const previousTime = Date.parse(previous?.updatedAt || previous?.updated_at || 0) || 0;
    const nextTime = Date.parse(record.updatedAt || record.updated_at || 0) || 0;
    if (!previous || nextTime >= previousTime) merged.set(key, record);
  });
  return sortRecords([...merged.values()]);
}

async function fetchCloudRecords() {
  if (!cloudReady || !currentUser) return [];
  setSyncStatus("同步中", "正在读取云端记录");

  try {
    const { data, error } = await supabaseClient
      .from("records")
      .select("*")
      .order("day", { ascending: true });
    if (error) throw error;

    const cloudRecords = (data || []).map(fromCloudRecord);
    isApplyingCloudRecords = true;
    records = mergeRecordsByDay(records, cloudRecords);
    saveRecords();
    render();
    isApplyingCloudRecords = false;
    setSyncStatus("云同步已开启", currentUser.email);
    return cloudRecords;
  } catch (error) {
    isApplyingCloudRecords = false;
    setSyncStatus("同步失败", error.message || "读取云端失败");
    return [];
  }
}

async function uploadLocalRecordsToCloud(sourceRecords = records) {
  if (!cloudReady || !currentUser || !sourceRecords.length) return;
  setSyncStatus("同步中", "正在上传本地数据");

  try {
    const payload = sourceRecords
      .filter((record) => Number.isFinite(record.day))
      .map((record) => {
        const cloudRecord = toCloudRecord(record, { includeId: false });
        delete cloudRecord.id;
        return cloudRecord;
      });
    if (!payload.length) return;

    const { data, error } = await supabaseClient
      .from("records")
      .upsert(payload, { onConflict: "user_id,day" })
      .select();
    if (error) throw error;

    const cloudByDay = new Map((data || []).map((row) => [row.day, row.id]));
    records = mergeRecordsByDay(records, sourceRecords);
    records.forEach((record) => {
      if (cloudByDay.has(record.day)) record.cloudId = cloudByDay.get(record.day);
    });
    saveRecords();
    localStorage.setItem(getMigrationKey(), "1");
    await fetchCloudRecords();
    setSyncStatus("云同步已开启", "历史数据已上传云端");
  } catch (error) {
    setSyncStatus("同步失败", error.message || "上传本地数据失败");
  }
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
  const chartRecords = records.filter((item) => {
    return Number.isFinite(item.weight) && Number.isFinite(item.waist);
  });
  const rect = chart.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  chart.width = Math.round(rect.width * ratio);
  chart.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  emptyState.hidden = chartRecords.length > 0;
  if (!chartRecords.length) return;

  const pad = {
    top: 34,
    right: width < 560 ? 24 : 46,
    bottom: 48,
    left: width < 560 ? 44 : 58,
  };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const weightRange = getRange(chartRecords.map((item) => item.weight));
  const waistRange = getRange(chartRecords.map((item) => item.waist));
  const step = chartRecords.length > 1 ? chartWidth / (chartRecords.length - 1) : 0;

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

  const weightPoints = chartRecords.map((item, index) => ({
    x: pad.left + step * index,
    y: mapPoint(item.weight, weightRange.min, weightRange.max, pad.top, chartHeight),
  }));

  const waistPoints = chartRecords.map((item, index) => ({
    x: pad.left + step * index,
    y: mapPoint(item.waist, waistRange.min, waistRange.max, pad.top, chartHeight),
  }));

  drawLine(waistPoints, "#8e8e93", 2.5);
  drawLine(weightPoints, "#111111", 3);

  ctx.fillStyle = "#6e6e73";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const labelEvery = Math.max(1, Math.ceil(chartRecords.length / (width < 560 ? 4 : 7)));
  chartRecords.forEach((item, index) => {
    if (index % labelEvery !== 0 && index !== chartRecords.length - 1) return;
    const x = pad.left + step * index;
    const label = item.day ? `D${item.day}` : item.date ? item.date.slice(5).replace("-", ".") : "--";
    ctx.fillText(label, x, height - 31);
  });

  ctx.textAlign = "right";
  ctx.fillText("kg", width - pad.right, 14);
  ctx.fillText("cm", width - pad.right, 30);
}

function renderStats() {
  const metricRecords = records.filter((item) => {
    return Number.isFinite(item.weight) && Number.isFinite(item.waist);
  });
  const latest = metricRecords.at(-1);
  const first = metricRecords.at(0);
  const week = getWeeklyRecords();
  const lowest = metricRecords.reduce((lowestItem, item) => {
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
  lowestWeight.textContent = lowest
    ? `${formatMetric(lowest.weight, "kg")} · ${lowest.date ? lowest.date.slice(5).replace("-", ".") : `D${lowest.day}`}`
    : "--";
}

function renderRecords() {
  recordsBody.innerHTML = "";
  recordCards.innerHTML = "";

  if (!records.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="8">暂无记录</td>`;
    recordsBody.append(row);
    recordCards.innerHTML = `<p class="empty-card">暂无记录</p>`;
    return;
  }

  [...records].reverse().forEach((item) => {
    const key = getRecordKey(item);
    const trainingText = item.trainingPart || item.trainingActions
      ? `${item.trainingPart || ""}${item.trainingActions ? ` · ${item.trainingActions}` : ""}`
      : "--";
    const shortTrainingText = truncateText(trainingText, 28);
    const safeTrainingText = escapeHtml(trainingText);
    const safeShortTrainingText = escapeHtml(shortTrainingText);
    const row = document.createElement("tr");
    row.className = "record-row";
    row.innerHTML = `
      <td>${item.day ? `Day${item.day}` : "--"}</td>
      <td>${formatDisplayDate(item.date)}</td>
      <td>${formatMetric(item.weight, "kg")}</td>
      <td>${formatMetric(item.waist, "cm")}</td>
      <td class="truncate-cell" title="${safeTrainingText}">${safeShortTrainingText}</td>
      <td>${item.cardio || "--"}</td>
      <td>${item.isPaused ? "暂停" : item.isRestDay ? "是" : "否"}</td>
      <td class="sticky-actions">
        <div class="row-actions">
          <button class="delete-button" type="button" data-action="edit" data-key="${key}">查看/编辑</button>
          <button class="delete-button" type="button" data-action="delete" data-key="${key}">删除</button>
        </div>
      </td>
    `;
    recordsBody.append(row);

    const card = document.createElement("article");
    card.className = "record-card";
    card.innerHTML = `
      <div class="record-card-head">
        <strong>${item.day ? `Day${item.day}` : "--"}</strong>
        <span>${formatDisplayDate(item.date)}</span>
      </div>
      <div class="record-card-metrics">
        <span>${formatMetric(item.weight, "kg")}</span>
        <span>${formatMetric(item.waist, "cm")}</span>
        <span>${item.isPaused ? "暂停" : item.isRestDay ? "休息日" : "训练"}</span>
      </div>
      <p title="${safeTrainingText}">${safeShortTrainingText}</p>
      <div class="row-actions">
        <button class="delete-button" type="button" data-action="edit" data-key="${key}">查看/编辑</button>
        <button class="delete-button" type="button" data-action="delete" data-key="${key}">删除</button>
      </div>
    `;
    recordCards.append(card);
  });
}

function normalizeImportedDate(value) {
  if (!value) return "";
  const cleaned = value.replace(/[年月/.]/g, "-").replace(/日/g, "");
  const parts = cleaned.split("-").filter(Boolean);
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const monthValue = Number(month);
    const dayValue = Number(day);
    if (monthValue < 1 || monthValue > 12 || dayValue < 1 || dayValue > 31) return "";
    return `${year.padStart(4, "20")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (parts.length === 2) {
    const year = String(new Date().getFullYear());
    const [month, day] = parts;
    const monthValue = Number(month);
    const dayValue = Number(day);
    if (monthValue < 1 || monthValue > 12 || dayValue < 1 || dayValue > 31) return "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return "";
}

function isWeeklySummaryLine(line) {
  return /第[一二三四五六七八九十\d]+周|平均体重|平均腰围|周平均|平均\s*\d+(?:\.\d+)?\s*(?:cm|kg|公斤|厘米)?/i.test(line);
}

function isMetaLine(line) {
  return /总结|备注|特殊情况|标题|复盘|计划|注意事项|说明/i.test(line);
}

function getSkippedReason(line) {
  if (isWeeklySummaryLine(line)) return "周总结/平均数据";
  if (isMetaLine(line)) return "总结/备注/特殊情况";
  return "缺少 Day 编号";
}

function stripMetricText(line, options = {}) {
  const { removeStandaloneUnits = false } = options;
  let cleaned = line
    .replace(/体重\s*[:：]?\s*\d+(?:\.\d+)?\s*(?:kg|公斤)?/gi, " ")
    .replace(/腰围\s*[:：]?\s*\d+(?:\.\d+)?\s*(?:cm|厘米)?/gi, " ");

  if (removeStandaloneUnits) {
    cleaned = cleaned.replace(/\b(?:kg|cm)\b|公斤|厘米/gi, " ");
  }

  return cleaned;
}

function extractExplicitDate(line) {
  const withoutMetrics = stripMetricText(line);
  const fullDate = withoutMetrics.match(/\b\d{4}[/-](?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])\b|\b\d{4}年(?:0?[1-9]|1[0-2])月(?:0?[1-9]|[12]\d|3[01])日?\b/);
  if (fullDate) return fullDate[0];

  const shortDateMatches = [...withoutMetrics.matchAll(/(^|[^\d.])((?:0?[1-9]|1[0-2])\.(?:0?[1-9]|[12]\d|3[01]))(?=$|[^\d.])/g)];
  return shortDateMatches[0]?.[2] || "";
}

function getDuplicateDaySet() {
  return new Set(records.filter((item) => item.day).map((item) => item.day));
}

function extractCardio(text) {
  const cardioPattern = /((?:爬坡|跑步|慢跑|快走|椭圆机|动感单车|单车|游泳|跳绳|划船机|有氧)[^\s，,。；;]*)/g;
  return [...text.matchAll(cardioPattern)].map((match) => match[1]).join(" ");
}

function extractTrainingPart(text) {
  const partPattern = /(胸背|胸肩|背肩|胸|背|腿|肩|臀|腹|核心|手臂|二头|三头)/g;
  return [...new Set([...text.matchAll(partPattern)].map((match) => match[1]))].join("、");
}

function cleanTrainingText(text, parts, cardio) {
  let cleaned = stripMetricText(text, { removeStandaloneUnits: true })
    .replace(/Day\s*\d+/gi, " ")
    .replace(/\d{4}[年./-]\d{1,2}[月./-]\d{1,2}日?/g, " ")
    .replace(/\d{1,2}[./-]\d{1,2}/g, " ")
    .replace(/休息日|休息/g, " ");

  parts.split("、").filter(Boolean).forEach((part) => {
    cleaned = cleaned.replace(new RegExp(part, "g"), " ");
  });

  cardio.split(" ").filter(Boolean).forEach((item) => {
    cleaned = cleaned.replace(item, " ");
  });

  return cleaned.replace(/[，,。；;]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseHistoryLine(line, fallbackDay) {
  const dayMatch = line.match(/(?:^|\s)Day\s*(\d+)/i);
  const weightMatch = line.match(/体重[:：]?\s*(\d+(?:\.\d+)?)/i);
  const waistMatch = line.match(/腰围[:：]?\s*(\d+(?:\.\d+)?)/i);
  const importedDate = extractExplicitDate(line);
  const cardio = extractCardio(line);
  const trainingPart = extractTrainingPart(line);
  const trainingActions = cleanTrainingText(line, trainingPart, cardio);
  const hasStrengthTraining = Boolean(trainingPart || trainingActions);
  const isRestDay = /休息日|休息/.test(line) || (Boolean(cardio) && !hasStrengthTraining);

  return {
    day: dayMatch ? Number.parseInt(dayMatch[1], 10) : fallbackDay,
    date: normalizeImportedDate(importedDate),
    weight: weightMatch ? Math.round(Number.parseFloat(weightMatch[1]) * 100) / 100 : null,
    waist: waistMatch ? Math.round(Number.parseFloat(waistMatch[1]) * 100) / 100 : null,
    trainingPart,
    trainingActions,
    cardio,
    isRestDay,
    sourceText: line,
  };
}

function hasRecognizedImportContent(item) {
  return Boolean(
    item.date ||
      Number.isFinite(item.weight) ||
      Number.isFinite(item.waist) ||
      item.trainingPart ||
      item.trainingActions ||
      item.cardio ||
      item.isRestDay
  );
}

function parseImportText(text) {
  const duplicates = getDuplicateDaySet();
  const parsedRecords = [];
  const skippedLines = [];
  const failedLines = [];
  let nextGeneratedDay = getNextDay();

  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (isWeeklySummaryLine(line) || isMetaLine(line)) {
        skippedLines.push({
          reason: getSkippedReason(line),
          text: line,
        });
        return;
      }

      const hasDay = /(?:^|\s)Day\s*\d+/i.test(line);
      const parsed = parseHistoryLine(line, hasDay ? null : nextGeneratedDay);
      if (!hasRecognizedImportContent(parsed)) {
        failedLines.push({
          reason: "没有识别出日期、体重、腰围、训练、有氧或休息日",
          text: line,
        });
        return;
      }

      if (!hasDay) nextGeneratedDay += 1;
      parsedRecords.push({
        ...parsed,
        isDuplicate: parsed.day ? duplicates.has(parsed.day) : false,
        hasError: !parsed.day,
      });
      if (parsed.day) duplicates.add(parsed.day);
    });

  return { records: parsedRecords, skipped: skippedLines, failed: failedLines };
}

function renderPreview() {
  previewBody.innerHTML = "";
  skippedList.innerHTML = "";
  failedList.innerHTML = "";
  const hasDuplicates = importPreviewRecords.some((item) => item.isDuplicate);
  const hasValidRows = importPreviewRecords.some((item) => !item.hasError);

  duplicateOptions.hidden = !hasDuplicates;
  previewWrap.hidden = importPreviewRecords.length === 0;
  skippedBox.hidden = importSkippedLines.length === 0;
  failedBox.hidden = importFailedLines.length === 0;
  confirmImportButton.disabled = false;

  importSkippedLines.forEach((item) => {
    const row = document.createElement("li");
    row.textContent = `${item.reason}：${item.text}`;
    skippedList.append(row);
  });

  importFailedLines.forEach((item) => {
    const row = document.createElement("li");
    row.textContent = `${item.reason}：${item.text}`;
    failedList.append(row);
  });

  importPreviewRecords.forEach((item) => {
    const row = document.createElement("tr");
    const status = item.hasError ? "无法导入" : item.isDuplicate ? "重复 Day" : "新记录";
    const statusClass = item.hasError ? "status-error" : item.isDuplicate ? "status-duplicate" : "";
    row.innerHTML = `
      <td>${item.day ? `Day${item.day}` : "--"}</td>
      <td>${formatDisplayDate(item.date)}</td>
      <td>${formatMetric(item.weight, "kg")}</td>
      <td>${formatMetric(item.waist, "cm")}</td>
      <td>${item.trainingPart || "--"}</td>
      <td>${item.trainingActions || "--"}</td>
      <td>${item.cardio || "--"}</td>
      <td>${item.isRestDay ? "是" : "否"}</td>
      <td><span class="status-pill ${statusClass}">${status}</span></td>
    `;
    previewBody.append(row);
  });
}

function openImportModal() {
  importModal.hidden = false;
  importNote.textContent = "";
  importText.focus();
}

function closeImportModal() {
  importModal.hidden = true;
}

function openRecordModal(key) {
  const record = findRecordByKey(key);
  if (!record) return;

  editRecordKey.value = key;
  editDayInput.value = record.day || "";
  editDateInput.value = record.date || "";
  editWeightInput.value = Number.isFinite(record.weight) ? record.weight.toFixed(2) : "";
  editWaistInput.value = Number.isFinite(record.waist) ? record.waist.toFixed(2) : "";
  editTrainingPartInput.value = record.trainingPart || "";
  editCardioInput.value = record.cardio || "";
  editTrainingActionsInput.value = record.trainingActions || "";
  editRestDayInput.checked = Boolean(record.isRestDay);
  editPausedInput.checked = Boolean(record.isPaused);
  recordEditNote.textContent = "";
  recordModal.hidden = false;
}

function closeRecordModal() {
  recordModal.hidden = true;
}

function getEditedRecord() {
  const source = findRecordByKey(editRecordKey.value) || {};
  const nextDay = Number.parseInt(editDayInput.value, 10);
  const weight = Number.parseFloat(editWeightInput.value);
  const waist = Number.parseFloat(editWaistInput.value);

  return {
    ...source,
    day: Number.isFinite(nextDay) ? nextDay : null,
    date: editDateInput.value,
    weight: Number.isFinite(weight) ? Math.round(weight * 100) / 100 : null,
    waist: Number.isFinite(waist) ? Math.round(waist * 100) / 100 : null,
    trainingPart: editTrainingPartInput.value.trim(),
    cardio: editCardioInput.value.trim(),
    trainingActions: editTrainingActionsInput.value.trim(),
    isRestDay: editRestDayInput.checked,
    isPaused: editPausedInput.checked,
  };
}

function resetImportPreview() {
  importPreviewRecords = [];
  importSkippedLines = [];
  importFailedLines = [];
  previewBody.innerHTML = "";
  skippedList.innerHTML = "";
  failedList.innerHTML = "";
  previewWrap.hidden = true;
  skippedBox.hidden = true;
  failedBox.hidden = true;
  duplicateOptions.hidden = true;
  confirmImportButton.disabled = false;
}

function getDuplicateMode() {
  return document.querySelector("input[name='duplicateMode']:checked")?.value || "overwrite";
}

function commitImportPreview() {
  const validPreviewRecords = importPreviewRecords.filter((item) => !item.hasError);
  if (!validPreviewRecords.length) {
    importNote.textContent = "请先解析预览";
    return;
  }

  const duplicateMode = getDuplicateMode();
  let imported = 0;
  let skipped = 0;

  validPreviewRecords.forEach((item) => {
    if (item.isDuplicate && duplicateMode === "skip") {
      skipped += 1;
      return;
    }

    upsertRecord({
      day: item.day,
      date: item.date,
      weight: item.weight,
      waist: item.waist,
      trainingPart: item.trainingPart,
      trainingActions: item.trainingActions,
      cardio: item.cardio,
      isRestDay: item.isRestDay,
      sourceText: item.sourceText,
    });
    imported += 1;
  });

  render();
  resetImportPreview();
  closeImportModal();
  saveNote.textContent = `已导入 ${imported} 条，跳过 ${skipped} 条。`;
}

function handleParseImportClick() {
  const parsedImport = parseImportText(importText.value);
  importPreviewRecords = parsedImport.records;
  importSkippedLines = parsedImport.skipped;
  importFailedLines = parsedImport.failed;
  renderPreview();
  const validCount = importPreviewRecords.filter((item) => !item.hasError).length;
  const duplicateCount = importPreviewRecords.filter((item) => item.isDuplicate).length;
  importNote.textContent = `成功识别 ${validCount} 条记录，${duplicateCount} 条重复 Day，跳过 ${importSkippedLines.length} 行，失败 ${importFailedLines.length} 行。`;
}

function handleConfirmImportClick() {
  commitImportPreview();
}

function renderAuthState() {
  if (!cloudReady) {
    accountEmail.textContent = "未登录";
    authOpenButton.hidden = false;
    uploadLocalButton.hidden = true;
    pullCloudButton.hidden = true;
    logoutButton.hidden = true;
    setSyncStatus("本地模式", "Supabase 未配置，登录后可云同步");
    return;
  }

  if (!currentUser) {
    accountEmail.textContent = "未登录";
    authOpenButton.hidden = false;
    uploadLocalButton.hidden = true;
    pullCloudButton.hidden = true;
    logoutButton.hidden = true;
    setSyncStatus("本地模式", "登录后可云同步");
    return;
  }

  accountEmail.textContent = currentUser.email || "已登录";
  authOpenButton.hidden = true;
  uploadLocalButton.hidden = false;
  pullCloudButton.hidden = false;
  logoutButton.hidden = false;
  setSyncStatus("云同步已开启", currentUser.email || "");
}

async function afterAuthChanged(user) {
  currentUser = user;
  renderAuthState();
  if (!currentUser) return;

  const localSnapshot = records.map((record) => ({ ...record }));
  const cloudRecords = await fetchCloudRecords();
  const migrationKey = getMigrationKey();
  const localDayCount = new Set(localSnapshot.filter((record) => Number.isFinite(record.day)).map((record) => record.day)).size;
  const cloudDayCount = new Set(cloudRecords.filter((record) => Number.isFinite(record.day)).map((record) => record.day)).size;
  const shouldSuggestMigration = localDayCount > 0 && cloudDayCount < localDayCount;

  if (shouldSuggestMigration && !localStorage.getItem(migrationKey)) {
    const shouldUpload = window.confirm("检测到本地历史数据，是否上传到云端同步？");
    if (shouldUpload) await uploadLocalRecordsToCloud(localSnapshot);
    else localStorage.setItem(migrationKey, "skipped");
  }
}

async function initSupabase() {
  if (!isSupabaseConfigured()) {
    cloudReady = false;
    renderAuthState();
    return;
  }

  const config = getSupabaseConfig();
  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  cloudReady = true;

  const { data } = await supabaseClient.auth.getSession();
  await afterAuthChanged(data.session?.user || null);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    afterAuthChanged(session?.user || null);
  });
}

function openAuthModal() {
  authModal.hidden = false;
  authNote.textContent = cloudReady ? "" : "Supabase 未配置，当前只能使用本地模式。";
  authEmailInput.focus();
}

function closeAuthModal() {
  authModal.hidden = true;
}

async function signInWithEmail() {
  if (!cloudReady) {
    authNote.textContent = "Supabase 未配置，无法登录。";
    return;
  }

  authNote.textContent = "登录中...";
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: authEmailInput.value.trim(),
    password: authPasswordInput.value,
  });
  if (error) {
    authNote.textContent = error.message;
    return;
  }
  authNote.textContent = "登录成功。";
  closeAuthModal();
}

async function signUpWithEmail() {
  if (!cloudReady) {
    authNote.textContent = "Supabase 未配置，无法注册。";
    return;
  }

  authNote.textContent = "注册中...";
  const { error } = await supabaseClient.auth.signUp({
    email: authEmailInput.value.trim(),
    password: authPasswordInput.value,
  });
  if (error) {
    authNote.textContent = error.message;
    return;
  }
  authNote.textContent = "注册成功，请按 Supabase 项目设置完成邮箱确认或直接登录。";
}

async function signOut() {
  if (!cloudReady || !supabaseClient) return;
  await supabaseClient.auth.signOut();
  currentUser = null;
  renderAuthState();
}

function render() {
  renderStats();
  renderRecords();
  drawChart();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const manualDay = Number.parseInt(dayInput.value, 10);
  const date = dateInput.value;
  const isPaused = pauseMetricsInput.checked;
  const isRestDay = restDayInput.checked;
  const shouldRecordMetrics = !isPaused && !isRestDay;
  const weight = shouldRecordMetrics ? Number.parseFloat(weightInput.value) : Number.NaN;
  const waist = shouldRecordMetrics ? Number.parseFloat(waistInput.value) : Number.NaN;
  const trainingPart = trainingPartInput.value.trim();
  const trainingActions = trainingActionsInput.value.trim();

  if (!date) {
    saveNote.textContent = "请选择日期。";
    return;
  }

  upsertRecord({
    day: Number.isFinite(manualDay) ? manualDay : getNextDay(),
    date,
    weight: Number.isFinite(weight) ? Math.round(weight * 100) / 100 : null,
    waist: Number.isFinite(waist) ? Math.round(waist * 100) / 100 : null,
    trainingPart,
    trainingActions,
    cardio: trainingPart === "有氧" ? trainingActions : "",
    isRestDay,
    isPaused,
  });
  saveNote.textContent = "已保存。";
  dayInput.value = "";
  weightInput.value = "";
  waistInput.value = "";
  trainingPartInput.value = "";
  trainingActionsInput.value = "";
  restDayInput.checked = false;
  pauseMetricsInput.checked = false;
  updateMetricInputsState();
  render();
});

function handleRecordAction(event) {
  const button = event.target.closest("button[data-key]");
  if (!button) return;

  event.stopPropagation();
  const { action, key } = button.dataset;
  if (!key) return;

  if (action === "edit") {
    openRecordModal(key);
    return;
  }
  if (action === "delete") {
    deleteRecord(key);
    saveNote.textContent = "已删除记录。";
  }
}

recordsBody.addEventListener("click", handleRecordAction);
recordCards.addEventListener("click", handleRecordAction);

recordEditForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const originalKey = editRecordKey.value;
  if (!originalKey) return;

  const nextRecord = getEditedRecord();
  if (!nextRecord.day && !nextRecord.date) {
    recordEditNote.textContent = "请至少保留 Day 或日期。";
    return;
  }

  replaceRecordByKey(originalKey, nextRecord);
  closeRecordModal();
  saveNote.textContent = "已保存修改。";
});

deleteRecordButton.addEventListener("click", () => {
  const key = editRecordKey.value;
  if (!key) return;
  deleteRecord(key);
  closeRecordModal();
  saveNote.textContent = "已删除记录。";
});

closeRecordButton.addEventListener("click", closeRecordModal);
cancelRecordButton.addEventListener("click", closeRecordModal);

recordModal.addEventListener("click", (event) => {
  if (event.target === recordModal) closeRecordModal();
});

fillTodayButton.addEventListener("click", setToday);
pauseMetricsInput.addEventListener("change", updateMetricInputsState);
restDayInput.addEventListener("change", updateMetricInputsState);

importButton.addEventListener("click", openImportModal);
closeImportButton.addEventListener("click", closeImportModal);
cancelImportButton.addEventListener("click", closeImportModal);

importModal.addEventListener("click", (event) => {
  if (event.target === importModal) closeImportModal();
});

parseImportButton.addEventListener("click", handleParseImportClick);
confirmImportButton.addEventListener("click", handleConfirmImportClick);

authOpenButton.addEventListener("click", openAuthModal);
closeAuthButton.addEventListener("click", closeAuthModal);
logoutButton.addEventListener("click", signOut);
signupButton.addEventListener("click", signUpWithEmail);
uploadLocalButton.addEventListener("click", () => uploadLocalRecordsToCloud(records.map((record) => ({ ...record }))));
pullCloudButton.addEventListener("click", fetchCloudRecords);

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  signInWithEmail();
});

authModal.addEventListener("click", (event) => {
  if (event.target === authModal) closeAuthModal();
});

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
updateMetricInputsState();
render();
initSupabase();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // PWA registration can fail on file:// or unsupported browsers.
    });
  });
}
