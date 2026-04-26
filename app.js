const SETTINGS_STORAGE_KEY = "monthly-money-meeting-settings-v1";
const CATEGORY_SETTINGS_STORAGE_KEY = "monthly-money-meeting-category-settings-v1";
const PERIOD_DATA_STORAGE_PREFIX = "monthly-money-meeting-period-data-";
const POLICY_PRESETS_STORAGE_KEY = "monthly-money-meeting-policy-presets-v1";

const DEFAULT_POLICY_PRESETS = [
  {
    id: "default-stable",
    name: "初期テンプレート（バランス型）",
    isDefault: true,
    description: "迷ったときに使いやすい、バランス型の初期テンプレートです。",
    rates: {
      food: 35,
      transport: 10,
      social: 8,
      date: 7,
      hobby: 6,
      fashion: 5,
      study: 4,
      reserve: 15,
      saving: 10,
    },
  },
];

let policyPresets = [];
let selectedPolicyPresetId = "default-stable";
let activePeriodKey = "";
let autosaveTimer = null;
let hasUnsavedChanges = false;
let categorySettings = {};


const TUTORIAL_STORAGE_KEY = "hanemy-tutorial-seen-v1";
const tutorialSteps = [
  { title: "まずは今月の準備", text: "管理する1か月、収入、固定費、予算の配分を入れると、自由に使えるお金が見えてきます。" },
  { title: "ハネミーは家計簿ではありません", text: "毎日細かく入力しなくても大丈夫です。大きめに使ったときだけ、使った額をざっくり更新してください。" },
  { title: "見るべき数字は2つ", text: "普段は「自由に使えるお金」と「今月あと使えるお金」を見れば、使いすぎの前に気づけます。" },
];
let tutorialStepIndex = 0;

function updateTutorial() {
  const overlay = getElement("tutorialOverlay");
  if (!overlay) return;

  const step = tutorialSteps[tutorialStepIndex];
  getElement("tutorialStepLabel").textContent = (tutorialStepIndex + 1) + " / " + tutorialSteps.length;
  getElement("tutorialTitle").textContent = step.title;
  getElement("tutorialText").textContent = step.text;

  document.querySelectorAll(".tutorial-dots span").forEach((dot, index) => {
    dot.classList.toggle("active", index === tutorialStepIndex);
  });

  getElement("tutorialNextButton").textContent = tutorialStepIndex === tutorialSteps.length - 1 ? "はじめる" : "次へ";
}

function closeTutorial() {
  const overlay = getElement("tutorialOverlay");
  if (!overlay) return;

  overlay.hidden = true;
  localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
}

function openTutorial(force = false) {
  const overlay = getElement("tutorialOverlay");
  if (!overlay) return;

  if (!force && localStorage.getItem(TUTORIAL_STORAGE_KEY) === "true") return;

  tutorialStepIndex = 0;
  updateTutorial();
  overlay.hidden = false;
}

function setupTutorial() {
  const overlay = getElement("tutorialOverlay");
  if (!overlay) return;

  getElement("tutorialNextButton").addEventListener("click", () => {
    if (tutorialStepIndex >= tutorialSteps.length - 1) {
      closeTutorial();
      return;
    }
    tutorialStepIndex += 1;
    updateTutorial();
  });

  getElement("tutorialSkipButton").addEventListener("click", closeTutorial);
  openTutorial(false);
}


const incomeIds = ["incomeJob", "incomeAllowance", "incomeOther"];

const fixedIds = [
  "fixedPhone",
  "fixedSubscription",
  "fixedPass",
  "fixedOther",
  "fixedCredit",
  "fixedPlanned",
];

const categories = [
  {
    defaultName: "食費",
    budgetId: "budgetFood",
    spentId: "spentFood",
    leftId: "leftFood",
    rateKey: "food",
    rateId: "rateFood",
    lockId: "lockFood",
    progressId: "progressFood",
    progressLabelId: "progressLabelFood",
  },
  {
    defaultName: "交通費",
    budgetId: "budgetTransport",
    spentId: "spentTransport",
    leftId: "leftTransport",
    rateKey: "transport",
    rateId: "rateTransport",
    lockId: "lockTransport",
    progressId: "progressTransport",
    progressLabelId: "progressLabelTransport",
  },
  {
    defaultName: "交際費",
    budgetId: "budgetSocial",
    spentId: "spentSocial",
    leftId: "leftSocial",
    rateKey: "social",
    rateId: "rateSocial",
    lockId: "lockSocial",
    progressId: "progressSocial",
    progressLabelId: "progressLabelSocial",
  },
  {
    defaultName: "デート代",
    budgetId: "budgetDate",
    spentId: "spentDate",
    leftId: "leftDate",
    rateKey: "date",
    rateId: "rateDate",
    lockId: "lockDate",
    progressId: "progressDate",
    progressLabelId: "progressLabelDate",
  },
  {
    defaultName: "趣味",
    budgetId: "budgetHobby",
    spentId: "spentHobby",
    leftId: "leftHobby",
    rateKey: "hobby",
    rateId: "rateHobby",
    lockId: "lockHobby",
    progressId: "progressHobby",
    progressLabelId: "progressLabelHobby",
  },
  {
    defaultName: "服・美容",
    budgetId: "budgetFashion",
    spentId: "spentFashion",
    leftId: "leftFashion",
    rateKey: "fashion",
    rateId: "rateFashion",
    lockId: "lockFashion",
    progressId: "progressFashion",
    progressLabelId: "progressLabelFashion",
  },
  {
    defaultName: "勉強",
    budgetId: "budgetStudy",
    spentId: "spentStudy",
    leftId: "leftStudy",
    rateKey: "study",
    rateId: "rateStudy",
    lockId: "lockStudy",
    progressId: "progressStudy",
    progressLabelId: "progressLabelStudy",
  },
  {
    defaultName: "予備費",
    budgetId: "budgetReserve",
    spentId: "spentReserve",
    leftId: "leftReserve",
    rateKey: "reserve",
    rateId: "rateReserve",
    lockId: "lockReserve",
    progressId: "progressReserve",
    progressLabelId: "progressLabelReserve",
  },
  {
    defaultName: "貯金",
    budgetId: "budgetSaving",
    spentId: "spentSaving",
    leftId: "leftSaving",
    rateKey: "saving",
    rateId: "rateSaving",
    lockId: "lockSaving",
    progressId: "progressSaving",
    progressLabelId: "progressLabelSaving",
  },
];

