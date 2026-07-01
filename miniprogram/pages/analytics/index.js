const { buildBundle, formatMoney, maskBundle } = require("../../utils/asset");
const { fetchSnapshots, getThemeClass, getViewingInfo, getViewingProfile, returnToSelf, updateProfile } = require("../../utils/store");
const { showMetricHelp } = require("../../utils/metric-help");

const DEFAULT_TARGET_NET_WORTH = 1000000;
const DEFAULT_PRINCIPAL = 100000;
const DEFAULT_ANNUAL_RATE = 5;
const DEFAULT_PROJECTION_YEARS = 10;

Page({
  data: {
    bundle: null,
    privacyMode: false,
    viewing: null,
    themeClass: "",
    loading: true,
    hasLoaded: false,
    targetNetWorth: DEFAULT_TARGET_NET_WORTH,
    targetNetWorthInput: String(DEFAULT_TARGET_NET_WORTH),
    targetNetWorthText: formatMoney(DEFAULT_TARGET_NET_WORTH),
    latestNetText: "0.00",
    animatedLatestNetText: "0.00",
    goalProgress: 0,
    animatedGoalProgress: 0,
    goalProgressText: "0.0%",
    goalRemainText: "0.00",
    principal: DEFAULT_PRINCIPAL,
    principalInput: String(DEFAULT_PRINCIPAL),
    annualRate: DEFAULT_ANNUAL_RATE,
    annualRateInput: String(DEFAULT_ANNUAL_RATE),
    projectionYears: DEFAULT_PROJECTION_YEARS,
    projectionPoints: [],
    projectionFinalText: "0.00",
    projectionGrowthText: "0.00"
  },

  onShow() {
    this.load();
  },

  onHide() {
    this.clearGoalAnimationTimer();
  },

  onUnload() {
    this.clearGoalAnimationTimer();
  },

  load(options) {
    const opts = options || {};
    if (!this.data.hasLoaded && !opts.silent) {
      this.setData({ loading: true });
    }

    return fetchSnapshots({ force: !!opts.force }).then((records) => {
      const rawBundle = buildBundle(records);
      const profile = getViewingProfile() || {};
      const privacyMode = !!profile.privacyEnabled;
      const bundle = privacyMode ? maskBundle(rawBundle) : rawBundle;
      const goalState = this.createGoalState(rawBundle, profile, privacyMode);

      this.setData({
        bundle,
        ...goalState,
        animatedLatestNetText: privacyMode ? goalState.latestNetText : formatMoney(0),
        animatedGoalProgress: 0,
        privacyMode,
        viewing: getViewingInfo(),
        themeClass: getThemeClass(),
        loading: false,
        hasLoaded: true
      });
      this.animateGoalProgress(goalState, privacyMode);
    }).catch(() => {
      this.clearGoalAnimationTimer();
      this.setData({
        themeClass: getThemeClass(),
        loading: false,
        hasLoaded: true
      });
    });
  },

  onPullDownRefresh() {
    this.load({ silent: true, force: true }).then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  },

  showMetricHelp,

  onTargetInput(event) {
    this.setData({ targetNetWorthInput: event.detail.value });
  },

  saveTargetNetWorth() {
    const value = parseAmount(this.data.targetNetWorthInput);
    if (value === null || value <= 0) {
      wx.showToast({ title: "请输入目标金额", icon: "none" });
      return;
    }
    updateProfile({ goalNetWorth: value }).then(() => {
      this.refreshGoalFromInputs({ animateGoal: true });
      wx.showToast({ title: "已保存", icon: "success" });
    });
  },

  onPrincipalInput(event) {
    this.setData({ principalInput: event.detail.value });
  },

  onAnnualRateInput(event) {
    this.setData({ annualRateInput: event.detail.value });
  },

  setProjectionYears(event) {
    const years = Number(event.currentTarget.dataset.years || DEFAULT_PROJECTION_YEARS);
    this.setData({ projectionYears: years });
    this.refreshGoalFromInputs();
    this.saveProjectionSettings({ silent: true });
  },

  saveProjectionSettings(options) {
    const opts = options || {};
    const principal = parseAmount(this.data.principalInput);
    const annualRate = parseRate(this.data.annualRateInput);

    if (principal === null || principal < 0) {
      wx.showToast({ title: "请输入本金", icon: "none" });
      return;
    }
    if (annualRate === null) {
      wx.showToast({ title: "请输入收益率", icon: "none" });
      return;
    }

    updateProfile({
      calcPrincipal: principal,
      calcAnnualRate: annualRate,
      calcYears: this.data.projectionYears
    }).then(() => {
      this.refreshGoalFromInputs();
      if (!opts.silent) wx.showToast({ title: "已更新", icon: "success" });
    });
  },

  returnMine() {
    returnToSelf().then(() => {
      wx.switchTab({
        url: "/pages/dashboard/index"
      });
    });
  },

  refreshGoalFromInputs(options) {
    const opts = options || {};
    const rawBundle = this.data.bundle || buildBundle([]);
    const profile = {
      goalNetWorth: parseAmount(this.data.targetNetWorthInput) || this.data.targetNetWorth,
      calcPrincipal: parseAmount(this.data.principalInput) || 0,
      calcAnnualRate: parseRate(this.data.annualRateInput) || 0,
      calcYears: this.data.projectionYears
    };
    const goalState = this.createGoalState(rawBundle, profile, this.data.privacyMode);
    this.setData(goalState);
    if (opts.animateGoal) {
      this.setData({
        animatedLatestNetText: this.data.privacyMode ? goalState.latestNetText : formatMoney(0),
        animatedGoalProgress: 0
      });
      this.animateGoalProgress(goalState, this.data.privacyMode);
    }
  },

  createGoalState(rawBundle, profile, privacyMode) {
    const targetNetWorth = positiveNumber(profile.goalNetWorth, DEFAULT_TARGET_NET_WORTH);
    const principal = nonNegativeNumber(profile.calcPrincipal, DEFAULT_PRINCIPAL);
    const annualRate = numberOrDefault(profile.calcAnnualRate, DEFAULT_ANNUAL_RATE);
    const projectionYears = Number(profile.calcYears || DEFAULT_PROJECTION_YEARS);
    const latestNet = Number(rawBundle.totalNet || 0);
    const progress = targetNetWorth > 0 ? clamp(latestNet / targetNetWorth * 100, 0, 100) : 0;
    const remain = Math.max(targetNetWorth - latestNet, 0);
    const projectionPoints = createProjectionPoints(principal, annualRate, projectionYears);
    const finalValue = projectionPoints.length ? projectionPoints[projectionPoints.length - 1].value : principal;
    const growth = finalValue - principal;

    return {
      targetNetWorth,
      targetNetWorthInput: formatInputNumber(targetNetWorth),
      targetNetWorthText: privacyMode ? "****" : formatMoney(targetNetWorth),
      latestNetValue: latestNet,
      latestNetText: privacyMode ? "****" : rawBundle.totalNetText,
      goalProgress: privacyMode ? 0 : progress.toFixed(1),
      goalProgressText: privacyMode ? "****" : `${progress.toFixed(1)}%`,
      goalRemainText: privacyMode ? "****" : formatMoney(remain),
      principal,
      principalInput: formatInputNumber(principal),
      annualRate,
      annualRateInput: formatInputNumber(annualRate),
      projectionYears,
      projectionPoints,
      projectionFinalText: privacyMode ? "****" : formatMoney(finalValue),
      projectionGrowthText: privacyMode ? "****" : formatMoney(growth)
    };
  },

  animateGoalProgress(goalState, privacyMode) {
    this.clearGoalAnimationTimer();
    if (privacyMode) {
      this.setData({
        animatedLatestNetText: goalState.latestNetText,
        animatedGoalProgress: 0
      });
      return;
    }

    const targetNet = Number(goalState.latestNetValue || 0);
    const targetProgress = Number(goalState.goalProgress || 0);
    const duration = 720;
    const startedAt = Date.now();

    this._goalAnimationTimer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.setData({
        animatedLatestNetText: progress >= 1 ? goalState.latestNetText : formatMoney(targetNet * eased),
        animatedGoalProgress: progress >= 1 ? targetProgress.toFixed(1) : (targetProgress * eased).toFixed(1)
      });
      if (progress >= 1) this.clearGoalAnimationTimer();
    }, 32);
  },

  clearGoalAnimationTimer() {
    if (!this._goalAnimationTimer) return;
    clearInterval(this._goalAnimationTimer);
    this._goalAnimationTimer = null;
  }
});

function createProjectionPoints(principal, annualRate, years) {
  const rate = Number(annualRate || 0) / 100;
  const totalYears = Number(years || DEFAULT_PROJECTION_YEARS);
  const points = [];
  for (let year = 0; year <= totalYears; year += 1) {
    points.push({
      label: year === 0 ? "本金" : `${year}年`,
      value: principal * Math.pow(1 + rate, year)
    });
  }
  return points;
}

function parseAmount(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  if (!Number.isFinite(number)) return null;
  return number;
}

function parseRate(value) {
  const number = Number(String(value || "").replace(/%/g, ""));
  if (!Number.isFinite(number) || number <= -100 || number > 100) return null;
  return number;
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, fallback) {
  const number = numberOrDefault(value, fallback);
  return number > 0 ? number : fallback;
}

function nonNegativeNumber(value, fallback) {
  const number = numberOrDefault(value, fallback);
  return number >= 0 ? number : fallback;
}

function formatInputNumber(value) {
  const number = Number(value || 0);
  if (Number.isInteger(number)) return String(number);
  return String(Number(number.toFixed(2)));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
