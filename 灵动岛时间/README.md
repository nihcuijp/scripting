# 灵动岛时间

参考 Netlight 3.5.3 的 ActivityKit 方式实现，在锁屏和灵动岛显示实时走秒的当前时间。

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

- 使用 `TimerIntervalLabel` 从当天零点正向计时，系统负责逐秒刷新，不需要脚本后台常驻。
- 活动在午夜变为过期状态；跨过午夜后运行脚本并选择“重新启动”。
- 只有带灵动岛的设备会显示灵动岛布局，其他兼容设备显示锁屏实时活动或系统横幅。
- 如果系统关闭了 Scripting 的实时活动权限，需要先在 iOS 设置中启用。
- iOS 决定紧凑、最小和展开状态，脚本不能强制灵动岛一直展开。