const budgetIds = categories.map((category) => category.budgetId);
const spentIds = categories.map((category) => category.spentId);
const rateIds = categories.map((category) => category.rateId);
const lockIds = categories.map((category) => category.lockId);

const periodDataInputIds = [
  ...incomeIds,
  ...fixedIds,
  ...budgetIds,
  ...spentIds,
  ...rateIds,
  ...lockIds,
];

const copyTargetIds = [
  ...incomeIds,
  ...fixedIds,
  ...budgetIds,
  ...rateIds,
  ...lockIds,
];

function getElement(id) {
  return document.getElementById(id);
}

function getNumber(id) {
  const element = getElement(id);
  const value = Number(element.value);

  if (Number.isNaN(value)) {
    return 0;
  }

  return value;
}

function getInputValue(id) {
  const element = getElement(id);

  if (element.type === "checkbox") {
    return element.checked;
  }

  return element.value;
}

function setInputValue(id, value) {
  const element = getElement(id);

  if (element.type === "checkbox") {
    element.checked = value === true || value === "true";
    return;
  }

  element.value = value;
}

function clearInput(id) {
  const element = getElement(id);

  if (element.type === "checkbox") {
    element.checked = false;
    return;
  }

  element.value = "";
}

function formatYen(amount) {
  return amount.toLocaleString("ja-JP");
}

function formatDate(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function roundDownToHundred(amount) {
  return Math.floor(amount / 100) * 100;
}

function getCategoryName(category) {
  return categorySettings[category.rateKey]?.name || category.defaultName;
}

function isCategoryVisible(category) {
  return categorySettings[category.rateKey]?.visible !== false;
}

function getVisibleCategories() {
  return categories.filter(isCategoryVisible);
}

function sumCategoryValues(idName) {
  return getVisibleCategories().reduce((total, category) => total + getNumber(category[idName]), 0);
}

function showStatus(message, type = "success") {
  const status = getElement("statusMessage");

  if (!status) {
    return;
  }

  status.textContent = message;
  status.className = `status-message ${type} show`;

  window.clearTimeout(showStatus.timer);
  showStatus.timer = window.setTimeout(() => {
    if (!hasUnsavedChanges) {
      status.classList.remove("show");
    }
  }, 2600);
}

function setSaveState(state) {
  const status = getElement("statusMessage");

  if (!status) {
    return;
  }

  if (state === "dirty") {
    hasUnsavedChanges = true;
    status.textContent = "未保存の変更があります。";
    status.className = "status-message info show";
    return;
  }

  if (state === "saving") {
    status.textContent = "保存中...";
    status.className = "status-message info show";
    return;
  }

  if (state === "saved") {
    hasUnsavedChanges = false;
    status.textContent = "保存済みです。";
    status.className = "status-message success show";

    window.clearTimeout(setSaveState.timer);
    setSaveState.timer = window.setTimeout(() => {
      if (!hasUnsavedChanges) {
        status.classList.remove("show");
      }
    }, 2200);
  }
}

function scheduleAutosave() {
  setSaveState("dirty");

  window.clearTimeout(autosaveTimer);

  autosaveTimer = window.setTimeout(() => {
    autoSaveData();
  }, 1200);
}

function autoSaveData() {
  if (!activePeriodKey) {
    activePeriodKey = getCurrentPeriodKey();
  }

  setSaveState("saving");

  const data = getPeriodDataFromScreen();

  localStorage.setItem(activePeriodKey, JSON.stringify(data));
  saveSettings();
  renderPeriodHistorySelect();

  setSaveState("saved");
}

function setupStatusMessage() {
  if (getElement("statusMessage")) {
    return;
  }

  const topActions = document.querySelector(".top-actions");
  const app = document.querySelector(".app");
  const status = document.createElement("div");

  status.id = "statusMessage";
  status.className = "status-message";

  if (topActions) {
    topActions.appendChild(status);
  } else if (app) {
    app.insertBefore(status, app.children[1] || null);
  }
}

function setupCategoryEnhancements() {
  categories.forEach((category) => {
    const leftElement = getElement(category.leftId);

    if (!leftElement) {
      return;
    }

    const rowElement = leftElement.closest(".budget-row");

    if (!rowElement || rowElement.querySelector(`[data-extra-for="${category.budgetId}"]`)) {
      return;
    }

    const extra = document.createElement("div");
    extra.className = "budget-extra";
    extra.dataset.extraFor = category.budgetId;

    extra.innerHTML = `
      <div class="budget-lock-area">
        <label class="budget-lock">
          <input type="checkbox" id="${category.lockId}" />
          <span>この予算を固定する</span>
        </label>

        <details class="help-tip">
          <summary>？</summary>
          <p>
            自動配分を使っても、このカテゴリの予算を変更しません。
            交通費など、金額を決め打ちしたい項目に使います。
          </p>
        </details>
      </div>

      <div class="quick-spend-box">
        <p class="quick-spend-title">ざっくり支出追加</p>

        <div class="quick-spend-actions">
          <button type="button" class="mini-button" data-spend-id="${category.spentId}" data-amount="500">+500</button>
          <button type="button" class="mini-button" data-spend-id="${category.spentId}" data-amount="1000">+1000</button>
          <button type="button" class="mini-button" data-spend-id="${category.spentId}" data-amount="3000">+3000</button>
          <button type="button" class="mini-button secondary-mini" data-spend-id="${category.spentId}" data-amount="-1000">修正 -1000</button>
        </div>
      </div>

      <div class="budget-progress">
        <div id="${category.progressId}" class="budget-progress-bar"></div>
      </div>

      <small id="${category.progressLabelId}" class="budget-progress-label">0%使用</small>
    `;

    rowElement.appendChild(extra);
  });

  document.querySelectorAll("[data-spend-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const spentId = button.dataset.spendId;
      const amount = Number(button.dataset.amount);
      const nextValue = Math.max(0, getNumber(spentId) + amount);

      getElement(spentId).value = nextValue;
      updateScreen();
      scheduleAutosave();
    });
  });
}

