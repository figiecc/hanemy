(() => {
  "use strict";

  const STORAGE_KEY = "hanemy-state-v104e";
  const ANNOUNCEMENT_VERSION = 1;
  const LEGACY_STORAGE_KEYS = ["hanemy-state-v104d", "hanemy-state-v103", "hanemy-state-v102", "hanemy-state-v101", "hanemy-state-v100", "hanemy-state-v1", "hanemy-beta-v081-state", "hanemy-beta-v075-state", "hanemy-beta-v073-state", "hanemy-beta-v071-state", "hanemy-beta-v070-state", "hanemy-beta-v060-pastel-state"];
  const FIRST_RUN_KEY = "hanemy-first-run-v104e";

  const wantCategories = ["デート", "友達と遊ぶ", "外食", "服・美容", "趣味", "推し活", "旅行", "プレゼント", "その他"];
  const wantPriorities = ["ぜったい", "できれば", "余裕があれば"];
  const fixedKeys = ["homeMoney", "rent", "utility", "phone", "pass", "tuition", "subscription", "other"];
  const fixedInputMap = {
    homeMoney: "fixedHomeMoney",
    rent: "fixedRent",
    utility: "fixedUtility",
    phone: "fixedPhone",
    pass: "fixedPass",
    tuition: "fixedTuition",
    subscription: "fixedSubscription",
    other: "fixedOther",
  };
  const fixedLabels = {
    homeMoney: "家に入れる",
    rent: "家賃",
    utility: "光熱費",
    phone: "通信費",
    pass: "定期・通学",
    tuition: "学費",
    subscription: "サブスク",
    other: "その他",
  };
  const fixedPresets = {
    home: ["homeMoney", "phone", "pass", "tuition", "subscription", "other"],
    alone: ["rent", "utility", "phone", "pass", "tuition", "subscription", "other"],
    custom: ["homeMoney", "rent", "utility", "phone", "pass", "tuition", "subscription", "other"],
  };
  const livingPartKeys = ["food", "school", "other"];
  const livingPartInputMap = {
    food: "livingFoodMoney",
    school: "livingSchoolMoney",
    other: "livingOtherMoney",
  };
  const livingPartWeights = {
    food: 0.65,
    school: 0.2,
    other: 0.15,
  };

  let state = createInitialState();
  let selectedUnit = 1000;
  let spendTarget = "living";
  let selectedWantIndex = 0;
  let lastQuickAction = null;
  let lastSavingsCoverAction = null;

  function el(id) { return document.getElementById(id); }
  function yen(value) { return Math.round(Number(value || 0)).toLocaleString("ja-JP"); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function round100(value) { return Math.floor(Number(value || 0) / 100) * 100; }
  function digitsOnly(value) { return String(value ?? "").replace(/[^0-9]/g, ""); }
  function num(value) { const n = Number(digitsOnly(value)); return Number.isFinite(n) ? n : 0; }
  function inputNum(id) { return num(el(id)?.value); }
  function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
  function fmtMD(date) { return `${date.getMonth() + 1}/${date.getDate()}`; }

  function periodKeyForStartDay(startDay = 1, date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const safeStartDay = clamp(Number(startDay || 1), 1, 28);
    let year = d.getFullYear();
    let month = d.getMonth();
    if (d.getDate() < safeStartDay) month -= 1;
    const start = new Date(year, month, safeStartDay);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  }

  function currentPeriodKey() { return periodKeyForStartDay(state.periodStartDay || 1); }

  function createInitialState() {
    return {
      periodStartDay: 1,
      livingStyle: "custom",
      incomeTotal: 0,
      fixed: Object.fromEntries(fixedKeys.map((key) => [key, 0])),
      fixedVisible: [],
      wants: Array.from({ length: 3 }, () => ({ category: "", name: "", budget: 0, priority: "できれば", spent: 0 })),
      livingParts: Object.fromEntries(livingPartKeys.map((key) => [key, null])),
      savingMoney: null,
      spentLiving: 0,
      savingsTotal: 0,
      savingsCoverage: 0,
      monthKey: periodKeyForStartDay(1),
      setupSuccessShown: false,
      announcementSeenVersion: 0,
    };
  }

  function migrateLegacy(saved) {
    const initial = createInitialState();
    if (!saved) return initial;

    const incomeTotal = Number(saved.incomeTotal ?? 0) || Number(saved.income?.job || 0) + Number(saved.income?.allowance || 0) + Number(saved.income?.other || 0);
    const fixed = { ...initial.fixed, ...(saved.fixed || {}) };
    fixed.homeMoney = Number(saved.fixed?.homeMoney || 0);
    fixed.phone = Number(saved.fixed?.phone || 0);
    fixed.pass = Number(saved.fixed?.pass || 0);
    fixed.subscription = Number(saved.fixed?.subscription || 0);
    fixed.other = Number(saved.fixed?.other || 0);

    const fixedVisible = Array.isArray(saved.fixedVisible) && saved.fixedVisible.length
      ? saved.fixedVisible.filter((key) => fixedKeys.includes(key))
      : [...(fixedPresets[saved.livingStyle || "home"] || fixedPresets.home)];

    const spentLiving = Number(saved.spentLiving ?? 0) || Object.entries(saved.spent || {}).reduce((sum, [key, value]) => key === "savings" ? sum : sum + Number(value || 0), 0);
    const legacyLiving = saved.livingMoney ?? null;
    const livingParts = { ...initial.livingParts, ...(saved.livingParts || {}) };
    if (legacyLiving !== null && legacyLiving !== "" && Object.values(livingParts).every((value) => value === null || value === "" || Number(value || 0) === 0)) {
      livingParts.food = Math.round(Number(legacyLiving || 0) * 0.65);
      livingParts.school = Math.round(Number(legacyLiving || 0) * 0.2);
      livingParts.other = Math.max(0, Number(legacyLiving || 0) - livingParts.food - livingParts.school);
    }
    const savingMoney = saved.savingMoney ?? (saved.budgets?.savings ?? null);

    const wants = initial.wants.map((want, index) => ({ ...want, ...(saved.wants?.[index] || {}) }));

    return {
      ...initial,
      ...saved,
      periodStartDay: Number(saved.periodStartDay || 1),
      livingStyle: "custom",
      incomeTotal,
      fixed,
      fixedVisible,
      wants,
      livingParts,
      savingMoney,
      spentLiving,
      savingsTotal: Math.max(0, Number(saved.savingsTotal || 0)),
      savingsCoverage: Math.max(0, Number(saved.savingsCoverage || 0)),
      monthKey: saved.monthKey || currentPeriodKey(),
      announcementSeenVersion: Number(saved.announcementSeenVersion || 0),
    };
  }

  function readSavedState() {
    const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try { return JSON.parse(raw); } catch { /* ignore */ }
    }
    return null;
  }

  function load() { state = migrateLegacy(readSavedState()); }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  function getPeriod() {
    const now = today();
    const startDay = clamp(Number(state.periodStartDay || 1), 1, 28);
    let year = now.getFullYear();
    let month = now.getMonth();
    if (now.getDate() < startDay) month -= 1;
    const start = new Date(year, month, startDay);
    const end = new Date(year, month + 1, startDay - 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  function remainingDays() {
    const { end } = getPeriod();
    return Math.max(1, Math.floor((end - today()) / 86400000) + 1);
  }

  function elapsedDays() {
    const { start } = getPeriod();
    return Math.max(1, Math.floor((today() - start) / 86400000) + 1);
  }

  function visibleFixedKeys() {
    if (Array.isArray(state.fixedVisible) && state.fixedVisible.length) {
      return state.fixedVisible.filter((key) => fixedKeys.includes(key));
    }
    return fixedPresets.custom;
  }

  function fixedTotal() { return visibleFixedKeys().reduce((sum, key) => sum + Number(state.fixed[key] || 0), 0); }
  function activeWants() { return state.wants.map((want, index) => ({ ...want, index })).filter((want) => want.name || want.category || Number(want.budget || 0) > 0); }
  function wantsBudgetTotal() { return state.wants.reduce((sum, want) => sum + Number(want.budget || 0), 0); }
  function wantsSpentTotal() { return state.wants.reduce((sum, want) => sum + Number(want.spent || 0), 0); }

  function allocation() {
    const income = Number(state.incomeTotal || 0);
    const fixed = fixedTotal();
    const free = income - fixed;
    const wantBudget = wantsBudgetTotal();
    const baseAfterWants = free - wantBudget;

    const savingManual = state.savingMoney !== null && state.savingMoney !== "";
    const livingManualKeys = livingPartKeys.filter((key) => state.livingParts?.[key] !== null && state.livingParts?.[key] !== "");
    const missingLivingKeys = livingPartKeys.filter((key) => !livingManualKeys.includes(key));
    const manualLivingSum = livingManualKeys.reduce((sum, key) => sum + Number(state.livingParts[key] || 0), 0);

    let saving;
    let livingTarget;
    let allocationMessage;

    if (savingManual) {
      saving = Number(state.savingMoney || 0);
      livingTarget = Math.max(0, baseAfterWants - saving);
      allocationMessage = "貯蓄を先に守り、残りを生活に回します。";
    } else {
      const remainingAfterManualLiving = Math.max(0, baseAfterWants - manualLivingSum);
      saving = round100(remainingAfterManualLiving * 0.1);
      livingTarget = Math.max(0, baseAfterWants - saving);
      allocationMessage = livingManualKeys.length > 0
        ? "未入力の生活費と貯蓄をおすすめで埋めています。"
        : "おすすめで入れておきました。生活を多めに、貯蓄を少しだけ残しています。";
    }

    const livingParts = {};
    const remainingForMissing = Math.max(0, livingTarget - manualLivingSum);
    const missingWeight = missingLivingKeys.reduce((sum, key) => sum + livingPartWeights[key], 0) || 1;
    livingPartKeys.forEach((key) => {
      if (livingManualKeys.includes(key)) {
        livingParts[key] = Number(state.livingParts[key] || 0);
      } else {
        livingParts[key] = round100(remainingForMissing * (livingPartWeights[key] / missingWeight));
      }
    });
    const living = livingPartKeys.reduce((sum, key) => sum + Number(livingParts[key] || 0), 0);

    if (!savingManual && livingManualKeys.length === livingPartKeys.length) {
      saving = Math.max(0, baseAfterWants - living);
      allocationMessage = "生活費を優先し、残りを貯蓄に回します。";
    }

    const diff = baseAfterWants - living - saving;
    if (diff < 0) {
      allocationMessage = `このままだと ${yen(Math.abs(diff))}円 足りません。やりたいこと・生活・貯蓄を見直してください。`;
    } else if (diff > 0 && savingManual && livingManualKeys.length === livingPartKeys.length) {
      allocationMessage = `余り ${yen(diff)}円 は今月あと使えるお金に含めます。`;
    }

    const plannedAvailable = Math.max(0, free - saving);
    const spent = Number(state.spentLiving || 0) + wantsSpentTotal();
    const left = plannedAvailable - spent;
    const grossOverallOver = Math.max(0, spent - free);
    const overallOver = Math.max(0, spent - free - Number(state.savingsCoverage || 0));
    const rolloverSavings = Math.max(0, free - spent);
    const days = remainingDays();
    const safeDaily = left > 0 ? round100(left / days) : 0;
    const wantsProtectedLeft = Math.max(0, free - saving - wantsBudgetTotal() - Number(state.spentLiving || 0));

    return {
      income, fixed, free, wantBudget, baseAfterWants, living, livingParts, saving, plannedAvailable, spent, left,
      grossOverallOver, overallOver, rolloverSavings, days, safeDaily, wantsProtectedLeft,
      savingsTotal: Number(state.savingsTotal || 0), savingsCoverage: Number(state.savingsCoverage || 0),
      allocationMessage,
      budget: plannedAvailable,
    };
  }

  function statusKey(total) {
    if (total.income <= 0) return "neutral";
    if (total.overallOver > 0 || total.left < 0) return "danger";
    if (total.left <= Math.max(3000, total.plannedAvailable * 0.18)) return "caution";
    return "safe";
  }

  function statusLabel(key) { return { safe: "順調です", caution: "少し注意", danger: "厳しめ", neutral: "準備中" }[key] || "準備中"; }

  function forecast(total, key) {
    if (total.income <= 0) return { text: "今月入るお金を入力してください", note: "先に消えるお金、やりたいこと、生活と貯蓄の順に整えます。" };
    if (total.baseAfterWants < 0) return { text: `やりたいことまで入れると ${yen(Math.abs(total.baseAfterWants))}円 足りません`, note: "やりたいこと・先に消えるお金・貯蓄を見直してください。" };
    if (total.overallOver > 0) return { text: `今月の使えるお金を ${yen(total.overallOver)}円 超えています`, note: "必要なら、貯蓄から補填できます。" };
    if (total.left < 0) return { text: `今月あと使えるお金を ${yen(Math.abs(total.left))}円 超えています`, note: "やりたいことを残すなら、追加支出は慎重にいきましょう。" };
    if (key === "caution") return { text: "少し注意です", note: "月末まで持たせるなら、今日は控えめが安心です。" };
    if (total.spent <= 0) return { text: "今月の形が見えてきました", note: "使った分だけ、あとからざっくり足していきましょう。" };

    const averageSpend = total.spent / elapsedDays();
    if (averageSpend > 0) {
      const daysCanLast = Math.floor(total.left / averageSpend);
      if (daysCanLast < total.days) return { text: `${fmtMD(addDays(today(), Math.max(0, daysCanLast)))}ごろ注意`, note: "今のペースだと月末前に苦しくなるかもしれません。" };
    }
    return { text: "このままなら月末まで持ちそうです", note: "やりたいことを残しながら進められています。" };
  }

  function prepareNumericInput(input) {
    if (!input) return;
    input.addEventListener("input", () => {
      const cleaned = digitsOnly(input.value);
      if (input.value !== cleaned) input.value = cleaned;
      readInputs();
      render();
      maybeShowSetupSuccess();
    });
  }

  function setupPeriodSelect() {
    const select = el("periodStartDay");
    if (!select) return;
    select.innerHTML = "";
    for (let day = 1; day <= 28; day += 1) {
      const option = document.createElement("option");
      option.value = String(day);
      option.textContent = `${day}日`;
      select.appendChild(option);
    }
  }

  function renderWantSetupList() {
    const wrap = el("wantSetupList");
    if (!wrap) return;
    wrap.innerHTML = state.wants.map((want, index) => `
      <div class="want-setup-item compact-want-item" data-want-row="${index}">
        <div class="want-row-head"><strong>${index + 1}. やりたいこと</strong><span>${want.priority || "できれば"}</span></div>
        <div class="want-grid compact-want-grid">
          <label class="field"><span>種類</span><select data-want-field="category" data-want-index="${index}">
            <option value="">なし</option>${wantCategories.map((item) => `<option value="${item}" ${want.category === item ? "selected" : ""}>${item}</option>`).join("")}
          </select></label>
          <label class="field"><span>内容</span><input data-want-field="name" data-want-index="${index}" type="text" maxlength="20" placeholder="例：水族館" value="${escapeHtml(want.name || "")}" /></label>
          <label class="field"><span>金額</span><div class="money-input-wrap compact-money-wrap"><input data-want-field="budget" data-want-index="${index}" type="text" inputmode="numeric" data-numeric-only="true" placeholder="8000" value="${Number(want.budget || 0) || ""}" /><span>円</span></div></label>
          <label class="field"><span>優先</span><select data-want-field="priority" data-want-index="${index}">${wantPriorities.map((item) => `<option value="${item}" ${want.priority === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
        </div>
      </div>`).join("");

    wrap.querySelectorAll("input[data-numeric-only='true']").forEach(prepareNumericInput);
    wrap.querySelectorAll("[data-want-field]").forEach((node) => {
      const field = node.dataset.wantField;
      const index = Number(node.dataset.wantIndex);
      const eventName = node.tagName === "SELECT" ? "change" : "input";
      node.addEventListener(eventName, () => {
        if (field === "budget") node.value = digitsOnly(node.value);
        state.wants[index][field] = field === "budget" ? num(node.value) : node.value;
        render();
        maybeShowSetupSuccess();
      });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
  }

  function writeInputs() {
    el("periodStartDay").value = String(state.periodStartDay || 1);
    el("incomeTotal").value = state.incomeTotal || "";
    fixedKeys.forEach((key) => { const id = fixedInputMap[key]; if (el(id)) el(id).value = state.fixed[key] || ""; });
    const total = allocation();
    livingPartKeys.forEach((key) => setAutoInput(livingPartInputMap[key], state.livingParts?.[key], total.livingParts?.[key]));
    setAutoInput("savingMoney", state.savingMoney, total.saving);
    renderLivingStyle();
  }

  function setAutoInput(id, rawValue, autoValue) {
    const input = el(id);
    if (!input) return;
    if (rawValue === null || rawValue === "") {
      input.value = Math.max(0, Math.round(autoValue || 0)) || "";
      input.dataset.auto = "true";
    } else {
      input.value = rawValue || "";
      input.dataset.auto = "false";
    }
  }

  function readInputs() {
    state.periodStartDay = clamp(inputNum("periodStartDay") || 1, 1, 28);
    state.incomeTotal = inputNum("incomeTotal");
    fixedKeys.forEach((key) => { state.fixed[key] = inputNum(fixedInputMap[key]); });

    state.livingParts = state.livingParts || Object.fromEntries(livingPartKeys.map((key) => [key, null]));
    livingPartKeys.forEach((key) => {
      const input = el(livingPartInputMap[key]);
      state.livingParts[key] = input?.dataset.auto === "true" && input.value !== "" ? null : (input?.value ? inputNum(livingPartInputMap[key]) : null);
    });
    const savingInput = el("savingMoney");
    state.savingMoney = savingInput?.dataset.auto === "true" && savingInput.value !== "" ? null : (savingInput?.value ? inputNum("savingMoney") : null);
  }

  function syncAutoInputs(total) {
    livingPartKeys.forEach((key) => {
      const input = el(livingPartInputMap[key]);
      if (input && (input.dataset.auto === "true" || !input.value)) {
        input.value = Math.max(0, Math.round(total.livingParts?.[key] || 0)) || "";
        input.dataset.auto = "true";
      }
    });
    const saving = el("savingMoney");
    if (saving && (saving.dataset.auto === "true" || !saving.value)) {
      saving.value = Math.max(0, Math.round(total.saving || 0)) || "";
      saving.dataset.auto = "true";
    }
  }

  function renderLivingStyle() {
    state.livingStyle = "custom";
    const visible = new Set(visibleFixedKeys());
    const picker = el("fixedItemToggles");
    if (picker) {
      picker.innerHTML = fixedKeys.map((key) => `
        <label class="fixed-toggle ${visible.has(key) ? "active" : ""}">
          <input type="checkbox" data-fixed-toggle="${key}" ${visible.has(key) ? "checked" : ""} />
          <span>${fixedLabels[key]}</span>
        </label>`).join("");
      picker.querySelectorAll("[data-fixed-toggle]").forEach((input) => {
        input.addEventListener("change", () => {
          const key = input.dataset.fixedToggle;
          const current = new Set(visibleFixedKeys());
          if (input.checked) current.add(key); else current.delete(key);
          state.fixedVisible = fixedKeys.filter((item) => current.has(item));
          render();
        });
      });
    }
    document.querySelectorAll("[data-fixed-row]").forEach((row) => {
      const key = row.dataset.fixedRow;
      const shouldShow = visible.has(key);
      row.hidden = !shouldShow;
      row.style.display = shouldShow ? "" : "none";
    });
    const help = el("fixedHelpText");
    if (help) {
      help.textContent = visible.size > 0
        ? "チェックした項目だけ表示しています。未入力は0円で計算します。"
        : "上のチェックで必要な項目を選ぶと、ここに入力欄が出ます。";
    }
  }

  function renderAnnouncementDot() {
    const dot = el("announcementUnreadDot");
    if (!dot) return;
    dot.hidden = Number(state.announcementSeenVersion || 0) >= ANNOUNCEMENT_VERSION;
  }

  function renderWantSummary() {
    const wrap = el("wantSummaryList");
    if (!wrap) return;
    const items = activeWants();
    if (items.length === 0) {
      wrap.innerHTML = `<p class="empty-message">今月やりたいことを入れると、残しておく金額が見えるようになります。</p>`;
      return;
    }
    wrap.innerHTML = items.map((want) => {
      const budget = Number(want.budget || 0);
      const spent = Number(want.spent || 0);
      const left = budget - spent;
      const title = want.name || want.category || "今月やりたいこと";
      const stateText = budget <= 0 ? "金額未設定" : left < 0 ? `${yen(Math.abs(left))}円超過` : spent <= 0 ? "まだ使っていません" : `残り ${yen(left)}円`;
      const className = left < 0 ? "danger" : left <= budget * 0.25 && spent > 0 ? "caution" : "safe";
      return `<div class="want-summary-row ${className}">
        <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(want.category || "その他")}・${escapeHtml(want.priority || "できれば")}</small></div>
        <span>${stateText}</span>
      </div>`;
    }).join("");
  }

  function renderQuickWantTargets() {
    const area = el("quickWantTargetArea");
    const wrap = el("quickWantTargets");
    const items = activeWants();
    if (!area || !wrap) return;
    area.hidden = spendTarget !== "want";
    if (spendTarget !== "want") return;
    if (items.length === 0) {
      wrap.innerHTML = `<p class="empty-message">先に「今月やりたいこと」を入力してください。</p>`;
      return;
    }
    if (!items.some((item) => item.index === selectedWantIndex)) selectedWantIndex = items[0].index;
    wrap.innerHTML = items.map((want) => `<button type="button" class="quick-target-button ${selectedWantIndex === want.index ? "active" : ""}" data-want-target="${want.index}">${escapeHtml(want.name || want.category || `やりたいこと${want.index + 1}`)}</button>`).join("");
    wrap.querySelectorAll("[data-want-target]").forEach((button) => {
      button.addEventListener("click", () => { selectedWantIndex = Number(button.dataset.wantTarget); renderQuickWantTargets(); });
    });
  }

  function quickAmount() { return inputNum("quickAmountInput") || selectedUnit; }

  function renderQuickTotal() {
    el("quickTotal").textContent = yen(quickAmount());
    el("quickTotalLabel").textContent = spendTarget === "want" ? "やりたいことに追加" : "生活に追加";
    renderQuickWantTargets();
  }

  function applyQuickInput() {
    const amount = quickAmount();
    if (amount <= 0) return;
    if (spendTarget === "want") {
      if (!state.wants[selectedWantIndex]) return toast("先にやりたいことを入力してください。");
      state.wants[selectedWantIndex].spent = Number(state.wants[selectedWantIndex].spent || 0) + amount;
      lastQuickAction = { target: "want", index: selectedWantIndex, amount };
    } else {
      state.spentLiving = Number(state.spentLiving || 0) + amount;
      lastQuickAction = { target: "living", amount };
    }
    el("quickAmountInput").value = "";
    render();
    toast(`${yen(amount)}円を記録しました。`, { actionLabel: "取り消し", action: undoLastQuickAction, timeout: 4600 });
    if (isMobileViewport()) setTimeout(closeQuickSheet, 120);
  }

  function undoLastQuickAction() {
    if (!lastQuickAction) return toast("取り消せる記録がありません。");
    const { target, index, amount } = lastQuickAction;
    if (target === "want" && state.wants[index]) state.wants[index].spent = Math.max(0, Number(state.wants[index].spent || 0) - amount);
    if (target === "living") state.spentLiving = Math.max(0, Number(state.spentLiving || 0) - amount);
    lastQuickAction = null;
    render();
    toast(`${yen(amount)}円の記録を取り消しました。`);
  }

  function renderSavingsCover(total) {
    const panel = el("savingsCoverPanel");
    const text = el("savingsCoverText");
    const button = el("coverFromSavingsButton");
    if (!panel || !text || !button) return;
    const over = Math.max(0, Number(total.overallOver || 0));
    const available = Math.max(0, Number(state.savingsTotal || 0));
    const coverable = Math.min(over, available);
    if (over <= 0) { panel.hidden = true; button.disabled = true; return; }
    panel.hidden = false;
    if (coverable <= 0) {
      text.textContent = "補填が必要ですが、いま使える貯蓄がありません。";
      button.textContent = "補填できる貯蓄がありません";
      button.disabled = true;
      return;
    }
    text.textContent = "必要なら貯蓄から補填できます。";
    button.textContent = `貯蓄から${yen(coverable)}円補填する`;
    button.disabled = false;
  }

  function applySavingsCover() {
    const total = allocation();
    const amount = Math.min(Math.max(0, total.overallOver), Math.max(0, Number(state.savingsTotal || 0)));
    if (amount <= 0) return toast("補填できる貯蓄がありません。");
    state.savingsTotal -= amount;
    state.savingsCoverage = Number(state.savingsCoverage || 0) + amount;
    lastSavingsCoverAction = { amount };
    render();
    toast(`貯蓄から${yen(amount)}円補填しました。`, { actionLabel: "取り消し", action: undoLastSavingsCover, timeout: 4600 });
  }

  function undoLastSavingsCover() {
    if (!lastSavingsCoverAction) return;
    const amount = Number(lastSavingsCoverAction.amount || 0);
    state.savingsTotal += amount;
    state.savingsCoverage = Math.max(0, Number(state.savingsCoverage || 0) - amount);
    lastSavingsCoverAction = null;
    render();
    toast(`貯蓄からの${yen(amount)}円補填を取り消しました。`);
  }

  function rolloverAmount() {
    const total = allocation();
    const wantLeft = state.wants.reduce((sum, want) => sum + Math.max(0, Number(want.budget || 0) - Number(want.spent || 0)), 0);
    const livingLeft = Math.max(0, Number(total.living || 0) - Number(state.spentLiving || 0));
    return Math.max(0, livingLeft + wantLeft + Number(total.saving || 0));
  }

  function applyMonthRolloverIfNeeded() {
    if (!state.monthKey || state.monthKey === currentPeriodKey()) return 0;
    const amount = rolloverAmount();
    if (amount > 0) state.savingsTotal += amount;
    return amount;
  }

  function resetSpent() {
    state.spentLiving = 0;
    state.wants.forEach((want) => { want.spent = 0; });
    state.savingsCoverage = 0;
    lastQuickAction = null;
    lastSavingsCoverAction = null;
  }

  function resetMoneyInputsForFreshMonth() {
    state.incomeTotal = 0;
    state.fixed = Object.fromEntries(fixedKeys.map((key) => [key, 0]));
    state.fixedVisible = [...fixedPresets.home];
    state.wants = createInitialState().wants;
    state.livingParts = Object.fromEntries(livingPartKeys.map((key) => [key, null]));
    state.savingMoney = null;
    resetSpent();
    writeInputs();
    renderWantSetupList();
  }

  function resetAllData() {
    const ok = window.confirm("ハネミーの入力内容と記録をすべてリセットします。よろしいですか？");
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    state = createInitialState();
    lastQuickAction = null;
    lastSavingsCoverAction = null;
    renderWantSetupList();
    writeInputs();
    render();
    showSetupSuccess("リセットしました", "最初から今月の準備を始められます。");
    el("setupCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderMonthResetCard(total) {
    const card = el("monthResetCard");
    if (!card) return;
    const hasSetup = total.income > 0 || total.fixed > 0 || total.wantBudget > 0;
    card.hidden = !(hasSetup && state.monthKey && state.monthKey !== currentPeriodKey());
  }

  function startMonthWithSameSettings() {
    const rolled = applyMonthRolloverIfNeeded();
    resetSpent();
    state.monthKey = currentPeriodKey();
    render();
    showSetupSuccess("使わなかった分を貯蓄にまわしました。", rolled > 0 ? `${yen(rolled)}円を貯蓄に追加しました。今月もこの設定で始めます。` : "今月もこの設定で始めます。");
  }

  function startFreshMonth() {
    const rolled = applyMonthRolloverIfNeeded();
    resetMoneyInputsForFreshMonth();
    state.monthKey = currentPeriodKey();
    state.setupSuccessShown = false;
    render();
    showSetupSuccess("新しく設定できます。", rolled > 0 ? `${yen(rolled)}円を貯蓄に追加しました。今月のお金を入れれば、見通しが出ます。` : "今月のお金を入れれば、見通しが出ます。");
    el("setupCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showSetupSuccess(title, text) {
    el("setupSuccessTitle").textContent = title;
    el("setupSuccessText").textContent = text;
    el("setupSuccessCard").hidden = false;
  }

  function maybeShowSetupSuccess() {
    const total = allocation();
    if (state.setupSuccessShown || total.income <= 0 || total.baseAfterWants < 0) return;
    state.setupSuccessShown = true;
    state.monthKey = currentPeriodKey();
    showSetupSuccess("今月の準備ができました", "やりたいことを残しながら、今月あと使えるお金を見られるようになりました。");
  }

  function render() {
    const total = allocation();
    syncAutoInputs(total);
    const key = statusKey(total);
    const f = forecast(total, key);

    el("statusBadge").textContent = statusLabel(key);
    el("statusBadge").className = `status-badge ${key}`;
    el("leftMoney").textContent = yen(total.left);
    el("freeMoney").textContent = yen(total.left);
    el("remainingDaysText").textContent = total.income > 0 ? `残り${total.days}日` : "-";
    el("dangerForecastText").textContent = f.text;
    el("dailyAllowanceNote").textContent = f.note;
    el("dailyAllowanceText").textContent = total.income > 0 ? (total.safeDaily > 0 ? `${yen(total.safeDaily)}円くらい` : "今日は控えめが安心") : "今月のお金を入力";
    el("allowanceBox").className = `allowance-box ${key}`;
    el("mascotMessage").textContent = key === "safe" ? "今日もいい感じだよ！" : key === "caution" ? "今日は少し控えめが安心" : key === "danger" ? "追加支出は慎重にいこう" : "まずは今月のお金を整えよう";
    el("savingsTotalText").textContent = yen(Number(state.savingsTotal || 0));
    el("savingsMetaText").textContent = total.overallOver > 0 ? `今月の使えるお金を${yen(total.overallOver)}円超えています。` : `このままだと今月は${yen(total.rolloverSavings)}円が貯蓄に回ります。`;
    el("allocationResult").textContent = total.allocationMessage;
    el("setupResultNote").textContent = `やりたいことを残すなら、あと ${yen(total.wantsProtectedLeft)}円 まで。`;
    el("sharePreviewLeft").textContent = yen(total.left);
    el("sharePreviewDays").textContent = total.income > 0 ? `残り${total.days}日` : "--";
    el("sharePreviewStatus").textContent = statusLabel(key);
    el("stickyBar").textContent = `今月あと使えるお金：${yen(total.left)}円 ｜ ${statusLabel(key)}`;
    el("heroProgressBar").style.width = `${clamp(total.plannedAvailable > 0 ? ((total.plannedAvailable - Math.max(0, total.left)) / total.plannedAvailable) * 100 : 0, 0, 100)}%`;

    renderWantSummary();
    renderQuickTotal();
    renderSavingsCover(total);
    renderMonthResetCard(total);

    window.HANEMY_STATE = {
      ...total,
      statusKey: key,
      statusLabel: statusLabel(key),
      mode: "future-allocation",
      modeLabel: "未来配分",
      dailyAllowance: total.safeDaily,
      savingsBudget: total.saving,
      savingsTotal: Number(state.savingsTotal || 0),
      savingsCoverage: Number(state.savingsCoverage || 0),
      rolloverSavings: total.rolloverSavings,
      categories: [],
      budgets: { living: total.living, saving: total.saving },
      spent: { living: state.spentLiving, wants: wantsSpentTotal() },
    };
    save();
  }

  function isMobileViewport() { return window.matchMedia("(max-width: 760px)").matches; }
  function openQuickSheet() {
    if (!isMobileViewport()) { el("quickCard")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    document.body.classList.add("mobile-quick-open");
    el("mobileSheetBackdrop").hidden = false;
  }
  function closeQuickSheet() { document.body.classList.remove("mobile-quick-open"); if (el("mobileSheetBackdrop")) el("mobileSheetBackdrop").hidden = true; }


  function openAnnouncements() {
    const modal = el("announcementsModal");
    if (modal) modal.hidden = false;
    state.announcementSeenVersion = ANNOUNCEMENT_VERSION;
    save();
    renderAnnouncementDot();
    document.body.classList.add("announcements-open");
  }

  function closeAnnouncements() {
    const modal = el("announcementsModal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("announcements-open");
  }

  function bind() {
    const autoInputIds = [...Object.values(livingPartInputMap), "savingMoney"];
    document.querySelectorAll('input[data-numeric-only="true"]').forEach((input) => { if (!autoInputIds.includes(input.id)) prepareNumericInput(input); });
    el("periodStartDay").addEventListener("change", () => { readInputs(); render(); });

    autoInputIds.forEach((id) => {
      const input = el(id);
      if (!input) return;
      input.addEventListener("focus", () => { if (input.dataset.auto === "true") { input.dataset.auto = "false"; input.select(); } });
      input.addEventListener("input", () => { input.value = digitsOnly(input.value); input.dataset.auto = input.value ? "false" : "true"; readInputs(); render(); });
    });

    document.querySelectorAll("[data-unit]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedUnit = Number(button.dataset.unit) || 1000;
        el("quickAmountInput").value = "";
        document.querySelectorAll("[data-unit]").forEach((item) => item.classList.toggle("active", item === button));
        renderQuickTotal();
      });
    });

    document.querySelectorAll("[data-spend-target]").forEach((button) => {
      button.addEventListener("click", () => {
        spendTarget = button.dataset.spendTarget === "want" ? "want" : "living";
        document.querySelectorAll("[data-spend-target]").forEach((item) => item.classList.toggle("active", item === button));
        renderQuickTotal();
      });
    });

    el("quickAmountInput").addEventListener("input", () => { el("quickAmountInput").value = digitsOnly(el("quickAmountInput").value); renderQuickTotal(); });
    el("applyQuickButton").addEventListener("click", applyQuickInput);
    el("undoQuickButton").addEventListener("click", undoLastQuickAction);
    el("noSpendButton").addEventListener("click", () => toast("今日は大きな支出なしとして確認しました。"));
    el("openQuickButton").addEventListener("click", openQuickSheet);
    el("closeQuickSheetButton").addEventListener("click", closeQuickSheet);
    el("mobileSheetBackdrop").addEventListener("click", closeQuickSheet);
    el("coverFromSavingsButton").addEventListener("click", applySavingsCover);
    el("copyLastMonthButton").addEventListener("click", startMonthWithSameSettings);
    el("startFreshMonthButton").addEventListener("click", startFreshMonth);
    el("dismissSetupSuccess").addEventListener("click", () => { el("setupSuccessCard").hidden = true; });
    el("resetAllButton")?.addEventListener("click", resetAllData);
    el("openAnnouncementsButton")?.addEventListener("click", openAnnouncements);
    el("closeAnnouncementsButton")?.addEventListener("click", closeAnnouncements);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeAnnouncements(); });

    document.querySelectorAll("[data-mobile-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.mobileTarget;
        document.querySelectorAll("[data-mobile-target]").forEach((item) => item.classList.toggle("is-active", item === button && target !== "quick"));
        if (target === "quick") return openQuickSheet();
        closeQuickSheet();
        if (target === "home") el("heroCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (target === "share") el("shareSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    const observer = new IntersectionObserver((entries) => {
      el("stickyBar").classList.toggle("show", !entries[0].isIntersecting);
      el("stickyBar").setAttribute("aria-hidden", entries[0].isIntersecting ? "true" : "false");
    }, { threshold: 0, rootMargin: "-52px 0px 0px 0px" });
    observer.observe(el("heroCard"));
  }

  function toast(message, options = {}) {
    const node = document.createElement("div");
    node.className = "toast";
    const textNode = document.createElement("span");
    textNode.textContent = message;
    node.appendChild(textNode);
    if (options.actionLabel && typeof options.action === "function") {
      const actionButton = document.createElement("button");
      actionButton.type = "button";
      actionButton.className = "toast-action";
      actionButton.textContent = options.actionLabel;
      actionButton.addEventListener("click", () => { node.remove(); options.action(); });
      node.appendChild(actionButton);
    }
    document.body.appendChild(node);
    setTimeout(() => node.remove(), options.timeout || 2200);
  }

  function init() {
    setupPeriodSelect();
    load();
    renderWantSetupList();
    writeInputs();
    bind();
    render();
    localStorage.setItem(FIRST_RUN_KEY, "true");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
