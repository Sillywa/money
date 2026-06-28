const { CATEGORY_MAP } = require("../../utils/categories");
const {
  buildBundle,
  formatMoney,
  getCategoryHistory,
  maskBundle,
  maskHistoryGroups,
} = require("../../utils/asset");
const { deleteRecordItem, fetchSnapshots, getProfile, getThemeClass, getViewingInfo } = require("../../utils/store");
const { showMetricHelp } = require("../../utils/metric-help");

const HISTORY_PAGE_SIZE = 12;

Page({
  data: {
    type: "wealth",
    category: null,
    bundle: null,
    summary: null,
    allHistoryGroups: [],
    historyGroups: [],
    historyPage: 1,
    hasMoreHistory: false,
    trendPoints: [],
    isCreditCard: false,
    isHousingFund: false,
    compareDate: "",
    compareOptions: [],
    compareIndex: 0,
    privacyMode: false,
    viewing: null,
    themeClass: "",
    activeSwipeKey: "",
    deletingKey: "",
    loading: true,
    hasLoaded: false
  },

  onLoad(query) {
    const type = query.type || "wealth";
    const category = CATEGORY_MAP[type] || CATEGORY_MAP.wealth;
    this.setData({ type });
    wx.setNavigationBarTitle({
      title: `${category.name}详情`
    });
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
      const privacyMode = !!((getProfile() || {}).privacyEnabled);
      const bundle = privacyMode ? maskBundle(rawBundle) : rawBundle;
      const category = CATEGORY_MAP[this.data.type] || CATEGORY_MAP.wealth;
      const summary = bundle.categories.find((item) => item.key === category.key);
      const compareOptions = bundle.compareRecords.map((record) => record.recordDate);
      const rawHistoryGroups = this.buildHistoryGroups(rawBundle, category.key);
      const allHistoryGroups = privacyMode ? maskHistoryGroups(rawHistoryGroups) : rawHistoryGroups;
      const historyGroups = allHistoryGroups.slice(0, HISTORY_PAGE_SIZE);
      this.setData({
        bundle,
        category,
        compareDate: rawBundle.previous.recordDate,
        compareOptions,
        compareIndex: Math.max(0, compareOptions.indexOf(bundle.previous.recordDate)),
        summary: {
          ...summary,
          amountDisplay: privacyMode ? "****" : formatMoney(summary.amount),
          count: `${summary.count} ${category.key === "wealth" ? "笔" : category.key === "bank" || category.key === "creditCard" ? "张" : "个"}`
        },
        allHistoryGroups,
        historyGroups,
        historyPage: 1,
        hasMoreHistory: allHistoryGroups.length > HISTORY_PAGE_SIZE,
        trendPoints: this.buildTrendPoints(rawHistoryGroups),
        isCreditCard: category.key === "creditCard",
        isHousingFund: category.key === "housingFund",
        privacyMode,
        viewing: getViewingInfo(),
        themeClass: getThemeClass(),
        activeSwipeKey: "",
        deletingKey: "",
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

  onCompareChange(event) {
    const recordDate = event.detail.recordDate || this.data.compareOptions[Number(event.detail.value)];
    this.setData({ compareDate: recordDate });
    this.load({ compareDate });
  },

  onPullDownRefresh() {
    this.load({ silent: true, force: true }).then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.loadMoreHistory();
  },

  showMetricHelp,

  buildHistoryGroups(bundle, categoryKey) {
    const openedMap = this.data.historyGroups.reduce((map, group) => {
      map[group.recordDate] = group.expanded;
      return map;
    }, {});

    return getCategoryHistory(bundle.records, categoryKey)
      .filter((group) => group.rows.length > 0)
      .map((group, index) => ({
        ...group,
        expanded: openedMap[group.recordDate] !== undefined ? openedMap[group.recordDate] : index === 0,
        rows: group.rows.map((row) => ({
          ...row,
          swipeKey: `${group.recordDate}-${row.index}`,
          swiped: false
        }))
      }));
  },

  buildTrendPoints(historyGroups) {
    return historyGroups
      .slice()
      .sort((a, b) => a.recordDate > b.recordDate ? 1 : -1)
      .map((group) => ({
        label: group.recordDate.slice(5),
        value: group.total
      }));
  },

  toggleHistoryGroup(event) {
    const recordDate = event.currentTarget.dataset.recordDate;
    const toggleGroup = (group) => ({
      ...group,
      expanded: group.recordDate === recordDate ? !group.expanded : group.expanded
    });
    this.setData({
      allHistoryGroups: this.data.allHistoryGroups.map(toggleGroup),
      historyGroups: this.data.historyGroups.map(toggleGroup)
    });
  },

  loadMoreHistory() {
    if (!this.data.hasMoreHistory) return;
    const nextPage = this.data.historyPage + 1;
    const nextEnd = nextPage * HISTORY_PAGE_SIZE;
    this.setData({
      historyGroups: this.data.allHistoryGroups.slice(0, nextEnd),
      historyPage: nextPage,
      hasMoreHistory: this.data.allHistoryGroups.length > nextEnd
    });
  },

  onItemTouchStart(event) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  },

  onItemTouchEnd(event) {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    if (Math.abs(deltaX) < Math.abs(deltaY)) return;

    const swipeKey = event.currentTarget.dataset.key;
    if (deltaX < -42) {
      this.setActiveSwipe(swipeKey);
    } else if (deltaX > 32 || Math.abs(deltaX) > 8) {
      this.setActiveSwipe("");
    }
  },

  setActiveSwipe(swipeKey) {
    const updateGroup = (group) => ({
      ...group,
      rows: group.rows.map((row) => ({
        ...row,
        swiped: !!swipeKey && row.swipeKey === swipeKey
      }))
    });

    this.setData({
      activeSwipeKey: swipeKey || "",
      allHistoryGroups: this.data.allHistoryGroups.map(updateGroup),
      historyGroups: this.data.historyGroups.map(updateGroup)
    });
  },

  confirmDeleteItem(event) {
    if (this.data.deletingKey) return;
    const { index, itemId, recordDate, title, key } = event.currentTarget.dataset;
    wx.showModal({
      title: "删除资产记录",
      content: `确认删除 ${recordDate} 的「${title || this.data.category.name}」记录？`,
      confirmText: "删除",
      confirmColor: "#e84b52",
      success: (res) => {
        if (!res.confirm) return;
        this.deleteHistoryItem({
          index,
          itemId,
          recordDate,
          swipeKey: key
        });
      }
    });
  },

  deleteHistoryItem(payload) {
    this.setData({ deletingKey: payload.swipeKey });
    deleteRecordItem({
      categoryKey: this.data.category.key,
      recordDate: payload.recordDate,
      index: payload.index,
      itemId: payload.itemId
    }).then(() => {
      wx.showToast({
        title: "已删除",
        icon: "success"
      });
      this.setData({
        activeSwipeKey: "",
        deletingKey: ""
      });
      return this.load({ silent: true, force: true });
    }, () => {
      this.setData({ deletingKey: "" });
      wx.showToast({
        title: "删除失败",
        icon: "none"
      });
    }).catch(() => {
      this.setData({ deletingKey: "" });
    });
  },

  goBack() {
    wx.navigateBack();
  },

  addItem() {
    wx.navigateTo({
      url: `/pages/record/index?type=${this.data.type}`
    });
  },

  editItem(event) {
    if (this.data.activeSwipeKey) {
      this.setActiveSwipe("");
      return;
    }
    const { index, recordDate } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/record/index?type=${this.data.type}&index=${index}&recordDate=${recordDate}`
    });
  }
});
