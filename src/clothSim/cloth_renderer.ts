import { Renderer } from "../renderer";
import { makeFloat32ArrayBufferStorage, makeUInt32IndexArrayBuffer, ObjLoader, ObjModel } from "../utils";
import { cubeSrc, objSrc, PDSrc } from "../shaders/shader";

export class ClothRenderer extends Renderer {
    objLoader : ObjLoader = new ObjLoader();
    objModel : ObjModel = new ObjModel();
    objectPosBuffer!: GPUBuffer;
    objectIndexBuffer!: GPUBuffer;
    indexCount !: number;
    renderpass !: GPURenderPassEncoder;
    commandEncoder !: GPUCommandEncoder;
    renderPipeline !: GPURenderPipeline;
    mvpBindGroup !: GPUBindGroup;

    async init() {
        await super.init();
        await this.createModelInfo();
    }

    async createModelInfo(){
        //hard code the obj file here
        const response = await fetch("../scenes/pyramid.obj");
        const content = await response.text();
        console.log(content);
        this.objModel = await this.objLoader.load("../scenes/dragon2.obj");
        //const {vertices, indices} = parseOBJ(content);
        var vertArray = new Float32Array(this.objModel.vertices);
        var indArray = new Uint32Array(this.objModel.indices);

        this.objectPosBuffer = makeFloat32ArrayBufferStorage(this.device, vertArray);
        this.objectIndexBuffer = makeUInt32IndexArrayBuffer(this.device, indArray);
        this.indexCount = indArray.length;
        this.mvpUniformBuffer = this.device.createBuffer({
            size: 128, // The total size needed for the matrices
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST // The buffer is used as a uniform and can be copied to
        });

        //this.setCamera(this.camera);
    }

    async createRenderPipeline(){
        const mvpBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
                    buffer: { type: "uniform" },
                },
            ],
        });
    
        this.mvpBindGroup = this.device.createBindGroup({
            layout: mvpBindGroupLayout,
            entries: [
                {
                    binding: 0, 
                    resource: 
                    { 
                        buffer: this.mvpUniformBuffer 
                    } 
                }
            ]
        });

        const mvpPipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [mvpBindGroupLayout]
        });

        //command encoder: records draw commands for submission
        this.commandEncoder = this.device.createCommandEncoder();
        //texture view: image view to the color buffer in this case
        const textureView : GPUTextureView = this.context.getCurrentTexture().createView();

        //renderpass: holds draw commands, allocated from command encoder
        this.renderpass = this.commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: {
                    r: 1,
                    g: 1,
                    b: 1,
                    a: 1.0
                },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        //setup pipeline
        this.renderPipeline = this.device.createRenderPipeline({
            vertex : {
                module : this.device.createShaderModule({
                    code : objSrc
                }),
                entryPoint : "vs_main",
                buffers: [
                    {
                        arrayStride: 3 * 4, // Each vertex has 6 floats (x, y, z, r, g, b)
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: "float32x3" }, // Position attribute
                        ],
                    },
                ],
            },
    
            fragment : {
                module : this.device.createShaderModule({
                    code : objSrc
                }),
                entryPoint : "fs_main",
                targets : [{
                    format : this.format
                }]
            },
    
            primitive : {
                topology : "triangle-list"
            },
    
            layout: mvpPipelineLayout
        });
    }

    async writeBuffer(){
        const mvpUniformData = new Float32Array(32);
        mvpUniformData.set(this.camera.projectionMatrix, 0);
        mvpUniformData.set(this.camera.viewMatrix, 16);
        this.device.queue.writeBuffer(this.mvpUniformBuffer, 0, mvpUniformData.buffer, mvpUniformData.byteOffset, mvpUniformData.byteLength);
    }

    async renderCloth(){
        this.renderpass.setPipeline(this.renderPipeline);
        this.renderpass.setVertexBuffer(0, this.objectPosBuffer);
        this.renderpass.setIndexBuffer(this.objectIndexBuffer, "uint32");
        this.renderpass.setBindGroup(0, this.mvpBindGroup);
        this.renderpass.drawIndexed(this.indexCount);
        this.renderpass.end();
        this.device.queue.submit([this.commandEncoder.finish()]);
    }
}