// CHECKITOUT: this file loads all the shaders and preprocesses them with some common code


import commonRaw from './common.wgsl?raw';

import cubeDraw from './cube.wgsl?raw';


function evalShaderRaw(raw: string) {
    return eval('`' + raw + '`');
}

const commonSrc: string = evalShaderRaw(commonRaw);

function processShaderRaw(raw: string) {
    return commonSrc + evalShaderRaw(raw);
}

export const cubeSrc: string = processShaderRaw(cubeDraw);