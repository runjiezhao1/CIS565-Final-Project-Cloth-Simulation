import { vec3 } from "wgpu-matrix";
import { parseOBJ } from "./utils";

export class ObjMesh {
    canvas : HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("canvas-webgpu");
    device: GPUDevice;
    vertexBuffer : GPUBuffer;
    indexBuffer : GPUBuffer;
    velocityBuffer : GPUBuffer;
    indexCount: number;
    verticesArr: Float32Array = new Float32Array();
    indicesArr : Uint32Array = new Uint32Array();
    velocityArr : Float32Array = new Float32Array();

    constructor(device: GPUDevice, vertices: Float32Array, indices: Uint32Array, velocities : Float32Array) {
        this.device = device;
        
        //create vertex buffer
        this.vertexBuffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();
        
        //create index buffer
        this.indexBuffer = device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
        });
        new Uint32Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();
        this.indexCount = indices.length;

        //create velocity buffer
        this.velocityBuffer = device.createBuffer({
            size: velocities.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
            });
        new Float32Array(this.velocityBuffer.getMappedRange()).set(velocities);
        this.velocityBuffer.unmap();
    }

    updateBuffer(vertices: Float32Array, indices: Uint32Array){
        this.verticesArr = vertices;
        this.indicesArr = indices;
        //这里这样做是因为需要对齐否则GPU会报错
        this.velocityArr = new Float32Array(vertices.length / 3 * 4).fill(2);
        console.log("vel arr", this.velocityArr);
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();
    
        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Uint32Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();
        this.indexCount = indices.length;

        this.velocityBuffer = this.device.createBuffer({
            size: vertices.length / 3 * 4 * Float32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        //this.device.queue.writeBuffer(this.velocityBuffer, 0, this.velocityArr);
        new Float32Array(this.velocityBuffer.getMappedRange()).set(this.velocityArr);
        this.velocityBuffer.unmap();
    }

    updatePD(deltaTime : number){
        var gravity = vec3.create(0,-0.00098,0);
        var tempVelocity = vec3.mulScalar(gravity, deltaTime);
        //for(){}
    }
}