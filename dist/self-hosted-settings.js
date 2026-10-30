export function selfHostedSettingsHtml(provider,tr,e){
 return `<div class="notice"><b>${tr('FOB 自部署模型','FOB self-hosted model')}</b><p>${tr('由部署者提供模型服务，无需填写个人 API Key。','The model service is provided by the deployment owner. No personal API key is needed.')}</p></div>
 <p class="field-help">${provider.configured?tr('模型已配置，可检测连接后使用。','A model is configured. Check the connection before using it.'):tr('尚未接入模型服务器，请联系部署者完成配置。','No model server is configured yet. Contact the deployment owner.')}</p>
 <label>${tr('部署模型','Deployed model')}<input name="model" value="${e(provider.model||'')}" readonly required placeholder="${tr('尚未配置','Not configured')}"/></label>
 <button type="button" class="button secondary" data-action="test-self-hosted" ${provider.configured?'':'disabled'}>${tr('检测模型连接','Check model connection')}</button>
 <p id="self-hosted-status" class="field-help" role="status"></p>
 <p class="field-help">${tr('检测只查询模型列表，不发送个人经历。生成简历时才会发送你确认的画像和岗位要求。','The check only queries the model list; it does not send your experience. Generation sends the profile and job requirements you confirm.')}</p>`;
}
