import { cubeSrc, objSrc, PDSrc } from "./shaders/shader";
import { TriangleMesh } from "./triangle_mesh";
import { CubeMesh } from "./cube_mesh";
import { ObjMesh } from "./obj_mesh";
import { Camera } from "./stage/camera";
import { GUIController } from "./gui/gui";
import Stats from 'stats-js';

const main = async() => {
    let prevTime = 0;

    // Initial display for framerate
    const stats = Stats();
    stats.setMode(0);
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild(stats.domElement);
    
    // Initialize GUI Controller
    const guiController = new GUIController();

    // Canvas setting
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
        size: (2 * 16 + 4) * Float32Array.BYTES_PER_ELEMENT, // Two 4x4 matrices (projection and view)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformData = new Float32Array(36);
    uniformData.set(camera.projectionMatrix, 0);
    uniformData.set(camera.viewMatrix, 16);
    uniformData.set( [prevTime,0,0,0] ,32);

    const triangleMesh: TriangleMesh = new TriangleMesh(device);
    const cubeMesh : CubeMesh = new CubeMesh(device);
    const objMesh : ObjMesh = new ObjMesh(device, new Float32Array([]), new Uint32Array([]), new Float32Array([]));

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
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
    
    // This function will be updated every frame
    async function render(currentTime: number) {
        // FPS detector
        stats.begin();
        // GUI controller
        const backgroundColor = guiController.settings.backgroundColor;
        const deltaTime = currentTime - prevTime;
        //console.log((currentTime - prevTime) / 1000);

        camera.updateViewMatrix();
        uniformData.set(camera.viewMatrix, 16);
        uniformData.set([deltaTime,0,0,0], 32);
        device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer, uniformData.byteOffset, uniformData.byteLength);
        //console.log(camera.position);
        //command encoder: records draw commands for submission
        const commandEncoder : GPUCommandEncoder = device.createCommandEncoder();
        //texture view: image view to the color buffer in this case
        const textureView : GPUTextureView = context.getCurrentTexture().createView();

        //renderpass: holds draw commands, allocated from command encoder
        const renderpass : GPURenderPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: {
                    r: backgroundColor[0] / 255,
                    g: backgroundColor[1] / 255,
                    b: backgroundColor[2] / 255,
                    a: 1.0
                },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        //setup pipeline
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
        
        renderpass.setPipeline(pipeline);
        renderpass.setVertexBuffer(0, cubeMesh.buffer);
        renderpass.setBindGroup(0, bindGroup);
        renderpass.draw(3, 1, 0, 0);
        renderpass.end();
        device.queue.submit([commandEncoder.finish()]);

        stats.end();

        cubeMesh.updatePosition(deltaTime);
        prevTime = currentTime;

        // Request the next frame
        requestAnimationFrame(render);
    }

    // This function will be updated every frame
    async function renderObj(currentTime: number) {
        // FPS detector
        stats.begin();
        // GUI controller
        const backgroundColor = guiController.settings.backgroundColor;
        const deltaTime = currentTime - prevTime;

        if(guiController.updateBuffer){
            guiController.updateBuffer = false;
            objMesh.updateBuffer(new Float32Array(guiController.vertices), new Uint32Array(guiController.indices));
        }

        camera.updateViewMatrix();
        uniformData.set(camera.viewMatrix, 16);
        uniformData.set([deltaTime,0,0,0], 32);
        device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer, uniformData.byteOffset, uniformData.byteLength);
        
        if(objMesh.velocityArr.length > 0){
            //command encoder: records projective dynamics commands for submission
            const commandEncoderForPD : GPUCommandEncoder = device.createCommandEncoder();
            const passEncoderForPD = commandEncoderForPD.beginComputePass();
            const computeBindGroupLayout = device.createBindGroupLayout({
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.COMPUTE, // Accessible in compute shader
                        buffer: { type: "storage" },
                    },
                ],
            });
            const bindGroupForPD = device.createBindGroup({
                layout: computeBindGroupLayout,
                entries: [
                //{ binding: 0, resource: { buffer: objMesh.vertexBuffer} },
                { binding: 0, resource: { buffer: objMesh.velocityBuffer } },
                ]
            });
            const pipelineLForPD = device.createComputePipeline({
                layout: device.createPipelineLayout({
                    bindGroupLayouts: [bindGroupLayout, computeBindGroupLayout],
                  }),
                compute: {
                    module: device.createShaderModule({
                        code : PDSrc
                    }),
                    entryPoint: "main"
                }
            });

            passEncoderForPD.setPipeline(pipelineLForPD);
            passEncoderForPD.setBindGroup(0, bindGroup);
            passEncoderForPD.setBindGroup(1, bindGroupForPD);
            passEncoderForPD.dispatchWorkgroups(Math.ceil(objMesh.velocityArr.length / 64));
            passEncoderForPD.end();
            device.queue.submit([commandEncoderForPD.finish()]);
            //passEncoder.setPipeline(computePipeline);
            const stagingBuffer = device.createBuffer({
                size: objMesh.velocityArr.length * Float32Array.BYTES_PER_ELEMENT,
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
            });
            const commandEncoder = device.createCommandEncoder();
            commandEncoder.copyBufferToBuffer(objMesh.velocityBuffer, 0, stagingBuffer, 0, objMesh.velocityArr.byteLength);
            device.queue.submit([commandEncoder.finish()]);

            await stagingBuffer.mapAsync(GPUMapMode.READ);
            const arrayBuffer = stagingBuffer.getMappedRange();
            const resultArray = new Float32Array(arrayBuffer);

            //change vertex position
            for(let i = 0; i < resultArray.length / 4; i++){
                let idx = i * 4 + 1;
                objMesh.verticesArr[i * 3 + 1] = resultArray[idx] * deltaTime * 0.00001 + objMesh.verticesArr[i * 3 + 1];
            }
            device.queue.writeBuffer(objMesh.vertexBuffer,0,objMesh.verticesArr);
            console.log("updated position: ", objMesh.verticesArr);

            stagingBuffer.unmap();
        }
        
        


        //command encoder: records draw commands for submission
        const commandEncoder : GPUCommandEncoder = device.createCommandEncoder();
        //texture view: image view to the color buffer in this case
        const textureView : GPUTextureView = context.getCurrentTexture().createView();

        //renderpass: holds draw commands, allocated from command encoder
        const renderpass : GPURenderPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: {
                    r: backgroundColor[0] / 255,
                    g: backgroundColor[1] / 255,
                    b: backgroundColor[2] / 255,
                    a: 1.0
                },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        //setup pipeline
        const pipeline = device.createRenderPipeline({
            vertex : {
                module : device.createShaderModule({
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
                module : device.createShaderModule({
                    code : objSrc
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
        
        renderpass.setPipeline(pipeline);
        renderpass.setVertexBuffer(0, objMesh.vertexBuffer);
        renderpass.setIndexBuffer(objMesh.indexBuffer, "uint32");
        renderpass.setBindGroup(0, bindGroup)
        renderpass.drawIndexed(objMesh.indexCount); // Draw using indices
        renderpass.end();
        device.queue.submit([commandEncoder.finish()]);
        stats.end();
        console.log("render obj ends");
        prevTime = currentTime;

        // Request the next frame
        requestAnimationFrame(renderObj);
    }

    function handleKeyDown(event: KeyboardEvent) {
        const cameraSpeed = guiController.settings.cameraSpeed;
        switch (event.key) {
            case 'w': // Move forward
                camera.moveForward(0.1 * cameraSpeed);
                break;
            case 's': // Move backward
                camera.moveForward(-0.1 * cameraSpeed);
                break;
            case 'a': // Move left
                camera.moveRight(-0.1 * cameraSpeed);
                break;
            case 'd': // Move right
                camera.moveRight(0.1 * cameraSpeed);
                break;
            case 'q': // Move up
                camera.moveUp(0.1 * cameraSpeed);
                break;
            case 'e': // Move down
                camera.moveUp(-0.1 * cameraSpeed);
                break;
        }
    }

    function handleMouseMove(event: MouseEvent) {
        const deltaX = event.movementX;
        const deltaY = -event.movementY; // Invert Y-axis to feel natural
        camera.look(deltaX, deltaY);
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

    // start the initial render frame
    renderObj(0);
}

//main();