// import { useState } from 'react'
// import heroImg from './assets/hero.png'
// import reactLogo from './assets/react.svg'
// import viteLogo from './assets/vite.svg'
// import './App.css'
import { Routes, Route, Navigate } from "react-router"
import AppLayout from "@/components/ui/AppLayout"
import Home from "@/pages/Home"
import Program from "@/pages/Program"
import Workouts from "@/features/workouts/WorkoutsPage"

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="program" element={<Program />} />
        <Route path="workouts" element={<Workouts />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
