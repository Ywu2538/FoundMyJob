import { buildPrompt, parseCursorOutput } from './cursor.mjs';
import { readJson } from './jobs.mjs';
import {SelfHostedModel} from './self-hosted-model.mjs';

export const PROVIDERS = [
  {id:'deepseek',name:'DeepSeek',base:'https://api.deepseek.com/v1',console:'https://platform.deepseek.com/',pricing:'https://api-docs.deepseek.com/quick_start/pricing',note:'按厂商价格计费；不标记为免费。'},
  {id:'kimi',name:'Kimi / Moonshot',base:'https://api.moonshot.cn/v1',console:'https://platform.moonshot.cn/console/api-keys',pricing:'https://platform.moonshot.cn/docs/pricing/chat',note:'使用 Kimi 开放平台 API Key；按账户和模型计费。'},
  {id:'doubao',name:'豆包 / 火山方舟',base:'https://ark.cn-beijing.volces.com/api/v3',console:'https://console.volcengine.com/ark/region:cn-beijing/apiKey',pricing:'https://www.volcengine.com/docs/82379/1544106',manualModel:true,note:'使用火山方舟 API Key，并填写已开通的 Model ID 或推理接入点 ID。'},
  {id:'grok',name:'Grok / xAI',base:'https://api.x.ai/v1',console:'https://console.x.ai/',pricing:'https://docs.x.ai/docs/models',note:'使用 xAI API Key；Grok 订阅与 API 账户计费分别管理。'},
  {id:'gemini',name:'Gemini',base:'https://generativelanguage.googleapis.com/v1beta/openai',console:'https://aistudio.google.com/apikey',pricing:'https://ai.google.dev/gemini-api/docs/pricing',note:'使用 Google AI Studio 的 Gemini API Key；可用地区、模型与额度以账户为准。'},
  {id:'siliconflow',name:'SiliconFlow',base:'https://api.siliconflow.cn/v1',console:'https://cloud.siliconflow.cn/',pricing:'https://siliconflow.cn/pricing',note:'部分模型可能免费；此接口未提供价格时，请以厂商价目表为准。'},
  {id:'openrouter',name:'OpenRouter',base:'https://openrouter.ai/api/v1',console:'https://openrouter.ai/settings/keys',pricing:'https://openrouter.ai/models?max_price=0',note:'支持实时筛选输入、输出价格均为 0 的模型；免费模型仍有调用限制。'},
  {id:'groq',name:'Groq',base:'https://api.groq.com/openai/v1',console:'https://console.groq.com/keys',pricing:'https://console.groq.com/docs/rate-limits',note:'有 Free 账户限额；模型列表不代表你的账户当前免费。'},
];
export class Providers {
  constructor({fetcher=fetch,selfHosted=new SelfHostedModel({fetcher})}={}) {this.keys=new Map();this.fetcher=fetcher;this.selfHosted=selfHosted;}
  provider(id) {if(id==='self-hosted')return this.selfHosted.describe();const p=PROVIDERS.find(p=>p.id===id);if(!p)throw new Error('不支持该 API 厂商。');return p;}
  list() {return [...PROVIDERS.map(p=>({...p,configured:this.keys.has(p.id)})),this.selfHosted.describe()];}
  setKey(id,key) {if(this.provider(id).managed)throw new Error('自部署模型密钥由部署者管理，不能通过个人 Key 接口修改。');if(typeof key!=='string'||key.length<8||key.length>2048||/[\s\x00-\x1f]/.test(key))throw new Error('API Key 格式无效。');this.keys.set(id,key);}
  clearKey(id) {if(this.provider(id).managed)throw new Error('自部署模型密钥由部署者管理，不能通过个人 Key 接口修改。');this.keys.delete(id);}
  assertReady(id,model){if(id==='self-hosted')this.selfHosted.assertModel(model);else if(!this.keys.has(id))throw new Error('请在 AI 设置中输入你自己的 API Key。');}
  async request(id,endpoint,body,{anonymous=false}={}) {
    if(id==='self-hosted')return this.selfHosted.request(endpoint,body);
    const p=this.provider(id),key=this.keys.get(id);if(!key&&!anonymous)throw new Error('请先在 AI 设置中输入你自己的 API Key。');
    try {const response=await this.fetcher(p.base+endpoint,{method:body?'POST':'GET',headers:{...(key?{Authorization:`Bearer ${key}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(body?120000:20000)});
      if(!response.ok)throw Object.assign(new Error(response.status===401?'API Key 无效或已过期。':response.status===429?'厂商限流或免费额度已用完，请稍后重试。':response.status===402?'厂商账户额度不足。':`厂商返回 HTTP ${response.status}，请检查模型与账户权限。`),{safe:true});
      return await readJson(response,4000000);
    }catch(e){if(e.safe)throw new Error(e.message);throw new Error('厂商请求超时、网络不可用或响应格式异常；未自动切换模型。');}
  }
  async models(id) {
    if(id==='self-hosted')return this.selfHosted.models();
    if(this.provider(id).manualModel)throw new Error('此厂商请直接填写控制台已开通的 Model ID 或推理接入点 ID。');
    const r=await this.request(id,id==='siliconflow'?'/models?type=text&sub_type=chat':'/models',null,{anonymous:id==='openrouter'});
    if(!Array.isArray(r.data))throw new Error('模型列表格式异常。');
    return r.data.filter(m=>typeof m.id==='string'&&!/whisper|tts|embedding|imagen|veo|image|audio|video|safeguard|prompt-guard|content-safety|\/free$|\/auto$/i.test(m.id)&&(id!=='openrouter'||(m.architecture?.input_modalities?.includes('text')&&m.architecture?.output_modalities?.includes('text'))))
      .map(m=>({id:m.id,name:m.name||m.id,free:id==='openrouter'&&m.pricing?.prompt!=null&&m.pricing?.completion!=null&&['prompt','completion','request'].every(k=>m.pricing[k]===undefined&&k==='request'||m.pricing[k]!==null&&String(m.pricing[k]).trim()!==''&&Number(m.pricing[k])===0),maxOutput:m.top_provider?.max_completion_tokens||null}));
  }
  async generate({profile,job,language,provider,model,freeOnly}) {
    if(typeof model!=='string'||!model.trim()||model.length>200)throw new Error('请选择有效模型。');
    this.assertReady(provider,model);
    let maxTokens=provider==='self-hosted'?this.selfHosted.maxTokens:6000;
    if(provider==='self-hosted'&&freeOnly)throw new Error('自部署模型不使用第三方免费模型筛选，请刷新生成设置。');
    if(freeOnly) {const models=await this.models(provider),selected=models.find(m=>m.id===model&&m.free);if(!selected)throw new Error('无法确认此模型仍为免费，已停止调用。请选择已标记免费的模型。');if(selected.maxOutput)maxTokens=Math.min(maxTokens,selected.maxOutput);}
    const routing=provider==='openrouter'?{provider:{allow_fallbacks:false,...(freeOnly?{max_price:{prompt:0,completion:0,request:0}}:{})}}:['kimi','doubao'].includes(provider)?{thinking:{type:'disabled'}}:{};
    const r=await this.request(provider,'/chat/completions',{model,messages:[{role:'user',content:buildPrompt(profile,job,language)}],max_tokens:maxTokens,stream:false,...routing});
    if(r.choices?.[0]?.finish_reason==='length')throw new Error('模型输出被截断，请精简档案后重试。');
    const text=r.choices?.[0]?.message?.content;if(typeof text!=='string')throw new Error('模型未返回简历内容。');
    const parsed=parseCursorOutput(JSON.stringify({type:'result',result:text}),language);
    return {...parsed,mode:provider,model,usage:r.usage?{prompt_tokens:r.usage.prompt_tokens,completion_tokens:r.usage.completion_tokens}:null};
  }
}
