# Codex Usage

一个参考 Nowdex 设计的 Scripting 小组件，用于显示 Codex 的 5 小时与每周用量窗口。

## 功能

- 主屏幕小/中/大尺寸，以及锁屏圆形/矩形尺寸。
- 显示已用、剩余百分比与重置时间。
- 使用 Codex 官方设备码流程在 OpenAI 网页登录，脚本不接触账号密码。
- Access Token、Refresh Token 和可选 Account ID 只存储在当前脚本隔离的系统 Keychain。
- Access Token 失效时会使用 Refresh Token 自动续期。
- 用量快照缓存 10 分钟；网络失败时显示最后一次成功结果。
- WidgetKit 每 15 分钟请求刷新一次，但实际刷新频率由 iOS 决定。

## 配置

1. 把整个 `Codex Usage` 目录导入或同步到 Scripting。
2. 在 Scripting 中运行一次 `Codex Usage`。
3. 阅读网络与剪贴板说明，获取一次性验证码。
4. 脚本会复制验证码并打开 `auth.openai.com/codex/device`；粘贴验证码后完成 ChatGPT 登录。
5. 返回 Scripting，确认登录完成。多工作区账户如返回错误账户，再手动设置 `Account ID`。
6. 添加 Scripting 小组件，选择 `Codex Usage`。

## 网络与兼容性

登录时会访问：

- `https://auth.openai.com/api/accounts/deviceauth/*`
- `https://auth.openai.com/oauth/token`
- `https://auth.openai.com/codex/device`

查看用量时会向以下地址发送只读 GET 请求：

`https://chatgpt.com/backend-api/wham/usage`

请求包含 `Authorization: Bearer <token>`，以及存在时的 `ChatGPT-Account-ID`。验证码会复制到系统剪贴板，方便粘贴到登录页；它是一次性的，15 分钟后失效。

用量地址是 Codex 客户端使用的非公开 ChatGPT 后端接口，不是稳定的公开 OpenAI API；接口或响应结构变化时可能需要更新 `usage.ts`。
