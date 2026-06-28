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
  createTodaySnapshot,
  createEmptySnapshot,
  sumCategory,
  sumAssets,
  sumLiabilities,
  netWorth
};
