import { vec3 } from "wgpu-matrix";

export class CubeMesh {
    canvas : HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("canvas-webgpu");

    buffer: GPUBuffer;
    bufferLayout: GPUVertexBufferLayout;
    device: GPUDevice;
    // x y z | r g b | weight | velocity
    vertices: Float32Array = new Float32Array(
        [
            -0.5, 0.5, 0, 1.0, 0.0, 0.0, 0.1, 0, 0, 0,
            0.5, 0.5, 0, 1.0, 0.0, 0.0, 0.1, 0, 0, 0,
            0.5, 1.5, 0, 1.0, 0.0, 0.0, 0.1, 0, 0, 0
        ]
    );

    constructor(device: GPUDevice) {
        this.device = device;
        const usage: GPUBufferUsageFlags = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
        //VERTEX: the buffer can be used as a vertex buffer

        const descriptor: GPUBufferDescriptor = {
            size: this.vertices.byteLength,
            usage: usage,
            mappedAtCreation: true
        };

        this.buffer = device.createBuffer(descriptor);

        //Buffer has been created, now load in the vertices
        new Float32Array(this.buffer.getMappedRange()).set(this.vertices);
        this.buffer.unmap();

        //now define the buffer layout
        this.bufferLayout = {
            //[TODO: Modify Here to be smart]
            arrayStride: 40,
            attributes: [
                {
                    shaderLocation: 0,
                    format: "float32x2",
                    offset: 0
                },
                {
                    shaderLocation: 1,
                    format: "float32x3",
                    offset: 12
                },
                {
                    shaderLocation: 2,
                    format: "float32",
                    offset: 24
                },
                {
                    shaderLocation: 3,
                    format: "float32x3",
                    offset: 28
                }
            ]
        }
    }

    updatePosition(deltaTime: number){
        //[TODO] 我在这里hard code了一个重力进去，需要改进

        //console.log(deltaTime);
        //update velocity
        var gravity = vec3.create(0,-0.00098,0);
        var tempVelocity = vec3.mulScalar(gravity, deltaTime);
        //console.log(this.vertices);
        //console.log(tempVelocity);
        var vel1 =vec3.create();
        vel1[0] = this.vertices[7];
        vel1[1] = this.vertices[8];
        vel1[2] = this.vertices[9];
        var vel2 = vec3.create();
        vel2[0] = this.vertices[7 + 10];
        vel2[1] = this.vertices[8 + 10];
        vel2[2] = this.vertices[9 + 10];
        var vel3 = vec3.create();
        vel3[0] = this.vertices[7 + 20];
        vel3[1] = this.vertices[8 + 20];
        vel3[2] = this.vertices[9 + 20];

        vel1 = vec3.add(vel1, tempVelocity);
        vel2 = vec3.add(vel2, tempVelocity);
        vel3 = vec3.add(vel3, tempVelocity);
        
        if(vec3.length(vel1) <= 100){
            this.vertices[7] = vel1[0];
            this.vertices[8] = vel1[1];
            this.vertices[9] = vel1[2];
        }
        if(vec3.length(vel2) <= 100){
            this.vertices[17] = vel1[0];
            this.vertices[18] = vel1[1];
            this.vertices[19] = vel1[2];
        }
        if(vec3.length(vel3) <= 100){
            this.vertices[27] = vel1[0];
            this.vertices[28] = vel1[1];
            this.vertices[29] = vel1[2];
        }

        // if(vel1[0] >= -100){
        //     this.vertices[7] = vel1[0];
        // }
        // if(vel1[1] >= -100){
        //     this.vertices[8] = vel1[1];
        // }
        // if(vel1[2] >= -100){
        //     this.vertices[9] = vel1[2];
        // }

        // this.vertices[7] = vel1[0];
        // this.vertices[8] = vel1[1];
        // this.vertices[9] = vel1[2];
        // this.vertices[17] = vel2[0];
        // this.vertices[18] = vel2[1];
        // this.vertices[19] = vel2[2];
        // this.vertices[27] = vel3[0];
        // this.vertices[28] = vel3[1];
        // this.vertices[29] = vel3[2];

        //update position
        var pos1 = vec3.create();
        pos1[0] = this.vertices[0];
        pos1[1] = this.vertices[1];
        pos1[2] = this.vertices[2];
        var pos2 = vec3.create();
        pos2[0] = this.vertices[0 + 10];
        pos2[1] = this.vertices[1 + 10];
        pos2[2] = this.vertices[2 + 10];
        var pos3 = vec3.create();
        pos3[0] = this.vertices[0 + 20];
        pos3[1] = this.vertices[1 + 20];
        pos3[2] = this.vertices[2 + 20];
        pos1 = vec3.add(vec3.mulScalar(vel1, deltaTime * 0.00001), pos1);
        pos2 = vec3.add(vec3.mulScalar(vel2, deltaTime * 0.00001), pos2);
        pos3 = vec3.add(vec3.mulScalar(vel3, deltaTime * 0.00001), pos3);
        console.log(this.vertices);
        if(pos1[1] >= -100){
            this.vertices[0] = pos1[0];
            this.vertices[1] = pos1[1];
            this.vertices[2] = pos1[2];
        }
        if(pos2[1] >= -100){
            this.vertices[10] = pos2[0];
            this.vertices[11] = pos2[1];
            this.vertices[12] = pos2[2];
        }
        if(pos3[1] >= -100){
            this.vertices[20] = pos3[0];
            this.vertices[21] = pos3[1];
            this.vertices[22] = pos3[2];
        }
        
        this.device.queue.writeBuffer(this.buffer, 0, this.vertices.buffer, this.vertices.byteOffset, this.vertices.byteLength);
    }
}