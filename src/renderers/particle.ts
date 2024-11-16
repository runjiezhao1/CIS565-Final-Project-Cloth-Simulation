import { mat4, vec3 } from 'gl-matrix';
import { Camera } from '../stage/camera';
import { Shader } from '../shaders/particleShader';
import { RendererOrigin} from '../renderer_origin';

export class Renderer extends RendererOrigin{    
    private particlePipeline!: GPURenderPipeline;

    private computePipeline!: GPUComputePipeline;
    private computeBindGroup!: GPUBindGroup;
    
    private renderBindGroup!: GPUBindGroup;
    private numParticlesBuffer!: GPUBuffer;
    
    //shader
    private shader!: Shader;
    
    private positions!: number[];
    private velocities!: number[];    
    private colors!: number[];
    
    private positionBuffer!: GPUBuffer;
    private velocityBuffer!: GPUBuffer;
    private colorBuffer!: GPUBuffer;
    numParticles:number = 0;

    bottomPanel!:Float32Array;
    bottomPanelIndicies!:Uint16Array;
    indexCount:number = 0;

    private vertexBuffer!:GPUBuffer;
    private indexBuffer!:GPUBuffer;
    

    constructor(canvasId: string) {
        super(canvasId);

        this.shader = new Shader();
        this.positions = [];
        this.velocities = [];
        this.colors = [];
        this.bottomPanel = new Float32Array([
            -20.0, -0.01, -20.0, 0.0, 0.0, 1.0,
            20.0, -0.01, -20.0, 0.0, 0.0, 1.0,
            20.0, -0.01, 20.0, 0.0, 0.0, 1.0,
            -20.0, -0.01, 20.0, 0.0, 0.0, 1.0,
        ]);

        this.bottomPanelIndicies = new Uint16Array([
            0, 1, 2, 0, 2, 3,
        ]);
    }
    
    async init(){
        await super.init();
    }

