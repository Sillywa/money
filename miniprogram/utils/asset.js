const { CATEGORY_LIST, CATEGORY_MAP } = require("./categories");

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sumCategory(snapshot, key) {
  const list = (snapshot.assets && snapshot.assets[key]) || [];
  return list.reduce((sum, item) => sum + toNumber(item.amount), 0);
}

function sumAssets(snapshot) {
  return CATEGORY_LIST.reduce((sum, category) => {
    if (category.liability) return sum;
    return sum + sumCategory(snapshot, category.key);
  }, 0);
}

function sumLiabilities(snapshot) {
  return CATEGORY_LIST.reduce((sum, category) => {
    if (!category.liability) return sum;
    return sum + sumCategory(snapshot, category.key);
  }, 0);
}

function netWorth(snapshot) {
  return sumAssets(snapshot) - sumLiabilities(snapshot);
}

function todayRecordDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function createEmptySnapshot(recordDate) {
  return {
    recordDate: recordDate || todayRecordDate(),
    assets: {}
  };
}

function formatMoney(value, options) {
  const opts = options || {};
  const number = toNumber(value);
  const abs = Math.abs(number);
  const text = abs.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (opts.signed) {
    if (number > 0) return `+${text}`;
    if (number < 0) return `-${text}`;
  }
  if (opts.negative) return `-${text}`;
  return text;
}

function formatPercent(value) {
  const number = toNumber(value);
  return `${number.toFixed(1)}%`;
}

function getDeltaClass(delta) {
  if (delta > 0) return "red";
  if (delta < 0) return "green";
  return "muted";
}

function normalizeIdentityValue(value) {
  return String(value || "").trim();
}

function getItemIdentity(key, item) {
  if (!item) return "";
  if (key === "bank") {
    return [item.bankName, item.cardType, item.tailNo].map(normalizeIdentityValue).join("|");
  }
  if (key === "creditCard") {
    return [item.bankName, item.tailNo].map(normalizeIdentityValue).join("|");
  }
  if (key === "housingFund") {
    return [item.name, item.city, item.accountType].map(normalizeIdentityValue).join("|");
  }
  return normalizeIdentityValue(item.name);
}

function findPreviousItem(previous, key, item) {
  const list = (previous.assets && previous.assets[key]) || [];
  if (item.id) {
    const matched = list.find((prev) => prev.id === item.id);
    if (matched) return matched;
  }
  const identity = getItemIdentity(key, item);
  if (!identity || identity.split("|").every((part) => !part)) return {};
  return list.find((prev) => getItemIdentity(key, prev) === identity) || {};
}

function itemTitle(category, item) {
  if (category.key === "bank") return `${item.bankName || "银行卡"} ${item.cardType || ""}`;
  if (category.key === "creditCard") return item.bankName || "信用卡";
  if (category.key === "housingFund") return item.name || "公积金账户";
  return item.name || category.name;
}

function joinFilled(parts) {
  return parts.filter(Boolean).join(" · ");
}

function itemSubtitle(category, item) {
  if (category.key === "bank") return joinFilled([item.tailNo ? `尾号 ${item.tailNo}` : "", item.remark]);
  if (category.key === "creditCard") return joinFilled([item.tailNo ? `尾号 ${item.tailNo}` : "", item.remark]);
  if (category.key === "housingFund") {
    const accountType = item.accountType && item.accountType !== item.name ? item.accountType : "";
    return joinFilled([item.city, accountType]);
  }
  return item.remark || "";
}

function getCategoryRows(current, previous, key, recordDate) {
  const category = CATEGORY_MAP[key];
  const list = (current.assets && current.assets[key]) || [];

  return list.map((item, index) => {
    const previousItem = findPreviousItem(previous, key, item);
    const delta = toNumber(item.amount) - toNumber(previousItem.amount);
    return {
      ...item,
      index,
      title: itemTitle(category, item),
      subtitle: itemSubtitle(category, item),
      amountText: `${category.liability ? "-" : ""}${formatMoney(item.amount)}`,
      editorName: item.editorName || item.updatedByName || (current.lastEditor && current.lastEditor.nickName) || "",
      recordDate: recordDate || current.recordDate,
      delta,
      deltaText: formatMoney(delta, { signed: true }),
      deltaClass: getDeltaClass(delta)
    };
  });
}

