# Agent 工作约定

本文件面向后续参与本仓库的 coding agent。开始写代码前，必须先阅读并遵守：

1. `README.md`
2. `doc.md`
3. 本文件 `agents.md`

## 写代码前

- 先确认当前需求会影响哪些页面、组件、云函数、集合或统计口径。
- 如果需求涉及资产计算、隐私展示、亲友资产、提醒、目标测算，必须对照 `doc.md` 中对应章节。
- 如果需求会改变集合、索引、云函数字段、页面职责或产品口径，必须同步更新 `README.md` 和 `doc.md`。
- 优先使用 `rg`、`sed` 等快速只读命令了解现有实现。

## 项目硬性约束

- 不使用本地存储作为数据源。
- 开发、本地调试、生产环境都通过云函数和云数据库读写数据。
- 页面标题使用小程序页面配置 `navigationBarTitleText`。
- 底部菜单使用原生 `tabBar`。
- 图表使用当前原生 canvas 组件，不恢复 `echarts-for-weixin`。
- 不随意改变净资产、总资产、总负债、负债率等统计口径。
- 隐私模式下金额和百分比应隐藏为 `****`，负债前置负号也不展示。
- 亲友资产模式下，除“我的”页面外，其它页面需要保留正在查看亲友资产的提示。

## 编辑原则

- 保持改动聚焦，不做与需求无关的重构。
- 复用现有组件和样式体系，尤其是 `record-strip`、`line-chart`、`donut-chart`、`skeleton-screen`。
- 新增云字段时，需要在小程序端 normalize、云函数 strip / ensure / update 三处同步处理。
- 新增页面时，需要同步更新 `miniprogram/app.json`、页面说明和文档。
- 手动编辑文件时使用补丁方式，避免覆盖用户已有改动。

## 验证

提交前至少执行 JS 和 JSON 解析检查：

```bash
find miniprogram cloudfunctions -path '*/node_modules/*' -prune -o -name '*.js' -print | while read file; do node --check "$file" || exit 1; done
find miniprogram cloudfunctions -path '*/node_modules/*' -prune -o -name '*.json' -print | while read file; do node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$file" || exit 1; done
```

如果当前环境的 `node` 不可用，使用 Codex 内置 Node 路径或微信开发者工具进行等价检查。
