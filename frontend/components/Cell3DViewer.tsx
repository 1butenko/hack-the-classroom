"use client"

import React, { Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, Stage } from "@react-three/drei"

function Model() {
  const { scene } = useGLTF("/cell/scene.gltf")
  return <primitive object={scene} scale={1.5} />
}

export default function Cell3DViewer() {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas shadows camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={1} />
        <directionalLight position={[10, 10, 10]} intensity={2} />
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5}>
            <Model />
          </Stage>
          <OrbitControls enableZoom={true} autoRotate={true} />
        </Suspense>
      </Canvas>
    </div>
  )
}