function getCategoryHistory(records, key) {
  const sorted = records.slice().sort((a, b) => a.recordDate < b.recordDate ? 1 : -1);

  return sorted.map((record, index) => {
    const previous = sorted[index + 1] || record;
    const total = sumCategory(record, key);
    const previousTotal = sumCategory(previous, key);
    const delta = total - previousTotal;

    return {
      recordDate: record.recordDate,
      editorName: record.lastEditor && record.lastEditor.nickName,
      total,
      totalText: `${CATEGORY_MAP[key].liability ? "-" : ""}${formatMoney(total)}`,
      delta,
      deltaText: formatMoney(delta, { signed: true }),
      deltaClass: getDeltaClass(delta),
      rows: getCategoryRows(record, previous, key, record.recordDate)
    };
  });
}

function buildBundle(snapshots, compareDate) {
  const records = (snapshots && snapshots.length ? snapshots : [createEmptySnapshot()])
    .slice()
    .sort((a, b) => a.recordDate > b.recordDate ? 1 : -1);
  const current = records[records.length - 1];
  const compareRecords = records.filter((record) => record.recordDate !== current.recordDate);
  const fallbackPrevious = compareRecords[compareRecords.length - 1] || current;
  const previous = compareRecords.find((record) => record.recordDate === compareDate) || fallbackPrevious;
  const totalAssets = sumAssets(current);
  const totalLiabilities = sumLiabilities(current);
  const totalNet = totalAssets - totalLiabilities;
  const previousAssets = sumAssets(previous);
  const previousLiabilities = sumLiabilities(previous);
  const previousNet = previousAssets - previousLiabilities;
  const netDelta = totalNet - previousNet;
  const totalLiabilitiesDelta = totalLiabilities - previousLiabilities;
  const netRate = previousNet ? (netDelta / previousNet) * 100 : 0;
  const liabilitiesPercentBase = Math.abs(totalLiabilities) + totalAssets;

  const categories = CATEGORY_LIST.map((category) => {
    const amount = sumCategory(current, category.key);
    const previousAmount = sumCategory(previous, category.key);
    const delta = amount - previousAmount;
    const percentBase = category.liability ? liabilitiesPercentBase : totalNet;
    const percentAmount = category.liability ? Math.abs(amount) : amount;
    const percent = percentBase ? (percentAmount / percentBase) * 100 : 0;
    return {
      ...category,
      amount,
      amountText: `${category.liability ? "-" : ""}${formatMoney(amount)}`,
      delta,
      deltaText: formatMoney(delta, { signed: true }),
      deltaClass: getDeltaClass(delta),
      percent,
      percentText: formatPercent(percent),
      count: ((current.assets && current.assets[category.key]) || []).length
    };
  });

  return {
    records,
    compareRecords: compareRecords.length ? compareRecords : [current],
    current,
    previous,
    totalAssets,
    totalLiabilities,
    totalNet,
    previousAssets,
    previousLiabilities,
    previousNet,
    netDelta,
    netDeltaText: formatMoney(netDelta, { signed: true }),
    netDeltaClass: getDeltaClass(netDelta),
    netRate,
    netRateText: `${netRate >= 0 ? "+" : ""}${netRate.toFixed(2)}%`,
    totalLiabilitiesDelta,
    totalLiabilitiesDeltaText: formatMoney(totalLiabilitiesDelta, { signed: true }),
    totalLiabilitiesDeltaClass: getDeltaClass(totalLiabilitiesDelta),
    totalAssetsText: formatMoney(totalAssets),
    totalLiabilitiesText: formatMoney(totalLiabilities),
    totalNetText: formatMoney(totalNet),
    categories
  };
}

function getNetTrend(records) {
  return records.map((record) => ({
    label: record.recordDate.slice(5),
    value: netWorth(record)
  }));
}

function getMonthLabel(recordDate) {
  const text = String(recordDate || todayRecordDate());
  const parts = text.split("-");
  if (parts.length < 2) return "本月";
  return `${Number(parts[1])}月`;
}

