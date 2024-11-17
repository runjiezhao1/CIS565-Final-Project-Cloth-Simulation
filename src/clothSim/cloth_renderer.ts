import { Renderer } from "../renderer";
import { calculateNormal, makeFloat32ArrayBuffer, makeFloat32ArrayBufferStorage, makeUInt32IndexArrayBuffer, ObjLoader, ObjModel } from "../utils";
import { cubeSrc, objSrc, PDSrc } from "../shaders/shader";
import { vec3 } from "gl-matrix";
import { Node, Triangle, Spring } from "../PhysicsSystem/Particles";

export class ClothRenderer extends Renderer {
    objLoader : ObjLoader = new ObjLoader();
    objModel : ObjModel = new ObjModel();

    //buffers for objects
    objectPosBuffer!: GPUBuffer;
    objectIndexBuffer!: GPUBuffer;
    objectUVBuffer!: GPUBuffer;
    objectNormalBuffer !: GPUBuffer;

    indexCount !: number;
    renderpass !: GPURenderPassEncoder;
    commandEncoder !: GPUCommandEncoder;
    renderPipeline !: GPURenderPipeline;
    mvpBindGroup !: GPUBindGroup;

    //cloth information
    //N and M are number of particles in a row and a column
    N : number = 0;
    M : number = 0;
    structuralKs: number = 5000.0;
    shearKs: number = 2000.0;
    bendKs: number = 500.0;
    kD : number = 0.25;
    //xSize and ySize are the length of side of the cloth
    xSize : number = 80;
    ySize : number = 80;

    //UVs uvIndices is used to store each uv info. uv is used to combine all uvIndices together
    uvIndices: [number, number][] = [];
    uv !: Float32Array;

    //store all particles
    particles : Node[] = [];

    //normals
    normals!: Array<vec3>;

    //triangles info
    triangles : Triangle[] = [];
    triangleIndices!: Uint32Array;
    numParticles : number = 0;
    maxTriangleConnected: number = 0;

    //springs
    springs : Spring[] = [];
    maxSpringConnected : number = 0;
    springIndices!: Uint32Array;

    //buffers for particles
    positionBuffer!: GPUBuffer;
    prevPositionBuffer!: GPUBuffer;
    velocityBuffer!: GPUBuffer;
    forceBuffer!: GPUBuffer;
    vertexNormalBuffer!: GPUBuffer;
    fixedBuffer!: GPUBuffer;
    uvBuffer!: GPUBuffer;

    //buffers for springs
    springRenderBuffer!: GPUBuffer;
    triangleRenderBuffer!: GPUBuffer;
    springCalculationBuffer!: GPUBuffer;
    triangleCalculationBuffer!: GPUBuffer;

    //uniform buffers
    numParticlesBuffer!: GPUBuffer;

    //temp buffers
    tempSpringForceBuffer!: GPUBuffer;
    tempTriangleNormalBuffer!: GPUBuffer;
    collisionTempBuffer!: GPUBuffer;
    collisionCountTempBuffer!: GPUBuffer;

    async init() {
        await super.init();
        await this.createModelInfo();
    }

    //three types of springs connecting all particles: structural, shear and flexion
    createClothInfo(x: number, y: number, structuralKs: number = 5000.0, shearKs: number = 2000.0, bendKs: number = 500.0, kd: number = 0.25){
        this.N = x;
        this.M = y;
        this.structuralKs = structuralKs;
        this.shearKs = shearKs;
        this.bendKs = bendKs;
        this.kD = kd;

        this.createParticles();
        this.createSprings();
    }

