(function () {
  "use strict";

  const STORAGE_KEY = "hanemy-quick-check-date-v1";
  let selectedUnit = 1000;
  let quickMode = "add";
  const counts = {};

  const quickCategories = [
    { key: "food", name: "食費", spentId: "spentFood", leftId: "leftFood" },
    { key: "transport", name: "交通費", spentId: "spentTransport", leftId: "leftTransport" },
    { key: "social", name: "交際費", spentId: "spentSocial", leftId: "leftSocial" },
    { key: "date", name: "デート代", spentId: "spentDate", leftId: "leftDate" },
    { key: "hobby", name: "趣味", spentId: "spentHobby", leftId: "leftHobby" },
    { key: "fashion", name: "服・美容", spentId: "spentFashion", leftId: "leftFashion" },
    { key: "study", name: "勉強", spentId: "spentStudy", leftId: "leftStudy" },
    { key: "reserve", name: "予備費", spentId: "spentReserve", leftId: "leftReserve" }
  ];

  function el(id) { return document.getElementById(id); }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatYen(value) {
    return Number(value || 0).toLocaleString("ja-JP");
  }

  function getNumber(id) {
    const value = Number(el(id)?.value);
    return Number.isFinite(value) ? value : 0;
  }

  function getCategoryName(category) {
    const row = el(category.leftId)?.closest(".budget-row");
    return row?.querySelector(":scope > span")?.textContent?.trim() || category.name;
  }

  function isCategoryVisible(category) {
    const row = el(category.leftId)?.closest(".budget-row");
    return !row || row.style.display !== "none";
  }

  function markTodayChecked() {
    localStorage.setItem(STORAGE_KEY, todayKey());

    document.querySelectorAll("[data-daily-spend-id]").forEach((button) => {
      button.addEventListener("click", () => {
        applyDailyShortcut(button.dataset.dailySpendId, button.dataset.dailyAmount);
      });
    });

    updateTodayStatus();
  }

  function updateTodayStatus() {
    const status = el("quickInputTodayStatus");
    if (!status) return;

    const done = localStorage.getItem(STORAGE_KEY) === todayKey();
    status.textContent = done ? "今日の入力：確認済み" : "今日の入力：まだ";
    status.classList.toggle("done", done);
  }

  function getTotal() {
    return quickCategories.reduce((sum, category) => {
      return sum + (counts[category.key] || 0) * selectedUnit;
    }, 0);
  }

  function getSignedTotal() {
    const total = getTotal();
    return quickMode === "subtract" ? -total : total;
  }

  function renderCounts() {
    quickCategories.forEach((category) => {
      const count = counts[category.key] || 0;
      const countNode = el(`quickCount_${category.key}`);
      const amountNode = el(`quickAmount_${category.key}`);
      const row = countNode?.closest(".atm-category-row");

      if (countNode) countNode.textContent = count;
      if (amountNode) amountNode.textContent = formatYen(count * selectedUnit);
      if (row) row.classList.toggle("has-count", count > 0);
    });

    const totalNode = el("quickInputTotal");
    const total = getTotal();
    const signedTotal = getSignedTotal();

    if (totalNode) totalNode.textContent = formatYen(Math.abs(signedTotal));

    const totalLabel = el("quickInputTotalLabel");
    if (totalLabel) totalLabel.textContent = quickMode === "subtract" ? "取り消し予定" : "追加予定";

    const applyButton = el("applyQuickInputButton");
    if (applyButton) {
      applyButton.disabled = total <= 0;
      applyButton.textContent = quickMode === "subtract" ? "まとめて取り消す" : "まとめて追加";
    }
  }

  function resetCounts() {
    quickCategories.forEach((category) => {
      counts[category.key] = 0;
    });
    renderCounts();
  }

  function renderRows() {
    const list = el("quickCategoryList");
    if (!list) return;

    list.innerHTML = "";

    quickCategories.forEach((category) => {
      if (!isCategoryVisible(category)) return;
      if (counts[category.key] === undefined) counts[category.key] = 0;

      const name = getCategoryName(category);
      const row = document.createElement("div");
      row.className = "atm-category-row";
      row.innerHTML = `
        <div class="atm-category-name">
          <strong>${name}</strong>
          <small><span id="quickAmount_${category.key}">0</span>円追加</small>
        </div>
        <div class="atm-counter">
          <button type="button" class="secondary" data-quick-minus="${category.key}" aria-label="${name}を1つ減らす">−</button>
          <span id="quickCount_${category.key}">0</span>
          <button type="button" data-quick-plus="${category.key}" aria-label="${name}を1つ増やす">＋</button>
        </div>
      `;

      list.appendChild(row);
    });

    list.querySelectorAll("[data-quick-plus]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.quickPlus;
        counts[key] = Math.min(99, (counts[key] || 0) + 1);
        renderCounts();
      });
    });

    list.querySelectorAll("[data-quick-minus]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.quickMinus;
        counts[key] = Math.max(0, (counts[key] || 0) - 1);
        renderCounts();
      });
    });

    renderCounts();
  }

  function applyQuickInput() {
    const amount = getTotal();
    const signedAmount = getSignedTotal();
    if (amount <= 0) return;

    quickCategories.forEach((category) => {
      const count = counts[category.key] || 0;
      if (count <= 0) return;

      const input = el(category.spentId);
      if (!input) return;

      const delta = count * selectedUnit * (quickMode === "subtract" ? -1 : 1);
      input.value = Math.max(0, getNumber(category.spentId) + delta);
    });

    if (typeof window.updateScreen === "function") window.updateScreen();
    if (typeof window.scheduleAutosave === "function") window.scheduleAutosave();
    if (typeof window.showStatus === "function") {
      const actionText = signedAmount < 0 ? "取り消しました" : "追加しました";
      window.showStatus(`支出をまとめて${formatYen(Math.abs(signedAmount))}円${actionText}。`);
    }

    markTodayChecked();
    resetCounts();
  }


  function applyDailyShortcut(spentId, amount) {
    const input = el(spentId);
    const value = Number(amount) || 0;
    if (!input || value <= 0) return;

    input.value = getNumber(spentId) + value;

    if (typeof window.updateScreen === "function") window.updateScreen();
    if (typeof window.scheduleAutosave === "function") window.scheduleAutosave();
    if (typeof window.showStatus === "function") {
      window.showStatus(`${formatYen(value)}円を追加しました。`);
    }

    markTodayChecked();
  }

  function init() {
    if (!el("quickCategoryList")) return;

    quickCategories.forEach((category) => {
      counts[category.key] = 0;
    });

    document.querySelectorAll("[data-quick-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        quickMode = button.dataset.quickMode === "subtract" ? "subtract" : "add";
        document.querySelectorAll("[data-quick-mode]").forEach((item) => {
          item.classList.toggle("active", item === button);
        });
        renderCounts();
      });
    });

    document.querySelectorAll("[data-quick-unit]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedUnit = Number(button.dataset.quickUnit) || 1000;
        document.querySelectorAll("[data-quick-unit]").forEach((item) => {
          item.classList.toggle("active", item === button);
        });
        renderCounts();
      });
    });

    el("applyQuickInputButton")?.addEventListener("click", applyQuickInput);
    el("clearQuickCountsButton")?.addEventListener("click", resetCounts);

    el("noSpendTodayButton")?.addEventListener("click", () => {
      markTodayChecked();
      if (typeof window.showStatus === "function") {
        window.showStatus("今日は大きめな支出なしとして記録しました。");
      }
    });

    el("focusQuickInputButton")?.addEventListener("click", () => {
      el("quickUnitBox")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });


    document.querySelectorAll("[data-daily-spend-id]").forEach((button) => {
      button.addEventListener("click", () => {
        applyDailyShortcut(button.dataset.dailySpendId, button.dataset.dailyAmount);
      });
    });

    updateTodayStatus();
    renderRows();

    document.addEventListener("change", (event) => {
      if (String(event.target?.id || "").startsWith("categoryVisible_")) {
        window.setTimeout(renderRows, 0);
      }
    });
  }

  init();
})();
