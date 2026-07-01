# Money Asset Snapshot Mini Program

一款微信原生小程序，用于手动录入各类资产快照，并基于上一次记录计算净资产、分类资产和变化趋势。

完整项目逻辑、页面流程、数据流和云端设计见 [`doc.md`](doc.md)。后续 agent 写代码前请先阅读 [`agents.md`](agents.md)。

## 产品口径

- 用户手动录入资产信息，不自动同步银行卡、微信、支付宝或理财账户。
- 每次保存都按记录日期形成或更新一次资产快照。
- 首页和分类详情中的变化值，均基于“最新记录”与用户选择的“对比记录”计算；资产明细按用户选择的单个记录日期展示资产和负债。
- “我的”页提供资产月报和资产健康分，首页提供账户补录提醒，均只基于已有手动快照推导，不改变资产统计口径。
- 趋势图中的每个点代表一次手动录入记录，不提供日/周/月切换。
- 金额统一按人民币 CNY 计算。
- 总资产只包含银行卡、理财、微信、支付宝、公积金等非负债资产。
- 总负债为信用卡欠款合计。
- 净资产 = 总资产 - 总负债。
- 负债率 = 总负债绝对值 / (总负债绝对值 + 总资产)。

## 页面

- `pages/dashboard/index`：资产看板首页
- `pages/assets/index`：资产明细，按日期查看资产 / 负债和各类资产金额
- `pages/category-detail/index`：六类资产共用详情页
- `pages/record/index`：新增/编辑资产
- `pages/reminder/index`：记录提醒设置
- `pages/family/index`：亲友资产绑定与浏览，展示家庭合计净资产目标和进度
- `pages/family-invite/index`：亲友资产邀请接受页
- `pages/analytics/index`：资产目标
- `pages/profile/index`：我的/设置；亲友模式下底部“我的”入口显示为“返回我的”，点击后切回登录用户自己的资产数据

## 六类资产字段

- 银行卡：银行名称、卡类型、卡号尾号、当前余额、备注
- 理财：理财名字、金额、备注
- 微信：账户名称、金额、备注
- 支付宝：账户名称、金额、备注
- 公积金：账户名称、缴存城市、账户类型、当前余额、备注
- 信用卡：信用卡名称、卡号尾号、账单日、还款日、欠款金额、备注

## 云开发

云函数位于：

```text
cloudfunctions/snapshots
```

需要在微信云开发中创建集合：

```text
asset_snapshots
asset_user_profiles
asset_family_bindings
asset_family_invites
asset_reminders
```

核心集合设计：

```js
// asset_snapshots
{
  _openid: "资产所属用户 openid",
  ownerOpenid: "资产所属用户 openid",
  recordDate: "2026-06-27",
  assets: {
    bank: [],
    wealth: [],
    wechat: [],
    alipay: [],
    housingFund: [],
    creditCard: []
  },
  lastEditor: {
    openid: "编辑人 openid",
    nickName: "编辑人昵称",
    avatarUrl: "编辑人头像"
  },
  createdAt: Date,
  updatedAt: Date
}
```

建议索引：

- `asset_snapshots`：`ownerOpenid + recordDate`
- `asset_user_profiles`：`openid`
- `asset_family_bindings`：`viewerOpenid + ownerOpenid + status`
- `asset_family_invites`：`code + status`
- `asset_reminders`：`openid`、`enabled + dayOfMonth + hour`

云函数支持：

- `login` / `workspace`：获取登录用户资料、当前浏览对象、亲友列表、当前浏览对象提醒配置和资产快照
- `profileUpdate`：更新当前浏览对象的头像、昵称、隐私开关、暗黑模式、新功能引导状态、账户补录提醒关闭日期、目标净资产和理财测算参数；家庭合计净资产目标展示复用 `goalNetWorth`
- `list` / `get`：读取当前浏览对象或指定授权用户的资产快照
- `replaceAll`：替换当前用户的全部资产快照，主要用于迁移/调试
- `upsert`：按记录日期新增或更新单次快照
- `moveRecordDate`：编辑历史记录时原子移动单条资产到新记录日期
- `deleteRecordItem`：删除某日期下某类资产的一条历史记录
- `delete`：按记录日期删除单次快照
- `familyInviteCreate` / `familyInviteAccept`：复用或生成分享码，并通过输入分享码接受亲友绑定
- `setActiveOwner`：切换当前浏览的资产所属用户
- `familyAggregate`：按已授权亲友的最新快照生成家庭合计净资产总览，前端基于合计净资产和 `goalNetWorth` 展示家庭净资产目标进度
- `reminderSave` / `sendDueReminders`：保存当前浏览对象提醒日期和发送到期订阅通知

开发、本地调试和生产环境都只通过云函数与云数据库读写数据，不使用本地存储作为数据源。新用户没有云端记录时展示空的今日快照。

订阅提醒需要在小程序后台申请订阅消息模板，并把模板 ID 填入：

- 小程序端：`miniprogram/utils/config.js`
- 云函数端：`cloudfunctions/snapshots/index.js` 的 `REMINDER_TEMPLATE_ID`

## 打开方式

1. 用微信开发者工具打开项目根目录。
2. 如需使用自己的小程序 AppID，修改根目录 `project.config.json` 中的 `appid`。
3. 开通云开发后，创建上述 5 个集合和索引。
4. 上传并部署 `cloudfunctions/snapshots` 云函数。
