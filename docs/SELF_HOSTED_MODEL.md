# FOB 自部署模型接入

FOB 已提供 `self-hosted` 模型适配器，可调用部署者的 GPU 模型服务。复用现有画像确认、简历提示词、JSON 结果校验、任务记录、人工审核和简历保存流程。接口默认未配置，不会主动连接任何模型服务器。

## 配置方法

在运行 **FOB 后端** 的机器上设置环境变量，或将以下内容写入本机 `.env.local`，再重启 FOB。`.env.local` 已被 Git 忽略；不要把实际密钥写进 `.env.example` 或源码。

```dotenv
FMJ_SELF_HOSTED_BASE_URL=http://127.0.0.1:8000/v1
FMJ_SELF_HOSTED_MODEL=your-served-model-name
FMJ_SELF_HOSTED_API_KEY=
FMJ_SELF_HOSTED_TIMEOUT_MS=180000
FMJ_SELF_HOSTED_MAX_TOKENS=6000
```

- `BASE_URL`：模型 API 根地址，通常以 `/v1` 结尾；不要附加 `/chat/completions` 或 `/models`。支持反向代理路径前缀。
- `MODEL`：推理服务对外提供的模型 ID，例如其 `served-model-name`；需要与模型列表中的 ID 一致。
- `API_KEY`：模型服务自己的访问密钥，后端使用 Bearer 认证。仅对明确无需认证的受控内网服务留空。远程连接优先使用 HTTPS；密钥不会返回浏览器、写入 SQLite 或进入 JSON 导出。
- `TIMEOUT_MS`：生成请求超时，默认 180,000 毫秒，允许 1,000–600,000。模型列表检查最多等待 20 秒。
- `MAX_TOKENS`：输出 token 上限，默认 6,000，允许 128–32,768；实际可用值还受模型上下文窗口限制。

FOB 和模型在同一台机器且不使用独立容器时，可以使用上述回环地址；处于不同容器时，填写 FOB 容器可访问的模型服务名和端口；在不同机器上时，填写可达的内网地址或 HTTPS 地址。

配置后在「AI 与数据设置」选择「FOB 自部署模型」，点击「检测模型连接」，再保存生成设置。模型名称由服务端决定，网页用户不需要填写个人 Key，也不能修改服务器地址或服务密钥。未配置时检测和保存按钮不可用。

## 模型服务协议

模型服务应提供兼容的 HTTP JSON 接口：

| 接口 | FOB 的使用方式 |
| --- | --- |
| `GET /v1/models` | 查询 `{ "data": [{ "id": "your-served-model-name" }] }`，核对配置的模型是否存在 |
| `POST /v1/chat/completions` | 发送 `model`、`messages`、`max_tokens`、`stream: false` |

如果根地址使用其他路径，FOB 在该地址后追加 `/models` 和 `/chat/completions`。兼容服务可以使用 vLLM 等推理框架；模型本身需支持聊天指令及符合要求的 JSON 输出。[vLLM 官方接口文档](https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server/)

FOB 读取 `choices[0].message.content`，其中必须是以下形状的 JSON 字符串（提示词已说明要求）：

```json
{
  "content": "# 姓名\n## 专业技能\n- 来自真实画像的技能",
  "notes": []
}
```

`content` 是不超过 40,000 字符的非空 Markdown 简历；`notes` 为字符串数组。`usage.prompt_tokens` 和 `usage.completion_tokens` 可选，有值时随简历保存。非 JSON、缺少正文、输出被截断等情况会使任务失败，不会存入未通过校验的简历，也不会自动回退到其他厂商。生成使用现有简历写作技能和用户确认的画像、岗位快照。

连接检测只查询模型列表，不发送个人资料，也不证明模型已经能够成功生成合格简历。正式上线前需用实际模型完成生成质量、耗时和容量验证。

## FOB 后端接口

以下接口均复用当前本地会话校验，要求 `X-FMJ-Token`；POST 还要求同源请求及 JSON：

| 接口 | 作用 |
| --- | --- |
| `GET /api/self-hosted/status` | 返回是否配置、固定模型名称及服务标识，不包含地址或密钥 |
| `POST /api/self-hosted/test`，请求体 `{}` | 检查模型服务及配置的模型 ID；拒绝传入 URL、密钥或个人资料 |
| `GET /api/models?provider=self-hosted` | 返回模型服务中已找到、且部署者允许的那一个模型 |
| `POST /api/settings` | 使用 `provider: "self-hosted"`、配置的 `model`、`language` 和当前 `revision` 保存选择 |
| `POST /api/generate` | 使用 `provider: "self-hosted"`、配置的 `model`，以及现有的画像版本、岗位、请求 ID 和确认字段生成简历 |

`POST /api/credentials` 不能设置或清除自部署模型的服务密钥。客户端传入其他模型名称会被拒绝；请求不跟随重定向，错误信息不透传上游响应正文或密钥。

## 当前部署范围

本次新增的是 FOB 到模型服务的接入能力。FOB 网页仍保持单用户本机访问限制，`FMJ_DEPLOYMENT=local` 不变；不要仅修改监听地址就作为多人网站发布。目前同一实例一次执行一个简历生成任务，并发请求会收到 409，尚无多用户队列、账户隔离和积分扣费。后续服务器多人版需单独实现这些能力。

自动测试使用本机模拟模型服务，覆盖真实 HTTP 调用、模型检查、画像快照、结果持久化、密钥隔离、重定向、超时及失败处理；未使用你的 GPU 服务器或真实模型进行联调。
