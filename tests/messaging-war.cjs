const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
for (const p of ['scripts/utils/player_picker.js','scripts/commands/messagebox.js','scripts/commands/sendmessage.js','scripts/utils/phone.js','scripts/utils/war.js','scripts/utils/country.js']) {
 cp.execFileSync(process.execPath,['--input-type=module','--check'],{input:fs.readFileSync(p)});
}
const source=fs.readFileSync('scripts/utils/war.js','utf8');
const method=source.slice(source.indexOf('    static cleanupMissingCountries'),source.indexOf('\n    /**'));
const data=new Map([['1',{id:1,warcountry:[2,3,99],players:['a'],peaceProposals:{2:{},99:{}}}],['3',{id:3,warcountry:[99],wardeath:5,players:['b']}]]);
const sent=[];
const ctx={countryDatas:{idList:[...data.keys()],get:id=>data.get(String(id)),set:(id,v)=>data.set(String(id),v)},sendDataForPlayers:(s,id)=>sent.push(id)};
vm.runInNewContext('class War {'+method+'}; War.cleanupMissingCountries(2);',ctx);
assert.deepEqual(Array.from(data.get('1').warcountry),[3]);
assert.equal(data.get('3').wardeath,0);
assert.equal(Object.keys(data.get('1').peaceProposals).length,0);
assert.deepEqual(sent,['b']);
const callbacks=[];
const eventContext={world:{beforeEvents:{entityHurt:{subscribe:f=>callbacks.push(f)}}},server:{EquipmentSlot:{Mainhand:'Mainhand'}}};
vm.runInNewContext(source.slice(source.lastIndexOf('world.beforeEvents.entityHurt.subscribe')),eventContext);
const event={damageSource:{damagingEntity:{typeId:'minecraft:player',getComponent:()=>({getEquipment:()=>({typeId:'minecraft:mace'})})}},hurtEntity:{typeId:'cw:core'}};
callbacks[0](event);assert.equal(event.cancel,true);
assert.ok(!fs.readFileSync('scripts/commands/sendmessage.js','utf8').includes('registerCommand'));
(async()=>{
 const responses=[{formValues:['']},{selection:2},{selection:3}];const forms=[];
 class Form { constructor(){this.buttons=[];forms.push(this)} title(){return this} textField(){return this} body(){return this} button(v){this.buttons.push(v);return this} async show(){return responses.shift()} }
 const context={ActionFormData:Form,ModalFormData:Form};vm.createContext(context);
 vm.runInContext(fs.readFileSync('scripts/utils/player_picker.js','utf8').replace(/^import .*;\n/,'').replace('export async','async')+'; globalThis.pick=selectPlayer;',context);
 const result=await context.pick({},()=>Array.from({length:105},(_,i)=>({id:i,name:'Player'+String(i).padStart(3,'0')})));
 assert.equal(result.id,20);assert.ok(forms.every(f=>f.buttons.length<=23));
 console.log('PASS: syntax (6 files), missing/deleted country cleanup, remaining wars preserved, mace cancellation, /s removal, picker pagination (105 players).');
})().catch(e=>{console.error(e);process.exitCode=1});
