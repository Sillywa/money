const {
  acceptFamilyInvite,
  createFamilyInvite,
  fetchFamilyAggregate,
  fetchWorkspace,
  getProfile,
  getThemeClass,
  getViewingInfo,
  getViewingProfile,
  returnToSelf,
  setActiveOwner
} = require("../../utils/store");
const { formatMoney, formatPercent } = require("../../utils/asset");

const DEFAULT_TARGET_NET_WORTH = 1000000;

Page({
  data: {
    inviteToken: "",
    inviteCodeInput: "",
    binding: false,
    familyMembers: [],
    familyAggregate: {
      memberCount: 0,
      accountCount: 0,
      totalAssetsText: "0.00",
      totalLiabilitiesText: "0.00",
      totalNetText: "0.00",
      members: []
    },
    familyTotalText: "0.00",
    familyTargetNetWorth: DEFAULT_TARGET_NET_WORTH,
    familyTargetText: formatMoney(DEFAULT_TARGET_NET_WORTH),
    familyGoalProgress: 0,
    animatedFamilyGoalProgress: 0,
    familyGoalProgressText: "0.0%",
    familyGoalRemainText: "0.00",
    profile: null,
    viewing: null,
    themeClass: "",
    loading: true
  },

  onShow() {
    this.load();
  },

  load() {
    return Promise.all([
      fetchWorkspace(),
      fetchFamilyAggregate()
    ]).then(([result, aggregate]) => {
      const profile = getProfile();
      const privacyMode = !!((getViewingProfile() || profile).privacyEnabled);
      const formattedAggregate = this.formatFamilyAggregate(aggregate, privacyMode);
      const goalState = this.createFamilyGoalState(formattedAggregate, profile, privacyMode);
      this.setData({
        familyMembers: result.familyMembers || [],
        familyAggregate: formattedAggregate,
        familyTotalText: privacyMode ? formattedAggregate.totalNetText : formatMoney(0),
        animatedFamilyGoalProgress: 0,
        ...goalState,
        profile,
        viewing: getViewingInfo(),
        themeClass: getThemeClass(),
        loading: false
      });
      this.animateFamilySummary(formattedAggregate, goalState.familyGoalProgress, privacyMode);
      return this.ensureInviteToken();
    }).catch(() => {
      this.clearFamilyAnimationTimers();
      this.setData({
        themeClass: getThemeClass(),
        loading: false
      });
    });
  },

  ensureInviteToken() {
    if (this.data.inviteToken) return Promise.resolve(this.data.inviteToken);
    return createFamilyInvite().then((result) => {
      const token = result.inviteCode || "";
      this.setData({ inviteToken: token });
      return token;
    });
  },

  refreshInviteCode() {
    createFamilyInvite({ force: true }).then((result) => {
      this.setData({ inviteToken: result.inviteCode || "" });
      wx.showToast({ title: "已生成", icon: "success" });
    }).catch(() => {
      wx.showToast({ title: "生成失败", icon: "none" });
    });
  },

  copyInviteCode() {
    if (!this.data.inviteToken) return;
    wx.setClipboardData({
      data: this.data.inviteToken
    });
  },

  onInviteCodeInput(event) {
    this.setData({
      inviteCodeInput: String(event.detail.value || "").trim().toUpperCase()
    });
  },

  bindByInviteCode() {
    if (this.data.binding) return;
    const code = String(this.data.inviteCodeInput || "").trim().toUpperCase();
    if (!code) {
      wx.showToast({ title: "请输入分享码", icon: "none" });
      return;
    }
    this.setData({ binding: true });
    acceptFamilyInvite(code).then((result) => {
      const profile = getProfile();
      const viewingProfile = getViewingProfile() || profile;
      this.setData({
        inviteCodeInput: "",
        familyMembers: result.familyMembers || [],
        profile,
        viewing: getViewingInfo(),
        themeClass: getThemeClass(),
        binding: false
      });
      wx.showToast({ title: "已绑定", icon: "success" });
      return fetchFamilyAggregate().then((aggregate) => {
        const privacyMode = !!viewingProfile.privacyEnabled;
        const formattedAggregate = this.formatFamilyAggregate(aggregate, privacyMode);
        const goalState = this.createFamilyGoalState(formattedAggregate, profile, privacyMode);
        this.setData({
          familyAggregate: formattedAggregate,
          familyTotalText: privacyMode ? formattedAggregate.totalNetText : formatMoney(0),
          animatedFamilyGoalProgress: 0,
          ...goalState
        });
        this.animateFamilySummary(formattedAggregate, goalState.familyGoalProgress, privacyMode);
      });
    }).catch(() => {
      this.setData({ binding: false });
      wx.showToast({ title: "绑定失败", icon: "none" });
    });
  },

  onHide() {
    this.clearFamilyAnimationTimers();
  },

  onUnload() {
    this.clearFamilyAnimationTimers();
  },

  formatFamilyAggregate(aggregate, privacyMode) {
    const data = aggregate || {};
    const mask = privacyMode ? "****" : "";
    const totalNet = Number(data.totalNet || 0);
    return {
      memberCount: (data.members || []).length,
      accountCount: data.accountCount || 0,
      totalNet,
      totalAssetsText: mask || formatMoney(data.totalAssets),
      totalLiabilitiesText: mask || formatMoney(data.totalLiabilities),
      totalNetText: mask || formatMoney(data.totalNet),
      members: (data.members || []).map((item) => {
        const contribution = totalNet > 0 ? Number(item.totalNet || 0) / totalNet * 100 : 0;
        return {
          ...item,
          ownerOpenid: item.owner && item.owner.openid,
          totalNetText: mask || formatMoney(item.totalNet),
          totalLiabilitiesText: mask || formatMoney(item.totalLiabilities),
          contributionText: mask || formatPercent(contribution)
        };
      })
    };
  },

  createFamilyGoalState(aggregate, profile, privacyMode) {
    const target = positiveNumber(profile && profile.goalNetWorth, DEFAULT_TARGET_NET_WORTH);
    const totalNet = Number((aggregate && aggregate.totalNet) || 0);
    const progress = target > 0 ? clamp(totalNet / target * 100, 0, 100) : 0;
    const remain = Math.max(target - totalNet, 0);
    return {
      familyTargetNetWorth: target,
      familyTargetText: privacyMode ? "****" : formatMoney(target),
      familyGoalProgress: privacyMode ? 0 : progress.toFixed(1),
      familyGoalProgressText: privacyMode ? "****" : `${progress.toFixed(1)}%`,
      familyGoalRemainText: privacyMode ? "****" : formatMoney(remain)
    };
  },

  animateFamilySummary(aggregate, targetProgress, privacyMode) {
    this.clearFamilyAnimationTimers();
    if (privacyMode) {
      this.setData({
        familyTotalText: aggregate.totalNetText,
        animatedFamilyGoalProgress: 0
      });
      return;
    }

    const targetTotal = Number(aggregate.totalNet || 0);
    const progressTarget = Number(targetProgress || 0);
    const duration = 720;
    const startedAt = Date.now();

    this._familySummaryTimer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.setData({
        familyTotalText: progress >= 1 ? aggregate.totalNetText : formatMoney(targetTotal * eased),
        animatedFamilyGoalProgress: progress >= 1 ? progressTarget.toFixed(1) : (progressTarget * eased).toFixed(1)
      });
      if (progress >= 1) this.clearFamilyAnimationTimers();
    }, 32);
  },

  clearFamilyAnimationTimers() {
    if (!this._familySummaryTimer) return;
    clearInterval(this._familySummaryTimer);
    this._familySummaryTimer = null;
  },

  viewMember(event) {
    const ownerOpenid = event.currentTarget.dataset.openid;
    setActiveOwner(ownerOpenid).then(() => {
      wx.switchTab({
        url: "/pages/dashboard/index"
      });
    });
  },

  returnMine() {
    returnToSelf().then(() => {
      wx.switchTab({
        url: "/pages/dashboard/index"
      });
    });
  }
});

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
