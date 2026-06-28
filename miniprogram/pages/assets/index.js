const { buildBundle, getCategoryRows, maskBundle, maskRows } = require("../../utils/asset");
const { CATEGORY_LIST } = require("../../utils/categories");
const { fetchSnapshots, getProfile, getViewingInfo } = require("../../utils/store");
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
    previousCount: 0,
    compareDate: "",
    compareOptions: [],
    compareIndex: 0,
    rawBundle: null,
    privacyMode: false,
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

    return fetchSnapshots().then((records) => {
      const rawBundle = buildBundle(records, opts.compareDate !== undefined ? opts.compareDate : this.data.compareDate);
      const privacyMode = !!((getProfile() || {}).privacyEnabled);
      const bundle = privacyMode ? maskBundle(rawBundle) : rawBundle;
      const groups = this.buildGroups(rawBundle, this.data.activeFilter, privacyMode);
      const compareOptions = bundle.compareRecords.map((record) => record.recordDate);
      const previousCount = Object.keys(rawBundle.previous.assets || {}).reduce((sum, key) => {
        return sum + ((rawBundle.previous.assets && rawBundle.previous.assets[key]) || []).length;
      }, 0);
      this.setData({
        bundle,
        rawBundle,
        groups,
        accountCount: groups.reduce((sum, item) => sum + item.rows.length, 0),
        previousCount,
        compareDate: rawBundle.previous.recordDate,
        compareOptions,
        compareIndex: Math.max(0, compareOptions.indexOf(bundle.previous.recordDate)),
        privacyMode,
        viewing: getViewingInfo(),
        loading: false,
        hasLoaded: true
      });
    }).catch(() => {
      this.setData({ loading: false, hasLoaded: true });
    });
  },

  buildGroups(bundle, filter, privacyMode) {
    const displayBundle = privacyMode ? maskBundle(bundle) : bundle;
    return CATEGORY_LIST.map((category) => {
      const summary = displayBundle.categories.find((item) => item.key === category.key);
      let visible = filter === "all" || filter === category.key;
      if (filter === "pay") visible = category.key === "wechat" || category.key === "alipay";
      const rows = getCategoryRows(bundle.current, bundle.previous, category.key);
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

  onCompareChange(event) {
    const recordDate = event.detail.recordDate || this.data.compareOptions[Number(event.detail.value)];
    this.setData({ compareDate: recordDate });
    this.load({ compareDate });
  },

  onPullDownRefresh() {
    this.load({ silent: true }).then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  },

  showMetricHelp,

  goDetail(event) {
    wx.navigateTo({
      url: `/pages/category-detail/index?type=${event.currentTarget.dataset.type}`
    });
  }
});
