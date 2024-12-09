export class ParticleShader {
    particle_shader = `
        struct TransformData {
            model: mat4x4<f32>,
            view: mat4x4<f32>,
            projection: mat4x4<f32>,
        };
        @group(0) @binding(0) var<uniform> transformUBO: TransformData;

        struct VertexInput {
            @location(0) position: vec3<f32>
        };

        struct FragmentOutput {
            @builtin(position) Position: vec4<f32>,
            @location(0) Color: vec4<f32>,
        };

        @vertex
        fn vs_main(vertexInput: VertexInput) -> FragmentOutput {
            var output: FragmentOutput;
            let modelViewProj = transformUBO.projection * transformUBO.view * transformUBO.model;
            output.Position = modelViewProj * vec4<f32>(vertexInput.position, 1.0);
            output.Color = vec4<f32>(1.0, 0.0, 0.0, 1.0); // Pass vertex color to fragment shader
            return output;
        }

        @fragment
        fn fs_main(in: FragmentOutput) -> @location(0) vec4<f32> {
            let lightDir = normalize(vec3<f32>(0.0, 20.0, -1.0));
            let ambient = 1.0;
            let lighting = ambient + (1.0 - ambient); 
            let color = vec3<f32>(in.Color.xyz);
            return vec4<f32>(color * lighting, 1.0);
        }
    `;

    springShader = `
        struct TransformData {
            model: mat4x4<f32>,
            view: mat4x4<f32>,
            projection: mat4x4<f32>,
        };
        @group(0) @binding(0) var<uniform> transformUBO: TransformData;

        struct VertexInput {
            @location(0) position: vec3<f32>
        };

        struct FragmentOutput {
            @builtin(position) Position: vec4<f32>,
            @location(0) Color: vec4<f32>,
        };

        @vertex
        fn vs_main(vertexInput: VertexInput) -> FragmentOutput {
            var output: FragmentOutput;
            let modelViewProj = transformUBO.projection * transformUBO.view * transformUBO.model;
            output.Position = modelViewProj * vec4<f32>(vertexInput.position, 1.0);
            output.Color = vec4<f32>(1.0, 1.0, 1.0, 1.0); // Pass vertex color to fragment shader
            return output;
        }

        @fragment
        fn fs_main(in: FragmentOutput) -> @location(0) vec4<f32> {
            let lightDir = normalize(vec3<f32>(0.0, 20.0, 5.0));
            let ambient = 0.1;
            let lighting = ambient + (1.0 - ambient); 
            let color = vec3<f32>(in.Color.xyz);
            return vec4<f32>(color * lighting, 1.0);        
        }
    `;

    textureShader = `
    struct TransformData {
        model: mat4x4<f32>,
        view: mat4x4<f32>,
        projection: mat4x4<f32>,
    };
    @binding(0) @group(0) var<uniform> transformUBO: TransformData;
    @binding(1) @group(0) var myTexture: texture_2d<f32>;
    @binding(2) @group(0) var mySampler: sampler;
    @binding(3) @group(0) var<uniform> cameraPos: vec3<f32>;    
    
    struct LightData {
        position: vec3<f32>,
        color: vec4<f32>,
        intensity: f32,
        specularStrength: f32,
        shininess: f32,
    };
    @binding(4) @group(0) var<uniform> lightUBO: LightData; // Light
    @binding(5) @group(0) var<uniform> alpha: f32;
    
    struct VertexOutput {
        @builtin(position) Position : vec4<f32>,
        @location(0) TexCoord : vec2<f32>,
        @location(1) Normal : vec3<f32>,
        @location(2) FragPos : vec3<f32>, 
    };
    
    @vertex
    fn vs_main(@location(0) vertexPosition: vec3<f32>, @location(1) vertexTexCoord: vec2<f32>, @location(2) vertexNormal: vec3<f32>) -> VertexOutput {
        var output : VertexOutput;
        output.Position = transformUBO.projection * transformUBO.view * transformUBO.model * vec4<f32>(vertexPosition, 1.0);
        output.TexCoord = vertexTexCoord;
        output.Normal = (transformUBO.model * vec4<f32>(vertexNormal, 0.0)).xyz;
        output.FragPos = (transformUBO.model * vec4<f32>(vertexPosition, 1.0)).xyz; 
        return output;
    }
    
    @fragment
    fn fs_main(@location(0) TexCoord : vec2<f32>, @location(1) Normal : vec3<f32>, @location(2) FragPos: vec3<f32>) -> @location(0) vec4<f32> {            

        let texColor: vec4<f32> = textureSample(myTexture, mySampler, TexCoord);

        let lightPos: vec3<f32> = lightUBO.position;
        let lightColor: vec4<f32> = lightUBO.color;
        let lightIntensity: f32 = lightUBO.intensity;
        

        //let ambientColor: vec4<f32> = vec4<f32>(0.513725, 0.435294, 1.0, 1.0) * 0.001;
        let ambientColor: vec4<f32> = vec4<f32>(1.0, 1.0, 1.0, 1.0) * 0.1;
        
        // // diffuse
        let norm: vec3<f32> = normalize(Normal);
        let lightDir: vec3<f32> = normalize(lightPos - FragPos);
        let diff: f32 = max(dot(norm, lightDir), 0.0);
        let diffuse: vec4<f32> = lightColor * diff * lightIntensity * texColor;
    
        // // specular
        let viewDir: vec3<f32> = normalize(cameraPos - FragPos);
        let halfwayDir = normalize(lightDir + viewDir);
        let reflectDir: vec3<f32> = reflect(-lightDir, norm);
        let spec: f32 = pow(max(dot(viewDir, reflectDir), 0.0), lightUBO.shininess);
        let spec2 = pow(max(dot(norm, halfwayDir), 0.0), 32.0);
        let specular: vec4<f32> = lightColor * spec * vec4<f32>(0.429134, 0.429134, 0.429134, 1.0);
        let specular2 = spec2 * lightColor * lightIntensity;

        var finalColor: vec4<f32> = ambientColor + diffuse + specular2;

        //return vec4<f32>(1.0,1.0, 1.0, 1.0);
        return vec4<f32>(finalColor.x,finalColor.y, finalColor.z, 1.0);
        
        //return vec4<f32>(diffuse.x, diffuse.y, diffuse.z, 1.0);
    }

    `;

    freefallComputeShader = `
    
    @group(0) @binding(0) var<storage, read_write> positions: array<f32>;
    @group(0) @binding(1) var<storage, read_write> velocities: array<f32>;    
    @group(0) @binding(2) var<storage, read_write> fixed: array<u32>;
    @group(0) @binding(3) var<storage, read_write> force: array<f32>;   
    @group(0) @binding(4) var<storage, read_write> prevPosition: array<f32>;
    @group(0) @binding(5) var<uniform> externalForce : vec3<f32>;    

    fn getPosition(index:u32) -> vec3<f32>{
        return vec3<f32>(positions[index*3],positions[index*3+1],positions[index*3+2]);
    }
    
    fn getVelocity(index:u32) -> vec3<f32>{
        return vec3<f32>(velocities[index*3],velocities[index*3+1],velocities[index*3+2]);
    }

    fn getForce(index:u32) -> vec3<f32>{
        return vec3<f32>(force[index*3] / 2.0,force[index*3+1] / 2.0,force[index*3+2] / 2.0);
    }
    fn setPosition(index: u32, pos: vec3<f32>) {
        positions[index * 3 + 0] = pos.x;
        positions[index * 3 + 1] = pos.y;
        positions[index * 3 + 2] = pos.z;
    }

    @compute 
    @workgroup_size(256)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let index: u32 = global_id.x;
        var fixed1 = fixed[index];
        
        if(fixed1==1){
            return;
        }
        
        var pos = getPosition(index);
        var vel = getVelocity(index);
        var f = getForce(index) * 0.1;     
        
        prevPosition[index*3 + 0] = pos.x;
        prevPosition[index*3 + 1] = pos.y;
        prevPosition[index*3 + 2] = pos.z;  
        
        var gravity: vec3<f32> = vec3<f32>(0.0, -32.6, 0.0);        
        var deltaTime: f32 = 0.002; // Assuming 60 FPS for simplicity
        vel += ((f + gravity) * deltaTime);
        pos += (vel * deltaTime);

        //floor collisions
        if(pos.y < 0.0){
            pos.y = 0.0; 
            vel.y = 0.0;      
        }

        // self-collision detection
        let collisionRadius: f32 = 0.25;
        for (var otherIndex: u32 = 0; otherIndex < arrayLength(&positions) / 3; otherIndex++) {
            var fixed2 = fixed[otherIndex];
            if (otherIndex == index || fixed2 == 1) {
                continue;
            }
            let otherPos = getPosition(otherIndex);
            let delta = pos - otherPos;
            let distanceSquared = dot(delta, delta);
            let radiusSquared = collisionRadius * collisionRadius;

            if (distanceSquared < radiusSquared) {
                let distance = sqrt(distanceSquared);
                let correction = (collisionRadius - distance) * 0.5; // Split correction evenly
                let correctionVector = normalize(delta) * correction;

                // Resolve collision
                pos += correctionVector;
                if (fixed[otherIndex] == 0) {
                    setPosition(otherIndex, otherPos - correctionVector);
                }
            }
        }
 /*
        if(externalForce.z!=0.0){                                    
            if(index < 600 && pos.z < 120.0){
                pos.z += 0.1;
                vel.y = -32.6;
                vel.z = 20.0;
            }            
            else{
                //pos.y += 0.01;
            }
            vel.z = 10.0;
        }
*/

        velocities[index*3 + 0] = vel.x;
        velocities[index*3 + 1] = vel.y;
        velocities[index*3 + 2] = vel.z;

        //positions[index*3 + 0] = pos.x;
        //positions[index*3 + 1] = pos.y;
        //positions[index*3 + 2] = pos.z;
    }    
    `;

    getParticleShader() {
        return this.particle_shader;
    }

    getComputeShader() {
        return this.freefallComputeShader;
    }

    getSpringShader() {
        return this.springShader;
    }

    getTextureShader() {
        return this.textureShader;
    }
}
