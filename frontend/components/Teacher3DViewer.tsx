"use client"

import React, { Suspense, useMemo, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, PivotControls, Environment } from "@react-three/drei"
import * as THREE from "three"

interface Teacher3DViewerProps {
  modelUrl: string | null
  onUpdate?: (matrix: THREE.Matrix4) => void
}

function Model({ url, onUpdate }: { url: string, onUpdate?: (matrix: THREE.Matrix4) => void }) {
  const { scene } = useGLTF(url)
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  
  return (
    <PivotControls 
      activeAxes={[true, true, true]} 
      depthTest={false} 
      scale={0.75}
      fixed={false}
      onDragEnd={(matrix) => onUpdate && onUpdate(matrix)}
    >
      <primitive object={clonedScene} scale={1.5} />
    </PivotControls>
  )
}

export default function Teacher3DViewer({ modelUrl, onUpdate }: Teacher3DViewerProps) {
  return (
    <div className="w-full h-full relative">
      <Canvas shadows camera={{ position: [10, 10, 10], fov: 40 }}>
        <color attach="background" args={['#f0f9ff']} />
        <ambientLight intensity={1} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <Environment preset="city" />
        
        <Suspense fallback={null}>
          <group>
            {}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
              <circleGeometry args={[12, 64]} />
              <meshStandardMaterial color="#ffffff" opacity={0.8} transparent />
            </mesh>
            
            <gridHelper args={[24, 24, 0x1A69F3, 0xD1D5DB]} position={[0, 0, 0]} opacity={0.2} transparent />
            
            {modelUrl && (
              <Model url={modelUrl} onUpdate={onUpdate} />
            )}
          </group>
          <OrbitControls makeDefault enableDamping={true} />
        </Suspense>
      </Canvas>
    </div>
  )
}