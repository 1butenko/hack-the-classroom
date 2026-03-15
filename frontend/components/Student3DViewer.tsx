"use client"

import React, { Suspense, useMemo, Component, ReactNode } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, PivotControls, Environment, ContactShadows, Grid, Center } from "@react-three/drei"
import * as THREE from "three"

class ModelErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

interface ModelState {
  id: string
  url: string
  prompt: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

function Model({ state, index, onUpdate }: { state: ModelState, index: number, onUpdate: (index: number, matrix: THREE.Matrix4) => void }) {
  const { scene } = useGLTF(state.url)
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  
  const matrix = useMemo(() => {
    const m = new THREE.Matrix4()
    m.compose(
      new THREE.Vector3(...state.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...state.rotation)),
      new THREE.Vector3(...state.scale)
    )
    return m
  }, [state.id]) // Тільки при створенні об'єкта

  return (
    <PivotControls 
      key={state.id}
      activeAxes={[true, true, true]} 
      depthTest={false} 
      scale={0.75}
      fixed={false}
      matrix={matrix}
      onDragEnd={(m) => onUpdate(index, m)}
    >
      <Center top>
        <primitive object={clonedScene} scale={1.5} castShadow receiveShadow />
      </Center>
    </PivotControls>
  )
}

export default function Student3DViewer({ modelStates = [], onModelsChange }: { modelStates: ModelState[], onModelsChange: (states: ModelState[]) => void }) {
  
  const handleUpdate = (index: number, matrix: THREE.Matrix4) => {
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    matrix.decompose(position, rotation, scale)
    const euler = new THREE.Euler().setFromQuaternion(rotation)
    
    const nextStates = [...modelStates]
    nextStates[index] = {
      ...nextStates[index],
      position: [position.x, position.y, position.z],
      rotation: [euler.x, euler.y, euler.z],
      scale: [scale.x, scale.y, scale.z]
    }
    onModelsChange(nextStates)
  }

  return (
    <div className="w-full h-full min-h-[500px] relative bg-[#f0f9ff]">
      <Canvas shadows camera={{ position: [8, 8, 8], fov: 40 }} dpr={[1, 2]}>
        <color attach="background" args={['#f0f9ff']} />
        <ambientLight intensity={1.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={1} />
        
        <Suspense fallback={null}>
          <group>
            <Grid 
              infiniteGrid 
              fadeDistance={30} 
              fadeStrength={5} 
              sectionSize={1} 
              sectionColor="#1A69F3" 
              cellSize={0.5}
              cellColor="#D1D5DB"
              opacity={0.4}
            />
            
            {modelStates.map((state, index) => (
              <ModelErrorBoundary 
                key={state.id} 
                fallback={<mesh position={state.position}><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="red" wireframe/></mesh>}
              >
                <Model 
                  state={state} 
                  index={index} 
                  onUpdate={handleUpdate} 
                />
              </ModelErrorBoundary>
            ))}
            
            <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={1} />
          </group>
          
          <Environment preset="city" />
          <OrbitControls makeDefault enableDamping={true} minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
        </Suspense>
      </Canvas>
    </div>
  )
}
