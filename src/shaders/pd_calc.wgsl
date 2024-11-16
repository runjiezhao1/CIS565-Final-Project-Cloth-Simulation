struct Uniforms {
    projectionMatrix : mat4x4<f32>,
    viewMatrix : mat4x4<f32>,
    //[TODO:] 我这里只用了vec4的第一位因为webgpu最少要4个float加进来
    deltaTime: vec4<f32>
};
@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(1) @binding(0) var<storage, read_write> velocityBuffer: array<vec3<f32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;

    // 读取 velocityBuffer
    let original: vec3<f32> = velocityBuffer[index];

    // 修改值
    var gravity : vec3<f32> = vec3<f32>(0,-0.00098,0);
    var time = uniforms.deltaTime.x;
    var tempVelocity = gravity * time;
    let modified: vec3<f32> = original + tempVelocity;
    
    // 写回 velocityBuffer
    velocityBuffer[index] = modified;
}
