import { Notification, Script } from "scripting"
import { runChat } from "./launch"

if (Notification.current) Script.exit()
else runChat()
