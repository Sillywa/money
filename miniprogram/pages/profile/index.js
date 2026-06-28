const {
  fetchWorkspace,
  getProfile,
  getThemeClass,
  getViewingInfo,
  returnToSelf,
  setDarkMode,
  setPrivacyEnabled,
  updateProfile
} = require("../../utils/store");
const {
  buildAssetHealth,
  buildMonthlyReport
} = require("../../utils/asset");

Page({
  data: {
    profile: null,
    monthlyReport: buildMonthlyReport([]),
    health: buildAssetHealth([], 1000000),
    savedNickName: "资产记录者",
    recordCount: 0,
    reminderText: "每月 1 日 10:00",
    viewing: null,
    themeClass: "",
    loading: true,
    hasLoaded: false
  },

  onShow() {
    this.load();
  },

  load(options) {
    const opts = options || {};
    if (!this.data.hasLoaded && !opts.silent) {
      this.setData({ loading: true });
    }

    return fetchWorkspace({ force: !!opts.force }).then((result) => {
      const reminder = result.reminder || {};
      const profile = getProfile();
      const snapshots = result.snapshots || [];
      const privacyMode = !!profile.privacyEnabled;
      const rawMonthlyReport = buildMonthlyReport(snapshots);
      const rawHealth = buildAssetHealth(snapshots, profile.goalNetWorth);
      this.setData({
        profile,
        monthlyReport: privacyMode ? this.maskMonthlyReport(rawMonthlyReport) : rawMonthlyReport,
        health: privacyMode ? this.maskHealth(rawHealth) : rawHealth,
        savedNickName: profile.nickName || "资产记录者",
        recordCount: snapshots.length,
        reminderText: reminder.enabled ? `每月 ${reminder.dayOfMonth} 日 10:00` : "未设置",
        viewing: getViewingInfo(),
        themeClass: getThemeClass(),
        loading: false,
        hasLoaded: true
      });
    }).catch(() => {
      const profile = getProfile();
      const privacyMode = !!profile.privacyEnabled;
      const rawMonthlyReport = buildMonthlyReport([]);
      const rawHealth = buildAssetHealth([], profile.goalNetWorth);
      this.setData({
        profile,
        monthlyReport: privacyMode ? this.maskMonthlyReport(rawMonthlyReport) : rawMonthlyReport,
        health: privacyMode ? this.maskHealth(rawHealth) : rawHealth,
        savedNickName: profile.nickName || "资产记录者",
        viewing: getViewingInfo(),
        themeClass: getThemeClass(),
        loading: false,
        hasLoaded: true
      });
    });
  },

  onChooseAvatar(event) {
    const avatarUrl = event.detail.avatarUrl;
    if (!avatarUrl) return;
    const openid = getApp().globalData.openid || "default";
    const ext = avatarUrl.includes(".png") ? "png" : "jpg";

    wx.cloud.uploadFile({
      cloudPath: `avatars/${openid}/${Date.now()}.${ext}`,
      filePath: avatarUrl
    }).then((res) => updateProfile({ avatarUrl: res.fileID }))
      .then(() => {
        this.setData({
          "profile.avatarUrl": getApp().globalData.profile.avatarUrl
        });
        wx.showToast({
          title: "头像已更新",
          icon: "success"
        });
      }).catch(() => {
        wx.showToast({
          title: "头像更新失败",
          icon: "none"
        });
      });
  },

  onNicknameInput(event) {
    const nickName = event.detail.value || "资产记录者";
    this.setData({
      "profile.nickName": nickName
    });
  },

  saveNickname() {
    const nickName = normalizeNickName(this.data.profile && this.data.profile.nickName);
    if (nickName === this.data.savedNickName) {
      this.setData({
        "profile.nickName": nickName
      });
      return;
    }

    updateProfile({ nickName }).then(() => {
      this.setData({
        savedNickName: nickName,
        "profile.nickName": nickName
      });
      wx.showToast({
        title: "昵称已更新",
        icon: "success"
      });
    });
  },

  onPrivacyChange(event) {
    setPrivacyEnabled(event.detail.value).then(() => {
      const profile = {
        ...(this.data.profile || {}),
        privacyEnabled: event.detail.value
      };
      this.setData({
        profile,
        monthlyReport: event.detail.value ? this.maskMonthlyReport(this.data.monthlyReport) : this.data.monthlyReport,
        health: event.detail.value ? this.maskHealth(this.data.health) : this.data.health
      });
      this.load({ silent: true, force: true });
    });
  },

  maskMonthlyReport(report) {
    return {
      ...(report || {}),
      netDeltaText: "****",
      bestCategoryDeltaText: "****",
      liabilityDeltaText: "****"
    };
  },

  maskHealth(health) {
    return {
      ...(health || {}),
      liabilityRateText: "****",
      cashRatioText: "****",
      goalProgressText: "****"
    };
  },

  onDarkModeChange(event) {
    const darkMode = !!event.detail.value;
    setDarkMode(darkMode).then(() => {
      this.setData({
        "profile.darkMode": darkMode,
        themeClass: getThemeClass()
      });
    }).catch(() => {
      this.setData({
        "profile.darkMode": !darkMode,
        themeClass: getThemeClass()
      });
      wx.showToast({
        title: "切换失败",
        icon: "none"
      });
    });
  },

  goReminder() {
    wx.navigateTo({
      url: "/pages/reminder/index"
    });
  },

  goFamily() {
    wx.navigateTo({
      url: "/pages/family/index"
    });
  },

  returnMine() {
    returnToSelf().then(() => {
      wx.switchTab({
        url: "/pages/dashboard/index"
      });
    });
  },

  onPullDownRefresh() {
    this.load({ silent: true, force: true }).then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  }
});

function normalizeNickName(value) {
  const nickName = String(value || "").trim();
  return nickName || "资产记录者";
}
