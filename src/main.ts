import { cubeSrc } from "./shaders/shader";
import { TriangleMesh } from "./triangle_mesh";

const main = async() => {

    const canvas : HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("canvas-webgpu");
    const adapter : GPUAdapter = <GPUAdapter> await navigator.gpu?.requestAdapter();
    const device : GPUDevice = <GPUDevice> await adapter?.requestDevice();
    var context : GPUCanvasContext = <GPUCanvasContext> canvas.getContext("webgpu");
    const format : GPUTextureFormat = "bgra8unorm";
    context.configure({
        device: device,
        format: format,
        alphaMode: "opaque"
    });

    const triangleMesh: TriangleMesh = new TriangleMesh(device);

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [],
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: []
    });
    
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
    });

    const pipeline = device.createRenderPipeline({
        vertex : {
            module : device.createShaderModule({
                code : cubeSrc
            }),
            entryPoint : "vs_main",
            buffers: [triangleMesh.bufferLayout,]
        },

        fragment : {
            module : device.createShaderModule({
                code : cubeSrc
            }),
            entryPoint : "fs_main",
            targets : [{
                format : format
            }]
        },

        primitive : {
            topology : "triangle-list"
        },

        layout: pipelineLayout
    });

    //command encoder: records draw commands for submission
    const commandEncoder : GPUCommandEncoder = device.createCommandEncoder();
    //texture view: image view to the color buffer in this case
    const textureView : GPUTextureView = context.getCurrentTexture().createView();
    //renderpass: holds draw commands, allocated from command encoder
    const renderpass : GPURenderPassEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: textureView,
            clearValue: {r: 0.5, g: 0.0, b: 0.25, a: 1.0},
            loadOp: "clear",
            storeOp: "store"
        }]
    });
    renderpass.setPipeline(pipeline);
    renderpass.setVertexBuffer(0, triangleMesh.buffer);
    renderpass.setBindGroup(0, bindGroup)
    renderpass.draw(3, 1, 0, 0);
    renderpass.end();

    device.queue.submit([commandEncoder.finish()]);
}

main();