function createDefaultCategorySettings() {
  const settings = {};

  categories.forEach((category) => {
    settings[category.rateKey] = {
      name: category.defaultName,
      visible: true,
    };
  });

  return settings;
}

function saveCategorySettings() {
  localStorage.setItem(CATEGORY_SETTINGS_STORAGE_KEY, JSON.stringify(categorySettings));
}

function loadCategorySettings() {
  const defaultSettings = createDefaultCategorySettings();
  const savedText = localStorage.getItem(CATEGORY_SETTINGS_STORAGE_KEY);

  if (!savedText) {
    categorySettings = defaultSettings;
    saveCategorySettings();
    return;
  }

  try {
    const savedSettings = JSON.parse(savedText);
    categorySettings = {
      ...defaultSettings,
      ...savedSettings,
    };
  } catch {
    categorySettings = defaultSettings;
    saveCategorySettings();
  }
}

function setupCategoryEditor() {
  const editor = getElement("categoryEditor");

  if (!editor) {
    return;
  }

  editor.innerHTML = "";

  categories.forEach((category) => {
    const item = document.createElement("div");
    item.className = "category-editor-row";

    item.innerHTML = `
      <label>
        カテゴリ名
        <input type="text" id="categoryName_${category.rateKey}" value="${getCategoryName(category)}" />
      </label>

      <label class="category-visible-label">
        <input type="checkbox" id="categoryVisible_${category.rateKey}" ${isCategoryVisible(category) ? "checked" : ""} />
        <span>表示する</span>
      </label>
    `;

    editor.appendChild(item);

    const nameInput = getElement(`categoryName_${category.rateKey}`);
    const visibleInput = getElement(`categoryVisible_${category.rateKey}`);

    nameInput.addEventListener("input", () => {
      categorySettings[category.rateKey].name = nameInput.value.trim() || category.defaultName;
      saveCategorySettings();
      updateCategoryLabels();
      updateScreen();
      showStatus("カテゴリ名を更新しました。");
    });

    visibleInput.addEventListener("change", () => {
      categorySettings[category.rateKey].visible = visibleInput.checked;
      saveCategorySettings();
      updateCategoryLabels();
      updateScreen();
      showStatus("カテゴリ表示を更新しました。");
    });
  });
}

function updateCategoryLabels() {
  categories.forEach((category) => {
    const leftElement = getElement(category.leftId);

    if (!leftElement) {
      return;
    }

    const rowElement = leftElement.closest(".budget-row");
    const nameElement = rowElement.querySelector(":scope > span");

    nameElement.textContent = getCategoryName(category);
    rowElement.style.display = isCategoryVisible(category) ? "" : "none";
  });
}

function getSafePeriodStartDay() {
  const startDay = getNumber("periodStartDay");

  if (startDay < 1 || startDay > 28) {
    return 1;
  }

  return startDay;
}

function getManagementPeriod() {
  const today = new Date();
  const startDay = getSafePeriodStartDay();

  let startYear = today.getFullYear();
  let startMonth = today.getMonth();

  if (today.getDate() < startDay) {
    startMonth -= 1;
  }

  const startDate = new Date(startYear, startMonth, startDay);
  const endDate = new Date(startYear, startMonth + 1, startDay - 1);

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  return {
    startDate,
    endDate,
  };
}

function getCurrentPeriodKey() {
  const { startDate } = getManagementPeriod();
  return `${PERIOD_DATA_STORAGE_PREFIX}${formatDateKey(startDate)}`;
}

function getStartDateKeyFromPeriodStorageKey(storageKey) {
  return storageKey.replace(PERIOD_DATA_STORAGE_PREFIX, "");
}

function getPeriodLabelFromKey(storageKey) {
  const startDateKey = getStartDateKeyFromPeriodStorageKey(storageKey);
  const startDate = parseDateKey(startDateKey);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate() - 1);

  return `${formatDate(startDate)}〜${formatDate(endDate)}`;
}

function getRemainingDaysInActivePeriod() {
  const currentPeriodKey = getCurrentPeriodKey();

  if (activePeriodKey !== currentPeriodKey) {
    return 1;
  }

  const today = new Date();
  const { endDate } = getManagementPeriod();

  today.setHours(0, 0, 0, 0);

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const diff = endDate.getTime() - today.getTime();

  return Math.max(1, Math.floor(diff / millisecondsPerDay) + 1);
}

function updateCurrentPeriodText() {
  const { startDate, endDate } = getManagementPeriod();
  getElement("currentPeriodText").textContent = `${formatDate(startDate)}〜${formatDate(endDate)}`;
}

function updateActivePeriodText() {
  const activePeriodText = getElement("activePeriodText");
  const activePeriodNote = getElement("activePeriodNote");
  const currentPeriodKey = getCurrentPeriodKey();

  if (!activePeriodKey) {
    activePeriodKey = currentPeriodKey;
  }

  activePeriodText.textContent = getPeriodLabelFromKey(activePeriodKey);

  if (activePeriodKey === currentPeriodKey) {
    activePeriodNote.textContent = "現在の管理期間を表示しています。";
  } else {
    activePeriodNote.textContent = "過去の管理期間を表示しています。保存すると、この過去期間のデータが更新されます。";
  }
}

function saveSettings() {
  const settings = {
    periodStartDay: getElement("periodStartDay").value,
  };

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const savedText = localStorage.getItem(SETTINGS_STORAGE_KEY);

  if (!savedText) {
    getElement("periodStartDay").value = "1";
    return;
  }

  try {
    const settings = JSON.parse(savedText);

    if (settings.periodStartDay !== undefined) {
      getElement("periodStartDay").value = settings.periodStartDay;
    }
  } catch {
    getElement("periodStartDay").value = "1";
  }
}

