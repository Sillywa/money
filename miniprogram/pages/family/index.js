const {
  acceptFamilyInvite,
  createFamilyInvite,
  fetchFamilyAggregate,
  fetchWorkspace,
  getProfile,
  getThemeClass,
  getViewingInfo,
  setActiveOwner
} = require("../../utils/store");
const { formatMoney } = require("../../utils/asset");

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
      const privacyMode = !!profile.privacyEnabled;
      this.setData({
        familyMembers: result.familyMembers || [],
        familyAggregate: this.formatFamilyAggregate(aggregate, privacyMode),
        profile,
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
      const profile = getProfile();
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
        this.setData({
          familyAggregate: this.formatFamilyAggregate(aggregate, !!profile.privacyEnabled)
        });
      });
    }).catch(() => {
      this.setData({ binding: false });
      wx.showToast({ title: "绑定失败", icon: "none" });
    });
  },

  formatFamilyAggregate(aggregate, privacyMode) {
    const data = aggregate || {};
    const mask = privacyMode ? "****" : "";
    return {
      memberCount: (data.members || []).length,
      accountCount: data.accountCount || 0,
      totalAssetsText: mask || formatMoney(data.totalAssets),
      totalLiabilitiesText: mask || formatMoney(data.totalLiabilities),
      totalNetText: mask || formatMoney(data.totalNet),
      members: (data.members || []).map((item) => ({
        ...item,
        ownerOpenid: item.owner && item.owner.openid,
        totalNetText: mask || formatMoney(item.totalNet),
        totalLiabilitiesText: mask || formatMoney(item.totalLiabilities)
      }))
    };
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