    createSprings(){
        let index = 0;

        //1. Structural left and right
        for (let i = 0; i < this.M; i++) {
            for (let j = 0; j < this.N - 1; j++) {
                if (i > 0 && j === 0) {
                    index++;
                }
                const sp = new Spring(
                    this.particles[index],
                    this.particles[index + 1],
                    this.structuralKs,
                    this.kD,
                    "structural",
                    index,
                    index + 1
                );
                sp.targetIndex1 = this.particles[sp.index1].springs.length;
                sp.targetIndex2 = this.particles[sp.index2].springs.length;
                this.springs.push(sp);
                this.particles[sp.index1].springs.push(sp);
                this.particles[sp.index2].springs.push(sp);
                index++;
            }
        }
        // 2. Structural top and bottom
        for (let i = 0; i < (this.N - 1); i++) {
            for (let j = 0; j < this.M; j++) {
                ++index;
                const sp = new Spring(
                    this.particles[this.N * i + j],
                    this.particles[this.N * i + j + this.N],
                    this.structuralKs,
                    this.kD,
                    "structural",
                    this.N * i + j,
                    this.N * i + j + this.N
                );
                sp.targetIndex1 = this.particles[sp.index1].springs.length;
                sp.targetIndex2 = this.particles[sp.index2].springs.length;
                this.springs.push(sp);
                this.particles[sp.index1].springs.push(sp);
                this.particles[sp.index2].springs.push(sp);
            }
        }
        // 3. Shear top left and bottom right
        index = 0;
        for (let i = 0; i < (this.N) * (this.M - 1); i++) {
            if (i % this.N === (this.N - 1)) {
                index++;
                continue;
            }
            const sp = new Spring(
                this.particles[index],
                this.particles[index + this.N + 1],
                this.shearKs,
                this.kD,
                "shear",
                index,
                index + this.N + 1
            );
            sp.targetIndex1 = this.particles[sp.index1].springs.length;
            sp.targetIndex2 = this.particles[sp.index2].springs.length;
            this.springs.push(sp);
            this.particles[sp.index1].springs.push(sp);
            this.particles[sp.index2].springs.push(sp);
            index++;
        }
        // Shear top right and bottom left
        index = 0;
        for (let i = 0; i < (this.N) * (this.M - 1); i++) {
            if (i % this.N === 0) {
                index++;
                continue;
            }
            const sp = new Spring(
                this.particles[index],
                this.particles[index + this.N - 1],
                this.shearKs,
                this.kD,
                "shear",
                index,
                index + this.N - 1
            );
            sp.targetIndex1 = this.particles[sp.index1].springs.length;
            sp.targetIndex2 = this.particles[sp.index2].springs.length;
            this.springs.push(sp);
            this.particles[sp.index1].springs.push(sp);
            this.particles[sp.index2].springs.push(sp);
            index++;
        }
        // 5. Bending left and right(2 units)
        index = 0;
        for (let i = 0; i < (this.N) * this.M; i++) {
            if (i % this.N > this.N - 3) {
                index++;
                continue;
            }
            const sp = new Spring(
                this.particles[index],
                this.particles[index + 2],
                this.bendKs,
                this.kD,
                "bending",
                index,
                index + 2
            );
            sp.targetIndex1 = this.particles[sp.index1].springs.length;
            sp.targetIndex2 = this.particles[sp.index2].springs.length;
            this.springs.push(sp);
            this.particles[sp.index1].springs.push(sp);
            this.particles[sp.index2].springs.push(sp);
            index++;
        }
        // Bending top and bottom(2 units)
        for (let i = 0; i < this.N; i++) {
            for (let j = 0; j < this.M - 3; j++) {
                const sp = new Spring(
                    this.particles[i + (j * this.M)],
                    this.particles[i + (j + 3) * this.M],
                    this.bendKs,
                    this.kD,
                    "bending",
                    i + (j * this.M),
                    i + (j + 3) * this.M
                );
                sp.targetIndex1 = this.particles[sp.index1].springs.length;
                sp.targetIndex2 = this.particles[sp.index2].springs.length;
                this.springs.push(sp);
                this.particles[sp.index1].springs.push(sp);
                this.particles[sp.index2].springs.push(sp);
            }
        }

        for (let i = 0; i < this.particles.length; i++) {
            let nConnectedSpring = this.particles[i].springs.length;
            this.maxSpringConnected = Math.max(this.maxSpringConnected, nConnectedSpring);
        }
        for (let i = 0; i < this.springs.length; i++) {
            var sp = this.springs[i];

            sp.targetIndex1 += (this.maxSpringConnected * sp.index1);
            sp.targetIndex2 += (this.maxSpringConnected * sp.index2);
        }
        console.log("maxSpringConnected : #", this.maxSpringConnected);
        console.log("make #", this.springs.length, " spring create success");
    }

