const {
  fetchWorkspace,
  getProfile,
  getViewingInfo,
  returnToSelf,
  setPrivacyEnabled,
  updateProfile
} = require("../../utils/store");

Page({
  data: {
    profile: null,
    recordCount: 0,
    reminderText: "每月 1 日 10:00",
    viewing: null,
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

    return fetchWorkspace().then((result) => {
      const reminder = result.reminder || {};
      this.setData({
        profile: getProfile(),
        recordCount: (result.snapshots || []).length,
        reminderText: reminder.enabled ? `每月 ${reminder.dayOfMonth} 日 10:00` : "未设置",
        viewing: getViewingInfo(),
        loading: false,
        hasLoaded: true
      });
    }).catch(() => {
      this.setData({
        profile: getProfile(),
        viewing: getViewingInfo(),
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
    const nickName = (this.data.profile && this.data.profile.nickName) || "资产记录者";
    updateProfile({ nickName }).then(() => {
      wx.showToast({
        title: "昵称已更新",
        icon: "success"
      });
    });
  },

  onPrivacyChange(event) {
    setPrivacyEnabled(event.detail.value).then(() => {
      this.setData({
        "profile.privacyEnabled": event.detail.value
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
    this.load({ silent: true }).then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  }
});
