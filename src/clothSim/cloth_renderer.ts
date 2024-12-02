import { Renderer } from "../renderer";
import { calculateNormal, ImageLoader, makeFloat32ArrayBuffer, makeFloat32ArrayBufferStorage, makeUInt32IndexArrayBuffer, ObjLoader, ObjModel } from "../utils";
import { cubeSrc, objSrc, PDSrc } from "../shaders/shader";
import { vec3 } from "gl-matrix";
import { Node, Triangle, Spring } from "../PhysicsSystem/Particles";
import { ParticleShader } from "../shaders/ParticleShader";
import { ObjectShader } from "../shaders/ObjectShader";
import { NormalShader } from "../shaders/NormalShader";
import { SpringShader } from "../shaders/SpringShader";
import { IntersectionShader } from "../shaders/IntersectionShader";

export class ClothRenderer extends Renderer {

    objLoader : ObjLoader = new ObjLoader();
    objModel : ObjModel = new ObjModel();
    model!: ObjModel;
    objCloth : ObjModel = new ObjModel();
    cloth!: ObjModel;

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
    clothPosBuffer!: GPUBuffer;
    clothIndexBuffer!: GPUBuffer;
    clothUVBuffer!: GPUBuffer;
    clothNormalBuffer !: GPUBuffer;
    clothIndicesLength!: number;
    clothNumTriangleBuffer!: GPUBuffer;

    //model information
    objectIndicesLength!: number;
    ObjectPosBuffer!: GPUBuffer;
    objectNumTriangleBuffer!: GPUBuffer;
    computeObjectMovePipeline!: GPUComputePipeline;

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
    externalForceBuffer!: GPUBuffer;

    //buffers for springs
    springRenderBuffer!: GPUBuffer;
    triangleRenderBuffer!: GPUBuffer;
    springCalculationBuffer!: GPUBuffer;
    triangleCalculationBuffer!: GPUBuffer;
    numSpringsBuffer!: GPUBuffer;
    
    //uniform buffers
    numParticlesBuffer!: GPUBuffer;
    numTriangleBuffer!: GPUBuffer;
    maxConnectedTriangleBuffer!: GPUBuffer;

    //temp buffers
    tempSpringForceBuffer!: GPUBuffer;
    tempTriangleNormalBuffer!: GPUBuffer;
    collisionTempBuffer!: GPUBuffer;
    collisionCountTempBuffer!: GPUBuffer;

    //shader info
    particleShader : ParticleShader =  new ParticleShader();
    objectShader : ObjectShader = new ObjectShader();
    normalShader : NormalShader = new NormalShader();
    springShader : SpringShader = new SpringShader();
    interesectionShader : IntersectionShader = new IntersectionShader();

    
    //material buffer
    alphaValueBuffer!: GPUBuffer;
    view!: GPUTextureView;
    sampler!: GPUSampler;
    camPosBuffer!: GPUBuffer;
    lightDataBuffer!: GPUBuffer;

    //pipeline info
    renderBindGroup!: GPUBindGroup;
    triangleBindGroup!: GPUBindGroup;
    trianglePipeline!:GPURenderPipeline;
    particlePipeline!: GPURenderPipeline;
    springPipeline!: GPURenderPipeline;
    computeObjectMoveBindGroup!: GPUBindGroup;
    objRenderBindGroup!: GPUBindGroup;
    objRenderPipeline!: GPURenderPipeline;
    computePipeline!: GPUComputePipeline;
    computeNormalPipeline!: GPUComputePipeline;
    computeBindGroup!: GPUBindGroup;
    computeNormalBindGroup!: GPUBindGroup;
    computeSpringPipeline!: GPUComputePipeline;
    computeSpringBindGroup!: GPUBindGroup;
    computeNodeForcePipeline !: GPUComputePipeline;
    computeNodeForceBindGroup !: GPUBindGroup;
    computeNodeForceInitPipeline!: GPUComputePipeline;
    computeIntersectionSummationPipeline !: GPUComputePipeline;
    computeIntersectionBindGroup2 !: GPUBindGroup;
    computeIntersectionPipeline !: GPUComputePipeline;
    computeIntersectionBindGroup !: GPUBindGroup;
    computeNormalSummationPipeline!: GPUComputePipeline;
    computeNormalSummationBindGroup!: GPUBindGroup;
    renderPassDescriptor!: GPURenderPassDescriptor;

    async init() {
        await super.init();
        await this.createAssets();
        await this.MakeModelData();
    }

    async createAssets() {
        const assets1 = await this.createTextureFromImage("../scenes/white.png", this.device);
        //this.texture = assets1.texture;
        this.sampler = assets1.sampler;
        this.view = assets1.view;

        //const assets2 = await this.createTextureFromImage("../scenes/metal.jpg", this.device);
        //this.textureObject = assets2.texture;
        //this.samplerObject = assets2.sampler;
        //this.viewObject = assets2.view;
    }

    async createTextureFromImage(src: string, device: GPUDevice): Promise<{ texture: GPUTexture, sampler: GPUSampler, view: GPUTextureView }> {
        const response: Response = await fetch(src);
        const blob: Blob = await response.blob();
        const imageData: ImageBitmap = await createImageBitmap(blob);

        const texture = await this.loadImageBitmap(device, imageData);

        const view = texture.createView({
            format: "rgba8unorm",
            dimension: "2d",
            aspect: "all",
            baseMipLevel: 0,
            mipLevelCount: 1,
            baseArrayLayer: 0,
            arrayLayerCount: 1
        });

        const sampler = device.createSampler({
            addressModeU: "repeat",
            addressModeV: "repeat",
            magFilter: "linear",
            minFilter: "nearest",
            mipmapFilter: "nearest",
            maxAnisotropy: 1
        });

        return { texture, sampler, view };
    }
    async loadImageBitmap(device: GPUDevice, imageData: ImageBitmap): Promise<GPUTexture> {

        const textureDescriptor: GPUTextureDescriptor = {
            size: {
                width: imageData.width,
                height: imageData.height
            },
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        };

        const texture = device.createTexture(textureDescriptor);

        device.queue.copyExternalImageToTexture(
            { source: imageData },
            { texture: texture },
            { width: imageData.width, height: imageData.height },
        );

        return texture;
    }

