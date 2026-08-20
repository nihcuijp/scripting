# 灵动岛时间

参考 Net 的紧凑 ActivityKit 布局，在锁屏和灵动岛只显示系统实时计时。

## 直接安装

[点击一键安装到 Scripting](https://scripting.fun/import_scripts?urls=%5B%22https:%5C/%5C/github.com%5C/nihcuijp%5C/scripting-island-clock%5C/releases%5C/latest%5C/download%5C/island-clock.zip%22%5D)

如果一键安装没有打开 Scripting，也可以在 Scripting 中手动导入下面的 ZIP 链接：

`https://github.com/nihcuijp/scripting-island-clock/releases/latest/download/island-clock.zip`

## 使用方法

1. 将整个 `灵动岛时间` 文件夹导入或同步到 Scripting。
2. 在 Scripting 中运行一次脚本，选择“启动”。
3. 退出 Scripting 查看灵动岛；长按灵动岛查看展开样式。
4. 再次运行脚本，可以重新启动或关闭实时活动。

## 说明

- 使用 `TimerIntervalLabel` 从启动时的 `00:00` 正向计时，系统负责逐秒刷新；不显示图标、星期、日期或说明文字，也不需要脚本后台常驻。
- 紧凑态使用 `caption2` 和压缩字宽，并只占 trailing 区域，用于减少灵动岛扩宽。
- 只有带灵动岛的设备会显示灵动岛布局，其他兼容设备显示锁屏实时活动或系统横幅。
- 如果系统关闭了 Scripting 的实时活动权限，需要先在 iOS 设置中启用。
- iOS 决定紧凑、最小和展开状态，脚本不能强制灵动岛一直展开。
