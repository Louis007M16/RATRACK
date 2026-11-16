import { Outlet } from "react-router"
import BottomNav from "./BottomNav"

export default function AppLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <main className="flex-1 px-4 pt-6 pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}