function createDefaultPolicyPresets() {
  return JSON.parse(JSON.stringify(DEFAULT_POLICY_PRESETS));
}

function savePolicyPresetsToStorage() {
  localStorage.setItem(POLICY_PRESETS_STORAGE_KEY, JSON.stringify(policyPresets));
}

function loadPolicyPresetsFromStorage() {
  const savedText = localStorage.getItem(POLICY_PRESETS_STORAGE_KEY);

  if (!savedText) {
    policyPresets = createDefaultPolicyPresets();
    savePolicyPresetsToStorage();
    return;
  }

  try {
    const savedPresets = JSON.parse(savedText);

    if (!Array.isArray(savedPresets)) {
      policyPresets = createDefaultPolicyPresets();
      savePolicyPresetsToStorage();
      return;
    }

    const hasDefaultPreset = savedPresets.some((preset) => preset.id === "default-stable");

    if (hasDefaultPreset) {
      policyPresets = savedPresets;
    } else {
      policyPresets = [...createDefaultPolicyPresets(), ...savedPresets];
      savePolicyPresetsToStorage();
    }
  } catch {
    policyPresets = createDefaultPolicyPresets();
    savePolicyPresetsToStorage();
  }
}

function ensureSelectedPresetExists() {
  const exists = policyPresets.some((preset) => preset.id === selectedPolicyPresetId);

  if (!exists) {
    selectedPolicyPresetId = "default-stable";
  }
}

function getSelectedPolicyPreset() {
  ensureSelectedPresetExists();
  return policyPresets.find((preset) => preset.id === selectedPolicyPresetId) || policyPresets[0];
}

function renderPolicyPresetSelect() {
  const select = getElement("policyPresetSelect");
  select.innerHTML = "";

  ensureSelectedPresetExists();

  policyPresets.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    select.appendChild(option);
  });

  select.value = selectedPolicyPresetId;
}

function getSavedPeriodKeys() {
  const keys = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);

    if (key && key.startsWith(PERIOD_DATA_STORAGE_PREFIX)) {
      keys.push(key);
    }
  }

  return keys.sort().reverse();
}

function renderPeriodHistorySelect() {
  const select = getElement("periodHistorySelect");
  const savedPeriodKeys = getSavedPeriodKeys();

  select.innerHTML = "";

  if (savedPeriodKeys.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "保存済み期間はまだありません";
    select.appendChild(option);
    return;
  }

  savedPeriodKeys.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getPeriodLabelFromKey(key);

    if (key === activePeriodKey) {
      option.selected = true;
    }

    select.appendChild(option);
  });
}

function applyRatesToRateInputs(rates) {
  categories.forEach((category) => {
    const rate = rates[category.rateKey];

    if (rate !== undefined) {
      getElement(category.rateId).value = rate;
    }
  });
}

function updatePolicyComment() {
  const preset = getSelectedPolicyPreset();

  if (!preset) {
    getElement("policyComment").textContent = "";
    return;
  }

  getElement("policyComment").textContent = preset.description || "保存した配分です。";
}

function updatePolicyRateSummary() {
  const preset = getSelectedPolicyPreset();
  const summary = getElement("policyRateSummary");

  summary.innerHTML = "";

  if (!preset) {
    return;
  }

  getVisibleCategories().forEach((category) => {
    const rate = Number(preset.rates[category.rateKey] || 0);

    const item = document.createElement("span");
    item.className = "rate-chip";
    item.textContent = `${getCategoryName(category)} ${rate}%`;

    summary.appendChild(item);
  });
}

function updateCategoryLeft() {
  categories.forEach((category) => {
    const budget = getNumber(category.budgetId);
    const spent = getNumber(category.spentId);
    const left = budget - spent;

    const leftElement = getElement(category.leftId);
    const rowElement = leftElement.closest(".budget-row");
    const progressElement = getElement(category.progressId);
    const progressLabelElement = getElement(category.progressLabelId);
    const lockElement = getElement(category.lockId);

    leftElement.textContent = formatYen(left);

    rowElement.classList.remove("over-budget", "low-budget", "locked-budget");

    if (left < 0) {
      rowElement.classList.add("over-budget");
    } else if (budget > 0 && left <= budget * 0.2) {
      rowElement.classList.add("low-budget");
    }

    if (lockElement && lockElement.checked) {
      rowElement.classList.add("locked-budget");
    }

    const progressRatio = budget > 0 ? spent / budget : 0;
    const visualPercent = Math.max(0, Math.min(100, progressRatio * 100));
    const labelPercent = budget > 0 ? Math.round(progressRatio * 100) : 0;

    progressElement.style.width = `${visualPercent}%`;
    progressElement.classList.toggle("over", progressRatio > 1);
    progressElement.classList.toggle("low", progressRatio >= 0.8 && progressRatio <= 1);

    progressLabelElement.textContent = `${labelPercent}%使用`;
  });
}


function updateCategoryOverview() {
  const overview = getElement("categoryOverview");

  if (!overview) {
    return;
  }

  const visibleCategories = getVisibleCategories();
  const activeCategories = visibleCategories.filter((category) => {
    return getNumber(category.budgetId) > 0 || getNumber(category.spentId) > 0;
  });

  if (activeCategories.length === 0) {
    overview.innerHTML = '<p class="category-overview-empty">まだカテゴリ別の予算がありません。月初設定でざっくり予算を決めると、ここに使用状況が出ます。</p>';
    return;
  }

  overview.innerHTML = "";

  activeCategories.forEach((category) => {
    const budget = getNumber(category.budgetId);
    const spent = getNumber(category.spentId);
    const left = budget - spent;
    const ratio = budget > 0 ? spent / budget : 0;
    const percent = Math.max(0, Math.min(100, ratio * 100));
    const labelPercent = budget > 0 ? Math.round(ratio * 100) : 0;
    let state = "safe";

    if (left < 0) {
      state = "danger";
    } else if (budget > 0 && left <= budget * 0.2) {
      state = "caution";
    }

    const row = document.createElement("div");
    row.className = `category-overview-row ${state}`;
    row.innerHTML = `
      <span class="category-overview-name">${getCategoryName(category)}</span>
      <span class="category-overview-track"><span class="category-overview-bar" style="width: ${percent}%"></span></span>
      <span class="category-overview-value">${labelPercent}%</span>
    `;
    overview.appendChild(row);
  });
}

