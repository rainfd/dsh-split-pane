---
description: "Web 分屏工作区：把多个活跃会话并排放在同一个主面板里，每一格都是带独立输入框的真实对话。"
kind: "package-reference"
---

# dsh-split-pane

[English](README.md) | 中文

## 概述

Web 客户端的中列可以是一个对话，也可以是由多个对话组成的分屏工作区。每一格都是一个独立寻址到某个会话的对话：它自己流式输出、自己接收输入、自己排队消息，也自己应答归属它的 `ask_user_question` 与审批弹窗。分屏可向右或向下拆分且没有固定格数上限，分隔条可拖拽，布局按会话持久化。

## 安装

```sh
# 从本目录安装
dsh plugin --profile web add .

# 或用路径 / git 规格
dsh plugin --profile web add file:/Users/mac/projects/dsh-split-pane
```

随后重启 `dsh web`。侧边栏的面板列表中，「分屏」条目会出现在「对话」旁边；选中它即可把中列换成分屏工作区。

需要 DeepSeek Harness `0.2.0-rc.2`。本插件在 `peerDependencies` 中声明该范围，且对 DSH 的引用全部是类型导入，因此浏览器包会通过 shell 自身的模块表解析所有共享模块。

## 目录

- [使用此包](#use-this-package)
- [实现说明](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

侧边栏的面板列表中，「分屏」条目与「对话」并列。选中它会把中列换成分屏工作区；再次选中「对话」条目（或任何其他主面板）即可切回。工作区以当前会话为起点打开，因此进入工作区不会改变用户正在阅读的会话。

每一格都绘制自己的标题行：会话选择器、向右分屏、向下分屏与关闭。拆分会在旁边安置一个新的空面板并聚焦它；空面板提供同样的会话选择器。关闭某格会把它与兄弟格合并回二者原本占用的空间，最后一格无法关闭——空工作区没有内容可展示。分隔条可拖拽调整占比，并设有下限，保证任一侧都不会窄到不可用。

各格之间不共享状态。每一格持有自己的会话绑定，因此在一格里输入的消息绝不会落到另一格；同一个会话出现在两格时，是同一会话的两个独立视图，而不是被镜像的同一个视图。`ask_user_question` 与审批弹窗都在发起提问的那一格中作答。

布局按「锚定会话」持久化：离开工作区再回来会恢复它，页面重新加载同样如此。若已存储的某一格对应的会话已不存在，该格会变成空面板而不是消失，因此删除一个会话只损失一格的内容，而不会破坏周围的布局。

<a id="understand-the-implementation"></a>
## 实现说明

### 为什么每一格是一个子槽位

`conversation.content` 是一个组件工厂（Component Factory），它的实例继承渲染位置所在的会话；它不接受独立寻址的会话（见 `ui-conversation/README.md` 的 Known Limitations）。因此，要把一个实例寻址到任意会话，就必须有一个 session 作用域的渲染位置——这正是本包以 `scope: 'session'` 声明 `split.pane`、并在 `SessionProvider` 内为每一格渲染一个实例的原因。

本包占用的 `main` 槽位是 root 作用域的 keyed 槽位，因此工作区自身拿不到会话绑定。它通过 `session` 作用域适配器（`ctx.uiSession.adapter.current`）读取当前选择，再为每一格重新寻址。`PaneHost` 承担这份逐格工作：它为所在格的会话保留一份 `sessions.retain()` 引用，并在卸载时释放，因此关闭一格不会影响其他格的 generation。

### 布局模型

`contract/layout.ts` 是纯数据加纯函数，作用于一棵二叉分割树，不含 React 也不含 DOM。每一格用「路径」寻址——从根开始的子节点选择序列——而不是下标，因此移除一格绝不会重排它的兄弟格。占比在构建分割时与分隔条上报拖拽时都会被夹到允许区间内。`reviveTree` 在存储边界校验已存储的树：形状不对的节点被丢弃，会话已消失的格子被置空。

`SplitWorkspace.tsx` 中的 `PANEL_LIMIT` 为 `undefined`，即格数不设上限。停靠工具包（docking kit）的四格上限属于它的 planner 层，从不会到达 `applyOp`，因此自建的分屏工作区不会继承该限制。

### 文案与本地化

所有可见字符串都存放在 `splitPane` 字典中，并通过标准 `t` 座位抵达组件。标题行控件用同一字典的字符串作为 `aria-label`，因此没有可见文字的格子仍然具备可访问名称。

<a id="further-exploration"></a>
## 延伸阅读

- [`conversation.content`](../ui-conversation/README.zh.md) —— 每一格渲染的可复用装配，以及格子内容所依赖的寻址规则。
- [`ui-subagent`](../ui-subagent/README.zh.md) —— 侧边栏的会话标签页，官方给出的「通过 `SessionProvider` 渲染非当前会话」范例。
- [`ui-sidebar-right`](../ui-sidebar-right/README.zh.md) —— `RightbarRoot`，它让多个会话子树同时存活，并隐藏选择之外的子树。
- [`ui-dockkit`](../ui-dockkit/README.zh.md) —— 停靠引擎，以及本包刻意不使用的格数上限。

<a id="model-experience"></a>
## 模型体验

无，因为本包是浏览器侧的分屏工作区，不注册任何对模型可见的内容。

#### KV Cache effect

无；本包既不组装也不发送 provider 请求。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延期工作

- **格子渲染的是对话正文，不含会话头部。** 格子展示 transcript 与输入框；常驻头部的导航与视图标签页仍归主面板所有，因为该头部属于 `main.conversation`，不是可复用的工厂。
- **保留量随格数增长。** 每一格都持有自己的会话引用与历史流；目前不淘汰屏外格子，因此很宽的布局会按格数消耗实时流。
- **不支持拖拽排布。** 格子由分屏控件创建、由关闭移除；尚不支持把已有格子移动到其他位置。
- **工作区本身不是会话。** 它不携带自己的会话，因此不会出现在会话列表中，其布局以「打开它时的当前会话」作为键。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>面向维护者的工作上下文——点击展开</summary>

`apps/web/tests/` 未覆盖本包：它的运行时行为需要完整的 Web profile（模型选择、输入触发器与输入链），而 jsdom 测试台并不组装这些。格子内容的阶段推导与布局模型各自都有直接覆盖。

</details>
