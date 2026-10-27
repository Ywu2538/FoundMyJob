import { buildPrompt, parseCursorOutput } from './cursor.mjs';
import { readJson } from './jobs.mjs';

export const PROVIDERS = [
  {id:'deepseek',name:'DeepSeek',base:'https://api.deepseek.com/v1',console:'https://platform.deepseek.com/',pricing:'https://api-docs.deepseek.com/quick_start/pricing',note:'按厂商价格计费；不标记为免费。'},
  {id:'siliconflow',name:'SiliconFlow',base:'https://api.siliconflow.cn/v1',console:'https://cloud.siliconflow.cn/',pricing:'https://siliconflow.cn/pricing',note:'部分模型可能免费；此接口未提供价格时，请以厂商价目表为准。'},
  {id:'openrouter',name:'OpenRouter',base:'https://openrouter.ai/api/v1',console:'https://openrouter.ai/settings/keys',pricing:'https://openrouter.ai/models?max_price=0',note:'支持实时筛选输入、输出价格均为 0 的模型；免费模型仍有调用限制。'},
  {id:'groq',name:'Groq',base:'https://api.groq.com/openai/v1',console:'https://console.groq.com/keys',pricing:'https://console.groq.com/docs/rate-limits',note:'有 Free 账户限额；模型列表不代表你的账户当前免费。'},
];
export class Providers {
  constructor({fetcher=fetch}={}) {this.keys=new Map();this.fetcher=fetcher;}
  provider(id) {const p=PROVIDERS.find(p=>p.id===id);if(!p)throw new Error('不支持该 API 厂商。');return p;}
  list() {return PROVIDERS.map(p=>({...p,configured:this.keys.has(p.id)}));}
  setKey(id,key) {this.provider(id);if(typeof key!=='string'||key.length<8||key.length>2048||/[\s\x00-\x1f]/.test(key))throw new Error('API Key 格式无效。');this.keys.set(id,key);}
  clearKey(id) {this.provider(id);this.keys.delete(id);}
  async request(id,endpoint,body,{anonymous=false}={}) {
    const p=this.provider(id),key=this.keys.get(id);if(!key&&!anonymous)throw new Error('请先在 AI 设置中输入你自己的 API Key。');
    try {const response=await this.fetcher(p.base+endpoint,{method:body?'POST':'GET',headers:{...(key?{Authorization:`Bearer ${key}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(body?120000:20000)});
      if(!response.ok)throw Object.assign(new Error(response.status===401?'API Key 无效或已过期。':response.status===429?'厂商限流或免费额度已用完，请稍后重试。':response.status===402?'厂商账户额度不足。':`厂商返回 HTTP ${response.status}，请检查模型与账户权限。`),{safe:true});
      return await readJson(response,4000000);
    }catch(e){if(e.safe)throw new Error(e.message);throw new Error('厂商请求超时、网络不可用或响应格式异常；未自动切换模型。');}
  }
  async models(id) {
    const r=await this.request(id,id==='siliconflow'?'/models?type=text&sub_type=chat':'/models',null,{anonymous:id==='openrouter'});
    if(!Array.isArray(r.data))throw new Error('模型列表格式异常。');
    return r.data.filter(m=>typeof m.id==='string'&&!/whisper|tts|safeguard|prompt-guard|content-safety|\/free$|\/auto$/i.test(m.id)&&(id!=='openrouter'||(m.architecture?.input_modalities?.includes('text')&&m.architecture?.output_modalities?.includes('text'))))
      .map(m=>({id:m.id,name:m.name||m.id,free:id==='openrouter'&&m.pricing?.prompt!=null&&m.pricing?.completion!=null&&['prompt','completion','request'].every(k=>m.pricing[k]===undefined&&k==='request'||m.pricing[k]!==null&&String(m.pricing[k]).trim()!==''&&Number(m.pricing[k])===0),maxOutput:m.top_provider?.max_completion_tokens||null}));
  }
  async generate({profile,job,language,provider,model,freeOnly}) {
    if(typeof model!=='string'||!model.trim()||model.length>200)throw new Error('请选择有效模型。');
    let maxTokens=6000;
    if(freeOnly) {const models=await this.models(provider),selected=models.find(m=>m.id===model&&m.free);if(!selected)throw new Error('无法确认此模型仍为免费，已停止调用。请选择已标记免费的模型。');if(selected.maxOutput)maxTokens=Math.min(maxTokens,selected.maxOutput);}
    const routing=provider==='openrouter'?{provider:{allow_fallbacks:false,...(freeOnly?{max_price:{prompt:0,completion:0,request:0}}:{})}}:{};
    const r=await this.request(provider,'/chat/completions',{model,messages:[{role:'user',content:buildPrompt(profile,job,language)}],max_tokens:maxTokens,stream:false,...routing});
    if(r.choices?.[0]?.finish_reason==='length')throw new Error('模型输出被截断，请精简档案后重试。');
    const text=r.choices?.[0]?.message?.content;if(typeof text!=='string')throw new Error('模型未返回简历内容。');
    const parsed=parseCursorOutput(JSON.stringify({type:'result',result:text}),language);
    return {...parsed,mode:provider,model,usage:r.usage?{prompt_tokens:r.usage.prompt_tokens,completion_tokens:r.usage.completion_tokens}:null};
  }
}