function getMonthKey(recordDate) {
  return String(recordDate || "").slice(0, 7);
}

function getPreviousRecord(records, current) {
  const sorted = (records || []).slice().sort((a, b) => a.recordDate > b.recordDate ? 1 : -1);
  const index = sorted.findIndex((record) => record.recordDate === current.recordDate);
  return index > 0 ? sorted[index - 1] : current;
}

function buildMonthlyReport(records) {
  const bundle = buildBundle(records);
  const current = bundle.current;
  const previous = getPreviousRecord(bundle.records, current);
  const monthKey = getMonthKey(current.recordDate);
  const monthRecords = bundle.records.filter((record) => getMonthKey(record.recordDate) === monthKey);
  const firstMonthRecord = monthRecords[0] || current;
  const monthNetDelta = netWorth(current) - netWorth(firstMonthRecord);
  const liabilityDelta = sumLiabilities(current) - sumLiabilities(previous);
  const categoryDeltas = CATEGORY_LIST.map((category) => ({
    ...category,
    delta: sumCategory(current, category.key) - sumCategory(previous, category.key)
  })).filter((category) => category.delta !== 0);
  const bestCategory = categoryDeltas
    .filter((category) => !category.liability)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] || null;

  return {
    monthLabel: getMonthLabel(current.recordDate),
    recordCount: monthRecords.length,
    recordCountText: `${monthRecords.length} 次记录`,
    netDelta: monthNetDelta,
    netDeltaText: formatMoney(monthNetDelta, { signed: true }),
    netDeltaClass: getDeltaClass(monthNetDelta),
    latestDate: current.recordDate,
    firstDate: firstMonthRecord.recordDate,
    bestCategoryName: bestCategory ? bestCategory.name : "暂无明显变化",
    bestCategoryDeltaText: bestCategory ? formatMoney(bestCategory.delta, { signed: true }) : "0.00",
    bestCategoryClass: bestCategory ? getDeltaClass(bestCategory.delta) : "muted",
    liabilityDelta,
    liabilityDeltaText: formatMoney(liabilityDelta, { signed: true }),
    liabilityDeltaClass: getDeltaClass(liabilityDelta)
  };
}

function buildAssetHealth(records, goalNetWorth) {
  const bundle = buildBundle(records);
  const totalAssets = Math.max(0, bundle.totalAssets);
  const totalLiabilities = Math.max(0, bundle.totalLiabilities);
  const net = bundle.totalNet;
  const liabilityBase = totalAssets + totalLiabilities;
  const liabilityRate = liabilityBase ? totalLiabilities / liabilityBase * 100 : 0;
  const cashAmount = ["bank", "wechat", "alipay"].reduce((sum, key) => sum + sumCategory(bundle.current, key), 0);
  const cashRatio = totalAssets ? cashAmount / totalAssets * 100 : 0;
  const recordCount = bundle.records.length;
  const recentRecords = bundle.records.slice(-3);
  const recentDelta = recentRecords.length > 1 ? netWorth(recentRecords[recentRecords.length - 1]) - netWorth(recentRecords[0]) : 0;
  const goal = Math.max(0, toNumber(goalNetWorth));
  const goalProgress = goal ? Math.max(0, Math.min(100, net / goal * 100)) : 0;

  let score = 50;
  if (liabilityRate <= 20) score += 22;
  else if (liabilityRate <= 40) score += 12;
  else score -= 8;
  if (cashRatio >= 10 && cashRatio <= 60) score += 14;
  else if (cashRatio > 0) score += 6;
  if (recordCount >= 6) score += 10;
  else if (recordCount >= 3) score += 6;
  if (recentDelta > 0) score += 8;
  if (goalProgress >= 80) score += 8;
  else if (goalProgress >= 40) score += 4;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const level = score >= 85 ? "稳健" : score >= 70 ? "良好" : score >= 55 ? "关注" : "待改善";
  const tips = [
    liabilityRate <= 30 ? "负债压力较低" : "负债率偏高，建议关注还款节奏",
    cashRatio >= 10 ? "现金类资产有一定缓冲" : "现金类资产偏少，可留意流动性",
    recordCount >= 3 ? "记录频率有助于观察趋势" : "多记录几次后健康分会更准确"
  ];

  return {
    score,
    level,
    liabilityRate,
    liabilityRateText: formatPercent(liabilityRate),
    cashRatio,
    cashRatioText: formatPercent(cashRatio),
    goalProgress,
    goalProgressText: formatPercent(goalProgress),
    recordCount,
    primaryTip: tips[0],
    tips
  };
}

