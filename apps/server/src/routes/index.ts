import { Router } from "express"

import { authRouter } from "./auth.routes"
import { bookmarksRouter, notificationsRouter, searchRouter, trendsRouter } from "./discovery.routes"
import { feedRouter } from "./feed.routes"
import { mediaRouter } from "./media.routes"
import { messageRouter } from "./message.routes"
import { postRouter } from "./post.routes"
import { userRouter } from "./user.routes"

export const apiRouter = Router()

apiRouter.use("/auth", authRouter)
apiRouter.use("/users", userRouter)
apiRouter.use("/posts", postRouter)
apiRouter.use("/feed", feedRouter)
apiRouter.use("/search", searchRouter)
apiRouter.use("/trends", trendsRouter)
apiRouter.use("/notifications", notificationsRouter)
apiRouter.use("/bookmarks", bookmarksRouter)
apiRouter.use("/messages", messageRouter)
apiRouter.use("/media", mediaRouter)
