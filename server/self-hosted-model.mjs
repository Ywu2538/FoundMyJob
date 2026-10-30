import {readJson} from './jobs.mjs';

const unavailable=()=>new Error('FOB 自部署模型尚未配置，请联系部署者。');
function integer(value,fallback,min,max,name){
 if(value===undefined||value==='')return fallback;
 if(!/^\d+$/.test(String(value)))throw new Error(name+' 必须是整数。');
 const number=Number(value);
 if(!Number.isSafeInteger(number)||number<min||number>max)throw new Error(name+' 超出允许范围。');
 return number;
}

// Deployment configuration only. Never accept a model URL or service key from a browser request.
export function selfHostedConfig(env=process.env){
 const base=env.FMJ_SELF_HOSTED_BASE_URL?.trim()||'',model=env.FMJ_SELF_HOSTED_MODEL?.trim()||'',key=env.FMJ_SELF_HOSTED_API_KEY||'';
 if(!base&&!model&&!key)return null;
 if(!base||!model)throw new Error('请同时配置 FMJ_SELF_HOSTED_BASE_URL 和 FMJ_SELF_HOSTED_MODEL。');
 let url;try{url=new URL(base);}catch{throw new Error('FMJ_SELF_HOSTED_BASE_URL 不是有效的 HTTP(S) 地址。');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||/[\x00-\x20\\]/.test(base))throw new Error('模型地址必须使用 HTTP(S)，且不能包含登录信息、查询参数或片段。');
 const pathname=url.pathname.replace(/\/+$/,'');
 if(/\/(?:chat\/completions|models)$/.test(pathname))throw new Error('模型地址应填写 API 根地址（例如 /v1），不要包含 /chat/completions 或 /models。');
 if(model.length>200||/[\x00-\x1f\x7f]/.test(model))throw new Error('FMJ_SELF_HOSTED_MODEL 格式无效。');
 if(key&&(key.length>2048||/[\s\x00-\x1f\x7f]/.test(key)))throw new Error('FMJ_SELF_HOSTED_API_KEY 格式无效。');
 return Object.freeze({base:url.origin+pathname,model,key,
  timeoutMs:integer(env.FMJ_SELF_HOSTED_TIMEOUT_MS,180000,1000,600000,'FMJ_SELF_HOSTED_TIMEOUT_MS'),
  maxTokens:integer(env.FMJ_SELF_HOSTED_MAX_TOKENS,6000,128,32768,'FMJ_SELF_HOSTED_MAX_TOKENS')});
}

export class SelfHostedModel {
 #config; #fetcher;
 constructor({env=process.env,fetcher=fetch}={}){this.#config=selfHostedConfig(env);this.#fetcher=fetcher;}
 describe(){return {id:'self-hosted',name:'FOB 自部署模型',managed:true,configured:!!this.#config,model:this.#config?.model||'',note:'由部署者配置模型服务，用户无需填写 API Key。'};}
 assertModel(model){
  if(!this.#config)throw unavailable();
  if(model!==this.#config.model)throw new Error('自部署模型已变更或未获允许，请刷新设置并选择部署者配置的模型。');
 }
 get maxTokens(){return this.#config?.maxTokens;}
 async request(endpoint,body){
  const config=this.#config;if(!config)throw unavailable();
  if(!((endpoint==='/models'&&!body)||(endpoint==='/chat/completions'&&body)))throw new Error('不支持的自部署模型接口。');
  try{
   const response=await this.#fetcher(config.base+endpoint,{method:body?'POST':'GET',
    headers:{...(config.key?{Authorization:'Bearer '+config.key}:{}),...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(body?config.timeoutMs:Math.min(config.timeoutMs,20000))});
   if(!response.ok){
    const message=[401,403].includes(response.status)?'自部署模型认证失败，请部署者检查服务密钥。':response.status===429?'自部署模型繁忙，请稍后重试。':'自部署模型返回 HTTP '+response.status+'，请部署者检查模型服务。';
    throw Object.assign(new Error(message),{safe:true});
   }
   return await readJson(response,4000000);
  }catch(error){
   if(error.safe)throw new Error(error.message);
   throw new Error('自部署模型连接超时、网络不可用或响应格式异常，请联系部署者。');
  }
 }
 async models(){
  const result=await this.request('/models');
  if(!Array.isArray(result.data))throw new Error('自部署模型列表格式异常。');
  if(!result.data.some(model=>model?.id===this.#config.model))throw new Error('模型服务未列出配置的模型，请部署者核对模型名称。');
  // Only the deployment-approved model is offered, even if the service hosts others.
  return [{id:this.#config.model,name:this.#config.model,free:false,maxOutput:this.#config.maxTokens}];
 }
 async testConnection(){await this.models();return {ok:true,model:this.#config.model,checkedAt:new Date().toISOString()};}
}
