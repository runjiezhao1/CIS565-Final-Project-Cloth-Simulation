import { ClothRenderer } from "./clothSim/cloth_renderer";
import { GUIController } from './gui/gui';
//start cloth simluation

const main1 = async() => {
    // camera control
    const canvas = document.querySelector("canvas#canvas-webgpu") as HTMLCanvasElement;
    if (!canvas) {
        console.error("Canvas element not found");
        return;
    }
    let isLeftMouseDown = false;
    let isRightMouseDown = false;
    let lastMouseX: number, lastMouseY: number;
    canvas.addEventListener('mousedown', (event: MouseEvent) => {
        if (event.button === 0) {
            isLeftMouseDown = true;
            console.log("left mouse click");
        } else if (event.button === 2) {
            isRightMouseDown = true;
            console.log("right mouse click");
        }
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    });
    document.addEventListener('mouseup', (event) => {
        isLeftMouseDown = false;
        isRightMouseDown = false;
    });
    canvas.addEventListener('mousemove', (event) => {
        if (isLeftMouseDown) {
            const dx = event.clientX - lastMouseX;
            const dy = event.clientY - lastMouseY;
            clothRenderer.rotateCamera(dx, dy);
        } else if (isRightMouseDown) {
            const dx = event.clientX - lastMouseX;
            const dy = event.clientY - lastMouseY;
            clothRenderer.panCamera(dx, dy);
        }
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    });
    canvas.addEventListener('wheel', (event) => {
        clothRenderer.zoomCamera(event.deltaY / 100);
    });

    // Cloth Renderer
    var clothRenderer : ClothRenderer = new ClothRenderer("canvas-webgpu");

    // call this after user set up the size of cloth
    clothRenderer.initializeGUI();
}

main1();