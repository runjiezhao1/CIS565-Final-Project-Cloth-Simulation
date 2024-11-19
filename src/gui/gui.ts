import * as dat from 'dat.gui';
import { parseOBJ } from '../utils';
import { ObjMesh } from '../obj_mesh';
import { Camera } from '../stage/camera'; 
//import { main1 } from '../main';
interface GUISettings 
{
    sensitivity: number;
    clothSizeX: number;
    clothSizeY: number;
}

export class GUIController 
{
    public settings: GUISettings;
    public gui: dat.GUI = new dat.GUI();
    public vertices : number[];
    public indices : number[];
    public updateBuffer : boolean = false;
    private camera: Camera;
    constructor() 
    {
        this.vertices = [];
        this.indices = [];
        this.gui = new dat.GUI();
        this.settings = {
            sensitivity: 1.0,
            clothSizeX: 5,
            clothSizeY: 5,
        };
        //this.initGUI();
    }

    public initGUI() 
    {
        // Add button options here:
        var params = {
            loadFile: () => this.loadFile(),
            startSimulation: () => {
                //main1();
                console.log("start cloth simulation!");
            }
        };
        // Folder for attributes of cloth
        const folder_cloth = this.gui.addFolder('Cloth');
        folder_cloth.add(this.settings, 'clothSizeX', 1, 100).name('Cloth Size X');
        folder_cloth.add(this.settings, 'clothSizeY', 1, 100).name('Cloth Size Y');
        folder_cloth.open();

        // Folder for camera
        const folder_camera = this.gui.addFolder('Camera');
        const sensitivityControl = folder_camera.add(this.settings, 'sensitivity', 1, 5).name('Sensitivity');
        sensitivityControl.onChange((value: number) => {
            this.camera.sensitivity = value * 0.1; // Update the camera's sensitivity when the slider is changed
        });

        // other attributes
        this.gui.add(params, 'loadFile').name("Load Obj File");
        this.gui.add(params, 'startSimulation').name("Start");
        
    }

    public onBackgroundColorChange(callback: (color: number[]) => void) 
    {
        this.gui.__controllers[2].onChange(callback);
    }

    public loadFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.obj';
        input.onchange = async (event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (!file) return;
      
          const text = await file.text();
          const { vertices, indices } = parseOBJ(text);
          this.vertices = vertices;
          this.indices = indices;
          console.log(vertices);
          console.log(indices);
          this.updateBuffer = true;
        };
        input.click();
    }
}