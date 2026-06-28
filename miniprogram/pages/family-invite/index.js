const { acceptFamilyInvite, fetchWorkspace, getThemeClass } = require("../../utils/store");

Page({
  data: {
    token: "",
    themeClass: "",
    loading: true,
    accepted: false
  },

  onLoad(query) {
    this.setData({
      token: query.token || ""
    });
    fetchWorkspace().then(() => {
      this.setData({
        themeClass: getThemeClass(),
        loading: false
      });
    }).catch(() => {
      this.setData({
        themeClass: getThemeClass(),
        loading: false
      });
    });
  },

  acceptInvite() {
    if (!this.data.token) {
      wx.showToast({ title: "邀请链接无效", icon: "none" });
      return;
    }
    acceptFamilyInvite(this.data.token).then(() => {
      this.setData({ accepted: true });
      wx.showToast({ title: "已绑定", icon: "success" });
    }).catch(() => {
      wx.showToast({ title: "接受邀请失败", icon: "none" });
    });
  },

  goFamily() {
    wx.redirectTo({
      url: "/pages/family/index"
    });
  },

  goHome() {
    wx.switchTab({
      url: "/pages/dashboard/index"
    });
  }
});
