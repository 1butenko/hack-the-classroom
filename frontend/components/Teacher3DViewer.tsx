"use client"

import React, { Suspense, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment, ContactShadows, Grid } from "@react-three/drei"
import * as THREE from "three"

// Компонент самої моделі
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  // Клонуємо сцену, щоб уникнути конфліктів при повторному рендері
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  
  return (
    <primitive 
      object={clonedScene} 
      scale={2} 
      position={[0, 0, 0]} 
      rotation={[0, 0, 0]} 
    />
  )
}

export default function Teacher3DViewer({ modelUrl }: { modelUrl: string | null }) {
  return (
    <div className="w-full h-full min-h-[400px] relative bg-[#f8fafc]">
      <Canvas shadows camera={{ position: [5, 5, 5], fov: 40 }}>
        {/* Колір фону сцени */}
        <color attach="background" args={['#f8fafc']} />
        
        {/* Освітлення */}
        <ambientLight intensity={0.8} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} shadow-mapSize={[512, 512]} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={1} />
        
        <Suspense fallback={null}>
          <group>
            {/* Допоміжна сітка */}
            <Grid 
              infiniteGrid 
              fadeDistance={50} 
              fadeStrength={5} 
              sectionSize={1} 
              sectionColor="#1A69F3" 
              sectionThickness={1} 
              cellSize={0.5}
              cellColor="#D1D5DB"
              cellThickness={0.5}
            />
            
            {/* Відображення моделі, якщо є URL */}
            {modelUrl && (
              <Model url={modelUrl} />
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
