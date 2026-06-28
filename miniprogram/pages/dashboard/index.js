const {
  buildBundle,
  buildCompletionReminder,
  getNetTrend,
  maskBundle
} = require("../../utils/asset");
const { fetchSnapshots, getProfile, getThemeClass, getViewingInfo, updateProfile } = require("../../utils/store");
const { showMetricHelp } = require("../../utils/metric-help");

Page({
  data: {
    bundle: null,
    donutItems: [],
    legendItems: [],
    compositionItems: [],
    compositionView: "list",
    trendPoints: [],
    completionReminder: null,
    accountCount: 0,
    compareDate: "",
    compareOptions: [],
    compareIndex: 0,
    privacyMode: false,
    viewing: null,
    themeClass: "",
    showAssetGuide: false,
    guideSaving: false,
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

    return fetchSnapshots({ force: !!opts.force }).then((records) => {
      const rawBundle = buildBundle(records, opts.compareDate !== undefined ? opts.compareDate : this.data.compareDate);
      getApp().globalData.latestBundle = rawBundle;
      const profile = getProfile() || {};
      const privacyMode = !!profile.privacyEnabled;
      const bundle = privacyMode ? maskBundle(rawBundle) : rawBundle;
      const accountCount = rawBundle.categories.reduce((sum, item) => sum + item.count, 0);
      const compareOptions = bundle.compareRecords.map((record) => record.recordDate);
      const donutTotal = rawBundle.categories.reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
      const compositionItems = rawBundle.categories.map((rawItem, index) => {
        const item = bundle.categories[index];
        const weight = Math.abs(Number(item.amount || 0));
        const percent = donutTotal ? weight / donutTotal * 100 : 0;
        return {
          ...item,
          donutPercent: percent,
          donutPercentText: privacyMode ? "****" : `${percent.toFixed(1)}%`
        };
      });
      const viewing = getViewingInfo();
      const showAssetGuide = !viewing.isViewingFamily && !profile.assetGuideSeen && accountCount === 0;
      const rawCompletionReminder = buildCompletionReminder(rawBundle.records);
      const ownerOpenid = (viewing.viewingOwner && viewing.viewingOwner.openid) || profile.openid || "";
      const dismissedCompletionReminderDate = (profile.dismissedCompletionReminderDates || {})[ownerOpenid] || "";
      const shouldHideCompletionReminder = rawCompletionReminder.currentDate &&
        rawCompletionReminder.currentDate === dismissedCompletionReminderDate;
      const visibleCompletionReminder = shouldHideCompletionReminder
        ? { ...rawCompletionReminder, total: 0, items: [], hasMore: false }
        : rawCompletionReminder;
      const completionReminder = privacyMode ? this.maskCompletionReminder(visibleCompletionReminder) : visibleCompletionReminder;
      this.setData({
        bundle,
        accountCount,
        compareDate: rawBundle.previous.recordDate,
        compareOptions,
        compareIndex: Math.max(0, compareOptions.indexOf(bundle.previous.recordDate)),
        donutItems: compositionItems.map((item) => ({
          amount: Math.abs(Number(item.amount || 0)),
          color: item.color
        })),
        legendItems: compositionItems.map((item) => ({
          key: item.key,
          name: item.name,
          color: item.color
        })),
        compositionItems,
        trendPoints: getNetTrend(rawBundle.records),
        completionReminder,
        privacyMode,
        viewing,
        themeClass: getThemeClass(),
        showAssetGuide,
        loading: false,
        hasLoaded: true
      });
    }).catch(() => {
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

  onCompareChange(event) {
    const recordDate = event.detail.recordDate || this.data.compareOptions[Number(event.detail.value)];
    this.setData({ compareDate: recordDate });
    this.load({ compareDate: recordDate });
  },

  showMetricHelp,

  maskCompletionReminder(reminder) {
    return {
      ...reminder,
      items: (reminder.items || []).map((item) => ({
        ...item,
        title: "****"
      }))
    };
  },

  setCompositionView(event) {
    const view = event.currentTarget.dataset.view || "list";
    this.setData({ compositionView: view });
  },

  goDetail(event) {
    const type = event.currentTarget.dataset.type;
    wx.navigateTo({
      url: `/pages/category-detail/index?type=${type}`
    });
  },

  onCompletionReminderTap(event) {
    const type = event.currentTarget.dataset.type;
    wx.navigateTo({
      url: `/pages/category-detail/index?type=${type}`
    });
  },

  closeCompletionReminder() {
    const currentDate = this.data.completionReminder && this.data.completionReminder.currentDate;
    if (!currentDate) return;
    const profile = getProfile() || {};
    const viewing = this.data.viewing || getViewingInfo();
    const ownerOpenid = (viewing.viewingOwner && viewing.viewingOwner.openid) || profile.openid || "";
    if (!ownerOpenid) return;
    const dismissedCompletionReminderDates = {
      ...(profile.dismissedCompletionReminderDates || {}),
      [ownerOpenid]: currentDate
    };
    this.setData({
      completionReminder: {
        ...this.data.completionReminder,
        total: 0,
        items: [],
        hasMore: false
      }
    });
    updateProfile({ dismissedCompletionReminderDates }).catch(() => {
      wx.showToast({
        title: "关闭失败",
        icon: "none"
      });
      this.load({ silent: true, force: true });
    });
  },

  closeAssetGuide() {
    this.markAssetGuideSeen().catch(() => {});
  },

  goAddAssetFromGuide() {
    this.markAssetGuideSeen().then(() => {
      wx.switchTab({
        url: "/pages/assets/index"
      });
    }).catch(() => {});
  },

  noop() {
    return false;
  },

  markAssetGuideSeen() {
    if (this.data.guideSaving) return Promise.resolve();
    this.setData({ guideSaving: true });
    return updateProfile({ assetGuideSeen: true }).then(() => {
      this.setData({
        showAssetGuide: false,
        guideSaving: false
      });
    }).catch(() => {
      this.setData({ guideSaving: false });
      wx.showToast({
        title: "稍后再试",
        icon: "none"
      });
      return Promise.reject(new Error("asset guide save failed"));
    });
  }
});
