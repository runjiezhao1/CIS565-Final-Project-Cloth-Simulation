import * as dat from 'dat.gui';
import { parseOBJ } from '../utils';
import { ObjMesh } from '../obj_mesh';
interface GUISettings 
{
    cameraSpeed: number;
    backgroundColor: number[];
}

export class GUIController 
{
    public settings: GUISettings;
    private gui: dat.GUI;
    public vertices : number[];
    public indices : number[];
    public updateBuffer : boolean = false;
    constructor() 
    {
        this.vertices = [];
        this.indices = [];
        this.gui = new dat.GUI();
        this.settings = {
          cameraSpeed: 1.0,
          backgroundColor: [255, 255, 255], // RGB color
        };
        this.initGUI();
    }

    private initGUI() 
    {
        //[TODO]:这一段params需要改一下
        var params = {
            loadFile: () => this.loadFile()
        };

        this.gui.add(this.settings, 'cameraSpeed', 1, 5).name('Camera Speed');
        this.gui.addColor(this.settings, 'backgroundColor').name('Background Color');
        this.gui.add(params, 'loadFile').name("Load Obj File");
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