function getTotalRate() {
  return getVisibleCategories().reduce((total, category) => total + getNumber(category.rateId), 0);
}

function updateRateInfo() {
  const totalRate = getTotalRate();

  getElement("totalRate").textContent = totalRate;

  const rateWarning = getElement("rateWarning");

  if (totalRate > 100) {
    rateWarning.textContent = `${totalRate - 100}% オーバーしています。合計が100%以内になるように調整してください。`;
  } else if (totalRate < 100 && totalRate > 0) {
    rateWarning.textContent = `${100 - totalRate}% はまだ配分していないお金として残ります。`;
  } else {
    rateWarning.textContent = "";
  }
}


function getBudgetStateForUi(leftInBudget, totalBudget, remainingMoney) {
  if (remainingMoney < 0 || leftInBudget < 0) {
    return { key: "danger", label: "危険" };
  }

  if (totalBudget > 0 && leftInBudget <= totalBudget * 0.2) {
    return { key: "caution", label: "注意" };
  }

  if (totalBudget > 0) {
    return { key: "safe", label: "安定" };
  }

  return { key: "neutral", label: "未設定" };
}

function updateStickyBudgetBar(leftInBudget, totalBudget, remainingMoney) {
  const bar = getElement("stickyBudgetBar");

  if (!bar) {
    return;
  }

  const state = getBudgetStateForUi(leftInBudget, totalBudget, remainingMoney);
  bar.textContent = `今月あと使えるお金：${formatYen(leftInBudget)}円 ｜ ${state.label}`;
  bar.className = `sticky-budget-bar ${state.key}`;
}

function setupStickyBudgetBar() {
  const bar = getElement("stickyBudgetBar");
  const summary = document.querySelector(".summary");

  if (!bar || !summary || !("IntersectionObserver" in window)) {
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    bar.classList.toggle("show", !entry.isIntersecting);
    bar.setAttribute("aria-hidden", entry.isIntersecting ? "true" : "false");
  }, {
    threshold: 0,
    rootMargin: "-56px 0px 0px 0px",
  });

  observer.observe(summary);
}


function updateScreen() {
  const totalIncome = incomeIds.reduce((total, id) => total + getNumber(id), 0);
  const totalFixed = fixedIds.reduce((total, id) => total + getNumber(id), 0);
  const freeMoney = totalIncome - totalFixed;

  const totalBudget = sumCategoryValues("budgetId");
  const totalSpent = sumCategoryValues("spentId");

  const remainingMoney = freeMoney - totalBudget;
  const leftInBudget = totalBudget - totalSpent;

  updateStickyBudgetBar(leftInBudget, totalBudget, remainingMoney);

  getElement("totalIncome").textContent = formatYen(totalIncome);
  getElement("totalFixed").textContent = formatYen(totalFixed);
  getElement("freeMoney").textContent = formatYen(freeMoney);

  getElement("totalBudget").textContent = formatYen(totalBudget);
  getElement("totalSpent").textContent = formatYen(totalSpent);
  getElement("remainingMoney").textContent = formatYen(remainingMoney);
  getElement("leftInBudget").textContent = formatYen(leftInBudget);

  const summaryLeftInBudget = getElement("summaryLeftInBudget");

  if (summaryLeftInBudget) {
    summaryLeftInBudget.textContent = formatYen(leftInBudget);
  }

  const remainingDays = getRemainingDaysInActivePeriod();
  const todaySafe = leftInBudget > 0 ? roundDownToHundred(leftInBudget / remainingDays) : 0;
  const summaryRemainingDays = getElement("summaryRemainingDays");
  const summaryTodaySafe = getElement("summaryTodaySafe");
  const summaryPeriodShort = getElement("summaryPeriodShort");

  if (summaryRemainingDays) {
    summaryRemainingDays.textContent = remainingDays;
  }

  if (summaryTodaySafe) {
    summaryTodaySafe.textContent = formatYen(todaySafe);
  }

  if (summaryPeriodShort) {
    summaryPeriodShort.textContent = getPeriodLabelFromKey(activePeriodKey || getCurrentPeriodKey());
  }

  const warning = getElement("warning");
  const budgetStatus = getElement("budgetStatus");

  if (remainingMoney < 0) {
    warning.textContent = `${formatYen(Math.abs(remainingMoney))}円オーバーしています。表示中の管理期間の予算時点で使える金額を超えています。`;

    if (budgetStatus) {
      budgetStatus.textContent = "配分した予算が自由に使える金額を超えています";
      budgetStatus.className = "budget-status danger";
    }
  } else if (leftInBudget < 0) {
    warning.textContent = `${formatYen(Math.abs(leftInBudget))}円使いすぎています。どこかのカテゴリを再調整する必要があります。`;

    if (budgetStatus) {
      budgetStatus.textContent = "どこかのカテゴリで使いすぎています";
      budgetStatus.className = "budget-status danger";
    }
  } else if (totalBudget > 0 && leftInBudget <= totalBudget * 0.2) {
    warning.textContent = "";

    if (budgetStatus) {
      budgetStatus.textContent = "今月の残りは少なめです";
      budgetStatus.className = "budget-status caution";
    }
  } else if (totalBudget > 0) {
    warning.textContent = "";

    if (budgetStatus) {
      budgetStatus.textContent = "今月はこのままのペースで大丈夫そうです";
      budgetStatus.className = "budget-status safe";
    }
  } else {
    warning.textContent = "";

    if (budgetStatus) {
      budgetStatus.textContent = "まだ予算が作られていません";
      budgetStatus.className = "budget-status neutral";
    }
  }

  updateCurrentPeriodText();
  updateActivePeriodText();
  updateCategoryLabels();
  updateCategoryLeft();
  updateCategoryOverview();
  updatePolicyComment();
  updatePolicyRateSummary();
  updateRateInfo();
  renderPeriodHistorySelect();
}

