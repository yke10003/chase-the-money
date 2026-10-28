let devicePromise: Promise<GPUDevice> | null = null
const errorListeners = new Set<(message: string) => void>()

export function webgpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && navigator.gpu != null
}

export function subscribeGpuErrors(listener: (message: string) => void): () => void {
  errorListeners.add(listener)
  return () => {
    errorListeners.delete(listener)
  }
}

export function getGpuDevice(): Promise<GPUDevice> {
  if (!webgpuAvailable()) {
    return Promise.reject(new Error('WebGPU is not available in this browser.'))
  }
  if (!devicePromise) devicePromise = requestDevice()
  return devicePromise
}

async function requestDevice(): Promise<GPUDevice> {
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    throw new Error('No WebGPU adapter is available. Check that hardware acceleration is enabled.')
  }
  const device = await adapter.requestDevice()
  device.lost.then((info) => {
    if (devicePromise) devicePromise = null
    const message = `WebGPU device was lost: ${info.message}`
    console.error('[effects-lab]', message)
    for (const listener of errorListeners) listener(message)
  })
  device.addEventListener('uncapturederror', (event) => {
    const message = event.error.message
    console.error('[effects-lab] WebGPU validation:', message)
    for (const listener of errorListeners) listener(message)
  })
  return device
}
