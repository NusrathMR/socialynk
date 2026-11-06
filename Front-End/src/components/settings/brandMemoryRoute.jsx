import { lazy, Suspense } from "react"

const BrandMemoryPage = lazy(() => import("./brandMemory.jsx"))

function BrandMemoryRoute() {
  return (
    <Suspense fallback={<div role="status" style={{ padding: 24 }}>Loading Brand Memory...</div>}>
      <BrandMemoryPage />
    </Suspense>
  )
}

export default BrandMemoryRoute
