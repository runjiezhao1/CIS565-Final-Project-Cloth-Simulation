struct Uniforms {
    projectionMatrix : mat4x4<f32>,
    viewMatrix : mat4x4<f32>,
    //[TODO:] 我这里只用了vec4的第一位因为webgpu最少要4个float加进来
    deltaTime: vec4<f32>
};
@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct Fragment {
    @builtin(position) Position : vec4<f32>,
    @location(0) Color : vec4<f32>
};

@vertex
fn vs_main(@location(0) vertexPosition: vec3<f32>) -> Fragment {
    var output : Fragment;
    output.Position = uniforms.projectionMatrix * uniforms.viewMatrix * vec4<f32>(vertexPosition, 1);
    output.Color = normalize(vec4<f32>(vertexPosition, 1.0));;//vec4<f32>(1.0, 0.0, 1.0, 1.0);
    var time = uniforms.deltaTime;
    return output;
}

@fragment
fn fs_main(@location(0) Color: vec4<f32>) -> @location(0) vec4<f32> {
    return Color;
}