    async MakeClothData() {
        // Load obj model
        const loader = new ObjLoader();
        this.cloth = await loader.load('../scenes/Tshirt_high.obj', 1);
        //this.cloth = await loader.load('../scenes/skirt.obj', 3.0);
        console.log("cloth obj file load end");
        console.log(this.cloth);
        // extract vertex, indices, normal, uv data...
        var vertArray = new Float32Array(this.cloth.vertices);
        var indArray = new Uint32Array(this.cloth.indices);
        var normalArray = new Float32Array(this.cloth.normals);
        var uvArray = new Float32Array(this.cloth.uvs);
        var pureFaces = new Uint32Array(this.cloth.pureFaces);
        const numTriangleData = new Uint32Array([this.cloth.indices.length / 3]);

        // obj cloth to particle
        this.uv = uvArray;
        this.particles = [];
        this.triangles = [];
        this.numParticles = 0;
        this.maxTriangleConnected = 0;
        this.springs = [];
        this.maxSpringConnected = 0;
        
        // each vertex is treated as a particle
        for (let i = 0; i < this.cloth.pureVertices.length; i ++) {
            const pos = vec3.fromValues(this.cloth.pureVertices[i][0], this.cloth.pureVertices[i][1], this.cloth.pureVertices[i][2]);
            const vel = vec3.fromValues(0, 0, 0);
            const node = new Node(pos, vel);
            this.particles.push(node);
        }
        // initialize triangles and normals
        this.normals = new Array(this.particles.length);
        this.normals.fill(vec3.create());
        let indicesArray: number[] = [];
        //直接用obj里面的vertex normal
        for (let i = 0; i < pureFaces.length; i += 3) {
            const [i1, i2, i3] = [pureFaces[i], pureFaces[i + 1], pureFaces[i + 2]];
            // Create triangles for structural connections
            const triangle = new Triangle(i1, i2, i3);
            this.triangles.push(triangle);
            // Associate triangles with particles
            this.particles[i1].triangles.push(triangle);
            this.particles[i2].triangles.push(triangle);
            this.particles[i3].triangles.push(triangle);
            indicesArray.push(i1, i2, i3);
            // Calculate normal for each triangle and accumulate it for each vertex
            const v0 = this.particles[i1].position;
            const v1 = this.particles[i2].position;
            const v2 = this.particles[i3].position;
            const normal = calculateNormal(v0, v1, v2);

            vec3.add(this.normals[i1], this.normals[i1], normal);
            vec3.add(this.normals[i2], this.normals[i2], normal);
            vec3.add(this.normals[i3], this.normals[i3], normal);
        }
        // Normalize the normals for all particles
        this.normals.forEach(normal => {
            vec3.normalize(normal, normal);
        });
        console.log("display normals ", this.normals);
        // [Debug]: Create Springs and store uv, indices, normals for rendering
        // create springs between adjacent particles based on triangles
        this.triangles.forEach(triangle => {
            const [p1, p2, p3] = [this.particles[triangle.v1], this.particles[triangle.v2], this.particles[triangle.v3]];
            
            // Create springs between each edge in the triangle
            const sp1 = new Spring(
                p1, p2, this.structuralKs, this.kD, "structural", triangle.v1, triangle.v2
            );
            sp1.targetIndex1 = this.particles[sp1.index1].springs.length;
            sp1.targetIndex2 = this.particles[sp1.index2].springs.length;
            this.springs.push(sp1);
            this.particles[sp1.index1].springs.push(sp1);
            this.particles[sp1.index2].springs.push(sp1);

            const sp2 = new Spring(
                p2, p3, this.structuralKs, this.kD, "structural", triangle.v2, triangle.v3
            );
            sp2.targetIndex1 = this.particles[sp2.index1].springs.length;
            sp2.targetIndex2 = this.particles[sp2.index2].springs.length;
            this.springs.push(sp2);
            this.particles[sp2.index1].springs.push(sp2);
            this.particles[sp2.index2].springs.push(sp2);

            const sp3 = new Spring(
                p3, p1, this.structuralKs, this.kD, "structural", triangle.v3, triangle.v1
            );
            sp3.targetIndex1 = this.particles[sp3.index1].springs.length;
            sp3.targetIndex2 = this.particles[sp3.index2].springs.length;
            this.springs.push(sp3);
            this.particles[sp3.index1].springs.push(sp3);
            this.particles[sp3.index2].springs.push(sp3);
        });
        // store indicis, and normal for rendering
        this.triangleIndices = new Uint32Array(indicesArray);
        this.numParticles = this.particles.length;
        console.log("OBJ cloth data loaded as particles with: " + this.numParticles + "particles.");

        // [DEBUG!] check the triangle numbers in each particle[i]
        for (let i = 0; i < this.particles.length; i++) {
            let nConnectedTriangle = this.particles[i].triangles.length;
            console.log("numbers of current connected triangles: " + nConnectedTriangle);
            this.maxTriangleConnected = Math.max(this.maxTriangleConnected, nConnectedTriangle);
        }
        console.log("maxTriangleConnetced : #", this.maxTriangleConnected);

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

    async MakeModelData() {
        const loader = new ObjLoader();
        //this.model = await loader.load('../scenes/dragon2.obj', 0.1);
        //this.model = await loader.load('../scenes/dress-v5k-f10k-v2.obj', 2.0);
        this.model = await loader.load('../scenes/human_noArm.obj', 1);
        //this.model = await loader.load('../scenes/skirt.obj', 2.0);
        console.log("model obj file load end");
        console.log(this.model);

        var vertArray = new Float32Array(this.model.vertices);
        var indArray = new Uint32Array(this.model.indices);
        var normalArray = new Float32Array(this.model.normals);
        var uvArray = new Float32Array(this.model.uvs);
        this.objectIndicesLength = this.model.indices.length;

        console.log("this object's indices length: " + this.objectIndicesLength / 3);

        this.ObjectPosBuffer = makeFloat32ArrayBufferStorage(this.device, vertArray);
        this.objectIndexBuffer = makeUInt32IndexArrayBuffer(this.device, indArray);
        this.objectUVBuffer = makeFloat32ArrayBufferStorage(this.device, uvArray);
        this.objectNormalBuffer = makeFloat32ArrayBufferStorage(this.device, normalArray);

        /*
        // Create and load a texture
        const imageLoader = new ImageLoader(this.device);
        const texture = await imageLoader.loadImage('../textures/basecolor.jpg');
        const sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat',
        });
        */
        const numTriangleData = new Uint32Array([this.model.indices.length / 3]);
        this.objectNumTriangleBuffer = this.device.createBuffer({
            size: numTriangleData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Uint32Array(this.objectNumTriangleBuffer.getMappedRange()).set(numTriangleData);
        this.objectNumTriangleBuffer.unmap();

        const shaderModule = this.device.createShaderModule({ code: this.objectShader.getMoveShader() });
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0, },
                },
            ]
        });

        const computePipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
        this.computeObjectMovePipeline = this.device.createComputePipeline({
            layout: computePipelineLayout,
            compute: {
                module: shaderModule,
                entryPoint: 'main',
            },
        });
        this.computeObjectMoveBindGroup = this.device.createBindGroup({
            layout: bindGroupLayout, // The layout created earlier
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.ObjectPosBuffer }
                },
            ]
        });



        const materialShaderModule = this.device.createShaderModule({ code: this.objectShader.getMaterialShader() });
        const bindGroupLayout2 = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {}
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'uniform',
                    }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'uniform',
                    }
                },
            ]
        });

        this.camPosBuffer = this.device.createBuffer({
            size: 4 * Float32Array.BYTES_PER_ELEMENT, // vec3<f32> + padding
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.lightDataBuffer = this.device.createBuffer({
            size: 48, // vec3 position (12 bytes) + padding (4 bytes) + vec4 color (16 bytes) + intensity (4 bytes)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.mvpUniformBuffer = this.device.createBuffer({
            size: 64 * 3, // The total size needed for the matrices
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST // The buffer is used as a uniform and can be copied to
        });

        this.objRenderBindGroup = this.device.createBindGroup({
            layout: bindGroupLayout2,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.mvpUniformBuffer
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.camPosBuffer
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.lightDataBuffer
                    }
                }
            ]
        });

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout2],
        });

        this.objRenderPipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: materialShaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 12,
                    attributes: [
                        {
                            shaderLocation: 0,
                            format: "float32x3",
                            offset: 0
                        }
                    ]
                },
                {
                    arrayStride: 8,
                    attributes: [
                        {
                            shaderLocation: 1,
                            format: "float32x2",
                            offset: 0
                        }
                    ]
                },
                {
                    arrayStride: 12,
                    attributes: [
                        {
                            shaderLocation: 2,
                            format: "float32x3",
                            offset: 0
                        }
                    ]
                }
                ],
            },
            fragment: {
                module: materialShaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: this.format, blend: {
                        color: {
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add",
                        },
                        alpha: {
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add",
                        },
                    },
                }],
            },
            primitive: {
                topology: 'triangle-list',
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth32float',
            },
            multisample: {
                count: this.sampleCount,
            },
        });
    }

    //three types of springs connecting all particles: structural, shear and flexion
    async createClothInfo(x: number, y: number, structuralKs: number, shearKs: number, bendKs: number, kd: number){
        this.N = x;
        this.M = y;
        this.structuralKs = structuralKs;
        this.shearKs = shearKs;
        this.bendKs = bendKs;
        this.kD = kd;

        //this.createParticles();
        //this.createSprings();
        await this.MakeClothData();
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
            //console.log("numbers of current connected springs: " + nConnectedSpring);
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
        //[TODO]: Only for testing maybe be modified later
        this.uvIndices = [];
        this.particles = [];
        this.triangles = [];
        this.numParticles = 0;
        this.maxTriangleConnected = 0;
        this.springs = [];
        this.maxSpringConnected = 0;
        

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
        console.log(this.particles);
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
            console.log("numbers of current connected triangles: " + nConnectedTriangle);
            this.maxTriangleConnected = Math.max(this.maxTriangleConnected, nConnectedTriangle);
        }
        console.log("maxTriangleConnetced : #", this.maxTriangleConnected);
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

    createRenderPipeline(){
        const particleShaderModule = this.device.createShaderModule({ code: this.particleShader.getParticleShader() });
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0, // The binding number in the shader
                    visibility: GPUShaderStage.VERTEX, // Accessible from the vertex shader
                    buffer: {} // Specifies that this binding will be a buffer
                }
            ]
        });

        // Create a uniform buffer for the MVP matrix. The size is 64 bytes * 3, assuming
        // you're storing three 4x4 matrices (model, view, projection) as 32-bit floats.
        // This buffer will be updated with the MVP matrix before each render.


        // Create a bind group that binds the previously created uniform buffer to the shader.
        // This allows your shader to access the buffer as defined in the bind group layout.
        this.renderBindGroup = this.device.createBindGroup({
            layout: bindGroupLayout, // The layout created earlier
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.mvpUniformBuffer
                    }
                }
            ]
        });

        // Create a pipeline layout that includes the bind group layouts.
        // This layout is necessary for the render pipeline to know how resources are structured.
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout], // Include the bind group layout created above
        });

        this.particlePipeline = this.device.createRenderPipeline({
            layout: pipelineLayout, // Simplified layout, assuming no complex bindings needed
            vertex: {
                module: particleShaderModule,
                entryPoint: 'vs_main', // Ensure your shader has appropriate entry points
                buffers: [{
                    arrayStride: 12, // Assuming each particle position is a vec3<f32>
                    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
                }
                ],
            },
            fragment: {
                module: particleShaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: this.format, blend: {
                        color: {
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add",
                        },
                        alpha: {
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add",
                        },
                    },
                }],
            },
            primitive: {
                topology: 'point-list', // Render particles as points
            },
            // Include depthStencil state if depth testing is required
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth32float',
            },
            multisample: {
                count: this.sampleCount,
            },
        });
        console.log("create render pipeline success");
    }

    createSpringPipeline(){
        const springShaderModule = this.device.createShaderModule({ code: this.particleShader.getSpringShader() });
        // Assuming bindGroupLayout and pipelineLayout are similar to createParticlePipeline
        // You may reuse the same layout if it fits your needs

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0, // The binding number in the shader
                    visibility: GPUShaderStage.VERTEX, // Accessible from the vertex shader
                    buffer: {} // Specifies that this binding will be a buffer
                }
            ]
        });

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout], // Include the bind group layout created above
        });

        this.springPipeline = this.device.createRenderPipeline({
            layout: pipelineLayout, // Reuse or create as needed
            vertex: {
                module: springShaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 12, // vec3<f32> for spring start and end positions
                    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
                }],
            },
            fragment: {
                module: springShaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: this.format, blend: {
                        color: {
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add",
                        },
                        alpha: {
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add",
                        },
                    },
                }],
            },
            primitive: {
                topology: 'line-list',
                // Additional configurations as needed
            },
            // Reuse depthStencil configuration
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth32float',
            },
            multisample: {
                count: this.sampleCount,
            },
        });
        console.log("spring render pipeline create successfully");
    }

    createTrianglePipeline(){
        const textureShaderModule = this.device.createShaderModule({ code: this.particleShader.getTextureShader() });
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {}
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {}
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'uniform',
                    }
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'uniform',
                    }
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'uniform',
                    }
                },
            ]
        });

        const alphaData = new Float32Array([1.0]);
        this.alphaValueBuffer = this.device.createBuffer({
            size: alphaData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.alphaValueBuffer.getMappedRange()).set(alphaData);
        this.alphaValueBuffer.unmap();

        this.triangleBindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.mvpUniformBuffer
                    }
                },
                {
                    binding: 1,
                    resource: this.view
                },
                {
                    binding: 2,
                    resource: this.sampler
                },
                {
                    binding: 3,
                    resource: {
                        buffer: this.camPosBuffer
                    }
                },
                {
                    binding: 4,
                    resource: {
                        buffer: this.lightDataBuffer
                    }
                },
                {
                    binding: 5,
                    resource: {
                        buffer: this.alphaValueBuffer
                    }
                }
            ]
        });

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });

        this.trianglePipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: textureShaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 12,
                    attributes: [
                        {
                            shaderLocation: 0,
                            format: "float32x3",
                            offset: 0
                        }
                    ]
                },
                {
                    arrayStride: 8,
                    attributes: [
                        {
                            shaderLocation: 1,
                            format: "float32x2",
                            offset: 0
                        }
                    ]
                },
                {
                    arrayStride: 12,
                    attributes: [
                        {
                            shaderLocation: 2,
                            format: "float32x2",
                            offset: 0
                        }
                    ]
                }
                ],
            },
            fragment: {
                module: textureShaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: this.format, blend: {
                        color: {
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add",
                        },
                        alpha: {
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add",
                        },
                    },
                }],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none',
                //topology: 'line-list',
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth32float',
            },
            multisample: {
                count: this.sampleCount,
            },
        });
        console.log("create triangle pipeline sucessfully");
    }

    createParticlePipeline() {
        const computeShaderModule = this.device.createShaderModule({ code: this.particleShader.getComputeShader() });

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
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                        minBindingSize: 0, // or specify the actual size
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                        minBindingSize: 0, // or specify the actual size
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                        minBindingSize: 0, // or specify the actual size
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                        minBindingSize: 0, // or specify the actual size
                    },
                },
                {
                    binding: 5, // This matches @group(0) @binding(5) in the WGSL shader
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'uniform',
                        minBindingSize: 0, // Specify the size of vec3<f32>
                    },
                },
            ],
        });

        const initialExternalForce = new Float32Array([0.0, 0.0, 0.0]);

        // externalForceBuffer 
        this.externalForceBuffer = this.device.createBuffer({
            size: initialExternalForce.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.externalForceBuffer.getMappedRange()).set(initialExternalForce);
        this.externalForceBuffer.unmap();

        // Use the bind group layout to create a pipeline layout
        const computePipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        const computePipeline = this.device.createComputePipeline({
            layout: computePipelineLayout,
            compute: {
                module: computeShaderModule,
                entryPoint: 'main',
            },
        });

        this.computePipeline = computePipeline;

        this.computeBindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
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
                        buffer: this.fixedBuffer,
                    },
                },
                {
                    binding: 3,
                    resource: {
                        buffer: this.forceBuffer,
                    },
                },
                {
                    binding: 4,
                    resource: {
                        buffer: this.prevPositionBuffer,
                    },
                },
                {
                    binding: 5,
                    resource: {
                        buffer: this.externalForceBuffer,
                    },
                },
            ],
        });
        console.log("create particle pipeline successfully");
    }

    createUpdateNormalPipeline() {
        const normalComputeShaderModule = this.device.createShaderModule({ code: this.normalShader.getNormalUpdateComputeShader() });
        {
            const bindGroupLayout = this.device.createBindGroupLayout({
                entries: [
                    {
                        binding: 0, // The binding number in the shader
                        visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                        buffer: { type: 'storage', minBindingSize: 0, },
                    },
                    {
                        binding: 1, // The binding number in the shader
                        visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                        buffer: { type: 'storage', minBindingSize: 0, },
                    },
                    {
                        binding: 2, // The binding number in the shader
                        visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                        buffer: { type: 'storage', minBindingSize: 0 }, // Ensure this matches the shader's expectation
                    },
                    {
                        binding: 3, // The binding number in the shader
                        visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                        buffer: { type: 'uniform', minBindingSize: 4 }, // Ensure this matches the shader's expectation
                    }
                ]
            });

            const computePipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

            this.computeNormalPipeline = this.device.createComputePipeline({
                layout: computePipelineLayout,
                compute: {
                    module: normalComputeShaderModule,
                    entryPoint: 'main',
                },
            });

            const numTriangleData = new Uint32Array([this.triangles.length]);
            this.numTriangleBuffer = this.device.createBuffer({
                size: numTriangleData.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });
            new Uint32Array(this.numTriangleBuffer.getMappedRange()).set(numTriangleData);
            this.numTriangleBuffer.unmap();

            this.computeNormalBindGroup = this.device.createBindGroup({
                layout: bindGroupLayout, // The layout created earlier
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.positionBuffer
                        }
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this.triangleCalculationBuffer
                        }
                    },
                    {
                        binding: 2,
                        resource: {
                            buffer: this.tempTriangleNormalBuffer
                        }
                    },
                    {
                        binding: 3,
                        resource: {
                            buffer: this.numTriangleBuffer
                        }
                    }
                ]
            });
        }
        const normalSummationComputeShaderModule = this.device.createShaderModule({ code: this.normalShader.getNormalSummationComputeShader() });
        {
            const bindGroupLayout = this.device.createBindGroupLayout({
                entries: [
                    {
                        binding: 0, // The binding number in the shader
                        visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                        buffer: { type: 'storage', minBindingSize: 0, },
                    },
                    {
                        binding: 1, // The binding number in the shader
                        visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                        buffer: { type: 'storage', minBindingSize: 0, },
                    },
                    {
                        binding: 2, // The binding number in the shader
                        visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                        buffer: { type: 'uniform', minBindingSize: 4 }, // Ensure this matches the shader's expectation
                    },
                    {
                        binding: 3, // The binding number in the shader
                        visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                        buffer: { type: 'uniform', minBindingSize: 4 }, // Ensure this matches the shader's expectation
                    }
                ]
            });

            const computePipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

            this.computeNormalSummationPipeline = this.device.createComputePipeline({
                layout: computePipelineLayout,
                compute: {
                    module: normalSummationComputeShaderModule,
                    entryPoint: 'main',
                },
            });

            const maxConnectedTriangleData = new Uint32Array([this.maxTriangleConnected]);
            this.maxConnectedTriangleBuffer = this.device.createBuffer({
                size: maxConnectedTriangleData.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });
            new Uint32Array(this.maxConnectedTriangleBuffer.getMappedRange()).set(maxConnectedTriangleData);
            this.maxConnectedTriangleBuffer.unmap();

            this.computeNormalSummationBindGroup = this.device.createBindGroup({
                layout: bindGroupLayout, // The layout created earlier
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.tempTriangleNormalBuffer
                        }
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this.vertexNormalBuffer
                        }
                    },
                    {
                        binding: 2,
                        resource: {
                            buffer: this.maxConnectedTriangleBuffer
                        }
                    },
                    {
                        binding: 3,
                        resource: {
                            buffer: this.numParticlesBuffer
                        }
                    }
                ]
            });
        }
        console.log("create normal pipeline successfully");
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

    createSpringForceComputePipeline() {

        const springComputeShaderModule = this.device.createShaderModule({ code: this.springShader.getSpringUpdateShader() });

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0, },
                },
                {
                    binding: 1, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0, },
                },
                {
                    binding: 2, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: {
                        type: 'read-only-storage',
                        minBindingSize: 0, // or specify the actual size
                    },
                },
                {
                    binding: 3, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'uniform', minBindingSize: 4 }, // Ensure this matches the shader's expectation
                },
                {
                    binding: 4, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0, },
                },
                {
                    binding: 5, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'uniform', minBindingSize: 4 }, // Ensure this matches the shader's expectation
                }
            ]
        });

        const computePipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        this.computeSpringPipeline = this.device.createComputePipeline({
            layout: computePipelineLayout,
            compute: {
                module: springComputeShaderModule,
                entryPoint: 'main',
            },
        });

        const numSpringsData = new Uint32Array([this.springs.length]);
        this.numSpringsBuffer = this.device.createBuffer({
            size: numSpringsData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Uint32Array(this.numSpringsBuffer.getMappedRange()).set(numSpringsData);
        this.numSpringsBuffer.unmap();

        this.computeSpringBindGroup = this.device.createBindGroup({
            layout: bindGroupLayout, // The layout created earlier
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.positionBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.velocityBuffer }
                },
                {
                    binding: 2,
                    resource: { buffer: this.springCalculationBuffer }
                },
                {
                    binding: 3,
                    resource: { buffer: this.numSpringsBuffer }
                },
                {
                    binding: 4,
                    resource: { buffer: this.tempSpringForceBuffer }
                },
                {
                    binding: 5,
                    resource: { buffer: this.numParticlesBuffer }
                }
            ]
        });
        console.log("create spring force pipeline successfully");
    }

    createNodeForceSummationPipeline() {
        const nodeForceComputeShaderModule = this.device.createShaderModule({ code: this.springShader.getNodeForceShader() });
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0, },
                },
                {
                    binding: 1, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0, },
                },
                {
                    binding: 2, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'uniform', minBindingSize: 4 }, // Ensure this matches the shader's expectation
                },
            ]
        });
        {   /*  Node Force Merge Equation */

            const computePipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

            this.computeNodeForcePipeline = this.device.createComputePipeline({
                layout: computePipelineLayout,
                compute: {
                    module: nodeForceComputeShaderModule,
                    entryPoint: 'main',
                },
            });
            this.computeNodeForceBindGroup = this.device.createBindGroup({
                layout: bindGroupLayout, // The layout created earlier
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.tempSpringForceBuffer
                        }
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this.forceBuffer
                        }
                    },
                    {
                        binding: 2,
                        resource: {
                            buffer: this.numParticlesBuffer
                        }
                    }
                ]
            });
        }
        {
            const computePipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

            this.computeNodeForceInitPipeline = this.device.createComputePipeline({
                layout: computePipelineLayout,
                compute: {
                    module: nodeForceComputeShaderModule,
                    entryPoint: 'initialize',
                },
            });
        }
        console.log("create node force pipeline successfully");
    }

    createIntersectionPipeline() {
        const intersectionComputeShaderModule = this.device.createShaderModule({ code: this.interesectionShader.getIntersectionShader() });

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0, },
                },
                {
                    binding: 1, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0, },
                },
                {
                    binding: 2, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: {
                        type: 'storage',
                        minBindingSize: 0, // or specify the actual size
                    },
                },
                {
                    binding: 3, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0 }, // Ensure this matches the shader's expectation
                },
                {
                    binding: 4, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'uniform', minBindingSize: 4, },
                },
                {
                    binding: 5, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'uniform', minBindingSize: 4 }, // Ensure this matches the shader's expectation
                },
                {
                    binding: 6, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0 }, // Ensure this matches the shader's expectation
                },
                {
                    binding: 7, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0 }, // Ensure this matches the shader's expectation
                },
                {
                    binding: 8, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0 }, // Ensure this matches the shader's expectation
                },
                {
                    binding: 9, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0 }, // Ensure this matches the shader's expectation
                },
            ]
        });

        const computePipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        this.computeIntersectionSummationPipeline = this.device.createComputePipeline({
            layout: computePipelineLayout,
            compute: {
                module: intersectionComputeShaderModule,
                entryPoint: 'response',
            },
        });

        this.computeIntersectionBindGroup2 = this.device.createBindGroup({
            layout: bindGroupLayout, // The layout created earlier
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.positionBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.velocityBuffer }
                },
                {
                    binding: 2,
                    resource: { buffer: this.ObjectPosBuffer }
                },
                {
                    binding: 3,
                    resource: { buffer: this.objectIndexBuffer }
                },
                {
                    binding: 4,
                    resource: { buffer: this.numParticlesBuffer }
                },
                {
                    binding: 5,
                    resource: { buffer: this.objectNumTriangleBuffer }
                },
                {
                    binding: 6,
                    resource: { buffer: this.collisionTempBuffer }
                },
                {
                    binding: 7,
                    resource: { buffer: this.fixedBuffer }
                },
                {
                    binding: 8,
                    resource: { buffer: this.collisionCountTempBuffer }
                },
                {
                    binding: 9,
                    resource: { buffer: this.prevPositionBuffer }
                },
            ]
        });
        console.log("create intersection successfully");
    }

    createTriTriIntersectionPipeline() {
        const intersectionComputeShaderModule = this.device.createShaderModule({ code: this.interesectionShader.getTriTriIntersectionShader() });

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0, },
                },
                {
                    binding: 1, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0, },
                },
                {
                    binding: 2, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: {
                        type: 'storage',
                        minBindingSize: 0, // or specify the actual size
                    },
                },
                {
                    binding: 3, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0 }, // Ensure this matches the shader's expectation
                },
                {
                    binding: 4, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'uniform', minBindingSize: 4, },
                },
                {
                    binding: 5, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'uniform', minBindingSize: 4 }, // Ensure this matches the shader's expectation
                },
                {
                    binding: 6, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0 }, // Ensure this matches the shader's expectation
                },
                {
                    binding: 7, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0 }, // Ensure this matches the shader's expectation
                },
                {
                    binding: 8, // The binding number in the shader
                    visibility: GPUShaderStage.COMPUTE, // Accessible from the vertex shader
                    buffer: { type: 'storage', minBindingSize: 0 }, // Ensure this matches the shader's expectation
                },
            ]
        });

        const computePipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
        this.computeIntersectionPipeline = this.device.createComputePipeline({
            layout: computePipelineLayout,
            compute: {
                module: intersectionComputeShaderModule,
                entryPoint: 'main',
            },
        });

        this.computeIntersectionBindGroup = this.device.createBindGroup({
            layout: bindGroupLayout, // The layout created earlier
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.positionBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.triangleRenderBuffer }
                },
                {
                    binding: 2,
                    resource: { buffer: this.ObjectPosBuffer }
                },
                {
                    binding: 3,
                    resource: { buffer: this.objectIndexBuffer }
                },
                {
                    binding: 4,
                    resource: { buffer: this.numTriangleBuffer }
                },
                {
                    binding: 5,
                    resource: { buffer: this.objectNumTriangleBuffer }
                },
                {
                    binding: 6,
                    resource: { buffer: this.collisionTempBuffer }
                },
                {
                    binding: 7,
                    resource: { buffer: this.collisionCountTempBuffer }
                },
                {
                    binding: 8,
                    resource: { buffer: this.velocityBuffer }
                },
            ]
        });
        console.log("create TriTrieIntersection successully");
    }

    async render() {
        const currentTime = performance.now();

        this.setCamera(this.camera);
        this.makeRenderpassDescriptor();

        const commandEncoder = this.device.createCommandEncoder();

        if (this.renderOptions.wind) {
            const newExternalForce = new Float32Array([0.0, 0.0, 20.0]);
            this.device.queue.writeBuffer(
                this.externalForceBuffer,
                0, // Buffer 
                newExternalForce.buffer, // 
                newExternalForce.byteOffset,
                newExternalForce.byteLength
            );
        }

        //compute pass
        this.updateObjects(commandEncoder);
        this.InitNodeForce(commandEncoder);
        this.updateSprings(commandEncoder);
        this.summationNodeForce(commandEncoder);
        this.Intersections(commandEncoder);


        this.updateParticles(commandEncoder);
        this.updateNormals(commandEncoder);
        //render pass
        this.renderCloth(commandEncoder);

        this.device.queue.submit([commandEncoder.finish()]);
        await this.device.queue.onSubmittedWorkDone();

        //this.stats.ms = (currentTime - this.lastTime).toFixed(2);
        //this.stats.fps = Math.round(1000.0 / (currentTime - this.lastTime));

        this.lastTime = currentTime;
        this.localFrameCount++;
    }

    renderCloth(commandEncoder: GPUCommandEncoder) {
        const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);

        this.device.queue.writeBuffer(
            this.camPosBuffer,
            0,
            new Float32Array([...this.camera.position, 1.0]) // vec3 + padding
        );

        let lightData = [this.light_position[0], this.light_position[1], this.light_position[2], 0.0, this.light_color[0], this.light_color[1], this.light_color[2], 1.0, this.light_intensity, this.specular_strength, this.shininess, 0.0];
        this.device.queue.writeBuffer(this.lightDataBuffer, 0, new Float32Array(lightData));

        if (this.renderOptions.renderObject) {
            passEncoder.setPipeline(this.objRenderPipeline);
            passEncoder.setVertexBuffer(0, this.ObjectPosBuffer); 
            passEncoder.setVertexBuffer(1, this.objectUVBuffer); 
            passEncoder.setVertexBuffer(2, this.objectNormalBuffer); 
            passEncoder.setIndexBuffer(this.objectIndexBuffer, 'uint32'); 
            passEncoder.setBindGroup(0, this.objRenderBindGroup); // Set the bind group with MVP matrix
            passEncoder.drawIndexed(this.objectIndicesLength);
        }

        if (this.renderOptions.wireFrame) {
            passEncoder.setPipeline(this.springPipeline);
            passEncoder.setVertexBuffer(0, this.positionBuffer); 
            passEncoder.setIndexBuffer(this.springRenderBuffer, 'uint32'); 
            passEncoder.setBindGroup(0, this.renderBindGroup); // Set the bind group with MVP matrix
            passEncoder.drawIndexed(this.springIndices.length);

            passEncoder.setPipeline(this.particlePipeline); // Your render pipeline        
            passEncoder.setVertexBuffer(0, this.positionBuffer); // Set the vertex buffer                
            passEncoder.setBindGroup(0, this.renderBindGroup); // Set the bind group with MVP matrix
            passEncoder.draw(this.N * this.M); // Draw the cube using the index count
        }
        else {
            passEncoder.setPipeline(this.trianglePipeline);
            passEncoder.setVertexBuffer(0, this.positionBuffer); 
            passEncoder.setVertexBuffer(1, this.uvBuffer); 
            passEncoder.setVertexBuffer(2, this.vertexNormalBuffer);
            passEncoder.setIndexBuffer(this.triangleRenderBuffer, 'uint32'); 
            passEncoder.setBindGroup(0, this.triangleBindGroup); // Set the bind group with MVP matrix
            passEncoder.drawIndexed(this.triangleIndices.length);
        }

        // if(this.renderOptions.wind){
        //     passEncoder.setPipeline(this.particlePipeline); // Your render pipeline        
        //     passEncoder.setVertexBuffer(0, this.positionBuffer); // Set the vertex buffer                
        //     passEncoder.setBindGroup(0, this.renderBindGroup); // Set the bind group with MVP matrix
        //     passEncoder.draw(this.N * this.M); // Draw the cube using the index count
        // }

        passEncoder.end();
    }

    makeRenderpassDescriptor() {
        this.renderPassDescriptor = {
            colorAttachments: [{
                view: this.resolveTexture.createView(),
                resolveTarget: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.25, g: 0.25, b: 0.25, a: 1.0 }, // Background color
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: { // Add this attachment for depth testing
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };
    }

    updateObjects(commandEncoder: GPUCommandEncoder) {
        if (this.renderOptions.moveObject) {
            const computePass = commandEncoder.beginComputePass();
            computePass.setPipeline(this.computeObjectMovePipeline);
            computePass.setBindGroup(0, this.computeObjectMoveBindGroup);
            computePass.dispatchWorkgroups(Math.ceil(this.model.vertices.length / 256.0) + 1, 1, 1);
            computePass.end();
        }
    }

    updateSprings(commandEncoder: GPUCommandEncoder) {
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computeSpringPipeline);
        computePass.setBindGroup(0, this.computeSpringBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.springs.length / 256.0) + 1, 1, 1);
        computePass.end();
    }

    summationNodeForce(commandEncoder: GPUCommandEncoder) {
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computeNodeForcePipeline);
        computePass.setBindGroup(0, this.computeNodeForceBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.numParticles / 256.0) + 1, 1, 1);
        computePass.end();
    }

    InitNodeForce(commandEncoder: GPUCommandEncoder) {
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computeNodeForceInitPipeline);
        computePass.setBindGroup(0, this.computeNodeForceBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.numParticles / 256.0) + 1, 1, 1);
        computePass.end();
    }

    Intersections(commandEncoder: GPUCommandEncoder) {
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computeIntersectionPipeline);
        computePass.setBindGroup(0, this.computeIntersectionBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.triangleIndices.length / 16.0) + 1, (this.objectIndicesLength / 3) / 16.0 + 1, 1);
        computePass.end();


        if (this.localFrameCount % 50 === 0) {
            this.readBackPositionBuffer();
        }

        const computePass2 = commandEncoder.beginComputePass();
        computePass2.setPipeline(this.computeIntersectionSummationPipeline);
        computePass2.setBindGroup(0, this.computeIntersectionBindGroup2);
        computePass2.dispatchWorkgroups(Math.ceil(this.numParticles / 256.0) + 1, 1, 1);
        computePass2.end();
    }

    async readBackPositionBuffer() {
        var target = this.collisionTempBuffer;

        // Create a GPUBuffer for reading back the data
        const readBackBuffer = this.device.createBuffer({
            size: target.size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        // Create a command encoder and copy the position buffer to the readback buffer
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(target, 0, readBackBuffer, 0, target.size);

        // Submit the command to the GPU queue
        const commands = commandEncoder.finish();
        this.device.queue.submit([commands]);

        // Map the readback buffer for reading and read its contents
        await readBackBuffer.mapAsync(GPUMapMode.READ);
        const arrayBuffer = readBackBuffer.getMappedRange(0, target.size);
        const data = new Int32Array(arrayBuffer);
        // console.log("----");
        for (let i = 0; i < data.length; i += 3) {
            if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) { continue; }
            console.log('[', i / 3, ']vec3 Array:', [data[i], data[i + 1], data[i + 2]]);
        }

        // for (let i = 0; i < data.length; i += 1) {            
        //     //if(data[i]===0 && data[i+1]===0 && data[i+2]===0){continue;}
        //     console.log('[', i, '] Array:', data[i]);
        // }

        // var res = JSON.stringify(data, undefined);
        // console.log(res);

        // Cleanup
        readBackBuffer.unmap();
        readBackBuffer.destroy();
    }

    updateParticles(commandEncoder: GPUCommandEncoder) {
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.numParticles / 256.0) + 1, 1, 1);
        computePass.end();
    }

    updateNormals(commandEncoder: GPUCommandEncoder) {
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computeNormalPipeline);
        computePass.setBindGroup(0, this.computeNormalBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.triangles.length / 256.0) + 1, 1, 1);
        computePass.end();

        const computePass2 = commandEncoder.beginComputePass();
        computePass2.setPipeline(this.computeNormalSummationPipeline);
        computePass2.setBindGroup(0, this.computeNormalSummationBindGroup);
        computePass2.dispatchWorkgroups(Math.ceil(this.numParticles / 256.0) + 1, 1, 1);
        computePass2.end();
    }

    async createRenderPipelineObj(){
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

    async renderCloth1(){
        this.renderpass.setPipeline(this.renderPipeline);
        this.renderpass.setVertexBuffer(0, this.objectPosBuffer);
        this.renderpass.setIndexBuffer(this.objectIndexBuffer, "uint32");
        this.renderpass.setBindGroup(0, this.mvpBindGroup);
        this.renderpass.drawIndexed(this.indexCount);
        this.renderpass.end();
        this.device.queue.submit([this.commandEncoder.finish()]);
    }

    async initializeClothSimulation(clothSizeX: number, clothSizeY: number, structuralKs: number, shearKs: number, bendKs: number, kd: number) {
        //structuralKs: number = 5000.0, shearKs: number = 2000.0, bendKs: number = 500.0, kd: number = 0.25
        //await this.createClothInfo(clothSizeX, clothSizeY,  555000.0, 545000.0, 550000.0, 1000);
        await this.createClothInfo(clothSizeX, clothSizeY, structuralKs, shearKs, bendKs, kd);
        this.createClothBuffers();
        this.createRenderPipeline();
        this.createSpringPipeline();
        this.createTrianglePipeline();
        this.createParticlePipeline();
        this.createUpdateNormalPipeline();
        this.createSpringForceComputePipeline();
        this.createNodeForceSummationPipeline();
        this.createIntersectionPipeline();
        this.createTriTriIntersectionPipeline();
    }

    public beginRender() {
        const renderLoop = () => {
            this.statsOn();
            this.render();
            this.statsEnd();
            if(this.isRunning){
                requestAnimationFrame(renderLoop);
            }
        };
        renderLoop();
    }

    public async startClothSimulation() {
        const clothSize = this.getUserInputClothSize();
        await this.init();
        this.initializeClothSimulation(clothSize[0], clothSize[1]);
        this.beginRender();
    }
}