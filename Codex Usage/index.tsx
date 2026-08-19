import { Script, Widget } from "scripting"
import {
  completeDeviceCodeLogin,
  requestDeviceCode,
} from "./auth"
import {
  fetchUsage,
  getCredentials,
  removeCredentials,
  saveCredentials,
} from "./usage"

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "发生未知错误。"
}

async function configureLogin(): Promise<boolean> {
  const accepted = await Dialog.confirm({
    title: "使用 ChatGPT 登录",
    message:
      "接下来会向 auth.openai.com 请求一次性验证码，并打开 OpenAI 网页。脚本不会读取账号或密码；登录凭据只保存在当前设备的系统 Keychain。验证码会临时复制到剪贴板。",
    cancelLabel: "取消",
    confirmLabel: "获取验证码",
  })
  if (!accepted) return false

  try {
    const deviceCode = await requestDeviceCode()
    const shouldOpen = await Dialog.confirm({
      title: `验证码：${deviceCode.userCode}`,
      message:
        "点“复制并登录”后会打开 OpenAI 官方登录页。请粘贴这个一次性验证码并完成 ChatGPT 登录；验证码 15 分钟内有效。",
      cancelLabel: "取消",
      confirmLabel: "复制并登录",
    })
    if (!shouldOpen) return false

    const granted = await Script.requestAccess(["clipboard"])
    if (granted.includes("clipboard")) {
      await Pasteboard.setString(deviceCode.userCode)
    } else {
      await Dialog.alert({
        title: `请记下：${deviceCode.userCode}`,
        message: "未获得剪贴板权限，请在登录页手动输入这个一次性验证码。",
        buttonLabel: "打开登录页",
      })
    }
    await Safari.present(deviceCode.verificationUrl)

    const completed = await Dialog.confirm({
      title: "完成登录了吗？",
      message: "确认后会向 OpenAI 查询授权结果并保存登录凭据。",
      cancelLabel: "取消",
      confirmLabel: "我已完成",
    })
    if (!completed) return false

    const credentials = await completeDeviceCodeLogin(deviceCode)
    if (!saveCredentials(credentials)) {
      throw new Error("系统 Keychain 保存失败。")
    }

    let usageMessage = "登录凭据已安全保存，用量数据也已刷新。"
    try {
      await fetchUsage(credentials)
    } catch (error) {
      usageMessage =
        `登录凭据已安全保存，但首次读取用量失败：${errorMessage(error)}`
    }
    Widget.reloadAll()
    await Dialog.alert({
      title: "登录成功",
      message: usageMessage,
      buttonLabel: "好",
    })
    return true
  } catch (error) {
    await Dialog.alert({
      title: "无法登录",
      message: errorMessage(error),
      buttonLabel: "好",
    })
    return false
  }
}

async function updateAccountId(): Promise<void> {
  const credentials = getCredentials()
  if (credentials == null) return

  const accountId = await Dialog.prompt({
    title: "Account ID（可选）",
    message: "留空会使用网页登录对应的默认账户。",
    defaultValue: credentials.accountId ?? "",
    placeholder: "留空即可",
    selectAll: true,
    cancelLabel: "取消",
    confirmLabel: "测试并保存",
  })
  if (accountId == null) return

  try {
    const next = {
      ...credentials,
      accountId: accountId.trim() === "" ? null : accountId.trim(),
    }
    await fetchUsage(next)
    if (!saveCredentials(next)) {
      throw new Error("系统 Keychain 保存失败。")
    }
    Widget.reloadAll()
    await Dialog.alert({
      title: "已保存",
      message: "Account ID 和用量缓存已更新。",
    })
  } catch (error) {
    await Dialog.alert({
      title: "更新失败",
      message: errorMessage(error),
    })
  }
}

async function refreshAndPreview(): Promise<void> {
  const credentials = getCredentials()
  if (credentials == null) return

  try {
    await fetchUsage(credentials)
    Widget.reloadAll()
    await Widget.preview({ family: "systemMedium" })
  } catch (error) {
    await Dialog.alert({
      title: "刷新失败",
      message: errorMessage(error),
    })
  }
}

async function showMenu(): Promise<void> {
  const selected = await Dialog.actionSheet({
    title: "Codex Usage",
    message: "管理账户或预览小组件",
    cancelButton: true,
    actions: [
      { label: "刷新并预览" },
      { label: "重新网页登录" },
      { label: "设置 Account ID" },
      { label: "断开账户", destructive: true },
    ],
  })

  if (selected === 0) {
    await refreshAndPreview()
  } else if (selected === 1) {
    await configureLogin()
  } else if (selected === 2) {
    await updateAccountId()
  } else if (selected === 3) {
    const confirmed = await Dialog.confirm({
      title: "断开账户？",
      message: "这会删除当前脚本 Keychain 中的登录凭据、Account ID 和用量缓存。",
      cancelLabel: "取消",
      confirmLabel: "移除",
    })
    if (confirmed) {
      removeCredentials()
      Widget.reloadAll()
      await Dialog.alert({
        title: "已断开",
        message: "本地登录凭据和缓存已删除。",
      })
    }
  }
}

async function run(): Promise<void> {
  if (getCredentials() == null) {
    const configured = await configureLogin()
    if (configured) {
      await Widget.preview({ family: "systemMedium" })
    }
  } else {
    await showMenu()
  }
  Script.exit()
}

run()
