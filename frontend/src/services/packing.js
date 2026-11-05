export const emptyPacking={bultos:1,peso:null,alto:null,ancho:null,largo:null,preparado_por:'',notas:'',fragil:true,revisados:[],version:0};
export const normalizePacking=value=>({...emptyPacking,...value,...Object.fromEntries(['peso','alto','ancho','largo'].map(name=>[name,value?.[name]==null?null:Number(value[name])]))});
