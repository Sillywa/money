const { CATEGORY_MAP } = require("../../utils/categories");
const { buildBundle, createTodaySnapshot, formatMoney } = require("../../utils/asset");
const { fetchSnapshots, getEditorInfo, getViewingInfo, saveSnapshot } = require("../../utils/store");

const FIELD_CONFIG = {
  bank: [
    { key: "bankName", label: "银行名称", placeholder: "例如 工商银行", required: true },
    { key: "cardType", label: "卡类型", placeholder: "例如 储蓄卡", required: true },
    { key: "tailNo", label: "卡号尾号", placeholder: "例如 4321" },
    { key: "amount", label: "当前余额", placeholder: "0.00", required: true, inputType: "digit" },
    { key: "remark", label: "备注", placeholder: "请输入备注信息（选填）", type: "textarea" }
  ],
  wealth: [
    { key: "name", label: "理财名字", placeholder: "例如 中银理财-稳富", required: true },
    { key: "amount", label: "金额", placeholder: "0.00", required: true, inputType: "digit" },
    { key: "remark", label: "备注", placeholder: "请输入备注信息（选填）", type: "textarea" }
  ],
  wechat: [
    { key: "name", label: "账户名称", placeholder: "例如 微信零钱", required: true },
    { key: "amount", label: "金额", placeholder: "0.00", required: true, inputType: "digit" },
    { key: "remark", label: "备注", placeholder: "请输入备注信息（选填）", type: "textarea" }
  ],
  alipay: [
    { key: "name", label: "账户名称", placeholder: "例如 支付宝余额", required: true },
    { key: "amount", label: "金额", placeholder: "0.00", required: true, inputType: "digit" },
    { key: "remark", label: "备注", placeholder: "请输入备注信息（选填）", type: "textarea" }
  ],
  housingFund: [
    { key: "name", label: "账户名称", placeholder: "例如 上海市住房公积金", required: true },
    { key: "city", label: "缴存城市", placeholder: "例如 上海" },
    { key: "accountType", label: "账户类型", placeholder: "例如 住房公积金" },
    { key: "amount", label: "当前余额", placeholder: "0.00", required: true, inputType: "digit" },
    { key: "remark", label: "备注", placeholder: "请输入备注信息（选填）", type: "textarea" }
  ],
  creditCard: [
    { key: "bankName", label: "信用卡名称", placeholder: "例如 招商银行信用卡", required: true },
    { key: "tailNo", label: "卡号尾号", placeholder: "例如 1234" },
    { key: "billDay", label: "账单日", placeholder: "例如 12日" },
    { key: "repaymentDay", label: "还款日", placeholder: "例如 28日" },
    { key: "amount", label: "欠款金额", placeholder: "0.00", required: true, inputType: "digit" },
    { key: "remark", label: "备注", placeholder: "请输入备注信息（选填）", type: "textarea" }
  ]
};

Page({
  data: {
    type: "wealth",
    index: "",
    targetRecordDate: "",
    isEdit: false,
    category: null,
    fields: [],
    form: {},
    recordDate: "",
    recordHint: "默认今日记录，全部按人民币计算",
    amountPreview: "0.00",
    bundle: null,
    viewing: null,
    saving: false,
    loading: true,
    hasLoaded: false
  },

  onLoad(query) {
    const type = query.type || "wealth";
    const index = query.index !== undefined ? query.index : "";
    const targetRecordDate = query.recordDate || "";
    this.setData({
      type,
      index,
      targetRecordDate,
      isEdit: index !== ""
    });
    const category = CATEGORY_MAP[type] || CATEGORY_MAP.wealth;
    wx.setNavigationBarTitle({
      title: `${index !== "" ? "编辑" : "新增"}${category.name}`
    });
    this.init();
  },

  init(options) {
    const opts = options || {};
    if (!this.data.hasLoaded && !opts.silent) {
      this.setData({ loading: true });
    }

    return fetchSnapshots().then((records) => {
      const bundle = buildBundle(records);
      const category = CATEGORY_MAP[this.data.type] || CATEGORY_MAP.wealth;
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const recordDate = this.data.targetRecordDate || (this.data.isEdit ? bundle.current.recordDate : today);
      const targetRecord = bundle.records.find((record) => record.recordDate === recordDate) || bundle.current;
      const currentList = (targetRecord.assets && targetRecord.assets[category.key]) || [];
      const existing = this.data.isEdit ? currentList[Number(this.data.index)] : {};
      const form = this.buildDefaultForm(category.key, existing || {});

      this.setData({
        bundle,
        category,
        fields: this.hydrateFields(category.key, form),
        form,
        recordDate,
        recordHint: this.data.isEdit ? `编辑 ${recordDate} 的资产记录` : "默认今日记录，全部按人民币计算",
        amountPreview: formatMoney(form.amount || 0),
        viewing: getViewingInfo(),
        loading: false,
        hasLoaded: true
      });
    }).catch(() => {
      this.setData({ loading: false, hasLoaded: true });
    });
  },

  buildDefaultForm(type, existing) {
    const defaults = {
      bank: { bankName: "", cardType: "储蓄卡", tailNo: "", amount: "", remark: "" },
      wealth: { name: "", amount: "", remark: "" },
      wechat: { name: "", amount: "", remark: "" },
      alipay: { name: "", amount: "", remark: "" },
      housingFund: { name: "", city: "", accountType: "住房公积金", amount: "", remark: "" },
      creditCard: { bankName: "", tailNo: "", billDay: "", repaymentDay: "", amount: "", remark: "" }
    };
    return {
      ...defaults[type],
      ...existing,
      amount: existing.amount !== undefined ? String(existing.amount) : defaults[type].amount
    };
  },

  hydrateFields(type, form) {
    return FIELD_CONFIG[type].map((field) => ({
      ...field,
      inputType: field.inputType || "text",
      isTextarea: field.type === "textarea",
      rowClass: field.type === "textarea" ? "textarea-row" : "",
      value: form[field.key] || ""
    }));
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    const index = Number(event.currentTarget.dataset.index);
    const value = event.detail.value;
    this.setData({
      [`form.${field}`]: value,
      [`fields[${index}].value`]: value
    });
    if (field === "amount") {
      this.setData({
        amountPreview: formatMoney(value || 0)
      });
    }
  },

  save() {
    if (this.data.saving) return;

    const category = this.data.category;
    const form = {
      ...this.data.form,
      amount: Number(this.data.form.amount || 0)
    };

    if (!this.validate(form)) return;

    const records = createTodaySnapshot(
      this.data.bundle,
      category.key,
      form,
      this.data.index,
      this.data.recordDate,
      getEditorInfo()
    );
    const snapshot = records.find((record) => record.recordDate === this.data.recordDate) || records[records.length - 1];

    this.setData({ saving: true });
    saveSnapshot(snapshot).then(() => {
      wx.showToast({
        title: "已保存",
        icon: "success"
      });
      setTimeout(() => wx.navigateBack(), 450);
    }).catch(() => {
      wx.showToast({
        title: "保存失败，请重试",
        icon: "none"
      });
      this.setData({ saving: false });
    });
  },

  validate(form) {
    const required = this.data.fields.filter((field) => field.required);
    const missing = required.find((field) => !form[field.key] && form[field.key] !== 0);
    if (missing) {
      wx.showToast({
        title: `请填写${missing.label}`,
        icon: "none"
      });
      return false;
    }
    return true;
  },

  goBack() {
    wx.navigateBack();
  },

  onPullDownRefresh() {
    this.init({ silent: true }).then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  }
});
