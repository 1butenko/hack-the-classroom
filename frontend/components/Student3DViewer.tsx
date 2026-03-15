"use client"

import React, { Suspense, useMemo, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, PivotControls, Environment } from "@react-three/drei"
import * as THREE from "three"

interface ModelProps {
  url: string
  index: number
  onUpdate: (index: number, matrix: THREE.Matrix4) => void
}

function Model({ url, index, onUpdate }: ModelProps) {
  const { scene } = useGLTF(url)
  const clonedScene = useMemo(() => {
    const s = scene.clone(true)
    return s
  }, [scene])
  
  return (
    <PivotControls 
      key={`${url}-${index}`}
      activeAxes={[true, true, true]} 
      depthTest={false} 
      scale={0.75}
      fixed={false}
      onDragEnd={(matrix) => onUpdate(index, matrix)}
    >
      <primitive object={clonedScene} scale={1.5} />
    </PivotControls>
  )
}

interface Student3DViewerProps {
  models: string[]
  onModelsChange?: (modelStates: any[]) => void
}

export default function Student3DViewer({ models = [], onModelsChange }: Student3DViewerProps) {
  const modelStates = useRef<any[]>([])

  
  useMemo(() => {
    modelStates.current = models.map((url, i) => ({
      url,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }))
  }, [models])

  const handleUpdate = (index: number, matrix: THREE.Matrix4) => {
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    
    matrix.decompose(position, rotation, scale)
    
    const euler = new THREE.Euler().setFromQuaternion(rotation)
    
    modelStates.current[index] = {
      ...modelStates.current[index],
      position: [position.x, position.y, position.z],
      rotation: [euler.x, euler.y, euler.z],
      scale: [scale.x, scale.y, scale.z]
    }
    
    if (onModelsChange) {
      onModelsChange([...modelStates.current])
    }
  }

  return (
    <div className="w-full h-full min-h-[500px] bg-gradient-to-b from-[#E0F2FE] to-[#F8FAFC] relative">
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
            
            {}
            <gridHelper args={[24, 24, 0x1A69F3, 0xD1D5DB]} position={[0, 0, 0]} opacity={0.2} transparent />
            
            {models.map((url, index) => (
              <Model 
                key={`${url}-${index}`} 
                url={url} 
                index={index} 
                onUpdate={handleUpdate} 
              />
            ))}
          </group>
          <OrbitControls makeDefault enableDamping={true} />
        </Suspense>
      </Canvas>
    </div>
  )
}