function getLockedCategories() {
  return getVisibleCategories().filter((category) => {
    const lockElement = getElement(category.lockId);
    return lockElement && lockElement.checked;
  });
}

function applyRatesToBudgets(rates) {
  const totalIncome = incomeIds.reduce((total, id) => total + getNumber(id), 0);
  const totalFixed = fixedIds.reduce((total, id) => total + getNumber(id), 0);
  const freeMoney = totalIncome - totalFixed;

  if (freeMoney <= 0) {
    alert("自由に使える金額が0円以下です。収入と固定費を確認してください。");
    return;
  }

  const visibleCategories = getVisibleCategories();

  const totalRate = visibleCategories.reduce((sum, category) => {
    return sum + Number(rates[category.rateKey] || 0);
  }, 0);

  if (totalRate <= 0) {
    alert("配分割合が0%です。割合を確認してください。");
    return;
  }

  const lockedCategories = getLockedCategories();
  const unlockedCategories = visibleCategories.filter((category) => {
    return !lockedCategories.some((locked) => locked.budgetId === category.budgetId);
  });

  const lockedBudgetTotal = lockedCategories.reduce((sum, category) => {
    return sum + getNumber(category.budgetId);
  }, 0);

  const targetBudgetTotal = freeMoney * (totalRate / 100);
  const remainingTargetBudget = targetBudgetTotal - lockedBudgetTotal;

  const unlockedRateTotal = unlockedCategories.reduce((sum, category) => {
    return sum + Number(rates[category.rateKey] || 0);
  }, 0);

  if (remainingTargetBudget < 0) {
    unlockedCategories.forEach((category) => {
      getElement(category.budgetId).value = 0;
    });

    updateScreen();
    showStatus("固定予算だけで配分目標を超えています。固定額を見直してください。", "warning");
    return;
  }

  let allocatedTotal = 0;
  const categoriesWithRate = unlockedCategories.filter((category) => {
    return Number(rates[category.rateKey] || 0) > 0;
  });

  unlockedCategories.forEach((category) => {
    const rate = Number(rates[category.rateKey] || 0);

    if (unlockedRateTotal <= 0 || rate <= 0) {
      getElement(category.budgetId).value = 0;
      return;
    }

    const isLastRatedCategory = categoriesWithRate[categoriesWithRate.length - 1]?.budgetId === category.budgetId;
    const recommendedAmount = isLastRatedCategory
      ? Math.max(0, Math.round(remainingTargetBudget - allocatedTotal))
      : roundDownToHundred(remainingTargetBudget * (rate / unlockedRateTotal));

    getElement(category.budgetId).value = recommendedAmount;
    allocatedTotal += recommendedAmount;
  });

  updateScreen();
}

function applySelectedPolicyPreset() {
  const preset = getSelectedPolicyPreset();

  if (!preset) {
    alert("配分が見つかりません。");
    return;
  }

  applyRatesToRateInputs(preset.rates);
  applyRatesToBudgets(preset.rates);
  scheduleAutosave();

  showStatus("選択中の配分で予算を分けました。固定した予算は変更していません。");
}

function getRatesFromInputs() {
  const rates = {};

  categories.forEach((category) => {
    rates[category.rateKey] = getNumber(category.rateId);
  });

  return rates;
}

function applyCustomRate() {
  const totalRate = getTotalRate();

  if (totalRate <= 0) {
    alert("割合を入力してください。");
    return;
  }

  if (totalRate > 100) {
    alert("割合の合計が100%を超えています。少し調整してください。");
    return;
  }

  applyRatesToBudgets(getRatesFromInputs());
  scheduleAutosave();

  showStatus("入力した割合で予算を分けました。固定した予算は変更していません。");
}

function createPresetId() {
  return `user-${Date.now()}`;
}

function saveNamedPreset() {
  const nameInput = getElement("presetNameInput");
  const name = nameInput.value.trim();
  const totalRate = getTotalRate();

  if (!name) {
    alert("配分の名前を入力してください。");
    return;
  }

  if (totalRate <= 0) {
    alert("保存する割合を入力してください。");
    return;
  }

  if (totalRate > 100) {
    alert("割合の合計が100%を超えています。100%以内に調整してください。");
    return;
  }

  const duplicate = policyPresets.find((preset) => preset.name === name);

  if (duplicate) {
    const result = confirm("同じ名前の配分があります。上書きしますか？");

    if (!result) {
      return;
    }

    if (duplicate.isDefault) {
      alert("初期テンプレートは上書きできません。別の名前にしてください。");
      return;
    }

    duplicate.rates = getRatesFromInputs();
    duplicate.description = "保存した配分です。";
    selectedPolicyPresetId = duplicate.id;
  } else {
    const newPreset = {
      id: createPresetId(),
      name,
      isDefault: false,
      description: "保存した配分です。",
      rates: getRatesFromInputs(),
    };

    policyPresets.push(newPreset);
    selectedPolicyPresetId = newPreset.id;
  }

  savePolicyPresetsToStorage();
  renderPolicyPresetSelect();

  getElement("policyPresetSelect").value = selectedPolicyPresetId;
  nameInput.value = "";

  updateScreen();

  showStatus("配分を保存しました。");
}

