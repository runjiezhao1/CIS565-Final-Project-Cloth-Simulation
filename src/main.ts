import { ClothRenderer } from "./clothSim/cloth_renderer";

//start cloth simluation
const main1 = async() => {
    var clothRenderer : ClothRenderer = new ClothRenderer("canvas-webgpu");
    clothRenderer.init().then(() => {
        clothRenderer.createClothInfo(100, 100, 500.0, 250.0, 1500.0, 0.3);
        clothRenderer.createClothBuffers();
        clothRenderer.createRenderPipeline();
        clothRenderer.createSpringPipeline();
        clothRenderer.createTrianglePipeline();
        clothRenderer.createParticlePipeline();
        clothRenderer.createUpdateNormalPipeline();
        clothRenderer.createSpringForceComputePipeline();
        clothRenderer.createNodeForceSummationPipeline();
        clothRenderer.createIntersectionPipeline();
        clothRenderer.createTriTriIntersectionPipeline();



        // clothRenderer.writeBuffer();
        // clothRenderer.createRenderPipelineObj();
        // clothRenderer.renderCloth();

        beginRender();
        
    });

    function beginRender() {
        clothRenderer.render();
        requestAnimationFrame(beginRender);
    }
}

main1();