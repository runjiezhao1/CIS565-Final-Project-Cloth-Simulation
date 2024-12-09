import { vec3 } from "wgpu-matrix";
import { parseOBJ } from "./utils";

export class ObjMesh {
    canvas : HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("canvas-webgpu");
    device: GPUDevice;
    vertexBuffer : GPUBuffer;
    indexBuffer : GPUBuffer;
    uvBuffer : GPUBuffer;
    indexCount: number = 0;

    constructor(device: GPUDevice, vertices: Float32Array, indices: Uint32Array, uvs : Float32Array) {
        this.device = device;
        this.vertexBuffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();
    
        this.indexBuffer = device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
        });
        new Uint32Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();

        this.uvBuffer = device.createBuffer({
            size: uvs.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.uvBuffer.getMappedRange()).set(uvs);
        this.uvBuffer.unmap();
    }

    updateBuffer(vertices: Float32Array, indices: Uint32Array, uvs: Float32Array){
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

        this.uvBuffer = this.device.createBuffer({
            size: uvs.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.uvBuffer.getMappedRange()).set(uvs);
        this.uvBuffer.unmap();
    }
}