    createParticles() {
        // N * M particles
        //20x20 cloth
        const start_x = 30;
        const start_y = 30;

        const dist_x = (this.xSize / this.N);
        const dist_y = (this.ySize / this.M);
        const maxHeight = 27.0;
        const minHeight = 13.0;
        const centerX = (this.N - 1) / 2;
        const centerY = (this.M - 1) / 2;

        for (let i = 0; i < this.N; i++) {
            for (let j = 0; j < this.M; j++) {
                let distanceFromCenter = Math.sqrt(Math.pow(i - centerX, 2) + Math.pow(j - centerY, 2));
                let heightFactor = (distanceFromCenter / Math.max(centerX, centerY)) * (maxHeight - minHeight);
                let yPos = (maxHeight + heightFactor) - 7.0;

                var pos = vec3.fromValues(start_x - (dist_x * j), yPos, start_y - (dist_y * i));
                var vel = vec3.fromValues(0, 0, 0);

                const node = new Node(pos, vel);

                let u = j / (this.M - 1);
                let v = i / (this.N - 1);

                this.uvIndices.push([u, v]);
                this.particles.push(node);
            }
        }
        
        const combinedVertices: number[] = [];
        this.particles.forEach((particle, index) => {
            combinedVertices.push(...particle.position, ...this.uvIndices[index]);
        });

        const uvs: number[] = [];
        this.uvIndices.forEach((uv, index) => {
            uvs.push(...uv);
        });
        this.uv = new Float32Array(uvs);
        let indices: number[] = [];

        this.normals = new Array(this.particles.length);
        this.normals.fill(vec3.create());

        for (let i = 0; i < this.N - 1; i++) {
            for (let j = 0; j < this.M - 1; j++) {
                const topLeft = i * this.M + j;
                const topRight = topLeft + 1;
                const bottomLeft = (i + 1) * this.M + j;
                const bottomRight = bottomLeft + 1;

                var triangle1 = new Triangle(topLeft, bottomLeft, topRight);
                this.triangles.push(triangle1);
                this.particles[topLeft].triangles.push(triangle1);
                this.particles[bottomLeft].triangles.push(triangle1);
                this.particles[topRight].triangles.push(triangle1);

                var triangle2 = new Triangle(topRight, bottomLeft, bottomRight);
                this.triangles.push(triangle2);
                this.particles[topRight].triangles.push(triangle2);
                this.particles[bottomLeft].triangles.push(triangle2);
                this.particles[bottomRight].triangles.push(triangle2);

                indices.push(topLeft, bottomLeft, topRight);
                indices.push(topRight, bottomLeft, bottomRight);

                let v0 = this.particles[topLeft].position;
                let v1 = this.particles[bottomLeft].position;
                let v2 = this.particles[topRight].position;
                let v3 = this.particles[bottomRight].position;

                let triangleNormal1 = calculateNormal(v0, v1, v2);
                let triangleNormal2 = calculateNormal(v2, v1, v3);

                vec3.add(this.normals[topLeft], this.normals[topLeft], triangleNormal1);
                vec3.add(this.normals[bottomLeft], this.normals[bottomLeft], triangleNormal1);
                vec3.add(this.normals[topRight], this.normals[topRight], triangleNormal1);

                vec3.add(this.normals[topRight], this.normals[topRight], triangleNormal2);
                vec3.add(this.normals[bottomLeft], this.normals[bottomLeft], triangleNormal2);
                vec3.add(this.normals[bottomRight], this.normals[bottomRight], triangleNormal2);
            }
        }
        this.normals.forEach(normal => {
            vec3.normalize(normal, normal);
        });

        this.triangleIndices = new Uint32Array(indices);

        this.numParticles = this.particles.length;
        console.log("make #", this.numParticles, " particles create success");
        for (let i = 0; i < this.particles.length; i++) {
            let nConnectedTriangle = this.particles[i].triangles.length;
            this.maxTriangleConnected = Math.max(this.maxTriangleConnected, nConnectedTriangle);
        }
        console.log(this.maxTriangleConnected);
    }

