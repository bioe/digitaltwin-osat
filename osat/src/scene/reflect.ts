import type * as THREE from 'three'

/** Objects hidden while the façade mirrors render (the building must not reflect itself). */
export const reflectHide = new Set<THREE.Object3D>()
