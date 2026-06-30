const { CATEGORY_MAP } = require("../../utils/categories");
const { buildBundle, createTodaySnapshot, formatMoney } = require("../../utils/asset");
const { fetchSnapshots, getEditorInfo, getThemeClass, getViewingInfo, moveRecordDate, returnToSelf, saveSnapshot } = require("../../utils/store");

const ACCOUNT_PICKER_PLACEHOLDER = "选择历史账户";
const SKIP_TEMPLATE_KEYS = ["amount"];
const SKIP_IDENTITY_KEYS = ["amount", "remark"];

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
    originalRecordDate: "",
    isEdit: false,
    category: null,
    fields: [],
    form: {},
    accountOptions: [],
    accountPickerOptions: [],
    accountPickerIndex: 0,
    selectedAccountLabel: "",
    showAccountPicker: false,
    recordDate: "",
    recordHint: "默认今日记录，全部按人民币计算",
    amountPreview: "0.00",
    bundle: null,
    viewing: null,
    themeClass: "",
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
      originalRecordDate: targetRecordDate,
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

    return fetchSnapshots({ force: !!opts.force }).then((records) => {
      const bundle = buildBundle(records);
      const category = CATEGORY_MAP[this.data.type] || CATEGORY_MAP.wealth;
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const recordDate = this.data.targetRecordDate || (this.data.isEdit ? bundle.current.recordDate : today);
      const targetRecord = bundle.records.find((record) => record.recordDate === recordDate) || bundle.current;
      const currentList = (targetRecord.assets && targetRecord.assets[category.key]) || [];
      const existing = this.data.isEdit ? currentList[Number(this.data.index)] : {};
      const form = this.buildDefaultForm(category.key, existing || {});
      const accountOptions = this.buildAccountOptions(bundle.records, category.key);
      const accountPickerOptions = accountOptions.map((item) => item.label);
      const recordHint = this.buildRecordHint(this.data.isEdit, recordDate);

      this.setData({
        bundle,
        category,
        fields: this.hydrateFields(category.key, form),
        form,
        accountOptions,
        accountPickerOptions,
        accountPickerIndex: 0,
        selectedAccountLabel: ACCOUNT_PICKER_PLACEHOLDER,
        showAccountPicker: !this.data.isEdit && accountPickerOptions.length > 0,
        recordDate,
        recordHint,
        amountPreview: formatMoney(form.amount || 0),
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

  buildRecordHint(isEdit, recordDate) {
    if (isEdit && this.data.originalRecordDate && this.data.originalRecordDate !== recordDate) {
      return `保存后从 ${this.data.originalRecordDate} 移动到 ${recordDate}`;
    }
    if (isEdit) return `编辑 ${recordDate} 的资产记录，可修改日期`;
    return `新增记录将保存到 ${recordDate}，可修改日期`;
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

  buildAccountOptions(records, type) {
    const seen = {};
    const latestFirst = (records || []).slice().sort((a, b) => a.recordDate < b.recordDate ? 1 : -1);
    return latestFirst.reduce((options, record) => {
      const list = (record.assets && record.assets[type]) || [];
      list.forEach((item) => {
        const template = this.pickTemplateFields(type, item);
        const label = this.accountLabel(type, template);
        if (!label) return;
        const identity = JSON.stringify(this.pickIdentityFields(type, item));
        if (seen[identity]) return;
        seen[identity] = true;
        options.push({
          label,
          template
        });
      });
      return options;
    }, []);
  },

  pickTemplateFields(type, item) {
    return FIELD_CONFIG[type].reduce((template, field) => {
      if (SKIP_TEMPLATE_KEYS.indexOf(field.key) >= 0) return template;
      template[field.key] = item[field.key] !== undefined && item[field.key] !== null ? item[field.key] : "";
      return template;
    }, {});
  },

  pickIdentityFields(type, item) {
    return FIELD_CONFIG[type].reduce((identity, field) => {
      if (SKIP_IDENTITY_KEYS.indexOf(field.key) >= 0) return identity;
      identity[field.key] = item[field.key] !== undefined && item[field.key] !== null ? item[field.key] : "";
      return identity;
    }, {});
  },

  accountLabel(type, template) {
    if (type === "bank") {
      return [template.bankName, template.cardType, template.tailNo ? `尾号${template.tailNo}` : ""].filter(Boolean).join(" ");
    }
    if (type === "creditCard") {
      return [template.bankName, template.tailNo ? `尾号${template.tailNo}` : ""].filter(Boolean).join(" ");
    }
    if (type === "housingFund") {
      return [template.name, template.city, template.accountType].filter(Boolean).join(" ");
    }
    return template.name || "";
  },

  onAccountChange(event) {
    const pickerIndex = Number(event.detail.value);
    const selected = this.data.accountOptions[pickerIndex];
    if (!selected) return;

    const form = {
      ...this.data.form,
      ...selected.template,
      amount: this.data.form.amount || ""
    };
    this.setData({
      accountPickerIndex: pickerIndex,
      selectedAccountLabel: this.data.accountPickerOptions[pickerIndex],
      form,
      fields: this.hydrateFields(this.data.category.key, form)
    });
  },

  onRecordDateChange(event) {
    const recordDate = event.detail.value || this.data.recordDate;
    this.setData({
      recordDate,
      recordHint: this.buildRecordHint(this.data.isEdit, recordDate)
    });
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

    this.setData({ saving: true });
    const shouldMoveRecord = this.data.isEdit && this.data.originalRecordDate && this.data.originalRecordDate !== this.data.recordDate;
    const saveTask = shouldMoveRecord
      ? moveRecordDate({
        categoryKey: category.key,
        fromRecordDate: this.data.originalRecordDate,
        toRecordDate: this.data.recordDate,
        index: this.data.index,
        item: form
      })
      : saveSnapshot(this.buildSavedSnapshot(category.key, form, getEditorInfo()));

    saveTask.then(() => {
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

  buildSavedSnapshot(categoryKey, form, editor) {
    const records = createTodaySnapshot(
      this.data.bundle,
      categoryKey,
      form,
      this.data.index,
      this.data.recordDate,
      editor
    );
    return records.find((record) => record.recordDate === this.data.recordDate) || records[records.length - 1];
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

  returnMine() {
    returnToSelf().then(() => {
      wx.switchTab({
        url: "/pages/dashboard/index"
      });
    });
  },

  onPullDownRefresh() {
    this.init({ silent: true, force: true }).then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  }
});
