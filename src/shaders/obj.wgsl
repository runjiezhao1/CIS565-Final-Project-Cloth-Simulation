struct TransformData {
        model: mat4x4<f32>,
        view: mat4x4<f32>,
        projection: mat4x4<f32>,
};

struct LightData {
    position: vec3<f32>,
    color: vec4<f32>,
    intensity: f32,
    specularStrength: f32,
    shininess: f32,
};

@group(0) @binding(0) var<uniform> transformUBO: TransformData;
@group(0) @binding(1) var myTexture: texture_2d<f32>;
@group(0) @binding(2)  var mySampler: sampler;
@group(0) @binding(3)  var<uniform> lightUBO: LightData;
@group(0) @binding(4) var<uniform> cameraPos: vec3<f32>;   


struct Fragment {
    @builtin(position) Position : vec4<f32>,
    @location(0) TexCoord : vec2<f32>,
    @location(1) Color : vec3<f32>,
    @location(2) FragPos : vec3<f32>,
    @location(3) Normal: vec3<f32>
};

@vertex
fn vs_main(@location(0) vertexPosition: vec3<f32>, @location(1) vertexTexCoord: vec2<f32>, @location(2) vertexNormal: vec3<f32>) -> Fragment {
    var output : Fragment;
    output.Position = transformUBO.projection * transformUBO.view * transformUBO.model * vec4<f32>(vertexPosition, 1);
    output.Color = vec3<f32>(normalize(vertexPosition));
    output.TexCoord = vertexTexCoord;
    output.FragPos = (transformUBO.model * vec4<f32>(vertexPosition, 1.0)).xyz;
    output.Normal = (transformUBO.model * vec4<f32>(vertexNormal, 0.0)).xyz;
    return output;
}

@fragment
fn fs_main(@location(0) TexCoord: vec2<f32> ,@location(1) Color: vec3<f32> , @location(2) FragPos: vec3<f32>, @location(3) Normal: vec3<f32>) -> @location(0) vec4<f32> {
    let texColor: vec4<f32> = textureSample(myTexture, mySampler, TexCoord);

    let lightPos: vec3<f32> = lightUBO.position;
    let lightColor: vec4<f32> = lightUBO.color;
    let lightIntensity: f32 = lightUBO.intensity;

    let ambientColor: vec4<f32> = vec4<f32>(1.0, 1.0, 1.0, 1.0) * 2.0;

    // // diffuse
    let norm: vec3<f32> = normalize(Normal);
    let lightDir: vec3<f32> = normalize(lightPos - FragPos);
    let diff: f32 = max(dot(norm, lightDir), 0.0);
    let diffuse: vec4<f32> = lightColor * diff * lightIntensity * vec4<f32>(Color, 1);

    // // specular
    let viewDir: vec3<f32> = normalize(cameraPos - FragPos);
    let halfwayDir = normalize(lightDir + viewDir);
    let reflectDir: vec3<f32> = reflect(-lightDir, norm);
    let spec: f32 = pow(max(dot(viewDir, reflectDir), 0.0), lightUBO.shininess);
    let spec2 = pow(max(dot(norm, halfwayDir), 0.0), 32.0);
    //let specular: vec4<f32> = lightColor * spec * vec4<f32>(0.429134, 0.429134, 0.429134, 1.0);
    let specular2 = spec2 * lightColor * lightIntensity;

    var finalColor: vec4<f32> = (ambient + diffuse) * texColor;
    
    //return vec4<f32>(finalColor.x,finalColor.y, finalColor.z, 1.0);
    //return vec4<f32>(1,1,1,1);
    return vec4<f32>(finalColor.xyz, 1.0);
    //return vec4<f32>(TexCoord, 1, 1);
    //return vec4<f32>(Color, 1);
    //return vec4<f32>(texColor.xyz, 1);
}