    createBuffers() {                
        // Create vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: this.bottomPanel.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(this.bottomPanel);
        this.vertexBuffer.unmap();
    
        // Create index buffer
        this.indexBuffer = this.device.createBuffer({
            size: this.bottomPanelIndicies.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        new Uint16Array(this.indexBuffer.getMappedRange()).set(this.bottomPanelIndicies);
        this.indexBuffer.unmap();
    
        // Set the count of indices
        this.indexCount = this.bottomPanelIndicies.length;
    }
    
    createPipeline(){
        const render_shader = this.shader.getRenderShader();
        const shaderModule = this.device.createShaderModule({ code: render_shader });
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {}
                }
            ]
    
        });
    
        this.mvpUniformBuffer = this.device.createBuffer({
            size: 64 * 3,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        this.renderBindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.mvpUniformBuffer
                    }
                }
            ]
        });
    
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout, 
            vertex: {
                module: shaderModule,
                entryPoint: "vs_main",
                buffers: [{
                    arrayStride: 24, // Each vertex consists of 3 floats (x, y, z), each float is 4 bytes
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: "float32x3"
                    },
                    {
                        shaderLocation: 1,
                        offset: 12,
                        format: "float32x3"
                    }]
                    
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fs_main",
                targets: [{ format: this.format }],
            },
            primitive: {
                topology: "triangle-list",
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth32float',
            }
    
        });
    }    

    createParticlePipeline() {
        const particleShaderModule = this.device.createShaderModule({ code: this.shader.getParticleShader() });
        
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {}
                }
            ]
        });
        this.mvpUniformBuffer = this.device.createBuffer({
            size: 64 * 3,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        this.renderBindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.mvpUniformBuffer
                    }
                }
            ]
        });
    
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout], 
        });

        this.particlePipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: particleShaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 12, // Assuming each particle position is a vec3<f32>
                    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
                },
                {
                    arrayStride: 12,
                    attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }],
                }
            ],                
            },
            fragment: {
                module: particleShaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: this.format }],
            },
            primitive: {
                topology: 'point-list', // Render particles as points
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth32float',
            },
        });
        console.log("create particle pipeline success");
    }

    random(min:number, max:number) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }

    createParticles(numParticles: number) {
        this.numParticles = numParticles;
        for (let i = 0; i < numParticles; i++) {
            const position: [number, number, number] = [
                this.random(-20.0,20.0),
                this.random(5.0,30.0),
                this.random(-20.0,20.0),
            ];
            const color: [number, number, number] = [
                Math.random() * 10.0,
                Math.random() * 10.0,
                Math.random() * 10.0,
            ]
            
            const velocity: [number, number, number] = [0.0, 0.0, 0.0]; // Initial velocity
            this.positions.push(...position);
            this.velocities.push(...velocity);
            this.colors.push(...color);
        }
        console.log("create particle success #",numParticles);        
    }

    createParticleBuffers() {
        const positionData = new Float32Array(this.positions);
        this.positionBuffer = this.device.createBuffer({
            size: positionData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE, 
            mappedAtCreation: true,
        });
        new Float32Array(this.positionBuffer.getMappedRange()).set(positionData);
        this.positionBuffer.unmap();

        const velocityData = new Float32Array(this.velocities);
        this.velocityBuffer = this.device.createBuffer({
            size: velocityData.byteLength,
            usage: GPUBufferUsage.STORAGE, 
            mappedAtCreation: true,
        });
        new Float32Array(this.velocityBuffer.getMappedRange()).set(velocityData);
        this.velocityBuffer.unmap();

        const colorData = new Float32Array(this.colors);
        this.colorBuffer = this.device.createBuffer({
            size: colorData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, 
            mappedAtCreation: true,
        });
        new Float32Array(this.colorBuffer.getMappedRange()).set(colorData);
        this.colorBuffer.unmap();

        const numParticlesData = new Uint32Array([this.numParticles]);
        this.numParticlesBuffer = this.device.createBuffer({
            size: numParticlesData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Uint32Array(this.numParticlesBuffer.getMappedRange()).set(numParticlesData);
        this.numParticlesBuffer.unmap();
    }

    createComputeBindGroup() {
        
    }

    createComputePipeline() {        
        const computeShaderModule = this.device.createShaderModule({ code: this.shader.getComputeShader() });
    
        // Create bind group layout for storage buffers
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0, // matches @group(0) @binding(0)
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                        minBindingSize: 0, // or specify the actual size
                    },
                },
                {
                    binding: 1, // matches @group(0) @binding(1)
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                        minBindingSize: 0, // or specify the actual size
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'uniform', minBindingSize: 4 }, // Ensure this matches the shader's expectation
                },
            ],
        });
    
        // Use the bind group layout to create a pipeline layout
        const computePipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
    
        this.computePipeline = this.device.createComputePipeline({
            layout: computePipelineLayout, // Use the created pipeline layout
            compute: {
                module: computeShaderModule,
                entryPoint: 'main',
            },
        });

        this.computeBindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.positionBuffer,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.velocityBuffer,
                    },
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.numParticlesBuffer,
                    },
                },
            ],
        });
    }

    

    updateParticles() {
        const commandEncoder = this.device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);

        let X = Math.ceil(this.numParticles / 64);

        computePass.dispatchWorkgroups(X, 1, 1);
        computePass.end();
    }
    

    
    async render() {        
        
        const currentTime = performance.now();
        this.frameCount++;
        this.setCamera(this.camera);    
        
        {
            const commandEncoder = this.device.createCommandEncoder();
            const computePass = commandEncoder.beginComputePass();
            computePass.setPipeline(this.computePipeline);
            computePass.setBindGroup(0, this.computeBindGroup);
            computePass.dispatchWorkgroups(Math.ceil(this.numParticles / 64.0)+1);
            computePass.end();        
            this.device.queue.submit([commandEncoder.finish()]);
        }
        
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, // Background color
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: { // Add this attachment for depth testing
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            }
        };
    
        // Set camera and model transformations
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.particlePipeline); // render pipeline        
        passEncoder.setVertexBuffer(0, this.positionBuffer);    
        passEncoder.setVertexBuffer(1, this.colorBuffer);      
        passEncoder.setBindGroup(0, this.renderBindGroup);
        passEncoder.draw(this.numParticles);

        passEncoder.setPipeline(this.pipeline);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.setIndexBuffer(this.indexBuffer, 'uint16');
        passEncoder.setBindGroup(0, this.renderBindGroup);
        passEncoder.drawIndexed(this.indexCount);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);

        if (currentTime - this.lastTime >= 1000) {
            // Calculate the FPS.
            const fps = this.frameCount;
            if (this.fpsDisplay) {
                this.fpsDisplay.textContent = `FPS: ${fps}`;
            } else {
                console.log(`FPS: ${fps}`);
            }
            // Reset the frame count and update the last time check.
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }
}