function buildCompletionReminder(records) {
  const bundle = buildBundle(records);
  const current = bundle.current;
  const previous = getPreviousRecord(bundle.records, current);
  if (!previous || previous.recordDate === current.recordDate) {
    return {
      total: 0,
      previousDate: "",
      currentDate: current.recordDate,
      items: []
    };
  }
  const items = [];
  CATEGORY_LIST.forEach((category) => {
    const currentList = (current.assets && current.assets[category.key]) || [];
    const previousList = (previous.assets && previous.assets[category.key]) || [];
    previousList.forEach((item) => {
      const identity = getItemIdentity(category.key, item);
      const existed = identity && currentList.some((currentItem) => getItemIdentity(category.key, currentItem) === identity);
      if (!existed) {
        items.push({
          id: `${category.key}-${items.length}`,
          key: category.key,
          categoryName: category.name,
          color: category.color,
          title: itemTitle(category, item)
        });
      }
    });
  });
  return {
    total: items.length,
    previousDate: previous.recordDate,
    currentDate: current.recordDate,
    items: items.slice(0, 4),
    hasMore: items.length > 4
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createTodaySnapshot(bundle, categoryKey, item, editIndex, targetRecordDate, editor) {
  const today = new Date();
  const recordDate = targetRecordDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const records = clone(bundle.records);
  let current = records.find((record) => record.recordDate === recordDate);

  if (!current) {
    current = createEmptySnapshot(recordDate);
    records.push(current);
  }

  current.assets = current.assets || {};
  current.assets[categoryKey] = current.assets[categoryKey] || [];
  current.lastEditor = editor || current.lastEditor || null;
  const itemWithEditor = {
    ...item,
    editorOpenid: editor && editor.openid,
    editorName: editor && editor.nickName,
    editorAvatarUrl: editor && editor.avatarUrl
  };

  if (editIndex !== undefined && editIndex !== null && editIndex !== "") {
    current.assets[categoryKey][Number(editIndex)] = itemWithEditor;
  } else {
    current.assets[categoryKey].push({
      ...itemWithEditor,
      id: `${categoryKey}-${Date.now()}`
    });
  }

  return records;
}

function maskBundle(bundle) {
  if (!bundle) return bundle;
  const masked = clone(bundle);
  masked.netDeltaText = maskText(masked.netDeltaText);
  masked.netRateText = maskText(masked.netRateText);
  masked.totalAssetsText = maskText(masked.totalAssetsText);
  masked.totalLiabilitiesText = maskText(masked.totalLiabilitiesText);
  masked.totalLiabilitiesDeltaText = maskText(masked.totalLiabilitiesDeltaText);
  masked.totalNetText = maskText(masked.totalNetText);
  masked.categories = (masked.categories || []).map((category) => ({
    ...category,
    amountText: maskText(category.amountText),
    deltaText: maskText(category.deltaText),
    percentText: maskText(category.percentText)
  }));
  return masked;
}

function maskRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    amountText: maskText(row.amountText),
    deltaText: maskText(row.deltaText)
  }));
}

function maskHistoryGroups(groups) {
  return (groups || []).map((group) => ({
    ...group,
    totalText: maskText(group.totalText),
    deltaText: maskText(group.deltaText),
    rows: maskRows(group.rows)
  }));
}

function maskText() {
  return "****";
}

module.exports = {
  buildBundle,
  formatMoney,
  formatPercent,
  getCategoryRows,
  getCategoryHistory,
  maskBundle,
  maskHistoryGroups,
  maskRows,
  getNetTrend,
  buildMonthlyReport,
  buildAssetHealth,
  buildCompletionReminder,
  createTodaySnapshot,
  createEmptySnapshot,
  sumCategory,
  sumAssets,
  sumLiabilities,
  netWorth
};
