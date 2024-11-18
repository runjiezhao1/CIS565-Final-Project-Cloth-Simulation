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
    sampleCount: number = 4;
    depthTexture!: GPUTexture;
    resolveTexture!: GPUTexture;
    camera_position: vec3 = vec3.fromValues(0, 0, 0);
    light_position: vec3 = vec3.fromValues(150.0, 500.0, 150.0);
    light_color: vec3 = vec3.fromValues(0.0, 1.0, 1.0);
    light_intensity: number = 1.0;
    specular_strength: number = 1.5;
    shininess: number = 1024.0;
    localFrameCount: number = 0;
    stats = {
        fps: 0,
        ms: ""
    };
    lastTime: number = 0;

    renderOptions = {
        wireFrame: false,
        camPosX: this.camera_position[0],
        camPosY: this.camera_position[1],
        camPosZ: this.camera_position[2],
        renderObject: true,
        moveObject: false,
        wind: false,

        lightPosX: this.light_position[0],
        lightPosY: this.light_position[1],
        lightPosZ: this.light_position[2],

        lightColorX: this.light_color[0],
        lightColorY: this.light_color[1],
        lightColorZ: this.light_color[2],

        lightIntensity: this.light_intensity,
        specularStrength: this.specular_strength,
        shininess: this.shininess,
    }

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
        this.createDepthTexture();
        this.createResolveTexture();
    }

    setCamera(camera: Camera) {
        const projection = mat4.create();
        mat4.perspective(projection, camera.fovY, this.canvas.width / this.canvas.height, camera.near, camera.far);

        const view = mat4.create();
        mat4.lookAt(view, camera.position, camera.target, camera.up);

        const model = mat4.create();

        this.updateUniformBuffer(model, view, projection);
    }

    updateUniformBuffer(model: mat4, view: mat4, projection: mat4) {
        const data = new Float32Array(48);
        data.set(model);
        data.set(view, 16);
        data.set(projection, 32);

        this.device.queue.writeBuffer(
            this.mvpUniformBuffer,
            0,
            data.buffer,
            0,
            data.byteLength
        );
    }

    createDepthTexture() {
        this.depthTexture = this.device.createTexture({
            size: { width: this.canvas.width, height: this.canvas.height, depthOrArrayLayers: 1 },
            format: 'depth32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            sampleCount: this.sampleCount
        });
    }

    createResolveTexture() {
        this.resolveTexture = this.device.createTexture({
            size: { width: this.canvas.width, height: this.canvas.height, depthOrArrayLayers: 1 },
            format: this.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            sampleCount: this.sampleCount
        });
    }

    setCamera1(camera: Camera) {
        this.camera.projectionMatrix = camera.projectionMatrix;
        this.camera.viewMatrix = camera.viewMatrix;
        this.updateUniformBuffer1(this.camera.viewMatrix, this.camera.projectionMatrix);
    }

    updateUniformBuffer1(view: mat4, projection: mat4) {
        const data = new Float32Array(32);
        data.set(view);
        data.set(projection, 16);
        console.log(data.byteLength);
        this.device.queue.writeBuffer(this.mvpUniformBuffer, 0, data.buffer, data.byteOffset, data.byteLength);
    }
}