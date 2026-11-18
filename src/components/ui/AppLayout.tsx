import { Outlet, useLocation } from "react-router"
import BottomNav from "./BottomNav"

export default function AppLayout() {
  const hideNav = useLocation().pathname.startsWith("/program/schedule")
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <main className={hideNav ? "flex-1 px-4 pt-6 pb-8" : "flex-1 px-4 pt-6 pb-24"}>
        <Outlet />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  )
}