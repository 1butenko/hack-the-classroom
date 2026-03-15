"use client"

import React, { Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, Stage } from "@react-three/drei"

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} scale={1.5} />
}

export default function Cell3DViewer({ modelUrl }: { modelUrl?: string | null }) {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas shadows camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={1} />
        <directionalLight position={[10, 10, 10]} intensity={2} />
        <Suspense fallback={null}>
          {modelUrl ? (
            <Stage environment="city" intensity={0.5}>
              <Model url={modelUrl} />
            </Stage>
          ) : (
            <gridHelper args={[10, 10, 0xcccccc, 0xeeeeee]} rotation={[Math.PI / 2, 0, 0]} />
          )}
          <OrbitControls enableZoom={true} autoRotate={!modelUrl ? false : true} />
        </Suspense>
      </Canvas>
    </div>
  )
}
