
(function () {
  "use strict";

  const SIZE = 1080;
  const DPR = 1;
  const PERIOD_PREFIX = "monthly-money-meeting-period-data-";

  const IDS = {
    freeMoney: "freeMoney",
    leftInBudget: "summaryLeftInBudget",
    totalSpent: "totalSpent",
    totalBudget: "totalBudget",
    remainingMoney: "remainingMoney",
    activePeriodText: "activePeriodText",
  };

  const incomeIds = ["incomeJob", "incomeAllowance", "incomeOther"];
  const fixedIds = ["fixedPhone", "fixedSubscription", "fixedPass", "fixedOther"];
  const budgetIds = [
    "budgetFood", "budgetTransport", "budgetSocial", "budgetDate", "budgetHobby",
    "budgetFashion", "budgetStudy", "budgetReserve", "budgetSaving"
  ];
  const spentIds = [
    "spentFood", "spentTransport", "spentSocial", "spentDate", "spentHobby",
    "spentFashion", "spentStudy", "spentReserve", "spentSaving"
  ];

  function el(id) {
    return document.getElementById(id);
  }

  function numberFromText(id) {
    const node = el(id);
    if (!node) return 0;
    const text = String(node.textContent || "0").replace(/[^\d.-]/g, "");
    const value = Number(text);
    return Number.isFinite(value) ? value : 0;
  }

  function numberFromInput(id) {
    const node = el(id);
    if (!node) return 0;
    const value = Number(node.value);
    return Number.isFinite(value) ? value : 0;
  }

  function formatYen(amount) {
    return `${Math.round(amount).toLocaleString("ja-JP")}円`;
  }

  function getShareNumbers() {
    return {
      freeMoney: numberFromText(IDS.freeMoney),
      leftInBudget: numberFromText(IDS.leftInBudget),
      totalSpent: numberFromText(IDS.totalSpent),
      totalBudget: numberFromText(IDS.totalBudget),
      remainingMoney: numberFromText(IDS.remainingMoney),
      periodText: el(IDS.activePeriodText)?.textContent || "",
    };
  }

  function getShareStatus(numbers) {
    if (numbers.totalBudget <= 0) return "neutral";
    if (numbers.remainingMoney < 0 || numbers.leftInBudget < 0) return "danger";
    if (numbers.leftInBudget <= numbers.totalBudget * 0.2) return "caution";
    return "safe";
  }

  function getStatusLabel(status) {
    return {
      safe: "安定",
      caution: "注意",
      danger: "危険",
      neutral: "未設定",
    }[status] || "安定";
  }

  function getStatusMessage(status) {
    return {
      safe: "今月はこのままのペースで大丈夫そうです",
      caution: "少しペース注意です",
      danger: "使いすぎ注意です",
      neutral: "まだ予算が作られていません",
    }[status] || "";
  }

  function getJudgementMessage(status) {
    return {
      safe: "このままなら黒字で終われそうです",
      caution: "残りの使い方を少し絞ると安全です",
      danger: "このままだと予算オーバーです",
      neutral: "まずは今月の予算を作りましょう",
    }[status] || "";
  }

  function getHanemyComment(status) {
    return {
      safe: "財布の羽、まだ落ち着いています。",
      caution: "財布の羽、少し動き始めています。",
      danger: "財布の羽、飛びそうです。",
      neutral: "まずは予算を作りましょう。",
    }[status] || "";
  }

  function palette(status, dark = false) {
    const statusPalettes = {
      safe: { badgeBg: "#e8f5ec", badgeText: "#1f7a3a", accent: "#1f7a3a" },
      caution: { badgeBg: "#fff4d6", badgeText: "#8a5a00", accent: "#b37700" },
      danger: { badgeBg: "#fdecea", badgeText: "#b42318", accent: "#b42318" },
      neutral: { badgeBg: "#eeeeee", badgeText: "#555555", accent: "#6d6254" },
    };

    if (dark) {
      return {
        bg: "#2f2a24",
        card: "#393229",
        soft: "#4a4034",
        ink: "#fffdf8",
        muted: "#e8dcca",
        line: "#6b5b4d",
        gold: "#c59b61",
        mainBox: "#fffdf8",
        mainBoxText: "#2f2a24",
        ...statusPalettes[status],
      };
    }

    return {
      bg: "#f4f1ea",
      card: "#fffdf8",
      soft: "#fff8ec",
      ink: "#2f2a24",
      muted: "#6d6254",
      line: "#e3d8c8",
      gold: "#c59b61",
      mainBox: "#2f2a24",
      mainBoxText: "#ffffff",
      ...statusPalettes[status],
    };
  }

  function formatShortPeriod(periodText) {
    const match = String(periodText).match(/(\d+)年(\d+)月(\d+)日.*?(\d+)年(\d+)月(\d+)日/);
    if (!match) return periodText || "";
    return `${Number(match[2])}/${Number(match[3])}〜${Number(match[5])}/${Number(match[6])}`;
  }

  function drawRoundRect(ctx, x, y, w, h, r, fillStyle, strokeStyle, lineWidth = 0) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle && lineWidth > 0) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function drawText(ctx, text, x, y, options = {}) {
    ctx.fillStyle = options.color || "#2f2a24";
    ctx.font = `${options.weight || "700"} ${options.size || 32}px ${options.family || "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"}`;
    ctx.textAlign = options.align || "left";
    ctx.textBaseline = options.baseline || "alphabetic";
    ctx.fillText(String(text), x, y);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, options = {}) {
    const chars = Array.from(String(text));
    let line = "";
    let currentY = y;

    drawText(ctx, "", x, y, options);
    chars.forEach((char) => {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = char;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    });

    if (line) {
      ctx.fillText(line, x, currentY);
    }

    return currentY + lineHeight;
  }

  async function loadImage(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  async function createCanvasBase(status, dark = false) {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE * DPR;
    canvas.height = SIZE * DPR;
    const ctx = canvas.getContext("2d");
    ctx.scale(DPR, DPR);

    const colors = palette(status, dark);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.globalAlpha = dark ? 0.10 : 0.34;
    ctx.fillStyle = dark ? "#c59b61" : "#fffdf8";
    ctx.beginPath();
    ctx.arc(920, -40, 360, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    drawRoundRect(ctx, 58, 58, 964, 964, 70, colors.card, colors.line, 4);

    return { canvas, ctx, colors };
  }

  async function drawHeader(ctx, colors, status, periodText) {
    const logo = await loadImage("icon-192.png");
    if (logo) {
      ctx.drawImage(logo, 98, 104, 150, 150);
    } else {
      drawRoundRect(ctx, 105, 112, 130, 130, 28, colors.soft, colors.line, 2);
      drawText(ctx, "¥", 170, 190, { color: colors.gold, size: 58, weight: "900", align: "center" });
    }

    drawText(ctx, "ハネミー", 300, 155, { color: colors.ink, size: 58, weight: "900" });
    drawText(ctx, "はねないマネーボード", 306, 200, { color: colors.muted, size: 26, weight: "800" });
    drawText(ctx, "今月の状況", 306, 238, { color: colors.gold, size: 32, weight: "900" });

    drawRoundRect(ctx, 744, 122, 190, 58, 29, colors.badgeBg, null);
    drawText(ctx, `今月のペース：${getStatusLabel(status)}`, 839, 160, {
      color: colors.badgeText,
      size: 23,
      weight: "900",
      align: "center",
    });

    drawText(ctx, formatShortPeriod(periodText), 120, 322, { color: colors.muted, size: 27, weight: "800" });
  }

  function drawFooter(ctx, colors) {
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(120, 952);
    ctx.lineTo(960, 952);
    ctx.stroke();

    drawText(ctx, "Hanemy｜今月のマネーボード", 960, 990, {
      color: colors.muted,
      size: 22,
      weight: "800",
      align: "right",
    });
  }

  async function drawFullCard() {
    const numbers = getShareNumbers();
    const status = getShareStatus(numbers);
    const { canvas, ctx, colors } = await createCanvasBase(status, false);
    await drawHeader(ctx, colors, status, numbers.periodText);

    drawRoundRect(ctx, 118, 368, 844, 150, 36, colors.mainBox, null);
    drawText(ctx, "今月あと使えるお金", 156, 424, { color: colors.muted === "#e8dcca" ? colors.muted : "#e8dcca", size: 30, weight: "900" });
    drawText(ctx, formatYen(numbers.leftInBudget), 156, 490, { color: colors.mainBoxText, size: 58, weight: "900" });

    drawRoundRect(ctx, 118, 542, 844, 124, 34, colors.card, colors.line, 3);
    drawText(ctx, "自由に使えるお金", 156, 590, { color: colors.muted, size: 27, weight: "900" });
    drawText(ctx, formatYen(numbers.freeMoney), 156, 644, { color: colors.ink, size: 46, weight: "900" });

    drawRoundRect(ctx, 118, 690, 407, 126, 30, colors.card, colors.line, 3);
    drawText(ctx, "使った金額", 156, 742, { color: colors.muted, size: 27, weight: "900" });
    drawText(ctx, formatYen(numbers.totalSpent), 156, 796, { color: colors.ink, size: 44, weight: "900" });

    drawRoundRect(ctx, 555, 690, 407, 126, 30, colors.card, colors.line, 3);
    drawText(ctx, "配分した予算", 592, 742, { color: colors.muted, size: 27, weight: "900" });
    drawText(ctx, formatYen(numbers.totalBudget), 592, 796, { color: colors.ink, size: 44, weight: "900" });

    drawText(ctx, getStatusMessage(status), 120, 884, { color: colors.accent, size: 30, weight: "900" });
    drawText(ctx, getJudgementMessage(status), 120, 924, { color: colors.muted, size: 21, weight: "800" });

    drawFooter(ctx, colors);
    return canvas;
  }

  async function drawSimpleCard() {
    const numbers = getShareNumbers();
    const status = getShareStatus(numbers);
    const { canvas, ctx, colors } = await createCanvasBase(status, false);
    await drawHeader(ctx, colors, status, numbers.periodText);

    drawRoundRect(ctx, 118, 380, 844, 188, 36, colors.mainBox, null);
    drawText(ctx, "今月あと使えるお金", 156, 438, { color: "#e8dcca", size: 31, weight: "900" });
    drawText(ctx, formatYen(numbers.leftInBudget), 156, 514, { color: colors.mainBoxText, size: 66, weight: "900" });

    drawRoundRect(ctx, 118, 606, 844, 160, 34, "#f3e5c8", null);
    drawText(ctx, "ハネミーの一言", 156, 658, { color: "#8a5a00", size: 26, weight: "900" });
    wrapText(ctx, getHanemyComment(status), 156, 710, 748, 42, { color: colors.ink, size: 32, weight: "900" });

    drawText(ctx, getStatusMessage(status), 120, 835, { color: colors.accent, size: 30, weight: "900" });

    drawFooter(ctx, colors);
    return canvas;
  }

  async function drawDarkCard() {
    const numbers = getShareNumbers();
    const status = getShareStatus(numbers);
    const { canvas, ctx, colors } = await createCanvasBase(status, true);
    await drawHeader(ctx, colors, status, numbers.periodText);

    drawRoundRect(ctx, 118, 378, 844, 216, 38, colors.mainBox, null);
    drawText(ctx, "今月あと使えるお金", 156, 446, { color: "#6d6254", size: 31, weight: "900" });
    drawText(ctx, formatYen(numbers.leftInBudget), 156, 532, { color: colors.mainBoxText, size: 72, weight: "900" });

    drawRoundRect(ctx, 118, 632, 844, 154, 34, colors.soft, colors.line, 2);
    drawText(ctx, "判断", 156, 684, { color: colors.gold, size: 26, weight: "900" });
    wrapText(ctx, getJudgementMessage(status), 156, 735, 760, 42, { color: colors.ink, size: 32, weight: "900" });

    drawText(ctx, getStatusMessage(status), 120, 860, { color: colors.badgeBg, size: 30, weight: "900" });

    drawFooter(ctx, colors);
    return canvas;
  }

  function getSavedPeriodKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PERIOD_PREFIX)) keys.push(key);
    }
    return keys.sort().reverse();
  }

  function sumData(data, ids) {
    return ids.reduce((total, id) => total + Number(data?.[id] || 0), 0);
  }

  function readPeriodData(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      return {};
    }
  }

  function getPreviousPeriodData() {
    const currentKey = "monthly-money-meeting-period-data-" + (function () {
      const text = el("activePeriodText")?.textContent || "";
      const match = text.match(/(\d+)年(\d+)月(\d+)日/);
      if (!match) return "";
      return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
    })();

    const keys = getSavedPeriodKeys();
    const currentIndex = keys.indexOf(currentKey);
    const previousKey = currentIndex >= 0 ? keys[currentIndex + 1] : keys.find((key) => key !== currentKey);
    return previousKey ? readPeriodData(previousKey) : null;
  }

  async function drawHistoryCard() {
    const numbers = getShareNumbers();
    const status = getShareStatus(numbers);
    const { canvas, ctx, colors } = await createCanvasBase(status, false);
    await drawHeader(ctx, colors, status, numbers.periodText);

    const previous = getPreviousPeriodData();
    const previousSpent = previous ? sumData(previous, spentIds) : null;
    const currentSpent = spentIds.reduce((total, id) => total + numberFromInput(id), 0);
    const difference = previousSpent === null ? null : currentSpent - previousSpent;
    const diffLabel = difference === null
      ? "前回データなし"
      : difference === 0
        ? "前回と同じ"
        : difference > 0
          ? `前回より ${formatYen(Math.abs(difference))} 多い`
          : `前回より ${formatYen(Math.abs(difference))} 少ない`;

    drawRoundRect(ctx, 118, 370, 844, 150, 36, colors.mainBox, null);
    drawText(ctx, "今月あと使えるお金", 156, 426, { color: "#e8dcca", size: 30, weight: "900" });
    drawText(ctx, formatYen(numbers.leftInBudget), 156, 492, { color: colors.mainBoxText, size: 58, weight: "900" });

    drawRoundRect(ctx, 118, 555, 407, 136, 30, colors.card, colors.line, 3);
    drawText(ctx, "今月使った金額", 156, 610, { color: colors.muted, size: 26, weight: "900" });
    drawText(ctx, formatYen(currentSpent), 156, 666, { color: colors.ink, size: 44, weight: "900" });

    drawRoundRect(ctx, 555, 555, 407, 136, 30, colors.card, colors.line, 3);
    drawText(ctx, "前回の使用額", 592, 610, { color: colors.muted, size: 26, weight: "900" });
    drawText(ctx, previousSpent === null ? "なし" : formatYen(previousSpent), 592, 666, { color: colors.ink, size: 44, weight: "900" });

    drawRoundRect(ctx, 118, 725, 844, 130, 32, "#f3e5c8", null);
    drawText(ctx, "前回比", 156, 778, { color: "#8a5a00", size: 26, weight: "900" });
    wrapText(ctx, diffLabel, 156, 828, 748, 40, { color: colors.ink, size: 32, weight: "900" });

    drawText(ctx, getStatusMessage(status), 120, 916, { color: colors.accent, size: 28, weight: "900" });

    drawFooter(ctx, colors);
    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function shareCanvas(canvas, filename, title) {
    const blob = await canvasToBlob(canvas);
    if (!blob) {
      alert("画像の作成に失敗しました。");
      return;
    }

    const file = new File([blob], filename, { type: "image/png" });

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({
          title,
          text: "ハネミー｜今月の状況",
          files: [file],
        });
        return;
      } catch (error) {
        if (error && error.name === "AbortError") return;
      }
    }

    downloadBlob(blob, filename);
  }

  async function makeAndShare(kind) {
    const makers = {
      full: drawFullCard,
      simple: drawSimpleCard,
      dark: drawDarkCard,
      history: drawHistoryCard,
    };

    const names = {
      full: "hanemy-full-share.png",
      simple: "hanemy-simple-share.png",
      dark: "hanemy-dark-share.png",
      history: "hanemy-history-share.png",
    };

    const canvas = await makers[kind]();
    await shareCanvas(canvas, names[kind], "ハネミー｜今月の状況");
  }

  function bindShareButtons() {
    const pairs = [
      ["shareFullButton", "full"],
      ["shareSimpleButton", "simple"],
      ["shareDarkButton", "dark"],
      ["shareHistoryButton", "history"],
    ];

    pairs.forEach(([id, kind]) => {
      const button = el(id);
      if (!button) return;

      button.addEventListener("click", async () => {
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = "画像を作成中...";
        try {
          await makeAndShare(kind);
        } catch (error) {
          console.error(error);
          alert("共有画像の作成に失敗しました。ページを再読み込みしてもう一度試してください。");
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    });
  }

  bindShareButtons();
})();