function deleteSelectedPolicyPreset() {
  const preset = getSelectedPolicyPreset();

  if (!preset) {
    alert("削除する配分が見つかりません。");
    return;
  }

  if (preset.isDefault) {
    alert("初期テンプレートは削除できません。");
    return;
  }

  const result = confirm(`「${preset.name}」を削除します。よろしいですか？`);

  if (!result) {
    return;
  }

  policyPresets = policyPresets.filter((item) => item.id !== preset.id);
  selectedPolicyPresetId = "default-stable";

  savePolicyPresetsToStorage();
  renderPolicyPresetSelect();

  getElement("policyPresetSelect").value = selectedPolicyPresetId;

  const defaultPreset = getSelectedPolicyPreset();

  if (defaultPreset) {
    applyRatesToRateInputs(defaultPreset.rates);
  }

  updateScreen();

  showStatus("配分を削除しました。");
}

function clearPeriodDataInputs() {
  periodDataInputIds.forEach((id) => {
    clearInput(id);
  });
}

function clearSpentInputs() {
  spentIds.forEach((id) => {
    getElement(id).value = "";
  });
}

function getPeriodDataFromScreen() {
  const data = {};

  periodDataInputIds.forEach((id) => {
    data[id] = getInputValue(id);
  });

  data.selectedPolicyPresetId = selectedPolicyPresetId;
  data.periodKey = activePeriodKey;

  return data;
}

function applyPeriodDataToScreen(data) {
  clearPeriodDataInputs();

  periodDataInputIds.forEach((id) => {
    if (data[id] !== undefined) {
      setInputValue(id, data[id]);
    }
  });

  if (data.selectedPolicyPresetId !== undefined) {
    selectedPolicyPresetId = data.selectedPolicyPresetId;
  } else {
    selectedPolicyPresetId = "default-stable";
  }

  ensureSelectedPresetExists();
  renderPolicyPresetSelect();
}

function saveData() {
  if (!activePeriodKey) {
    activePeriodKey = getCurrentPeriodKey();
  }

  window.clearTimeout(autosaveTimer);

  const data = getPeriodDataFromScreen();

  localStorage.setItem(activePeriodKey, JSON.stringify(data));
  saveSettings();
  renderPeriodHistorySelect();

  setSaveState("saved");
  showStatus("表示中の期間のデータを保存しました。");
}

function loadDataByPeriodKey(periodKey) {
  activePeriodKey = periodKey;

  const savedText = localStorage.getItem(activePeriodKey);

  if (!savedText) {
    clearPeriodDataInputs();

    selectedPolicyPresetId = "default-stable";
    renderPolicyPresetSelect();

    const defaultPreset = getSelectedPolicyPreset();

    if (defaultPreset) {
      applyRatesToRateInputs(defaultPreset.rates);
    }

    updateScreen();
    return;
  }

  try {
    const data = JSON.parse(savedText);
    applyPeriodDataToScreen(data);
    updateScreen();
  } catch {
    localStorage.removeItem(activePeriodKey);
    clearPeriodDataInputs();
    updateScreen();
  }
}

function loadCurrentPeriodData() {
  loadDataByPeriodKey(getCurrentPeriodKey());
  showStatus("現在の期間を表示しました。");
}

function loadSelectedPeriod() {
  const selectedKey = getElement("periodHistorySelect").value;

  if (!selectedKey) {
    alert("表示する保存済み期間がありません。");
    return;
  }

  loadDataByPeriodKey(selectedKey);
  showStatus("選択した期間を表示しました。");
}

function getPreviousPeriodKey() {
  const currentPeriodKey = getCurrentPeriodKey();
  const savedPeriodKeys = getSavedPeriodKeys();

  const currentStartDateKey = getStartDateKeyFromPeriodStorageKey(currentPeriodKey);
  const currentStartDate = parseDateKey(currentStartDateKey);

  let previousKey = "";

  savedPeriodKeys.forEach((key) => {
    const startDateKey = getStartDateKeyFromPeriodStorageKey(key);
    const startDate = parseDateKey(startDateKey);

    if (startDate < currentStartDate) {
      if (!previousKey) {
        previousKey = key;
        return;
      }

      const previousStartDate = parseDateKey(getStartDateKeyFromPeriodStorageKey(previousKey));

      if (startDate > previousStartDate) {
        previousKey = key;
      }
    }
  });

  return previousKey;
}

function copyPeriodDataToCurrentPeriod(sourceKey) {
  const currentPeriodKey = getCurrentPeriodKey();

  if (!sourceKey) {
    alert("コピーできる過去期間がありません。");
    return;
  }

  if (sourceKey === currentPeriodKey) {
    alert("現在の期間と同じ期間です。コピーは不要です。");
    return;
  }

  const savedText = localStorage.getItem(sourceKey);

  if (!savedText) {
    alert("選択した期間のデータが見つかりません。");
    return;
  }

  const result = confirm("選択した期間の収入・固定費・予算配分を、現在の期間へコピーします。使った額はコピーしません。よろしいですか？");

  if (!result) {
    return;
  }

  try {
    const sourceData = JSON.parse(savedText);

    activePeriodKey = currentPeriodKey;
    clearPeriodDataInputs();

    copyTargetIds.forEach((id) => {
      if (sourceData[id] !== undefined) {
        setInputValue(id, sourceData[id]);
      }
    });

    clearSpentInputs();

    if (sourceData.selectedPolicyPresetId !== undefined) {
      selectedPolicyPresetId = sourceData.selectedPolicyPresetId;
    } else {
      selectedPolicyPresetId = "default-stable";
    }

    ensureSelectedPresetExists();
    renderPolicyPresetSelect();

    updateScreen();
    scheduleAutosave();

    showStatus("現在の期間へコピーしました。使った額はコピーしていません。");
  } catch {
    alert("コピーに失敗しました。保存データが壊れている可能性があります。");
  }
}

function copySelectedPeriodToCurrentPeriod() {
  const selectedKey = getElement("periodHistorySelect").value;

  if (!selectedKey) {
    alert("コピーする保存済み期間がありません。");
    return;
  }

  copyPeriodDataToCurrentPeriod(selectedKey);
}

function copyPreviousPeriodToCurrentPeriod() {
  const previousKey = getPreviousPeriodKey();

  if (!previousKey) {
    alert("前回の期間データがありません。");
    return;
  }

  copyPeriodDataToCurrentPeriod(previousKey);
}

