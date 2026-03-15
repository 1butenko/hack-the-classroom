"use client"

import React, { Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, PivotControls, Environment } from "@react-three/drei"

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const clonedScene = React.useMemo(() => scene.clone(true), [scene])
  return <primitive object={clonedScene} scale={1.5} />
}

export default function Cell3DViewer({ models = [] }: { models?: string[] }) {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: "500px" }} className="bg-slate-50">
      <Canvas shadows camera={{ position: [10, 10, 10], fov: 40 }}>
        <color attach="background" args={['#ffffff']} />
        <ambientLight intensity={1} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <Environment preset="city" />
        
        <Suspense fallback={null}>
          <group>
            {}
            <gridHelper args={[20, 20, 0x1A69F3, 0xD1D5DB]} />
            
            {models.map((url, index) => (
              <PivotControls 
                key={`${url}-${index}`}
                activeAxes={[true, true, true]} 
                depthTest={false} 
                scale={0.75}
                fixed={false}
                offset={[index * 2, 0, 0]}
              >
                <Model url={url} />
              </PivotControls>
            ))}
          </group>
          <OrbitControls makeDefault enableDamping={true} />
        </Suspense>
      </Canvas>
    </div>
  )
}