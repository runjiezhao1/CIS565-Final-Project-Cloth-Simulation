import { cubeSrc } from "./shaders/shader";
import { TriangleMesh } from "./triangle_mesh";
import { CubeMesh } from "./cube_mesh";
import {Camera} from "./stage/camera";

const main = async() => {
    const canvas : HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("canvas-webgpu");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const aspectRatio = canvas.width / canvas.height;
    const camera = new Camera(aspectRatio);
    const adapter : GPUAdapter = <GPUAdapter> await navigator.gpu?.requestAdapter();
    const device : GPUDevice = <GPUDevice> await adapter?.requestDevice();
    var context : GPUCanvasContext = <GPUCanvasContext> canvas.getContext("webgpu");
    const format : GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: format,
        alphaMode: "opaque"
    });

    // Create uniform buffer for camera matrices
    const uniformBuffer = device.createBuffer({
        size: 2 * 16 * Float32Array.BYTES_PER_ELEMENT, // Two 4x4 matrices (projection and view)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformData = new Float32Array(32);
    uniformData.set(camera.projectionMatrix, 0);
    uniformData.set(camera.viewMatrix, 16);
    //device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer, uniformData.byteOffset, uniformData.byteLength);

    const triangleMesh: TriangleMesh = new TriangleMesh(device);
    const cubeMesh : CubeMesh = new CubeMesh(device);

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: "uniform" },
            },
        ],
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0, 
                resource: 
                { 
                    buffer: uniformBuffer 
                } 
            }
        ]
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
            buffers: [cubeMesh.bufferLayout,]
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

    function render() {
        camera.updateViewMatrix();
        uniformData.set(camera.viewMatrix, 16);
        device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer, uniformData.byteOffset, uniformData.byteLength);
        console.log(camera.position);
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
        renderpass.setVertexBuffer(0, cubeMesh.buffer);
        renderpass.setBindGroup(0, bindGroup)
        renderpass.draw(3, 1, 0, 0);
        renderpass.end();
        device.queue.submit([commandEncoder.finish()]);
    }

    function handleKeyDown(event: KeyboardEvent) {
        switch (event.key) {
            case 'w': // Move forward
                camera.moveForward(0.1);
                break;
            case 's': // Move backward
                camera.moveForward(-0.1);
                break;
            case 'a': // Move left
                camera.moveRight(-0.1);
                break;
            case 'd': // Move right
                camera.moveRight(0.1);
                break;
            case 'q': // Move up
                camera.moveUp(0.1);
                break;
            case 'e': // Move down
                camera.moveUp(-0.1);
                break;
        }
        render(); // Re-render the scene after updating the camera position
    }

    function handleMouseMove(event: MouseEvent) {
        const deltaX = event.movementX;
        const deltaY = -event.movementY; // Invert Y-axis to feel natural
        camera.look(deltaX, deltaY);
        render();
    }

    // Set up event listener for keyboard input
    window.addEventListener('keydown', handleKeyDown);
    
    // Lock pointer to enable mouse control
    canvas.addEventListener('click', () => {
        canvas.requestPointerLock();
    });

    // Set up event listener for pointer lock and mouse movement
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === canvas) {
            document.addEventListener('mousemove', handleMouseMove);
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
        }
    });

    render(); // Initial render
}

main();