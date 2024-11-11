export class CubeMesh {
    canvas : HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("canvas-webgpu");

    buffer: GPUBuffer
    bufferLayout: GPUVertexBufferLayout

    constructor(device: GPUDevice) {

        // x y r g b
        const vertices: Float32Array = new Float32Array(
            [
                -0.5, -0.5, 0, 1.0, 0.0, 0.0,
                0.5, -0.5, 0, 1.0, 0.0, 0.0,
                0.5, 0.5, 0, 1.0, 0.0, 0.0
            ]
        );

        const usage: GPUBufferUsageFlags = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
        //VERTEX: the buffer can be used as a vertex buffer

        const descriptor: GPUBufferDescriptor = {
            size: vertices.byteLength,
            usage: usage,
            mappedAtCreation: true
        };

        this.buffer = device.createBuffer(descriptor);

        //Buffer has been created, now load in the vertices
        new Float32Array(this.buffer.getMappedRange()).set(vertices);
        this.buffer.unmap();

        //now define the buffer layout
        this.bufferLayout = {
            arrayStride: 24,
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
                }
            ]
        }

    }
}