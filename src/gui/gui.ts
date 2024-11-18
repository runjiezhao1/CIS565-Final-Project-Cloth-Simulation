import * as dat from 'dat.gui';
import { parseOBJ } from '../utils';
import { ObjMesh } from '../obj_mesh';
import { Camera } from '../stage/camera'; 

interface GUISettings 
{
    sensitivity: number;
    clothSizeX: number;
    clothSizeY: number;
}

export class GUIController 
{
    public settings: GUISettings;
    public gui: dat.GUI;
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