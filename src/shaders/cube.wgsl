struct Uniforms {
    projectionMatrix : mat4x4<f32>,
    viewMatrix : mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct Fragment {
    @builtin(position) Position : vec4<f32>,
    @location(0) Color : vec4<f32>
};

@vertex
fn vs_main(@location(0) vertexPosition: vec3<f32>, @location(1) vertexColor: vec3<f32>) -> Fragment {
    var output : Fragment;
    output.Position = uniforms.projectionMatrix * uniforms.viewMatrix * vec4<f32>(vertexPosition, 1);
    output.Color = vec4<f32>(vertexColor, 1.0);

    return output;
}

@fragment
fn fs_main(@location(0) Color: vec4<f32>) -> @location(0) vec4<f32> {
    return Color;
}