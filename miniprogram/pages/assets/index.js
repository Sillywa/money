const { buildBundle, getCategoryRows, maskBundle, maskRows } = require("../../utils/asset");
const { CATEGORY_LIST } = require("../../utils/categories");
const { fetchSnapshots, getThemeClass, getViewingInfo, getViewingProfile, returnToSelf } = require("../../utils/store");
const { showMetricHelp } = require("../../utils/metric-help");

Page({
  data: {
    bundle: null,
    groups: [],
    filters: [
      { key: "all", name: "全部", active: true },
      { key: "bank", name: "银行卡", active: false },
      { key: "wealth", name: "理财", active: false },
      { key: "pay", name: "支付账户", active: false },
      { key: "creditCard", name: "负债", active: false }
    ],
    activeFilter: "all",
    accountCount: 0,
    selectedDate: "",
    dateOptions: [],
    dateIndex: 0,
    rawBundle: null,
    privacyMode: false,
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

    return fetchSnapshots({ force: !!opts.force }).then((records) => {
      const baseBundle = buildBundle(records);
      const dateOptions = baseBundle.records.slice().sort((a, b) => a.recordDate < b.recordDate ? 1 : -1).map((record) => record.recordDate);
      const selectedDate = opts.selectedDate || this.data.selectedDate || dateOptions[0] || baseBundle.current.recordDate;
      const selectedRecord = baseBundle.records.find((record) => record.recordDate === selectedDate) || baseBundle.current;
      const rawBundle = buildBundle([selectedRecord]);
      const privacyMode = !!((getViewingProfile() || {}).privacyEnabled);
      const bundle = privacyMode ? maskBundle(rawBundle) : rawBundle;
      const groups = this.buildGroups(rawBundle, this.data.activeFilter, privacyMode);
      this.setData({
        bundle,
        rawBundle,
        groups,
        accountCount: groups.reduce((sum, item) => sum + item.rows.length, 0),
        selectedDate: selectedRecord.recordDate,
        dateOptions,
        dateIndex: Math.max(0, dateOptions.indexOf(selectedRecord.recordDate)),
        privacyMode,
        viewing: getViewingInfo(),
        themeClass: getThemeClass(),
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

  buildGroups(bundle, filter, privacyMode) {
    const displayBundle = privacyMode ? maskBundle(bundle) : bundle;
    return CATEGORY_LIST.map((category) => {
      const summary = displayBundle.categories.find((item) => item.key === category.key);
      let visible = filter === "all" || filter === category.key;
      if (filter === "pay") visible = category.key === "wechat" || category.key === "alipay";
      const rows = getCategoryRows(bundle.current, bundle.current, category.key);
      return {
        ...summary,
        visible,
        rows: privacyMode ? maskRows(rows) : rows
      };
    });
  },

  setFilter(event) {
    const activeFilter = event.currentTarget.dataset.key;
    this.setData({
      activeFilter,
      filters: this.data.filters.map((item) => ({
        ...item,
        active: item.key === activeFilter
      })),
      groups: this.buildGroups(this.data.rawBundle, activeFilter, this.data.privacyMode)
    });
  },

  onDateChange(event) {
    const selectedDate = this.data.dateOptions[Number(event.detail.value)] || this.data.selectedDate;
    this.setData({ selectedDate });
    this.load({ selectedDate });
  },

  onPullDownRefresh() {
    this.load({ silent: true, force: true }).then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  },

  showMetricHelp,

  returnMine() {
    returnToSelf().then(() => {
      wx.switchTab({
        url: "/pages/dashboard/index"
      });
    });
  },

  goDetail(event) {
    wx.navigateTo({
      url: `/pages/category-detail/index?type=${event.currentTarget.dataset.type}`
    });
  }
});