    createClothBuffers(){
        const positionData = new Float32Array(this.particles.flatMap(p => [p.position[0], p.position[1], p.position[2]]));
        const velocityData = new Float32Array(this.particles.flatMap(p => [p.velocity[0], p.velocity[1], p.velocity[2]]));
        const forceData = new Float32Array(this.particles.flatMap(p => [0.0, 0.0, 0.0]));
        const normalData = new Float32Array(this.normals.flatMap(p => [p[0], p[1], p[2]]));

        this.positionBuffer = makeFloat32ArrayBufferStorage(this.device, positionData);
        this.prevPositionBuffer = makeFloat32ArrayBufferStorage(this.device, positionData);
        this.velocityBuffer = makeFloat32ArrayBufferStorage(this.device, velocityData);
        this.forceBuffer = makeFloat32ArrayBufferStorage(this.device, forceData);

        this.vertexNormalBuffer = makeFloat32ArrayBufferStorage(this.device, normalData);

        const fixedData = new Uint32Array(this.particles.length);
        this.particles.forEach((particle, i) => {
            fixedData[i] = particle.fixed ? 1 : 0;
        });

        this.fixedBuffer = this.device.createBuffer({
            size: fixedData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 
            mappedAtCreation: true,
        });
        new Uint32Array(this.fixedBuffer.getMappedRange()).set(fixedData);
        this.fixedBuffer.unmap();

        this.springIndices = new Uint32Array(this.springs.length * 2);
        this.springs.forEach((spring, i) => {
            let offset = i * 2;
            this.springIndices[offset] = spring.index1;
            this.springIndices[offset + 1] = spring.index2;
        });

        this.springRenderBuffer = makeUInt32IndexArrayBuffer(this.device, this.springIndices);

        this.uvBuffer = makeFloat32ArrayBuffer(this.device, this.uv);

        this.triangleRenderBuffer = this.device.createBuffer({
            size: this.triangleIndices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
            mappedAtCreation: true,
        });
        new Uint32Array(this.triangleRenderBuffer.getMappedRange()).set(this.triangleIndices);
        this.triangleRenderBuffer.unmap();

        const springCalcData = new Float32Array(this.springs.length * 7); // 7 elements per spring
        this.springs.forEach((spring, i) => {
            let offset = i * 7;
            springCalcData[offset] = spring.index1;
            springCalcData[offset + 1] = spring.index2;
            springCalcData[offset + 2] = spring.kS;
            springCalcData[offset + 3] = spring.kD;
            springCalcData[offset + 4] = spring.mRestLen;
            springCalcData[offset + 5] = spring.targetIndex1;
            springCalcData[offset + 6] = spring.targetIndex2;
        });
        // Create the GPU buffer for springs
        this.springCalculationBuffer = this.device.createBuffer({
            size: springCalcData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        new Float32Array(this.springCalculationBuffer.getMappedRange()).set(springCalcData);
        this.springCalculationBuffer.unmap();

        const triangleCalcData = new Float32Array(this.triangles.length * 3); // 7 elements per spring
        this.triangles.forEach((triangle, i) => {
            let offset = i * 3;
            triangleCalcData[offset] = triangle.v1;
            triangleCalcData[offset + 1] = triangle.v2;
            triangleCalcData[offset + 2] = triangle.v3;
        });
        this.triangleCalculationBuffer = this.device.createBuffer({
            size: triangleCalcData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        new Float32Array(this.triangleCalculationBuffer.getMappedRange()).set(triangleCalcData);
        this.triangleCalculationBuffer.unmap();

        const numParticlesData = new Uint32Array([this.numParticles]);
        this.numParticlesBuffer = this.device.createBuffer({
            size: numParticlesData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Uint32Array(this.numParticlesBuffer.getMappedRange()).set(numParticlesData);
        this.numParticlesBuffer.unmap();

        const nodeSpringConnectedData = new Int32Array(this.numParticles * 3);
        this.tempSpringForceBuffer = this.device.createBuffer({
            size: nodeSpringConnectedData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        new Int32Array(this.tempSpringForceBuffer.getMappedRange()).set(nodeSpringConnectedData);
        this.tempSpringForceBuffer.unmap();

        const nodeTriangleConnectedData = new Uint32Array(this.numParticles * 3);
        this.tempTriangleNormalBuffer = this.device.createBuffer({
            size: nodeTriangleConnectedData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        new Uint32Array(this.tempTriangleNormalBuffer.getMappedRange()).set(nodeTriangleConnectedData);
        this.tempTriangleNormalBuffer.unmap();


        const collisionTempData = new Int32Array(this.numParticles * 3);
        this.collisionTempBuffer = this.device.createBuffer({
            size: collisionTempData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        new Int32Array(this.collisionTempBuffer.getMappedRange()).set(collisionTempData);
        this.collisionTempBuffer.unmap();

        const collisionCountTempData = new Int32Array(this.numParticles);
        this.collisionCountTempBuffer = this.device.createBuffer({
            size: collisionCountTempData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        new Int32Array(this.collisionCountTempBuffer.getMappedRange()).set(collisionCountTempData);
        this.collisionCountTempBuffer.unmap();
    }

    async createModelInfo(){
        //hard code the obj file here
        this.objModel = await this.objLoader.load("../scenes/dragon2.obj",0.1);
        var vertArray = new Float32Array(this.objModel.vertices);
        var indArray = new Uint32Array(this.objModel.indices);
        var uvArray = new Float32Array(this.objModel.uvs);
        var normalArray = new Float32Array(this.objModel.normals);

        this.objectPosBuffer = makeFloat32ArrayBufferStorage(this.device, vertArray);
        this.objectIndexBuffer = makeUInt32IndexArrayBuffer(this.device, indArray);
        this.objectUVBuffer = makeFloat32ArrayBufferStorage(this.device, uvArray);
        this.objectNormalBuffer = makeFloat32ArrayBufferStorage(this.device, normalArray);
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