function deleteSelectedPeriod() {
  const selectedKey = getElement("periodHistorySelect").value;
  const currentPeriodKey = getCurrentPeriodKey();

  if (!selectedKey) {
    alert("削除する保存済み期間がありません。");
    return;
  }

  const result = confirm(`「${getPeriodLabelFromKey(selectedKey)}」の保存データを削除します。よろしいですか？`);

  if (!result) {
    return;
  }

  localStorage.removeItem(selectedKey);

  if (activePeriodKey === selectedKey) {
    activePeriodKey = currentPeriodKey;
    loadCurrentPeriodData();
  } else {
    renderPeriodHistorySelect();
    updateScreen();
  }

  showStatus("選択した期間データを削除しました。", "warning");
}

function resetData() {
  if (!activePeriodKey) {
    activePeriodKey = getCurrentPeriodKey();
  }

  const result = confirm("表示中の期間の入力内容をリセットします。収入・固定費・予算・使った額も消えます。よろしいですか？");

  if (!result) {
    return;
  }

  window.clearTimeout(autosaveTimer);
  localStorage.removeItem(activePeriodKey);

  clearPeriodDataInputs();

  selectedPolicyPresetId = "default-stable";
  renderPolicyPresetSelect();

  const defaultPreset = getSelectedPolicyPreset();

  if (defaultPreset) {
    applyRatesToRateInputs(defaultPreset.rates);
  }

  updateScreen();

  showStatus("表示中の期間をリセットしました。", "warning");
}

function handlePeriodStartDayChange() {
  saveSettings();
  loadCurrentPeriodData();
}


function isMobileViewport() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function openQuickSheet() {
  const backdrop = getElement("mobileSheetBackdrop");

  if (!isMobileViewport()) {
    getElement("atmInputTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  document.body.classList.add("quick-sheet-open");
  if (backdrop) backdrop.hidden = false;
}

function closeQuickSheet() {
  const backdrop = getElement("mobileSheetBackdrop");
  document.body.classList.remove("quick-sheet-open");
  if (backdrop) backdrop.hidden = true;
}

function setupTopActionJumps() {
  const quickButton = getElement("jumpQuickInputButton");
  const setupButton = getElement("jumpMonthlySetupButton");
  const closeButton = getElement("closeQuickSheetButton");
  const backdrop = getElement("mobileSheetBackdrop");

  if (quickButton) {
    quickButton.addEventListener("click", openQuickSheet);
  }

  if (setupButton) {
    setupButton.addEventListener("click", () => {
      const settingsCard = document.querySelector(".monthly-settings-card");
      if (settingsCard) settingsCard.open = true;
      settingsCard?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (closeButton) {
    closeButton.addEventListener("click", closeQuickSheet);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeQuickSheet);
  }

  window.addEventListener("resize", () => {
    if (!isMobileViewport()) {
      closeQuickSheet();
    }
  });
}

function setupMobileNavigation() {
  document.querySelectorAll(".mobile-nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;

      document.querySelectorAll(".mobile-nav-button").forEach((node) => {
        node.classList.toggle("is-active", node === button && target !== "quick");
      });

      if (target === "quick") {
        openQuickSheet();
        return;
      }

      if (target === "home") {
        getElement("homeSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
        closeQuickSheet();
        return;
      }

      if (target === "setup") {
        const settingsCard = getElement("setupSection");
        if (settingsCard) settingsCard.open = true;
        settingsCard?.scrollIntoView({ behavior: "smooth", block: "start" });
        closeQuickSheet();
        return;
      }

      if (target === "share") {
        getElement("shareSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
        closeQuickSheet();
      }
    });
  });
}

setupTopActionJumps();
setupMobileNavigation();
setupStickyBudgetBar();
setupStatusMessage();
setupTutorial();
setupCategoryEnhancements();
loadSettings();
loadCategorySettings();
setupCategoryEditor();
loadPolicyPresetsFromStorage();
renderPolicyPresetSelect();

periodDataInputIds.forEach((id) => {
  const element = getElement(id);

  element.addEventListener("input", () => {
    updateScreen();
    scheduleAutosave();
  });

  element.addEventListener("change", () => {
    updateScreen();
    scheduleAutosave();
  });
});

getElement("policyPresetSelect").addEventListener("change", () => {
  selectedPolicyPresetId = getElement("policyPresetSelect").value;

  const preset = getSelectedPolicyPreset();

  if (preset) {
    applyRatesToRateInputs(preset.rates);
  }

  updateScreen();
  scheduleAutosave();
});

getElement("periodStartDay").addEventListener("change", handlePeriodStartDayChange);
getElement("loadSelectedPeriodButton").addEventListener("click", loadSelectedPeriod);
getElement("copyPreviousPeriodButton").addEventListener("click", copyPreviousPeriodToCurrentPeriod);
getElement("copySelectedPeriodButton").addEventListener("click", copySelectedPeriodToCurrentPeriod);
getElement("deleteSelectedPeriodButton").addEventListener("click", deleteSelectedPeriod);
getElement("returnCurrentPeriodButton").addEventListener("click", loadCurrentPeriodData);

getElement("applyPolicyPresetButton").addEventListener("click", applySelectedPolicyPreset);
getElement("deletePolicyPresetButton").addEventListener("click", deleteSelectedPolicyPreset);
getElement("applyCustomRateButton").addEventListener("click", applyCustomRate);
getElement("saveNamedPresetButton").addEventListener("click", saveNamedPreset);
getElement("saveButton").addEventListener("click", saveData);
getElement("resetButton").addEventListener("click", resetData);

const initialPreset = getSelectedPolicyPreset();

if (initialPreset) {
  applyRatesToRateInputs(initialPreset.rates);
}

loadCurrentPeriodData();

const applyQuickInputButtonElement = getElement("applyQuickInputButton");
if (applyQuickInputButtonElement) {
  applyQuickInputButtonElement.addEventListener("click", () => {
    if (isMobileViewport()) {
      window.setTimeout(closeQuickSheet, 140);
    }
  });
}
