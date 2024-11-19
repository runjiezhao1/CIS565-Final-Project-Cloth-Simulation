import { mat4, vec3 } from 'gl-matrix';
import { Camera } from './stage/camera';
import { GUIController } from './gui/gui';
import Stats from 'stats-js';
import { ClothRenderer } from './clothSim/cloth_renderer';

export class Renderer{
    canvas!: HTMLCanvasElement;
    device!: GPUDevice;
    context!: GPUCanvasContext;
    format!: GPUTextureFormat;
    mvpUniformBuffer!: GPUBuffer;
    sampleCount: number = 4;
    depthTexture!: GPUTexture;
    resolveTexture!: GPUTexture;
    isRunning : boolean = false;

    // Camera
    camera!: Camera;
    camera_position: vec3 = vec3.fromValues(0, 0, 0);
    sensitivity: number = 1;

    // GUI
    guiController!: GUIController;

    // Light
    light_position: vec3 = vec3.fromValues(150.0, 500.0, 150.0);
    light_color: vec3 = vec3.fromValues(0.0, 1.0, 1.0);
    light_intensity: number = 1.0;
    specular_strength: number = 1.5;
    shininess: number = 1024.0;
    localFrameCount: number = 0;
    /*
    stats = {
        fps: 0,
        ms: ""
    };
    */
    stats = Stats(); // Initial display for framerate
    lastTime: number = 0;

    // cloth
    cloth_SizeX: number = 5;
    cloth_SizeY: number = 5;

    renderOptions = {
        sensitivity: this.sensitivity,
        clothSizeX: this.cloth_SizeX,
        clothSizeY: this.cloth_SizeY,

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
        // GUI
        //this.initializeGUI();
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

    statsOn() {
        this.stats.begin();
    }

    statsEnd() {
        this.stats.end();
    }

    getUserInputClothSize(): number[] {
        return [this.renderOptions.clothSizeX, this.renderOptions.clothSizeY];
    }

    rotateCamera(dx: number, dy: number) {
        this.camera.look(dx, dy);
    }

    panCamera(dx: number, dy: number) {
       this.camera.moveUp(dy);
       this.camera.moveRight(-dx);
    }

    zoomCamera(value: number) {
        this.camera.moveForward(value);
    }

    initializeGUI() {
        this.guiController = new GUIController();
        // Add button options here:
        var params = {
            loadFile: () => this.guiController.loadFile(),
            startSimulation: () => {
                // TODO: call clothRenderer.startClothSimulation() in main.ts
                // if(this instanceof ClothRenderer){
                //     this.clearAllBuffers();
                // }
                this.isRunning = true;
                this.init().then(()=>{
                    if(this instanceof ClothRenderer){
                        this.initializeClothSimulation(Math.round(this.renderOptions.clothSizeX), Math.round(this.renderOptions.clothSizeX));
                        this.beginRender();
                    }
                });
                console.log("start cloth simulation!");
            }
        };
        // Initialize stats display for FPS
        this.stats.setMode(0); // 0: FPS, 1: ms/frame
        this.stats.domElement.style.position = 'absolute';
        this.stats.domElement.style.left = '0px';
        this.stats.domElement.style.top = '0px';
        document.body.appendChild(this.stats.domElement);
        // Initialize the size of the cloth
        // Folder for attributes of cloth
        const folder_cloth = this.guiController.gui.addFolder('Cloth');
        folder_cloth.add(this.guiController.settings, 'clothSizeX', 1, 100).name('Cloth Size X').onChange((value: number)=>{
            this.renderOptions.clothSizeX = value;
            this.isRunning = false;
        });
        // folder_cloth.add(this.guiController.settings, 'clothSizeY', 1, 100).name('Cloth Size Y').onChange((value: number)=>{
        //     this.renderOptions.clothSizeY = value;
        // });
        folder_cloth.open();
        // Folder for camera
        const folder_camera = this.guiController.gui.addFolder('Camera');
        const sensitivityControl = folder_camera.add(this.guiController.settings, 'sensitivity', 1, 5).name('Sensitivity');
        sensitivityControl.onChange((value: number) => {
            this.camera.sensitivity = value * 0.1;
        });
        folder_camera.open();
        // other attributes
        this.guiController.gui.add(params, 'loadFile').name("Load Obj File");
        this.guiController.gui.add(params, 'startSimulation').name("Start");
    }

}
    