(() => {
  "use strict";

  const STORAGE_KEY = "hanemy-state-v1";
  const LEGACY_STORAGE_KEYS = ["hanemy-beta-v081-state", "hanemy-beta-v075-state", "hanemy-beta-v073-state", "hanemy-beta-v071-state", "hanemy-beta-v070-state", "hanemy-beta-v060-pastel-state"];
  const FIRST_RUN_KEY = "hanemy-first-run-v1";
  const LEGACY_FIRST_RUN_KEYS = ["hanemy-beta-v081-first-run", "hanemy-beta-v075-first-run", "hanemy-beta-v073-first-run", "hanemy-beta-v071-first-run", "hanemy-beta-v070-first-run", "hanemy-beta-v060-pastel-first-run"];

  const categories = [
    { key: "food", name: "食費", icon: "🍴" },
    { key: "transport", name: "交通費", icon: "🚌" },
    { key: "social", name: "交際費", icon: "🎮" },
    { key: "date", name: "デート代", icon: "☕" },
    { key: "hobby", name: "趣味", icon: "🎧" },
    { key: "fashion", name: "服・美容", icon: "👕" },
    { key: "study", name: "勉強", icon: "📚" },
    { key: "savings", name: "貯蓄", icon: "💎" },
  ];

  const templates = {
    basic: {
      label: "基本テンプレート",
      icon: "⚖️",
      short: "貯蓄を先に確保",
      dailyMinimumCost: 700,
      rates: { food: 35, transport: 10, social: 10, date: 5, hobby: 7, fashion: 5, study: 3, savings: 25 },
    },
  };

  const inputIds = ["incomeJob", "incomeAllowance", "incomeOther", "fixedPhone", "fixedSubscription", "fixedPass", "fixedOther", "periodStartDay"];
  const quickCategories = categories.filter((category) => category.key !== "savings");

  let state = createInitialState();
  let quickMode = "add";
  let selectedUnit = 1000;
  const quickCounts = {};
  let autosaveTimer = null;
  let lastQuickAction = null;
  let lastSavingsCoverAction = null;

  function el(id) { return document.getElementById(id); }
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

  function currentPeriodKey() {
    return periodKeyForStartDay(state?.periodStartDay || 1);
  }
  function yen(value) { return Math.round(Number(value || 0)).toLocaleString("ja-JP"); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function round100(value) { return Math.floor(Number(value || 0) / 100) * 100; }
  function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
  function fmtMD(date) { return `${date.getMonth() + 1}/${date.getDate()}`; }
  function digitsOnly(value) {
    return String(value ?? "").replace(/[^0-9]/g, "");
  }

  function sanitizeNumericInput(input) {
    if (!input) return "";
    const cleaned = digitsOnly(input.value);
    if (input.value !== cleaned) input.value = cleaned;
    return cleaned;
  }

  function numberFromInput(id) {
    const node = el(id);
    if (!node) return 0;
    const value = Number(digitsOnly(node.value));
    return Number.isFinite(value) ? value : 0;
  }

  function numberFromElement(node) {
    const value = Number(digitsOnly(node?.value));
    return Number.isFinite(value) ? value : 0;
  }

  function prepareNumericInput(input) {
    if (!input || input.dataset.numericPrepared === "true") return;
    input.dataset.numericPrepared = "true";
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("pattern", "[0-9]*");
    input.setAttribute("autocomplete", "off");
    input.addEventListener("input", () => sanitizeNumericInput(input));
    input.addEventListener("paste", () => window.setTimeout(() => sanitizeNumericInput(input), 0));
  }

  function prepareAllNumericInputs(root = document) {
    root.querySelectorAll('input[data-numeric-only="true"], input[inputmode="numeric"]').forEach(prepareNumericInput);
  }

  function spendCategories() {
    return categories.filter((category) => category.key !== "savings");
  }

  function createInitialState() {
    const base = templates.basic;
    return {
      mode: "basic",
      customLabel: "カスタム",
      periodStartDay: 1,
      income: { job: 0, allowance: 0, other: 0 },
      fixed: { phone: 0, subscription: 0, pass: 0, other: 0 },
      rates: { ...base.rates },
      dailyMinimumCost: base.dailyMinimumCost,
      budgets: Object.fromEntries(categories.map((category) => [category.key, 0])),
      spent: Object.fromEntries(categories.map((category) => [category.key, 0])),
      savingsTotal: 0,
      savingsCoverage: 0,
      monthKey: periodKeyForStartDay(1),
      setupSuccessShown: false,
    };
  }

  function activeModeLabel() {
    if (state.mode === "custom") return state.customLabel || "カスタム";
    return templates[state.mode]?.label || "配分準備中";
  }

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

  function totals() {
    const income = Number(state.income.job || 0) + Number(state.income.allowance || 0) + Number(state.income.other || 0);
    const fixed = Number(state.fixed.phone || 0) + Number(state.fixed.subscription || 0) + Number(state.fixed.pass || 0) + Number(state.fixed.other || 0);
    const free = income - fixed;
    const savingsBudget = Math.max(0, Number(state.budgets.savings || 0));
    const livingBudget = spendCategories().reduce((sum, category) => sum + Number(state.budgets[category.key] || 0), 0);
    const spent = spendCategories().reduce((sum, category) => sum + Number(state.spent[category.key] || 0), 0);
    const left = livingBudget - spent;
    const savingsCoverage = Math.max(0, Number(state.savingsCoverage || 0));
    const grossOverallOver = Math.max(0, spent - free);
    const overallOver = Math.max(0, spent - free - savingsCoverage);
    const livingOver = Math.max(0, spent - livingBudget);
    const rolloverSavings = Math.max(0, free - spent);
    const days = remainingDays();
    const minimumLine = days * Number(state.dailyMinimumCost || 0);
    const safeLeft = left - minimumLine;
    const safeDaily = livingBudget > 0 && safeLeft > 0 ? round100(safeLeft / days) : 0;
    return {
      income,
      fixed,
      free,
      budget: livingBudget,
      livingBudget,
      savingsBudget,
      totalAllocated: livingBudget + savingsBudget,
      spent,
      left,
      livingOver,
      grossOverallOver,
      overallOver,
      savingsCoverage,
      rolloverSavings,
      days,
      minimumLine,
      safeLeft,
      safeDaily,
      savingsTotal: Number(state.savingsTotal || 0),
    };
  }

  function statusKey(total) {
    if (total.budget <= 0) return "neutral";
    if (total.overallOver > 0) return "danger";
    if (total.left < 0) return "caution";
    if (total.safeLeft <= 0) return "caution";
    if (total.left <= total.budget * 0.2) return "caution";
    return "safe";
  }

  function statusLabel(key) {
    return { safe: "大丈夫", caution: "少し注意", danger: "厳しめ", neutral: "準備中" }[key] || "準備中";
  }

  function getDangerForecast(total) {
    if (total.budget <= 0) return { text: "まずは今月入るお金を入力", note: "入れるだけで、今月の見通しが出ます。" };
    if (total.overallOver > 0) return { text: `今月の使えるお金を${yen(total.overallOver)}円超えています`, note: "必要なら、貯蓄から補填できます。" };
    if (total.savingsCoverage > 0) return { text: `貯蓄から${yen(total.savingsCoverage)}円補填済みです`, note: "今月の貯蓄に回る額は0円です。" };
    if (total.left < 0) return { text: `生活費を${yen(Math.abs(total.left))}円超えています`, note: `このままだと、今月貯蓄に回る額は${yen(total.rolloverSavings)}円です。` };
    if (total.safeLeft <= 0) return { text: "少し注意です", note: "月末までの最低限を残すなら、今日は控えめが安心です。" };
    if (total.spent <= 0) return { text: "このままなら月末まで持ちます", note: "まだ支出ペースが低いので、安全寄りです。" };

    const averageSpend = total.spent / elapsedDays();
    if (averageSpend <= 0) return { text: "このままなら月末まで持ちます", note: "今の入力では注意日は出ていません。" };

    const daysCanLast = Math.floor(total.safeLeft / averageSpend);
    if (daysCanLast < total.days) {
      const dangerDate = addDays(today(), Math.max(0, daysCanLast));
      return { text: `${fmtMD(dangerDate)}ごろ注意`, note: "生活ラインを残すなら、少しペースを落とすと安心です。" };
    }

    return { text: "このままなら月末まで持ちます", note: "今のペースなら生活費は大きく崩れにくい状態です。" };
  }

  function applyRatesToBudgets() {
    const free = Math.max(0, totals().free);
    const totalRate = categories.reduce((sum, category) => sum + Math.max(0, Number(state.rates[category.key] || 0)), 0);
    let allocated = 0;
    const rated = categories.filter((category) => Number(state.rates[category.key] || 0) > 0);

    categories.forEach((category) => {
      const rate = Math.max(0, Number(state.rates[category.key] || 0));
      if (free <= 0 || totalRate <= 0 || rate <= 0) {
        state.budgets[category.key] = 0;
        return;
      }
      const isLast = rated[rated.length - 1]?.key === category.key;
      const next = isLast ? Math.max(0, free - allocated) : round100(free * (rate / totalRate));
      state.budgets[category.key] = next;
      allocated += next;
    });
  }

  function readInputsToState() {
    state.periodStartDay = clamp(numberFromInput("periodStartDay") || 1, 1, 28);
    state.income.job = numberFromInput("incomeJob");
    state.income.allowance = numberFromInput("incomeAllowance");
    state.income.other = numberFromInput("incomeOther");
    state.fixed.phone = numberFromInput("fixedPhone");
    state.fixed.subscription = numberFromInput("fixedSubscription");
    state.fixed.pass = numberFromInput("fixedPass");
    state.fixed.other = numberFromInput("fixedOther");
  }

  function writeStateToInputs() {
    el("periodStartDay").value = String(state.periodStartDay || 1);
    el("incomeJob").value = state.income.job || "";
    el("incomeAllowance").value = state.income.allowance || "";
    el("incomeOther").value = state.income.other || "";
    el("fixedPhone").value = state.fixed.phone || "";
    el("fixedSubscription").value = state.fixed.subscription || "";
    el("fixedPass").value = state.fixed.pass || "";
    el("fixedOther").value = state.fixed.other || "";
    el("customModeName").value = state.customLabel || "カスタム";
    el("customDailyMinimum").value = state.dailyMinimumCost || 0;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function scheduleSave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(save, 250);
  }

  function readSavedState() {
    const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      } catch {
        // 壊れた古い保存データは読み飛ばす
      }
    }
    return null;
  }

  function normalizeModeAfterLoad(saved) {
    const legacyReserveRate = Number(saved?.rates?.reserve || 0);
    const legacySavingRate = Number(saved?.rates?.saving || 0);
    const incomingSavingsRate = Number(saved?.rates?.savings || 0);

    if (state.mode === "custom") {
      state.rates.savings = incomingSavingsRate || legacyReserveRate + legacySavingRate || state.rates.savings || templates.basic.rates.savings;
    } else {
      state.mode = "basic";
      state.rates = { ...templates.basic.rates };
      state.dailyMinimumCost = templates.basic.dailyMinimumCost;
      if (saved && saved.customLabel) state.customLabel = saved.customLabel;
    }

    state.budgets.savings = Number(saved?.budgets?.savings || 0) || Number(saved?.budgets?.reserve || 0) + Number(saved?.budgets?.saving || 0) || 0;
    state.spent.savings = 0;
    delete state.rates.reserve;
    delete state.rates.saving;
    delete state.budgets.reserve;
    delete state.budgets.saving;
    delete state.spent.reserve;
    delete state.spent.saving;
    state.savingsTotal = Math.max(0, Number(saved?.savingsTotal || 0));
    state.savingsCoverage = Math.max(0, Number(saved?.savingsCoverage || 0));
  }

  function load() {
    try {
      const saved = readSavedState();
      if (!saved) return;
      const initial = createInitialState();
      state = {
        ...initial,
        ...saved,
        income: { ...initial.income, ...(saved.income || {}) },
        fixed: { ...initial.fixed, ...(saved.fixed || {}) },
        rates: { ...initial.rates, ...(saved.rates || {}) },
        budgets: { ...initial.budgets, ...(saved.budgets || {}) },
        spent: { ...initial.spent, ...(saved.spent || {}) },
      };
      normalizeModeAfterLoad(saved);
      if (!saved.monthKey) state.monthKey = currentPeriodKey();
      if (typeof saved.setupSuccessShown !== "boolean") state.setupSuccessShown = true;
    } catch {
      state = createInitialState();
    }
  }

  function calculateRolloverSavings() {
    applyRatesToBudgets();
    const total = totals();
    return Math.max(0, total.rolloverSavings);
  }

  function applyMonthRolloverIfNeeded() {
    if (!state.monthKey || state.monthKey === currentPeriodKey()) return 0;
    const amount = calculateRolloverSavings();
    if (amount > 0) state.savingsTotal = Math.max(0, Number(state.savingsTotal || 0)) + amount;
    return amount;
  }

  function resetSpent() {
    categories.forEach((category) => {
      state.spent[category.key] = 0;
    });
    state.savingsCoverage = 0;
    lastQuickAction = null;
    lastSavingsCoverAction = null;
  }

  function resetMoneyInputsForFreshMonth() {
    state.income = { job: 0, allowance: 0, other: 0 };
    state.fixed = { phone: 0, subscription: 0, pass: 0, other: 0 };
    resetSpent();
    applyRatesToBudgets();
    writeStateToInputs();
  }

  function renderMonthResetCard(total) {
    const card = el("monthResetCard");
    if (!card) return;
    const hasSetup = total.budget > 0 || total.income > 0 || total.fixed > 0;
    const shouldShow = hasSetup && state.monthKey && state.monthKey !== currentPeriodKey();
    card.hidden = !shouldShow;
  }

  function startMonthWithSameSettings() {
    const rolled = applyMonthRolloverIfNeeded();
    resetSpent();
    state.monthKey = currentPeriodKey();
    state.setupSuccessShown = true;
    render();
    scheduleSave();
    const note = rolled > 0 ? `${yen(rolled)}円を貯蓄に追加しました。今月もこの設定で始めます。` : "今月もこの設定で始めます。";
    showSetupSuccess("使わなかった分を貯蓄にまわしました。", note);
    toast("先月と同じ設定で今月を始めました。");
  }

  function startFreshMonth() {
    const rolled = applyMonthRolloverIfNeeded();
    resetMoneyInputsForFreshMonth();
    state.monthKey = currentPeriodKey();
    state.setupSuccessShown = false;
    render();
    scheduleSave();
    const note = rolled > 0 ? `${yen(rolled)}円を貯蓄に追加しました。今月のお金を入れれば、見通しが出ます。` : "基本設定と今月のお金を入れれば、今月の見通しが出ます。";
    showSetupSuccess("新しく設定できます。", note);
    el("setupCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showSetupSuccess(title = "今月はこのペースなら大丈夫そうです。", text = "使った分だけ、あとからざっくり足していきましょう。") {
    const card = el("setupSuccessCard");
    if (!card) return;
    el("setupSuccessTitle").textContent = title;
    el("setupSuccessText").textContent = text;
    card.hidden = false;
  }

  function hideSetupSuccess() {
    const card = el("setupSuccessCard");
    if (card) card.hidden = true;
  }

  function maybeShowSetupSuccess() {
    const total = totals();
    if (state.setupSuccessShown || total.budget <= 0 || total.free <= 0) return;
    state.setupSuccessShown = true;
    state.monthKey = currentPeriodKey();
    showSetupSuccess();
    scheduleSave();
  }

  function render() {
    applyRatesToBudgets();
    const total = totals();
    const key = statusKey(total);
    const forecast = getDangerForecast(total);

    el("modeLabel").textContent = activeModeLabel();
    el("statusBadge").textContent = statusLabel(key);
    el("statusBadge").className = `status-badge ${key}`;
    el("leftMoney").textContent = yen(total.left);
    el("freeMoney").textContent = yen(total.budget);
    el("remainingDaysText").textContent = total.budget > 0 ? `残り${total.days}日` : "-";
    el("dangerForecastText").textContent = forecast.text;
    el("dailyAllowanceText").textContent = total.budget > 0 ? (total.safeDaily > 0 ? `${yen(total.safeDaily)}円くらい` : "今日は控えめが安心") : "今月のお金を入力";
    el("savingsTotalText").textContent = yen(total.savingsTotal);
    const savingsMeta = el("savingsMetaText");
    if (savingsMeta) {
      if (total.totalAllocated <= 0) savingsMeta.textContent = "今月のお金を入れると、自動で貯蓄分を確保します。";
      else if (total.overallOver > 0) savingsMeta.textContent = `今月の使えるお金を${yen(total.overallOver)}円超えています。`;
      else if (total.savingsCoverage > 0) savingsMeta.textContent = `今月は貯蓄から${yen(total.savingsCoverage)}円補填済みです。`;
      else if (total.left < 0) savingsMeta.textContent = `このままだと今月貯蓄に回る額は${yen(total.rolloverSavings)}円です。`;
      else savingsMeta.textContent = `このままだと今月は${yen(total.rolloverSavings)}円が貯蓄に回ります。`;
    }
    renderSavingsCover(total);
    el("dailyAllowanceNote").textContent = forecast.note;
    el("allowanceBox").className = `allowance-box ${key}`;
    el("stickyBar").textContent = `今月あと使えるお金：${yen(total.left)}円 ｜ ${statusLabel(key)}`;

    renderMonthResetCard(total);
    renderModeButtons();
    renderCategoryStrip(total);
    renderQuickTotal();
    renderCustomRateInputs(false);
    save();

    window.HANEMY_STATE = {
      ...total,
      statusKey: key,
      statusLabel: statusLabel(key),
      mode: state.mode,
      modeLabel: activeModeLabel(),
      dangerForecast: forecast.text,
      dailyAllowance: total.safeDaily,
      savingsBudget: total.savingsBudget,
      savingsTotal: total.savingsTotal,
      savingsCoverage: total.savingsCoverage,
      rolloverSavings: total.rolloverSavings,
      overallOver: total.overallOver,
      categories,
      budgets: { ...state.budgets },
      spent: { ...state.spent },
    };
  }

  function renderSavingsCover(total) {
    const panel = el("savingsCoverPanel");
    const text = el("savingsCoverText");
    const button = el("coverFromSavingsButton");
    if (!panel || !text || !button) return;

    const over = Math.max(0, Number(total.overallOver || 0));
    const available = Math.max(0, Number(state.savingsTotal || 0));
    const coverable = Math.min(over, available);

    if (over <= 0) {
      panel.hidden = true;
      button.disabled = true;
      return;
    }

    panel.hidden = false;
    if (available <= 0) {
      text.textContent = "貯蓄からの補填が必要ですが、いま使える貯蓄がありません。";
      button.textContent = "補填できる貯蓄がありません";
      button.disabled = true;
      return;
    }

    const suffix = coverable < over ? `（不足分のうち${yen(coverable)}円まで補填できます）` : "";
    text.textContent = `必要なら貯蓄から補填できます${suffix}`;
    button.textContent = coverable < over ? `貯蓄から${yen(coverable)}円だけ補填する` : `貯蓄から${yen(over)}円補填する`;
    button.disabled = false;
  }

  function applySavingsCover() {
    applyRatesToBudgets();
    const total = totals();
    const over = Math.max(0, Number(total.overallOver || 0));
    const available = Math.max(0, Number(state.savingsTotal || 0));
    const amount = Math.min(over, available);

    if (over <= 0) {
      toast("補填が必要な超過はありません。");
      return;
    }
    if (amount <= 0) {
      toast("補填できる貯蓄がありません。");
      return;
    }

    state.savingsTotal = Math.max(0, available - amount);
    state.savingsCoverage = Math.max(0, Number(state.savingsCoverage || 0)) + amount;
    lastSavingsCoverAction = { amount };
    render();
    scheduleSave();
    toast(`貯蓄から${yen(amount)}円補填しました。`, { actionLabel: "取り消し", action: undoLastSavingsCover, timeout: 4600 });
  }

  function undoLastSavingsCover() {
    if (!lastSavingsCoverAction || !lastSavingsCoverAction.amount) return;
    const amount = Number(lastSavingsCoverAction.amount || 0);
    state.savingsTotal = Math.max(0, Number(state.savingsTotal || 0)) + amount;
    state.savingsCoverage = Math.max(0, Number(state.savingsCoverage || 0) - amount);
    lastSavingsCoverAction = null;
    render();
    scheduleSave();
    toast(`貯蓄からの${yen(amount)}円補填を取り消しました。`);
  }

  function renderCategoryStrip(total) {
    const wrap = el("categoryStrip");
    if (!wrap) return;
    if (total.budget <= 0) {
      wrap.innerHTML = `<p class="empty-message">まずは今月入るお金を入れるだけでOKです。カテゴリごとの残り金額も自動で出ます。</p>`;
      return;
    }
    wrap.innerHTML = spendCategories().filter((category) => Number(state.budgets[category.key] || 0) > 0).map((category) => {
      const budget = Number(state.budgets[category.key] || 0);
      const spent = Number(state.spent[category.key] || 0);
      const left = budget - spent;
      const ratio = budget > 0 ? spent / budget : 0;
      const percent = Math.round(ratio * 100);
      const className = left < 0 ? "danger" : ratio >= 0.8 ? "caution" : "safe";
      const leftLabel = left < 0 ? `${yen(Math.abs(left))}円超過` : `あと${yen(left)}円`;
      return `<div class="cat-row ${className}">
        <span class="cat-icon" aria-hidden="true">${category.icon || "•"}</span>
        <div class="cat-main">
          <span class="cat-name">${category.name}</span>
          <small>使った ${yen(spent)}円 / 目安 ${yen(budget)}円</small>
          <span class="cat-track"><span class="cat-bar" style="width:${clamp(percent, 0, 100)}%"></span></span>
        </div>
        <div class="cat-money">
          <strong>${leftLabel}</strong>
          <span>${percent}%</span>
        </div>
      </div>`;
    }).join("");
  }

  function renderQuickList() {
    const list = el("quickList");
    if (!list) return;
    list.innerHTML = quickCategories.map((category) => {
      const count = quickCounts[category.key] || 0;
      return `<div class="quick-item ${count > 0 ? "has-count" : ""}" data-quick-item="${category.key}">
        <span class="quick-icon" aria-hidden="true">${category.icon || "•"}</span>
        <div class="quick-copy"><strong>${category.name}</strong><small><span id="quickAmount_${category.key}">${yen(count * selectedUnit)}</span>円${quickMode === "subtract" ? "取り消し" : "追加"}</small></div>
        <div class="counter">
          <button type="button" class="secondary" data-minus="${category.key}" aria-label="${category.name}を減らす">−</button>
          <span id="count_${category.key}">${count}</span>
          <button type="button" data-plus="${category.key}" aria-label="${category.name}を増やす">＋</button>
        </div>
      </div>`;
    }).join("");

    list.querySelectorAll("[data-plus]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.plus;
        quickCounts[key] = Math.min(99, (quickCounts[key] || 0) + 1);
        renderQuickList();
        renderQuickTotal();
      });
    });

    list.querySelectorAll("[data-minus]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.minus;
        quickCounts[key] = Math.max(0, (quickCounts[key] || 0) - 1);
        renderQuickList();
        renderQuickTotal();
      });
    });
  }

  function quickTotal() {
    return quickCategories.reduce((sum, category) => sum + (quickCounts[category.key] || 0) * selectedUnit, 0);
  }

  function renderQuickTotal() {
    const total = quickTotal();
    el("quickTotal").textContent = yen(total);
    el("quickTotalLabel").textContent = quickMode === "subtract" ? "取り消し予定" : "追加予定";
    const button = el("applyQuickButton");
    button.disabled = total <= 0;
    button.textContent = quickMode === "subtract" ? "取り消す" : "反映する";
  }

  function resetQuickCounts() {
    quickCategories.forEach((category) => { quickCounts[category.key] = 0; });
    renderQuickList();
    renderQuickTotal();
  }

  function applyQuickInput() {
    const total = quickTotal();
    if (total <= 0) return;
    const changes = [];

    quickCategories.forEach((category) => {
      const amount = (quickCounts[category.key] || 0) * selectedUnit;
      if (amount <= 0) return;
      const current = Number(state.spent[category.key] || 0);
      const next = quickMode === "subtract" ? Math.max(0, current - amount) : current + amount;
      const appliedAmount = Math.abs(next - current);
      if (appliedAmount <= 0) return;
      state.spent[category.key] = next;
      changes.push({ key: category.key, amount: appliedAmount });
    });

    const appliedTotal = changes.reduce((sum, item) => sum + item.amount, 0);
    if (appliedTotal <= 0) {
      resetQuickCounts();
      render();
      toast("取り消せる金額がありません。");
      return;
    }

    lastQuickAction = { mode: quickMode, changes };
    const label = quickMode === "subtract" ? "取り消しました" : "追加しました";
    resetQuickCounts();
    render();
    scheduleSave();
    toast(`${yen(appliedTotal)}円を${label}。`, { actionLabel: "取り消し", action: undoLastQuickAction, timeout: 4600 });
    if (isMobileViewport()) window.setTimeout(closeQuickSheet, 120);
  }

  function undoLastQuickAction() {
    if (!lastQuickAction || !Array.isArray(lastQuickAction.changes)) return;
    lastQuickAction.changes.forEach((change) => {
      const current = Number(state.spent[change.key] || 0);
      if (lastQuickAction.mode === "subtract") state.spent[change.key] = current + change.amount;
      else state.spent[change.key] = Math.max(0, current - change.amount);
    });
    const undoneTotal = lastQuickAction.changes.reduce((sum, item) => sum + item.amount, 0);
    lastQuickAction = null;
    render();
    scheduleSave();
    toast(`${yen(undoneTotal)}円の操作を取り消しました。`);
  }

  function setupPeriodSelect() {
    const select = el("periodStartDay");
    select.innerHTML = "";
    for (let day = 1; day <= 28; day += 1) {
      const option = document.createElement("option");
      option.value = String(day);
      option.textContent = `${day}日`;
      select.appendChild(option);
    }
  }

  function renderModeButtons() {
    const html = Object.entries(templates).map(([key, item]) => `<button type="button" data-mode-select="${key}" class="mode-choice-card ${state.mode === key ? "active" : ""}"><span class="mode-check">✓</span><span class="mode-icon" aria-hidden="true">${item.icon || ""}</span><strong>${item.label}</strong><small>${item.short}</small></button>`).join("") +
      `<button type="button" data-mode-select="custom" class="mode-choice-card ${state.mode === "custom" ? "active" : ""}"><span class="mode-check">✓</span><span class="mode-icon" aria-hidden="true">⚙️</span><strong>${state.customLabel || "カスタム"}</strong><small>自分で調整</small></button>`;

    const mini = el("modeMiniGrid");
    if (mini && mini.dataset.html !== html) {
      mini.dataset.html = html;
      mini.innerHTML = html;
      mini.querySelectorAll("[data-mode-select]").forEach((button) => button.addEventListener("click", () => applyMode(button.dataset.modeSelect)));
    }
  }

  function renderModeOverlay() {
    const list = el("modeList");
    list.innerHTML = Object.entries(templates).map(([key, item]) => `<button type="button" data-overlay-mode="${key}"><span class="mode-icon" aria-hidden="true">${item.icon || ""}</span><strong>${item.label}</strong><span>${item.short}</span></button>`).join("") +
      `<button type="button" data-overlay-mode="custom"><span class="mode-icon" aria-hidden="true">⚙️</span><strong>${state.customLabel || "カスタム"}</strong><span>自分で調整</span></button>`;
    list.querySelectorAll("[data-overlay-mode]").forEach((button) => button.addEventListener("click", () => {
      applyMode(button.dataset.overlayMode);
      closeModeOverlay();
    }));
  }

  function applyMode(mode) {
    if (mode !== "custom" && templates[mode]) {
      state.mode = mode;
      state.rates = { ...templates[mode].rates };
      state.dailyMinimumCost = templates[mode].dailyMinimumCost;
    } else {
      state.mode = "custom";
      state.customLabel = state.customLabel || "カスタム";
    }
    applyRatesToBudgets();
    render();
    scheduleSave();
    toast(`${activeModeLabel()}で始めます。`);
  }

  function renderCustomRateInputs(attachListeners = true) {
    const grid = el("customRateGrid");
    if (!grid) return;
    const currentTotal = categories.reduce((sum, category) => sum + Number(state.rates[category.key] || 0), 0);
    el("rateTotal").textContent = currentTotal;

    if (grid.dataset.rendered === "true" && !attachListeners) {
      categories.forEach((category) => {
        const input = el(`customRate_${category.key}`);
        if (input && document.activeElement !== input) input.value = Number(state.rates[category.key] || 0);
      });
      const minInput = el("customDailyMinimum");
      if (minInput && document.activeElement !== minInput) minInput.value = Number(state.dailyMinimumCost || 0);
      return;
    }

    grid.innerHTML = categories.map((category) => `<label class="rate-field"><span>${category.name}</span><input id="customRate_${category.key}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-numeric-only="true" value="${Number(state.rates[category.key] || 0)}" /></label>`).join("");
    grid.dataset.rendered = "true";

    grid.querySelectorAll("input").forEach((input) => {
      prepareNumericInput(input);
      input.addEventListener("input", () => {
        sanitizeNumericInput(input);
        const key = input.id.replace("customRate_", "");
        const value = clamp(numberFromElement(input), 0, 100);
        state.rates[key] = value;
        state.mode = "custom";
        updateRateTotalOnly();
        applyRatesToBudgets();
        render();
        scheduleSave();
      });
    });
  }

  function updateRateTotalOnly() {
    const total = categories.reduce((sum, category) => sum + Number(state.rates[category.key] || 0), 0);
    el("rateTotal").textContent = total;
  }

  function saveCustomMode() {
    state.mode = "custom";
    state.customLabel = el("customModeName").value.trim() || "カスタム";
    state.dailyMinimumCost = Math.max(0, numberFromInput("customDailyMinimum"));
    categories.forEach((category) => {
      state.rates[category.key] = clamp(numberFromInput(`customRate_${category.key}`), 0, 100);
    });
    applyRatesToBudgets();
    render();
    scheduleSave();
    toast("カスタム配分を反映しました。");
  }

  function adjustMoneyInput(id, step) {
    const input = el(id);
    if (!input) return;
    const current = numberFromElement(input);
    const next = Math.max(0, round100(current + Number(step || 0)));
    input.value = next || "";
    readInputsToState();
    render();
    scheduleSave();
  }

  function openModeOverlay() { renderModeOverlay(); el("modeOverlay").hidden = false; }
  function closeModeOverlay() { el("modeOverlay").hidden = true; localStorage.setItem(FIRST_RUN_KEY, "true"); }


  function isMobileViewport() {
    return window.matchMedia("(max-width: 760px)").matches;
  }

  function openQuickSheet() {
    if (!isMobileViewport()) {
      el("quickCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    document.body.classList.add("mobile-quick-open");
    const backdrop = el("mobileSheetBackdrop");
    if (backdrop) backdrop.hidden = false;
  }

  function closeQuickSheet() {
    document.body.classList.remove("mobile-quick-open");
    const backdrop = el("mobileSheetBackdrop");
    if (backdrop) backdrop.hidden = true;
  }

  function setupMobileNav() {
    const backdrop = el("mobileSheetBackdrop");
    const closeButton = el("closeQuickSheetButton");
    if (backdrop) backdrop.addEventListener("click", closeQuickSheet);
    if (closeButton) closeButton.addEventListener("click", closeQuickSheet);

    document.querySelectorAll("[data-mobile-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.mobileTarget;
        document.querySelectorAll("[data-mobile-target]").forEach((item) => {
          item.classList.toggle("is-active", item === button && target !== "quick");
        });

        if (target === "quick") {
          openQuickSheet();
          return;
        }

        closeQuickSheet();
        if (target === "home") el("heroCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (target === "setup") el("setupCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (target === "share") el("shareSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeQuickSheet();
    });

    window.addEventListener("resize", () => {
      if (!isMobileViewport()) closeQuickSheet();
    });
  }

  function bind() {
    prepareAllNumericInputs();

    inputIds.forEach((id) => {
      el(id)?.addEventListener("input", () => { sanitizeNumericInput(el(id)); readInputsToState(); render(); maybeShowSetupSuccess(); scheduleSave(); });
      el(id)?.addEventListener("change", () => { sanitizeNumericInput(el(id)); readInputsToState(); render(); maybeShowSetupSuccess(); scheduleSave(); });
    });

    document.querySelectorAll("[data-unit]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedUnit = Number(button.dataset.unit) || 1000;
        document.querySelectorAll("[data-unit]").forEach((item) => item.classList.toggle("active", item === button));
        renderQuickList();
        renderQuickTotal();
      });
    });

    document.querySelectorAll("[data-quick-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        quickMode = button.dataset.quickMode === "subtract" ? "subtract" : "add";
        document.querySelectorAll("[data-quick-mode]").forEach((item) => item.classList.toggle("active", item === button));
        renderQuickList();
        renderQuickTotal();
      });
    });

    document.querySelectorAll("[data-money-step]").forEach((button) => {
      button.addEventListener("click", () => adjustMoneyInput(button.dataset.moneyStep, Number(button.dataset.step || 0)));
    });

    el("copyLastMonthButton")?.addEventListener("click", startMonthWithSameSettings);
    el("coverFromSavingsButton")?.addEventListener("click", applySavingsCover);
    el("startFreshMonthButton")?.addEventListener("click", startFreshMonth);
    el("dismissSetupSuccess")?.addEventListener("click", hideSetupSuccess);
    el("applyQuickButton").addEventListener("click", applyQuickInput);
    el("noSpendButton").addEventListener("click", () => toast("今日は大きな支出なしとして確認しました。"));
    el("openQuickButton").addEventListener("click", openQuickSheet);
    el("openModeButton").addEventListener("click", openModeOverlay);
    el("skipModeButton").addEventListener("click", closeModeOverlay);
    el("saveCustomModeButton").addEventListener("click", saveCustomMode);
    el("customModeName").addEventListener("input", () => { state.customLabel = el("customModeName").value.trim() || "カスタム"; state.mode = "custom"; render(); scheduleSave(); });
    el("customDailyMinimum").addEventListener("input", () => { sanitizeNumericInput(el("customDailyMinimum")); state.dailyMinimumCost = Math.max(0, numberFromInput("customDailyMinimum")); state.mode = "custom"; render(); maybeShowSetupSuccess(); scheduleSave(); });

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
      actionButton.addEventListener("click", () => {
        node.remove();
        options.action();
      });
      node.appendChild(actionButton);
    }

    document.body.appendChild(node);
    setTimeout(() => node.remove(), options.timeout || 2200);
  }

  function init() {
    setupPeriodSelect();
    quickCategories.forEach((category) => { quickCounts[category.key] = 0; });
    load();
    writeStateToInputs();
    renderModeButtons();
    renderModeOverlay();
    renderCustomRateInputs(true);
    renderQuickList();
    setupMobileNav();
    bind();
    render();
    if (![FIRST_RUN_KEY, ...LEGACY_FIRST_RUN_KEYS].some((key) => localStorage.getItem(key))) openModeOverlay();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
