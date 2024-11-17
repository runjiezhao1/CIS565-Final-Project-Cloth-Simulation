import { ClothRenderer } from "./clothSim/cloth_renderer";

//start cloth simluation
const main1 = async() => {
    var clothRenderer : ClothRenderer = new ClothRenderer("canvas-webgpu");
    clothRenderer.init().then(() => {
        clothRenderer.createClothInfo(3, 3, 500.0, 250.0, 1500.0, 0.3);
        clothRenderer.createClothBuffers();
        clothRenderer.writeBuffer();
        clothRenderer.createRenderPipeline();
        clothRenderer.renderCloth();
    });
}

main1();