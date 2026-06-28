const {
  acceptFamilyInvite,
  createFamilyInvite,
  fetchWorkspace,
  getProfile,
  getThemeClass,
  getViewingInfo,
  setActiveOwner
} = require("../../utils/store");

Page({
  data: {
    inviteToken: "",
    inviteCodeInput: "",
    binding: false,
    familyMembers: [],
    profile: null,
    viewing: null,
    themeClass: "",
    loading: true
  },

  onShow() {
    this.load();
  },

  load() {
    return fetchWorkspace().then((result) => {
      this.setData({
        familyMembers: result.familyMembers || [],
        profile: getProfile(),
        viewing: getViewingInfo(),
        themeClass: getThemeClass(),
        loading: false
      });
      return this.ensureInviteToken();
    }).catch(() => {
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
    createFamilyInvite().then((result) => {
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
      this.setData({
        inviteCodeInput: "",
        familyMembers: result.familyMembers || [],
        profile: getProfile(),
        viewing: getViewingInfo(),
        themeClass: getThemeClass(),
        binding: false
      });
      wx.showToast({ title: "已绑定", icon: "success" });
    }).catch(() => {
      this.setData({ binding: false });
      wx.showToast({ title: "绑定失败", icon: "none" });
    });
  },

  viewMember(event) {
    const ownerOpenid = event.currentTarget.dataset.openid;
    setActiveOwner(ownerOpenid).then(() => {
      wx.switchTab({
        url: "/pages/dashboard/index"
      });
    });
  }
});
