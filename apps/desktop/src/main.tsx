import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App"
import { RouterProvider } from "./router"
import { SessionProvider } from "./store/session"
import { UiProvider } from "./store/ui"
import "./styles/global.css"

const container = document.getElementById("root")
if (!container) throw new Error("Root container is missing")

createRoot(container).render(
  <StrictMode>
    <UiProvider>
      <SessionProvider>
        <RouterProvider>
          <App />
        </RouterProvider>
      </SessionProvider>
    </UiProvider>
  </StrictMode>,
)
