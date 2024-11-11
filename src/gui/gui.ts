import * as dat from 'dat.gui';

interface GUISettings 
{
    cameraSpeed: number;
    backgroundColor: number[];
}

export class GUIController 
{
    public settings: GUISettings;
    private gui: dat.GUI;

    constructor() 
    {
        this.gui = new dat.GUI();
        this.settings = {
          cameraSpeed: 1.0,
          backgroundColor: [255, 255, 255], // RGB color
        };
        this.initGUI();
    }

    private initGUI() 
    {
        this.gui.add(this.settings, 'cameraSpeed', 1, 5).name('Camera Speed');
        this.gui.addColor(this.settings, 'backgroundColor').name('Background Color');
    }

    public onBackgroundColorChange(callback: (color: number[]) => void) 
    {
        this.gui.__controllers[2].onChange(callback);
    }

}
