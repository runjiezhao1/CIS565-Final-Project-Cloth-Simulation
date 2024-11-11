async function initWebGPU(canvas) {
    if (!navigator.gpu) {
        console.error("WebGPU is not supported in this browser.");
        return null;
    }
    
    // Get WebGPU adapter and device
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    
    // Configure the canvas
    const context = canvas.getContext("webgpu");
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format: canvasFormat,
        alphaMode: "opaque",
    });
    
    return { device, context, canvasFormat };
}

function createTrianglePipeline(device, canvasFormat) {
    // Vertex shader in WGSL
    const vertexShaderCode = `
        @vertex
        fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
            var positions = array<vec2<f32>, 3>(
                vec2<f32>(0.0, 0.5),
                vec2<f32>(-0.5, -0.5),
                vec2<f32>(0.5, -0.5)
            );
            let position = positions[vertexIndex];
            return vec4<f32>(position, 0.0, 1.0);
        }
    `;

    // Fragment shader in WGSL
    const fragmentShaderCode = `
        @fragment
        fn main() -> @location(0) vec4<f32> {
            return vec4<f32>(1.0, 0.0, 0.0, 1.0); // Red color
        }
    `;

    // Create shader modules
    const vertexShaderModule = device.createShaderModule({ code: vertexShaderCode });
    const fragmentShaderModule = device.createShaderModule({ code: fragmentShaderCode });

    // Create render pipeline
    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: vertexShaderModule,
            entryPoint: "main",
        },
        fragment: {
            module: fragmentShaderModule,
            entryPoint: "main",
            targets: [{ format: canvasFormat }],
        },
        primitive: {
            topology: "triangle-list",
        },
    });

    return pipeline;
}

function drawTriangle(device, context, pipeline) {
    // Create a command encoder
    const commandEncoder = device.createCommandEncoder();

    // Create a render pass descriptor
    const textureView = context.getCurrentTexture().createView();
    const renderPassDescriptor = {
        colorAttachments: [{
            view: textureView,
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
        }],
    };

    // Begin render pass
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.draw(3, 1, 0, 0); // Draw a triangle with 3 vertices
    passEncoder.end();

    // Finish and submit the command buffer
    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);
}

async function main() {
    const canvas = document.getElementById("canvas-webgpu");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const webgpu = await initWebGPU(canvas);
    if (!webgpu) return;

    const { device, context, canvasFormat } = webgpu;
    const pipeline = createTrianglePipeline(device, canvasFormat);
    drawTriangle(device, context, pipeline);
}

main();
