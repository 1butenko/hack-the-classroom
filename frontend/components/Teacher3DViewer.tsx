"use client"

import React, { Suspense, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment, ContactShadows, Grid, PivotControls } from "@react-three/drei"
import * as THREE from "three"

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
      <primitive object={clonedScene} scale={2} />
    </PivotControls>
  )
}

export default function Teacher3DViewer({ modelUrl, onUpdate }: { modelUrl: string | null, onUpdate?: (matrix: THREE.Matrix4) => void }) {
  return (
    <div className="w-full h-full min-h-[400px] relative bg-[#f8fafc]">
      <Canvas shadows camera={{ position: [5, 5, 5], fov: 40 }}>
        <color attach="background" args={['#f8fafc']} />
        <ambientLight intensity={1} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={1} />
        
        <Suspense fallback={null}>
          <group>
            <Grid 
              infiniteGrid 
              fadeDistance={50} 
              fadeStrength={5} 
              sectionSize={1} 
              sectionColor="#1A69F3" 
              cellSize={0.5}
              cellColor="#D1D5DB"
            />
            
            {modelUrl && (
              <Model url={modelUrl} onUpdate={onUpdate} />
            )}
            
            <ContactShadows position={[0, 0, 0]} opacity={0.25} scale={10} blur={1.5} far={0.8} />
          </group>
          
          <Environment preset="city" />
          <OrbitControls makeDefault enableDamping={true} />
        </Suspense>
      </Canvas>
    </div>
  )
}
