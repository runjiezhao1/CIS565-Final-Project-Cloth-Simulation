import { mat4, vec3 } from 'gl-matrix';
import { Camera } from './stage/camera';
import { GUIController } from 'dat.gui';

export class Renderer{
    canvas!: HTMLCanvasElement;
    device!: GPUDevice;
    camera!: Camera;
    context!: GPUCanvasContext;
    format!: GPUTextureFormat;
    mvpUniformBuffer!: GPUBuffer;
    guiController!: GUIController;

    constructor(canvasName: string){
        this.canvas = document.getElementById(canvasName) as HTMLCanvasElement;
        if (!this.canvas) {
            console.error("Canvas element not found");
            return;
        }
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        const aspectRatio = this.canvas.width / this.canvas.height;
        this.camera = new Camera(aspectRatio);
        console.log("Rendered Initialized");
    }

    async init(){
        const adapter = await navigator.gpu?.requestAdapter();
        if (!adapter) {
            throw new Error("Failed to get GPU adapter");
        }
        this.device = await adapter?.requestDevice();
        this.context = <GPUCanvasContext> this.canvas.getContext("webgpu");
        this.format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: "opaque",
        });
    }

    setCamera(camera: Camera) {
        this.camera.projectionMatrix = camera.projectionMatrix;
        this.camera.viewMatrix = camera.viewMatrix;
        this.updateUniformBuffer(this.camera.viewMatrix, this.camera.projectionMatrix);
    }

    updateUniformBuffer(view: mat4, projection: mat4) {
        const data = new Float32Array(32);
        data.set(view);
        data.set(projection, 16);
        console.log(data.byteLength);
        this.device.queue.writeBuffer(this.mvpUniformBuffer, 0, data.buffer, data.byteOffset, data.byteLength);
    }
}